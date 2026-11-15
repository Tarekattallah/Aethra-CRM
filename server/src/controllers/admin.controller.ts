import { PasswordResetRequest } from '../models/PasswordResetRequest.js';
import { hasPermission, canManageAccount } from '../utils/permissions.js';
import { resetAssignmentSla } from '../services/lead-lifecycle.service.js';
import { idOf,canViewLead,isTrackBound } from '../utils/access.js';
import { getSystemSettings } from '../models/SystemSettings.js';
import { logAudit } from '../services/audit.service.js';
import { resolveUserRole } from '../services/user-role.service.js';
import { validateLeaderSlot, syncLeaderTracks } from '../services/team-leader.service.js';
import { Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, UserRole } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Track } from '../models/Track.js';
import { Lead, AssignmentMethod, LeadStatus } from '../models/Lead.js';
import { LeadActivity, ActivityType } from '../models/LeadActivity.js';
import { Notification, NotificationType } from '../models/Notification.js';
import { sseHub } from '../sse/sse.hub.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

/**
 * 1. تفعيل أو تعطيل حساب مهندس (Active / Inactive Switch)
 */
export async function toggleEngineerStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const engineer = await User.findById(id);

    if (!engineer || !hasPermission(engineer, 'routing:receive')) {
      res.status(404).json({ success: false, message: 'المهندس غير موجود.' });
      return;
    }

    if(!canManageAccount(req.user!,engineer)){res.status(404).json({success:false,message:'المستخدم غير متاح.'});return;}
    engineer.isActive = !engineer.isActive;
    engineer.authVersion = (engineer.authVersion || 0) + 1;
    await engineer.save();
    sseHub.disconnectUser(engineer.id);
    await logAudit(req, {action: 'USER_STATUS_CHANGED', actionTitle: 'تغيير حالة المهندس', entityType: 'USER', entityId: engineer._id.toString(), newValues: {isActive: engineer.isActive}});

    res.json({
      success: true,
      message: `تم ${engineer.isActive ? 'تفعيل' : 'تعطيل'} حساب المهندس بنجاح.`,
      data: { isActive: engineer.isActive }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل تغيير حالة المهندس.' });
  }
}

/**
 * 2. تعديل سقف الاستيعاب اليومي للمهندس (maxDailyLeads)
 */
export async function updateDailyLimit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { maxDailyLeads } = req.body;

    const engineer = await User.findById(id);
    if (!engineer || !hasPermission(engineer, 'routing:receive')) {
      res.status(404).json({ success: false, message: 'المهندس غير موجود.' });
      return;
    }

    if(!canManageAccount(req.user!,engineer)){res.status(404).json({success:false,message:'المستخدم غير متاح.'});return;}
    engineer.maxDailyLeads = Math.max(0, Number(maxDailyLeads) || 0);
    await engineer.save();
    await logAudit(req, {action: 'DAILY_LIMIT_UPDATED', actionTitle: 'تعديل السقف اليومي', entityType: 'USER', entityId: engineer._id.toString(), newValues: {maxDailyLeads: engineer.maxDailyLeads}});

    res.json({
      success: true,
      message: 'تم تحديث سقف الاستيعاب اليومي بنجاح.',
      data: { maxDailyLeads: engineer.maxDailyLeads }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل تحديث الحد اليومي.' });
  }
}

/**
 * 3. إعادة تعيين جماعية للعملاء (Bulk Reassignment)
 */
export async function bulkReassignLeads(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { leadIds, targetEngineerId, reason } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0 || !targetEngineerId || !reason) {
      res.status(400).json({
        success: false,
        message: 'يرجى تحديد العملاء والمهندس المستهدف وتوثيق سبب النقل.'
      });
      return;
    }

    const targetEngineer = await User.findById(targetEngineerId);
    if (!targetEngineer || !targetEngineer.trackId || !await Track.exists({_id:targetEngineer.trackId,isActive:true}) || !targetEngineer.isActive || targetEngineer.isDeleted || ['ADMIN','SUPER_ADMIN'].includes(targetEngineer.role) || !hasPermission(targetEngineer, 'routing:receive')) {
      res.status(400).json({ success: false, message: 'المهندس المختار غير متاح حالياً.' });
      return;
    }

    if(isTrackBound(req.user!)&&idOf(targetEngineer.trackId)!==idOf(req.user!.trackId)){res.status(403).json({success:false});return;}
    const updatedLeads = await Lead.find({ _id: { $in: leadIds } });

    if (updatedLeads.length !== new Set(leadIds).size || updatedLeads.some(lead => !canViewLead(req.user!,lead) || lead.isBundleParent || lead.departmentIds.length>1 || lead.voiceReviewStatus === 'PENDING' || (lead.trackId && idOf(lead.trackId) !== idOf(targetEngineer.trackId)) || (!lead.trackId && lead.departmentIds.length > 0 && !lead.departmentIds.some(id => idOf(id) === idOf(targetEngineer.trackId))))) {
      res.status(400).json({success: false, message: 'بعض العملاء غير موجودين أو لا يتبعون تراك المهندس.'}); return;
    }
    for (const lead of updatedLeads) {
      lead.trackId = targetEngineer.trackId;
      lead.assignedEngineerId = targetEngineer._id;
      lead.assignedAt = new Date();
      lead.isReassigned = true;
      lead.assignmentMethod = AssignmentMethod.MANUAL_ADMIN;
      await resetAssignmentSla(lead);
      await lead.save();

      // توثيق في الـ Timeline
      await LeadActivity.create({
        leadId: lead._id,
        userId: req.user?._id,
        type: ActivityType.REASSIGNED,
        title: 'إعادة تعيين جماعية من الإدارة',
        content: `تم نقل العميل جماعياً إلى المهندس [${targetEngineer.name}]. السبب: ${reason}`
      });
    }

    await logAudit(req, {action: 'LEADS_BULK_REASSIGNED', actionTitle: 'نقل جماعي للعملاء', entityType: 'ROUTING', entityId: targetEngineer.id, details: reason, newValues: {leadIds, count: updatedLeads.length}});
    // إشعار المهندس المستلم
    await Notification.create({
      userId: targetEngineer._id,
      type: NotificationType.LEAD_REASSIGNED,
      title: 'تم إسناد مجموعة عملاء إليك من الإدارة',
      message: `تم تحويل [${updatedLeads.length}] عملاء إليك لمتابعتهم.`
    });

    sseHub.sendToUser(targetEngineer._id.toString(), {
      type: 'LEAD_REASSIGNED',
      title: 'تم إسناد مجموعة عملاء إليك من الإدارة',
      message: `تم تحويل [${updatedLeads.length}] عملاء إليك لمتابعتهم.`
    });

    res.json({
      success: true,
      message: `تمت إعادة تعيين [${updatedLeads.length}] عميل بنجاح إلى المهندس [${targetEngineer.name}].`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل النقل الجماعي للعملاء.' });
  }
}

/**
 * 4. جلب جميع المستخدمين مع بيانات الرتب والتراكات والإحصائيات
 */
export async function getAllUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { role, trackId } = req.query;
    const filter: any = { isDeleted: false };

    if (role) filter.role = role;
    if (req.user?.role !== UserRole.SUPER_ADMIN) filter.$and = [{role: {$ne: UserRole.SUPER_ADMIN}}];
    if (trackId) filter.trackId = trackId;
    if(isTrackBound(req.user!))filter.$and=[...(filter.$and||[]),{trackId:req.user!.trackId}];

    let users = await User.find(filter)
      .select('-passwordHash')
      .populate('roleId', 'name slug permissions')
      .populate('trackId', 'name slug color')
      .populate('specializations', 'name slug')
      .sort({ createdAt: -1 })
      .lean();

    if(req.query.passwordTargets==='true') {
      if(!hasPermission(req.user,'passwords:reset')){res.status(403).json({success:false});return;}
      users=users.filter(user=>canManageAccount(req.user!,user as any));
    }

    // حساب عدد العملاء المسندين لكل مستخدم
    if(!hasPermission(req.user,'users:manage')) {res.json({success:true,data:{users:users.map(u=>({_id:u._id,name:u.name,email:hasPermission(req.user,'passwords:reset')?u.email:undefined,role:u.role,trackId:u.trackId,isActive:u.isActive,permissions:u.permissions,permissionsSource:u.permissionsSource}))}});return;}
    const usersWithStats = await Promise.all(
      users.map(async (u) => {
        const [activeLeads, convertedLeads] = await Promise.all([
          Lead.countDocuments({
            assignedEngineerId: u._id,
            status: { $nin: [LeadStatus.CONVERTED, LeadStatus.LOST] }
          }),
          Lead.countDocuments({
            assignedEngineerId: u._id,
            status: LeadStatus.CONVERTED
          })
        ]);

        return {
          ...u,
          activeLeadsCount: activeLeads,
          convertedLeadsCount: convertedLeads
        };
      })
    );

    res.json({
      success: true,
      data: { users: usersWithStats }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل جلب قائمة المستخدمين.' });
  }
}

/**
 * 5. إنشاء مستخدم جديد وتحديد الرول والتراك
 */
export async function createManagedUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, email, password, role, roleId, trackId, phone, maxDailyLeads, specializations, permissions } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ success: false, message: 'يرجى إدخال الاسم، البريد الإلكتروني، وكلمة المرور.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    if (role === UserRole.SUPER_ADMIN && req.user?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({success: false, message: 'هذا الحساب أو الدور غير متاح.'}); return;
    }
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      res.status(400).json({ success: false, message: 'البريد الإلكتروني مسجل مسبقاً.' });
      return;
    }

    if (trackId && !await Track.exists({ _id: trackId, isActive: true })) { res.status(400).json({success: false, message: 'التراك غير متاح.'}); return; }
    const assignment = (await resolveUserRole({role, roleId, permissions}))!;
    if (assignment.role === UserRole.SUPER_ADMIN && req.user?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({success: false, message: 'هذا الحساب أو الدور غير متاح.'}); return;
    }
    if (req.user!.role!==UserRole.SUPER_ADMIN && (['ADMIN','SUPER_ADMIN'].includes(assignment.role) || assignment.permissions.some(p => !hasPermission(req.user, p)))) { res.status(403).json({success:false,message:'لا يمكنك منح صلاحيات أعلى من حسابك.'}); return; }
    const passwordHash = await bcrypt.hash(password, 10);
    await validateLeaderSlot(assignment.role, trackId,undefined,true,assignment.permissions);

    const newUser = await User.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: assignment.role,
      roleId: assignment.roleId,
      trackId: trackId || undefined,
      phone: phone?.trim(),
      maxDailyLeads: Number(maxDailyLeads) || 0,
      specializations: Array.isArray(specializations) ? specializations : [],
      permissions: assignment.permissions,
      permissionsSource: assignment.permissionsSource,
      isActive: true,
      isDeleted: false
    });

    await syncLeaderTracks(newUser);
    await logAudit(req, {action: 'USER_CREATED', actionTitle: 'إنشاء حساب مستخدم', entityType: 'USER', entityId: newUser._id.toString()});
    const userObj = await User.findById(newUser._id)
      .select('-passwordHash')
      .populate('roleId', 'name slug')
      .populate('trackId', 'name slug color');

    res.status(201).json({
      success: true,
      message: `تم إنشاء حساب المستخدم [${newUser.name}] بنجاح.`,
      data: { user: userObj }
    });
  } catch (error: any) {
    res.status(error.code === 11000 ? 409 : error.status || 500).json({ success: false, message: error.code === 11000 ? 'البريد الإلكتروني مسجل مسبقاً.' : error.status ? error.message : 'فشل إنشاء المستخدم.' });
  }
}

/**
 * 6. تعديل مستخدم وتحديث رتبته أو تراكه أو صلاحياته
 */
export async function updateManagedUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, email, password, role, roleId, trackId, phone, maxDailyLeads, specializations, permissions, isActive } = req.body;

    const user = await User.findById(id);
    if (!user || user.isDeleted) {
      res.status(404).json({ success: false, message: 'المستخدم غير موجود.' });
      return;
    }

    if(!canManageAccount(req.user!,user)){res.status(404).json({success:false,message:'المستخدم غير متاح.'});return;}
    if (req.user?.role !== UserRole.SUPER_ADMIN && (user.role === UserRole.SUPER_ADMIN || role === UserRole.SUPER_ADMIN)) {
      res.status(403).json({success: false, message: 'هذا الحساب أو الدور غير متاح.'}); return;
    }

    if (id === req.user?._id.toString() && (isActive === false || (role && role !== req.user.role))) {
      res.status(400).json({success: false, message: 'لا يمكن تعطيل حسابك الحالي أو إزالة دور الإدارة منه.'}); return;
    }
    if (trackId && !await Track.exists({ _id: trackId, isActive: true })) { res.status(400).json({success: false, message: 'التراك غير متاح.'}); return; }
    const assignment = await resolveUserRole({role, roleId, permissions}, user);
    if (assignment?.role === UserRole.SUPER_ADMIN && req.user?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({success: false, message: 'هذا الحساب أو الدور غير متاح.'}); return;
    }
    if (id === req.user?._id.toString() && assignment && assignment.role !== user.role) {
      res.status(400).json({success: false, message: 'لا يمكن إزالة دور الإدارة من حسابك الحالي.'}); return;
    }
    if (req.user!.role!==UserRole.SUPER_ADMIN && (['ADMIN','SUPER_ADMIN'].includes(user.role) || (assignment?.permissions || permissions || []).some((p: string) => !hasPermission(req.user, p)))) { res.status(403).json({success:false,message:'هذا الحساب أو الدور غير متاح.'}); return; }
    if (password && !hasPermission(req.user,'passwords:reset')) {res.status(403).json({success:false,message:'تغيير كلمات المرور يتطلب الصلاحية المخصصة.'});return;}
    const securityChanged = Boolean(password) || (isActive !== undefined && isActive !== user.isActive) ||
      (trackId !== undefined && (trackId || undefined) !== idOf(user.trackId)) ||
      (assignment && (assignment.role !== user.role || idOf(assignment.roleId) !== idOf(user.roleId) || JSON.stringify(assignment.permissions) !== JSON.stringify(user.permissions))) ||
      (permissions !== undefined && JSON.stringify(permissions) !== JSON.stringify(user.permissions));
    await validateLeaderSlot(assignment?.role || user.role, trackId === undefined ? user.trackId : trackId, user._id, isActive ?? user.isActive,assignment?.permissions||permissions||user.permissions);
    if (name) user.name = name.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (assignment) { user.role = assignment.role; user.roleId = assignment.roleId; user.permissions = assignment.permissions; user.permissionsSource = assignment.permissionsSource; }
    if (trackId !== undefined) user.trackId = trackId ? trackId : undefined;
    if (maxDailyLeads !== undefined) user.maxDailyLeads = Math.max(0, Number(maxDailyLeads) || 0);
    if (Array.isArray(specializations)) user.specializations = specializations;
    if (Array.isArray(permissions)) { user.permissions = permissions; user.permissionsSource = 'CUSTOM'; }
    if (isActive !== undefined) user.isActive = Boolean(isActive);

    if (password && password.length >= 8) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }
    if (securityChanged) user.authVersion = (user.authVersion || 0) + 1;

    await user.save();
    if(password)await PasswordResetRequest.updateOne({userId:user._id},{$set:{pending:false,resolvedAt:new Date(),resolvedBy:req.user!._id}});
    if (securityChanged) sseHub.disconnectUser(user.id);
    await syncLeaderTracks(user);
    await logAudit(req, {action: 'USER_UPDATED', actionTitle: 'تعديل حساب مستخدم', entityType: 'USER', entityId: user._id.toString()});

    const updated = await User.findById(id)
      .select('-passwordHash')
      .populate('roleId', 'name slug')
      .populate('trackId', 'name slug color');

    res.json({
      success: true,
      message: 'تم تحديث بيانات المستخدم بنجاح.',
      data: { user: updated }
    });
  } catch (error: any) {
    res.status(error.code === 11000 ? 409 : error.status || 500).json({ success: false, message: error.code === 11000 ? 'البريد الإلكتروني مسجل لمستخدم آخر.' : error.status ? error.message : 'فشل تحديث بيانات المستخدم.' });
  }
}

/**
 * 7. حذف مستخدم (Soft Delete)
 */
export async function deleteManagedUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (id === req.user?._id.toString()) {
      res.status(400).json({ success: false, message: 'لا يمكن حذف الحساب الحالي للمدير المسجل.' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'المستخدم غير موجود.' });
      return;
    }

    if (user.role === UserRole.SUPER_ADMIN && req.user?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({success: false, message: 'هذا الحساب أو الدور غير متاح.'}); return;
    }

    if (req.user!.role!==UserRole.SUPER_ADMIN && ['ADMIN','SUPER_ADMIN'].includes(user.role)) { res.status(403).json({success:false,message:'هذا الحساب غير متاح.'}); return; }
    if(!canManageAccount(req.user!,user)){res.status(404).json({success:false,message:'المستخدم غير متاح.'});return;}
    user.isDeleted = true;
    user.isActive = false;
    user.authVersion = (user.authVersion || 0) + 1;
    await user.save();
    sseHub.disconnectUser(user.id);
    await syncLeaderTracks(user);
    await logAudit(req, {action: 'USER_DELETED', actionTitle: 'حذف حساب مستخدم', entityType: 'USER', entityId: user._id.toString()});

    res.json({
      success: true,
      message: `تم حذف حساب [${user.name}] بنجاح.`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل حذف المستخدم.' });
  }
}


