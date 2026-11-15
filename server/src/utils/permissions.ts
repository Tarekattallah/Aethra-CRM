import { IUser, isAdministrator, UserRole } from '../models/User.js';

export const SYSTEM_PERMISSIONS = [
  ['leads:view_all','عرض كل الطلبات','الطلبات'], ['leads:view_track','عرض طلبات أعضاء التراك','الطلبات'],
  ['leads:view_submitted','عرض الطلبات التي سجلتها أو نسقتها ضمن نطاقي','الطلبات'],
  ['leads:view_own','عرض الطلبات المسندة لي','الطلبات'], ['leads:create_marketing','تسجيل طلب بالنيابة عن العميل','الطلبات'],
  ['leads:edit_technical','متابعة الطلبات المسندة وتوثيق التواصل والمواصفات والحالة','الطلبات'],
  ['leads:edit_all','عرض كل الطلبات وتعديل بيانات الاستقبال','الطلبات'], ['leads:split','فصل طلب متعدد التراكات لأجزاء مستقلة','التوزيع'], ['leads:assign','عرض الطلبات وتوزيعها وإعادة إسنادها','التوزيع'],
  ['routing:receive','استقبال الطلبات من المحرك ومتابعة الطلبات المسندة','التوزيع'], ['voice:review','مراجعة التسجيلات الصوتية وتنسيق الطلب','التسويق'],
  ['customers:manage','عرض دليل العملاء وطلباتهم وتعديل بياناتهم','العملاء'], ['users:manage','إدارة حسابات الموظفين','الحسابات'],
  ['passwords:reset','استقبال طلبات نسيان وتغيير كلمات المرور','الحسابات'], ['roles:manage','إدارة الأدوار والصلاحيات','الحسابات'],
  ['tracks:manage','إدارة التراكات والتيم ليدر','الكاتلوج'], ['services:manage','إدارة الخدمات وأسئلة النماذج والترجمات','الكاتلوج'],
  ['reports:view','عرض تقارير الإدارة','التقارير'], ['reports:export','عرض وتصدير تقارير العملاء','التقارير'],
  ['audit:view','عرض وتصدير سجل الرقابة','التقارير'], ['settings:manage','سياسة التوزيع ومهل المتابعة','الإعدادات'],
  ['payments:record','تسجيل العربون والدفعات والتسوية المالية','الدفعات'],
  ['execution:view','عرض فرق التنفيذ المتاحة ضمن نطاقي','فرق التنفيذ'],
  ['execution:request','طلب فريق لتنفيذ طلبي المعتمد','فرق التنفيذ'],
  ['execution:manage','اعتماد الفرق واختيار المشاركين كقائد للتراك','فرق التنفيذ'],
  ['execution:complete','اعتماد انتهاء التنفيذ كقائد للتراك','فرق التنفيذ'],
  ['execution:message','إرسال رسائل داخل فرق التنفيذ المتاحة لي','فرق التنفيذ'],
  ['desk:use','استخدام المساحة اليومية والملاحظات والمهام والحاسبة','أدوات العمل'],
  ['portal:brand','تغيير اسم الشركة ولوجو صفحة العملاء (حصري لإدارة المنظومة)','هوية الموقع']
].map(([key,label,category]) => ({key,label,category,...(key==='portal:brand'?{exclusiveToOwner:true}:{})}));

// Operational administration is distinct from account/site governance.
export const ADMIN_OPERATIONAL_PERMISSIONS = [
  'leads:view_all','leads:view_submitted','leads:create_marketing','leads:edit_technical','leads:edit_all',
  'leads:split','leads:assign','voice:review','customers:manage','passwords:reset',
  'tracks:manage','reports:view','reports:export','settings:manage'
  ,'payments:record','execution:view','execution:request','execution:manage','execution:complete','execution:message','desk:use'
];

export function hasPermission(user: Pick<IUser,'role'|'permissions'|'permissionsSource'> | undefined, permission: string): boolean {
  if (!user) return false;
  if (user.role === UserRole.SUPER_ADMIN) return true;
  if(permission==='portal:brand')return false;
  if (user.role === UserRole.ADMIN && !user.permissionsSource && !user.permissions?.length) return ADMIN_OPERATIONAL_PERMISSIONS.includes(permission);
  if (user.permissions?.includes(permission)) return true;
  if(!user.permissionsSource){
    if(['leads:create_marketing','leads:view_submitted','desk:use'].includes(permission))return true;
    if(['payments:record','execution:view','execution:request','execution:message'].includes(permission))return hasPermission(user,'leads:edit_technical');
    if(['execution:manage','execution:complete'].includes(permission))return user.role===UserRole.TEAM_LEADER;
  }
  if(permission==='leads:view_own' && ['routing:receive','leads:edit_technical'].some(p=>user.permissions?.includes(p)))return true;
  if(permission==='leads:edit_technical' && user.permissions?.includes('routing:receive'))return true;
  if(permission==='leads:view_all' && ['leads:assign','leads:split','leads:edit_all','customers:manage'].some(p=>user.permissions?.includes(p)))return true;
  if(permission==='reports:view' && user.permissions?.includes('reports:export'))return true;
  // Existing built-in accounts retain their operational duties. Explicit custom grants stay exact.
  if (user.permissionsSource) return false;
  if (['ENGINEER','TEAM_LEADER'].includes(user.role) && ['routing:receive','leads:view_own','leads:edit_technical'].includes(permission)) return true;
  if (user.role === UserRole.TEAM_LEADER && permission === 'leads:view_track') return true;
  return ['STAFF','MARKETING'].includes(user.role) && permission === 'voice:review';
}

export const receiverQuery = { role: {$nin:['ADMIN','SUPER_ADMIN']}, $or: [{role: {$in: ['ENGINEER','TEAM_LEADER']}, permissionsSource: {$exists:false}}, {permissions: 'routing:receive'}] };

export function canManageAccount(actor:IUser,target:IUser):boolean {
  if(actor.role===UserRole.SUPER_ADMIN)return true;
  if(target.role===UserRole.SUPER_ADMIN)return false;
  if(actor.role===UserRole.ADMIN)return ['users:manage','roles:manage','services:manage','audit:view'].every(permission=>!hasPermission(target,permission)||hasPermission(actor,permission));
  if(isAdministrator(target.role) && actor.role!==UserRole.ADMIN)return false;
  return SYSTEM_PERMISSIONS.every(p=>!hasPermission(target,p.key)||hasPermission(actor,p.key));
}
