import { toast } from 'sonner';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowRight, Building2, ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';

interface Customer {
  _id: string; name: string; phone: string; email?: string; country: string; companyName?: string;
  websiteUrl?: string; position?: string; socialLinks?: string[];
  requestCount: number; activeRequestCount: number; lastRequestAt?: string;
}
interface Request {
  _id: string; leadCode: string;parentRequestCode?:string;isBundleParent?:boolean; projectName?: string; projectDescription?: string;
  status: string; createdAt: string; submittedByUserId?:{name:string};marketingEmployeeName?:string;leadSource?:string; needsAssessment?: boolean;
  serviceIds?: { _id: string; name: string }[]; departmentIds?: { _id: string; name: string }[];
  currentServiceId?: { name: string }; assignedEngineerId?: { name: string };
}
export function CustomerDirectory({ onOpenRequest }: { onOpenRequest: (id: string) => void }) {
  const [editing,setEditing]=useState(false);const [saving,setSaving]=useState(false);
  const [profile,setProfile]=useState({name:'',email:'',companyName:'',websiteUrl:'',position:''});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [requestPage, setRequestPage] = useState(1);
  const [requestPages, setRequestPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = window.setTimeout(() => {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const load = selected
        ? axios.get('/api/leads', { headers, signal: controller.signal, params: { customerId: selected._id, page: requestPage, limit: 20 } })
        : axios.get('/api/customers', { headers, signal: controller.signal, params: { search: search || undefined, page, limit: 20 } });
      load.then(res => {
        if (selected) { setRequests(res.data.data.leads); setRequestPages(Math.max(1, res.data.data.pagination.pages)); }
        else { setCustomers(res.data.data.customers); setPages(Math.max(1, res.data.data.pagination.pages)); setTotal(res.data.data.pagination.total); }
      }).catch(() => { if (!controller.signal.aborted) setError('تعذر تحميل البيانات. حاول مرة أخرى.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [selected, search, page, requestPage, attempt]);

  const pagination = (current: number, count: number, change: (page: number) => void) => (
    <nav aria-label="صفحات النتائج" className="flex items-center justify-between gap-3 border-t border-surface-border pt-4 text-sm">
      <button type="button" disabled={current <= 1 || loading} onClick={() => change(current - 1)} className="flex items-center gap-1 border border-surface-border rounded-xl px-3 py-2 disabled:opacity-40"><ChevronRight className="w-4 h-4" />السابق</button>
      <span>{current} / {count}</span>
      <button type="button" disabled={current >= count || loading} onClick={() => change(current + 1)} className="flex items-center gap-1 border border-surface-border rounded-xl px-3 py-2 disabled:opacity-40">التالي<ChevronLeft className="w-4 h-4" /></button>
    </nav>
  );
  return <section className="bg-white rounded-xl border border-surface-border p-4 sm:p-6 space-y-6" aria-busy={loading}>
    {selected ? <>
      <button type="button" onClick={() => { setSelected(null); setRequests([]); }} className="inline-flex items-center gap-2 text-sm"><ArrowRight className="w-4 h-4" />كل العملاء</button>
      <div className="rounded-xl bg-aethra-paper border border-surface-border p-5">
        <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-surface-muted mb-2">ملف العميل</p><h2 className="text-xl font-semibold">{selected.name}</h2>{selected.companyName && <p className="mt-2 text-sm">{selected.companyName}</p>}</div><Users className="w-7 h-7 text-surface-muted" /></div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm mt-4 text-surface-muted"><span dir="ltr">{selected.phone}</span><span>{selected.email}</span><span>{selected.country}</span><span>{selected.position}</span></div>
        {selected.websiteUrl && <a className="block text-sm underline break-all mt-3" href={selected.websiteUrl} target="_blank" rel="noreferrer">{selected.websiteUrl}</a>}
        <p className="text-xs text-surface-muted mt-4">بيانات التواصل الخاصة بكل طلب محفوظة في تفاصيله وقت تقديمه.</p>
      </div>
      <button className="underline text-sm" onClick={()=>{setProfile({name:selected.name,email:selected.email||'',companyName:selected.companyName||'',websiteUrl:selected.websiteUrl||'',position:selected.position||''});setEditing(true);}}>تعديل ملف العميل</button>
      {editing&&<form className="space-y-4 rounded-xl border border-surface-border p-4" onSubmit={async event=>{event.preventDefault();setSaving(true);try{const res=await axios.put(`/api/manage/customers/${selected._id}`,profile);setSelected({...selected,...res.data.data.customer});setEditing(false);toast.success('تم حفظ ملف العميل. بيانات الطلبات التاريخية محفوظة كما كانت.');}catch(e:any){toast.error(e.response?.data?.message||'تعذر الحفظ.');}finally{setSaving(false);}}}>{[['name','الاسم'],['email','الإيميل (اختياري)'],['companyName','المشروع أو النشاط'],['websiteUrl','رابط الموقع'],['position','دوره في المشروع']].map(([key,label])=><label key={key} className="block space-y-2"><span>{label}</span><input className="w-full rounded-xl border p-3" type={key==='email'?'email':key==='websiteUrl'?'url':'text'} required={key==='name'} value={(profile as any)[key]} onChange={e=>setProfile(v=>({...v,[key]:e.target.value}))}/></label>)}<div className="flex gap-3"><button disabled={saving} className="px-4 py-2 rounded-xl bg-aethra-ink text-white">حفظ الملف</button><button disabled={saving} type="button" className="underline" onClick={()=>setEditing(false)}>إلغاء</button></div></form>}
      <h3 className="font-semibold">طلبات العميل</h3>
    </> : <>
      <div><h2 className="font-semibold text-lg">العملاء ({total})</h2><p className="text-sm text-surface-muted mt-2 leading-7">ملف واحد لكل عميل، وجواه كل طلباته بأرقام وحالات مستقلة.</p></div>
      <label className="flex items-center gap-3 rounded-xl border border-surface-border px-3 py-2"><Search className="w-4 h-4 text-surface-muted" /><span className="sr-only">البحث في العملاء</span><input value={search} onChange={event => { setPage(1); setSearch(event.target.value); }} placeholder="الاسم، المشروع، الهاتف أو البريد الإلكتروني" className="w-full bg-transparent py-1 text-sm outline-none" /></label>
    </>}
    {loading ? <p role="status" className="py-8 text-center text-sm text-surface-muted">جاري تحميل {selected ? 'الطلبات' : 'العملاء'}…</p>
      : error ? <div role="alert" className="p-5 bg-red-50 text-red-800 rounded-xl text-sm">{error} <button type="button" onClick={() => setAttempt(value => value + 1)} className="underline">إعادة المحاولة</button></div>
      : selected ? <>
        <div className="space-y-3">{requests.map(request => <button type="button" key={request._id} onClick={() => onOpenRequest(request._id)} className="block w-full text-right rounded-xl border border-surface-border p-4 hover:bg-aethra-paper focus-visible:ring-2 focus-visible:ring-aethra-cyan">
          <div className="flex flex-wrap justify-between gap-2"><span className="font-mono text-xs">{request.leadCode}</span><span className="text-xs rounded-full bg-aethra-paper px-3 py-1">{request.status}</span></div>
          <p className="text-xs text-surface-muted mt-3">{request.parentRequestCode?`أمر عمل تابع ${request.parentRequestCode}`:request.isBundleParent?'طلب مقسم على التراكات':'طلب مستقل'}</p>
          <p className="font-medium mt-3">{request.projectName || request.currentServiceId?.name || 'طلب خدمة'}</p>
          <p className="text-sm text-surface-muted mt-2 line-clamp-2">{request.projectDescription}</p>
          <div className="flex flex-wrap gap-2 mt-3">{request.serviceIds?.map(service => <span key={service._id} className="text-xs bg-aethra-cyan/15 rounded-lg px-2 py-1">{service.name}</span>)}</div>
          <p className="text-xs text-surface-muted mt-3">عن طريق: {request.submittedByUserId?.name||request.marketingEmployeeName||'العميل بنفسه'}{request.leadSource&&` · ${request.leadSource}`}</p>
          <p className="text-xs text-surface-muted mt-3">{request.assignedEngineerId?.name || 'بانتظار المراجعة والإسناد'} · {new Date(request.createdAt).toLocaleDateString('ar-EG')}</p>
        </button>)}{!requests.length && <p className="text-sm text-surface-muted py-8 text-center">لا توجد طلبات مرتبطة بهذا العميل.</p>}</div>
        {pagination(requestPage, requestPages, setRequestPage)}
      </> : <>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{customers.map(customer => <button key={customer._id} type="button" onClick={() => { setRequestPage(1); setSelected(customer); }} className="text-right border border-surface-border rounded-xl p-5 hover:bg-aethra-paper focus-visible:ring-2 focus-visible:ring-aethra-cyan">
          <div className="flex justify-between gap-3"><h3 className="font-semibold">{customer.name}</h3><Building2 className="w-5 h-5 shrink-0 text-surface-muted" /></div>
          <p className="text-sm text-surface-muted mt-2">{customer.companyName || 'عميل فردي'}</p>
          <p className="text-sm mt-4" dir="ltr">{customer.phone}</p><p className="text-xs text-surface-muted mt-2 truncate">{customer.email || customer.country}</p>
          <div className="flex gap-4 border-t border-surface-border mt-4 pt-3 text-xs"><span>{customer.requestCount} طلب</span><span className="text-surface-muted">{customer.activeRequestCount} طلب مفتوح</span></div>
          {customer.lastRequestAt && <p className="text-xs text-surface-muted mt-3">آخر طلب: {new Date(customer.lastRequestAt).toLocaleDateString('ar-EG')}</p>}
        </button>)}</div>
        {!customers.length && <p className="text-sm text-surface-muted py-8 text-center">{search ? 'لا توجد نتائج مطابقة للبحث.' : 'ملفات العملاء هتظهر هنا مع استقبال الطلبات.'}</p>}
        {pagination(page, pages, setPage)}
      </>}
  </section>;
}
