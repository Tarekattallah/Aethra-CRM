import { User } from '../models/User.js';
import { Track } from '../models/Track.js';
import { UserRole } from '../models/User.js';
import { Request, Response } from 'express';
import { Role } from '../models/Role.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { sseHub } from '../sse/sse.hub.js';
import { logAudit } from '../services/audit.service.js';

import { SYSTEM_PERMISSIONS, hasPermission } from '../utils/permissions.js';
export { SYSTEM_PERMISSIONS };

/**
 * 1. جلب قائمة الرتب المتاحة
 */
export async function getRoles(req: AuthRequest, res: Response): Promise<void> {
  try {
    const roles = await Role.find(req.user?.role === UserRole.SUPER_ADMIN ? {} : {slug: {$ne: UserRole.SUPER_ADMIN}}).sort({ createdAt: 1 }).lean();
    res.json({
      success: true,
      data: {
        roles: roles.map(role=>({...role,canEdit:hasPermission(req.user,'roles:manage')&&(!role.isSystem||req.user?.role===UserRole.SUPER_ADMIN),canDelete:hasPermission(req.user,'roles:manage')&&!role.isSystem,unrestricted:role.slug===UserRole.SUPER_ADMIN})),
        availablePermissions: SYSTEM_PERMISSIONS
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل جلب الرتب.' });
  }
}

/**
 * 2. إنشاء رول مخصص جديد مع صلاحيات محددة
 */
export async function createRole(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, slug, description, permissions } = req.body;

    if (!name || !slug) {
      res.status(400).json({ success: false, message: 'يرجى إدخال اسم الرول وكوده التعريفي (Slug).' });
      return;
    }

    const cleanSlug = slug.trim().toUpperCase().replace(/\s+/g, '_');
    if(permissions?.includes('portal:brand')){res.status(400).json({success:false,message:'هوية صفحة العملاء حصرية لحساب إدارة المنظومة ولا تُفوض.'});return;}
    if (cleanSlug === UserRole.SUPER_ADMIN) { res.status(400).json({success: false, message: 'كود الدور غير متاح.'}); return; }
    const existing = await Role.findOne({ slug: cleanSlug });
    if (existing) {
      res.status(400).json({ success: false, message: 'كود الرول موجود مسبقاً.' });
      return;
    }

    if (!req.user || (req.user.role!==UserRole.SUPER_ADMIN && (permissions || []).some((p: string) => !hasPermission(req.user, p)))) { res.status(403).json({success:false, message:'لا يمكنك منح صلاحية لا تملكها.'}); return; }
    const role = await Role.create({
      name: name.trim(),
      slug: cleanSlug,
      description: description?.trim(),
      permissions: Array.isArray(permissions) ? permissions : [],
      isSystem: false
    });
    await logAudit(req, {action: 'ROLE_CREATED', actionTitle: 'إنشاء دور وصلاحيات', entityType: 'SETTINGS', entityId: role.id, newValues: {slug: role.slug, permissions: role.permissions}});

    res.status(201).json({
      success: true,
      message: `تم إنشاء رول [${role.name}] بنجاح.`,
      data: { role }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل إنشاء الرول.' });
  }
}

/**
 * 3. تعديل رول وصلاحياته
 */
export async function updateRole(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    const role = await Role.findById(id);
    if (!role) {
      res.status(404).json({ success: false, message: 'الرول غير موجود.' });
      return;
    }
    if (role.slug === UserRole.SUPER_ADMIN && req.user?.role !== UserRole.SUPER_ADMIN) {
      res.status(404).json({success: false, message: 'الرول غير موجود.'}); return;
    }

    if(role.slug!==UserRole.SUPER_ADMIN&&permissions?.includes('portal:brand')){res.status(400).json({success:false,message:'هوية صفحة العملاء حصرية لحساب إدارة المنظومة ولا تُفوض.'});return;}

    if (req.user!.role!==UserRole.SUPER_ADMIN && (role.isSystem || [...role.permissions,...(permissions || [])].some((p: string) => !hasPermission(req.user, p)))) { res.status(403).json({success:false, message:'لا يمكن تعديل هذا الدور أو منح صلاحيات أعلى من حسابك.'}); return; }
    if (name) role.name = name.trim();
    if (description !== undefined) role.description = description.trim();
    const previousPermissions = [...role.permissions];
    if (Array.isArray(permissions)) role.permissions = permissions;

    await role.save();
    if (Array.isArray(permissions) && JSON.stringify(previousPermissions) !== JSON.stringify(permissions)) {
      const inherited = {$and:[{$or:[{roleId:role._id},{role:role.slug,roleId:{$exists:false}}]},{$or:[
        {permissionsSource:'ROLE'}, {permissionsSource:{$exists:false}}
      ]}]};
      const affected = await User.find(inherited).select('_id').lean();
      await User.updateMany(inherited, {$set: {permissions, permissionsSource: 'ROLE'}, $inc: {authVersion: 1}});
      if(!permissions.includes('execution:manage'))await Track.updateMany({teamLeaderId:{$in:affected.map(user=>user._id)}},{$unset:{teamLeaderId:1}});
      for (const user of affected) sseHub.disconnectUser(String(user._id));
    }
    await logAudit(req, {action: 'ROLE_UPDATED', actionTitle: 'تعديل صلاحيات دور', entityType: 'SETTINGS', entityId: role.id,
      oldValues: {permissions: previousPermissions}, newValues: {permissions: role.permissions}});

    res.json({
      success: true,
      message: 'تم تحديث الرول والصلاحيات بنجاح.',
      data: { role }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل تحديث الرول.' });
  }
}

/**
 * 4. حذف رول مخصص
 */
export async function deleteRole(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const role = await Role.findById(id);
    if (!role) {
      res.status(404).json({ success: false, message: 'الرول غير موجود.' });
      return;
    }

    if (role.isSystem) {
      res.status(400).json({ success: false, message: 'لا يمكن حذف أدوار النظام الأساسية.' });
      return;
    }

    if (req.user!.role!==UserRole.SUPER_ADMIN && role.permissions.some(p=>!hasPermission(req.user,p))) {res.status(403).json({success:false,message:'لا يمكنك إدارة دور أعلى من صلاحياتك.'});return;}

    if (await User.exists({ roleId: id, isDeleted: false }) || await User.exists({ role: role.slug, isDeleted: false })) {
      res.status(409).json({success: false, message: 'الدور مرتبط بمستخدمين؛ غيّر أدوارهم قبل الحذف.'}); return;
    }
    await Role.findByIdAndDelete(id);
    await logAudit(req, {action: 'ROLE_DELETED', actionTitle: 'حذف دور مخصص', entityType: 'SETTINGS', entityId: id, oldValues: {slug: role.slug}});

    res.json({
      success: true,
      message: 'تم حذف الرول بنجاح.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل حذف الرول.' });
  }
}

