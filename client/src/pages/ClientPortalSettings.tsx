import React,{useEffect,useState} from 'react';
import axios from 'axios';
import {toast} from 'sonner';
import {useClientBrand} from '../branding/client-brand';

export function ClientPortalSettings(){
  const {brand,ready,error,refresh,setBrand}=useClientBrand();
  const [name,setName]=useState(brand.companyName);const [phone,setPhone]=useState(brand.whatsapp);
  const [logo,setLogo]=useState<string|null>(brand.logoFilename);const [preview,setPreview]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{setName(brand.companyName);setPhone(brand.whatsapp);setLogo(brand.logoFilename);setPreview('');},[brand]);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  if(!ready)return <div className="p-6 bg-white rounded-xl border" role="status">{error?<><p>تعذر تحميل إعدادات الهوية.</p><button className="underline" onClick={refresh}>إعادة المحاولة</button></>:'جاري تحميل إعدادات الهوية…'}</div>;
  const control='w-full rounded-xl border border-surface-border bg-white p-3';
  return <section className="bg-white rounded-2xl border border-surface-border p-5 sm:p-7 space-y-6 max-w-3xl">
    <div><h2 className="text-xl font-semibold">هوية صفحة تسجيل العملاء</h2><p className="mt-3 text-sm text-surface-muted leading-7">الاسم واللوجو يظهروا في صفحة استقبال العملاء ورسالة نجاح الطلب. صفحات فريق العمل تظل بهوية Aethra. إعداد الهوية حصري لحساب إدارة المنظومة ولا يُفوض للأدوار الأخرى.</p></div>
    <form className="space-y-5" onSubmit={async event=>{event.preventDefault();setBusy(true);try{const res=await axios.put('/api/manage/client-brand',{companyName:name,whatsapp:phone,logoFilename:logo,revision:brand.revision});setBrand(res.data.data.brand);toast.success('تم حفظ هوية صفحة العملاء.');}catch(e:any){toast.error(e.response?.data?.message||'تعذر حفظ الهوية.');}finally{setBusy(false);}}}>
      <label className="block space-y-2"><span>اسم الشركة</span><input className={control} required maxLength={100} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label>
      <label className="block space-y-2"><span>رقم واتساب التواصل بكود الدولة</span><input className={control} required dir="ltr" inputMode="tel" pattern="[1-9][0-9]{6,14}" value={phone} onChange={e=>setPhone(e.target.value)} disabled={busy}/><span className="block text-sm text-surface-muted">مثال مصر: 201116247717، بدون علامة + أو صفر البداية المحلي.</span></label>
      <div className="rounded-xl border bg-[#f7f7f7] p-4"><img src={preview||brand.logoUrl} alt="معاينة لوجو صفحة العملاء" className="w-48 max-h-48 object-contain mx-auto"/></div>
      <label className="block space-y-2"><span>صورة اللوجو</span><input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={async event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>5*1024*1024){toast.error('اختر صورة حتى 5 ميجابايت.');event.target.value='';return;}setBusy(true);try{const data=new FormData();data.append('file',file);const res=await axios.post('/api/upload',data);setLogo(res.data.data.file.filename);setPreview(URL.createObjectURL(file));}catch(e:any){toast.error(e.response?.data?.message||'تعذر رفع الصورة.');}finally{setBusy(false);}}}/><span className="block text-sm text-surface-muted">PNG أو JPG حتى 5 ميجابايت. يتغير اللوجو بعد الضغط على حفظ.</span></label>
      <button disabled={busy} className="rounded-xl bg-aethra-ink text-white px-6 py-3">{busy?'جاري الحفظ…':'حفظ هوية صفحة العملاء'}</button>
    </form>
  </section>;
}
