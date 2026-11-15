import { ExecutionRoom,ExecutionMessage,IExecutionRoom } from '../models/ExecutionRoom.js';
import { Lead,ILead,LeadStatus } from '../models/Lead.js';
import { User,IUser,UserRole,isAdministrator } from '../models/User.js';
import { Track } from '../models/Track.js';
import { idOf,canViewLead } from '../utils/access.js';
import { hasPermission } from '../utils/permissions.js';
import { sseHub } from '../sse/sse.hub.js';

export function fullyPaid(lead:any):boolean {
  return !!(lead.paymentReceipt?.isReceived && lead.paymentReceipt?.paymentType!=='DEPOSIT');
}
export async function currentLeader(trackId:any) {
  const track=await Track.findById(trackId);
  if(!track)return null;
  const candidates=await User.find({...(track.teamLeaderId?{_id:track.teamLeaderId}:{}),trackId:track._id,isActive:true,isDeleted:false});
  return candidates.find(user=>!isAdministrator(user.role)&&hasPermission(user,'execution:manage'))||null;
}
export async function managesRoom(user:IUser,room:IExecutionRoom):Promise<boolean> {
  if(!hasPermission(user,'execution:manage'))return false;
  if(isAdministrator(user.role)&&hasPermission(user,'leads:assign'))return true;
  if(idOf(user.trackId)!==idOf(room.trackId))return false;
  return idOf((await currentLeader(room.trackId))?._id)===idOf(user._id);
}
export async function readsRoom(user:IUser,room:IExecutionRoom,lead:any):Promise<boolean> {
  if(!hasPermission(user,'execution:view'))return false;
  if(isAdministrator(user.role))return canViewLead(user,lead);
  if(!user.trackId||idOf(user.trackId)!==idOf(room.trackId)||idOf(lead.trackId)!==idOf(room.trackId)||lead.isBundleParent)return false;
  return await managesRoom(user,room) || idOf(lead.assignedEngineerId)===idOf(user._id) || room.memberIds.some(id=>idOf(id)===idOf(user._id));
}
export async function signalRoom(room:IExecutionRoom,lead:any) {
  const ids=new Set([...room.memberIds.map(String),String(lead.assignedEngineerId||''),String((await currentLeader(room.trackId))?._id||'')]);
  for(const id of ids)if(id)sseHub.sendToUser(id,{type:'PROJECT_UPDATED',roomId:room.id});
}
export async function systemMessage(room:IExecutionRoom,text:string) {
  await ExecutionMessage.create({roomId:room._id,text,kind:'SYSTEM'});
}
export async function syncExecutionRoom(lead:ILead) {
  const room=await ExecutionRoom.findOne({leadId:lead._id});
  if(!room || ['CLOSED','REJECTED'].includes(room.status))return;
  if(lead.status===LeadStatus.LOST){room.status='CLOSED';room.closedAt=new Date();room.closeReason='CANCELLED';}
  else if(lead.executionCompletedAt && fullyPaid(lead)) {room.status='CLOSED';room.closedAt=new Date();room.closeReason='COMPLETED_AND_PAID';}
  else if(lead.executionCompletedAt)room.status='AWAITING_PAYMENT';
  else return;
  if(room.isModified()){await room.save();await systemMessage(room,room.status==='CLOSED'?'تم أرشفة المحادثة. السجل محفوظ للقراءة.':'انتهى التنفيذ، والمحادثة تظل مفتوحة حتى اكتمال الدفع.');await signalRoom(room,lead);}
}
export async function refreshBundleParent(child:ILead) {
  if(!child.parentRequestId)return;
  const parent=await Lead.findById(child.parentRequestId);if(!parent)return;
  const children=await Lead.find({parentRequestId:parent._id});
  const rooms=await ExecutionRoom.find({leadId:{$in:children.map(item=>item._id)}});
  const finished=children.length>0 && children.every(item=>fullyPaid(item)&&(!rooms.some(room=>idOf(room.leadId)===item.id)||!!item.executionCompletedAt));
  if(finished&&parent.status!==LeadStatus.CONVERTED){parent.status=LeadStatus.CONVERTED;await parent.save();}
}
