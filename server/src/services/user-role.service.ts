import { Role } from '../models/Role.js';
import { IUser, UserRole } from '../models/User.js';
import { idOf } from '../utils/access.js';
import { ADMIN_OPERATIONAL_PERMISSIONS } from '../utils/permissions.js';

export const defaultRolePermissions: Record<string, string[]> = {
  ENGINEER: ['leads:view_own', 'leads:edit_technical','routing:receive','leads:create_marketing','leads:view_submitted','desk:use','payments:record','execution:view','execution:request','execution:message'],
  TEAM_LEADER: ['leads:view_track','leads:view_own','leads:edit_technical','routing:receive','leads:create_marketing','leads:view_submitted','desk:use','payments:record','execution:view','execution:request','execution:message','execution:manage','execution:complete'],
  STAFF: ['leads:view_own', 'leads:create_marketing','voice:review','leads:view_submitted','desk:use'],
  MARKETING: ['leads:view_own', 'leads:create_marketing','voice:review','leads:view_submitted','desk:use'],
  ADMIN: ADMIN_OPERATIONAL_PERMISSIONS,
  SUPER_ADMIN: [] // This role bypasses every permission gate directly.
};

export async function resolveUserRole(input: {role?: string; roleId?: string; permissions?: string[]}, existing?: IUser) {
  const requested = input.role !== undefined || input.roleId !== undefined;
  if (existing && !requested) return undefined;
  const selected = input.roleId ? await Role.findById(input.roleId) : await Role.findOne({slug: input.role || existing?.role || UserRole.ENGINEER});
  if (input.roleId && !selected) throw Object.assign(new Error('الدور غير موجود.'), {status: 400});
  if (selected && input.role && selected.slug !== input.role) throw Object.assign(new Error('الدور لا يطابق معرف الدور المختار.'), {status: 400});
  const role = selected?.slug || input.role || existing?.role || UserRole.ENGINEER;
  if (!selected && !Object.values(UserRole).includes(role as UserRole)) throw Object.assign(new Error('الدور غير موجود.'), {status: 400});
  const roleId = input.roleId === '' ? undefined : selected?._id;
  const changed = !existing || role !== existing.role || idOf(roleId) !== idOf(existing.roleId);
  return {role, roleId, permissions: input.permissions ?? (changed ? selected?.permissions || defaultRolePermissions[role] || [] : existing!.permissions),
    permissionsSource: input.permissions !== undefined ? 'CUSTOM' as const : changed ? 'ROLE' as const : existing?.permissionsSource};
}
