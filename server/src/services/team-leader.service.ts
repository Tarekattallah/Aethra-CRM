import { Track } from '../models/Track.js';
import { IUser, UserRole } from '../models/User.js';
import { idOf } from '../utils/access.js';
import {hasPermission} from '../utils/permissions.js';

export async function validateLeaderSlot(role: string, trackId: unknown, userId?: unknown, active = true,permissions?:string[]): Promise<void> {
  if ((role !== UserRole.TEAM_LEADER&&!permissions?.includes('execution:manage')) || !trackId || !active || ['ADMIN','SUPER_ADMIN'].includes(role)) return;
  const track = await Track.findById(idOf(trackId));
  if (track?.teamLeaderId && idOf(track.teamLeaderId) !== idOf(userId)) {
    throw Object.assign(new Error('التراك له تيم ليدر بالفعل؛ غيّر التعيين من إدارة التراكات أولاً.'), {status: 409});
  }
}

export async function syncLeaderTracks(user: IUser): Promise<void> {
  const currentTrack = hasPermission(user,'execution:manage')&&!['ADMIN','SUPER_ADMIN'].includes(user.role) && user.isActive && !user.isDeleted ? user.trackId : undefined;
  await Track.updateMany({teamLeaderId: user._id, ...(currentTrack ? {_id: {$ne: currentTrack}} : {})}, {$unset: {teamLeaderId: 1}});
  if (currentTrack) await Track.updateOne({_id: currentTrack}, {$set: {teamLeaderId: user._id}});
}
