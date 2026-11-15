const administratorRoles=new Set<string>(['ADMIN']);
export function configureAccountCapabilities(user?:any):void {
  administratorRoles.clear();administratorRoles.add('ADMIN');
  if(user?.administrator)administratorRoles.add(user.role);
}
export function isAdministrator(role?:string):boolean {return !!role && administratorRoles.has(role);}


export function hasPermission(user:any,permission:string):boolean {
  if(!user)return false;
  if(user.canManageProtectedAccounts)return true;
  if(permission==='portal:brand')return false;
  if(user.role==='ADMIN'&&!user.permissionsSource&&!user.permissions?.length)return ['leads:view_all','leads:view_submitted','leads:create_marketing','leads:edit_technical','leads:edit_all','leads:split','leads:assign','voice:review','customers:manage','passwords:reset','tracks:manage','reports:view','reports:export','settings:manage','payments:record','execution:view','execution:request','execution:manage','execution:complete','execution:message','desk:use'].includes(permission);
  if(user.permissions?.includes(permission))return true;
  if(!user.permissionsSource){
    if(['leads:create_marketing','leads:view_submitted','desk:use'].includes(permission))return true;
    if(['payments:record','execution:view','execution:request','execution:message'].includes(permission))return hasPermission(user,'leads:edit_technical');
    if(['execution:manage','execution:complete'].includes(permission))return user.role==='TEAM_LEADER';
  }
  if(permission==='leads:view_own' && ['routing:receive','leads:edit_technical'].some(p=>user.permissions?.includes(p)))return true;
  if(permission==='leads:edit_technical' && user.permissions?.includes('routing:receive'))return true;
  if(permission==='leads:view_all' && ['leads:assign','leads:split','leads:edit_all','customers:manage'].some(p=>user.permissions?.includes(p)))return true;
  if(permission==='reports:view' && user.permissions?.includes('reports:export'))return true;
  if(user.permissionsSource)return false;
  if(['ENGINEER','TEAM_LEADER'].includes(user.role)&&['routing:receive','leads:view_own','leads:edit_technical'].includes(permission))return true;
  if(user.role==='TEAM_LEADER'&&permission==='leads:view_track')return true;
  return ['STAFF','MARKETING'].includes(user.role)&&permission==='voice:review';
}
export const sectionPermissions:Record<string,string>={overview:'reports:view',routing:'settings:manage',leads:'leads:view_all',customers:'customers:manage',audit:'audit:view',tracks:'tracks:manage',services:'services:manage',users:'users:manage',roles:'roles:manage',passwords:'passwords:reset',clientBrand:'portal:brand'};
export function canManage(user:any):boolean{return Object.values(sectionPermissions).some(p=>hasPermission(user,p));}
