// Disposable local preview for browser QA. Never connects to the real CRM database.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const directory = await mkdtemp(path.join(tmpdir(), 'crm-browser-test-'));
const previewPort = Number(process.env.PREVIEW_API_PORT || 5000);
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'local-browser-test-secret-do-not-use-in-production';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27028/crm_browser_test';
process.env.UPLOAD_DIR = path.join(directory, 'uploads');
const mongo = spawn(process.env.MONGOD_BINARY || (process.platform === 'win32' ? 'C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe' : 'mongod'),
  ['--dbpath', directory, '--port', '27028', '--bind_ip', '127.0.0.1', '--logpath', path.join(directory, 'mongo.log')], { windowsHide: true, stdio: 'ignore' });
let ready = false;
for (let i = 0; i < 30; i++) {
  try { await mongoose.connect(process.env.MONGODB_URI, {serverSelectionTimeoutMS: 500}); ready = true; break; } catch { /* wait for isolated database */ }
}
if (!ready) throw new Error('Could not start the disposable preview database');
const { User, Track, ServiceCategory, Role, Lead, Customer } = await import('../src/models/index.js');
const track = await Track.create({name:'فريق الاختبار',nameEn:'Web development',slug:'qa'});
await ServiceCategory.create({name:'خدمة اختبار المتصفح',nameEn:'Website design',slug:'qa',trackId:track._id,
  dynamicFormFields:[{name:'pages',label:'عدد الصفحات',labelEn:'Number of pages',type:'number',required:true},
    {name:'style',label:'شكل التصميم',labelEn:'Visual style',type:'select',options:['بسيط','رسمي'],optionLabelsEn:{'بسيط':'Simple','رسمي':'Formal'}}]});
const passwordHash = await bcrypt.hash('Preview123!',10);
await User.create({name:'مدير الاختبار',email:'admin@preview.test',passwordHash,role:'ADMIN'});
const previewEngineer=await User.create({name:'مهندس الاختبار',email:'engineer@preview.test',passwordHash,role:'ENGINEER',trackId:track._id});
await User.create({name:'موظف الاستقبال',email:'marketing@preview.test',passwordHash,role:'MARKETING'});
const previewLeader=await User.create({name:'قائد الفريق',email:'leader@preview.test',passwordHash,role:'TEAM_LEADER',trackId:track._id});
await User.create({name:'حساب محمي',email:'protected@preview.test',passwordHash,role:'SUPER_ADMIN'});
for(const [slug,name,permissions] of [['ADMIN','مدير',[]],['ENGINEER','مهندس',['routing:receive','leads:view_own','leads:edit_technical']],['TEAM_LEADER','قائد فريق',['routing:receive','leads:view_own','leads:edit_technical','leads:view_track']],['MARKETING','تسويق',['voice:review']],['SUPER_ADMIN','حساب محمي',[]]] as [string,string,string[]][]) await Role.create({slug,name,permissions,isSystem:true,permissionCatalogVersion:2});
const limitedRole=await Role.create({name:'مسؤول كاتلوج',slug:'CATALOG',permissions:['services:manage'],isSystem:false});
await User.create({name:'مسؤول الكاتلوج',email:'catalog@preview.test',passwordHash,role:'CATALOG',roleId:limitedRole._id,permissions:limitedRole.permissions,permissionsSource:'ROLE'});
const peer=await User.create({name:'مهندس الواجهات',email:'peer@preview.test',passwordHash,role:'ENGINEER',trackId:track._id});
await Track.updateOne({_id:track._id},{$set:{teamLeaderId:previewLeader._id}});
const designTrack=await Track.create({name:'فريق التصميم',nameEn:'Design',slug:'qa-design'});
const designer=await User.create({name:'مهندس التصميم',email:'designer@preview.test',passwordHash,role:'ENGINEER',trackId:designTrack._id});
const designService=await ServiceCategory.create({name:'هوية بصرية',nameEn:'Brand identity',slug:'qa-design',trackId:designTrack._id,dynamicFormFields:[]});
const webService=await ServiceCategory.findOne({slug:'qa'});
const customer=await Customer.create({name:'عميل المشروع التجريبي',phone:'01011112222',phoneNormalized:'+201011112222',country:'مصر'});
const common={customerId:customer._id,customerName:customer.name,phone:customer.phone,phoneNormalized:customer.phoneNormalized,country:'مصر',leadSource:'ترشيح من شخص',currency:'EGP',intakeChannel:'PUBLIC_CUSTOMER_PORTAL',privacyAcceptedAt:new Date(),contactAcceptedAt:new Date()};
const parent=await Lead.create({...common,leadCode:'#LD-20001',projectName:'إطلاق مشروع جديد',projectDescription:'موقع تعريفي وهوية بصرية بنطاق مستقل لكل فريق.',departmentIds:[track._id,designTrack._id],serviceIds:[webService!._id,designService._id],isBundleParent:true,status:'ON_HOLD'});
const web=await Lead.create({...common,leadCode:'#LD-20002',parentRequestId:parent._id,parentRequestCode:parent.leadCode,projectName:'الموقع التعريفي',projectDescription:'بناء موقع تعريفي يعرض الخدمات ويستقبل طلبات التواصل. يشمل لوحة لإدارة المحتوى.',trackId:track._id,departmentIds:[track._id],serviceIds:[webService!._id],currentServiceId:webService!._id,assignedEngineerId:previewEngineer._id,assignedAt:new Date(),acknowledgedAt:new Date(),contactConfirmedAt:new Date(),status:'QUALIFIED',estimatedBudget:15000,technicalIntake:{isCompleted:true,projectScope:'موقع عربي وإنجليزي متجاوب مع نموذج تواصل وإدارة المحتوى.',deliverables:['واجهات الموقع للموبايل والكمبيوتر','لوحة لإدارة المحتوى','اختبار وتسليم ملفات المشروع'],agreedBudget:15000,currency:'EGP',estimatedDuration:'ثلاثة أسابيع'},serviceRequirements:{[webService!.id]:{pages:5,style:'بسيط'}},serviceQuestionsSnapshot:{[webService!.id]:webService!.dynamicFormFields}});
await Lead.create({...common,leadCode:'#LD-20003',parentRequestId:parent._id,parentRequestCode:parent.leadCode,projectName:'الهوية البصرية',projectDescription:'تصميم الشعار والألوان وملفات الهوية فقط. هذا الجزء خاص بفريق التصميم.',trackId:designTrack._id,departmentIds:[designTrack._id],serviceIds:[designService._id],assignedEngineerId:designer._id,status:'NEW',estimatedBudget:7000});
await Lead.create({...common,leadCode:'#LD-20004',customerName:'طلب يحتاج توجيهًا',projectDescription:'عندي مشروع صغير ومحتاج أحد يساعدني أحدد الخدمات المناسبة.',needsAssessment:true,status:'NEW'});
const {ExecutionRoom,ExecutionMessage}=await import('../src/models/ExecutionRoom.js');
const room=await ExecutionRoom.create({leadId:web._id,trackId:track._id,requesterId:previewEngineer._id,leaderId:previewLeader._id,memberIds:[previewEngineer._id],requestMessage:'محتاج مهندس واجهات يشاركني تنفيذ الموقع وتسليمه حسب النطاق المعتمد.',status:'REQUESTED'});
await ExecutionMessage.create({roomId:room._id,kind:'SYSTEM',text:'تم طلب فريق تنفيذ للموقع. في انتظار اعتماد التيم ليدر.'});
const app = (await import('../src/server.js')).default;
await (await import('../src/services/permission-catalog.service.js')).upgradePermissionCatalog();
const server = app.listen(previewPort,'127.0.0.1',()=>console.log(`Disposable preview ready on port ${previewPort}. Accounts: admin@preview.test / engineer@preview.test; password Preview123!`));
let stopping = false;
async function cleanup() {
  if (stopping) return; stopping = true;
  server.closeAllConnections(); await new Promise<void>(resolve => server.close(()=>resolve()));
  await mongoose.disconnect(); mongo.kill(); await once(mongo,'exit');
  if (path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(directory).startsWith('crm-browser-test-')) await rm(directory,{recursive:true,force:true});
  process.exit(0);
}
process.on('SIGINT',cleanup); process.on('SIGTERM',cleanup);
