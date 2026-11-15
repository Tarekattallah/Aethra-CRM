import mongoose, { Schema } from 'mongoose';

export const Upload = mongoose.model('Upload', new Schema({
  filename: { type: String, required: true, unique: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
  tokenHash: { type: String, required: true },
  originalName: String
}, { timestamps: true }));
