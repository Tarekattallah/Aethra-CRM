import { Role } from '../models/Role.js';
import { User } from '../models/User.js';
import { SYSTEM_PERMISSIONS,ADMIN_OPERATIONAL_PERMISSIONS } from '../utils/permissions.js';
import { sseHub } from '../sse/sse.hub.js';
// One-time, versioned migration. Subsequent role edits are kept exactly as saved.
export async function upgradePermissionCatalog() {
  // Older installations can have Admin accounts without a corresponding Role record.
  if(await User.exists({role:'ADMIN'}))await Role.updateOne({slug:'ADMIN'},{$setOnInsert:{name:'مدير التشغيل (Admin)',isSystem:true,permissions:[]}},{upsert:true});
  for(const role of await Role.find({isSystem:true,$or:[{permissionCatalogVersion:{$exists:false}},{permissionCatalogVersion:{$lt:3}}]})) {
    const previous=[...role.permissions];
    const extra:Record<string,string[]>={ENGINEER:['routing:receive'],TEAM_LEADER:['routing:receive','leads:view_own','leads:edit_technical'],MARKETING:['voice:review'],STAFF:['voice:review'],SUPER_ADMIN:SYSTEM_PERMISSIONS.map(p=>p.key)};
    const retained=role.slug==='TEAM_LEADER'?previous.filter(permission=>permission!=='reports:view'):previous;
    if(role.slug==='ADMIN') {
      role.name='مدير التشغيل (Admin)';role.description='إدارة العملاء والطلبات والتوزيع والتراكات والتقارير اليومية؛ إدارة الحسابات والأدوار والكاتلوج والرقابة تحتاج تفويضًا منفصلًا.';
      role.permissions=[...ADMIN_OPERATIONAL_PERMISSIONS];
    } else if((role.permissionCatalogVersion||0)<2)role.permissions=[...new Set([...retained,...(extra[role.slug]||[])])];
    const inherited={$and:[{$or:[{roleId:role._id},{role:role.slug,roleId:{$exists:false}}]},{$or:[{permissionsSource:'ROLE'},{permissionsSource:{$exists:false}}]}]};
    const affected=await User.find(inherited).select('_id').lean();
    await User.updateMany(inherited,{$set:{permissions:role.permissions,permissionsSource:'ROLE'},$inc:{authVersion:1}});
    if(role.slug==='ADMIN') {
      // Remove the former automatic site powers from custom Admin accounts once too.
      const custom=await User.find({role:'ADMIN',permissionsSource:'CUSTOM'});
      for(const user of custom){user.permissions=user.permissions.filter(permission=>ADMIN_OPERATIONAL_PERMISSIONS.includes(permission));user.authVersion++;await user.save();sseHub.disconnectUser(user.id);}
    }
    for(const user of affected)sseHub.disconnectUser(String(user._id));
    role.permissionCatalogVersion=3;await role.save();
  }
  await User.updateMany({role:'TEAM_LEADER',permissionsSource:{$exists:false},permissions:'reports:view'},{$pull:{permissions:'reports:view'},$inc:{authVersion:1}});

  // Make previously implicit duties explicit once, then preserve subsequent role edits.
  const expand=(permissions:string[],role:string)=>[...new Set([...permissions,'leads:create_marketing','desk:use',
    ...(permissions.some(p=>['routing:receive','leads:edit_technical'].includes(p))?['payments:record','execution:view','execution:request','execution:message']:[]),
    ...(role==='TEAM_LEADER'||(role==='ADMIN'&&permissions.includes('leads:assign'))?['execution:view','execution:message','execution:manage','execution:complete']:[])])];
  for(const role of await Role.find({$or:[{permissionCatalogVersion:{$exists:false}},{permissionCatalogVersion:{$lt:4}}]})) {
    role.permissions=expand([...role.permissions],role.slug);
    const inherited={$and:[{$or:[{roleId:role._id},{role:role.slug,roleId:{$exists:false}}]},{$or:[{permissionsSource:'ROLE'},{permissionsSource:{$exists:false}}]}]};
    const affected=await User.find(inherited).select('_id').lean();
    await User.updateMany(inherited,{$set:{permissions:role.permissions,permissionsSource:'ROLE'},$inc:{authVersion:1}});
    for(const user of await User.find({role:role.slug,permissionsSource:'CUSTOM'})){user.permissions=expand([...user.permissions],user.role);user.authVersion++;await user.save();sseHub.disconnectUser(user.id);}
    for(const user of affected)sseHub.disconnectUser(String(user._id));
    role.permissionCatalogVersion=4;await role.save();
  }
  for(const role of await Role.find({permissionCatalogVersion:{$lt:5}})) {
    role.permissions=[...new Set([...role.permissions,'leads:view_submitted'])];
    const inherited={$and:[{$or:[{roleId:role._id},{role:role.slug,roleId:{$exists:false}}]},{$or:[{permissionsSource:'ROLE'},{permissionsSource:{$exists:false}}]}]};
    const affected=await User.find(inherited).select('_id').lean();
    await User.updateMany(inherited,{$set:{permissions:role.permissions,permissionsSource:'ROLE'},$inc:{authVersion:1}});
    const custom=await User.find({role:role.slug,permissionsSource:'CUSTOM'}).select('_id').lean();
    await User.updateMany({role:role.slug,permissionsSource:'CUSTOM'},{$addToSet:{permissions:'leads:view_submitted'},$inc:{authVersion:1}});
    for(const user of [...affected,...custom])sseHub.disconnectUser(String(user._id));
    role.permissionCatalogVersion=5;await role.save();
  }
}
