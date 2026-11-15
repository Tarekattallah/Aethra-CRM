import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Server } from 'node:http';
import ExcelJS from 'exceljs';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-over-thirty-two-characters';
let mongo: ChildProcess | undefined;
let directory: string;
let server: Server;
let base: string;
let Customer: any, User: any, Lead: any, Track: any, ServiceCategory: any, AuditLog: any, Notification: any;
let governance: any;
let admin: any, engineer: any, other: any, leader: any, staff: any, custom: any, track: any, service: any;
let lead: any;

async function freePort(): Promise<number> {
  const socket = net.createServer();
  socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = (socket.address() as net.AddressInfo).port;
  await new Promise<void>(resolve => socket.close(() => resolve())); return port;
}
function token(user: any): string { return jwt.sign({ id: user._id.toString(), authVersion: user.authVersion || 0 }, process.env.JWT_SECRET!); }
async function api(route: string, method = 'GET', body?: any, user?: any) {
  const response = await fetch(base + route, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(user ? { Authorization: `Bearer ${token(user)}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data: any = await response.json();
  return { status: response.status, data, response };
}
const input = (phone = '01012345678') => ({customerName: 'عميل اختبار', phone, country: 'مصر'});
const simpleIntake = (phone = '01088443322') => ({ ...input(phone), intakeVersion: 3, intakeMode: 'QUICK',
  phoneCountryCode: 'EG', projectDescription: 'مشروع صغير ومحتاج مساعدة أبدأ بيه', privacyAccepted: true, contactAccepted: true });

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'crm-review-test-'));
  process.env.UPLOAD_DIR = path.join(directory, 'uploads');
  const port = await freePort();
  const executable = process.env.MONGOD_BINARY || (process.platform === 'win32' ? 'C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe' : 'mongod');
  mongo = spawn(executable, ['--dbpath', directory, '--bind_ip', '127.0.0.1', '--port', String(port), '--logpath', path.join(directory, 'mongo.log')], { windowsHide: true, stdio: 'ignore' });
  let startupError: Error | undefined;
  mongo.on('error', error => { startupError = error; });
  process.env.MONGODB_URI = `mongodb://127.0.0.1:${port}/crm_review_test`;
  for (let i = 0; i < 60; i++) {
    if (startupError) throw startupError;
    try { await mongoose.connect(process.env.MONGODB_URI, {serverSelectionTimeoutMS: 500}); break; }
    catch { if (i === 59) throw new Error('Test MongoDB failed to start'); }
  }
  const app = (await import('../src/server.js')).default;
  ({ Customer, User, Lead, Track, ServiceCategory, AuditLog, Notification } = await import('../src/models/index.js'));
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  track = await Track.create({name: 'تراك اختبار', slug: 'test'});
  service = await ServiceCategory.create({name: 'خدمة اختبار', slug: 'test-service', trackId: track._id});
  const passwordHash = await bcrypt.hash('Testing123!', 4);
  const makeUser = (role: string, name: string) => User.create({name, email: `${name}@test.example`, passwordHash, role, trackId: track._id});
  admin = await makeUser('ADMIN','admin'); engineer = await makeUser('ENGINEER','engineer'); other = await makeUser('ENGINEER','other');
  leader = await makeUser('TEAM_LEADER','leader'); staff = await makeUser('MARKETING','staff'); custom = await makeUser('CUSTOM','custom');
  governance=await User.create({name:'إدارة المنظومة التجريبية',email:'governance@test.example',passwordHash,role:'GOVERNANCE',permissions:(await import('../src/utils/permissions.js')).SYSTEM_PERMISSIONS.map(p=>p.key),permissionsSource:'CUSTOM'});
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${(server.address() as net.AddressInfo).port}`;
}, {timeout: 60000});

after(async () => {
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  await mongoose.disconnect();
  if (mongo?.pid) { mongo.kill(); await once(mongo, 'exit').catch(() => {}); }
  // Only this test's newly created directory may be removed.
  const expectedRoot = path.resolve(tmpdir()) + path.sep;
  if (directory && path.resolve(directory).startsWith(expectedRoot) && path.basename(directory).startsWith('crm-review-test-')) await rm(directory, {recursive: true, force: true});
});

test('public form creates a routed lead and exposes only its tracking code', async () => {
  const result = await api('/api/public/leads','POST',{...input(), initialServiceId: service.id, initialRequirements: {scope: 'new'}});
  assert.equal(result.status,201,JSON.stringify(result.data));
  assert.deepEqual(Object.keys(result.data.data.lead), ['leadCode']);
  lead = await Lead.findOne({leadCode: result.data.data.lead.leadCode});
  assert.equal(String(lead.trackId), track.id);
  assert.ok(lead.assignedEngineerId); assert.ok(lead.slaAcknowledgeDeadline);
  engineer = await User.findById(lead.assignedEngineerId);
  other = await User.findOne({role: 'ENGINEER', _id: {$ne: engineer._id}});
});

test('repeat inquiry creates an independent request without changing the previous contract', async () => {
  lead.projectDescription = 'original'; lead.estimatedBudget = 900; await lead.save();
  const result = await api('/api/public/leads','POST',{...input(), projectDescription: 'untrusted rewrite', estimatedBudget: 1});
  assert.equal(result.status,201); assert.deepEqual(Object.keys(result.data.data.lead),['leadCode']);
  assert.notEqual(result.data.data.lead.leadCode, lead.leadCode);
  const fresh = await Lead.findById(lead._id); assert.equal(fresh.projectDescription,'original'); assert.equal(fresh.estimatedBudget,900); assert.equal(fresh.repeatCount,0);
  const next = await Lead.findOne({leadCode: result.data.data.lead.leadCode});
  assert.equal(String(next.customerId), String(fresh.customerId)); assert.equal(next.projectDescription,'untrusted rewrite'); assert.equal(next.estimatedBudget,1);
  const profile = await Customer.findById(fresh.customerId); assert.equal(profile.name, 'عميل اختبار');
});

test('detail/activity access is scoped and unknown roles fail closed', async () => {
  for (const user of [other,staff,custom]) {
    assert.equal((await api(`/api/leads/${lead.id}`,'GET',undefined,user)).status,403);
    assert.equal((await api(`/api/leads/${lead.id}/activities`,'GET',undefined,user)).status,403);
    assert.equal((await api(`/api/leads/${lead.id}/activities`,'POST',{type:'NOTE',title:'forbidden'},user)).status,403);
  }
  assert.equal((await api(`/api/leads/${lead.id}`,'GET',undefined,leader)).status,200);
  assert.equal((await api(`/api/leads/${lead.id}/activities`,'POST',{type:'NOTE',title:'read only'},leader)).status,403);
  assert.equal((await api('/api/leads','GET',undefined,custom)).data.data.leads.length,0);
});

test('unassigned filter cannot override an engineer scope', async () => {
  await Lead.create({...input('01098765432'), phoneNormalized:'+201098765432', leadCode:'#LD-90000', leadSource:'test'});
  assert.equal((await api('/api/leads?unassignedOnly=true','GET',undefined,engineer)).data.data.leads.length,0);
});

test('lead filters compose and literal regex searches do not crash', async () => {
  const result = await api(`/api/leads?serviceId=${service.id}&search=عميل`,'GET',undefined,admin);
  assert.ok(result.data.data.leads.every((l:any) => l.currentServiceId?._id === service.id));
  assert.equal((await api('/api/leads?search=%5B&page=bad&limit=-1','GET',undefined,admin)).status,200);
  assert.equal((await api('/api/leads?priority[$ne]=LOW','GET',undefined,admin)).status,400);
  assert.equal((await api('/api/leads/bad-id','GET',undefined,admin)).status,400);
});

test('workflow events cannot be forged through activities', async () => {
  const result = await api(`/api/leads/${lead.id}/activities`,'POST',{type:'PAYMENT_RECEIVED',title:'fake',newStatus:'CONVERTED'},engineer);
  assert.equal(result.status,400);
  const valid = await api(`/api/leads/${lead.id}/activities`,'POST',{type:'NOTE',title:'note',newStatus:'CONVERTED'},engineer);
  assert.equal(valid.status,201); assert.notEqual(valid.data.data.lead.status,'CONVERTED');
  assert.ok(!('ipAddress' in valid.data.data.activity));
});

test('unanswered call does not satisfy contact SLA', async () => {
  assert.equal((await api(`/api/leads/${lead.id}/activities`,'POST',{type:'CALL',title:'no answer',callOutcome:'NO_ANSWER'},engineer)).status,201);
  assert.equal((await Lead.findById(lead._id)).firstContactedAt,undefined);
});

test('manual reassignment renews SLA and rejects non-engineer targets', async () => {
  assert.equal((await api(`/api/leads/${lead.id}/reassign`,'POST',{targetEngineerId:staff.id,reason:'test'},admin)).status,400);
  await api(`/api/leads/${lead.id}/acknowledge`,'POST',{},engineer);
  assert.equal((await api(`/api/leads/${lead.id}/reassign`,'POST',{targetEngineerId: other.id,reason:'test'},admin)).status,200);
  const fresh = await Lead.findById(lead._id); assert.equal(fresh.acknowledgedAt,undefined); assert.ok(fresh.slaAcknowledgeDeadline > new Date());
  [engineer,other] = [other,engineer];
});

test('acknowledge and contact follow the order and are not repeated', async () => {
  assert.equal((await api(`/api/leads/${lead.id}/confirm-contact`,'POST',{},engineer)).status,400);
  assert.equal((await api(`/api/leads/${lead.id}/acknowledge`,'POST',{},engineer)).status,200);
  assert.equal((await api(`/api/leads/${lead.id}/confirm-contact`,'POST',{},engineer)).status,200);
  assert.equal((await api(`/api/leads/${lead.id}/confirm-contact`,'POST',{},engineer)).status,409);
});

let file: any;

test('MongoDB uploads survive loss of temporary files with private downloads and audio ranges', async () => {
  const previous = process.env.UPLOAD_STORAGE;
  process.env.UPLOAD_STORAGE = 'mongodb';
  try {
    const owner = await User.findById(engineer.id);
    const bytes = Buffer.from('5249464608000000574156456162636465666768', 'hex');
    const form = new FormData(); form.append('file', new Blob([bytes], {type:'audio/wav'}), 'voice.wav');
    const upload = await fetch(base+'/api/upload', {method:'POST', body:form, headers:{Authorization:`Bearer ${token(owner)}`}});
    assert.equal(upload.status,200); const uploaded = (await upload.json() as any).data.file;
    const {Upload} = await import('../src/models/Upload.js');
    const stored = await Upload.findOne({filename:uploaded.filename});
    assert.equal(stored?.storage,'mongodb'); assert.ok(stored?.storageId);
    await assert.rejects(access(path.join(process.env.UPLOAD_DIR!, uploaded.filename)));
    const url = base+'/api/files/'+uploaded.filename;
    assert.equal((await fetch(url)).status,401);
    assert.equal((await fetch(url, {headers:{Authorization:`Bearer ${token(await User.findById(other.id))}`}})).status,404);
    const headers = {Authorization:`Bearer ${token(owner)}`};
    const full = await fetch(url,{headers}); assert.equal(full.status,200);
    assert.deepEqual(Buffer.from(await full.arrayBuffer()),bytes);
    assert.equal(full.headers.get('cache-control'),'private, no-store');
    for (const [range,start,end] of [['bytes=2-6',2,7],['bytes=-4',bytes.length-4,bytes.length],['bytes=12-',12,bytes.length]] as const) {
      const part = await fetch(url,{headers:{...headers,Range:range}}); assert.equal(part.status,206);
      assert.equal(part.headers.get('content-range'),`bytes ${start}-${end-1}/${bytes.length}`);
      assert.deepEqual(Buffer.from(await part.arrayBuffer()), bytes.subarray(start,end));
    }
    for (const range of ['bytes=100-','bytes=8-2','bytes=-0','bytes=0-1,3-5','bytes=-','bytes=abc']) {
      const response = await fetch(url,{headers:{...headers,Range:range}}); assert.equal(response.status,416,range);
      assert.equal(response.headers.get('content-range'),`bytes */${bytes.length}`);
    }
    const head = await fetch(url,{method:'HEAD',headers}); assert.equal(head.status,200); assert.equal(head.headers.get('content-length'),String(bytes.length));
  } finally { if (previous === undefined) delete process.env.UPLOAD_STORAGE; else process.env.UPLOAD_STORAGE=previous; }
});
test('uploads preserve the public flow while protecting downloads and ownership', async () => {
  const form = new FormData(); form.append('file',new Blob(['%PDF-1.7\nCRM test'],{type:'application/pdf'}),'receipt.pdf');
  const uploaded = await fetch(base+'/api/upload',{method:'POST',body:form,headers:{Authorization:`Bearer ${token(engineer)}`}});
  assert.equal(uploaded.status,200); file = (await uploaded.json() as any).data.file;
  assert.equal((await fetch(base+file.url)).status,404);
  const url = base+file.url.replace('/uploads/','/api/files/');
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url,{headers:{Authorization:`Bearer ${token(other)}`}})).status,404);
  assert.equal((await fetch(url,{headers:{Authorization:`Bearer ${token(engineer)}`}})).status,200);
  assert.equal((await api(`/api/leads/${lead.id}/technical-intake`,'POST',{projectScope:'scope',chatAttachments:[{...file,uploadToken:undefined}]},other)).status,403);
});

test('technical intake, payment and financial immutability work together', async () => {
  assert.equal((await api(`/api/leads/${lead.id}/confirm-payment`,'POST',{amount:-10,receiptUrl:file.url},engineer)).status,400);
  assert.equal((await api(`/api/leads/${lead.id}/confirm-payment`,'POST',{amount:100,receiptUrl:file.url},engineer)).status,400);
  assert.equal((await api(`/api/leads/${lead.id}/technical-intake`,'POST',{projectScope:'scope',agreedBudget:0},engineer)).status,200);
  assert.equal((await Lead.findById(lead.id)).technicalIntake.agreedBudget,0);
  const payment = await api(`/api/leads/${lead.id}/confirm-payment`,'POST',{amount:100,currency:'EGP',receiptUrl:file.url},engineer);
  assert.equal(payment.status,200,JSON.stringify(payment.data)); assert.equal(payment.data.data.lead.status,'CONVERTED'); assert.equal(payment.data.data.lead.currency,'EGP');
  assert.equal((await api(`/api/leads/${lead.id}/confirm-payment`,'POST',{amount:200,receiptUrl:file.url},engineer)).status,409);
  assert.equal((await api(`/api/leads/${lead.id}/technical-intake`,'POST',{projectScope:'rewrite'},engineer)).status,400);
});

test('non-admin detail and activity responses omit device metadata', async () => {
  const result = await api(`/api/leads/${lead.id}`,'GET',undefined,engineer);
  assert.ok(result.data.data.activities.every((a:any) => !('ipAddress' in a) && !('deviceSummary' in a)));
});

test('reading an empty audit filter creates no fabricated records', async () => {
  const before = await AuditLog.countDocuments();
  assert.equal((await api('/api/audit-logs?action=NONEXISTENT','GET',undefined,governance)).status,200);
  assert.equal(await AuditLog.countDocuments(),before);
  assert.equal((await api('/api/audit-logs','GET',undefined,engineer)).status,403);
});

test('mark all notifications read uses the actual PATCH route', async () => {
  await Notification.create({userId:engineer._id,type:'NEW_LEAD_ASSIGNED',title:'test',message:'test'});
  assert.equal((await api('/api/notifications/read-all','PATCH',{},engineer)).status,200);
  assert.equal(await Notification.countDocuments({userId:engineer._id,isRead:false}),0);
});

test('invalid settings and self lockout are rejected', async () => {
  assert.equal((await api('/api/settings','PATCH',{slaAcknowledgeMinutes:-1},governance)).status,400);
  assert.equal((await api(`/api/admin/users/${governance.id}`,'PUT',{isActive:false},governance)).status,400);
  assert.equal((await api('/api/auth/login','POST',{email:{$ne:null},password:'x'})).status,400);
});

test('SSE authentication rejects disabled accounts even with a signed JWT', async () => {
  await User.updateOne({_id:other._id},{$set:{isActive:false}});
  assert.equal((await fetch(base+'/api/notifications/stream',{headers:{Authorization:`Bearer ${token(other)}`}})).status,403);
  await User.updateOne({_id:other._id},{$set:{isActive:true}});
});

test('reports separate currencies and the Excel export can be parsed', async () => {
  await Lead.create({...input('01112345678'),phoneNormalized:'+201112345678',leadCode:'#LD-90001',leadSource:'test',status:'CONVERTED',currency:'USD',conversionValue:20});
  const report = await api('/api/reports/dashboard','GET',undefined,admin);
  assert.equal(report.status,200); assert.equal(report.data.data.kpis.totalRevenue,null);
  assert.deepEqual(report.data.data.kpis.revenueByCurrency.sort((a:any,b:any)=>a.currency.localeCompare(b.currency)),[{currency:'EGP',amount:100},{currency:'USD',amount:20}]);
  const response = await fetch(base+'/api/reports/export',{headers:{Authorization:`Bearer ${token(admin)}`}});
  assert.equal(response.status,200);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as any);
  assert.ok(workbook.worksheets[0].rowCount >= 4);
});

test('counter initialization and concurrent increments stay unique', async () => {
  const { Counter, getNextSequence } = await import('../src/models/Counter.js');
  await Counter.deleteOne({_id:'leadCode'});
  const sequences = await Promise.all(Array.from({length:20},()=>getNextSequence('leadCode')));
  assert.equal(new Set(sequences).size,20); assert.ok(Math.min(...sequences) > 90001);
});

test('automatic SLA reassignment renews deadlines and records the correct reason', async () => {
  const { checkAndReassignStaleLeads } = await import('../src/services/sla.service.js');
  const stale = await Lead.create({...input('01212345678'),phoneNormalized:'+201212345678',leadCode:'#LD-99999',leadSource:'test',trackId:track._id,assignedEngineerId:engineer._id,
    acknowledgedAt:new Date(Date.now()-600000),slaContactDeadline:new Date(Date.now()-60000)});
  assert.equal(await checkAndReassignStaleLeads(),1);
  const fresh = await Lead.findById(stale.id); assert.notEqual(String(fresh.assignedEngineerId),engineer.id); assert.equal(fresh.acknowledgedAt,undefined); assert.ok(fresh.slaAcknowledgeDeadline > new Date());
  const {LeadActivity} = await import('../src/models/LeadActivity.js');
  assert.match((await LeadActivity.findOne({leadId:stale._id,type:'SLA_TIMEOUT_TRANSFER'}))!.content!,/التواصل/);
});

test('concurrent public inquiries share one customer and receive separate request codes', async () => {
  const results = await Promise.all(Array.from({length:6},()=>api('/api/public/leads','POST',input('01512345678'))));
  assert.ok(results.every(r => [200,201].includes(r.status)),JSON.stringify(results));
  const inquiries = await Lead.find({phoneNormalized:'+201512345678'});
  assert.equal(inquiries.length,6);
  assert.equal(new Set(inquiries.map((item:any) => item.leadCode)).size,6);
  assert.equal(new Set(inquiries.map((item:any) => String(item.customerId))).size,1);
  assert.equal(await Customer.countDocuments({phoneNormalized:'+201512345678'}),1);
});

test('multi-service intake keeps answers separate and waits for review across departments', async () => {
  const secondTrack = await Track.create({name:'تصميم',slug:'intake-design'});
  const first = await ServiceCategory.create({name:'تطوير موقع',slug:'intake-web',trackId:track._id,dynamicFormFields:[{name:'scope',label:'عدد الصفحات',type:'number',required:true}]});
  const second = await ServiceCategory.create({name:'هوية بصرية',slug:'intake-brand',trackId:secondTrack._id,dynamicFormFields:[{name:'scope',label:'اسم البراند',type:'text',required:true}]});
  const payload = {...input('01088776655'),intakeVersion:2,email:'intake@test.example',companyName:'شركة اختبار',projectName:'متجر وهوية',projectDescription:'إطلاق متجر جديد',mainGoal:'زيادة المبيعات',
    projectTypes:['COMPLETE_SOLUTION'],serviceSelection:'SELECTED',serviceIds:[first.id,second.id],departmentIds:[track.id,secondTrack.id],
    serviceRequirements:{[first.id]:{scope:5},[second.id]:{scope:'براند'}},privacyAccepted:true,contactAccepted:true,budgetRange:'5000_15000',currency:'EGP'};
  const invalid = await api('/api/public/leads','POST',{...payload, serviceRequirements:{[first.id]:{scope:'wrong'},[second.id]:{scope:'brand'}}});
  assert.equal(invalid.status,400);
  const response = await api('/api/public/leads','POST',payload);
  assert.equal(response.status,201,JSON.stringify(response.data));
  const request = await Lead.findOne({leadCode:response.data.data.lead.leadCode});
  assert.equal(request.serviceIds.length,2); assert.equal(request.departmentIds.length,2);
  assert.equal(request.serviceRequirements[first.id].scope,5); assert.equal(request.serviceRequirements[second.id].scope,'براند');
  assert.equal(request.assignedEngineerId,null); assert.equal(request.slaAcknowledgeDeadline,undefined); assert.equal(request.needsAssessment,true);
  assert.ok(request.privacyAcceptedAt); assert.ok(request.contactAcceptedAt);
  const detail = await api(`/api/leads/${request.id}`,'GET',undefined,admin);
  assert.equal(detail.data.data.lead.serviceIds[1].name,'هوية بصرية');
  const filtered = await api(`/api/leads?trackId=${secondTrack.id}&serviceId=${second.id}`,'GET',undefined,admin);
  assert.ok(filtered.data.data.leads.some((item:any) => item._id === request.id));
  const publicCatalog = await api('/api/public/services');
  assert.ok(publicCatalog.data.data.departments.some((item:any) => item._id === secondTrack.id));
  assert.equal((await api('/api/public/leads','POST',{...payload,privacyAccepted:false})).status,400);
  assert.equal((await api('/api/public/leads','POST',{...payload,preferredStartDate:'2027-02-10',expectedDeadline:'2027-02-01'})).status,400);
  assert.equal((await api('/api/public/leads','POST',{...payload,serviceIds:[new mongoose.Types.ObjectId().toString()]})).status,400);
  assert.equal((await api('/api/public/leads','POST',{...payload,websiteUrl:'javascript:alert(1)'})).status,400);
  await Track.updateOne({_id:secondTrack._id},{$set:{isActive:false}});
  assert.equal((await api('/api/public/leads','POST',payload)).status,400);
});

test('undecided and custom requests can be submitted without a service', async () => {
  for (const serviceSelection of ['NOT_SURE','OTHER']) {
    const result = await api('/api/public/leads','POST',{...input('01099887766'),intakeVersion:2,email:'unsure@test.example',projectName:'مساعدة',projectDescription:'مشروع جديد',mainGoal:'تطوير النشاط',projectTypes:['CONSULTATION'],serviceSelection,otherService:serviceSelection === 'OTHER' ? 'خدمة مخصصة' : '',privacyAccepted:true,contactAccepted:true});
    assert.equal(result.status,201,JSON.stringify(result.data));
    const request = await Lead.findOne({leadCode:result.data.data.lead.leadCode});
    assert.equal(request.assignedEngineerId,null); assert.equal(request.needsAssessment,true);
  }
});

test('customer directory is private and filters requests by customer without broadening scope', async () => {
  for (const account of [undefined,engineer,staff,custom,leader]) assert.equal((await api('/api/customers','GET',undefined,account)).status,account ? 403 : 401);
  const directory = await api('/api/customers?search=01012345678','GET',undefined,admin);
  assert.equal(directory.status,200); assert.equal(directory.data.data.customers.length,1);
  const profile = directory.data.data.customers[0]; assert.equal(profile.requestCount,2);
  const requests = await api(`/api/leads?customerId=${profile._id}`,'GET',undefined,admin);
  assert.equal(requests.data.data.pagination.total,2);
  assert.ok(requests.data.data.leads.every((item:any) => item.customerId === profile._id));
  const scoped = await api(`/api/leads?customerId=${profile._id}`,'GET',undefined,other);
  assert.ok(scoped.data.data.leads.every((item:any) => item.assignedEngineerId?._id === other.id));
  assert.equal((await api('/api/leads?customerId=invalid','GET',undefined,admin)).status,400);
});

test('legacy backfill is additive and idempotent and retains merged history', async () => {
  const legacy = await Lead.create({...input('01133779955'),phoneNormalized:'+201133779955',leadCode:'#LD-300001',leadSource:'legacy',projectDescription:'قديم',estimatedBudget:500,status:'CONVERTED',conversionValue:500,isDuplicate:true,repeatCount:3});
  const originalUpdatedAt = legacy.updatedAt.getTime();
  const { backfillCustomerProfiles } = await import('../src/services/customer.service.js');
  assert.ok(await backfillCustomerProfiles() >= 1);
  const fresh = await Lead.findById(legacy.id);
  assert.ok(fresh.customerId); assert.equal(fresh.repeatCount,3); assert.equal(fresh.conversionValue,500); assert.equal(fresh.updatedAt.getTime(),originalUpdatedAt);
  const customerCount = await Customer.countDocuments();
  assert.equal(await backfillCustomerProfiles(),0); assert.equal(await Customer.countDocuments(),customerCount);
  const next = await api('/api/public/leads','POST',input('01133779955'));
  const request = await Lead.findOne({leadCode:next.data.data.lead.leadCode}); assert.equal(String(request.customerId),String(fresh.customerId));
});

test('routing respects track boundaries and concurrent daily capacity', async () => {
  const emptyTrack = await Track.create({name:'empty',slug:'empty'});
  const created = await api('/api/public/leads','POST',{...input('01087654321'),trackId:emptyTrack.id});
  assert.equal(created.status,201);
  assert.equal((await Lead.findOne({leadCode:created.data.data.lead.leadCode})).assignedEngineerId,null);
  const limitedTrack = await Track.create({name:'limited',slug:'limited'});
  const specialist = await User.create({name:'limited',email:'limited@test.example',passwordHash:'test',role:'ENGINEER',trackId:limitedTrack._id,maxDailyLeads:1});
  const results = await Promise.all(['01187654321','01287654321'].map(phone=>api('/api/public/leads','POST',{...input(phone),trackId:limitedTrack.id})));
  assert.ok(results.every(r=>r.status===201));
  assert.equal(await Lead.countDocuments({assignedEngineerId:specialist._id}),1);
});

test('browser login sets an HttpOnly cookie and returns a consistent user ID', async () => {
  const login = await api('/api/auth/login','POST',{email:engineer.email,password:'Testing123!'});
  assert.equal(login.status,200); assert.match(login.response.headers.get('set-cookie')!,/HttpOnly/);
  const me = await api('/api/auth/me','GET',undefined,engineer);
  assert.equal(me.data.data.user.id,engineer.id); assert.ok(!('passwordHash' in me.data.data.user));
  const response = await fetch(base+file.url.replace('/uploads/','/api/files/'), {headers:{Cookie:login.response.headers.get('set-cookie')!.split(';')[0]}});
  assert.equal(response.status,200);
  assert.equal((await fetch(base+`/api/notifications/stream?token=${token(engineer)}`)).status,401);
});

test('phone validation handles Arabic digits and rejects invalid numbers', async () => {
  const {normalizePhoneNumber} = await import('../src/utils/phone.util.js');
  assert.equal(normalizePhoneNumber('٠١٠١٢٣٤٥٦٧٨','مصر'),'+201012345678');
  assert.equal(normalizePhoneNumber('00201012345678','مصر'),'+201012345678');
  assert.equal((await api('/api/public/leads','POST',input('invalid-number'))).status,400);
});

test('business day starts at Cairo midnight independent of server timezone', async () => {
  const {startOfBusinessDay} = await import('../src/utils/business-time.js');
  assert.equal(startOfBusinessDay(new Date('2026-11-13T00:30:00Z')).toISOString(),'2026-11-12T22:00:00.000Z');
});

test('public upload capabilities cannot be replaced with someone else\'s URL', async () => {
  const form = new FormData(); form.append('file',new Blob(['%PDF-1.7\npublic test']),'public.pdf');
  const response = await fetch(base+'/api/upload',{method:'POST',body:form});
  assert.equal(response.status,200); const uploaded = (await response.json() as any).data.file;
  const denied = await api('/api/public/leads','POST',{...input('01077778888'),attachments:[{filename:uploaded.filename,url:uploaded.url}]});
  assert.equal(denied.status,403);
  assert.equal((await api('/api/public/leads','POST',{...input('01077778888'),attachments:[uploaded]})).status,201);
  const fake = new FormData(); fake.append('file',new Blob(['<script>test</script>']),'fake.pdf');
  assert.equal((await fetch(base+'/api/upload',{method:'POST',body:fake})).status,400);
});

test('first SuperAdmin can be initialized with a new account and a working password', async () => {
  const {bootstrapSuperAdmin} = await import('../src/services/superadmin.service.js');
  const result = await bootstrapSuperAdmin('owner@test.example','OwnerTesting123!secure');
  governance=result.user;
  assert.equal(result.created,true); assert.equal(result.user.role,'SUPER_ADMIN');
  assert.ok(await bcrypt.compare('OwnerTesting123!secure',result.user.passwordHash));
  const login = await api('/api/auth/login','POST',{email:'owner@test.example',password:'OwnerTesting123!secure'});
  assert.equal(login.status,200); assert.equal(login.data.data.user.role,'SUPER_ADMIN');
  assert.equal((await bootstrapSuperAdmin('owner@test.example')).unchanged,true);
  await assert.rejects(bootstrapSuperAdmin('another-owner@test.example','AnotherOwnerTesting123!'),/already exists/);
});

test('SuperAdmin bypasses every role and permission gate', async () => {
  const {requireRole,requirePermission} = await import('../src/middlewares/auth.middleware.js');
  const {UserRole} = await import('../src/models/User.js');
  for (const middleware of [requireRole(UserRole.ENGINEER),requireRole(UserRole.STAFF),requireRole(UserRole.TEAM_LEADER),requirePermission('future:permission')]) {
    let allowed = false;
    middleware({user:{role:'SUPER_ADMIN',permissions:[]}} as any, {status:()=>{throw new Error('Root access was denied');}} as any, ()=>{allowed=true;});
    assert.ok(allowed);
  }
});

test('SuperAdmin can access administration and cannot be managed by an ordinary Admin', async () => {
  const root = await User.create({name:'SuperAdmin test',email:'root@test.example',passwordHash:await bcrypt.hash('RootTesting123!',4),role:'SUPER_ADMIN'});
  const session=await api('/api/auth/login','POST',{email:root.email,password:'RootTesting123!'});
  assert.equal(session.data.data.user.administrator,true);assert.equal(session.data.data.user.canManageProtectedAccounts,true);
  assert.equal((await api('/api/admin/users','GET',undefined,root)).status,200);
  assert.equal((await api('/api/reports/dashboard','GET',undefined,root)).status,200);
  assert.equal((await api('/api/audit-logs','GET',undefined,root)).status,200);
  assert.equal((await api(`/api/admin/users/${root.id}`,'PUT',{name:'changed'},admin)).status,403);
  assert.equal((await api(`/api/admin/users/${root.id}`,'DELETE',undefined,admin)).status,403);
  assert.equal((await api(`/api/admin/users/${admin.id}`,'PUT',{role:'SUPER_ADMIN'},admin)).status,403);
  assert.equal((await api('/api/admin/users','POST',{name:'forged root',email:'forged@test.example',password:'ForgedTesting123!',role:'SUPER_ADMIN'},admin)).status,403);
  assert.equal((await api(`/api/leads/${lead.id}`,'GET',undefined,root)).status,200);
});

test('resetting a password revokes tokens issued before the reset', async () => {
  const account = await User.create({name:'reset test',email:'reset@test.example',passwordHash:await bcrypt.hash('BeforeReset123!',4),role:'ENGINEER'});
  const login = await api('/api/auth/login','POST',{email:account.email,password:'BeforeReset123!'});
  const oldToken = login.data.data.token;
  assert.equal((await api(`/api/admin/users/${account.id}`,'PUT',{password:'AfterReset123!'},governance)).status,200);
  const response = await fetch(base+'/api/auth/me',{headers:{Authorization:`Bearer ${oldToken}`}});
  assert.equal(response.status,401);
  assert.equal((await api('/api/auth/login','POST',{email:account.email,password:'AfterReset123!'})).status,200);
});

test('changing a user role replaces inherited permissions and narrows their data scope', async () => {
  const {Role} = await import('../src/models/Role.js');
  const marketingRole = await Role.create({name:'Marketing role',slug:'MARKETING',permissions:['leads:view_own','leads:create_marketing']});
  const account = await User.create({name:'role test',email:'role-change@test.example',passwordHash:'test',role:'TEAM_LEADER',trackId:track._id,permissions:['leads:view_track']});
  const changed = await api(`/api/admin/users/${account.id}`,'PUT',{role:'MARKETING',roleId:marketingRole.id},governance);
  assert.equal(changed.status,200);
  assert.deepEqual(changed.data.data.user.permissions,['leads:view_own','leads:create_marketing']);
  assert.equal((await api('/api/leads','GET',undefined,await User.findById(account.id))).data.data.leads.length,0);
});

test('reassigning a contacted lead preserves its completed contact stages', async () => {
  const contacted = await Lead.create({...input('01033445566'),phoneNormalized:'+201033445566',leadCode:'#LD-200001',leadSource:'test',trackId:track._id,
    assignedEngineerId:engineer._id,status:'CONTACTED',acknowledgedAt:new Date(),contactConfirmedAt:new Date(),firstContactedAt:new Date()});
  const result = await api(`/api/leads/${contacted.id}/reassign`,'POST',{targetEngineerId:other.id,reason:'handover'},admin);
  assert.equal(result.status,200);
  const fresh = await Lead.findById(contacted.id);
  assert.ok(fresh.acknowledgedAt); assert.ok(fresh.contactConfirmedAt); assert.ok(fresh.firstContactedAt);
});

test('technical scope supports realistic descriptions longer than a short name', async () => {
  const draft = await Lead.create({...input('01033445577'),phoneNormalized:'+201033445577',leadCode:'#LD-200002',leadSource:'test',trackId:track._id,assignedEngineerId:engineer._id});
  const result = await api(`/api/leads/${draft.id}/technical-intake`,'POST',{projectScope:'تفاصيل نطاق المشروع '.repeat(30)},engineer);
  assert.equal(result.status,200,JSON.stringify(result.data));
});

test('role ID alone resolves the role without permitting SuperAdmin escalation', async () => {
  const {Role} = await import('../src/models/Role.js');
  const rootRole = await Role.findOne({slug:'SUPER_ADMIN'});
  assert.equal((await api('/api/admin/users','POST',{name:'bad promotion',email:'bad-root-id@test.example',password:'BadPromotion123!',roleId:rootRole!.id},admin)).status,403);
  const existing = await User.create({name:'id change',email:'role-id-only@test.example',passwordHash:'test',role:'ENGINEER'});
  assert.equal((await api(`/api/admin/users/${existing.id}`,'PUT',{roleId:rootRole!.id},admin)).status,403);
  const marketing = await Role.findOne({slug:'MARKETING'});
  const changed = await api(`/api/admin/users/${existing.id}`,'PUT',{roleId:marketing!.id},governance);
  assert.equal(changed.status,200); assert.equal(changed.data.data.user.role,'MARKETING');
});

test('editing a name preserves explicit permissions and a duplicate email returns 409', async () => {
  const account = await User.create({name:'custom permission',email:'custom-permission@test.example',passwordHash:'test',role:'ENGINEER',permissions:['leads:view_all']});
  const edited = await api(`/api/admin/users/${account.id}`,'PUT',{name:'new name',role:'ENGINEER'},governance);
  assert.equal(edited.status,200); assert.deepEqual(edited.data.data.user.permissions,['leads:view_all']);
  assert.equal((await api(`/api/admin/users/${account.id}`,'PUT',{email:engineer.email},governance)).status,409);
});

test('disable and re-enable does not restore old account sessions', async () => {
  const account = await User.create({name:'reactivation',email:'reactivation@test.example',passwordHash:'test',role:'ENGINEER'});
  const oldToken = token(account);
  await api(`/api/admin/users/${account.id}`,'PUT',{isActive:false},governance);
  await api(`/api/admin/users/${account.id}`,'PUT',{isActive:true},governance);
  const response = await fetch(base+'/api/auth/me',{headers:{Authorization:`Bearer ${oldToken}`}});
  assert.equal(response.status,401);
});

test('multibyte passwords cannot be silently truncated by bcrypt', async () => {
  const invalid = await api('/api/admin/users','POST',{name:'long password',email:'long-pass@test.example',password:'ع'.repeat(40),role:'ENGINEER'},governance);
  assert.equal(invalid.status,400);
});

test('SSE connections are closed when account access is revoked', async () => {
  const {sseHub} = await import('../src/sse/sse.hub.js');
  let ended = 0;
  const response = {write:()=>{},end:()=>{ended++;}} as any;
  sseHub.addClient(engineer.id,response,Date.now()+60000,engineer.authVersion || 0);
  sseHub.disconnectUser(engineer.id); assert.equal(ended,1);
});

test('concurrent initial settings requests create one shared document', async () => {
  assert.equal(mongoose.connection.name,'crm_review_test');
  const {SystemSettings,getSystemSettings} = await import('../src/models/SystemSettings.js');
  await SystemSettings.deleteMany({}); // This suite owns this disposable database.
  const settings = await Promise.all(Array.from({length:12},()=>getSystemSettings()));
  assert.equal(new Set(settings.map(s=>s.id)).size,1);
  assert.equal(await SystemSettings.countDocuments(),1);
});

test('role permission edits update inherited grants and preserve explicit user grants', async () => {
  const {Role} = await import('../src/models/Role.js');
  const role = await Role.create({name:'Observer',slug:'OBSERVER',permissions:['leads:view_all']});
  const inherited = await api('/api/admin/users','POST',{name:'inherited',email:'inherited@test.example',password:'Inherited123!',roleId:role.id},governance);
  const customGrant = await api('/api/admin/users','POST',{name:'custom grant',email:'grant@test.example',password:'CustomGrant123!',roleId:role.id,permissions:['leads:view_own']},governance);
  assert.equal(inherited.status,201); assert.equal(customGrant.status,201);
  const oldToken = token(await User.findById(inherited.data.data.user._id));
  assert.equal((await api(`/api/roles/${role.id}`,'PUT',{permissions:[]},governance)).status,200);
  assert.equal(await AuditLog.countDocuments({action:'ROLE_UPDATED',entityId:role.id}),1);
  assert.deepEqual((await User.findById(inherited.data.data.user._id)).permissions.toObject(),[]);
  assert.deepEqual((await User.findById(customGrant.data.data.user._id)).permissions.toObject(),['leads:view_own']);
  assert.equal((await fetch(base+'/api/auth/me',{headers:{Authorization:`Bearer ${oldToken}`}})).status,401);
});

test('creating and changing a team leader keeps the track relationship consistent', async () => {
  const team = await Track.create({name:'leader management',slug:'leader-management'});
  const result = await api('/api/admin/users','POST',{name:'leader managed',email:'managed-leader@test.example',password:'ManagedLeader123!',role:'TEAM_LEADER',trackId:team.id},governance);
  assert.equal(result.status,201,JSON.stringify(result.data));
  const id = result.data.data.user._id;
  assert.equal(String((await Track.findById(team.id)).teamLeaderId),id);
  assert.equal((await api(`/api/admin/users/${id}`,'PUT',{role:'ENGINEER'},governance)).status,200);
  assert.equal((await Track.findById(team.id)).teamLeaderId,undefined);
});

test('a second leader cannot silently take an occupied track', async () => {
  const team = await Track.create({name:'occupied',slug:'occupied'});
  const first = await api('/api/admin/users','POST',{name:'first leader',email:'first-leader@test.example',password:'FirstLeader123!',role:'TEAM_LEADER',trackId:team.id},governance);
  assert.equal(first.status,201);
  const second = await api('/api/admin/users','POST',{name:'second leader',email:'second-leader@test.example',password:'SecondLeader123!',role:'TEAM_LEADER',trackId:team.id},governance);
  assert.equal(second.status,409);
  assert.equal(await User.countDocuments({email:'second-leader@test.example'}),0);
  assert.equal(String((await Track.findById(team.id)).teamLeaderId),first.data.data.user._id);
});

test('deleting a team leader removes the stale track leader pointer', async () => {
  const account = await User.findOne({email:'first-leader@test.example'});
  assert.equal((await api(`/api/admin/users/${account.id}`,'DELETE',undefined,governance)).status,200);
  assert.equal(await Track.countDocuments({teamLeaderId:account._id}),0);
});

test('concurrent password resets cannot preserve a session from an earlier reset', async () => {
  const account = await User.create({name:'concurrent reset',email:'concurrent-reset@test.example',passwordHash:'test',role:'ENGINEER'});
  const results = await Promise.all(['FirstPassword123!','SecondPassword123!'].map(password=>api(`/api/admin/users/${account.id}`,'PUT',{password},governance)));
  assert.ok(results.every(result=>result.status===200));
  assert.equal((await User.findById(account.id)).authVersion,2);
  const earlier = results.find(result=>result.data.data.user.authVersion===1)!;
  const response = await fetch(base+'/api/auth/me',{headers:{Authorization:`Bearer ${token({...earlier.data.data.user,_id:account._id})}`}});
  assert.equal(response.status,401);
});

test('simple intake accepts personal projects without email, company, services or a budget', async () => {
  const result = await api('/api/public/leads','POST',simpleIntake('٠١٠٨٨٤٤٣٣٢٢'));
  assert.equal(result.status,201,JSON.stringify(result.data));
  assert.deepEqual(Object.keys(result.data.data.lead),['leadCode']);
  const request = await Lead.findOne({leadCode:result.data.data.lead.leadCode});
  assert.equal(request.phoneNormalized,'+201088443322'); assert.equal(request.email,undefined);
  assert.equal(request.companyName,undefined); assert.equal(request.projectName,undefined);
  assert.equal(request.serviceIds.length,0); assert.equal(request.projectTypes.length,0);
  assert.equal(request.intakeMode,'QUICK'); assert.equal(request.serviceSelection,'NOT_SURE');
  assert.equal(request.needsAssessment,true); assert.equal(request.assignedEngineerId,null);
  assert.ok(request.privacyAcceptedAt); assert.ok(request.contactAcceptedAt);
});

test('country dropdown exposes calling codes and normalizes national numbers outside Egypt', async () => {
  const countries = await api('/api/public/countries');
  assert.equal(countries.status,200); assert.ok(countries.data.data.countries.length > 200);
  assert.equal(countries.data.data.countries.find((country:any) => country.code === 'EG').callingCode,'+20');
  assert.equal(countries.data.data.countries.find((country:any) => country.code === 'SA').callingCode,'+966');
  const response = await api('/api/public/leads','POST',{...simpleIntake('0501234567'),country:'المملكة العربية السعودية',phoneCountryCode:'SA'});
  assert.equal(response.status,201,JSON.stringify(response.data));
  const request = await Lead.findOne({leadCode:response.data.data.lead.leadCode});
  assert.equal(request.phoneNormalized,'+966501234567'); assert.equal(request.whatsappNormalized,'+966501234567');
  assert.equal((await api('/api/public/leads','POST',{...simpleIntake(),phoneCountryCode:'ZZ'})).status,400);
});

test('simple intake keeps referral answers and campaign attribution separate', async () => {
  const response = await api('/api/public/leads','POST',{...simpleIntake('01088443323'),referralSource:'FACEBOOK',
    campaignAttribution:{utmSource:'instagram',utmMedium:'social',utmCampaign:'small-projects',utmContent:'post-a',referrerHost:'example.test',landingPath:'/start'}});
  assert.equal(response.status,201,JSON.stringify(response.data));
  const request = await Lead.findOne({leadCode:response.data.data.lead.leadCode});
  assert.equal(request.referralSource,'FACEBOOK'); assert.equal(request.leadSource,'فيسبوك');
  assert.equal(request.campaignAttribution.utmSource,'instagram'); assert.equal(request.campaignName,'small-projects');
  assert.equal(request.campaignAttribution.referrerHost,'example.test');
  assert.equal((await api('/api/public/leads','POST',{...simpleIntake(),referralSource:'INVALID'})).status,400);
});

test('detailed simple intake can defer required service questions to the team', async () => {
  const service = await ServiceCategory.create({name:'خدمة تحتاج تقييم',slug:'simple-required-details',trackId:track._id,
    dynamicFormFields:[{name:'pages',label:'عدد الصفحات',type:'number',required:true}]});
  const response = await api('/api/public/leads','POST',{...simpleIntake('01088443324'),intakeMode:'DETAILED',serviceSelection:'SELECTED',serviceIds:[service.id]});
  assert.equal(response.status,201,JSON.stringify(response.data));
  const request = await Lead.findOne({leadCode:response.data.data.lead.leadCode});
  assert.equal(request.needsAssessment,true); assert.equal(request.assignedEngineerId,null);
  assert.equal(request.serviceIds.length,1); assert.equal(request.serviceRequirements?.[service.id]?.pages,undefined);
  assert.equal((await api('/api/public/leads','POST',{...simpleIntake(),serviceIds:[service.id],serviceRequirements:{[service.id]:{pages:'invalid'}}})).status,400);
});

test('simple intake still requires contact details, a brief and consent and validates optional values', async () => {
  for (const overrides of [{customerName:''},{phone:''},{projectDescription:'  '},{phoneCountryCode:undefined},{privacyAccepted:false},{contactAccepted:false},{email:'not-an-email'}]) {
    assert.equal((await api('/api/public/leads','POST',{...simpleIntake(),...overrides})).status,400,JSON.stringify(overrides));
  }
});

test('localized catalog translates services, departments and option labels without changing identifiers or values', async () => {
  const localizedTrack = await Track.create({name:'قسم المحتوى',nameEn:'Content',slug:'localized-content'});
  const localized = await ServiceCategory.create({name:'كتابة محتوى',nameEn:'Content writing',description:'محتوى لمشروعك',descriptionEn:'Content for your project',slug:'localized-writing',trackId:localizedTrack._id,
    dynamicFormFields:[{name:'tone',label:'أسلوب المحتوى',labelEn:'Content tone',type:'select',required:true,options:['رسمي','بسيط'],optionLabelsEn:{'رسمي':'Formal','بسيط':'Casual'}}]});
  const english = await api('/api/public/services?lang=en');
  assert.equal(english.status,200);
  const serviceEN = english.data.data.services.find((item:any) => item._id === localized.id);
  assert.equal(serviceEN.name,'Content writing'); assert.equal(serviceEN.dynamicFormFields[0].label,'Content tone');
  assert.deepEqual(serviceEN.dynamicFormFields[0].options,['رسمي','بسيط']);
  assert.equal(serviceEN.dynamicFormFields[0].optionLabels['رسمي'],'Formal');
  assert.equal(english.data.data.departments.find((item:any) => item._id === localizedTrack.id).name,'Content');
  const arabic = await api('/api/public/services?lang=ar');
  assert.equal(arabic.data.data.services.find((item:any) => item._id === localized.id).name,'كتابة محتوى');
  const response = await api('/api/public/leads','POST',{...simpleIntake('01088443325'),intakeMode:'DETAILED',preferredLanguage:'EN',serviceSelection:'SELECTED',serviceIds:[localized.id],serviceRequirements:{[localized.id]:{tone:'رسمي'}}});
  assert.equal(response.status,201,JSON.stringify(response.data));
  const request = await Lead.findOne({leadCode:response.data.data.lead.leadCode});
  assert.equal(request.preferredLanguage,'EN'); assert.equal(request.serviceRequirements[localized.id].tone,'رسمي');
  assert.equal((await api('/api/public/services?lang=unsupported')).status,400);
});

test('English catalog has localized fallbacks for custom entries without English copy', async () => {
  const untranslated = await ServiceCategory.create({name:'خدمة لم تترجم',slug:'missing-translation',dynamicFormFields:[{name:'question',label:'سؤال عربي',type:'text'}]});
  const english = await api('/api/public/services?lang=en');
  const service = english.data.data.services.find((item:any) => item._id === untranslated.id);
  assert.equal(service.name,'Additional service'); assert.equal(service.dynamicFormFields[0].label,'Question 1');
});

test('every employee can submit the same intake and attribution cannot be forged', async()=>{
  for(const user of [engineer,leader,custom]){
    const response=await api('/api/leads/staff','POST',{...simpleIntake(),referralSource:'INSTAGRAM',submittedByUserId:admin.id,marketingEmployeeName:'forged'},user);
    assert.equal(response.status,201,JSON.stringify(response.data));
    const saved=await Lead.findById(response.data.data.lead._id);
    assert.equal(String(saved.submittedByUserId),user.id);assert.equal(saved.marketingEmployeeName,user.name);
    assert.equal(saved.intakeChannel,'INTERNAL_STAFF');assert.equal(saved.leadSource,'إنستجرام');
    const own=await api('/api/leads?submittedByMe=true','GET',undefined,user);assert.ok(own.data.data.leads.some((r:any)=>r._id===saved.id));
  }
});

test('team leaders receive and work their own requests while teammates remain read-only',async()=>{
  const dedicated=await Track.create({name:'فريق الليدر',slug:'leader-routing'});
  const teamLeader=await User.create({name:'قائد مستلم',email:'receiver-leader@test.example',role:'TEAM_LEADER',trackId:dedicated._id,passwordHash:engineer.passwordHash});
  const {assignLeadSmart}=await import('../src/services/assignment.service.js');
  const assigned=await assignLeadSmart({trackId:dedicated.id});assert.equal(String(assigned.engineerId),teamLeader.id);
  const response=await api('/api/public/leads','POST',{...simpleIntake(),intakeMode:'DETAILED',departmentIds:[dedicated.id],trackId:dedicated.id});
  assert.equal(response.status,201);const request=await Lead.findOne({leadCode:response.data.data.lead.leadCode});assert.equal(String(request.assignedEngineerId),teamLeader.id);
  assert.equal((await api(`/api/leads/${request.id}/acknowledge`,'POST',{},teamLeader)).status,200);
  assert.equal((await api(`/api/leads/${request.id}/confirm-contact`,'POST',{},teamLeader)).status,200);
  const peer=await User.create({name:'زميل قائد',email:'peer-leader@test.example',role:'TEAM_LEADER',trackId:dedicated._id,passwordHash:engineer.passwordHash});
  assert.equal((await api(`/api/leads/${request.id}`,'GET',undefined,peer)).status,200);
  assert.equal((await api(`/api/leads/${request.id}/technical-intake`,'POST',{projectScope:'محاولة تعديل طلب زميل'},peer)).status,403);
  assert.equal((await assignLeadSmart({})).engineerId,null);
});

test('protected accounts and roles disappear from lists and nested request activities',async()=>{
  const protectedUser=await User.findOne({role:'SUPER_ADMIN'});assert.ok(protectedUser);
  const users=await api('/api/admin/users','GET',undefined,admin);assert.ok(!JSON.stringify(users.data).includes('SUPER_ADMIN'));assert.ok(!users.data.data.users.some((u:any)=>u._id===protectedUser.id));
  const roles=await api('/api/roles','GET',undefined,staff);assert.ok(!JSON.stringify(roles.data).includes('SUPER_ADMIN'));
  const response=await api('/api/leads/staff','POST',simpleIntake(),protectedUser);const requestId=response.data.data.lead._id;
  const detail=await api(`/api/leads/${requestId}`,'GET',undefined,admin);assert.ok(!JSON.stringify(detail.data).includes('SUPER_ADMIN'));assert.ok(!JSON.stringify(detail.data).includes(protectedUser.id));
  assert.equal((await api('/api/admin/users','GET',undefined,protectedUser)).data.data.users.some((u:any)=>u._id===protectedUser.id),true);
  const denied=await api(`/api/work/users/${protectedUser.id}/password`,'POST',{password:'Changed123!'},admin);assert.equal(denied.status,404);assert.ok(!JSON.stringify(denied.data).includes('SUPER_ADMIN'));
});

test('forgot-password queues requests without revealing accounts and resets revoke sessions',async()=>{
  const target=await User.create({name:'نسيان',email:'forgot@test.example',passwordHash:await bcrypt.hash('Previous123!',4),role:'STAFF'});
  const before=token(target);
  const found=await api('/api/auth/forgot-password','POST',{email:target.email});const missing=await api('/api/auth/forgot-password','POST',{email:'absent@test.example'});assert.deepEqual(found.data,missing.data);
  const queue=await api('/api/work/password-requests','GET',undefined,admin);assert.ok(queue.data.data.requests.some((r:any)=>r.userId._id===target.id));
  assert.equal((await api('/api/work/password-requests','GET',undefined,engineer)).status,403);
  assert.equal((await api(`/api/work/users/${target.id}/password`,'POST',{password:'Updated123!'},admin)).status,200);
  const expired=await fetch(base+'/api/auth/me',{headers:{Authorization:`Bearer ${before}`}});assert.equal(expired.status,401);
  assert.equal((await api('/api/auth/login','POST',{email:target.email,password:'Updated123!'})).status,200);
  assert.ok(!(await api('/api/work/password-requests','GET',undefined,admin)).data.data.requests.some((r:any)=>r.userId._id===target.id));
  const audit=await AuditLog.findOne({action:'PASSWORD_RESET',entityId:target.id}).lean();assert.ok(audit);assert.ok(!JSON.stringify(audit).includes('Updated123!'));
});

test('protected account can change its own password and revokes its previous token',async()=>{
  const protectedUser=await User.findOne({role:'SUPER_ADMIN'});const previous=token(protectedUser);
  assert.equal((await api(`/api/work/users/${protectedUser.id}/password`,'POST',{password:'SelfReset123!'},protectedUser)).status,200);
  assert.equal((await fetch(base+'/api/auth/me',{headers:{Authorization:`Bearer ${previous}`}})).status,401);
});

test('personal desk is owner-scoped and stale saves cannot overwrite a newer version',async()=>{
  const saved=await api('/api/work/desk','PUT',{notes:'ملاحظات خاصة بالمهندس',tasks:[{id:'one',title:'مهمة اليوم',done:false}],revision:0,ownerId:admin.id},engineer);assert.equal(saved.status,200);
  assert.equal((await api('/api/work/desk','GET',undefined,engineer)).data.data.desk.notes,'ملاحظات خاصة بالمهندس');
  assert.notEqual((await api('/api/work/desk','GET',undefined,admin)).data.data.desk.notes,'ملاحظات خاصة بالمهندس');
  assert.equal((await api('/api/work/desk','PUT',{notes:'نسخة قديمة',tasks:[],revision:0},engineer)).status,409);
});

test('catalog management honors granular roles and retains inactive service references',async()=>{
  const manager=await User.create({name:'مدير كاتلوج',email:'catalog-manager@test.example',role:'CATALOG',permissions:['services:manage'],permissionsSource:'CUSTOM',passwordHash:engineer.passwordHash});
  const payload={name:'خدمة قابلة للإدارة',nameEn:'Managed service',slug:'managed-catalog',description:'وصف الخدمة',descriptionEn:'Service description',trackId:track.id,isActive:true,dynamicFormFields:[{name:'goal',label:'الهدف',labelEn:'Goal',type:'text',required:false}]};
  assert.equal((await api('/api/manage/services','POST',payload,engineer)).status,403);
  const created=await api('/api/manage/services','POST',payload,manager);assert.equal(created.status,201);const id=created.data.data.service._id;
  assert.equal((await api('/api/manage/services','PUT',payload,manager)).status,404);
  assert.equal((await api(`/api/manage/services/${id}`,'PUT',{...payload,isActive:false},manager)).status,200);
  assert.ok(!(await api('/api/public/services')).data.data.services.some((s:any)=>s._id===id));assert.ok(await ServiceCategory.exists({_id:id}));
  assert.equal((await api('/api/admin/users','GET',undefined,manager)).status,403);
});

test('voice intake protects the recording and blocks routing until marketing structures it',async()=>{
  const wav=Buffer.alloc(44);wav.write('RIFF',0);wav.writeUInt32LE(36,4);wav.write('WAVE',8);
  const form=new FormData();form.append('file',new Blob([wav],{type:'audio/wav'}),'request.wav');
  const upload=await fetch(base+'/api/upload',{method:'POST',body:form});const file=(await upload.json()).data.file;
  const response=await api('/api/public/leads','POST',{...simpleIntake(),intakeMode:'VOICE',projectDescription:'',voiceRecording:file});assert.equal(response.status,201,JSON.stringify(response.data));
  let request=await Lead.findOne({leadCode:response.data.data.lead.leadCode});assert.equal(request.voiceReviewStatus,'PENDING');assert.equal(request.assignedEngineerId,null);assert.equal(request.slaAcknowledgeDeadline,undefined);
  assert.equal((await api(`/api/leads/${request.id}`,'GET',undefined,staff)).status,200);
  assert.equal((await api(`/api/leads/${request.id}`,'GET',undefined,engineer)).status,403);
  assert.equal((await api(`/api/leads/${request.id}/reassign`,'POST',{targetEngineerId:engineer.id,reason:'توزيع'},admin)).status,409);
  assert.equal((await fetch(base+`/api/files/${file.filename}`,{headers:{Authorization:`Bearer ${token(engineer)}`}})).status,404);
  const reviewed=await api(`/api/manage/requests/${request.id}`,'PUT',{...simpleIntake(),intakeMode:'DETAILED',serviceSelection:'SELECTED',serviceIds:[service.id]},staff);assert.equal(reviewed.status,200,JSON.stringify(reviewed.data));
  request=await Lead.findById(request.id);assert.equal(request.voiceReviewStatus,'REVIEWED');assert.equal(String(request.voiceReviewedBy),staff.id);assert.equal(request.voiceRecording.filename,file.filename);
  assert.equal((await api(`/api/leads/${request.id}/reassign`,'POST',{targetEngineerId:engineer.id,reason:'بعد التنسيق'},admin)).status,200);
  assert.equal((await fetch(base+`/api/files/${file.filename}`,{headers:{Authorization:`Bearer ${token(engineer)}`}})).status,200);
  assert.equal((await api(`/api/manage/requests/${request.id}`,'PUT',simpleIntake(),staff)).status,403);
});

test('intake corrections preserve origin, consent and payment and require explicit cross-track unassignment',async()=>{
  const created=await api('/api/leads/staff','POST',{...simpleIntake(),intakeMode:'DETAILED',serviceSelection:'SELECTED',serviceIds:[service.id]},engineer);const id=created.data.data.lead._id;const before=await Lead.findById(id);
  const targetTrack=await Track.create({name:'تراك تصحيح',slug:'correction-track'});
  const patch={...simpleIntake(),customerName:'اسم مصحح',intakeMode:'DETAILED',departmentIds:[targetTrack.id],trackId:targetTrack.id};
  assert.equal((await api(`/api/manage/requests/${id}`,'PUT',patch,admin)).status,409);
  assert.equal((await api(`/api/manage/requests/${id}`,'PUT',{...patch,unassign:true,submittedByUserId:staff.id,conversionValue:90000},admin)).status,200);
  const after=await Lead.findById(id);assert.equal(String(after.submittedByUserId),engineer.id);assert.equal(after.privacyAcceptedAt.getTime(),before.privacyAcceptedAt.getTime());assert.equal(after.conversionValue,before.conversionValue);assert.equal(after.customerName,'اسم مصحح');assert.equal(after.assignedEngineerId,undefined);
});

test('custom management permissions cannot be used to grant greater access or take over an administrator',async()=>{
  const manager=await User.create({name:'إدارة محدودة',email:'limited-admin@test.example',role:'LIMITED',permissions:['roles:manage','users:manage','passwords:reset'],permissionsSource:'CUSTOM',passwordHash:engineer.passwordHash});
  assert.equal((await api('/api/roles','POST',{name:'ترقية غير مسموحة',slug:'ESCALATION',permissions:['leads:view_all']},manager)).status,403);
  assert.equal((await api('/api/admin/users','POST',{name:'اختبار',email:'escalation@test.example',password:'Testing123!',role:'ADMIN'},manager)).status,403);
  assert.equal((await api(`/api/work/users/${admin.id}/password`,'POST',{password:'Testing123!'},manager)).status,404);
  assert.equal((await api('/api/reports/dashboard','GET',undefined,manager)).status,403);
  const roles=await api('/api/roles','GET',undefined,admin);assert.ok(roles.data.data.availablePermissions.some((p:any)=>p.key==='services:manage'));assert.ok(roles.data.data.availablePermissions.some((p:any)=>p.key==='voice:review'));
});

test('operational dashboard counts customers, voice queue and track workloads without mixing currencies',async()=>{
  const response=await api('/api/reports/dashboard','GET',undefined,admin);assert.equal(response.status,200);const ops=response.data.data.operational;
  assert.equal(ops.customers,await Customer.countDocuments());assert.equal(ops.pendingVoice,await Lead.countDocuments({voiceReviewStatus:'PENDING'}));assert.ok(ops.tracks.some((t:any)=>t._id===track.id));assert.ok(Array.isArray(response.data.data.kpis.revenueByCurrency));
});

test('stopping a service preserves the catalog and allows corrections to existing requests only',async()=>{
  const category=await ServiceCategory.create({name:'خدمة تاريخية',nameEn:'Historical service',slug:'retained-intake',trackId:track._id,dynamicFormFields:[]});
  const created=await api('/api/leads/staff','POST',{...simpleIntake(),intakeMode:'DETAILED',serviceSelection:'SELECTED',serviceIds:[category.id]},engineer);assert.equal(created.status,201);
  const id=created.data.data.lead._id;await ServiceCategory.updateOne({_id:category._id},{$set:{isActive:false}});
  const catalog=await api(`/api/manage/requests/${id}/catalog?lang=ar`,'GET',undefined,admin);assert.equal(catalog.status,200);assert.ok(catalog.data.data.services.some((s:any)=>s._id===category.id));
  const patch={...simpleIntake(),intakeMode:'DETAILED',serviceSelection:'SELECTED',serviceIds:[category.id],projectDescription:'تصحيح وصف طلب قديم'};
  assert.equal((await api(`/api/manage/requests/${id}`,'PUT',patch,admin)).status,200);
  assert.equal((await api('/api/public/leads','POST',patch)).status,400);
  assert.equal((await api(`/api/manage/requests/${id}/catalog`,'GET',undefined,engineer)).status,403);
});

test('a permission catalog upgrade grants leadership duties once and respects subsequent role edits',async()=>{
  const {Role}=await import('../src/models/Role.js');
  const role=await Role.findOneAndUpdate({slug:'TEAM_LEADER'},{$set:{name:'قائد فريق',permissions:['leads:view_track','reports:view'],isSystem:true},$unset:{permissionCatalogVersion:1}},{upsert:true,new:true});
  const user=await User.create({name:'قائد سابق',email:'legacy-role-leader@test.example',role:'TEAM_LEADER',roleId:role._id,permissions:['leads:view_track','reports:view'],passwordHash:engineer.passwordHash});
  const {upgradePermissionCatalog}=await import('../src/services/permission-catalog.service.js');await upgradePermissionCatalog();admin=await User.findById(admin.id);governance=await User.findById(governance.id);
  let saved=await User.findById(user.id);assert.ok(saved.permissions.includes('routing:receive'));assert.ok(saved.permissions.includes('leads:edit_technical'));assert.ok(!saved.permissions.includes('reports:view'));assert.equal(saved.permissionsSource,'ROLE');
  const result=await api(`/api/roles/${role.id}`,'PUT',{permissions:['leads:view_track']},governance);assert.equal(result.status,200);
  await upgradePermissionCatalog();saved=await User.findById(user.id);assert.deepEqual([...saved.permissions],['leads:view_track']);
  const {hasPermission}=await import('../src/utils/permissions.js');assert.equal(hasPermission(saved,'routing:receive'),false);assert.equal(hasPermission(saved,'leads:edit_technical'),false);
});

test('track boundaries apply even to referrers and custom global grants, reports and customer files',async()=>{
  const remote=await Track.create({name:'تراك خاص آخر',slug:'strict-remote'});
  const remoteUser=await User.create({name:'مهندس سري آخر',email:'strict-remote@test.example',role:'ENGINEER',trackId:remote._id,passwordHash:engineer.passwordHash});
  const request=await Lead.create({...input('01076543210'),leadCode:'#LD-810001',phoneNormalized:'+201076543210',leadSource:'REMOTE_SECRET_SOURCE',trackId:remote._id,departmentIds:[remote._id],submittedByUserId:engineer._id,assignedEngineerId:remoteUser._id,projectDescription:'نطاق سري لتراك آخر'});
  const {resolveCustomer}=await import('../src/services/customer.service.js');const customer=await resolveCustomer({...input('01076543210'),phoneNormalized:'+201076543210'});request.customerId=customer!._id;await request.save();
  assert.equal((await api(`/api/leads/${request.id}`,'GET',undefined,engineer)).status,403);
  const delegated=await User.create({name:'صلاحيات مقيدة بالتراك',email:'strict-global@test.example',role:'TRACK_OPERATOR',trackId:track._id,permissions:['leads:view_all','reports:view','reports:export','customers:manage','leads:assign'],permissionsSource:'CUSTOM',passwordHash:engineer.passwordHash});
  const all=await api('/api/leads','GET',undefined,delegated);assert.ok(!all.data.data.leads.some((item:any)=>item._id===request.id));
  assert.equal((await api(`/api/leads/${request.id}/reassign`,'POST',{targetEngineerId:engineer.id,reason:'غير مصرح'},delegated)).status,403);
  const reports=await api('/api/reports/dashboard','GET',undefined,delegated);assert.equal(reports.status,200);assert.ok(!JSON.stringify(reports.data).includes('REMOTE_SECRET_SOURCE'));assert.ok(!JSON.stringify(reports.data).includes(remoteUser.name));
  assert.equal((await api(`/api/customers/${customer!._id}`,'GET',undefined,delegated)).status,404);
  const tracks=await api('/api/tracks','GET',undefined,delegated);assert.ok(tracks.data.data.tracks.every((item:any)=>item._id===track.id));
});

test('unclassified requests need an explicit intake decision before normal routing starts',async()=>{
  const created=await api('/api/public/leads','POST',simpleIntake());const request=await Lead.findOne({leadCode:created.data.data.lead.leadCode});
  assert.equal(request.assignedEngineerId,null);assert.equal(request.slaAcknowledgeDeadline,undefined);
  assert.equal((await api(`/api/work-orders/${request.id}/classify`,'POST',{trackId:track.id,scope:'نطاق مصنف من مسؤول الاستقبال'},engineer)).status,403);
  assert.equal((await api(`/api/work-orders/${request.id}/classify`,'POST',{trackId:track.id,scope:'نطاق مصنف من مسؤول الاستقبال'},admin)).status,200);
  const saved=await Lead.findById(request.id);assert.equal(String(saved.trackId),track.id);assert.equal(saved.needsAssessment,false);
});

test('multi-track requests become isolated work orders with independent scope, payment and execution teams',async()=>{
  await api('/api/settings','PATCH',{routingMode:'AUTO_ROUND_ROBIN',skipBusyEngineers:false,autoReassignOnTimeout:false},admin);
  const a=await Track.create({name:'تطوير مشروع متعدد',slug:'bundle-development'}),b=await Track.create({name:'تصميم مشروع متعدد',slug:'bundle-design'});
  const make=async(role:string,name:string,department:any)=>User.create({name,email:`${name}@bundle.test`,passwordHash:engineer.passwordHash,role,trackId:department._id});
  const ownerA=await make('ENGINEER','owner-a',a),peerA=await make('ENGINEER','peer-a',a),leaderA=await make('TEAM_LEADER','leader-a',a),ownerB=await make('ENGINEER','owner-b',b),leaderB=await make('TEAM_LEADER','leader-b',b);
  await Track.updateOne({_id:a._id},{$set:{teamLeaderId:leaderA._id}});await Track.updateOne({_id:b._id},{$set:{teamLeaderId:leaderB._id}});
  const web=await ServiceCategory.create({name:'برمجة مستقلة',slug:'bundle-web',trackId:a._id}),design=await ServiceCategory.create({name:'تصميم مستقل',slug:'bundle-design',trackId:b._id});
  const created=await api('/api/public/leads','POST',{...simpleIntake(),intakeMode:'DETAILED',serviceSelection:'SELECTED',serviceIds:[web.id,design.id],projectDescription:'الوصف الأصلي يتضمن تطويرًا وتصميمًا ونطاقًا خاصًا لكل تراك.'});
  const parent=await Lead.findOne({leadCode:created.data.data.lead.leadCode});const operationId=crypto.randomUUID();
  const parts=[{trackId:a.id,serviceIds:[web.id],title:'تنفيذ البرمجة',scope:'DEVELOPMENT_ONLY: بناء الموقع والمتجر فقط.',estimatedBudget:1000,currency:'EGP'},{trackId:b.id,serviceIds:[design.id],title:'تنفيذ الهوية',scope:'DESIGN_ONLY_SECRET: تصميم هوية مستقلة فقط.',estimatedBudget:2000,currency:'USD'}];
  assert.equal((await api(`/api/work-orders/${parent.id}/split`,'POST',{operationId,parts},ownerA)).status,403);
  const split=await api(`/api/work-orders/${parent.id}/split`,'POST',{operationId,parts},admin);assert.equal(split.status,201,JSON.stringify(split.data));
  assert.equal((await api(`/api/work-orders/${parent.id}/split`,'POST',{operationId,parts},admin)).status,200);assert.equal(await Lead.countDocuments({parentRequestId:parent._id}),2);
  const orderA=await Lead.findOne({parentRequestId:parent._id,trackId:a._id}),orderB=await Lead.findOne({parentRequestId:parent._id,trackId:b._id});
  assert.equal(String(orderA.customerId),String(orderB.customerId));assert.equal(orderA.departmentIds.length,1);assert.equal(orderA.serviceIds.length,1);assert.ok(!orderA.projectDescription.includes('DESIGN_ONLY_SECRET'));assert.equal(orderA.attachments.length,0);
  await api(`/api/leads/${orderA.id}/reassign`,'POST',{targetEngineerId:ownerA.id,reason:'تحديد المسؤول'},admin);await api(`/api/leads/${orderB.id}/reassign`,'POST',{targetEngineerId:ownerB.id,reason:'تحديد المسؤول'},admin);
  assert.equal((await api(`/api/leads/${parent.id}`,'GET',undefined,leaderA)).status,403);assert.equal((await api(`/api/leads/${orderB.id}`,'GET',undefined,leaderA)).status,403);assert.equal((await api(`/api/work-orders/${parent.id}`,'GET',undefined,ownerA)).status,404);
  assert.equal((await api(`/api/execution/requests/${orderA.id}`,'POST',{message:'طلب فريق قبل اعتماد النطاق'},ownerA)).status,409);
  for(const [order,owner] of [[orderA,ownerA],[orderB,ownerB]]){assert.equal((await api(`/api/leads/${order.id}/acknowledge`,'POST',{},owner)).status,200);assert.equal((await api(`/api/leads/${order.id}/confirm-contact`,'POST',{},owner)).status,200);assert.equal((await api(`/api/leads/${order.id}/technical-intake`,'POST',{projectScope:order.projectDescription,deliverables:['تسليم الجزء المطلوب']},owner)).status,200);}
  const requested=await api(`/api/execution/requests/${orderA.id}`,'POST',{message:'محتاج زميل يساعد في تنفيذ الموقع.'},ownerA);assert.equal(requested.status,201,JSON.stringify(requested.data));const roomId=requested.data.data.room._id;
  assert.equal((await api(`/api/execution/requests/${orderA.id}`,'POST',{message:'طلب مكرر للفريق'},ownerA)).status,409);
  assert.equal((await api(`/api/execution/${roomId}`,'GET',undefined,peerA)).status,404);assert.equal((await api(`/api/execution/${roomId}`,'GET',undefined,leaderB)).status,404);
  assert.equal((await api(`/api/execution/${roomId}/approve`,'POST',{memberIds:[peerA.id]},ownerA)).status,403);
  assert.equal((await api(`/api/execution/${roomId}/approve`,'POST',{memberIds:[ownerB.id]},leaderA)).status,400);
  assert.equal((await api(`/api/execution/${roomId}/approve`,'POST',{memberIds:[peerA.id]},leaderA)).status,200);
  const room=await api(`/api/execution/${roomId}`,'GET',undefined,peerA);assert.equal(room.status,200);assert.ok(JSON.stringify(room.data).includes('DEVELOPMENT_ONLY'));assert.ok(!JSON.stringify(room.data).includes('DESIGN_ONLY_SECRET'));
  const clientMessageId=crypto.randomUUID();assert.equal((await api(`/api/execution/${roomId}/messages`,'POST',{text:'هنبدأ مراجعة المتطلبات مع الفريق.',clientMessageId},peerA)).status,201);assert.equal((await api(`/api/execution/${roomId}/messages`,'POST',{text:'هنبدأ مراجعة المتطلبات مع الفريق.',clientMessageId},peerA)).status,200);
  const messages=await api(`/api/execution/${roomId}/messages`,'GET',undefined,ownerA);assert.equal(messages.data.data.messages.filter((item:any)=>item.clientMessageId===clientMessageId).length,1);
  assert.equal((await api(`/api/execution/${roomId}/members`,'PUT',{memberIds:[]},leaderA)).status,200);assert.equal((await api(`/api/execution/${roomId}/messages`,'GET',undefined,peerA)).status,404);
  await api(`/api/execution/${roomId}/members`,'PUT',{memberIds:[peerA.id]},leaderA);
  const upload=async(owner:any)=>{const form=new FormData();form.append('file',new Blob(['%PDF-1.4\n test receipt'],{type:'application/pdf'}),'receipt.pdf');const response=await fetch(base+'/api/upload',{method:'POST',body:form,headers:{Authorization:`Bearer ${token(owner)}`}});assert.equal(response.status,200);return (await response.json()).data.file;};
  const receiptA=await upload(ownerA);
  assert.equal((await api(`/api/leads/${orderA.id}/confirm-payment`,'POST',{amount:200,currency:'EGP',paymentType:'DEPOSIT',receiptUrl:receiptA.url},ownerA)).status,200);
  assert.equal((await api(`/api/leads/${orderA.id}/status`,'PATCH',{status:'CONVERTED'},ownerA)).status,400,'a deposit cannot be marked as fully paid through status updates');
  assert.equal((await api(`/api/execution/${roomId}`,'GET',undefined,ownerA)).data.data.room.status,'ACTIVE');
  assert.equal((await api(`/api/execution/${roomId}/complete`,'POST',{},leaderA)).status,200);assert.equal((await api(`/api/execution/${roomId}`,'GET',undefined,ownerA)).data.data.room.status,'AWAITING_PAYMENT');
  assert.equal((await api(`/api/execution/${roomId}/messages`,'POST',{text:'في انتظار تسوية باقي المستحقات.',clientMessageId:crypto.randomUUID()},peerA)).status,201);
  assert.equal((await api(`/api/leads/${orderA.id}/confirm-payment`,'POST',{amount:800,currency:'USD',paymentType:'FINAL',receiptUrl:receiptA.url},ownerA)).status,400);
  const final=await api(`/api/leads/${orderA.id}/confirm-payment`,'POST',{amount:800,currency:'EGP',paymentType:'FINAL',receiptUrl:receiptA.url},ownerA);assert.equal(final.status,200,JSON.stringify(final.data));assert.equal(final.data.data.lead.conversionValue,1000);assert.equal(final.data.data.lead.paymentHistory.length,1);
  assert.equal((await fetch(base+`/api/files/${receiptA.filename}`,{headers:{Authorization:`Bearer ${token(peerA)}`}})).status,404,'team membership does not expose financial receipts');
  assert.equal((await api(`/api/execution/${roomId}`,'GET',undefined,peerA)).data.data.room.status,'CLOSED');assert.equal((await api(`/api/execution/${roomId}/messages`,'POST',{text:'رسالة بعد الأرشفة',clientMessageId:crypto.randomUUID()},peerA)).status,409);assert.equal((await api(`/api/execution/${roomId}/messages`,'GET',undefined,peerA)).status,200);
  assert.notEqual((await Lead.findById(parent.id)).status,'CONVERTED');assert.equal((await Lead.findById(orderB.id)).paymentReceipt.isReceived,false);
  const receiptB=await upload(ownerB);assert.equal((await api(`/api/leads/${orderB.id}/confirm-payment`,'POST',{amount:2000,currency:'USD',paymentType:'FULL',receiptUrl:receiptB.url},ownerB)).status,200);
  assert.equal((await Lead.findById(parent.id)).status,'CONVERTED');assert.equal((await Lead.findById(parent.id)).paymentReceipt.isReceived,false);
});

test('paying before execution ends keeps chat open and archived messages remain paginated and readable',async()=>{
  const department=await Track.create({name:'تجربة الدفع المبكر',slug:'paid-before-completion'});
  const owner=await User.create({name:'تنفيذ مبكر',email:'paid-first-owner@test.example',role:'ENGINEER',trackId:department._id,passwordHash:engineer.passwordHash});
  const manager=await User.create({name:'ليدر التنفيذ',email:'paid-first-leader@test.example',role:'TEAM_LEADER',trackId:department._id,passwordHash:engineer.passwordHash});
  await Track.updateOne({_id:department._id},{$set:{teamLeaderId:manager._id}});
  const request=await Lead.create({...input(),phoneNormalized:'+201012345678',leadSource:'test',leadCode:'#LD-810002',trackId:department._id,departmentIds:[department._id],assignedEngineerId:owner._id,technicalIntake:{isCompleted:true,projectScope:'تنفيذ خدمة معتمدة'},status:'QUALIFIED'});
  const created=await api(`/api/execution/requests/${request.id}`,'POST',{message:'طلب فريق لتنفيذ الخدمة المعتمدة'},owner);assert.equal(created.status,201);const roomId=created.data.data.room._id;
  assert.equal((await api(`/api/execution/${roomId}/messages`,'POST',{text:'قبل فتح المحادثة',clientMessageId:crypto.randomUUID()},owner)).status,409);
  await api(`/api/execution/${roomId}/approve`,'POST',{memberIds:[]},manager);
  const form=new FormData();form.append('file',new Blob(['%PDF-1.4\n receipt'],{type:'application/pdf'}),'full.pdf');const upload=await fetch(base+'/api/upload',{method:'POST',body:form,headers:{Authorization:`Bearer ${token(owner)}`}});const receipt=(await upload.json()).data.file;
  assert.equal((await api(`/api/leads/${request.id}/confirm-payment`,'POST',{amount:500,currency:'EGP',paymentType:'FULL',receiptUrl:receipt.url},owner)).status,200);
  assert.equal((await api(`/api/execution/${roomId}`,'GET',undefined,owner)).data.data.room.status,'ACTIVE');
  assert.equal((await api(`/api/execution/${roomId}/messages`,'POST',{text:'الدفع اكتمل لكن التنفيذ لسه شغال.',clientMessageId:crypto.randomUUID()},owner)).status,201);
  const {ExecutionMessage}=await import('../src/models/ExecutionRoom.js');await ExecutionMessage.insertMany(Array.from({length:55},(_,i)=>({roomId,senderId:owner._id,text:`متابعة تنفيذ ${i}`,kind:'MESSAGE'})));
  assert.equal((await api(`/api/execution/${roomId}/complete`,'POST',{},manager)).status,200);
  const latest=await api(`/api/execution/${roomId}/messages`,'GET',undefined,owner);assert.equal(latest.status,200);assert.equal(latest.data.data.messages.length,50);assert.equal(latest.data.data.hasMore,true);
  const older=await api(`/api/execution/${roomId}/messages?before=${latest.data.data.messages[0]._id}`,'GET',undefined,owner);assert.equal(older.status,200);assert.ok(older.data.data.messages.length>0);assert.ok(!older.data.data.messages.some((item:any)=>latest.data.data.messages.some((recent:any)=>recent._id===item._id)));
  assert.equal((await api(`/api/execution/${roomId}`,'GET',undefined,owner)).data.data.room.status,'CLOSED');
});

test('operational Admin handles work but cannot change roles, accounts, forms or security audit',async()=>{
  const {hasPermission}=await import('../src/utils/permissions.js');
  const operator=await User.create({name:'مدير التشغيل',email:'operations-admin@test.example',role:'ADMIN',passwordHash:engineer.passwordHash});
  for(const permission of ['leads:view_all','leads:assign','leads:split','leads:edit_all','customers:manage','tracks:manage','reports:export','settings:manage','passwords:reset'])assert.equal(hasPermission(operator,permission),true,permission);
  for(const permission of ['users:manage','roles:manage','services:manage','audit:view'])assert.equal(hasPermission(operator,permission),false,permission);
  assert.equal((await api('/api/reports/dashboard','GET',undefined,operator)).status,200);
  assert.equal((await api('/api/customers','GET',undefined,operator)).status,200);
  assert.equal((await api('/api/manage/services','GET',undefined,operator)).status,403);
  assert.equal((await api('/api/audit-logs','GET',undefined,operator)).status,403);
  assert.equal((await api('/api/admin/users','POST',{name:'غير مصرح',email:'forbidden-create@test.example',password:'Testing123!',role:'ENGINEER'},operator)).status,403);
  assert.equal((await api(`/api/admin/users/${engineer.id}`,'PUT',{permissions:['roles:manage']},operator)).status,403);
  assert.equal((await api('/api/roles','POST',{name:'ترقية',slug:'ADMIN_ESCALATION',permissions:['roles:manage']},operator)).status,403);
  const role=(await api('/api/roles','GET',undefined,operator)).data.data.roles.find((r:any)=>r.slug==='ADMIN');assert.equal(role.canEdit,false);
  assert.equal((await api(`/api/roles/${role._id}`,'PUT',{permissions:['roles:manage']},operator)).status,403);
  const worker=await User.create({name:'موظف كلمة مرور',email:'operations-password@test.example',role:'ENGINEER',passwordHash:engineer.passwordHash});
  assert.equal((await api(`/api/work/users/${worker.id}/password`,'POST',{password:'Changed123!'},operator)).status,200);
  const siteAccount=await User.create({name:'حساب حوكمة',email:'governance-password@test.example',role:'CATALOG',permissions:['services:manage'],permissionsSource:'CUSTOM',passwordHash:engineer.passwordHash});
  assert.equal((await api(`/api/work/users/${siteAccount.id}/password`,'POST',{password:'Changed123!'},operator)).status,404);
  const targets=await api('/api/admin/users?passwordTargets=true','GET',undefined,operator);assert.ok(targets.data.data.users.some((u:any)=>u._id===worker.id));assert.ok(!targets.data.data.users.some((u:any)=>u._id===siteAccount.id));
});

test('SuperAdmin edits existing system roles, revokes inherited sessions and preserves custom grants',async()=>{
  const {Role}=await import('../src/models/Role.js');const {hasPermission}=await import('../src/utils/permissions.js');
  const role=await Role.findOneAndUpdate({slug:'ENGINEER'},{$setOnInsert:{name:'مهندس',isSystem:true,permissionCatalogVersion:5,permissions:['leads:view_own','leads:edit_technical','routing:receive']}},{upsert:true,new:true});
  const prior=[...role.permissions];const root=await User.findOne({email:'owner@test.example'});
  const linked=await User.create({name:'وارث دور',email:'system-linked@test.example',role:'ENGINEER',roleId:role._id,permissions:prior,permissionsSource:'ROLE',passwordHash:engineer.passwordHash});
  const legacy=await User.create({name:'وارث قديم',email:'system-legacy@test.example',role:'ENGINEER',passwordHash:engineer.passwordHash});
  const explicit=await User.create({name:'صلاحية خاصة',email:'system-custom@test.example',role:'ENGINEER',roleId:role._id,permissions:['leads:view_own'],permissionsSource:'CUSTOM',passwordHash:engineer.passwordHash});
  const oldTokens=[token(linked),token(legacy)];
  const roles=await api('/api/roles','GET',undefined,root);assert.equal(roles.data.data.roles.find((r:any)=>r._id===role.id).canEdit,true);assert.equal(roles.data.data.roles.find((r:any)=>r._id===role.id).canDelete,false);
  const changed=await api(`/api/roles/${role.id}`,'PUT',{permissions:[]},root);assert.equal(changed.status,200);
  for(const target of [linked,legacy]){const saved=await User.findById(target.id);assert.deepEqual([...saved.permissions],[]);assert.equal(saved.permissionsSource,'ROLE');assert.equal(hasPermission(saved,'routing:receive'),false);}
  for(const old of oldTokens)assert.equal((await fetch(base+'/api/auth/me',{headers:{Authorization:`Bearer ${old}`}})).status,401);
  assert.deepEqual([...(await User.findById(explicit.id)).permissions],['leads:view_own']);
  assert.equal((await api(`/api/roles/${role.id}`,'DELETE',undefined,root)).status,400);
  const {upgradePermissionCatalog}=await import('../src/services/permission-catalog.service.js');await upgradePermissionCatalog();assert.deepEqual([...(await Role.findById(role.id)).permissions],[]);
  await api(`/api/roles/${role.id}`,'PUT',{permissions:prior},root);
});

test('Admin policy upgrades existing accounts once and later role reductions stay effective',async()=>{
  const {Role}=await import('../src/models/Role.js');const {SYSTEM_PERMISSIONS,ADMIN_OPERATIONAL_PERMISSIONS,hasPermission}=await import('../src/utils/permissions.js');
  const role=await Role.findOneAndUpdate({slug:'ADMIN'},{$set:{isSystem:true,permissionCatalogVersion:2,permissions:SYSTEM_PERMISSIONS.map(p=>p.key)}},{new:true});
  const old=await User.create({name:'أدمن قديم',email:'old-admin-policy@test.example',role:'ADMIN',roleId:role._id,permissions:SYSTEM_PERMISSIONS.map(p=>p.key),permissionsSource:'ROLE',passwordHash:engineer.passwordHash});
  const customAdmin=await User.create({name:'أدمن مخصص قديم',email:'old-custom-admin@test.example',role:'ADMIN',permissions:SYSTEM_PERMISSIONS.map(p=>p.key),permissionsSource:'CUSTOM',passwordHash:engineer.passwordHash});
  const previousToken=token(old);const {upgradePermissionCatalog}=await import('../src/services/permission-catalog.service.js');await upgradePermissionCatalog();
  assert.equal((await fetch(base+'/api/auth/me',{headers:{Authorization:`Bearer ${previousToken}`}})).status,401);
  for(const target of [old,customAdmin]){const saved=await User.findById(target.id);assert.equal(hasPermission(saved,'roles:manage'),false);assert.equal(hasPermission(saved,'services:manage'),false);assert.equal(hasPermission(saved,'leads:assign'),true);}
  const root=await User.findOne({email:'owner@test.example'});
  assert.equal((await api(`/api/roles/${role.id}`,'PUT',{permissions:['reports:view']},root)).status,200);
  let saved=await User.findById(old.id);assert.equal((await api('/api/reports/dashboard','GET',undefined,saved)).status,200);assert.equal((await api('/api/settings','PATCH',{routingMode:'MANUAL'},saved)).status,403);
  assert.equal((await api('/api/leads','GET',undefined,saved)).data.data.leads.length,0);
  await upgradePermissionCatalog();saved=await User.findById(old.id);assert.deepEqual([...saved.permissions],['reports:view']);assert.deepEqual([...(await Role.findById(role.id)).permissions],['reports:view']);
  assert.equal(hasPermission(root,'users:manage'),true);
  await api(`/api/roles/${role.id}`,'PUT',{permissions:ADMIN_OPERATIONAL_PERMISSIONS},root);
});

test('client portal identity is public to read and only the protected owner can change it',async()=>{
  const {SYSTEM_PERMISSIONS,hasPermission}=await import('../src/utils/permissions.js');const root=await User.findOne({email:'owner@test.example'});
  const current=await api('/api/public/branding');assert.equal(current.status,200);assert.equal(current.data.data.brand.companyName,'Digency');assert.equal(current.data.data.brand.whatsapp,'201116247717');
  const payload={companyName:'شركة اختبار الهوية',whatsapp:'201116247717',logoFilename:null,revision:0};
  assert.equal((await api('/api/manage/client-brand','PUT',payload)).status,401);
  assert.equal((await api('/api/manage/client-brand','PUT',payload,await User.findById(admin.id))).status,403);
  const delegate=await User.create({name:'صلاحية هوية مزيفة',email:'forged-brand-role@test.example',role:'CUSTOM_BRAND',permissions:['portal:brand','roles:manage'],permissionsSource:'CUSTOM',passwordHash:engineer.passwordHash});
  assert.equal(hasPermission(delegate,'portal:brand'),false);assert.equal((await api('/api/manage/client-brand','PUT',payload,delegate)).status,403);
  assert.equal((await api('/api/roles','POST',{name:'تفويض ممنوع للهوية',slug:'FORBIDDEN_BRAND',permissions:['portal:brand']},root)).status,400);
  assert.ok(SYSTEM_PERMISSIONS.find(p=>p.key==='portal:brand')?.exclusiveToOwner);
  const foreignForm=new FormData();foreignForm.append('file',new Blob([Buffer.from('89504e470d0a1a0a00000000','hex')],{type:'image/png'}),'foreign-logo.png');
  const foreignUpload=await fetch(base+'/api/upload',{method:'POST',body:foreignForm,headers:{Authorization:`Bearer ${token(await User.findById(engineer.id))}`}});assert.equal(foreignUpload.status,200);const foreign=(await foreignUpload.json()).data.file;
  assert.equal((await api('/api/manage/client-brand','PUT',{...payload,logoFilename:foreign.filename},root)).status,403);
  const form=new FormData();form.append('file',new Blob([Buffer.from('89504e470d0a1a0a00000000','hex')],{type:'image/png'}),'brand-logo.png');
  const uploaded=await fetch(base+'/api/upload',{method:'POST',body:form,headers:{Authorization:`Bearer ${token(root)}`}});assert.equal(uploaded.status,200);const file=(await uploaded.json()).data.file;
  assert.equal((await api('/api/manage/client-brand','PUT',{...payload,logoFilename:file.filename},root)).status,200);
  const updated=await api('/api/public/branding');assert.equal(updated.data.data.brand.companyName,payload.companyName);assert.equal(updated.data.data.brand.revision,1);assert.ok(!JSON.stringify(updated.data).includes(root.id));
  const image=await fetch(base+updated.data.data.brand.logoUrl);assert.equal(image.status,200);assert.match(image.headers.get('content-type')||'',/image\/png/);
  assert.equal((await api('/api/manage/client-brand','PUT',payload,root)).status,409);
  assert.equal((await api('/api/manage/client-brand','PUT',{...payload,revision:1,logoFilename:'../../secrets.png'},root)).status,400);
});

test('a portal logo stored in MongoDB remains public only through the selected branding endpoint',async()=>{
  const previous=process.env.UPLOAD_STORAGE;process.env.UPLOAD_STORAGE='mongodb';
  try {
    const root=await User.findOne({email:'owner@test.example'});
    const bytes=Buffer.from('89504e470d0a1a0a00000000','hex');
    const uploadLogo=async()=>{const form=new FormData();form.append('file',new Blob([bytes],{type:'image/png'}),'logo.png');const response=await fetch(base+'/api/upload',{method:'POST',body:form,headers:{Authorization:`Bearer ${token(root)}`}});assert.equal(response.status,200);return (await response.json() as any).data.file;};
    const selected=await uploadLogo();const unused=await uploadLogo();
    const before=(await api('/api/public/branding')).data.data.brand;
    const update=await api('/api/manage/client-brand','PUT',{companyName:before.companyName,whatsapp:before.whatsapp,revision:before.revision,logoFilename:selected.filename},root);
    assert.equal(update.status,200);
    await assert.rejects(access(path.join(process.env.UPLOAD_DIR!,selected.filename)));
    const logo=await fetch(base+update.data.data.brand.logoUrl);assert.equal(logo.status,200);assert.equal(logo.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await logo.arrayBuffer()),bytes);
    assert.equal((await fetch(base+'/api/files/'+unused.filename)).status,401);
    assert.equal((await fetch(base+'/uploads/'+selected.filename)).status,404);
    const fake=new FormData();fake.append('file',new Blob(['not a png'],{type:'image/png'}),'invalid.png');
    const {Upload}=await import('../src/models/Upload.js');const count=await Upload.countDocuments();
    const bucket=new mongoose.mongo.GridFSBucket(mongoose.connection.db!,{bucketName:'crmUploads'});const blobs=await bucket.find({}).toArray();
    assert.equal((await fetch(base+'/api/upload',{method:'POST',body:fake})).status,400);
    assert.equal(await Upload.countDocuments(),count);assert.equal((await bucket.find({}).toArray()).length,blobs.length);
  } finally {if(previous===undefined)delete process.env.UPLOAD_STORAGE;else process.env.UPLOAD_STORAGE=previous;}
});

test('new role permissions control intake, desk, financial recording and execution independently',async()=>{
  const {SYSTEM_PERMISSIONS}=await import('../src/utils/permissions.js');const {Role}=await import('../src/models/Role.js');const root=await User.findOne({email:'owner@test.example'});
  for(const key of ['leads:create_marketing','desk:use','payments:record','execution:view','execution:request','execution:manage','execution:complete','execution:message'])assert.ok(SYSTEM_PERMISSIONS.some(p=>p.key===key),key);
  const role=await Role.create({name:'دور تجريبي بدون مهام',slug:'PERMISSION_REVIEW',permissions:[],permissionCatalogVersion:4});
  const user=await User.create({name:'حساب مراجعة صلاحيات',email:'permission-review@test.example',role:role.slug,roleId:role._id,permissions:[],permissionsSource:'ROLE',passwordHash:engineer.passwordHash});
  assert.equal((await api('/api/leads/staff','POST',simpleIntake(),user)).status,403);
  assert.equal((await api('/api/leads','POST',simpleIntake(),user)).status,403);
  assert.equal((await api('/api/work/desk','GET',undefined,user)).status,403);
  assert.equal((await api('/api/execution','GET',undefined,user)).status,403);
  assert.equal((await api(`/api/leads/${lead.id}/confirm-payment`,'POST',{amount:1,paymentType:'FULL',receiptUrl:'/uploads/test.pdf'},user)).status,403);
  assert.equal((await api(`/api/roles/${role.id}`,'PUT',{permissions:['leads:create_marketing','desk:use']},root)).status,200);
  let refreshed=await User.findById(user.id);assert.equal((await api('/api/work/desk','GET',undefined,refreshed)).status,200);assert.equal((await api('/api/leads/staff','POST',simpleIntake(),refreshed)).status,201);
  assert.equal((await api('/api/leads','GET',undefined,refreshed)).data.data.leads.length,0,'creating a request does not bypass the separate submitted-history permission');
  await api(`/api/roles/${role.id}`,'PUT',{permissions:['leads:create_marketing','desk:use','leads:view_submitted']},root);refreshed=await User.findById(user.id);assert.equal((await api('/api/leads','GET',undefined,refreshed)).data.data.leads.length,1);
  await api(`/api/roles/${role.id}`,'PUT',{permissions:['desk:use']},root);refreshed=await User.findById(user.id);assert.equal((await api('/api/leads/staff','POST',simpleIntake(),refreshed)).status,403);assert.equal((await api('/api/work/desk','GET',undefined,refreshed)).status,200);
  const managerRole=await Role.create({name:'قائد مخصص',slug:'CUSTOM_TEAM_MANAGER',permissions:['routing:receive','leads:view_track','execution:view','execution:manage','execution:complete','execution:message'],permissionCatalogVersion:4});
  const department=await Track.create({name:'فريق قيادة مخصصة',slug:'custom-manager-track'});
  const created=await api('/api/admin/users','POST',{name:'قائد دور مخصص',email:'custom-team-manager@test.example',password:'Manager123!',roleId:managerRole.id,trackId:department.id},root);assert.equal(created.status,201,JSON.stringify(created.data));
  const manager=await User.findById(created.data.data.user._id);assert.equal(String((await Track.findById(department.id)).teamLeaderId),manager.id);
  assert.equal((await (await import('../src/services/execution.service.js')).currentLeader(department.id)).id,manager.id);
  const request=await Lead.create({...input(),phoneNormalized:'+201012345678',leadCode:'#LD-810003',leadSource:'test',trackId:department._id,departmentIds:[department._id],assignedEngineerId:manager._id,status:'QUALIFIED',technicalIntake:{isCompleted:true,projectScope:'اختبار قيادة فريق مخصص'}});
  const {ExecutionRoom}=await import('../src/models/ExecutionRoom.js');const room=await ExecutionRoom.create({leadId:request._id,trackId:department._id,requesterId:manager._id,leaderId:manager._id,memberIds:[manager._id],requestMessage:'اختبار صلاحيات القيادة',status:'REQUESTED'});
  assert.equal((await api(`/api/execution/${room.id}/approve`,'POST',{memberIds:[]},manager)).status,200);
  await api(`/api/roles/${managerRole.id}`,'PUT',{permissions:['routing:receive','execution:view']},root);const reduced=await User.findById(manager.id);
  assert.equal((await api(`/api/execution/${room.id}/messages`,'POST',{text:'رسالة بلا صلاحية',clientMessageId:crypto.randomUUID()},reduced)).status,403);
  assert.equal((await api(`/api/execution/${room.id}/complete`,'POST',{},reduced)).status,403);
  assert.equal((await Track.findById(department.id)).teamLeaderId,undefined);
  const finance=await User.create({name:'مسؤول دفعات فقط',email:'finance-only@test.example',role:'FINANCE',permissions:['leads:view_all','payments:record'],permissionsSource:'CUSTOM',passwordHash:engineer.passwordHash});
  const form=new FormData();form.append('file',new Blob(['%PDF-1.4\n financial receipt'],{type:'application/pdf'}),'finance.pdf');const upload=await fetch(base+'/api/upload',{method:'POST',body:form,headers:{Authorization:`Bearer ${token(finance)}`}});assert.equal(upload.status,200);const receipt=(await upload.json()).data.file;
  const paid=await api(`/api/leads/${request.id}/confirm-payment`,'POST',{amount:100,currency:'EGP',paymentType:'FULL',receiptUrl:receipt.url},finance);assert.equal(paid.status,200,JSON.stringify(paid.data));
  assert.equal((await api(`/api/leads/${request.id}/technical-intake`,'POST',{projectScope:'محاولة تعديل فني من المالية'},finance)).status,403);
});

test('startup adds missing system roles without demo data or restoring reduced permissions',async()=>{
  const {initializeSystemRoles}=await import('../src/services/system-roles.service.js');
  const {Role}=await import('../src/models/Role.js');
  const adminRole=await Role.findOne({slug:'ADMIN'});assert.ok(adminRole);
  const beforeUsers=await User.countDocuments(),beforeLeads=await Lead.countDocuments(),beforeTracks=await Track.countDocuments();
  const beforeOwners=await Role.countDocuments({slug:'SUPER_ADMIN'});
  const before=[...adminRole.permissions];
  await Role.updateOne({_id:adminRole._id},{$set:{permissions:['reports:view']}});
  await initializeSystemRoles();await initializeSystemRoles();
  assert.equal(await Role.countDocuments({slug:{$in:['ADMIN','TEAM_LEADER','ENGINEER','MARKETING','STAFF']}}),5);
  assert.equal(await Role.countDocuments({slug:'SUPER_ADMIN'}),beforeOwners);
  assert.deepEqual((await Role.findById(adminRole._id))!.permissions,['reports:view']);
  await Role.updateOne({_id:adminRole._id},{$set:{permissions:before}});
  assert.equal(await User.countDocuments(),beforeUsers);assert.equal(await Lead.countDocuments(),beforeLeads);assert.equal(await Track.countDocuments(),beforeTracks);
});
