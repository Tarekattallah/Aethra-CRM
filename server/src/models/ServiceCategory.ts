import mongoose, { Schema, Document } from 'mongoose';

export interface IDynamicFormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
  placeholder?: string;
  labelEn?: string;
  labelAr?: string;
  placeholderEn?: string;
  placeholderAr?: string;
  optionLabelsEn?: Record<string, string>;
  optionLabelsAr?: Record<string, string>;
}

export interface IServiceCategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  nameEn?: string;
  nameAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  slug: string;
  description?: string;
  trackId?: mongoose.Types.ObjectId;
  isActive: boolean;
  dynamicFormFields: IDynamicFormField[];
  createdAt: Date;
  updatedAt: Date;
}

const ServiceCategorySchema = new Schema<IServiceCategory>({
  name: { type: String, required: true, trim: true },
  nameEn: String,
  nameAr: String,
  descriptionEn: String,
  descriptionAr: String,
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String },
  trackId: { type: Schema.Types.ObjectId, ref: 'Track' },
  isActive: { type: Boolean, default: true },
  dynamicFormFields: { type: Schema.Types.Mixed, default: [] }
}, {
  timestamps: true
});

export const ServiceCategory = mongoose.model<IServiceCategory>('ServiceCategory', ServiceCategorySchema);
