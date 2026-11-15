import { Router } from 'express';import mongoose from 'mongoose';import { z } from 'zod';
import { authenticate,AuthRequest,requirePermission } from '../middlewares/auth.middleware.js';
import { validateBody,validateObjectId } from '../middlewares/validation.middleware.js';
import { Lead,AssignmentMethod,LeadStatus } from '../models/Lead.js';import { Track } from '../models/Track.js';
import { ServiceCategory } from '../models/ServiceCategory.js';import { User,isAdministrator } from '../models/User.js';
import { ExecutionRoom } from '../models/ExecutionRoom.js';import { getNextSequence } from '../models/Counter.js';
import { Notification,NotificationType } from '../models/Notification.js';
import { canViewLead,idOf,isTrackBound } from '../utils/access.js';import { hasPermission } from '../utils/permissions.js';
import { assignLeadSmart } from '../services/assignment.service.js';import { resetAssignmentSla } from '../services/lead-lifecycle.service.js';
import { serializeLeadMutation } from '../services/mutation-queue.service.js';import { logAudit } from '../services/audit.service.js';
import { sseHub } from '../sse/sse.hub.js';
const router=Router();router.use(authenticate);router.param('id',validateObjectId);
const id=z.string().regex(/^[a-f\d]{24}$/i);
const part=z.object({trackId:id,serviceIds:z.array(id).max(30),title:z.string().trim().min(3).max(200),scope:z.string().trim().min(10).max(20000),estimatedBudget:z.number().finite().nonnegative().optional(),currency:z.enum(['EGP','USD','SAR','AED','EUR']),attachmentFilenames:z.array(z.string().max(200)).max(20).default([])});
router.get('/:id',async(req:AuthRequest,res,next)=>{try{
  const parent=await Lead.findById(req.params.id);
  if(!parent||!canViewLead(req.user!,parent)||(!isAdministrator(req.user!.role)&&!hasPermission(req.user,'leads:split'))){res.status(404).json({success:false});return;}
  const orders=await Lead.find({parentRequestId:parent._id,workOrderPublished:{$ne:false}}).select('leadCode projectName trackId serviceIds projectDescription assignedEngineerId status estimatedBudget currency paymentReceipt executionCompletedAt').populate('trackId','name color').populate('assignedEngineerId','name').populate('serviceIds','name').lean();
  res.json({success:true,data:{orders,parentIsBundle:!!parent.isBundleParent}});
}catch(e){next(e);}});
router.post('/:id/split',requirePermission('leads:split'),validateBody(z.object({operationId:z.string().uuid(),parts:z.array(part).min(2).max(20)})),serializeLeadMutation(async(req:AuthRequest,res)=>{
  const parent=await Lead.findById(req.params.id);if(!parent||!canViewLead(req.user!,parent)){res.status(404).json({success:false});return;}
  if(parent.parentRequestId||parent.paymentReceipt?.isReceived||['CONVERTED','LOST'].includes(parent.status)||await ExecutionRoom.exists({leadId:parent._id,status:{$ne:'REJECTED'}})){res.status(409).json({success:false,message:'الفصل متاح قبل الدفع وبدء فريق التنفيذ. لا يمكن فصل أمر عمل فرعي.'});return;}
  if(parent.isBundleParent){
    if(parent.splitOperationId!==req.body.operationId){res.status(409).json({success:false,message:'الطلب اتفصل بالفعل؛ افتح الأجزاء الموجودة بدل تكرارها.'});return;}
    await Lead.updateMany({parentRequestId:parent._id,workOrderPublished:false},{$set:{workOrderPublished:true}});
    res.json({success:true,data:{orders:await Lead.find({parentRequestId:parent._id})}});return;
  }
  const parts=req.body.parts as z.infer<typeof part>[];
  const trackIds=parts.map(item=>item.trackId);
  if(new Set(trackIds).size!==parts.length||isTrackBound(req.user!)){res.status(400).json({success:false,message:'لكل تراك جزء واحد يضم خدماته. الفصل بين تراكات مختلفة يحتاج مسؤول استقبال غير مقيد بتراك.'});return;}
  if(await Track.countDocuments({_id:{$in:trackIds},isActive:true})!==trackIds.length){res.status(400).json({success:false,message:'اختار تراكات نشطة.'});return;}
  const selected=parts.flatMap(item=>item.serviceIds);const services=await ServiceCategory.find({_id:{$in:selected},isActive:true}).lean();
  if(new Set(selected).size!==selected.length||services.length!==selected.length||parts.some(item=>item.serviceIds.some(serviceId=>idOf(services.find(service=>idOf(service._id)===serviceId)?.trackId)!==item.trackId))||parent.serviceIds.some(serviceId=>!selected.includes(String(serviceId)))||parent.departmentIds.some(trackId=>!trackIds.includes(String(trackId)))){res.status(400).json({success:false,message:'وزع كل خدمة مرة واحدة على تراكها، وغطّ الأقسام المطلوبة في الطلب.'});return;}
  if(parts.some(item=>item.attachmentFilenames.some(filename=>!parent.attachments.some(file=>file.filename===filename)))){res.status(400).json({success:false,message:'المرفقات لازم تكون من ملفات الطلب الأصلي.'});return;}
  const prepared:any[]=[];
  for(const item of parts){
    const assignment=await assignLeadSmart({trackId:item.trackId,serviceCategoryId:item.serviceIds[0]});
    const code=`#LD-${await getNextSequence('leadCode')}`;
    const answers=Object.fromEntries(item.serviceIds.map(serviceId=>[serviceId,parent.serviceRequirements?.[serviceId]||{}]));
    prepared.push({leadCode:code,parentRequestId:parent._id,parentRequestCode:parent.leadCode,workOrderPublished:false,
      customerId:parent.customerId,customerName:parent.customerName,phone:parent.phone,phoneNormalized:parent.phoneNormalized,whatsappNumber:parent.whatsappNumber,whatsappNormalized:parent.whatsappNormalized,email:parent.email,country:parent.country,city:parent.city,phoneCountryCode:parent.phoneCountryCode,preferredContactMethod:parent.preferredContactMethod,preferredLanguage:parent.preferredLanguage,
      intakeChannel:parent.intakeChannel,submittedByUserId:parent.submittedByUserId,marketingEmployeeName:parent.marketingEmployeeName,leadSource:parent.leadSource,referralSource:parent.referralSource,companyName:parent.companyName,
      projectName:item.title,projectDescription:item.scope,initialNotes:'نطاق مستقل معتمد من الاستقبال لهذا التراك.',trackId:item.trackId,departmentIds:[item.trackId],serviceIds:item.serviceIds,initialServiceId:item.serviceIds[0],currentServiceId:item.serviceIds[0],serviceSelection:item.serviceIds.length?'SELECTED':'OTHER',otherService:item.serviceIds.length?undefined:item.title,serviceRequirements:answers,
      serviceQuestionsSnapshot:Object.fromEntries(item.serviceIds.map(serviceId=>[serviceId,parent.serviceQuestionsSnapshot?.[serviceId]||services.find(service=>String(service._id)===serviceId)?.dynamicFormFields||[]])),
      currency:item.currency,estimatedBudget:item.estimatedBudget,attachments:parent.attachments.filter(file=>item.attachmentFilenames.includes(file.filename)),priority:parent.priority,
      privacyAcceptedAt:parent.privacyAcceptedAt,contactAcceptedAt:parent.contactAcceptedAt,needsAssessment:false,intakeVersion:3,intakeMode:'DETAILED',
      assignedEngineerId:assignment.engineerId||undefined,assignedAt:assignment.engineerId?new Date():undefined,assignmentMethod:assignment.method,status:LeadStatus.NEW,technicalIntake:{isCompleted:false,currency:item.currency}});
  }
  await Lead.deleteMany({parentRequestId:parent._id,workOrderPublished:false});
  let committed=false;
  try{
    const children=await Lead.insertMany(prepared);
    for(const child of children){await resetAssignmentSla(child as any);await child.save();}
    parent.isBundleParent=true;parent.splitOperationId=req.body.operationId;parent.assignedEngineerId=undefined;parent.assignedAt=undefined;parent.slaAcknowledgeDeadline=undefined;parent.slaContactDeadline=undefined;parent.slaTimeoutAt=undefined;parent.needsAssessment=false;parent.status=LeadStatus.ON_HOLD;await parent.save();committed=true;
    await Lead.updateMany({parentRequestId:parent._id},{$set:{workOrderPublished:true}});
    for(const child of children)if(child.assignedEngineerId){await Notification.create({userId:child.assignedEngineerId,leadId:child._id,type:NotificationType.NEW_LEAD_ASSIGNED,title:'أمر عمل جديد خاص بتراكك',message:`الجزء ${child.leadCode} جاهز للمراجعة والاستلام.`});sseHub.sendToUser(String(child.assignedEngineerId),{type:'NEW_LEAD_ASSIGNED',title:'أمر عمل جديد خاص بتراكك'});}
    await logAudit(req,{action:'REQUEST_SPLIT',actionTitle:'فصل طلب العميل لأوامر عمل مستقلة',entityType:'LEAD',entityId:parent.id,entityCode:parent.leadCode,newValues:{children:children.map(child=>child.id),tracks:trackIds}});sseHub.broadcast({type:'LEAD_UPDATED'});
    res.status(201).json({success:true,data:{orders:await Lead.find({parentRequestId:parent._id})}});
  }catch(error){if(!committed)await Lead.deleteMany({parentRequestId:parent._id,workOrderPublished:false});throw error;}
}));
router.post('/:id/classify',requirePermission('leads:assign'),validateBody(z.object({trackId:id,serviceId:id.optional(),scope:z.string().trim().min(10).max(20000).optional()})),serializeLeadMutation(async(req:AuthRequest,res)=>{
  const lead=await Lead.findById(req.params.id);if(!lead||!canViewLead(req.user!,lead)){res.status(404).json({success:false});return;}
  if(lead.isBundleParent||lead.assignedEngineerId||lead.voiceReviewStatus==='PENDING'||lead.paymentReceipt?.isReceived||lead.departmentIds.length>1){res.status(409).json({success:false,message:'الطلب متعدد التراكات يحتاج فصلًا، والصوت يحتاج تنسيقًا قبل تحديد المسؤول.'});return;}
  if(isTrackBound(req.user!)&&idOf(req.user!.trackId)!==req.body.trackId){res.status(403).json({success:false});return;}
  if(!await Track.exists({_id:req.body.trackId,isActive:true})){res.status(400).json({success:false});return;}
  if(req.body.serviceId&&!await ServiceCategory.exists({_id:req.body.serviceId,trackId:req.body.trackId,isActive:true})){res.status(400).json({success:false,message:'الخدمة لا تتبع التراك.'});return;}
  if(lead.serviceIds.length&&(!req.body.serviceId||lead.serviceIds.some(serviceId=>String(serviceId)!==req.body.serviceId))){res.status(409).json({success:false,message:'الطلب فيه خدمات محددة؛ راجعها من تعديل بيانات الاستقبال بدل حذفها أثناء التصنيف.'});return;}
  lead.trackId=new mongoose.Types.ObjectId(req.body.trackId);lead.departmentIds=[lead.trackId];
  if(req.body.serviceId){lead.serviceIds=[new mongoose.Types.ObjectId(req.body.serviceId)];lead.initialServiceId=lead.serviceIds[0];lead.currentServiceId=lead.serviceIds[0];lead.serviceSelection='SELECTED';}
  if(req.body.scope)lead.projectDescription=req.body.scope;
  if(!lead.projectDescription?.trim()){res.status(400).json({success:false,message:'اكتب احتياج العميل قبل توزيعه.'});return;}
  lead.needsAssessment=false;const assignment=await assignLeadSmart({trackId:req.body.trackId,serviceCategoryId:req.body.serviceId});lead.assignedEngineerId=assignment.engineerId||undefined;lead.assignmentMethod=assignment.method;lead.assignedAt=assignment.engineerId?new Date():undefined;await resetAssignmentSla(lead);await lead.save();
  if(lead.assignedEngineerId)await Notification.create({userId:lead.assignedEngineerId,leadId:lead._id,type:NotificationType.NEW_LEAD_ASSIGNED,title:'طلب تم تحديد تراكه وإسناده إليك',message:`راجع ${lead.leadCode} وابدأ المتابعة.`});
  await logAudit(req,{action:'REQUEST_CLASSIFIED',actionTitle:'تحديد تراك طلب غير مصنف',entityType:'LEAD',entityId:lead.id,newValues:{trackId:lead.trackId,engineerId:lead.assignedEngineerId}});sseHub.broadcast({type:'LEAD_UPDATED'});res.json({success:true,data:{lead}});
}));
export default router;
