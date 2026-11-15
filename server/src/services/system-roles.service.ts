import {Role} from '../models/Role.js';
import {defaultRolePermissions} from './user-role.service.js';

const names: Record<string,string> = {
  ADMIN:'مدير التشغيل (Admin)',
  TEAM_LEADER:'قائد الفريق (Team Leader)',
  ENGINEER:'مهندس / أخصائي (Engineer)',
  MARKETING:'مسؤول استقبال وتسويق (Marketing)',
  STAFF:'موظف (Staff)'
};

// A clean installation needs role definitions without demo accounts or work data.
// Existing role edits are retained; versioned upgrades remain a separate step.
export async function initializeSystemRoles() {
  for (const [slug,name] of Object.entries(names)) {
    try {
      await Role.updateOne({slug},{$setOnInsert:{name,slug,isSystem:true,permissions:defaultRolePermissions[slug],permissionCatalogVersion:5}},{upsert:true});
    } catch(error:any) {
      if(error.code!==11000 || !await Role.exists({slug}))throw error;
    }
  }
}
