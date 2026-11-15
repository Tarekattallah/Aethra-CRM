import { PasswordResetRequest as Reset } from '../models/PasswordResetRequest.js';
import { canManageAccount, hasPermission } from '../utils/permissions.js';
import { Notification, NotificationType } from '../models/Notification.js';
import { Router } from 'express';
import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authenticate, AuthRequest, requirePermission } from '../middlewares/auth.middleware.js';
import { validateBody, validateObjectId } from '../middlewares/validation.middleware.js';
import { User, UserRole, isAdministrator } from '../models/User.js';
import { sseHub } from '../sse/sse.hub.js';
import { logAudit } from '../services/audit.service.js';
import { serializeLeadMutation } from '../services/mutation-queue.service.js';


const Desk = mongoose.model('PersonalDesk', new Schema({ownerId:{type:Schema.Types.ObjectId, ref:'User', required:true, unique:true}, notes:{type:String,default:''}, tasks:{type:[{id:String,title:String,done:Boolean}],default:[]}, revision:{type:Number,default:0}}, {timestamps:true}));
export const forgotPassword = async (req: any, res: any, next: any) => {
  try {
    const user = await User.findOne({email:req.body.email.toLowerCase(),isActive:true,isDeleted:false,role:{$ne:UserRole.SUPER_ADMIN}});
    const pending=user?await Reset.findOne({userId:user._id,pending:true}):null;
    if(user) await Reset.findOneAndUpdate({userId:user._id}, {$set:{requestedAt:new Date(),pending:true},$unset:{resolvedAt:1,resolvedBy:1}}, {upsert:true});
    if(user&&!pending){for(const manager of (await User.find({isActive:true,isDeleted:false,$or:[{role:{$in:['ADMIN','SUPER_ADMIN']}},{permissions:'passwords:reset'}]})).filter(manager=>hasPermission(manager,'passwords:reset')&&canManageAccount(manager,user))){await Notification.create({userId:manager._id,type:NotificationType.UNASSIGNED_LEAD_ALERT,title:'طلب تغيير كلمة مرور',message:`الموظف ${user.name} طلب مساعدة في استعادة حسابه.`});sseHub.sendToUser(manager.id,{type:'PASSWORD_RESET_REQUESTED',title:'طلب تغيير كلمة مرور'});}}
    res.json({success:true,message:'لو الحساب مسجل، طلب تغيير كلمة المرور وصل للإدارة. تواصل مع الإدارة لاستلام كلمة المرور الجديدة.'});
  } catch(error) {next(error);}
};
const router = Router();
router.use(authenticate);
router.param('id',validateObjectId);
router.get('/password-requests', requirePermission('passwords:reset'), async(req:AuthRequest,res,next)=>{
  try {const requests=await Reset.find({pending:true}).populate({path:'userId',select:'name email role permissions permissionsSource',match:{isDeleted:false,...(req.user?.role===UserRole.SUPER_ADMIN?{}:{role:{$ne:UserRole.SUPER_ADMIN}})}}).sort({requestedAt:1}).lean();res.json({success:true,data:{requests:requests.filter(r=>r.userId&&canManageAccount(req.user!,r.userId as any)).map(r=>{const user=r.userId as any;return {...r,userId:{_id:user._id,name:user.name,email:user.email,role:user.role}};})}});}catch(e){next(e);}
});
const passwordSchema=z.object({password:z.string().min(8).max(72).refine(v=>Buffer.byteLength(v)<=72)});
router.post('/users/:id/password',requirePermission('passwords:reset'),validateBody(passwordSchema),serializeLeadMutation(async(req:AuthRequest,res)=>{
  const user=await User.findOne({_id:req.params.id,isDeleted:false});
  if(!user || !canManageAccount(req.user!,user) || (user.role===UserRole.SUPER_ADMIN && req.user?.role!==UserRole.SUPER_ADMIN) || (!isAdministrator(req.user?.role) && isAdministrator(user.role))) {res.status(404).json({success:false,message:'المستخدم غير متاح.'});return;}
  user.passwordHash=await bcrypt.hash(req.body.password,12);user.authVersion=(user.authVersion||0)+1;await user.save();sseHub.disconnectUser(user.id);
  await Reset.updateOne({userId:user._id},{$set:{pending:false,resolvedAt:new Date(),resolvedBy:req.user?._id}});
  await logAudit(req,{action:'PASSWORD_RESET',actionTitle:'تغيير كلمة مرور حساب',entityType:'USER',entityId:user.id});
  res.json({success:true,message:'تم تغيير كلمة المرور وإغلاق الجلسات القديمة. سلّم كلمة المرور الجديدة لصاحب الحساب مباشرة.'});
}));
router.get('/desk',requirePermission('desk:use'),async(req:AuthRequest,res,next)=>{try{const desk=await Desk.findOne({ownerId:req.user!._id}).lean();res.json({success:true,data:{desk:desk||{notes:'',tasks:[],revision:0}}});}catch(e){next(e);}});
router.put('/desk',requirePermission('desk:use'),validateBody(z.object({notes:z.string().max(50000),tasks:z.array(z.object({id:z.string().max(100),title:z.string().min(1).max(300),done:z.boolean()})).max(100),revision:z.number().int().nonnegative()})),async(req:AuthRequest,res,next)=>{
  try {
    const {notes,tasks,revision}=req.body;
    let desk=await Desk.findOneAndUpdate({ownerId:req.user!._id,revision},{$set:{notes,tasks},$inc:{revision:1}},{new:true});
    if(!desk && revision===0 && !await Desk.exists({ownerId:req.user!._id})) {try{desk=await Desk.create({ownerId:req.user!._id,notes,tasks,revision:1});}catch(e:any){if(e.code!==11000)throw e;}}
    if(!desk){res.status(409).json({success:false,message:'في نسخة أحدث محفوظة. انسخ ملاحظاتك قبل إعادة التحميل.'});return;}
    res.json({success:true,data:{desk}});
  }catch(e){next(e);}
});
export default router;
