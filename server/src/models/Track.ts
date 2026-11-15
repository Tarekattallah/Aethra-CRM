import mongoose, { Schema, Document } from 'mongoose';

export interface ITrack extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  nameEn?: string;
  nameAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  slug: string;
  description?: string;
  teamLeaderId?: mongoose.Types.ObjectId;
  color?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TrackSchema = new Schema<ITrack>({
  name: { type: String, required: true, trim: true },
  nameEn: String,
  nameAr: String,
  descriptionEn: String,
  descriptionAr: String,
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, trim: true },
  teamLeaderId: { type: Schema.Types.ObjectId, ref: 'User' },
  color: { type: String, default: '#FFE15C' },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

export const Track = mongoose.model<ITrack>('Track', TrackSchema);

