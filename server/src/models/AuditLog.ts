import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  actionTitle: string;
  entityType: 'LEAD' | 'USER' | 'AUTH' | 'ROUTING' | 'SETTINGS' | 'PAYMENT' | 'SERVICE';
  entityId?: string;
  entityCode?: string;
  details?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  deviceTypeAr?: string;
  os?: string;
  browser?: string;
  deviceSummary?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String },
  userEmail: { type: String },
  userRole: { type: String },
  action: { type: String, required: true },
  actionTitle: { type: String, required: true },
  entityType: { type: String, required: true, index: true },
  entityId: { type: String },
  entityCode: { type: String },
  details: { type: String },
  oldValues: { type: Schema.Types.Mixed },
  newValues: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  deviceType: { type: String },
  deviceTypeAr: { type: String },
  os: { type: String },
  browser: { type: String },
  deviceSummary: { type: String }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ action: 1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
