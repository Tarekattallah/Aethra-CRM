import { hasPermission } from './permissions.js';
import { IUser, UserRole, isAdministrator } from '../models/User.js';

export function idOf(value: any): string | undefined {
  return value ? String(value._id ?? value) : undefined;
}

export function isTrackBound(user: IUser): boolean {
  return !isAdministrator(user.role) && (!!user.trackId || ['ENGINEER','TEAM_LEADER'].includes(user.role));
}
export function withinTrack(user:IUser,lead:any):boolean {
  if(!isTrackBound(user))return true;
  if(lead.isBundleParent||lead.departmentIds?.length>1)return false;
  if(hasPermission(user,'voice:review')&&lead.voiceReviewStatus==='PENDING'&&!lead.trackId&&!lead.departmentIds?.length)return true;
  return (!!user.trackId && idOf(lead.trackId)===idOf(user.trackId)) ||
    (!lead.trackId && !lead.departmentIds?.length && idOf(lead.submittedByUserId)===idOf(user._id));
}
export function trackBoundary(user:IUser):Record<string,any> {
  if(!isTrackBound(user))return {};
  return {isBundleParent:{$ne:true},'departmentIds.1':{$exists:false},$or:[...(user.trackId?[{trackId:user.trackId}]:[]),{trackId:null,departmentIds:{$size:0},submittedByUserId:user._id},...(hasPermission(user,'voice:review')?[{trackId:null,departmentIds:{$size:0},voiceReviewStatus:'PENDING'}]:[])]};
}
export function leadScope(user: IUser): Record<string, any> {
  if(user.role===UserRole.SUPER_ADMIN)return {workOrderPublished:{$ne:false}};
  const scopes:any[]=hasPermission(user,'leads:view_submitted')?[{submittedByUserId:user._id},{voiceReviewedBy:user._id}]:[];
  if(hasPermission(user,'leads:view_all'))scopes.push({});
  if(hasPermission(user,'leads:view_track')&&user.trackId)scopes.push({trackId:user.trackId});
  if(hasPermission(user,'leads:view_own'))scopes.push({assignedEngineerId:user._id});
  if(hasPermission(user,'voice:review'))scopes.push({voiceReviewStatus:'PENDING'});
  return {$and:[{workOrderPublished:{$ne:false}},trackBoundary(user),{$or:scopes.length?scopes:[{_id:{$in:[]}}]}]};
}
export function canViewLead(user:IUser,lead:any):boolean {
  return lead.workOrderPublished!==false && withinTrack(user,lead) && (hasPermission(user,'leads:view_all') || (hasPermission(user,'leads:view_submitted')&&(idOf(lead.submittedByUserId)===idOf(user._id) || idOf(lead.voiceReviewedBy)===idOf(user._id))) ||
    (hasPermission(user,'leads:view_track')&&!!user.trackId&&idOf(lead.trackId)===idOf(user.trackId)) ||
    (hasPermission(user,'leads:view_own')&&idOf(lead.assignedEngineerId)===idOf(user._id)) ||
    (hasPermission(user,'voice:review')&&lead.voiceReviewStatus==='PENDING'));
}
export function canEditLead(user:IUser,lead:any):boolean {
  return user.role===UserRole.SUPER_ADMIN || (user.role===UserRole.ADMIN&&hasPermission(user,'leads:edit_technical')&&canViewLead(user,lead)) || (withinTrack(user,lead)&&!lead.isBundleParent && lead.voiceReviewStatus!=='PENDING' && idOf(lead.assignedEngineerId)===idOf(user._id)&&hasPermission(user,'leads:edit_technical'));
}

export function sanitizeActivity(activity: any, isAdmin: boolean): any {
  const result = activity.toObject ? activity.toObject() : { ...activity };
  if (!isAdmin) { delete result.ipAddress; delete result.deviceSummary; }
  return result;
}
