import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate,AuthRequest,requirePermission } from '../middlewares/auth.middleware.js';
import { validateBody,validateObjectId } from '../middlewares/validation.middleware.js';
import { Lead,LeadStatus } from '../models/Lead.js';
import { ExecutionRoom,ExecutionMessage } from '../models/ExecutionRoom.js';
import { User,isAdministrator } from '../models/User.js';
import { Notification,NotificationType } from '../models/Notification.js';
import { canEditLead,idOf,canViewLead,leadScope } from '../utils/access.js';
import { hasPermission } from '../utils/permissions.js';
import { currentLeader,managesRoom,readsRoom,signalRoom,systemMessage,syncExecutionRoom,fullyPaid,refreshBundleParent } from '../services/execution.service.js';
import { serializeLeadMutation } from '../services/mutation-queue.service.js';
import { logAudit } from '../services/audit.service.js';
import { positiveInteger } from '../utils/input.js';

const router=Router();router.use(authenticate);router.use(rateLimit({windowMs:60000,limit:120,keyGenerator:(req)=>String((req as AuthRequest).user!._id),skip:req=>req.method!=='POST'||!req.path.endsWith('/messages'),standardHeaders:'draft-7',legacyHeaders:false,message:{success:false,message:'رسائل كثيرة في وقت قصير. جرب بعد دقيقة.'}}));router.param('id',validateObjectId);router.param('leadId',validateObjectId);
const id=z.string().regex(/^[a-f\d]{24}$/i);
const membership=z.object({memberIds:z.array(id).max(30)});
const closed=['CLOSED','REJECTED'];
async function authorized(req:AuthRequest,res:any) {
  const room=await ExecutionRoom.findById(req.params.id);
  const lead=room?await Lead.findById(room.leadId):null;
  if(!room||!lead||!await readsRoom(req.user!,room,lead)){res.status(404).json({success:false,message:'مساحة التنفيذ غير متاحة.'});return null;}
  return {room,lead};
}
router.post('/requests/:leadId',requirePermission('execution:request'),validateBody(z.object({message:z.string().trim().min(5).max(2000)})),serializeLeadMutation(async(req:AuthRequest,res)=>{
  const lead=await Lead.findById(req.params.leadId);
  if(!lead||!canEditLead(req.user!,lead)||(!isAdministrator(req.user!.role)&&idOf(lead.assignedEngineerId)!==idOf(req.user!._id))){res.status(403).json({success:false,message:'طلب الفريق متاح للمهندس المسؤول عن هذا الجزء.'});return;}
  if(lead.isBundleParent||!lead.trackId||!lead.assignedEngineerId||!lead.technicalIntake?.isCompleted||lead.voiceReviewStatus==='PENDING'||['CONVERTED','LOST'].includes(lead.status)||lead.executionCompletedAt){res.status(409).json({success:false,message:'حدد المسؤول والتراك واعتمد المواصفات الفنية قبل طلب فريق التنفيذ، والطلب يجب أن يكون مفتوحًا.'});return;}
  const leader=await currentLeader(lead.trackId);if(!leader){res.status(409).json({success:false,message:'لا يوجد تيم ليدر نشط لهذا التراك. اطلب من الإدارة تعيينه أولًا.'});return;}
  let room=await ExecutionRoom.findOne({leadId:lead._id});
  if(room&&room.status!=='REJECTED'){res.status(409).json({success:false,message:'فيه طلب فريق أو مساحة تنفيذ موجودة بالفعل.',data:{roomId:room.id}});return;}
  if(room){room.status='REQUESTED';room.requestMessage=req.body.message;room.requesterId=req.user!._id;room.leaderId=leader._id;room.memberIds=[lead.assignedEngineerId];room.rejectionReason=undefined;await room.save();}
  else room=await ExecutionRoom.create({leadId:lead._id,trackId:lead.trackId,requesterId:req.user!._id,leaderId:leader._id,memberIds:[lead.assignedEngineerId],requestMessage:req.body.message});
  await systemMessage(room,'المهندس طلب تشكيل فريق تنفيذ. في انتظار اعتماد التيم ليدر واختيار المشاركين.');
  await Notification.create({userId:leader._id,leadId:lead._id,type:NotificationType.UNASSIGNED_LEAD_ALERT,title:'طلب تشكيل فريق تنفيذ',message:`الطلب ${lead.leadCode} ينتظر اختيار فريق وفتح مساحة العمل.`});
  await signalRoom(room,lead);await logAudit(req,{action:'EXECUTION_REQUESTED',actionTitle:'طلب فريق تنفيذ',entityType:'LEAD',entityId:lead.id,entityCode:lead.leadCode});
  res.status(201).json({success:true,data:{room}});
}));
router.get('/for-request/:leadId',async(req:AuthRequest,res,next)=>{try{const lead=await Lead.findById(req.params.leadId);const room=lead?await ExecutionRoom.findOne({leadId:lead._id}):null;if(!lead||(!canViewLead(req.user!,lead)&&!(room&&await readsRoom(req.user!,room,lead)))){res.status(404).json({success:false});return;}if(room&&!await readsRoom(req.user!,room,lead)){res.status(404).json({success:false});return;}res.json({success:true,data:{room}});}catch(e){next(e);}});
router.get('/',async(req:AuthRequest,res,next)=>{try{
  if(!hasPermission(req.user,'execution:view')){res.status(403).json({success:false});return;}
  const page=positiveInteger(req.query.page,1,100000);const limit=20;
  const query:any=isAdministrator(req.user!.role)?{leadId:{$in:await Lead.find(leadScope(req.user!)).distinct('_id')}}:req.user!.trackId?{trackId:req.user!.trackId}: {_id:{$in:[]}};
  if(!isAdministrator(req.user!.role)){
    const leader=await currentLeader(req.user!.trackId);
    if(idOf(leader?._id)!==idOf(req.user!._id)){
      const own=await Lead.find({trackId:req.user!.trackId,assignedEngineerId:req.user!._id}).distinct('_id');
      query.$or=[{memberIds:req.user!._id},{leadId:{$in:own}}];
    }
  }
  if(req.query.status==='OPEN')query.status={$nin:closed};
  if(req.query.status==='CLOSED')query.status={$in:closed};
  const [rooms,total]=await Promise.all([ExecutionRoom.find(query).populate('leadId','leadCode projectName customerName projectDescription status executionCompletedAt').populate('trackId','name color').populate('requesterId','name').sort({updatedAt:-1,_id:-1}).skip((page-1)*limit).limit(limit).lean(),ExecutionRoom.countDocuments(query)]);
  res.json({success:true,data:{rooms:rooms.filter(room=>room.leadId),pagination:{page,pages:Math.max(1,Math.ceil(total/limit)),total}}});
}catch(e){next(e);}});
router.get('/:id',async(req:AuthRequest,res,next)=>{try{
  const context=await authorized(req,res);if(!context)return;const {room,lead}=context;
  const manager=await managesRoom(req.user!,room);const leader=await currentLeader(room.trackId);
  const members=await User.find({_id:{$in:[...room.memberIds,lead.assignedEngineerId,leader?._id].filter(Boolean)},trackId:room.trackId,isActive:true,isDeleted:false}).select('name role trackId').lean();
  const candidates=manager?(await User.find({trackId:room.trackId,isActive:true,isDeleted:false}).select('name role permissions permissionsSource').lean()).filter(user=>!isAdministrator(user.role)&&hasPermission(user as any,'leads:edit_technical')).map(user=>({_id:user._id,name:user.name})):[];
  const populated=await Lead.findById(lead._id).select('serviceIds').populate('serviceIds','name');
  res.json({success:true,data:{room,members,candidates,canManage:manager,canComplete:manager&&hasPermission(req.user,'execution:complete'),canMessage:hasPermission(req.user,'execution:message'),fullyPaid:fullyPaid(lead),lead:{_id:lead._id,leadCode:lead.leadCode,parentRequestCode:lead.parentRequestCode,customerName:lead.customerName,projectName:lead.projectName,projectDescription:lead.projectDescription,technicalIntake:lead.technicalIntake,clientRequirements:lead.clientRequirements,serviceRequirements:lead.serviceRequirements,serviceQuestionsSnapshot:lead.serviceQuestionsSnapshot,serviceIds:populated?.serviceIds,attachments:lead.attachments,chatAttachments:lead.chatAttachments,assignedEngineerId:lead.assignedEngineerId,executionCompletedAt:lead.executionCompletedAt}}});
}catch(e){next(e);}});
router.post('/:id/approve',validateBody(membership),serializeLeadMutation(async(req:AuthRequest,res)=>{
  const context=await authorized(req,res);if(!context)return;const {room,lead}=context;
  if(!await managesRoom(req.user!,room)){res.status(403).json({success:false});return;}
  if(room.status!=='REQUESTED'){res.status(409).json({success:false,message:'طلب الفريق اتراجع بالفعل.'});return;}
  const ids=[...new Set<string>([String(lead.assignedEngineerId),...req.body.memberIds])];
  const users=await User.find({_id:{$in:ids},trackId:room.trackId,isActive:true,isDeleted:false});
  if(!lead.assignedEngineerId||users.length!==ids.length||users.some(user=>isAdministrator(user.role)||!hasPermission(user,'leads:edit_technical'))){res.status(400).json({success:false,message:'كل المشاركين لازم يكونوا متخصصين نشطين من نفس التراك.'});return;}
  room.memberIds=users.map(user=>user._id);room.leaderId=(await currentLeader(room.trackId))!._id;room.status='ACTIVE';await room.save();
  await systemMessage(room,'التيم ليدر اعتمد فريق التنفيذ وفتح المحادثة.');await signalRoom(room,lead);
  for(const member of users)await Notification.create({userId:member._id,leadId:lead._id,type:NotificationType.NEW_LEAD_ASSIGNED,title:'تمت إضافتك لفريق تنفيذ',message:`مساحة عمل ${lead.leadCode} أصبحت متاحة من فرق التنفيذ.`});
  await logAudit(req,{action:'EXECUTION_APPROVED',actionTitle:'تشكيل فريق تنفيذ',entityType:'LEAD',entityId:lead.id,newValues:{memberIds:ids}});res.json({success:true,data:{room}});
}));
router.put('/:id/members',validateBody(membership),serializeLeadMutation(async(req:AuthRequest,res)=>{
  const context=await authorized(req,res);if(!context)return;const {room,lead}=context;
  if(!await managesRoom(req.user!,room)){res.status(403).json({success:false});return;}
  if(!['ACTIVE','AWAITING_PAYMENT'].includes(room.status)){res.status(409).json({success:false,message:'تعديل المشاركين متاح في المساحة المفتوحة فقط.'});return;}
  const ids=[...new Set<string>([String(lead.assignedEngineerId),...req.body.memberIds])];
  const users=await User.find({_id:{$in:ids},trackId:room.trackId,isActive:true,isDeleted:false});
  if(users.length!==ids.length||users.some(user=>isAdministrator(user.role)||!hasPermission(user,'leads:edit_technical'))){res.status(400).json({success:false,message:'اختار متخصصين نشطين من نفس التراك.'});return;}
  const previous=[...room.memberIds];room.memberIds=users.map(user=>user._id);await room.save();await systemMessage(room,'التيم ليدر حدّث المشاركين في فريق التنفيذ.');await signalRoom(room,lead);
  for(const id of previous)if(!ids.includes(String(id))) (await import('../sse/sse.hub.js')).sseHub.sendToUser(String(id),{type:'PROJECT_UPDATED',roomId:room.id});
  await logAudit(req,{action:'EXECUTION_MEMBERS_UPDATED',actionTitle:'تعديل فريق تنفيذ',entityType:'LEAD',entityId:lead.id,newValues:{memberIds:ids}});res.json({success:true,data:{room}});
}));
router.post('/:id/reject',validateBody(z.object({reason:z.string().trim().min(3).max(1000)})),serializeLeadMutation(async(req:AuthRequest,res)=>{
  const context=await authorized(req,res);if(!context)return;const {room,lead}=context;if(!await managesRoom(req.user!,room)){res.status(403).json({success:false});return;}
  if(room.status!=='REQUESTED'){res.status(409).json({success:false});return;}room.status='REJECTED';room.rejectionReason=req.body.reason;await room.save();await systemMessage(room,'طلب تشكيل الفريق اتردّ للمراجعة: '+req.body.reason);await signalRoom(room,lead);res.json({success:true,data:{room}});
}));
router.post('/:id/complete',requirePermission('execution:complete'),serializeLeadMutation(async(req:AuthRequest,res)=>{
  const context=await authorized(req,res);if(!context)return;const {room,lead}=context;if(!await managesRoom(req.user!,room)){res.status(403).json({success:false});return;}
  if(room.status!=='ACTIVE'){res.status(409).json({success:false,message:'المساحة ليست في مرحلة التنفيذ.'});return;}
  lead.executionCompletedAt=new Date();if(lead.parentRequestId&&fullyPaid(lead))lead.status=LeadStatus.CONVERTED;await lead.save();room.executionCompletedAt=lead.executionCompletedAt;await room.save();await syncExecutionRoom(lead);await refreshBundleParent(lead);
  await logAudit(req,{action:'EXECUTION_COMPLETED',actionTitle:'اعتماد انتهاء التنفيذ',entityType:'LEAD',entityId:lead.id});res.json({success:true,data:{room:await ExecutionRoom.findById(room._id)}});
}));
router.get('/:id/messages',async(req:AuthRequest,res,next)=>{try{
  const context=await authorized(req,res);if(!context)return;
  const query:any={roomId:context.room._id};if(req.query.before){if(!/^[a-f\d]{24}$/i.test(String(req.query.before))){res.status(400).json({success:false});return;}query._id={$lt:req.query.before};}
  const messages=await ExecutionMessage.find(query).populate('senderId','name').sort({_id:-1}).limit(51).lean();const hasMore=messages.length>50;
  res.json({success:true,data:{messages:messages.slice(0,50).reverse(),hasMore}});
}catch(e){next(e);}});
router.post('/:id/messages',requirePermission('execution:message'),validateBody(z.object({text:z.string().trim().min(1).max(6000),clientMessageId:z.string().uuid()})),serializeLeadMutation(async(req:AuthRequest,res)=>{
  const context=await authorized(req,res);if(!context)return;const {room,lead}=context;
  const prior=await ExecutionMessage.findOne({roomId:room._id,senderId:req.user!._id,clientMessageId:req.body.clientMessageId});
  if(prior){res.status(prior.text===req.body.text?200:409).json({success:prior.text===req.body.text,data:{message:prior}});return;}
  if(!['ACTIVE','AWAITING_PAYMENT'].includes(room.status)){res.status(409).json({success:false,message:'المحادثة مغلقة أو لسه بانتظار الاعتماد. السجل متاح للقراءة.'});return;}
  const message=await ExecutionMessage.create({roomId:room._id,senderId:req.user!._id,text:req.body.text,clientMessageId:req.body.clientMessageId});
  await signalRoom(room,lead);res.status(201).json({success:true,data:{message}});
}));
export default router;
