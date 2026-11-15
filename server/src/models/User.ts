import mongoose, { Schema, Document } from 'mongoose';
import './ServiceCategory.js';
import './Track.js';
import './Role.js';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  TEAM_LEADER = 'TEAM_LEADER',
  ENGINEER = 'ENGINEER',
  STAFF = 'STAFF',
  MARKETING = 'MARKETING'
}

export function isAdministrator(role: unknown): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  authVersion: number;
  role: UserRole | string;
  roleId?: mongoose.Types.ObjectId;
  trackId?: mongoose.Types.ObjectId;
  permissions: string[]; // e.g. ["leads:view_all", "leads:view_track", "leads:view_own", "leads:create_marketing", "leads:edit_technical", "users:manage"]
  permissionsSource?: 'ROLE' | 'CUSTOM';
  isActive: boolean;
  isDeleted: boolean; // Soft delete
  phone?: string;
  maxDailyLeads: number; // 0 تعني بدون سقف يومي
  specializations: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  authVersion: { type: Number, default: 0, min: 0 },
  role: { type: String, default: UserRole.ENGINEER },
  roleId: { type: Schema.Types.ObjectId, ref: 'Role' },
  trackId: { type: Schema.Types.ObjectId, ref: 'Track' },
  permissions: [{ type: String }],
  permissionsSource: { type: String, enum: ['ROLE', 'CUSTOM'] },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  phone: { type: String, trim: true },
  maxDailyLeads: { type: Number, default: 0 },
  specializations: [{ type: Schema.Types.ObjectId, ref: 'ServiceCategory' }]
}, {
  timestamps: true
});

UserSchema.index({ role: 1, trackId: 1, isActive: 1, isDeleted: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
