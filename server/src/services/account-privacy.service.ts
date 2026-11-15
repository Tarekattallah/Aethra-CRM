import { IUser, User, UserRole } from '../models/User.js';
// Redact protected-account references from JSON responses, including nested audit snapshots.
// Original audit records remain intact and are visible to the protected account itself.
export async function installAccountPrivacy(user:IUser,res:any) {
  if(user.role===UserRole.SUPER_ADMIN)return;
  const hidden=await User.find({role:UserRole.SUPER_ADMIN}).select('_id name email roleId').lean();
  const ids=new Set(hidden.flatMap(u=>[String(u._id),...(u.roleId?[String(u.roleId)]:[])]));
  const redact=(value:any):any=>{
    if(value==null)return value;
    if(typeof value==='string'){if(ids.has(value))return undefined;if(value==='SUPER_ADMIN')return 'SYSTEM';return value;}
    if(Array.isArray(value))return value.filter(v=>!v||(!ids.has(String(v._id||v.id||''))&&v.role!=='SUPER_ADMIN'&&v.slug!=='SUPER_ADMIN'&&v.userRole!=='SUPER_ADMIN')).map(redact);
    if(typeof value==='object'){
      const plain=value.toJSON?value.toJSON():value;
      if(typeof plain!=='object')return redact(String(plain));
      if(ids.has(String(plain._id||plain.id||'')))return {name:'إدارة النظام'};
      if(ids.has(String(plain.submittedByUserId?._id||plain.submittedByUserId||'')))plain.marketingEmployeeName='إدارة النظام';
      const actor=hidden.find(user=>String(user._id)===String(plain.userId?._id||plain.userId||''));
      if(actor){for(const key of ['content','title','details'])if(typeof plain[key]==='string')plain[key]=plain[key].split(actor.name).join('إدارة النظام');}
      return Object.fromEntries(Object.entries(plain).map(([key,v])=>[key,redact(v)]).filter(([,v])=>v!==undefined));
    }
    return value;
  };
  const original=res.json.bind(res);res.json=(body:any)=>original(redact(body));
}
