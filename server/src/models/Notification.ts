import mongoose, { Schema, Document } from 'mongoose';

export enum NotificationType {
  NEW_LEAD_ASSIGNED = 'NEW_LEAD_ASSIGNED',
  LEAD_REASSIGNED = 'LEAD_REASSIGNED',
  DUPLICATE_CUSTOMER_RETURNED = 'DUPLICATE_CUSTOMER_RETURNED',
  FOLLOW_UP_DUE = 'FOLLOW_UP_DUE',
  UNASSIGNED_LEAD_ALERT = 'UNASSIGNED_LEAD_ALERT',
  STATUS_CHANGED = 'STATUS_CHANGED',
  TECHNICAL_INTAKE_COMPLETED = 'TECHNICAL_INTAKE_COMPLETED',
  LEAD_ACKNOWLEDGED = 'LEAD_ACKNOWLEDGED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED'
}

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  leadId?: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
  type: { type: String, enum: Object.values(NotificationType), required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

NotificationSchema.index({ userId: 1, isRead: 1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

