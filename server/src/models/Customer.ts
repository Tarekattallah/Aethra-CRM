import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  phone: string;
  phoneNormalized: string;
  whatsappNumber?: string;
  email?: string;
  country: string;
  companyName?: string;
  websiteUrl?: string;
  socialLinks: string[];
  position?: string;
  createdAt: Date;
  updatedAt: Date;
}

// A contact has one profile; each inquiry remains a separate Lead/request.
// Only an exact normalized primary phone links profiles automatically.
const schema = new Schema<ICustomer>({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true },
  phoneNormalized: { type: String, required: true, unique: true },
  whatsappNumber: String,
  email: { type: String, lowercase: true, trim: true },
  country: { type: String, required: true },
  companyName: String,
  websiteUrl: String,
  socialLinks: { type: [String], default: [] },
  position: String
}, { timestamps: true });

export const Customer = mongoose.model<ICustomer>('Customer', schema);
