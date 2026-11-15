import mongoose, { Schema, Document } from 'mongoose';

export enum ActivityType {
  CALL = 'CALL',
  WHATSAPP_MESSAGE = 'WHATSAPP_MESSAGE',
  EMAIL_SENT = 'EMAIL_SENT',
  MEETING = 'MEETING',
  STATUS_CHANGE = 'STATUS_CHANGE',
  NOTE = 'NOTE',
  REASSIGNED = 'REASSIGNED',
  REQUIREMENT_UPDATE = 'REQUIREMENT_UPDATE',
  REPEAT_INQUIRY = 'REPEAT_INQUIRY',                 // استفسار جديد من عميل مكرر
  ENGINEER_DECLINED = 'ENGINEER_DECLINED',           // اعتذار المهندس عن العميل
  SLA_TIMEOUT_TRANSFER = 'SLA_TIMEOUT_TRANSFER',     // تحويل تلقائي لتجاوز مهلة الرد
  TECHNICAL_INTAKE_COMPLETED = 'TECHNICAL_INTAKE_COMPLETED', // اعتماد وتوثيق المواصفات الفنية للمشروع
  LEAD_ACKNOWLEDGED = 'LEAD_ACKNOWLEDGED',           // تأكيد استلام الطلب وبدء مهلة التواصل
  FIRST_CONTACT_CONFIRMED = 'FIRST_CONTACT_CONFIRMED', // تأكيد أول تواصل مع العميل
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED'              // استلام الدفعة المالية وإرفاق الإيصال
}

export interface IActivityAttachment {
  filename: string;
  url: string;
  originalName?: string;
}

const ActivityAttachmentSchema = new Schema<IActivityAttachment>({
  filename: { type: String, required: true },
  url: { type: String, required: true },
  originalName: { type: String }
}, { _id: false });

export interface ILeadActivity extends Document {
  _id: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId; // قد يكون فارغاً إذا كان الإجراء آلياً من النظام (System SLA)
  type: ActivityType;
  title: string;
  content?: string;
  callOutcome?: 'ANSWERED' | 'NO_ANSWER' | 'BUSY' | 'WRONG_NUMBER' | 'CALL_BACK_REQUESTED';
  oldStatus?: string;
  newStatus?: string;
  nextFollowUpDate?: Date;
  attachments: IActivityAttachment[];
  ipAddress?: string;
  deviceSummary?: string;
  createdAt: Date;
}

const LeadActivitySchema = new Schema<ILeadActivity>({
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: Object.values(ActivityType), required: true },
  title: { type: String, required: true },
  content: { type: String },
  callOutcome: { type: String, enum: ['ANSWERED', 'NO_ANSWER', 'BUSY', 'WRONG_NUMBER', 'CALL_BACK_REQUESTED'] },
  oldStatus: { type: String },
  newStatus: { type: String },
  nextFollowUpDate: { type: Date },
  attachments: { type: [ActivityAttachmentSchema], default: [] },
  ipAddress: { type: String },
  deviceSummary: { type: String }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

LeadActivitySchema.index({ leadId: 1, createdAt: -1 });

export const LeadActivity = mongoose.model<ILeadActivity>('LeadActivity', LeadActivitySchema);
