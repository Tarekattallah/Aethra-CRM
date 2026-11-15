import mongoose,{Schema} from 'mongoose';
export const PasswordResetRequest=mongoose.model('PasswordResetRequest',new Schema({
  userId:{type:Schema.Types.ObjectId,ref:'User',required:true,unique:true},requestedAt:Date,resolvedAt:Date,
  resolvedBy:{type:Schema.Types.ObjectId,ref:'User'},pending:Boolean
}));
