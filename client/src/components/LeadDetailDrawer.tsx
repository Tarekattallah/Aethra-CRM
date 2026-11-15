import { RequestCoordination,FinalPayment } from './RequestCoordination';
import { RequestEditor } from './RequestEditor';
import { VoicePlayback } from './VoicePlayback';
import { isAdministrator, hasPermission } from '../utils/auth';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  X,
  Phone,
  Mail,
  Clock,
  Send,
  MessageSquare,
  FileText,
  CheckCircle2,
  AlertCircle,
  Tag,
  DollarSign,
  Calendar,
  History,
  PhoneCall,
  UserCheck,
  Code2,
  ListChecks,
  Sparkles,
  Edit3,
  Layers,
  Wrench,
  Upload,
  Paperclip,
  File,
  Download,
  CheckSquare,
  Square,
  Trash2,
  Plus,
  CreditCard,
  Image as ImageIcon,
  Check,
  ExternalLink,
  ShieldCheck,
  Eye,
  AlertTriangle,
  Zap,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { OrbitLoader } from './OrbitLoader';
import { RequestIntakeSummary } from './RequestIntakeSummary';

interface LeadDetailDrawerProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated: () => void;
  user: any;onSelectLead?:(id:string)=>void;onOpenExecution?:(id:string)=>void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  leadId,
  isOpen,
  onClose,
  onLeadUpdated,
  user,onSelectLead,onOpenExecution
}) => {
  const [refreshTick,setRefreshTick]=useState(0);
  const refreshRequest=()=>{setRefreshTick(v=>v+1);onLeadUpdated();};
  const [editingIntake,setEditingIntake]=useState(false);
  const [lead, setLead] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // SLA Timers Countdown state
  const [ackSecondsLeft, setAckSecondsLeft] = useState<number | null>(null);
  const [contactSecondsLeft, setContactSecondsLeft] = useState<number | null>(null);

  // Step 1: استلام الطلب
  const [acknowledging, setAcknowledging] = useState(false);

  // Step 2: تأكيد التواصل
  const [confirmingContact, setConfirmingContact] = useState(false);

  // Step 3: تفاصيل التواصل والمتطلبات الفنية
  const [communicationMethod, setCommunicationMethod] = useState<'WHATSAPP' | 'PHONE_CALL' | 'MEETING' | 'EMAIL'>('WHATSAPP');
  const [clientDiscussionNotes, setClientDiscussionNotes] = useState('');
  const [chatTranscript, setChatTranscript] = useState('');
  const [chatAttachments, setChatAttachments] = useState<any[]>([]);
  const [clientRequirements, setClientRequirements] = useState<any[]>([]);
  const [newReqTitle, setNewReqTitle] = useState('');
  const [uploadingChatAttachment, setUploadingChatAttachment] = useState(false);

  // Technical Intake Details
  const [projectScope, setProjectScope] = useState('');
  const [deliverablesText, setDeliverablesText] = useState('');
  const [agreedBudget, setAgreedBudget] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [toolsOrTechStack, setToolsOrTechStack] = useState('');
  const [technicalNotes, setTechnicalNotes] = useState('');
  const [isEditingTechnical, setIsEditingTechnical] = useState(false);
  const [savingTechnical, setSavingTechnical] = useState(false);

  // Step 4: إثبات الدفع والتعاقد
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState('USD');
  const [paymentType, setPaymentType] = useState<'FULL' | 'DEPOSIT' | 'FINAL'>('FULL');
  const [paymentMethod, setPaymentMethod] = useState('تحويل بنكي مباشر (Bank Transfer)');
  const [paymentReceiptUrl, setPaymentReceiptUrl] = useState('');
  const [paymentReceiptFilename, setPaymentReceiptFilename] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  // Pipeline Status Change State
  const [status, setStatus] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [conversionValue, setConversionValue] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // New Activity form
  const [activityType, setActivityType] = useState('CALL');
  const [activityTitle, setActivityTitle] = useState('مكالمة هاتفية');
  const [activityContent, setActivityContent] = useState('');
  const [callOutcome, setCallOutcome] = useState('ANSWERED');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [addingActivity, setAddingActivity] = useState(false);

  // جلب تفاصيل العميل والـ Timeline
  useEffect(() => {
    if (!isOpen || !leadId) return;

    let active = true;
    setLead(null);
    setActivities([]);
    setConversionValue(''); setLostReason(''); setCommunicationMethod('WHATSAPP');
    setClientDiscussionNotes(''); setChatTranscript(''); setChatAttachments([]); setClientRequirements([]);
    setPaymentAmount(''); setPaymentCurrency('USD'); setPaymentType('FULL'); setPaymentMethod('تحويل بنكي مباشر (Bank Transfer)');
    setPaymentReceiptUrl(''); setPaymentReceiptFilename(''); setPaymentNotes('');
    setNextFollowUpDate(''); setActivityContent('');
    setLoading(true);
    const token = localStorage.getItem('token');
    axios.get(`/api/leads/${leadId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        if (active && res.data.success) {
          const l = res.data.data.lead;
          setLead(l);
          setActivities(res.data.data.activities);
          setStatus(l.status);
          if (l.conversionValue) setConversionValue(l.conversionValue);
          if (l.lostReason) setLostReason(l.lostReason);

          // ملء حقول الخطوة 3
          if (l.communicationMethod) setCommunicationMethod(l.communicationMethod);
          if (l.clientDiscussionNotes) setClientDiscussionNotes(l.clientDiscussionNotes);
          if (l.chatTranscript) setChatTranscript(l.chatTranscript);
          if (l.chatAttachments) setChatAttachments(l.chatAttachments || []);
          if (l.clientRequirements) setClientRequirements(l.clientRequirements || []);

          if (l.technicalIntake) {
            setProjectScope(l.technicalIntake.projectScope || l.projectDescription || '');
            setDeliverablesText((l.technicalIntake.deliverables || []).join('\n'));
            setAgreedBudget(l.technicalIntake.agreedBudget || l.estimatedBudget || '');
            setCurrency(l.technicalIntake.currency || l.currency || 'USD');
            setEstimatedDuration(l.technicalIntake.estimatedDuration || '');
            setToolsOrTechStack(l.technicalIntake.toolsOrTechStack || '');
            setTechnicalNotes(l.technicalIntake.technicalNotes || '');
            setIsEditingTechnical(!l.technicalIntake.isCompleted);
          } else {
            setIsEditingTechnical(true);
          }

          // ملء حقول الخطوة 4 (إثبات الدفع)
          if (l.paymentReceipt) {
            setPaymentAmount(l.paymentReceipt.amount?.toString() || '');
            setPaymentCurrency(l.paymentReceipt.currency || l.currency || 'USD');
            if (l.paymentReceipt.paymentType) setPaymentType(l.paymentReceipt.paymentType);
            setPaymentMethod(l.paymentReceipt.paymentMethod || 'تحويل بنكي مباشر (Bank Transfer)');
            setPaymentReceiptUrl(l.paymentReceipt.receiptUrl || '');
            setPaymentReceiptFilename(l.paymentReceipt.receiptFilename || '');
            setPaymentNotes(l.paymentReceipt.notes || '');
          }
        }
      })
      .catch(() => {
        toast.error('فشل جلب تفاصيل العميل.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, leadId, refreshTick]);

  // مؤقتات الـ SLA التنازلية الحية
  useEffect(() => {
    if (!lead) return;

    const timer = setInterval(() => {
      // مؤقت الخطوة 1: استلام الطلب
      if (!lead.acknowledgedAt && lead.assignedAt) {
        const deadline = lead.slaAcknowledgeDeadline
          ? new Date(lead.slaAcknowledgeDeadline).getTime()
          : new Date(lead.assignedAt).getTime() + 10 * 60000;
        const diff = Math.floor((deadline - Date.now()) / 1000);
        setAckSecondsLeft(diff);
      } else {
        setAckSecondsLeft(null);
      }

      // مؤقت الخطوة 2: تأكيد التواصل بعد الاستلام
      if (lead.acknowledgedAt && !lead.contactConfirmedAt) {
        const deadline = lead.slaContactDeadline
          ? new Date(lead.slaContactDeadline).getTime()
          : new Date(lead.acknowledgedAt).getTime() + 5 * 60000;
        const diff = Math.floor((deadline - Date.now()) / 1000);
        setContactSecondsLeft(diff);
      } else {
        setContactSecondsLeft(null);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lead]);

  // إغلاق النافذة المنبثقة بزر Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const formatTimer = (seconds: number | null) => {
    if (seconds === null) return '';
    if (seconds <= 0) return 'انتهت المهلة!';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 1. تأكيد استلام الطلب (Step 1)
  const handleAcknowledgeLead = async () => {
    setAcknowledging(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`/api/leads/${leadId}/acknowledge`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        toast.success(res.data.message);
        setLead(res.data.data.lead);
        onLeadUpdated();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل تأكيد استلام الطلب.');
    } finally {
      setAcknowledging(false);
    }
  };

  // 2. تأكيد التواصل مع العميل (Step 2)
  const handleConfirmContact = async () => {
    setConfirmingContact(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`/api/leads/${leadId}/confirm-contact`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        toast.success(res.data.message);
        setLead(res.data.data.lead);
        setStatus('CONTACTED');
        onLeadUpdated();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل تأكيد التواصل مع العميل.');
    } finally {
      setConfirmingContact(false);
    }
  };

  // 3. رفع مرفق شات أو مستند PDF (Step 3)
  const handleUploadChatAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingChatAttachment(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        toast.success('تم رفع الملف بنجاح.');
        setChatAttachments(prev => [...prev, res.data.data.file]);
      }
    } catch {
      toast.error('فشل رفع الملف. تأكد أن نوع الملف مدعوم (PDF، صورة، Word) بحجم أقل من 15MB.');
    } finally {
      setUploadingChatAttachment(false);
      e.target.value = '';
    }
  };

  // إدارة متطلبات العميل (Checklist)
  const handleAddRequirement = () => {
    if (!newReqTitle.trim()) return;
    const newReq = {
      id: Date.now().toString(),
      title: newReqTitle.trim(),
      isDone: false
    };
    setClientRequirements(prev => [...prev, newReq]);
    setNewReqTitle('');
  };

  const handleToggleRequirement = (id: string) => {
    setClientRequirements(prev => prev.map(r => r.id === id ? { ...r, isDone: !r.isDone } : r));
  };

  const handleRemoveRequirement = (id: string) => {
    setClientRequirements(prev => prev.filter(r => r.id !== id));
  };

  // حفظ واعتماد المواصفات الفنية والمتطلبات (Step 3)
  const handleSaveTechnicalIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectScope.trim()) {
      toast.error('يرجى كتابة نطاق عمل المشروع.');
      return;
    }

    setSavingTechnical(true);
    try {
      const token = localStorage.getItem('token');
      const deliverables = deliverablesText
        .split('\n')
        .map(d => d.trim())
        .filter(d => d.length > 0);

      const payload = {
        communicationMethod,
        clientDiscussionNotes: clientDiscussionNotes.trim(),
        chatTranscript: chatTranscript.trim(),
        chatAttachments,
        clientRequirements,
        projectScope: projectScope.trim(),
        deliverables,
        agreedBudget: agreedBudget ? Number(agreedBudget) : undefined,
        currency,
        estimatedDuration: estimatedDuration.trim() || undefined,
        toolsOrTechStack: toolsOrTechStack.trim() || undefined,
        technicalNotes: technicalNotes.trim() || undefined
      };

      const res = await axios.post(`/api/leads/${leadId}/technical-intake`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        toast.success('تم توثيق واعتماد المواصفات الفنية ومتطلبات العميل بنجاح.');
        setLead(res.data.data.lead);
        setIsEditingTechnical(false);
        onLeadUpdated();

        // تحديث الخط الزمني
        const actRes = await axios.get(`/api/leads/${leadId}/activities`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (actRes.data.success) {
          setActivities(actRes.data.data.activities);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل توثيق المواصفات الفنية.');
    } finally {
      setSavingTechnical(false);
    }
  };

  // 4. رفع إيصال الدفع (Step 4)
  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingReceipt(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        toast.success('تم رفع إيصال الدفع بنجاح.');
        setPaymentReceiptUrl(res.data.data.file.url);
        setPaymentReceiptFilename(res.data.data.file.originalName || res.data.data.file.filename);
      }
    } catch {
      toast.error('فشل رفع إيصال الدفع. يرجى رفع صورة أو مستند PDF.');
    } finally {
      setUploadingReceipt(false);
      e.target.value = '';
    }
  };

  // تأكيد استلام الدفعة المالية وإغلاق الصفقة (Step 4)
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount) {
      toast.error('يرجى إدخال المبلغ المدفوع.');
      return;
    }
    if (!paymentReceiptUrl) {
      toast.error('يرجى رفع صورة أو PDF لإيصال/وصل التحويل المالي.');
      return;
    }

    setConfirmingPayment(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        amount: Number(paymentAmount),
        currency: paymentCurrency,
        paymentType,
        paymentMethod,
        receiptUrl: paymentReceiptUrl,
        receiptFilename: paymentReceiptFilename,
        notes: paymentNotes
      };

      const res = await axios.post(`/api/leads/${leadId}/confirm-payment`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        toast.success(res.data.message || 'تم تأكيد استلام الدفعة.');
        setLead(res.data.data.lead);
        setStatus(res.data.data.lead.status);
        onLeadUpdated();

        const actRes = await axios.get(`/api/leads/${leadId}/activities`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (actRes.data.success) setActivities(actRes.data.data.activities);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل تأكيد استلام الدفعة.');
    } finally {
      setConfirmingPayment(false);
    }
  };

  // تحديث حالة العميل العامة
  const handleUpdateStatus = async (newStatus: string) => {
    if (newStatus === 'CONVERTED' && (!lead.paymentReceipt?.isReceived || lead.paymentReceipt.paymentType === 'DEPOSIT')) {
      toast.info('لإغلاق الصفقة كـ [ناجحة CONVERTED]، يرجى إدخال المبلغ ورفع صورة أو PDF للإيصال في المرحلة 4 أعلاه.');
      // التمرير اللطيف لبطاقة الدفع (المرحلة 4)
      const paymentEl = document.getElementById('step-4-payment-card');
      if (paymentEl) paymentEl.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    setUpdatingStatus(true);
    try {
      const token = localStorage.getItem('token');
      const payload: any = { status: newStatus };

      if (newStatus === 'LOST') {
        if (!lostReason.trim()) {
          toast.error('يرجى كتابة سبب الإلغاء (Lost Reason).');
          setUpdatingStatus(false);
          return;
        }
        payload.lostReason = lostReason;
      }

      if (newStatus === 'CONVERTED') {
        if (!conversionValue) {
          toast.error('يرجى إدخال قيمة التعاقد الإجمالية.');
          setUpdatingStatus(false);
          return;
        }
        payload.conversionValue = Number(conversionValue);
      }

      const res = await axios.patch(`/api/leads/${leadId}/status`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        toast.success(`تم تحديث حالة العميل إلى [${newStatus}].`);
        setStatus(newStatus);
        setLead(res.data.data.lead);
        onLeadUpdated();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل تحديث الحالة.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // تسجيل متابعة جديدة في الخط الزمني
  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityTitle.trim()) return;

    setAddingActivity(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        type: activityType,
        title: activityTitle,
        content: activityContent,
        callOutcome: activityType === 'CALL' ? callOutcome : undefined,
        nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate).toISOString() : undefined
      };

      const res = await axios.post(`/api/leads/${leadId}/activities`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        toast.success('تم تسجيل النشاط في الخط الزمني.');
        setActivities(prev => [res.data.data.activity, ...prev]);
        setLead(res.data.data.lead);
        setStatus(res.data.data.lead.status);
        setActivityContent('');
        onLeadUpdated();
      }
    } catch {
      toast.error('فشل تسجيل النشاط.');
    } finally {
      setAddingActivity(false);
    }
  };

  if (!isOpen) return null;

  const isAssignedToCurrentUser = (lead?.assignedEngineerId?._id || lead?.assignedEngineerId)?.toString() === (user?.id || user?._id)?.toString();
  const isAdmin = isAdministrator(user?.role) && hasPermission(user,'leads:edit_technical');
  const isTeamLeader = user?.role === 'TEAM_LEADER';
  const isConverted = lead?.status === 'CONVERTED' || (lead?.paymentReceipt?.isReceived && lead?.paymentReceipt?.paymentType!=='DEPOSIT');
  // بعد إتمام الصفقة واستلام الدفعة (CONVERTED): تتجمد الوثيقة تماماً وتُقفل على المهندس لحماية نطاق العمل المتفق عليه
  const canEditTechnical = (isAdmin && !!lead?.assignedEngineerId && lead?.voiceReviewStatus!=='PENDING') || (!isConverted && lead?.voiceReviewStatus!=='PENDING' && hasPermission(user,'leads:edit_technical') && isAssignedToCurrentUser);

  // تحديد الخطوة الحالية في المسار (1 إلى 4)
  const currentStep =
    lead?.paymentReceipt?.isReceived ? 4 :
    lead?.technicalIntake?.isCompleted ? 4 :
    lead?.contactConfirmedAt ? 3 :
    lead?.acknowledgedAt ? 2 : 1;

  if(editingIntake&&lead)return <RequestEditor lead={lead} user={user} onClose={()=>setEditingIntake(false)} onSaved={()=>{setEditingIntake(false);onLeadUpdated();onClose();}}/>;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-surface-border w-full max-w-3xl lg:max-w-4xl max-h-[92vh] flex flex-col rounded-xl shadow-none relative overflow-hidden animate-in zoom-in-95 duration-200 my-auto"
      >
        {/* Header */}
        <div className="p-5 border-b border-surface-border flex items-center justify-between bg-aethra-paper">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-aethra-ink bg-aethra-cyan border border-[#1396AF] px-2.5 py-0.5 rounded-lg shadow-none">
                {lead?.leadCode || 'جاري التحميل...'}
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                lead?.status === 'CONVERTED' ? 'bg-[#137A45]/20 text-[#137A45] border-[#137A45]' :
                lead?.status === 'LOST' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                'bg-white text-aethra-ink border-surface-border'
              }`}>
                {lead?.status}
              </span>
              {lead?.trackId && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 border border-surface-border text-aethra-ink">
                  {lead.trackId.name}
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-aethra-ink mt-1">{lead?.customerName}</h2>
          </div>

          <button
            onClick={onClose} aria-label="رجوع لقائمة الطلبات"
            className="p-2 rounded-xl bg-white hover:bg-stone-100 text-surface-muted hover:text-aethra-ink border border-surface-border transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-surface-muted">
            <OrbitLoader className="mr-2" />
            جاري جلب تفاصيل العميل والخط الزمني...
          </div>
        ) : lead ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <RequestIntakeSummary lead={lead} />
              <RequestCoordination lead={lead} user={user} onUpdated={refreshRequest} onOpenOrder={onSelectLead} onOpenExecution={onOpenExecution}/>
              {hasPermission(user,'payments:record')&&lead.paymentReceipt?.isReceived&&lead.paymentReceipt.paymentType==='DEPOSIT'&&<FinalPayment lead={lead} onUpdated={refreshRequest}/>}
              {(lead.paymentHistory||[]).length>0&&<div className="rounded-xl border p-4 space-y-2"><h3 className="font-semibold text-sm">دفعات سابقة محفوظة</h3>{lead.paymentHistory.map((payment:any,index:number)=><p key={index} className="text-sm">{payment.amount} {payment.currency} · <a className="underline" href={`/api/files/${encodeURIComponent(payment.receiptUrl.split('/').pop())}`} target="_blank" rel="noreferrer">إيصال الدفعة</a></p>)}</div>}
              {lead.voiceRecording && <VoicePlayback recording={lead.voiceRecording}/>}
              {(!lead.isBundleParent && (hasPermission(user,'leads:edit_all')||(lead.voiceReviewStatus==='PENDING'&&hasPermission(user,'voice:review')))) && <button onClick={()=>setEditingIntake(true)} className="rounded-xl bg-aethra-ink text-white px-5 py-3">{lead.voiceReviewStatus==='PENDING'?'تنسيق التسجيل واعتماد بيانات الطلب':'تعديل بيانات استقبال الطلب'}</button>}
            {!lead.isBundleParent && <>
            {/* شريط المسار المتسلسل التفاعلي (4 مراحل متتالية) */}
            <div className={`${lead.assignedEngineerId?'':'hidden'} bg-aethra-paper p-3.5 rounded-xl border border-surface-border`}>
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className="text-aethra-ink">مسار عمل المهندس والصفقة (4 خطوات)</span>
                <span className="text-[11px] text-surface-muted">الخطوة {currentStep} من 4</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-semibold">
                {/* 1. استلام الطلب */}
                <div className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition ${
                  lead.acknowledgedAt
                    ? 'bg-[#137A45]/15 border-[#137A45]/30 text-[#0F6237]'
                    : currentStep === 1
                      ? 'bg-aethra-cyan border-[#1396AF] text-aethra-ink shadow-none ring-1 ring-aethra-cyan'
                      : 'bg-white border-surface-border text-surface-muted'
                }`}>
                  <div className="flex items-center gap-1">
                    {lead.acknowledgedAt ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                    <span>1. استلام</span>
                  </div>
                  <span className="text-[9px] font-bold">
                    {lead.acknowledgedAt ? 'تم الاستلام' : 'مهلة الاستلام'}
                  </span>
                </div>

                {/* 2. التواصل الأولي */}
                <div className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition ${
                  lead.contactConfirmedAt
                    ? 'bg-[#137A45]/15 border-[#137A45]/30 text-[#0F6237]'
                    : currentStep === 2
                      ? 'bg-aethra-cyan border-[#1396AF] text-aethra-ink shadow-none ring-1 ring-aethra-cyan'
                      : 'bg-white border-surface-border text-surface-muted'
                }`}>
                  <div className="flex items-center gap-1">
                    {lead.contactConfirmedAt ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                    <span>2. التواصل</span>
                  </div>
                  <span className="text-[9px] font-bold">
                    {lead.contactConfirmedAt ? 'تم التواصل' : 'مهلة التواصل'}
                  </span>
                </div>

                {/* 3. توثيق المتطلبات والمحادثة */}
                <div className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition ${
                  lead.technicalIntake?.isCompleted
                    ? 'bg-[#137A45]/15 border-[#137A45]/30 text-[#0F6237]'
                    : currentStep === 3
                      ? 'bg-aethra-cyan border-[#1396AF] text-aethra-ink shadow-none ring-1 ring-aethra-cyan'
                      : 'bg-white border-surface-border text-surface-muted'
                }`}>
                  <div className="flex items-center gap-1">
                    {lead.technicalIntake?.isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Code2 className="w-3.5 h-3.5" />}
                    <span>3. المواصفات</span>
                  </div>
                  <span className="text-[9px] font-bold">
                    {lead.technicalIntake?.isCompleted ? 'معتمد وموثق' : 'المحادثة والملفات'}
                  </span>
                </div>

                {/* 4. إثبات الدفع والتعاقد */}
                <div className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition ${
                  lead.paymentReceipt?.isReceived
                    ? 'bg-[#137A45]/15 border-[#137A45]/30 text-[#0F6237]'
                    : currentStep === 4
                      ? 'bg-aethra-cyan border-[#1396AF] text-aethra-ink shadow-none ring-1 ring-aethra-cyan'
                      : 'bg-white border-surface-border text-surface-muted'
                }`}>
                  <div className="flex items-center gap-1">
                    {lead.paymentReceipt?.isReceived ? <CheckCircle2 className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                    <span>4. الدفع</span>
                  </div>
                  <span className="text-[9px] font-bold">
                    {lead.paymentReceipt?.isReceived ? 'تم استلام الوصل' : 'رفع الإيصال'}
                  </span>
                </div>
              </div>
            </div>

            {/* بطاقة الاتصال السريع وتأكيد الاستلام والتواصل (Step 1 & Step 2) */}
            <div className={`${lead.assignedEngineerId?'':'hidden'} bg-white border-2 border-aethra-cyan rounded-xl p-5 shadow-none space-y-4`}>
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <div>
                  <h3 className="text-xs font-semibold text-aethra-ink flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-aethra-ink" />
                    <span>المرحلة 1 و 2: استلام الطلب وتأكيد أول تواصل</span>
                  </h3>
                  <p className="text-[10px] text-surface-muted">
                    المهل حسب سياسة الإدارة وتبدأ بعد إسناد الطلب.
                  </p>
                </div>
                {isTeamLeader && (
                  <span className="text-[10px] font-bold bg-aethra-ink text-aethra-cyan px-2 py-0.5 rounded-full">
                    {isAssignedToCurrentUser?'التيم ليدر — الطلب مسند لك':'التيم ليدر — متابعة طلب زميل'}
                  </span>
                )}
              </div>

              {/* Step 1: تأكيد استلام الطلب */}
              <div className="bg-aethra-paper p-3.5 rounded-xl border border-surface-border flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-aethra-ink">1. استلام الطلب:</span>
                    {lead.acknowledgedAt ? (
                      <span className="text-[11px] font-bold text-[#0F6237] bg-[#137A45]/15 px-2.5 py-0.5 rounded-full border border-[#137A45]/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تم الاستلام بنجاح ({new Date(lead.acknowledgedAt).toLocaleTimeString('ar-EG')})</span>
                      </span>
                    ) : (
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                        ackSecondsLeft !== null && ackSecondsLeft <= 0
                          ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                          : 'bg-aethra-cyan text-aethra-ink border-[#1396AF]'
                      }`}>
                        <Clock className="w-3 h-3" />
                        <span>متبقي: {formatTimer(ackSecondsLeft)}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-surface-muted mt-1">
                    {lead.acknowledgedAt
                      ? 'تم تأكيد استلام المهندس للعميل وبدأت مهلة التواصل.'
                      : 'يلزم تأكيد استلام الطلب خلال 10 دقائق من الإسناد.'}
                  </p>
                </div>

                {!lead.acknowledgedAt && canEditTechnical && (
                  <button
                    onClick={handleAcknowledgeLead}
                    disabled={acknowledging}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-aethra-ink hover:bg-black text-aethra-cyan text-xs font-semibold transition cursor-pointer shadow-none"
                  >
                    <Zap className="w-3.5 h-3.5 text-aethra-cyan" />
                    <span>{acknowledging ? 'جاري التأكيد...' : '⚡ تأكيد استلام الطلب الآن'}</span>
                  </button>
                )}
              </div>

              {/* Step 2: تأكيد التواصل مع العميل */}
              <div className="bg-aethra-paper p-3.5 rounded-xl border border-surface-border space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-aethra-ink">2. أول تواصل مع العميل:</span>
                      {lead.contactConfirmedAt ? (
                        <span className="text-[11px] font-bold text-[#0F6237] bg-[#137A45]/15 px-2.5 py-0.5 rounded-full border border-[#137A45]/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تم التواصل ({new Date(lead.contactConfirmedAt).toLocaleTimeString('ar-EG')})</span>
                        </span>
                      ) : lead.acknowledgedAt ? (
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                          contactSecondsLeft !== null && contactSecondsLeft <= 0
                            ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}>
                          <Clock className="w-3 h-3" />
                          <span>مهلة التواصل: {formatTimer(contactSecondsLeft)}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-surface-muted bg-stone-200 px-2 py-0.5 rounded">
                          بانتظار استلام الطلب أولاً
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-surface-muted mt-1">
                      {lead.contactConfirmedAt
                        ? 'قام المهندس بالتواصل مع العميل وبدء استكشاف المتطلبات.'
                        : 'تواصل مع العميل عبر الواتساب أو الهاتف وأكد التواصل فوراً.'}
                    </p>
                  </div>

                  {lead.acknowledgedAt && !lead.contactConfirmedAt && canEditTechnical && (
                    <button
                      onClick={handleConfirmContact}
                      disabled={confirmingContact}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#137A45] hover:bg-[#0F6237] text-white text-xs font-semibold transition cursor-pointer shadow-none"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>{confirmingContact ? 'جاري التأكيد...' : '📞 تم التواصل مع العميل'}</span>
                    </button>
                  )}
                </div>

                {/* أزرار الاتصال السريع */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-surface-border">
                  <div className="text-xs">
                    <span className="text-surface-muted">الهاتف: </span>
                    <span className="font-bold text-aethra-ink font-mono">{lead.phone}</span>
                    <span className="text-surface-muted mr-2">الدولة: </span>
                    <span className="font-bold text-aethra-ink">{lead.country}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${lead.phone}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-stone-100 text-aethra-ink text-xs font-bold border border-surface-border transition cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>اتصال هاتفي</span>
                    </a>
                    <a
                      href={`https://wa.me/${(lead.whatsappNormalized || lead.phoneNormalized || '').replace('+', '')}?text=${encodeURIComponent(`مرحباً أستاذ ${lead.customerName}، معك المهندس ${user.name} من Aethra بخصوص طلبكم رقم ${lead.leadCode}. يسعدني التواصل معكم وفهم متطلبات المشروع.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#137A45] hover:bg-[#0F6237] text-white text-xs font-bold transition shadow-none cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>فتح واتساب العميل</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* المرحلة 3: توثيق تفاصيل المحادثة والمواصفات الفنية (Technical Intake & Client Discussion) */}
            <div className="bg-white border-2 border-aethra-ink rounded-xl p-5 shadow-none space-y-4">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-aethra-cyan flex items-center justify-center text-aethra-ink">
                    <Code2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-aethra-ink">
                      المرحلة 3: توثيق محادثة العميل، المتطلبات، والمواصفات الفنية
                    </h3>
                    <p className="text-[10px] text-surface-muted">
                      تسجيل ما دار في المحادثة، مقتطفات الشات، رفع اسكرينات/PDF، وقائمة المتطلبات (يطلع عليها التيم ليدر والإدارة)
                    </p>
                  </div>
                </div>

                {lead.technicalIntake?.isCompleted ? (
                  <div className="flex items-center gap-2">
                    {isConverted ? (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-aethra-ink text-aethra-cyan border border-dark-50 flex items-center gap-1.5 shadow-none">
                        <Lock className="w-3.5 h-3.5 text-aethra-cyan" />
                        <span>وثيقة مجمدة رسمياً (صفقة ناجحة)</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#137A45]/15 text-[#0F6237] border border-[#137A45]/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>معتمد وموثق</span>
                      </span>
                    )}

                    {/* زر التعديل: متاح قبل إتمام الصفقة. بعد التعاقد (CONVERTED): مقفل تماماً لحماية بنود العقد، مع إمكانية تعديل استثنائي للأدمن فقط */}
                    {canEditTechnical && !isEditingTechnical && !isConverted && (
                      <button
                        onClick={() => setIsEditingTechnical(true)}
                        className="text-xs font-bold text-aethra-ink hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>تعديل</span>
                      </button>
                    )}

                    {isAdmin && isConverted && !isEditingTechnical && (
                      <button
                        onClick={() => setIsEditingTechnical(true)}
                        className="text-[10px] font-bold text-surface-muted hover:text-aethra-ink hover:underline flex items-center gap-1 cursor-pointer bg-white border border-surface-border px-2 py-0.5 rounded-md"
                        title="تعديل استثنائي خاص بمدير النظام فقط"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>تعديل استثنائي (إدارة)</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    بانتظار توثيق المهندس
                  </span>
                )}
              </div>

              {/* إذا تم توثيقها ولسنا في وضع التعديل: عرض الملف الفني الكامل (متاح للتيم ليدر "يبص بس" وللأدمن) */}
              {lead.technicalIntake?.isCompleted && !isEditingTechnical ? (
                <div className="space-y-4 text-xs bg-aethra-paper p-4 rounded-xl border border-surface-border">
                  {/* شريط توضيح تجميد الوثيقة بعد نجاح الصفقة وإثبات الدفع */}
                  {isConverted && (
                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                      <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                      <div>
                        <p className="font-bold">وثيقة تعاقدية معتمدة ومجمدة رسمياً (صفقة ناجحة ✓)</p>
                        <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                          تم استلام الدفعة المالية وإتمام التعاقد بنجاح. تم تجميد كافة بنود المواصفات الفنية والمتطلبات والمرفقات لحماية حقوق العميل والشركة ومنع أي تغيير في نطاق العمل المتفق عليه.
                        </p>
                      </div>
                    </div>
                  )}
                  {/* طريقة التواصل والملاحظات */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-surface-border">
                    <div>
                      <span className="text-surface-muted text-[10px] block">طريقة التواصل المستخدمة:</span>
                      <span className="font-bold text-aethra-ink text-xs">
                        {lead.communicationMethod === 'WHATSAPP' ? 'محادثة واتساب' :
                         lead.communicationMethod === 'PHONE_CALL' ? 'مكالمة هاتفية' :
                         lead.communicationMethod === 'MEETING' ? 'اجتماع أونلاين (زووم/ميت)' :
                         lead.communicationMethod === 'EMAIL' ? 'بريد إلكتروني' : 'غير محدد'}
                      </span>
                    </div>

                    <div>
                      <span className="text-surface-muted text-[10px] block">المهندس الموثق:</span>
                      <span className="font-bold text-aethra-ink">
                        {lead.technicalIntake.completedByUserId?.name || 'المهندس المسند'}
                      </span>
                    </div>
                  </div>

                  {/* ما تم نقاشه وفهم المشروع */}
                  {lead.clientDiscussionNotes && (
                    <div>
                      <span className="text-surface-muted text-[11px] block font-bold mb-1">تفاصيل المحادثة وفهم رغبة العميل:</span>
                      <p className="font-medium text-aethra-ink bg-white p-3 rounded-xl border border-surface-border leading-relaxed whitespace-pre-wrap">
                        {lead.clientDiscussionNotes}
                      </p>
                    </div>
                  )}

                  {/* مقتطفات الشات */}
                  {lead.chatTranscript && (
                    <div>
                      <span className="text-surface-muted text-[11px] block font-bold mb-1">رسائل العميل ومقتطفات المحادثة:</span>
                      <div className="bg-white p-3 rounded-xl border border-surface-border text-[11px] text-aethra-ink font-mono leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {lead.chatTranscript}
                      </div>
                    </div>
                  )}

                  {/* المرفقات واسكرينات الشات أو الـ PDF */}
                  {lead.chatAttachments && lead.chatAttachments.length > 0 && (
                    <div>
                      <span className="text-surface-muted text-[11px] block font-bold mb-2">
                        المرفقات وصور الشات ومستندات PDF ({lead.chatAttachments.length}):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {lead.chatAttachments.map((att: any, idx: number) => {
                          const isImg = att.mimeType?.startsWith('image/') || att.url?.match(/\.(png|jpe?g|webp|gif)$/i);
                          return (
                            <a
                              key={idx}
                              href={att.url.replace('/uploads/', '/api/files/')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-white border border-surface-border hover:border-aethra-ink rounded-xl p-2.5 flex items-center gap-2 group transition shadow-none"
                            >
                              {isImg ? (
                                <ImageIcon className="w-5 h-5 text-amber-800 shrink-0" />
                              ) : (
                                <FileText className="w-5 h-5 text-rose-600 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-aethra-ink truncate group-hover:underline">
                                  {att.originalName || att.filename}
                                </p>
                                <span className="text-[9px] text-surface-muted">معاينة وتحميل</span>
                              </div>
                              <Download className="w-3.5 h-3.5 text-surface-muted group-hover:text-aethra-ink shrink-0" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* قائمة متطلبات العميل (Checklist) */}
                  {lead.clientRequirements && lead.clientRequirements.length > 0 && (
                    <div>
                      <span className="text-surface-muted text-[11px] block font-bold mb-2">
                        قائمة متطلبات العميل المحددة (Client Requirements):
                      </span>
                      <div className="bg-white rounded-xl border border-surface-border divide-y divide-surface-border">
                        {lead.clientRequirements.map((reqItem: any) => (
                          <div key={reqItem.id} className="p-2.5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              {reqItem.isDone ? (
                                <CheckSquare className="w-4 h-4 text-[#0F6237]" />
                              ) : (
                                <Square className="w-4 h-4 text-surface-muted" />
                              )}
                              <span className={reqItem.isDone ? 'line-through text-surface-muted' : 'font-bold text-aethra-ink'}>
                                {reqItem.title}
                              </span>
                            </div>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              reqItem.isDone ? 'bg-[#137A45]/15 text-[#0F6237]' : 'bg-stone-100 text-surface-muted'
                            }`}>
                              {reqItem.isDone ? 'منجز' : 'قيد العمل'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* نطاق العمل والمخرجات والميزانية */}
                  <div>
                    <span className="text-surface-muted text-[11px] block mb-0.5 font-bold">نطاق عمل المشروع الفني:</span>
                    <p className="font-bold text-aethra-ink leading-relaxed whitespace-pre-wrap bg-white p-3 rounded-xl border border-surface-border">
                      {lead.technicalIntake.projectScope || 'لم يحدد'}
                    </p>
                  </div>

                  {lead.technicalIntake.deliverables && lead.technicalIntake.deliverables.length > 0 && (
                    <div>
                      <span className="text-surface-muted text-[11px] block mb-1 font-bold">المخرجات والتسليمات المتفق عليها:</span>
                      <ul className="space-y-1 bg-white p-3 rounded-xl border border-surface-border">
                        {lead.technicalIntake.deliverables.map((del: string, idx: number) => (
                          <li key={idx} className="flex items-center gap-1.5 text-aethra-ink">
                            <span className="w-1.5 h-1.5 rounded-full bg-aethra-cyan shrink-0" />
                            <span>{del}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-surface-border">
                    <div>
                      <span className="text-surface-muted text-[10px] block">الميزانية المقترحة / المتفق عليها:</span>
                      <span className="font-semibold text-[#137A45] text-sm">
                        {lead.technicalIntake.agreedBudget || 0} {lead.technicalIntake.currency || 'USD'}
                      </span>
                    </div>

                    <div>
                      <span className="text-surface-muted text-[10px] block">المدة الزمنية المتوقعة:</span>
                      <span className="font-bold text-aethra-ink">
                        {lead.technicalIntake.estimatedDuration || 'غير محددة'}
                      </span>
                    </div>

                    <div>
                      <span className="text-surface-muted text-[10px] block">الأدوات والتقنيات:</span>
                      <span className="font-medium text-aethra-ink">
                        {lead.technicalIntake.toolsOrTechStack || 'غير محددة'}
                      </span>
                    </div>
                  </div>

                  {lead.technicalIntake.technicalNotes && (
                    <div className="pt-2 border-t border-surface-border">
                      <span className="text-surface-muted text-[10px] block">ملاحظات المهندس الفنية:</span>
                      <p className="text-aethra-ink text-[11px] italic bg-white p-2.5 rounded-xl border border-surface-border">
                        {lead.technicalIntake.technicalNotes}
                      </p>
                    </div>
                  )}
                </div>
              ) : canEditTechnical ? (
                /* نموذج إدخال أو تعديل المواصفات الفنية والمتطلبات */
                <form onSubmit={handleSaveTechnicalIntake} className="space-y-4 text-xs bg-aethra-paper p-4 rounded-xl border border-surface-border">
                  {/* اختيار وسيلة التواصل */}
                  <div>
                    <label className="block font-bold text-aethra-ink mb-1">
                      طريقة التواصل التي تمت مع العميل *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'WHATSAPP', label: 'محادثة واتساب' },
                        { id: 'PHONE_CALL', label: 'مكالمة هاتفية' },
                        { id: 'MEETING', label: 'اجتماع زووم / ميت' },
                        { id: 'EMAIL', label: 'بريد إلكتروني' }
                      ].map(m => (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => setCommunicationMethod(m.id as any)}
                          className={`p-2 rounded-xl border font-bold text-xs transition cursor-pointer ${
                            communicationMethod === m.id
                              ? 'bg-aethra-ink border-aethra-ink text-aethra-cyan shadow-none'
                              : 'bg-white border-surface-border text-surface-muted hover:text-aethra-ink'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ما تم نقاشه وفهم المشروع */}
                  <div>
                    <label className="block font-bold text-aethra-ink mb-1">
                      تفاصيل ما تم نقاشه وفهم رغبة العميل في المشروع *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={clientDiscussionNotes}
                      onChange={(e) => setClientDiscussionNotes(e.target.value)}
                      placeholder="اشرح بالتفصيل ما فهمته من العميل: ما الذي يحتاجه تحديداً، نوع البيزنس، الهدف من المشروع..."
                      className="w-full bg-white border border-surface-border rounded-xl p-2.5 text-xs text-aethra-ink focus:border-aethra-ink focus:outline-none"
                    />
                  </div>

                  {/* رسائل ومقتطفات الشات */}
                  <div>
                    <label className="block font-bold text-aethra-ink mb-1">
                      نصوص ورسائل الشات المهمة التي أرسلها العميل
                    </label>
                    <textarea
                      rows={2}
                      value={chatTranscript}
                      onChange={(e) => setChatTranscript(e.target.value)}
                      placeholder="انسخ مقتطفات الشات أو النقاط الأساسية التي كتبها العميل هنا..."
                      className="w-full bg-white border border-surface-border rounded-xl p-2.5 text-xs text-aethra-ink focus:border-aethra-ink focus:outline-none"
                    />
                  </div>

                  {/* رفع اسكرينات الشات أو ملفات PDF */}
                  <div>
                    <label className="block font-bold text-aethra-ink mb-1.5">
                      رفع صور اسكرينات الشات أو ملفات PDF للمشروع
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-stone-100 text-aethra-ink border border-surface-border text-xs font-bold cursor-pointer transition shadow-none">
                        <Upload className="w-3.5 h-3.5 text-aethra-ink" />
                        <span>{uploadingChatAttachment ? 'جاري الرفع...' : 'رفع صورة أو PDF'}</span>
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
                          disabled={uploadingChatAttachment}
                          onChange={handleUploadChatAttachment}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[10px] text-surface-muted">
                        يدعم صور PNG, JPG وملفات PDF حتى 15MB
                      </span>
                    </div>

                    {/* قائمة المرفقات المرفوعة */}
                    {chatAttachments.length > 0 && (
                      <div className="mt-2.5 space-y-1.5">
                        {chatAttachments.map((att, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-xl border border-surface-border text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <Paperclip className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                              <span className="font-bold text-aethra-ink truncate">{att.originalName || att.filename}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setChatAttachments(prev => prev.filter((_, i) => i !== idx))}
                              className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* متطلبات العميل التفاعلية (Checklist) */}
                  <div>
                    <label className="block font-bold text-aethra-ink mb-1">
                      قائمة متطلبات العميل (Requirements Checklist)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newReqTitle}
                        onChange={(e) => setNewReqTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddRequirement(); } }}
                        placeholder="أضف متطلب من متطلبات العميل (مثل: تصميم لوجو متجاوب)..."
                        className="flex-1 bg-white border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink focus:border-aethra-ink focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddRequirement}
                        className="px-3.5 py-2 rounded-xl bg-aethra-cyan text-aethra-ink font-bold text-xs border border-[#1396AF] cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة</span>
                      </button>
                    </div>

                    {clientRequirements.length > 0 && (
                      <div className="bg-white rounded-xl border border-surface-border divide-y divide-surface-border">
                        {clientRequirements.map((reqItem) => (
                          <div key={reqItem.id} className="p-2 flex items-center justify-between text-xs">
                            <button
                              type="button"
                              onClick={() => handleToggleRequirement(reqItem.id)}
                              className="flex items-center gap-2 cursor-pointer text-right flex-1"
                            >
                              {reqItem.isDone ? (
                                <CheckSquare className="w-4 h-4 text-[#0F6237] shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-surface-muted shrink-0" />
                              )}
                              <span className={reqItem.isDone ? 'line-through text-surface-muted' : 'font-bold text-aethra-ink'}>
                                {reqItem.title}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRequirement(reqItem.id)}
                              className="text-surface-muted hover:text-rose-600 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* نطاق عمل المشروع الفني والمخرجات */}
                  <div>
                    <label className="block font-bold text-aethra-ink mb-1">
                      نطاق العمل المطلوب وتفاصيل المشروع الفنية *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={projectScope}
                      onChange={(e) => setProjectScope(e.target.value)}
                      placeholder="صف نطاق العمل المتفق عليه..."
                      className="w-full bg-white border border-surface-border rounded-xl p-2.5 text-xs text-aethra-ink focus:border-aethra-ink focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-aethra-ink mb-1">
                      المخرجات والتسليمات المتفق عليها (اكتب كل بند في سطر مستقل)
                    </label>
                    <textarea
                      rows={2}
                      value={deliverablesText}
                      onChange={(e) => setDeliverablesText(e.target.value)}
                      placeholder="1. تطبيق موبايل&#10;2. لوحة تحكم سحابية"
                      className="w-full bg-white border border-surface-border rounded-xl p-2.5 text-xs text-aethra-ink focus:border-aethra-ink focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-aethra-ink mb-1">الميزانية المتفق عليها</label>
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          value={agreedBudget}
                          onChange={(e) => setAgreedBudget(e.target.value)}
                          placeholder="2500"
                          className="w-full bg-white border border-surface-border rounded-xl px-3 py-1.5 text-xs font-bold text-aethra-ink"
                        />
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          className="bg-white border border-surface-border rounded-xl px-2 py-1.5 text-xs text-aethra-ink"
                        >
                          <option value="USD">USD</option>
                          <option value="SAR">SAR</option>
                          <option value="EGP">EGP</option>
                          <option value="AED">AED</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-aethra-ink mb-1">المدة المتوقعة للتسليم</label>
                      <input
                        type="text"
                        value={estimatedDuration}
                        onChange={(e) => setEstimatedDuration(e.target.value)}
                        placeholder="مثلاً: 3 أسابيع عمل"
                        className="w-full bg-white border border-surface-border rounded-xl px-3 py-1.5 text-xs text-aethra-ink"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-aethra-ink mb-1">الأدوات أو التقنيات</label>
                      <input
                        type="text"
                        value={toolsOrTechStack}
                        onChange={(e) => setToolsOrTechStack(e.target.value)}
                        placeholder="React, Node.js, Mongo..."
                        className="w-full bg-white border border-surface-border rounded-xl px-3 py-1.5 text-xs text-aethra-ink"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-aethra-ink mb-1">ملاحظات تقنية وتوصيات للتيم ليدر</label>
                    <input
                      type="text"
                      value={technicalNotes}
                      onChange={(e) => setTechnicalNotes(e.target.value)}
                      placeholder="مثال: العميل جاهز للتوقيع ومعه ملفات التصميم..."
                      className="w-full bg-white border border-surface-border rounded-xl px-3 py-1.5 text-xs text-aethra-ink"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {lead.technicalIntake?.isCompleted && (
                      <button
                        type="button"
                        onClick={() => setIsEditingTechnical(false)}
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-surface-border text-surface-muted text-xs font-bold cursor-pointer"
                      >
                        إلغاء التعديل
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={savingTechnical || uploadingChatAttachment}
                      className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-aethra-ink hover:bg-black text-aethra-cyan text-xs font-semibold transition cursor-pointer mr-auto shadow-none"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-aethra-cyan" />
                      <span>{savingTechnical ? 'جاري الاعتماد...' : 'اعتماد وتوثيق المواصفات الفنية'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* إذا كان المستخدم تيم ليدر والمهندس لم يكملها بعد */
                <div className="text-xs text-surface-muted bg-aethra-paper p-4 rounded-xl border border-surface-border text-center">
                  لم يقم المهندس المسند له بتوثيق المواصفات الفنية بعد. ستظهر كافة التفاصيل والملفات هنا فور توثيقها.
                </div>
              )}
            </div>

            {/* المرحلة 4: إثبات الدفع ورفع الإيصال وإغلاق التعاقد (Step 4) */}
            <div id="step-4-payment-card" className="bg-white border-2 border-[#137A45] rounded-xl p-5 shadow-none space-y-4">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#137A45]/20 flex items-center justify-center text-[#137A45]">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-aethra-ink">
                      المرحلة 4: إثبات استلام الدفعة المالية وإرفاق الإيصال
                    </h3>
                    <p className="text-[10px] text-surface-muted">
                      تأكيد استلام المبلغ المالي ورفع وصل أو إيصال التحويل كصورة أو مستند PDF
                    </p>
                  </div>
                </div>

                {lead.paymentReceipt?.isReceived ? (
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#137A45]/20 text-[#137A45] border border-[#137A45] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{lead.paymentReceipt.paymentType === 'DEPOSIT' ? 'تم تسجيل العربون؛ الباقي لم يُسدد' : 'اكتمل سداد المستحقات'}</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-surface-muted bg-stone-100 border border-surface-border px-2.5 py-0.5 rounded-full">
                    بانتظار الدفعة والإيصال
                  </span>
                )}
              </div>

              {/* إذا تم استلام الدفعة مسبقاً: عرض بطاقة الدفع الرسمية */}
              {lead.paymentReceipt?.isReceived ? (
                <div className="bg-aethra-paper p-4 rounded-xl border border-[#137A45] space-y-3 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-surface-muted text-[10px] block">المبلغ المستلم:</span>
                      <span className="font-semibold text-base text-[#137A45]">
                        {lead.paymentReceipt.amount} {lead.paymentReceipt.currency}
                      </span>
                      <span className="text-[10px] text-surface-muted block mt-0.5">
                        {lead.paymentReceipt.paymentType === 'DEPOSIT' ? 'عربون / دفعة أولى' :
                         lead.paymentReceipt.paymentType === 'FINAL' ? 'دفعة نهائية' : 'دفعة كاملة (100%)'}
                      </span>
                    </div>

                    <div>
                      <span className="text-surface-muted text-[10px] block">طريقة التحويل:</span>
                      <span className="font-bold text-aethra-ink">
                        {lead.paymentReceipt.paymentMethod}
                      </span>
                    </div>

                    <div>
                      <span className="text-surface-muted text-[10px] block">تاريخ الاستلام:</span>
                      <span className="font-mono text-aethra-ink">
                        {lead.paymentReceipt.receivedAt ? new Date(lead.paymentReceipt.receivedAt).toLocaleDateString('ar-EG') : 'تم الاستلام'}
                      </span>
                    </div>

                    <div>
                      <span className="text-surface-muted text-[10px] block">إيصال التحويل:</span>
                      <a
                        href={lead.paymentReceipt.receiptUrl.replace('/uploads/', '/api/files/')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-aethra-ink hover:underline"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>معاينة الإيصال</span>
                      </a>
                    </div>
                  </div>

                  {lead.paymentReceipt.notes && (
                    <div className="pt-2 border-t border-surface-border">
                      <span className="text-surface-muted text-[10px] block">ملاحظات الدفع:</span>
                      <p className="text-aethra-ink font-medium">{lead.paymentReceipt.notes}</p>
                    </div>
                  )}
                </div>
              ) : !lead.contactConfirmedAt || !lead.technicalIntake?.isCompleted ? (
                <div className="text-xs text-surface-muted bg-aethra-paper p-4 rounded-xl border border-surface-border text-center space-y-1">
                  <p className="font-bold text-aethra-ink">المرحلة غير مكتملة بعد</p>
                  <p>يلزم استلام الطلب وتأكيد التواصل واعتماد المواصفات الفنية قبل إثبات الدفع والتعاقد.</p>
                </div>
              ) : hasPermission(user,'payments:record') ? (
                /* نموذج إدخال الدفعة ورفع الإيصال */
                <form onSubmit={handleConfirmPayment} className="space-y-3.5 text-xs bg-aethra-paper p-4 rounded-xl border border-surface-border">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-bold text-aethra-ink mb-1">المبلغ المستلم *</label>
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          required
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder="مثلاً: 1500"
                          className="w-full bg-white border border-surface-border rounded-xl px-3 py-1.5 text-xs font-bold text-aethra-ink focus:border-aethra-ink focus:outline-none"
                        />
                        <select
                          value={paymentCurrency}
                          onChange={(e) => setPaymentCurrency(e.target.value)}
                          className="bg-white border border-surface-border rounded-xl px-2 py-1.5 text-xs text-aethra-ink"
                        >
                          <option value="USD">USD</option>
                          <option value="SAR">SAR</option>
                          <option value="EGP">EGP</option>
                          <option value="AED">AED</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-aethra-ink mb-1">نوع الدفعة</label>
                      <select
                        value={paymentType}
                        onChange={(e) => setPaymentType(e.target.value as any)}
                        className="w-full bg-white border border-surface-border rounded-xl px-3 py-1.5 text-xs text-aethra-ink font-bold"
                      >
                        <option value="FULL">دفعة كاملة (100%)</option>
                        <option value="DEPOSIT">عربون / دفعة أولى</option>
                        <option value="FINAL">دفعة نهائية بعد التسليم</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-aethra-ink mb-1">طريقة الدفع *</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full bg-white border border-surface-border rounded-xl px-3 py-1.5 text-xs text-aethra-ink font-bold"
                      >
                        <option value="انستاباي (InstaPay)">انستاباي (InstaPay)</option>
                        <option value="فودافون كاش (Vodafone Cash)">فودافون كاش (Vodafone Cash)</option>
                        <option value="تحويل بنكي مباشر (Bank Transfer)">تحويل بنكي مباشر (Bank Transfer)</option>
                        <option value="بايبال (PayPal)">بايبال (PayPal)</option>
                        <option value="بطاقة ائتمانية (Credit Card)">بطاقة ائتمانية (Credit Card)</option>
                        <option value="نقداً (Cash)">نقداً (Cash)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-aethra-ink mb-1">رفع صورة أو PDF للإيصال *</label>
                      <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-stone-100 text-aethra-ink border border-surface-border text-xs font-bold cursor-pointer transition shadow-none truncate">
                        <Upload className="w-3.5 h-3.5 text-aethra-ink" />
                        <span className="truncate">
                          {uploadingReceipt ? 'جاري الرفع...' : paymentReceiptFilename ? paymentReceiptFilename : 'اختر الإيصال (صورة/PDF)'}
                        </span>
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.pdf"
                          disabled={uploadingReceipt}
                          onChange={handleUploadReceipt}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-aethra-ink mb-1">ملاحظات الدفع (رقم الحوالة، اسم المودع، إلخ)</label>
                    <input
                      type="text"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="مثال: حوالة انستاباي رقم TRX-9921 باسم أحمد..."
                      className="w-full bg-white border border-surface-border rounded-xl px-3 py-1.5 text-xs text-aethra-ink focus:border-aethra-ink focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={confirmingPayment || uploadingReceipt}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#137A45] hover:bg-[#0F6237] text-white text-xs font-semibold transition cursor-pointer shadow-none"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>{confirmingPayment ? 'جاري التأكيد...' : '💰 تأكيد استلام الفلوس وإتمام التعاقد'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-xs text-surface-muted bg-aethra-paper p-4 rounded-xl border border-surface-border text-center">
                  بانتظار تأكيد استلام الدفعة ورفع الإيصال المالي من المهندس.
                </div>
              )}
            </div>

            {/* تحديث المرحلة البيعية يدوي (Pipeline Status) */}
            <div className="bg-aethra-paper p-4 rounded-xl border border-surface-border space-y-3">
              <label className="block text-xs font-bold text-aethra-ink">تحديث المرحلة البيعية (Pipeline Status)</label>
              {!canEditTechnical ? (
                <div className="bg-white p-3 rounded-xl border border-surface-border text-xs flex items-center justify-between">
                  <span className="text-surface-muted">عرض ومتابعة الطلب:</span>
                  <span className="font-bold text-aethra-ink bg-aethra-cyan px-2.5 py-0.5 rounded-full border border-[#1396AF]">
                    الحالة الحالية: {status}
                  </span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 text-xs">
                    {['CONTACTED', 'QUALIFIED', 'QUOTATION_SENT', 'NEGOTIATION', 'CONVERTED', 'LOST'].map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateStatus(st)}
                        disabled={updatingStatus}
                        className={`px-2.5 py-2 rounded-xl font-bold transition border cursor-pointer ${
                          status === st
                            ? 'bg-aethra-ink border-aethra-ink text-aethra-cyan shadow-none'
                            : 'bg-white border-surface-border text-surface-muted hover:text-aethra-ink hover:bg-stone-50'
                        }`}
                      >
                        {st === 'CONTACTED' ? 'تم التواصل' :
                         st === 'QUALIFIED' ? 'مؤهل' :
                         st === 'QUOTATION_SENT' ? 'إرسال عرض' :
                         st === 'NEGOTIATION' ? 'تفاوض' :
                         st === 'CONVERTED' ? 'ناجحة ✓' :
                         st === 'LOST' ? 'ملغية ✕' : st}
                      </button>
                    ))}
                  </div>

                  {status === 'CONVERTED' && !lead.paymentReceipt?.isReceived && (
                    <div className="pt-2 bg-white p-3 rounded-xl border border-[#137A45]">
                      <label className="block text-xs font-bold text-aethra-ink mb-1">قيمة التعاقد النهائية (Conversion Value) *</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={conversionValue}
                          onChange={(e) => setConversionValue(e.target.value)}
                          placeholder="مثلاً: 5000"
                          className="bg-aethra-paper border border-surface-border rounded-xl px-3 py-1.5 text-xs text-aethra-ink font-bold flex-1"
                        />
                        <button
                          onClick={() => handleUpdateStatus('CONVERTED')}
                          className="px-4 py-1.5 rounded-xl bg-[#137A45] hover:bg-[#0F6237] text-white text-xs font-bold cursor-pointer"
                        >
                          حفظ القيمة
                        </button>
                      </div>
                    </div>
                  )}

                  {canEditTechnical && (
                    <div className="pt-2 bg-white p-3 rounded-xl border border-rose-200">
                      <label className="block text-xs font-bold text-rose-700 mb-1">سبب الإلغاء (Lost Reason) *</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={lostReason}
                          onChange={(e) => setLostReason(e.target.value)}
                          placeholder="مثلاً: اختار منافساً، ميزانية غير مناسبة..."
                          className="bg-aethra-paper border border-surface-border rounded-xl px-3 py-1.5 text-xs text-aethra-ink flex-1"
                        />
                        <button
                          onClick={() => handleUpdateStatus('LOST')}
                          className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                        >
                          حفظ السبب
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            </>}
            <section className="bg-white border border-surface-border p-4 rounded-xl space-y-4">
              <h3 className="font-bold flex items-center gap-2"><History className="w-4 h-4" />سجل الأنشطة والمتابعة</h3>
              {lead.nextFollowUpDate && <p className="text-sm">المتابعة القادمة: {new Date(lead.nextFollowUpDate).toLocaleString('ar-EG')}</p>}
              {lead.attachments?.length > 0 && <div className="flex flex-wrap gap-2">
                {lead.attachments.map((attachment: any) => <a key={attachment.url} href={attachment.url.replace('/uploads/', '/api/files/')} target="_blank" rel="noopener noreferrer" className="text-sm underline">{attachment.originalName || attachment.filename}</a>)}
              </div>}
              {canEditTechnical && !['CONVERTED', 'LOST'].includes(lead.status) && (
                <form onSubmit={handleAddActivity} className="space-y-3">
                  <label className="block text-xs font-bold">نوع المتابعة
                    <select value={activityType} onChange={e => setActivityType(e.target.value)} className="block w-full border rounded-xl p-2 mt-1">
                      <option value="CALL">مكالمة</option><option value="WHATSAPP_MESSAGE">واتساب</option><option value="EMAIL_SENT">بريد إلكتروني</option><option value="MEETING">اجتماع</option><option value="NOTE">ملاحظة</option>
                    </select>
                  </label>
                  <label className="block text-xs font-bold">عنوان النشاط
                    <input value={activityTitle} onChange={e => setActivityTitle(e.target.value)} required className="block w-full border rounded-xl p-2 mt-1" />
                  </label>
                  <label className="block text-xs font-bold">تفاصيل المتابعة
                    <textarea value={activityContent} onChange={e => setActivityContent(e.target.value)} className="block w-full border rounded-xl p-2 mt-1" />
                  </label>
                  {activityType === 'CALL' && <label className="block text-xs font-bold">نتيجة المكالمة
                    <select value={callOutcome} onChange={e => setCallOutcome(e.target.value)} className="block w-full border rounded-xl p-2 mt-1">
                      <option value="ANSWERED">تم الرد</option><option value="NO_ANSWER">لم يرد</option><option value="BUSY">مشغول</option><option value="WRONG_NUMBER">رقم غير صحيح</option><option value="CALL_BACK_REQUESTED">طلب معاودة الاتصال</option>
                    </select>
                  </label>}
                  <label className="block text-xs font-bold">موعد المتابعة القادمة (اختياري)
                    <input type="datetime-local" value={nextFollowUpDate} onChange={e => setNextFollowUpDate(e.target.value)} className="block w-full border rounded-xl p-2 mt-1" />
                  </label>
                  <button disabled={addingActivity} className="bg-aethra-cyan px-4 py-2 rounded-xl font-bold disabled:opacity-50">{addingActivity ? 'جاري الحفظ...' : 'تسجيل المتابعة'}</button>
                </form>
              )}
              <ol className="space-y-3">
                {activities.map(activity => <li key={activity._id} className="border-t pt-3 text-sm">
                  <p className="font-bold">{activity.title}</p>
                  <p className="text-xs text-surface-muted">{activity.userId?.name || 'النظام'} — {new Date(activity.createdAt).toLocaleString('ar-EG')}</p>
                  {activity.content && <p className="whitespace-pre-wrap mt-1">{activity.content}</p>}
                  {activity.attachments?.map((attachment: any) => <a key={attachment.url} href={attachment.url.replace('/uploads/', '/api/files/')} target="_blank" rel="noopener noreferrer" className="block underline">{attachment.originalName || attachment.filename}</a>)}
                </li>)}
              </ol>
            </section>

            {/* البيانات التسويقية الأصلية المجمدة */}
            <div className="bg-aethra-paper p-4 rounded-xl border border-surface-border space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-surface-border pb-2">
                <span className="font-bold text-aethra-ink">بيانات التسويق والحملة الأصلية (مسجلة من فريق التسويق)</span>
                <span className="text-[10px] bg-white border border-surface-border px-2 py-0.5 rounded text-surface-muted">Immutable</span>
              </div>
              <p><span className="text-surface-muted">المصدر:</span> <span className="text-aethra-ink font-semibold">{lead.leadSource} {lead.campaignName ? `(${lead.campaignName})` : ''}</span></p>
              <p><span className="text-surface-muted">المسجل:</span> <span className="text-aethra-ink">{lead.marketingEmployeeName || 'عميل مباشر من الموقع'}</span></p>
              {lead.initialNotes && (
                <p><span className="text-surface-muted">ملاحظات التسويق الأولية:</span> <span className="text-amber-800 font-medium">{lead.initialNotes}</span></p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
