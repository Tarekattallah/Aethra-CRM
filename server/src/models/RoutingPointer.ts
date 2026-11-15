import mongoose, { Schema, Document } from 'mongoose';

export interface IRoutingPointer extends Document {
  scope: string; // "GENERAL" أو معرف الخدمة "SERVICE_<categoryId>"
  lastAssignedEngineerId?: mongoose.Types.ObjectId;
  sequence: number;
  updatedAt: Date;
}

const RoutingPointerSchema = new Schema<IRoutingPointer>({
  scope: { type: String, required: true, unique: true },
  lastAssignedEngineerId: { type: Schema.Types.ObjectId, ref: 'User' },
  sequence: { type: Number, default: 0 }
}, {
  timestamps: true
});

export const RoutingPointer = mongoose.model<IRoutingPointer>('RoutingPointer', RoutingPointerSchema);

