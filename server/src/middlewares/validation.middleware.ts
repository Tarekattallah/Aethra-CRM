import { SYSTEM_PERMISSIONS } from '../utils/permissions.js';
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { getCountries } from 'libphonenumber-js';
import { REFERRAL_SOURCES } from '../utils/intake.util.js';

const text = z.string().trim().max(20000);
const name = z.string().trim().min(1).max(200);
const id = z.string().regex(/^[a-f\d]{24}$/i);
const optionalId = z.union([id, z.literal('')]).optional();
const money = z.number().finite().nonnegative();
const attachment = z.object({
  filename: z.string().regex(/^[\w-]+\.[a-z\d]+$/i),
  url: z.string().regex(/^\/uploads\/[\w-]+\.[a-z\d]+$/i),
  uploadToken: z.string().max(100).optional(), originalName: text.optional(), size: money.optional(), mimeType: text.optional(), uploadedAt: z.coerce.date().optional()
}).refine(a => a.url === `/uploads/${a.filename}`, 'اسم المرفق لا يطابق رابطه.');
const password = z.string().min(8).max(72).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'كلمة المرور تتجاوز الحد الأقصى بالبايت؛ استخدم كلمة أقصر.');
const permissions = z.array(z.string().refine(value => SYSTEM_PERMISSIONS.some(p => p.key === value), 'صلاحية غير معروفة')).max(SYSTEM_PERMISSIONS.length);
const date = z.string().refine(v => Number.isFinite(Date.parse(v)), 'تاريخ غير صالح');
const webUrl = z.string().trim().max(2048).url().refine(v => /^https?:\/\//i.test(v), 'استخدم رابط http أو https.');
const phoneCountryCodes = new Set<string>(getCountries());
const attributionText = z.string().trim().max(200);
export const schemas = {
  login: z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(72) }),
  lead: z.object({ customerName: name, phone: z.string().trim().min(5).max(30), country: name,
    intakeVersion: z.union([z.literal(2), z.literal(3)]).optional(), companyName: z.string().trim().max(200).optional(),
    intakeMode: z.enum(['QUICK', 'DETAILED', 'VOICE']).optional(), voiceRecording: attachment.optional(), unassign: z.boolean().optional(),
    phoneCountryCode: z.string().refine(value => phoneCountryCodes.has(value), 'اختار دولة صالحة لرقم الهاتف.').optional(),
    referralSource: z.enum(REFERRAL_SOURCES).optional(), referralDetails: attributionText.optional(),
    campaignAttribution: z.object({ utmSource: attributionText.optional(), utmMedium: attributionText.optional(),
      utmCampaign: attributionText.optional(), utmContent: attributionText.optional(),
      referrerHost: attributionText.optional(), landingPath: z.string().trim().max(500).optional() }).optional(),
    websiteUrl: webUrl.optional(), socialLinks: z.array(webUrl).max(10).optional(), position: z.string().trim().max(200).optional(),
    serviceIds: z.array(id).max(50).optional(), departmentIds: z.array(id).max(20).optional(),
    serviceRequirements: z.record(z.string().regex(/^[a-f\d]{24}$/i), z.record(z.string(), z.unknown())).optional(),
    projectTypes: z.array(z.enum(['NEW_PROJECT','IMPROVE_EXISTING','ONE_TIME','MONTHLY_RETAINER','CONSULTATION','COMPLETE_SOLUTION'])).max(6).optional(),
    serviceSelection: z.enum(['SELECTED','NOT_SURE','OTHER']).optional(), otherService: text.optional(),
    projectName: z.string().trim().max(200).optional(), mainGoal: text.optional(), targetAudience: text.optional(),
    hasExistingProject: z.boolean().optional(), problemToSolve: text.optional(), expectedResults: text.optional(),
    referenceLinks: z.array(webUrl).max(10).optional(), budgetRange: z.enum(['UNDER_5000','5000_15000','15000_30000','30000_50000','OVER_50000','NOT_SURE']).optional(),
    preferredStartDate: date.optional(), expectedDeadline: date.optional(), paymentPreference: z.enum(['ONE_TIME','MILESTONES','MONTHLY']).optional(),
    privacyAccepted: z.boolean().optional(), contactAccepted: z.boolean().optional(),
    whatsappNumber: z.string().trim().max(30).optional(), email: z.union([z.string().email().max(254), z.literal('')]).optional(), city: z.string().trim().max(200).optional(),
    preferredContactMethod: z.enum(['WHATSAPP','PHONE_CALL','EMAIL']).optional(), preferredLanguage: z.enum(['AR','EN','OTHER']).optional(),
    leadSource: name.optional(), campaignName: text.optional(), initialNotes: text.optional(), initialServiceId: optionalId, trackId: optionalId,
    initialRequirements: z.record(z.string(), z.unknown()).optional(), projectDescription: text.optional(), estimatedBudget: money.optional(),
    currency: z.string().regex(/^[A-Z]{3}$/).optional(), priority: z.enum(['LOW','MEDIUM','HIGH','URGENT']).optional(), attachments: z.array(attachment).max(20).optional(),
    honeypot: z.string().max(0).optional(), formDurationMs: money.optional()
  }).superRefine((value, ctx) => {
    if (value.expectedDeadline && value.preferredStartDate && Date.parse(value.expectedDeadline) < Date.parse(value.preferredStartDate)) {
      ctx.addIssue({ code: 'custom', path: ['expectedDeadline'], message: 'التسليم يجب أن يكون بعد تاريخ البداية.' });
    }
    if (value.intakeVersion === 3) {
      if (value.intakeMode === 'VOICE' && (!value.voiceRecording || !/\.(webm|ogg|mp3|m4a|wav)$/i.test(value.voiceRecording.filename))) ctx.addIssue({code:'custom',path:['voiceRecording'],message:'أرفق تسجيلًا صوتيًا صالحًا.'});
      if (value.intakeMode !== 'VOICE' && !value.projectDescription?.trim()) ctx.addIssue({ code: 'custom', path: ['projectDescription'], message: 'احكيلنا باختصار محتاج إيه.' });
      if (!value.phoneCountryCode) ctx.addIssue({ code: 'custom', path: ['phoneCountryCode'], message: 'اختار دولة رقم الهاتف.' });
      for (const field of ['privacyAccepted', 'contactAccepted'] as const) {
        if (value[field] !== true) ctx.addIssue({ code: 'custom', path: [field], message: 'الموافقة مطلوبة للتواصل بخصوص طلبك.' });
      }
      return;
    }
    if (value.intakeVersion !== 2) return;
    for (const field of ['email', 'projectName', 'projectDescription', 'mainGoal'] as const) {
      if (!value[field]?.trim()) ctx.addIssue({ code: 'custom', path: [field], message: 'هذا الحقل مطلوب.' });
    }
    if (!value.projectTypes?.length) ctx.addIssue({ code: 'custom', path: ['projectTypes'], message: 'اختر نوع الطلب.' });
    if (!value.serviceSelection || (value.serviceSelection === 'SELECTED' && !value.serviceIds?.length)) {
      ctx.addIssue({ code: 'custom', path: ['serviceIds'], message: 'اختر خدمة أو اطلب المساعدة في تحديدها.' });
    }
    if (value.serviceSelection === 'OTHER' && !value.otherService?.trim()) ctx.addIssue({ code: 'custom', path: ['otherService'], message: 'اكتب الخدمة المطلوبة.' });
    for (const field of ['privacyAccepted', 'contactAccepted'] as const) {
      if (value[field] !== true) ctx.addIssue({ code: 'custom', path: [field], message: 'الموافقة مطلوبة لإرسال الطلب.' });
    }
  }),
  activity: z.object({ type: z.enum(['CALL','WHATSAPP_MESSAGE','EMAIL_SENT','MEETING','NOTE']), title: name, content: text.optional(),
    callOutcome: z.enum(['ANSWERED','NO_ANSWER','BUSY','WRONG_NUMBER','CALL_BACK_REQUESTED']).optional(),
    nextFollowUpDate: date.optional(), attachments: z.array(attachment).max(20).optional()
  }),
  status: z.object({ status: z.enum(['NEW','CONTACTED','QUALIFIED','QUOTATION_SENT','NEGOTIATION','FOLLOW_UP','CONVERTED','LOST','ON_HOLD']), lostReason: text.optional(), conversionValue: money.optional(), notes: text.optional() }),
  decline: z.object({ reason: name }),
  reassign: z.object({ targetEngineerId: id, reason: name }),
  bulk: z.object({ leadIds: z.array(id).min(1).max(100), targetEngineerId: id, reason: name }),
  technical: z.object({ communicationMethod: z.enum(['WHATSAPP','PHONE_CALL','MEETING','EMAIL']).optional(), clientDiscussionNotes: text.optional(), chatTranscript: text.optional(),
    chatAttachments: z.array(attachment).max(20).optional(), clientRequirements: z.array(z.object({id: name, title: name, description: text.optional(), isDone: z.boolean().optional()})).max(100).optional(),
    projectScope: text.min(1), deliverables: z.array(name).max(100).optional(), agreedBudget: money.optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional(),
    estimatedDuration: text.optional(), toolsOrTechStack: text.optional(), technicalNotes: text.optional()
  }),
  payment: z.object({ amount: money.positive(), currency: z.string().regex(/^[A-Z]{3}$/).optional(), paymentType: z.enum(['FULL','DEPOSIT','FINAL']).optional(), paymentMethod: name.optional(),
    receiptUrl: z.string().regex(/^\/uploads\/[\w-]+\.[a-z\d]+$/i), receiptFilename: text.optional(), notes: text.optional()
  }),
  user: z.object({ name: name.optional(), email: z.string().trim().email().optional(), password: z.union([password, z.literal('')]).optional(), role: name.optional(), roleId: optionalId,
    trackId: optionalId, phone: text.optional(), maxDailyLeads: z.coerce.number().int().nonnegative().optional(), specializations: z.array(id).max(100).optional(), permissions: permissions.optional(), isActive: z.boolean().optional()
  }),
  role: z.object({name: name.optional(), slug: z.string().trim().min(1).max(100).optional(), description: text.optional(), permissions: permissions.optional()}),
  track: z.object({nameEn:z.string().trim().max(200).optional(),descriptionEn:z.string().trim().max(3000).optional(),name: name.optional(), slug: z.string().trim().min(1).max(100).optional(), description: text.optional(), teamLeaderId: optionalId, color: z.string().regex(/^#[a-f\d]{6}$/i).optional(), isActive: z.boolean().optional()}),
  settings: z.object({ routingMode: z.enum(['MANUAL','AUTO_ROUND_ROBIN','AUTO_SKILL_BASED','AUTO_LEAST_BUSY']).optional(),
    slaTimeoutMinutes: z.number().int().min(1).max(43200).optional(), slaAcknowledgeMinutes: z.number().int().min(1).max(43200).optional(), slaContactMinutes: z.number().int().min(1).max(43200).optional(),
    autoReassignOnTimeout: z.boolean().optional(), skipBusyEngineers: z.boolean().optional(), duplicateCheckFields: z.array(z.enum(['phone','whatsapp','email','name'])).max(4).optional()
  }),
  limit: z.object({ maxDailyLeads: z.number().int().nonnegative() })
};

export function validateBody(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) { res.status(400).json({ success: false, message: 'بيانات غير صالحة.', details: result.error.issues.map(i => ({field: i.path.join('.'), message: i.message})) }); return; }
    req.body = result.data;
    next();
  };
}

export function validateObjectId(req: Request, res: Response, next: NextFunction, value: string): void {
  if (!mongoose.isObjectIdOrHexString(value)) { res.status(400).json({success: false, message: 'معرف غير صالح.'}); return; }
  next();
}
