import mongoose,{Schema,Document} from 'mongoose';
export type RoomStatus='REQUESTED'|'ACTIVE'|'AWAITING_PAYMENT'|'CLOSED'|'REJECTED';
export interface IExecutionRoom extends Document {
  leadId:mongoose.Types.ObjectId;trackId:mongoose.Types.ObjectId;requesterId:mongoose.Types.ObjectId;
  leaderId:mongoose.Types.ObjectId;memberIds:mongoose.Types.ObjectId[];status:RoomStatus;
  requestMessage:string;rejectionReason?:string;executionCompletedAt?:Date;closedAt?:Date;closeReason?:string;
  createdAt:Date;updatedAt:Date;
}
const roomSchema=new Schema<IExecutionRoom>({
  leadId:{type:Schema.Types.ObjectId,ref:'Lead',required:true,unique:true},trackId:{type:Schema.Types.ObjectId,ref:'Track',required:true,index:true},
  requesterId:{type:Schema.Types.ObjectId,ref:'User',required:true},leaderId:{type:Schema.Types.ObjectId,ref:'User',required:true},
  memberIds:[{type:Schema.Types.ObjectId,ref:'User'}],status:{type:String,enum:['REQUESTED','ACTIVE','AWAITING_PAYMENT','CLOSED','REJECTED'],default:'REQUESTED',index:true},
  requestMessage:{type:String,required:true},rejectionReason:String,executionCompletedAt:Date,closedAt:Date,closeReason:String
},{timestamps:true,optimisticConcurrency:true});
export const ExecutionRoom=mongoose.model<IExecutionRoom>('ExecutionRoom',roomSchema);
const messageSchema=new Schema({roomId:{type:Schema.Types.ObjectId,ref:'ExecutionRoom',required:true,index:true},
  senderId:{type:Schema.Types.ObjectId,ref:'User'},text:{type:String,required:true,maxlength:6000},
  kind:{type:String,enum:['MESSAGE','SYSTEM'],default:'MESSAGE'},clientMessageId:String
},{timestamps:{createdAt:true,updatedAt:false}});
messageSchema.index({roomId:1,createdAt:-1,_id:-1});
messageSchema.index({roomId:1,senderId:1,clientMessageId:1},{unique:true,partialFilterExpression:{clientMessageId:{$type:'string'}}});
export const ExecutionMessage=mongoose.model('ExecutionMessage',messageSchema);
