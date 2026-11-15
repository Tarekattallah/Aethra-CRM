import { createHash } from 'node:crypto';
import { Upload } from '../models/Upload.js';
import { Lead } from '../models/Lead.js';
import { LeadActivity } from '../models/LeadActivity.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { Response, NextFunction } from 'express';
import { canViewLead, idOf, leadScope } from '../utils/access.js';
import { UserRole } from '../models/User.js';

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export async function validateAttachmentAccess(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const files = [...(req.body.voiceRecording ? [req.body.voiceRecording] : []), ...(req.body.attachments || []), ...(req.body.chatAttachments || [])];
    if (req.body.receiptUrl) files.push({ url: req.body.receiptUrl });
    for (const file of files) {
      const upload = await Upload.findOne({ filename: file.url.split('/').pop() }).lean();
      if (upload && req.user?.role === UserRole.SUPER_ADMIN) continue;
      if (upload && ((req.user && idOf(upload.ownerId) === idOf(req.user._id)) ||
        (file.uploadToken && hashToken(file.uploadToken) === upload.tokenHash))) continue;
      // Existing attachments can be kept when editing their authorized lead, including legacy files.
      if (req.user && req.params.id) {
        const lead = await Lead.findById(req.params.id);
        if (lead && canViewLead(req.user, lead) &&
          [...(lead.voiceRecording ? [lead.voiceRecording] : []), ...lead.attachments, ...(lead.chatAttachments || []), { url: lead.paymentReceipt?.receiptUrl }].some(a => a.url === file.url)) continue;
      }
      res.status(403).json({ success: false, message: 'لا تملك صلاحية ربط هذا المرفق بالعميل.' }); return;
    }
    next();
  } catch (error) { next(error); }
}

export async function canDownload(req: AuthRequest, filename: string): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.role === UserRole.SUPER_ADMIN) return true;
  const url = `/uploads/${filename}`;
  const lead = await Lead.findOne({ $and: [leadScope(req.user), { $or: [
    { 'voiceRecording.url': url }, { 'attachments.url': url }, { 'chatAttachments.url': url }, { 'paymentReceipt.receiptUrl': url }, { 'paymentHistory.receiptUrl':url }
  ] }] });
  if (lead) return true;
  const activities = await LeadActivity.find({ 'attachments.url': url }).select('leadId').lean();
  if (activities.length && await Lead.exists({ $and: [leadScope(req.user), { _id: { $in: activities.map(a => a.leadId) } }] })) return true;
  const rooms=await (await import('../models/ExecutionRoom.js')).ExecutionRoom.find({trackId:req.user.trackId,memberIds:req.user._id}).select('leadId').lean();
  if(req.user.trackId && rooms.length && await Lead.exists({_id:{$in:rooms.map(room=>room.leadId)},trackId:req.user.trackId,isBundleParent:{$ne:true},$or:[{'attachments.url':url},{'chatAttachments.url':url}]}))return true;
  // Pending uploads are visible only to their uploader.
  return !!await Upload.exists({ filename, ownerId: req.user._id });
}
