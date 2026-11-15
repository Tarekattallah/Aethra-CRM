import bcrypt from 'bcryptjs';
import { User, UserRole } from '../models/User.js';
import { Role } from '../models/Role.js';
import { logAudit } from './audit.service.js';
import { SYSTEM_PERMISSIONS } from '../controllers/role.controller.js';

export async function bootstrapSuperAdmin(email: string, newAccountPassword?: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error('A complete email address is required.');
  const existing = await User.findOne({email: cleanEmail});
  if (existing?.role === UserRole.SUPER_ADMIN && existing.isActive && !existing.isDeleted) return {user: existing, created: false, unchanged: true};
  if (await User.exists({role: UserRole.SUPER_ADMIN, isDeleted: false})) {
    throw new Error('A SuperAdmin already exists. Use that account to manage additional SuperAdmins.');
  }
  if (existing && (existing.role !== UserRole.ADMIN || !existing.isActive || existing.isDeleted)) {
    throw new Error('The existing account must be an active ADMIN. No account or password was changed.');
  }
  if (!existing && !newAccountPassword) throw new Error('Account not found. Add --create to initialize a new account.');
  if (newAccountPassword && (newAccountPassword.length < 16 || Buffer.byteLength(newAccountPassword) > 72)) throw new Error('A strong password of 16–72 bytes is required.');

  const permissions = SYSTEM_PERMISSIONS.map(permission => permission.key);
  const role = await Role.findOneAndUpdate({slug: UserRole.SUPER_ADMIN}, {$set: {
    name: 'مدير المنظومة الأعلى (SuperAdmin)', isSystem: true, permissions
  }}, {upsert: true, new: true});
  let user;
  if (existing) {
    user = await User.findOneAndUpdate({_id: existing._id, role: UserRole.ADMIN, isActive: true, isDeleted: false},
      {$set: {role: UserRole.SUPER_ADMIN, roleId: role._id, permissions}}, {new: true});
    if (!user) throw new Error('The account changed during bootstrap. No promotion was applied.');
  } else {
    user = await User.create({name: 'SuperAdmin', email: cleanEmail, passwordHash: await bcrypt.hash(newAccountPassword!, 12),
      role: UserRole.SUPER_ADMIN, roleId: role._id, permissions, isActive: true, isDeleted: false});
  }
  await logAudit(null, {action:'SUPER_ADMIN_BOOTSTRAPPED', actionTitle:'تعيين أول SuperAdmin محلياً', entityType:'USER', entityId:user.id,
    details: `تم ${existing ? 'ترقية' : 'إنشاء'} الحساب ${cleanEmail} باستخدام أداة التهيئة المحلية.`, newValues: {role: UserRole.SUPER_ADMIN}});
  return {user, created: !existing, unchanged: false};
}
