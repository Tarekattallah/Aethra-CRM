import mongoose, { Schema, Document } from 'mongoose';
import './Track.js';
import './ServiceCategory.js';
import './User.js';
import './Customer.js';

export enum IntakeChannel {
  INTERNAL_STAFF = 'INTERNAL_STAFF',
  PUBLIC_CUSTOMER_PORTAL = 'PUBLIC_CUSTOMER_PORTAL'
}

export enum AssignmentMethod {
  ROUND_ROBIN = 'ROUND_ROBIN',
  SKILL_BASED = 'SKILL_BASED',
  LEAST_BUSY = 'LEAST_BUSY',
  DUPLICATE_STICKY = 'DUPLICATE_STICKY',
  MANUAL_ADMIN = 'MANUAL_ADMIN',
  UNASSIGNED_QUEUE = 'UNASSIGNED_QUEUE',
  REASSIGNED_AFTER_DECLINE = 'REASSIGNED_AFTER_DECLINE',
  AUTO_TIMEOUT_ESCALATION = 'AUTO_TIMEOUT_ESCALATION'
}

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  QUOTATION_SENT = 'QUOTATION_SENT',
  NEGOTIATION = 'NEGOTIATION',
  FOLLOW_UP = 'FOLLOW_UP',
  CONVERTED = 'CONVERTED',
  LOST = 'LOST',
  ON_HOLD = 'ON_HOLD'
}

export enum LeadPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export interface IAttachment {
  filename: string;
  originalName?: string;
  url: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: Date;
}

export interface IRequirementItem {
  id: string;
  title: string;
  description?: string;
  isDone?: boolean;
}

export interface IPaymentReceipt {
  isReceived: boolean;
  amount: number;
  currency: string;
  paymentType?: 'FULL' | 'DEPOSIT' | 'FINAL';
  paymentMethod: string;
  receiptUrl: string;
  receiptFilename?: string;
  receivedAt: Date;
  notes?: string;
}

export interface IRejectedEngineer {
  engineerId: mongoose.Types.ObjectId;
  reason: string;
  rejectedAt: Date;
}

export interface ITechnicalIntake {
  isCompleted: boolean;
  completedAt?: Date;
  completedByUserId?: mongoose.Types.ObjectId;
  projectScope?: string;
  deliverables?: string[];
  agreedBudget?: number;
  currency?: string;
  estimatedDuration?: string;
  toolsOrTechStack?: string;
  technicalNotes?: string;
}

const AttachmentSchema = new Schema<IAttachment>({
  filename: { type: String, required: true },
  originalName: { type: String },
  url: { type: String, required: true },
  size: { type: Number },
  mimeType: { type: String },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const RejectedEngineerSchema = new Schema<IRejectedEngineer>({
  engineerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  rejectedAt: { type: Date, default: Date.now }
}, { _id: false });

const TechnicalIntakeSchema = new Schema<ITechnicalIntake>({
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date },
  completedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  projectScope: { type: String, trim: true },
  deliverables: [{ type: String, trim: true }],
  agreedBudget: { type: Number },
  currency: { type: String, default: 'USD' },
  estimatedDuration: { type: String, trim: true },
  toolsOrTechStack: { type: String, trim: true },
  technicalNotes: { type: String, trim: true }
}, { _id: false });

export interface ILead extends Document {
  _id: mongoose.Types.ObjectId;
  splitOperationId?: string;
  workOrderPublished?: boolean;
  paymentHistory?: IPaymentReceipt[];
  isBundleParent?: boolean;
  parentRequestId?: mongoose.Types.ObjectId;
  parentRequestCode?: string;
  executionCompletedAt?: Date;
  leadCode: string; // e.g. "#LD-10024"
  customerId?: mongoose.Types.ObjectId;
  intakeVersion?: number;
  intakeMode?: 'QUICK' | 'DETAILED' | 'VOICE';
  voiceRecording?: IAttachment;
  voiceReviewStatus?: 'PENDING' | 'REVIEWED';
  voiceReviewedBy?: mongoose.Types.ObjectId;
  voiceReviewedAt?: Date;
  phoneCountryCode?: string;
  referralSource?: string;
  referralDetails?: string;
  campaignAttribution?: { utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string; referrerHost?: string; landingPath?: string };
  companyName?: string;
  websiteUrl?: string;
  socialLinks: string[];
  position?: string;
  serviceIds: mongoose.Types.ObjectId[];
  departmentIds: mongoose.Types.ObjectId[];
  serviceQuestionsSnapshot?: Record<string, any[]>;
  serviceRequirements: Record<string, Record<string, any>>;
  projectTypes: string[];
  serviceSelection?: 'SELECTED' | 'NOT_SURE' | 'OTHER';
  otherService?: string;
  projectName?: string;
  mainGoal?: string;
  targetAudience?: string;
  hasExistingProject?: boolean;
  problemToSolve?: string;
  expectedResults?: string;
  referenceLinks: string[];
  budgetRange?: string;
  preferredStartDate?: Date;
  expectedDeadline?: Date;
  paymentPreference?: string;
  privacyAcceptedAt?: Date;
  contactAcceptedAt?: Date;
  needsAssessment: boolean;
  intakeChannel: IntakeChannel;
  submittedByUserId?: mongoose.Types.ObjectId;

  // تراك التخصص (برمجة، تسويق، مونتاج، تصميم...)
  trackId?: mongoose.Types.ObjectId;

  // بيانات العميل
  customerName: string;
  phone: string;
  phoneNormalized: string; // E.164 (+201012345678)
  whatsappNumber?: string;
  whatsappNormalized?: string;
  email?: string;
  country: string;
  city?: string;
  preferredContactMethod: 'WHATSAPP' | 'PHONE_CALL' | 'EMAIL';
  preferredLanguage: 'AR' | 'EN' | 'OTHER';

  // البيانات التسويقية الأصلية المجمدة (Immutable Intake)
  marketingEmployeeName?: string;
  leadSource: string;
  campaignName?: string;
  initialNotes?: string;
  initialServiceId?: mongoose.Types.ObjectId;
  initialRequirements: Record<string, any>;

  // المرحلة الفنية للمهندس (المواصفات الفنية المعتمدة بعد أول تواصل)
  technicalIntake: ITechnicalIntake;

  // تأكيد الاستلام وأول تواصل (SLA 1 & 2)
  acknowledgedAt?: Date;
  contactConfirmedAt?: Date;
  slaAcknowledgeDeadline?: Date;
  slaContactDeadline?: Date;

  // توثيق المحادثة والمتطلبات التفصيلية
  communicationMethod?: 'WHATSAPP' | 'PHONE_CALL' | 'MEETING' | 'EMAIL';
  clientDiscussionNotes?: string;
  chatTranscript?: string;
  chatAttachments?: IAttachment[];
  clientRequirements?: IRequirementItem[];

  // إثبات الدفع والتعاقد
  paymentReceipt?: IPaymentReceipt;

  // مساحة عمل المهندس لتحديث المتطلبات
  currentServiceId?: mongoose.Types.ObjectId;
  projectDescription?: string;
  requestedProduct?: string;
  quantity?: string;
  requiredEdition?: string;
  estimatedBudget?: number;
  currency: string;
  workingRequirements: Record<string, any>;
  attachments: IAttachment[];

  // التوزيع والمسؤولية
  assignedEngineerId?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  assignmentMethod: AssignmentMethod;
  isReassigned: boolean;
  rejectedByEngineers: IRejectedEngineer[];

  // الحالة ومؤشرات الأداء
  status: LeadStatus;
  priority: LeadPriority;
  lostReason?: string;
  conversionValue?: number;
  nextFollowUpDate?: Date;

  // مؤشرات سرعة الاستجابة ومهلة الـ SLA
  firstContactedAt?: Date;
  responseTimeMinutes?: number;
  slaTimeoutAt?: Date;

  // كشف التكرار والملف الموحد
  isDuplicate: boolean;
  repeatCount: number;
  lastInquiryAt?: Date;
  parentLeadId?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>({
  splitOperationId: String,
  workOrderPublished: {type:Boolean,default:true},
  paymentHistory: {type:[Schema.Types.Mixed],default:[]},
  isBundleParent: {type:Boolean,default:false,index:true},
  parentRequestId: {type:Schema.Types.ObjectId,ref:'Lead',index:true},
  parentRequestCode: String,
  executionCompletedAt: Date,
  leadCode: { type: String, required: true, unique: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
  intakeVersion: Number,
  intakeMode: { type: String, enum: ['QUICK', 'DETAILED', 'VOICE'] },
  voiceRecording: AttachmentSchema,
  voiceReviewStatus: {type: String, enum: ['PENDING','REVIEWED']},
  voiceReviewedBy: {type: Schema.Types.ObjectId, ref: 'User'},
  voiceReviewedAt: Date,
  phoneCountryCode: String,
  referralSource: String,
  referralDetails: String,
  campaignAttribution: { utmSource: String, utmMedium: String, utmCampaign: String, utmContent: String, referrerHost: String, landingPath: String },
  companyName: String,
  websiteUrl: String,
  socialLinks: { type: [String], default: [] },
  position: String,
  serviceIds: [{ type: Schema.Types.ObjectId, ref: 'ServiceCategory' }],
  departmentIds: [{ type: Schema.Types.ObjectId, ref: 'Track' }],
  serviceQuestionsSnapshot: {type: Schema.Types.Mixed,default:{}},
  serviceRequirements: { type: Schema.Types.Mixed, default: {} },
  projectTypes: { type: [String], default: [] },
  serviceSelection: { type: String, enum: ['SELECTED', 'NOT_SURE', 'OTHER'] },
  otherService: String,
  projectName: String,
  mainGoal: String,
  targetAudience: String,
  hasExistingProject: Boolean,
  problemToSolve: String,
  expectedResults: String,
  referenceLinks: { type: [String], default: [] },
  budgetRange: String,
  preferredStartDate: Date,
  expectedDeadline: Date,
  paymentPreference: { type: String, enum: ['ONE_TIME', 'MILESTONES', 'MONTHLY'] },
  privacyAcceptedAt: Date,
  contactAcceptedAt: Date,
  needsAssessment: { type: Boolean, default: false },
  intakeChannel: { type: String, enum: Object.values(IntakeChannel), default: IntakeChannel.INTERNAL_STAFF },
  submittedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },

  trackId: { type: Schema.Types.ObjectId, ref: 'Track', index: true },

  customerName: { type: String, required: true, trim: true, index: true },
  phone: { type: String, required: true, trim: true },
  phoneNormalized: { type: String, required: true, trim: true, index: true },
  whatsappNumber: { type: String, trim: true },
  whatsappNormalized: { type: String, trim: true, index: true },
  email: { type: String, trim: true, lowercase: true, index: true },
  country: { type: String, required: true, trim: true },
  city: { type: String, trim: true },
  preferredContactMethod: { type: String, enum: ['WHATSAPP', 'PHONE_CALL', 'EMAIL'], default: 'WHATSAPP' },
  preferredLanguage: { type: String, enum: ['AR', 'EN', 'OTHER'], default: 'AR' },

  marketingEmployeeName: { type: String, trim: true },
  leadSource: { type: String, required: true, trim: true },
  campaignName: { type: String, trim: true },
  initialNotes: { type: String },
  initialServiceId: { type: Schema.Types.ObjectId, ref: 'ServiceCategory' },
  initialRequirements: { type: Schema.Types.Mixed, default: {} },

  // المرحلة الفنية المعتمدة
  technicalIntake: { type: TechnicalIntakeSchema, default: () => ({ isCompleted: false, deliverables: [] }) },

  // تأكيد الاستلام وأول تواصل (SLA 1 & 2)
  acknowledgedAt: { type: Date },
  contactConfirmedAt: { type: Date },
  slaAcknowledgeDeadline: { type: Date },
  slaContactDeadline: { type: Date },

  // توثيق المحادثة والمتطلبات التفصيلية
  communicationMethod: { type: String, enum: ['WHATSAPP', 'PHONE_CALL', 'MEETING', 'EMAIL'] },
  clientDiscussionNotes: { type: String },
  chatTranscript: { type: String },
  chatAttachments: { type: [AttachmentSchema], default: [] },
  clientRequirements: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    isDone: { type: Boolean, default: false }
  }],

  // إثبات الدفع والتعاقد
  paymentReceipt: {
    isReceived: { type: Boolean, default: false },
    amount: { type: Number },
    currency: { type: String, default: 'USD' },
    paymentType: { type: String, enum: ['FULL', 'DEPOSIT', 'FINAL'], default: 'FULL' },
    paymentMethod: { type: String },
    receiptUrl: { type: String },
    receiptFilename: { type: String },
    receivedAt: { type: Date },
    notes: { type: String }
  },

  currentServiceId: { type: Schema.Types.ObjectId, ref: 'ServiceCategory' },
  projectDescription: { type: String },
  requestedProduct: { type: String },
  quantity: { type: String },
  requiredEdition: { type: String },
  estimatedBudget: { type: Number },
  currency: { type: String, default: 'USD' },
  workingRequirements: { type: Schema.Types.Mixed, default: {} },
  attachments: { type: [AttachmentSchema], default: [] },

  assignedEngineerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  assignedAt: { type: Date, default: Date.now },
  assignmentMethod: { type: String, enum: Object.values(AssignmentMethod), default: AssignmentMethod.ROUND_ROBIN },
  isReassigned: { type: Boolean, default: false },
  rejectedByEngineers: { type: [RejectedEngineerSchema], default: [] },

  status: { type: String, enum: Object.values(LeadStatus), default: LeadStatus.NEW, index: true },
  priority: { type: String, enum: Object.values(LeadPriority), default: LeadPriority.MEDIUM },
  lostReason: { type: String },
  conversionValue: { type: Number },
  nextFollowUpDate: { type: Date },

  firstContactedAt: { type: Date },
  responseTimeMinutes: { type: Number },
  slaTimeoutAt: { type: Date, index: true },

  isDuplicate: { type: Boolean, default: false },
  repeatCount: { type: Number, default: 0 },
  lastInquiryAt: { type: Date, default: Date.now },
  parentLeadId: { type: Schema.Types.ObjectId, ref: 'Lead' }
}, {
  timestamps: true,
  optimisticConcurrency: true
});

LeadSchema.index({parentRequestId:1,trackId:1},{unique:true,partialFilterExpression:{parentRequestId:{$type:'objectId'}}});
LeadSchema.index({ assignedEngineerId: 1, status: 1 });
LeadSchema.index({ trackId: 1, status: 1 });
LeadSchema.index({ createdAt: -1 });
LeadSchema.index({ status: 1, firstContactedAt: 1 });
LeadSchema.index({ status: 1, slaTimeoutAt: 1 });

export const Lead = mongoose.model<ILead>('Lead', LeadSchema);
