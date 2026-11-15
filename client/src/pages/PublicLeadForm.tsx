import {useClientBrand} from '../branding/client-brand';
import { VoiceRecorder } from '../components/VoiceRecorder';
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, Layers, Loader2, Plus, Send, Sparkles, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { PROJECT_TYPES, BUDGET_RANGES, PAYMENT_PREFERENCES, REFERRAL_SOURCES, FALLBACK_PHONE_COUNTRIES, captureCampaignAttribution, intakeLabel } from '../utils/intake';
import type { PhoneCountry } from '../utils/intake';
import { usePublicLanguage } from '../i18n/public-language';

interface ServiceField {
  name: string; label: string; type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox';
  required: boolean; options?: string[]; placeholder?: string;
  optionLabels?: Record<string, string>;
}
interface Service { _id: string; name: string; description?: string; trackId?: string; dynamicFormFields: ServiceField[] }
interface Department { _id: string; name: string; description?: string }
interface Attachment { filename: string; originalName?: string; url: string; size?: number; uploadToken?: string }
type Answers = Record<string, Record<string, string | number | boolean>>;
const initialForm = {
  customerName: '', companyName: '', email: '', phone: '', whatsappNumber: '', phoneCountryCode: 'EG', city:'', leadSource:'', campaignName:'', initialNotes:'', preferredContactMethod:'WHATSAPP',
  websiteUrl: '', socialLinks: '', position: '', projectName: '', projectDescription: '',
  mainGoal: '', targetAudience: '', hasExistingProject: '', problemToSolve: '', expectedResults: '',
  otherService: '', referenceLinks: '', currency: 'EGP', budgetRange: 'NOT_SURE',
  preferredStartDate: '', expectedDeadline: '', priority: 'MEDIUM', paymentPreference: '', referralSource: 'UNKNOWN', referralDetails: ''
};
const steps = ['نتواصل معاك إزاي؟', 'محتاج مساعدة في إيه؟', 'احكيلنا عن طلبك', 'تفاصيل لو تعرفها', 'راجع وأرسل'];
const inputClass = 'w-full min-w-0 max-w-full rounded-xl border border-surface-border bg-white px-3.5 py-3 text-sm text-aethra-ink outline-none focus:border-[#1396AF] focus:ring-2 focus:ring-aethra-cyan/20 disabled:opacity-60';
const lines = (value: string) => value.split('\n').map(link => link.trim()).filter(Boolean);
const validLinks = (value: string) => lines(value).every(link => { try { return ['http:', 'https:'].includes(new URL(link).protocol); } catch { return false; } });
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  const { t } = usePublicLanguage();
  return <label className="block min-w-0 space-y-2 text-sm font-medium text-aethra-ink"><span>{t(label)}{required && <span className="text-[#137A45] ms-1" aria-label={t("مطلوب")}>*</span>}</span>{children}</label>;
}
function OptionalDetails({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = usePublicLanguage();
  return <details className="rounded-xl border border-surface-border bg-aethra-paper/50 p-4"><summary className="cursor-pointer text-sm font-medium leading-7">{t(title)} <span className="text-surface-muted font-normal">{t("(اختياري)")}</span></summary><div className="space-y-5 pt-5">{children}</div></details>;
}

export const PublicLeadForm: React.FC<{staffUser?:any; editingLead?:any; onSaved?:()=>void}> = ({staffUser,editingLead,onSaved}) => {
  const { language, t } = usePublicLanguage();
  const {brand}=useClientBrand();
  const [form, setForm] = useState(initialForm);
  const [mode, setMode] = useState<'QUICK' | 'DETAILED' | 'VOICE'>('QUICK');
  const [countries, setCountries] = useState<PhoneCountry[]>(FALLBACK_PHONE_COUNTRIES);
  const [countriesFailed, setCountriesFailed] = useState(false);
  const [attribution] = useState(() => captureCampaignAttribution(window.location.href, document.referrer));
  const [step, setStep] = useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [catalogLanguage, setCatalogLanguage] = useState<string>('');
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [projectTypes, setProjectTypes] = useState<string[]>([]);
  const [serviceSelection, setServiceSelection] = useState<'SELECTED' | 'NOT_SURE' | 'OTHER'>('NOT_SURE');
  const [answers, setAnswers] = useState<Answers>({});
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [voiceRecording,setVoiceRecording]=useState<any>(null);
  const [unassign,setUnassign]=useState(false);
  useEffect(()=>{if(!editingLead)return;const next={...initialForm};for(const key of Object.keys(next) as (keyof typeof initialForm)[])if(editingLead[key]!==undefined)next[key]=['socialLinks','referenceLinks'].includes(key)?editingLead[key].join('\n'):['preferredStartDate','expectedDeadline'].includes(key)?String(editingLead[key]).slice(0,10):key==='hasExistingProject'?(editingLead[key]?'YES':'NO'):String(editingLead[key]);setForm(next);setMode('DETAILED');setDepartmentIds((editingLead.departmentIds?.length?editingLead.departmentIds:[editingLead.trackId].filter(Boolean)).map((v:any)=>v._id||v));setServiceIds((editingLead.serviceIds?.length?editingLead.serviceIds:[editingLead.currentServiceId||editingLead.initialServiceId].filter(Boolean)).map((v:any)=>v._id||v));setProjectTypes(editingLead.projectTypes||[]);setServiceSelection(editingLead.serviceSelection||((editingLead.currentServiceId||editingLead.initialServiceId)?'SELECTED':'NOT_SURE'));setAnswers(editingLead.serviceRequirements||{});setAttachments(editingLead.attachments||[]);setPrivacyAccepted(true);setContactAccepted(true);},[editingLead]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [contactAccepted, setContactAccepted] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [error, setError] = useState('');
  const [requestCode, setRequestCode] = useState('');
  const startedAt = useRef(Date.now());
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const visibleServices = catalogLanguage === language ? services : [];
  const visibleDepartments = catalogLanguage === language ? departments : [];
  const selectedServices = serviceSelection === 'SELECTED' ? visibleServices.filter(service => serviceIds.includes(service._id)) : [];
  const selectedDepartments = serviceSelection === 'SELECTED' ? visibleDepartments.filter(department => departmentIds.includes(department._id)) : [];
  const phoneCountry = countries.find(country => country.code === form.phoneCountryCode) || FALLBACK_PHONE_COUNTRIES[0];
  const countryNames = new Intl.DisplayNames([language], { type: 'region' });
  const countryLabel = (country: PhoneCountry) => countryNames.of(country.code) || country.code;
  const budgetLabel = (label: string) => /^[\d,\s–]+$/.test(label) ? `\u2066${label}\u2069` : t(label);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogState('loading');
    setCountriesFailed(false);
    axios.get('/api/public/countries', { signal: controller.signal }).then(res => {
      setCountries(res.data.data.countries);
    }).catch(() => { if (!controller.signal.aborted) setCountriesFailed(true); });
    axios.get(editingLead?`/api/manage/requests/${editingLead._id}/catalog`:'/api/public/services', { signal: controller.signal, params: { lang: language } }).then(res => {
      setServices(res.data.data.services); setDepartments(res.data.data.departments || []); setCatalogLanguage(language); setCatalogState('ready');
    }).catch(() => { if (!controller.signal.aborted) setCatalogState('error'); });
    return () => controller.abort();
  }, [catalogAttempt, language, editingLead?._id]);
  useEffect(() => {
    if (step === 0 && !requestCode) return;
    headingRef.current?.focus();
  }, [step, requestCode, mode]);
  useEffect(() => {
    for (const control of Array.from(formRef.current?.elements || [])) {
      if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) control.setCustomValidity('');
    }
  }, [language]);
  const update = (key: keyof typeof initialForm, value: string) => setForm(previous => ({ ...previous, [key]: value }));
  const toggle = (values: string[], id: string) => values.includes(id) ? values.filter(value => value !== id) : [...values, id];
  const changeDepartment = (id: string) => {
    setDepartmentIds(previous => toggle(previous, id));
    if (departmentIds.includes(id)) setServiceIds(previous => previous.filter(serviceId => services.find(service => service._id === serviceId)?.trackId !== id));
  };
  const changeService = (service: Service) => {
    setServiceIds(previous => toggle(previous, service._id));
    if (service.trackId) setDepartmentIds(previous => previous.includes(service.trackId!) ? previous : [...previous, service.trackId!]);
  };
  const go = (next: number) => { setError(''); setStep(next); };
  const validateStep = (final = false) => {
    for (const control of Array.from(formRef.current?.elements || [])) {
      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) continue;
      control.setCustomValidity('');
      if (control.validity.valueMissing) control.setCustomValidity(t('ده حقل مطلوب.'));
      else if (control.validity.typeMismatch) control.setCustomValidity(t(control instanceof HTMLInputElement && control.type === 'email' ? 'اكتب إيميل صحيح، أو سيب الحقل فاضي.' : 'اكتب رابط صحيح يبدأ بـ http أو https.'));
      else if (!control.validity.valid) control.setCustomValidity(t('راجع القيمة اللي كتبتها.'));
    }
    const invalid = Array.from(formRef.current?.elements || []).find(element =>
      (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) && !element.validity.valid);
    if (invalid) {
      let parent = invalid.parentElement;
      while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
    }
    if (!formRef.current?.reportValidity()) return false;
    let message = '';
    if ((mode === 'QUICK' || step === 0 || final) && (!validLinks(form.socialLinks) || lines(form.socialLinks).length > 10)) message = 'أدخل حتى 10 روابط للسوشيال، كل رابط http أو https في سطر مستقل.';
    if ((mode === 'QUICK' || step === 3 || final) && (!validLinks(form.referenceLinks) || lines(form.referenceLinks).length > 10)) message = 'أدخل حتى 10 روابط للمراجع، كل رابط http أو https في سطر مستقل.';
    if ((mode === 'QUICK' || step === 3 || final) && form.preferredStartDate && form.expectedDeadline && form.expectedDeadline < form.preferredStartDate) message = 'موعد التسليم لازم يكون بعد تاريخ البداية.';
    if (final && (!form.customerName.trim() || !form.phone.trim())) {
      message = 'اكتب اسمك ورقم الموبايل عشان نقدر نتواصل معاك.';
      if (mode === 'DETAILED') setStep(0);
    } else if (final && mode !== 'VOICE' && !form.projectDescription.trim()) {
      message = 'احكيلنا باختصار محتاج إيه، حتى لو لسه مش محدد الخدمة.';
      if (mode === 'DETAILED') setStep(2);
    }
    if(final && mode==='VOICE' && !voiceRecording)message='سجل طلبك أو ارفع ملف صوتي قبل الإرسال.';
    setError(message);
    return !message;
  };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (attachments.length >= 20) { toast.error(t('الحد الأقصى 20 ملف.')); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error(t('الحد الأقصى للملف الواحد 15 ميجابايت.')); return; }
    setUploading(true);
    try {
      const body = new FormData(); body.append('file', file);
      const res = await axios.post('/api/upload', body);
      setAttachments(previous => [...previous, res.data.data.file]);
    } catch (err: unknown) { toast.error(t(axios.isAxiosError(err) && err.response?.status === 413 ? 'الحد الأقصى للملف الواحد 15 ميجابايت.' : axios.isAxiosError(err) && err.response?.status === 400 ? 'نوع الملف غير مدعوم. استخدم صورة أو مستند أو ملف مضغوط.' : 'تعذر رفع الملف.')); }
    finally { setUploading(false); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const final = mode !== 'DETAILED' || step === 4;
    if (!validateStep(final) || uploading || submitting) return;
    if (!final) { go(step + 1); return; }
    setSubmitting(true); setError('');
    try {
      const payload = {
        ...form, leadSource:form.leadSource||undefined, country: phoneCountry.name, websiteUrl: form.websiteUrl || undefined,
        socialLinks: lines(form.socialLinks), referenceLinks: lines(form.referenceLinks),
        whatsappNumber: form.whatsappNumber || form.phone,
        preferredStartDate: form.preferredStartDate || undefined, expectedDeadline: form.expectedDeadline || undefined,
        paymentPreference: form.paymentPreference || undefined,
        hasExistingProject: form.hasExistingProject ? form.hasExistingProject === 'YES' : undefined,
        intakeVersion: 3, intakeMode: mode, campaignAttribution: attribution,
        preferredLanguage: language === 'en' ? 'EN' : 'AR',
        departmentIds: serviceSelection === 'SELECTED' ? departmentIds : [], serviceIds: serviceSelection === 'SELECTED' ? serviceIds : [], projectTypes, serviceSelection,
        serviceRequirements: Object.fromEntries(serviceIds.map(id => [id, answers[id] || {}])),
        unassign, voiceRecording:mode==='VOICE'?voiceRecording:undefined, attachments, privacyAccepted, contactAccepted, honeypot, formDurationMs: Date.now() - startedAt.current
      };
      const res = editingLead ? await axios.put(`/api/manage/requests/${editingLead._id}`,payload) : await axios.post(staffUser?'/api/leads/staff':'/api/public/leads', payload);
      if(editingLead){toast.success('تم حفظ بيانات الطلب.');onSaved?.();return;}
      setRequestCode(res.data.data.lead.leadCode);
    } catch (err: unknown) {
      const data = axios.isAxiosError(err) ? err.response?.data : undefined;
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      setError(status===409 && editingLead ? 'تغيير التراك يتطلب إلغاء الإسناد الحالي أولًا.' : status === 429 ? 'طلبات كثيرة، جرّب تاني بعد شوية.' : status === 400 && /الهاتف|الواتساب/.test(data?.message || '') ? 'راجع رقم الموبايل أو الواتساب للدولة المختارة.' : status === 400 ? 'بعض البيانات محتاجة مراجعة. راجع الحقول وجرب تاني.' : 'تعذر إرسال الطلب. بياناتك ما زالت موجودة؛ جرّب تاني.');
    } finally { setSubmitting(false); }
  };
  const reset = () => {
    setForm(initialForm); setMode('QUICK'); setStep(0); setRequestCode(''); setDepartmentIds([]); setServiceIds([]); setProjectTypes([]);
    setAnswers({}); setAttachments([]);setVoiceRecording(null); setServiceSelection('NOT_SURE'); setPrivacyAccepted(false); setContactAccepted(false);
    setHoneypot(''); setError(''); startedAt.current = Date.now();
  };
  const textInput = (key: keyof typeof initialForm, label: string, required = false, type = 'text') => (
    <Field label={t(label)} required={required}><input className={inputClass} value={form[key]} type={type} dir={['email', 'url', 'tel', 'date'].includes(type) ? 'ltr' : 'auto'} required={required}
      maxLength={key === 'websiteUrl' ? 2048 : 200} onChange={event => update(key, event.target.value)}
      onInput={type === 'date' ? event => update(key, event.currentTarget.value) : undefined} /></Field>
  );
  const textarea = (key: keyof typeof initialForm, label: string, required = false, placeholder?: string) => (
    <Field label={t(label)} required={required}><textarea className={inputClass} rows={3} dir="auto" value={form[key]} required={required}
      maxLength={20000} placeholder={t(placeholder || '')} onChange={event => update(key, event.target.value)} /></Field>
  );
  const contactFields = <>
    <div className="grid sm:grid-cols-2 gap-5">
      {textInput('customerName', staffUser?'اسم العميل':t("اسمك"), true)}
      <Field label={t("الدولة")} required><select className={inputClass} value={form.phoneCountryCode} onChange={event => update('phoneCountryCode', event.target.value)} autoComplete="country">
        {countries.map(country => <option key={country.code} value={country.code}>{countryLabel(country)} (⁦{country.callingCode}⁩)</option>)}
      </select></Field>
    </div>
    {countriesFailed && <p className="text-xs text-amber-900">{t("تعذر تحميل قائمة الدول كاملة.")} <button type="button" className="underline" onClick={() => setCatalogAttempt(value => value + 1)}>{t("حاول تاني")}</button></p>}
    <Field label={t("رقم الموبايل")} required><span dir="ltr" className="flex items-center rounded-xl border border-surface-border bg-white focus-within:border-[#1396AF] focus-within:ring-2 focus-within:ring-aethra-cyan/20">
      <span aria-label={t("كود الدولة")} className="shrink-0 px-4 py-3 border-r border-surface-border font-mono text-sm">{phoneCountry.callingCode}</span>
      <input type="tel" inputMode="tel" autoComplete="tel-national" required maxLength={30} value={form.phone} placeholder={t("اكتب باقي الرقم")} onChange={event => update('phone', event.target.value)} className="w-full min-w-0 rounded-r-xl border-0 bg-transparent px-3 py-3 text-sm outline-none" />
    </span></Field>
    <p className="text-xs text-surface-muted leading-6">{t("كود الدولة بيتحدد تلقائيًا. اكتب رقمك العادي، وممكن تسيب الصفر اللي في أوله.")}</p>
  </>;
  const staffFields=staffUser?<OptionalDetails title="تفاصيل المتابعة الداخلية">{textInput('city','المدينة (اختياري)')}{textInput('leadSource','اسم التطبيق أو مصدر الوصول بالتفصيل')}{textInput('campaignName','اسم الحملة (اختياري)')}{textarea('initialNotes','ملاحظات موظف الاستقبال')}<Field label="وسيلة التواصل المفضلة"><select className={inputClass} value={form.preferredContactMethod} onChange={e=>update('preferredContactMethod',e.target.value)}><option value="WHATSAPP">واتساب</option><option value="PHONE_CALL">مكالمة</option><option value="EMAIL">إيميل</option></select></Field></OptionalDetails>:null;
  const sourceFields = <>
    <Field label={t("عرفتنا منين؟ (اختياري)")}><select className={inputClass} value={form.referralSource} onChange={event => update('referralSource', event.target.value)}>{REFERRAL_SOURCES.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></Field>
    {form.referralSource === 'OTHER' && textInput('referralDetails', t("قولنا المكان لو تحب"))}{staffFields}
  </>;
  const extraContactFields = <OptionalDetails title={t("ضيف اسم مشروعك أو وسيلة تواصل تانية")}>
    <div className="grid sm:grid-cols-2 gap-5">{textInput('companyName', t("اسم المشروع أو النشاط، لو له اسم"))}{textInput('email', t("الإيميل، لو عندك"), false, 'email')}
      {textInput('whatsappNumber', t("رقم واتساب لو مختلف"), false, 'tel')}{textInput('position', t("دورك في المشروع، لو تحب"))}
    </div><p className="text-xs text-surface-muted leading-6">{t("واتساب بيستخدم نفس كود الدولة. لو رقمه من دولة تانية اكتبه كامل بالكود.")}</p>
    {textInput('websiteUrl', t("رابط موقعك، لو موجود"), false, 'url')}{textarea('socialLinks', t("روابط صفحاتك، لو موجودة"), false, t("رابط واحد في كل سطر، يبدأ بـ https://"))}
  </OptionalDetails>;
  const consentFields = editingLead?<p className="text-sm text-surface-muted">الموافقة الأصلية على التواصل محفوظة؛ التعديل لا يسجل موافقة جديدة.</p>:<div className="space-y-3">
    <details className="text-xs text-surface-muted leading-7"><summary className="cursor-pointer underline">{t("هنستخدم بياناتك في إيه؟")}</summary><p className="mt-2">{t("هنستخدم بيانات التواصل ووصف الطلب والمرفقات لمراجعة احتياجك والتواصل معاك بخصوصه. ماترفعش كلمات مرور أو بيانات دفع حساسة.")}</p></details>
    <label className="flex items-start gap-3 text-sm leading-7"><input className="mt-2" type="checkbox" required checked={privacyAccepted && contactAccepted} onChange={event => { setPrivacyAccepted(event.target.checked); setContactAccepted(event.target.checked); }} /><span>{t(staffUser?'العميل وافق على تسجيل بياناته والتواصل معاه بخصوص الطلب. *':'موافق على استخدام بياناتي لمراجعة الطلب والتواصل معايا بخصوصه. *')}</span></label>
  </div>;
  const files = <>
              <div className="rounded-xl border border-dashed border-surface-border bg-aethra-paper p-5 text-center">
                <UploadCloud className="w-7 h-7 mx-auto mb-3 text-surface-muted" /><p className="text-sm mb-2">{t("ارفع ملف المتطلبات أو الهوية أو أي مراجع تساعدنا")}</p>
                <p className="text-xs text-surface-muted mb-4">{t("حتى 20 ملف · 15 ميجابايت للملف الواحد")}</p>
                <label className="inline-flex items-center gap-2 rounded-xl bg-white border border-surface-border px-4 py-2 text-sm cursor-pointer"><Plus className="w-4 h-4" />{uploading ? t("جاري الرفع…") : t("اختار ملف")}<input type="file" className="sr-only" disabled={uploading || attachments.length >= 20} onChange={upload} /></label>
              </div>
              <ul className="space-y-2">{attachments.map(file => <li key={file.filename} className="flex justify-between items-center gap-3 border border-surface-border rounded-xl p-3 text-sm"><span className="truncate"><FileText className="w-4 h-4 inline me-2" />{file.originalName || file.filename}</span><button type="button" aria-label={t('إزالة {name}', {name: file.originalName || file.filename})} onClick={() => setAttachments(previous => previous.filter(item => item.filename !== file.filename))}><X className="w-4 h-4" /></button></li>)}</ul>
  </>;
  const summary = (
    <div className="space-y-5 text-sm">
      <div><p className="text-surface-muted text-xs mb-2">{t("طبيعة الطلب")}</p><p>{projectTypes.length ? projectTypes.map(code => t(intakeLabel(PROJECT_TYPES, code))).join(language === 'ar' ? t("، ") : ', ') : t("لسه هنحدد مع بعض")}</p></div>
      <div><p className="text-surface-muted text-xs mb-2">{t("الأقسام والخدمات")}</p><div className="flex flex-wrap gap-2">
        {selectedDepartments.map(department => <span key={department._id} className="rounded-lg bg-aethra-paper border border-surface-border px-2 py-1 text-xs">{department.name}</span>)}
        {selectedServices.map(service => <span key={service._id} className="rounded-lg bg-aethra-cyan/15 px-2 py-1 text-xs">{service.name}</span>)}
        {serviceSelection !== 'SELECTED' && <span>{serviceSelection === 'NOT_SURE' ? t("محتاج مساعدة في تحديد الخدمة") : form.otherService || t("خدمة أخرى")}</span>}
        {!serviceIds.length && serviceSelection === 'SELECTED' && <span className="text-surface-muted">{t("اختار الخدمات المناسبة لفكرتك")}</span>}
      </div></div>
      <div><p className="text-surface-muted text-xs mb-2">{t("الميزانية التقديرية")}</p><p>{budgetLabel(intakeLabel(BUDGET_RANGES, form.budgetRange))} {form.budgetRange !== 'NOT_SURE' && form.currency}</p></div>
    </div>
  );

  if (requestCode) return (
    <section dir={language === 'ar' ? 'rtl' : 'ltr'} className="max-w-2xl mx-auto my-8 rounded-2xl bg-white border border-surface-border p-8 sm:p-12 text-center">
      <CheckCircle2 className="w-14 h-14 mx-auto text-[#137A45] mb-5" />
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold text-aethra-ink outline-none">{t(staffUser?'تم تسجيل الطلب بنجاح':'طلبك وصل لفريق {company}').replace('{company}',brand.companyName)}</h1>
      <p className="text-surface-muted mt-3 leading-7">{t("هنراجع اللي كتبته ونتواصل معاك على رقمك، وأي تفاصيل ناقصة نكملها مع بعض.")}</p>
      <div className="my-7 p-5 rounded-xl border border-surface-border bg-aethra-paper"><p className="text-xs text-surface-muted mb-2">{t("رقم طلبك")}</p><strong dir="ltr" className="text-xl font-mono">{requestCode}</strong></div>
      <p className="text-sm text-surface-muted mb-6">{t("كل طلب جديد له رقم مستقل، حتى لو تعاملت معانا قبل كده.")}</p>
      <button type="button" onClick={reset} className="rounded-xl bg-aethra-ink text-white px-6 py-3 text-sm font-semibold">{t("تقديم طلب جديد")}</button>
    </section>
  );

  return (
    <section dir={language === 'ar' ? 'rtl' : 'ltr'} className={`mx-auto py-5 sm:py-8 px-3 sm:px-5 ${mode === 'QUICK' ? 'max-w-3xl' : 'max-w-6xl'}`}>
      {staffUser && <div className="mb-4 rounded-xl bg-white border border-surface-border p-4 text-sm leading-7"><strong>{editingLead?'تعديل بيانات الطلب':'تسجيل طلب بالنيابة عن عميل'}</strong><p>{editingLead?'التعديل بواسطة:':'مسجل بواسطة:'} {staffUser.name}. مصدر وصول العميل مستقل عن اسم الموظف، ومراحل المتابعة مع المهندس واحدة.</p>{editingLead && <><p>تعديلاتك محفوظة في سجل المراجعة، ولا تغيّر الموافقة الأصلية أو صاحب الإحالة.</p>{editingLead.assignedEngineerId && <label className="flex gap-2 items-center"><input type="checkbox" checked={unassign} onChange={e=>setUnassign(e.target.checked)}/>إلغاء الإسناد الحالي وإرجاع الطلب للمراجعة (عند تغيير التراك)</label>}</>}</div>}
      <div className="rounded-2xl public-hero bg-aethra-ink text-white p-5 sm:p-7 mb-5 relative overflow-hidden">
        <span className="hidden sm:inline-flex gap-2 items-center text-aethra-cyan text-xs font-semibold mb-3"><Sparkles className="w-4 h-4" />{t("نبدأ بفهم فكرتك")}</span>
        <h1 className="text-2xl sm:text-3xl font-semibold leading-relaxed">{t("احكيلنا محتاج إيه")}</h1>
        <p className="text-slate-300 text-sm leading-7 mt-3 max-w-xl">{t("سواء طلب شخصي، مشروع صغير، أو شركة؛ ابدأ باللي تعرفه وسيب الباقي علينا.")}</p>
        <p className="hidden sm:block mt-3 text-xs text-slate-300">{t("مش لازم تعرف كل التفاصيل. الفريق يكمل معاك أي حاجة ناقصة.")}</p>
      </div>
      <fieldset disabled={submitting} className="grid sm:grid-cols-3 gap-3 mb-5"><legend className="sr-only">{t("طريقة تقديم الطلب")}</legend>
        {([['QUICK', t("طلب سريع"), t("اسمك ورقمك وفكرتك، والفريق يكمل معاك")], ['DETAILED', t("طلب بالتفاصيل"), t("لو حابب تختار خدمات وتضيف تفاصيل أكتر")], ...(!editingLead ? [['VOICE', t('طلب صوتي'), t('احكي فكرتك والفريق ينسقها')]] as const : [])] as const).map(([value, title, description]) => <label key={value} className={`flex items-start gap-3 rounded-xl border p-3 sm:p-4 cursor-pointer ${mode === value ? 'bg-aethra-cyan/10 border-[#1396AF]' : 'bg-white border-surface-border'}`}>
          <input type="radio" name="intakeMode" checked={mode === value} onChange={() => { setMode(value as 'QUICK'|'DETAILED'|'VOICE'); setError(''); }} className="mt-1" /><span><span className="text-sm font-semibold">{t(title)}{value === 'QUICK' && <span className="hidden sm:inline text-[10px] ms-2 text-[#137A45]">{t("المقترح")}</span>}</span><span className="hidden sm:block mt-1 text-xs text-surface-muted leading-6">{t(description)}</span></span>
        </label>)}
      </fieldset>
      {mode === 'DETAILED' && <>
      <p className="text-xs text-surface-muted mb-4 leading-7">{t("مش لازم تجاوب على كل حاجة. تقدر تحوّل لطلب سريع فوق في أي وقت، وبياناتك هتفضل موجودة.")}</p>
      <ol aria-label={t("خطوات تقديم الطلب")} className="grid grid-cols-5 gap-1 sm:gap-3 mb-7">
        {steps.map((label, index) => <li key={label} className="min-w-0" aria-current={step === index ? 'step' : undefined}>
          <button type="button" disabled={index >= step} onClick={() => go(index)} className={`w-full min-w-0 text-center sm:text-start whitespace-normal border-t-2 pt-3 ${index <= step ? 'border-[#1396AF] text-aethra-ink' : 'border-surface-border text-surface-muted'}`}>
            <span className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-bold ${index === step ? 'bg-aethra-ink text-white' : index < step ? 'bg-aethra-cyan/20' : 'bg-white'}`}>{index < step ? <Check className="w-4 h-4" /> : index + 1}</span>
            <span className="block mt-2 text-[10px] sm:text-xs leading-5 break-words">{t(label)}</span>
          </button>
        </li>)}
      </ol></>}
      <div className={mode === 'DETAILED' ? 'grid lg:grid-cols-[minmax(0,1fr)_280px] gap-6 items-start' : ''}>
        <form ref={formRef} onSubmit={submit} noValidate className="bg-white border border-surface-border rounded-2xl p-5 sm:p-8 min-w-0" aria-busy={submitting}>
          <div className="mb-6">{mode === 'DETAILED' && <p className="text-xs text-surface-muted mb-2">{t('الخطوة {step} من {total}', {step: step + 1, total: 5})}</p>}<h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">{mode === 'QUICK' ? t("نبدأ بالأساسيات") : t(steps[step])}</h2><p className="text-sm text-surface-muted mt-2 leading-7">{t("مش محتاج شركة أو إيميل. المطلوب بس هو اللي عليه *، والباقي نقدر نكمله معاك.")}</p></div>
          <fieldset disabled={submitting} className="space-y-5 min-w-0">
            {mode !== 'DETAILED' ? <>
              {contactFields}{mode==='VOICE'?<VoiceRecorder value={voiceRecording} onChange={setVoiceRecording} onBusy={setUploading}/>:textarea('projectDescription', t("محتاج إيه؟ احكيلنا باختصار"), true, t("مثلاً: عندي مشروع أكل بيتي وعايز أوصل لعملاء أكتر، ومش عارف أبدأ منين."))}{sourceFields}
              {extraContactFields}<OptionalDetails title={t("ضيف اسم للطلب أو صورة توضح الفكرة")}>{textInput('projectName', t("اسم للطلب، لو تحب"))}{files}</OptionalDetails>
              {(selectedServices.length > 0 || form.budgetRange !== 'NOT_SURE') && <div className="rounded-xl bg-aethra-paper p-4">{summary}</div>}
              {consentFields}
            </> : <>

            {step === 0 && <>{contactFields}{sourceFields}{extraContactFields}</>}
            {step === 1 && <>
              <OptionalDetails title={t("حدد نوع الطلب لو تحب")}><fieldset><legend className="text-sm font-semibold mb-3">{t("نوع الطلب (اختياري)")} <span className="text-surface-muted font-normal">{t("— ممكن تختار أكتر من نوع")}</span></legend>
                <div className="grid sm:grid-cols-2 gap-3">{PROJECT_TYPES.map(([code, label]) => <label key={code} className={`flex gap-3 items-center border rounded-xl p-4 cursor-pointer text-sm ${projectTypes.includes(code) ? 'border-[#1396AF] bg-aethra-cyan/10' : 'border-surface-border'}`}>
                  <input type="checkbox" checked={projectTypes.includes(code)} onChange={() => setProjectTypes(previous => toggle(previous, code))} />{t(label)}
                </label>)}</div>
              </fieldset></OptionalDetails>
              <fieldset><legend className="text-sm font-semibold mb-3">{t("إزاي نقدر نساعدك؟")}</legend><div className="flex flex-wrap gap-3">
                {([['SELECTED', t("هختار الخدمات")], ['NOT_SURE', t("مش متأكد، ساعدوني أحدد")], ['OTHER', t("خدمة أخرى")]] as const).map(([value, label]) => <label key={value} className="flex gap-2 items-center text-sm border border-surface-border rounded-xl p-3 cursor-pointer"><input type="radio" name="serviceSelection" checked={serviceSelection === value} onChange={() => setServiceSelection(value)} />{t(label)}</label>)}
              </div></fieldset>
              {serviceSelection === 'OTHER' && textarea('otherService', t("اشرح الخدمة لو تحب، أو كمل للخطوة الجاية"))}
              {serviceSelection === 'NOT_SURE' && <p className="p-4 rounded-xl bg-aethra-paper text-sm leading-7">{t("ولا يهمك. كفاية تشرح طلبك بطريقتك في الخطوة الجاية، والفريق يساعدك يحدد الأنسب.")}</p>}
              {serviceSelection === 'SELECTED' && <>
              {catalogState === 'loading' && <p role="status" className="text-sm text-surface-muted">{t("جاري تحميل الأقسام والخدمات…")}</p>}
              {catalogState === 'error' && <div role="alert" className="text-sm text-amber-900 bg-amber-50 p-4 rounded-xl">{t("تعذر تحميل الخدمات.")} <button type="button" className="underline" onClick={() => setCatalogAttempt(previous => previous + 1)}>{t("إعادة المحاولة")}</button>{t("أو اختار «محتاج مساعدة».")}</div>}
              {catalogState === 'ready' && <>
                <fieldset><legend className="text-sm font-semibold mb-3">{t("اختار المجال لو تعرفه")} <span className="font-normal text-surface-muted">{t("— اختيار متعدد")}</span></legend>
                  <div className="grid sm:grid-cols-2 gap-3">{visibleDepartments.map(department => <label key={department._id} className={`flex gap-3 items-center rounded-xl border p-4 text-sm cursor-pointer ${departmentIds.includes(department._id) ? 'border-[#1396AF] bg-aethra-cyan/10' : 'border-surface-border'}`}>
                    <input type="checkbox" checked={departmentIds.includes(department._id)} onChange={() => changeDepartment(department._id)} /><Layers className="w-4 h-4 shrink-0" />{department.name}
                  </label>)}</div>
                </fieldset>
                {visibleServices.filter(service => !service.trackId || departmentIds.includes(service.trackId)).map(service => <label key={service._id} className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer ${serviceIds.includes(service._id) ? 'border-[#1396AF]' : 'border-surface-border'}`}>
                  <input type="checkbox" checked={serviceIds.includes(service._id)} onChange={() => changeService(service)} className="mt-1" /><span><span className="text-sm font-medium">{service.name}</span>{service.description && <span className="block text-xs text-surface-muted leading-6 mt-1">{service.description}</span>}</span>
                </label>)}
                {!visibleServices.length && <p className="text-sm text-surface-muted">{t("مفيش خدمات منشورة حاليًا. اختار «محتاج مساعدة» واكتب تفاصيل طلبك.")}</p>}
              </>}
              </>}
            </>}
            {step === 2 && <>
              {textarea('projectDescription', t("محتاج إيه؟ احكيلنا باختصار"), true, t("اكتب بطريقتك، حتى لو لسه مش عارف اسم الخدمة."))}<OptionalDetails title={t("ضيف تفاصيل أكتر لو تعرفها")}>{textInput('projectName', t("اسم للطلب، لو تحب"))}
              {textarea('mainGoal', t("عايز توصل لإيه؟ لو تعرف"))}{textInput('targetAudience', t("مين حابب توصل لهم؟ لو تعرف"))}
              <Field label={t("هل عندك مشروع قائم؟")}><select className={inputClass} value={form.hasExistingProject} onChange={event => update('hasExistingProject', event.target.value)}><option value="">{t("اختياري")}</option><option value="YES">{t("أيوه")}</option><option value="NO">{t("لأ، هنبدأ من جديد")}</option></select></Field>
              {textarea('problemToSolve', t("إيه المشكلة اللي محتاج تحلها؟"))}{textarea('expectedResults', t("إيه النتائج اللي تتوقعها؟"))}
              {selectedServices.filter(service => service.dynamicFormFields.length > 0).map(service => <fieldset key={service._id} className="rounded-xl bg-aethra-paper border border-surface-border p-4 space-y-4"><legend className="px-2 text-sm font-semibold">{t("تفاصيل")} {service.name}</legend>
                {service.dynamicFormFields.map(field => {
                  const value = answers[service._id]?.[field.name];
                  const change = (next: string | number | boolean) => setAnswers(previous => ({ ...previous, [service._id]: { ...previous[service._id], [field.name]: next } }));
                  if (field.type === 'checkbox') return <label key={field.name} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={value === true}  onChange={event => change(event.target.checked)} />{field.label}</label>;
                  return <Field key={field.name} label={field.label} >
                    {field.type === 'select' ? <select className={inputClass}  value={typeof value === 'string' ? value : ''} onChange={event => change(event.target.value)}><option value="">{t("مش متأكد / نحدده مع بعض")}</option>{field.options?.map(option => <option key={option} value={option}>{field.optionLabels?.[option] || option}</option>)}</select>
                      : field.type === 'textarea' ? <textarea className={inputClass} rows={3}  maxLength={20000} value={typeof value === 'string' ? value : ''} onChange={event => change(event.target.value)} placeholder={field.placeholder} />
                      : <input className={inputClass} type={field.type}  step={field.type === 'number' ? 'any' : undefined} value={typeof value === 'string' || typeof value === 'number' ? value : ''} maxLength={20000} onChange={event => change(field.type === 'number' && event.target.value ? Number(event.target.value) : event.target.value)} placeholder={field.placeholder} />}
                  </Field>;
                })}
              </fieldset>)}
              </OptionalDetails>
            </>}
            {step === 3 && <>
              <div className="p-4 rounded-xl bg-aethra-paper text-sm leading-7">{t("كل اللي هنا اختياري. لو لسه مش محدد ميزانية أو موعد نرتبهم معاك بعدين.")}<button type="button" className="block underline mt-2 font-medium" onClick={() => { if (validateStep()) go(4); }}>{t("تخطي للمراجعة")}</button></div>
              <div className="grid sm:grid-cols-2 gap-5"><Field label={t("العملة")}><select className={inputClass} value={form.currency} onChange={event => update('currency', event.target.value)}>{['EGP', 'USD', 'SAR', 'AED', 'EUR'].map(currency => <option key={currency}>{currency}</option>)}</select></Field>
                <Field label={t('نطاق الميزانية ({currency})', {currency: form.currency})}><select className={inputClass} value={form.budgetRange} onChange={event => update('budgetRange', event.target.value)}>{BUDGET_RANGES.map(([value, label]) => <option key={value} value={value}>{budgetLabel(label)}</option>)}</select></Field>
                {textInput('preferredStartDate', t("تاريخ البداية المفضل"), false, 'date')}{textInput('expectedDeadline', t("موعد التسليم المطلوب"), false, 'date')}
                <Field label={t("أولوية المشروع")}><select className={inputClass} value={form.priority} onChange={event => update('priority', event.target.value)}><option value="LOW">{t("مرن")}</option><option value="MEDIUM">{t("عادي")}</option><option value="HIGH">{t("مهم")}</option><option value="URGENT">{t("عاجل")}</option></select></Field>
                <Field label={t("طريقة الدفع المفضلة")}><select className={inputClass} value={form.paymentPreference} onChange={event => update('paymentPreference', event.target.value)}><option value="">{t("نحددها مع بعض")}</option>{PAYMENT_PREFERENCES.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></Field>
              </div>
              <p className="text-xs text-surface-muted leading-6">{t("الميزانية تقديرية وليست عرض سعر نهائي. الوقت والتكلفة بيتحددوا بعد مراجعة نطاق العمل.")}</p>
              {textarea('referenceLinks', t("روابط أمثلة أو مراجع (اختياري)"), false, t("https://… رابط واحد في كل سطر"))}
              {files}
            </>}
            {step === 4 && <>
              <p className="text-sm text-surface-muted leading-7">{t("راجع بيانات التواصل واللي كتبته. مش لازم كل التفاصيل تكون مكتملة؛ الباقي نكمله سوا.")}</p>
              <div className="rounded-xl border border-surface-border p-4 space-y-3"><div className="flex justify-between"><h3 className="font-semibold text-sm">{t("بيانات التواصل")}</h3><button type="button" onClick={() => go(0)} className="text-xs underline">{t("تعديل")}</button></div><p>{form.customerName}{form.companyName && ` · ${form.companyName}`}</p><p className="text-sm"><bdi>{phoneCountry.callingCode} {form.phone}</bdi></p>{form.email && <p className="text-sm">{form.email}</p>}<p className="text-sm">{countryLabel(phoneCountry)}{form.whatsappNumber && ` ${t('· واتساب:')} ${form.whatsappNumber}`}</p>{form.referralSource !== 'UNKNOWN' && <p className="text-sm">{t("عرفتنا منين:")} {t(intakeLabel(REFERRAL_SOURCES, form.referralSource))} {form.referralSource === 'OTHER' ? form.referralDetails : ''}</p>}{form.position && <p className="text-sm">{form.position}</p>}{form.websiteUrl && <p className="text-sm break-all">{form.websiteUrl}</p>}{lines(form.socialLinks).map(link => <p key={link} className="text-sm break-all">{link}</p>)}</div>
              <div className="rounded-xl border border-surface-border p-4"><div className="flex justify-between mb-4"><h3 className="font-semibold text-sm">{t("الخدمات المطلوبة")}</h3><button type="button" onClick={() => go(1)} className="text-xs underline">{t("تعديل")}</button></div>{summary}</div>
              <div className="rounded-xl border border-surface-border p-4 space-y-3"><div className="flex justify-between"><h3 className="font-semibold text-sm">{form.projectName || t("وصف طلبك")}</h3><button type="button" onClick={() => go(2)} className="text-xs underline">{t("تعديل")}</button></div>
                {([[t("الوصف"), form.projectDescription], [t("الهدف"), form.mainGoal], [t("الجمهور"), form.targetAudience], [t("مشروع قائم"), form.hasExistingProject === 'YES' ? t("أيوه") : form.hasExistingProject === 'NO' ? t("لأ") : ''], [t("المشكلة"), form.problemToSolve], [t("النتائج المتوقعة"), form.expectedResults]]).filter(([, value]) => value).map(([label, value]) => <p key={label} className="text-sm whitespace-pre-wrap break-words"><span className="text-surface-muted">{label}: </span>{value}</p>)}
                {selectedServices.map(service => <div key={service._id}>{service.dynamicFormFields.map(field => { const value = answers[service._id]?.[field.name]; return value !== undefined && value !== '' ? <p key={field.name} className="text-sm whitespace-pre-wrap break-words">{service.name} · {field.label}: {typeof value === 'boolean' ? value ? t("نعم") : t("لا") : field.type === 'select' ? field.optionLabels?.[String(value)] || value : value}</p> : null; })}</div>)}
              </div>
              <div className="rounded-xl border border-surface-border p-4 space-y-3"><div className="flex justify-between"><h3 className="font-semibold text-sm">{t("المواعيد والمراجع")}</h3><button type="button" onClick={() => go(3)} className="text-xs underline">{t("تعديل")}</button></div><p className="text-sm">{t("البداية:")} {form.preferredStartDate || t("حسب الاتفاق")}{t("· التسليم:")} {form.expectedDeadline || t("حسب الاتفاق")}</p><p className="text-sm">{t("الدفع:")} {t(intakeLabel(PAYMENT_PREFERENCES, form.paymentPreference))}{t("· الأولوية:")} {{ LOW: t("مرن"), MEDIUM: t("عادي"), HIGH: t("مهم"), URGENT: t("عاجل") }[form.priority]}</p>{lines(form.referenceLinks).map(link => <p key={link} className="text-sm break-all">{link}</p>)}{attachments.map(file => <p key={file.filename} className="text-sm">{file.originalName || file.filename}</p>)}{!attachments.length && <p className="text-sm text-surface-muted">{t("بدون مرفقات")}</p>}</div>
              {consentFields}
            </>}
            </>}
          </fieldset>
          <input aria-hidden="true" tabIndex={-1} autoComplete="off" className="hidden" name="company_website_check" value={honeypot} onChange={event => setHoneypot(event.target.value)} />
          {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 border border-red-200 text-red-800 p-4 text-sm leading-7">{t(error)}</p>}
          <div className={`flex gap-3 border-t border-surface-border mt-7 pt-5 ${mode === 'QUICK' ? 'justify-end' : 'justify-between'}`}>
            {mode === 'DETAILED' && <button type="button" disabled={step === 0 || submitting} onClick={() => go(step - 1)} className="inline-flex gap-2 items-center rounded-xl border border-surface-border px-4 py-3 text-sm disabled:opacity-40"><ArrowRight className="w-4 h-4" />{t("السابق")}</button>}
            <button type="submit" disabled={uploading || submitting} className="inline-flex gap-2 items-center rounded-xl bg-aethra-ink text-white px-5 py-3 text-sm font-semibold disabled:opacity-50">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : mode !== 'DETAILED' || step === 4 ? <Send className="w-4 h-4" /> : null}{submitting ? t("جاري الإرسال…") : mode !== 'DETAILED' || step === 4 ? editingLead?'حفظ التعديلات':t("ابعت الطلب ونتواصل معاك") : t("التالي")}{mode === 'DETAILED' && step < 4 && <ArrowLeft className="w-4 h-4" />}</button>
          </div>
        </form>
        {mode === 'DETAILED' && <aside className="hidden lg:block sticky top-24 rounded-2xl border border-surface-border bg-white p-6"><p className="text-xs text-surface-muted mb-2">{t("فكرتك بتاخد شكل")}</p><h2 className="text-base font-semibold mb-6">{t("ملخص طلبك")}</h2>{summary}<p className="text-xs text-surface-muted leading-6 border-t border-surface-border mt-6 pt-4">{t("بعد الإرسال هتستلم رقم طلب مستقل، وفريقنا هيراجع التفاصيل ويحدد الخطوة المناسبة.")}</p></aside>}
      </div>
    </section>
  );
};
