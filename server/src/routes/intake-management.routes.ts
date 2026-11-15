import { canViewLead,withinTrack } from '../utils/access.js';
import { localizeService, localizeDepartment } from '../services/catalog-localization.service.js';
import { assignLeadSmart } from '../services/assignment.service.js';
import { resetAssignmentSla } from '../services/lead-lifecycle.service.js';
import { Notification, NotificationType } from '../models/Notification.js';
import { sseHub } from '../sse/sse.hub.js';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest, requirePermission } from '../middlewares/auth.middleware.js';
import { validateBody, validateObjectId, schemas } from '../middlewares/validation.middleware.js';
import { ServiceCategory } from '../models/ServiceCategory.js';
import { Track } from '../models/Track.js';
import { Lead, AssignmentMethod } from '../models/Lead.js';
import { Customer } from '../models/Customer.js';
import { LeadActivity, ActivityType } from '../models/LeadActivity.js';
import { hasPermission } from '../utils/permissions.js';
import { normalizePhoneNumber } from '../utils/phone.util.js';
import { validateIntakeSelection } from '../services/intake.service.js';
import { validateAttachmentAccess } from '../services/upload.service.js';
import { serializeLeadMutation } from '../services/mutation-queue.service.js';
import { logAudit } from '../services/audit.service.js';
import { resolveCustomer } from '../services/customer.service.js';

const router=Router();router.use(authenticate);router.param('id',validateObjectId);
const field=z.object({name:z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,49}$/),label:z.string().trim().min(1).max(200),labelEn:z.string().trim().max(200).optional(),type:z.enum(['text','textarea','number','select','checkbox']),required:z.boolean(),options:z.array(z.string().trim().min(1).max(200)).max(50).optional(),optionLabelsEn:z.record(z.string(),z.string().max(200)).optional(),placeholder:z.string().max(500).optional(),placeholderEn:z.string().max(500).optional()});
const service=z.object({name:z.string().trim().min(1).max(200),nameEn:z.string().trim().min(1).max(200),slug:z.string().regex(/^[a-z0-9-]{1,100}$/),description:z.string().max(3000),descriptionEn:z.string().max(3000),trackId:z.string().regex(/^[a-f\d]{24}$/i),isActive:z.boolean(),dynamicFormFields:z.array(field).max(40)}).superRefine((v,c)=>{if(new Set(v.dynamicFormFields.map(f=>f.name)).size!==v.dynamicFormFields.length)c.addIssue({code:'custom',message:'أكواد الأسئلة يجب أن تكون مختلفة.'});for(const f of v.dynamicFormFields)if(f.type==='select'&&!f.options?.length)c.addIssue({code:'custom',message:'أضف اختيارات للسؤال.'});});
router.get('/services',requirePermission('services:manage'),async(_req,res,next)=>{try{res.json({success:true,data:{services:await ServiceCategory.find().sort({name:1}).lean()}});}catch(e){next(e);}});
const saveService=async(req:AuthRequest,res:any,next:any)=>{try{
  if(!await Track.exists({_id:req.body.trackId,isActive:true})){res.status(400).json({success:false,message:'اختر تراكًا نشطًا.'});return;}
  const before=req.params.id?await ServiceCategory.findById(req.params.id):null;
  if(req.params.id&&!before){res.status(404).json({success:false});return;}
  const data={...req.body,nameAr:req.body.name,descriptionAr:req.body.description};
  const saved=before?await ServiceCategory.findByIdAndUpdate(before._id,{$set:data},{new:true,runValidators:true}):await ServiceCategory.create(data);
  await logAudit(req,{action:'SERVICE_SAVED',actionTitle:'تعديل كاتلوج الخدمات وأسئلة الاستقبال',entityType:'SERVICE',entityId:saved!.id,oldValues:before?.toObject(),newValues:data});
  res.status(before?200:201).json({success:true,data:{service:saved}});
}catch(e){next(e);}};
router.post('/services',requirePermission('services:manage'),validateBody(service),saveService);
router.put('/services/:id',requirePermission('services:manage'),validateBody(service),saveService);

router.get('/requests/:id/catalog',async(req:AuthRequest,res,next)=>{try{
  const lead=await Lead.findById(req.params.id);if(!lead||!canViewLead(req.user!,lead)){res.status(404).json({success:false});return;}
  if(!hasPermission(req.user,'leads:edit_all')&&!(lead.voiceReviewStatus==='PENDING'&&hasPermission(req.user,'voice:review'))){res.status(403).json({success:false});return;}
  const selected=[...lead.serviceIds,lead.initialServiceId,lead.currentServiceId].filter(Boolean);
  const activeTracks=await Track.find({isActive:true}).distinct('_id');
  const services=await ServiceCategory.find({$or:[{isActive:true,$or:[{trackId:null},{trackId:{$in:activeTracks}}]},{_id:{$in:selected}}]}).lean();
  const departments=await Track.find({$or:[{isActive:true},{_id:{$in:[...lead.departmentIds,lead.trackId].filter(Boolean)}}]}).lean();
  const language=req.query.lang==='en'?'en':'ar';res.json({success:true,data:{services:services.map(service=>localizeService(service,language)),departments:departments.map(track=>localizeDepartment(track,language))}});
}catch(e){next(e);}});
router.put('/requests/:id',validateBody(schemas.lead),validateAttachmentAccess,serializeLeadMutation(async(req:AuthRequest,res)=>{
  const lead=await Lead.findById(req.params.id);
  if(!lead||!canViewLead(req.user!,lead)){res.status(404).json({success:false});return;}
  if(lead.isBundleParent){res.status(409).json({success:false,message:'الطلب متقسم. عدل تفاصيل كل جزء مستقلًا للحفاظ على نطاقه.'});return;}
  const reviewing=lead.voiceReviewStatus==='PENDING' && hasPermission(req.user,'voice:review');
  if(!hasPermission(req.user,'leads:edit_all')&&!reviewing){res.status(403).json({success:false});return;}
  if(!req.body.projectDescription?.trim()){res.status(400).json({success:false,message:'اكتب ملخصًا منسقًا لطلب العميل.'});return;}
  const selection=await validateIntakeSelection(req.body,false,{serviceIds:[...lead.serviceIds,lead.initialServiceId,lead.currentServiceId].filter(Boolean).map(String),departmentIds:[...lead.departmentIds,lead.trackId].filter(Boolean).map(String)});
  const primaryTrack=selection.primaryTrackId || (!req.body.unassign && lead.trackId && (!selection.departmentIds.length || selection.departmentIds.includes(String(lead.trackId))) ? String(lead.trackId):undefined);
  if(lead.assignedEngineerId && !req.body.unassign && primaryTrack!==String(lead.trackId)) {res.status(409).json({success:false,message:'تغيير التراك يتطلب إلغاء الإسناد الحالي أولًا.'});return;}
  if(!withinTrack(req.user!,{trackId:primaryTrack,departmentIds:selection.departmentIds,submittedByUserId:lead.submittedByUserId})){res.status(403).json({success:false});return;}
  if(primaryTrack!==String(lead.trackId||'')&&await (await import('../models/ExecutionRoom.js')).ExecutionRoom.exists({leadId:lead._id,status:{$nin:['CLOSED','REJECTED']}})){res.status(409).json({success:false,message:'لا يمكن تغيير تراك طلب له فريق تنفيذ مفتوح.'});return;}
  const phoneNormalized=normalizePhoneNumber(req.body.phone,req.body.phoneCountryCode||req.body.country);
  const whatsappNormalized=normalizePhoneNumber(req.body.whatsappNumber||req.body.phone,req.body.phoneCountryCode||req.body.country);
  if(!phoneNormalized||!whatsappNormalized){res.status(400).json({success:false,message:'رقم الهاتف أو الواتساب غير صالح.'});return;}
  const before=lead.toObject();
  const fields=['customerName','phone','whatsappNumber','email','country','city','phoneCountryCode','preferredContactMethod','preferredLanguage','companyName','websiteUrl','socialLinks','position','projectName','projectDescription','mainGoal','targetAudience','hasExistingProject','problemToSolve','expectedResults','referenceLinks','budgetRange','preferredStartDate','expectedDeadline','paymentPreference','referralSource','referralDetails','leadSource','campaignName','initialNotes','otherService','serviceSelection','projectTypes','estimatedBudget','currency','priority','attachments'] as const;
  for(const key of fields)if(key in req.body)lead.set(key,req.body[key]);
  lead.phoneNormalized=phoneNormalized;lead.whatsappNormalized=whatsappNormalized;
  const customer=await resolveCustomer({...req.body,phoneNormalized});lead.customerId=customer!._id;
  lead.serviceIds=selection.serviceIds as any;lead.departmentIds=selection.departmentIds as any;lead.serviceRequirements=selection.serviceRequirements;
  lead.trackId=primaryTrack as any;lead.initialServiceId=selection.primaryServiceId as any;lead.currentServiceId=selection.primaryServiceId as any;
  lead.needsAssessment=selection.needsAssessment;lead.intakeMode=req.body.intakeMode;
  if(req.body.unassign){lead.assignedEngineerId=undefined;lead.assignedAt=undefined;lead.acknowledgedAt=undefined;lead.contactConfirmedAt=undefined;lead.slaAcknowledgeDeadline=undefined;lead.slaContactDeadline=undefined;lead.slaTimeoutAt=undefined;lead.assignmentMethod=AssignmentMethod.MANUAL_ADMIN;}
  if(reviewing){
    lead.voiceReviewStatus='REVIEWED';lead.voiceReviewedBy=req.user!._id;lead.voiceReviewedAt=new Date();
    if(!selection.needsAssessment){const assignment=await assignLeadSmart({trackId:primaryTrack,serviceCategoryId:selection.primaryServiceId});lead.assignedEngineerId=assignment.engineerId||undefined;lead.assignmentMethod=assignment.method;if(assignment.engineerId){lead.assignedAt=new Date();await resetAssignmentSla(lead);}}
  }

  await lead.save();
  if(reviewing&&lead.assignedEngineerId){await Notification.create({userId:lead.assignedEngineerId,leadId:lead._id,type:NotificationType.NEW_LEAD_ASSIGNED,title:'طلب صوتي تم تنسيقه وإسناده إليك',message:`راجع الطلب ${lead.leadCode} وابدأ المتابعة.`});sseHub.sendToUser(String(lead.assignedEngineerId),{type:'NEW_LEAD_ASSIGNED',title:'طلب صوتي تم تنسيقه وإسناده إليك'});}
  sseHub.broadcast({type:'LEAD_UPDATED'});

  await LeadActivity.create({leadId:lead._id,userId:req.user!._id,type:ActivityType.NOTE,title:reviewing?'تنسيق الطلب الصوتي واعتماده للمراجعة والإسناد':'تعديل بيانات استقبال الطلب',content:'تم حفظ البيانات مع الاحتفاظ بسجل التعديلات ومصدر الطلب الأصلي.'});
  await logAudit(req,{action:'INTAKE_UPDATED',actionTitle:'تعديل نموذج استقبال العميل',entityType:'LEAD',entityId:lead.id,entityCode:lead.leadCode,oldValues:before,newValues:lead.toObject()});
  res.json({success:true,data:{lead}});
}));
router.put('/customers/:id',requirePermission('customers:manage'),validateBody(z.object({name:z.string().trim().min(1).max(200),email:z.union([z.string().email().max(254),z.literal('')]),companyName:z.string().max(200),websiteUrl:z.union([z.string().url().refine(v=>/^https?:/.test(v)),z.literal('')]),position:z.string().max(200)})),async(req:AuthRequest,res,next)=>{try{const before=await Customer.findById(req.params.id);if(!before){res.status(404).json({success:false});return;}const customer=await Customer.findByIdAndUpdate(before._id,{$set:req.body},{new:true,runValidators:true});await logAudit(req,{action:'CUSTOMER_UPDATED',actionTitle:'تعديل ملف عميل',entityType:'LEAD',entityId:String(before._id),oldValues:before,newValues:req.body});res.json({success:true,data:{customer}});}catch(e){next(e);}});
export default router;
