import mongoose,{Schema} from 'mongoose';

export const ClientPortalBrand=mongoose.model('ClientPortalBrand',new Schema({
  key:{type:String,default:'client',unique:true},companyName:{type:String,required:true},
  whatsapp:{type:String,required:true},logoFilename:String,revision:{type:Number,default:0}
},{timestamps:true}));
