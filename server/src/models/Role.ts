import mongoose, { Schema, Document } from 'mongoose';

export interface IRole extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
  permissionCatalogVersion?: number;
  isSystem: boolean; // أدوار النظام الافتراضية
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: { type: String, trim: true },
  permissions: [{ type: String, trim: true }],
  permissionCatalogVersion: Number,
  isSystem: { type: Boolean, default: false }
}, {
  timestamps: true
});

export const Role = mongoose.model<IRole>('Role', RoleSchema);

