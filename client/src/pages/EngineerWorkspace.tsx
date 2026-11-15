import { hasPermission } from '../utils/auth';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Users,
  MessageSquare,
  Phone,
  Search,
  Clock,
  Filter,
  ArrowRightLeft,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TrendingUp,
  RefreshCw,
  Calendar,
  DollarSign,
  FileText,
  ShieldCheck,
  Code2,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import { LeadDetailDrawer } from '../components/LeadDetailDrawer';
import { DeclineLeadModal } from '../components/DeclineLeadModal';
import { OrbitLoader } from '../components/OrbitLoader';

interface EngineerWorkspaceProps {
  user: any;onOpenExecution?:(id:string)=>void;
}

export const EngineerWorkspace: React.FC<EngineerWorkspaceProps> = ({ user,onOpenExecution }) => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals & Drawer State
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [decliningLead, setDecliningLead] = useState<any | null>(null);

  const [view,setView]=useState<'mine'|'submitted'|'team'|'voice'>(hasPermission(user,'routing:receive')?'mine':'submitted');
  const own=(lead:any)=>String(lead.assignedEngineerId?._id||lead.assignedEngineerId)===String(user._id||user.id)&&hasPermission(user,'leads:edit_technical');
  const isTeamLeader = user?.role === 'TEAM_LEADER';
  const requestRef = useRef<AbortController>();

  const fetchLeads = useCallback(() => {
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    setLoading(true);
    const token = localStorage.getItem('token');
    const params: any = { page, limit: 25 };
    if(view==='mine')params.assignedToMe='true';
    if(view==='submitted')params.submittedByMe='true';
    if(view==='voice')params.voicePending='true';
    if(view==='team'&&user.trackId)params.trackId=user.trackId._id||user.trackId;
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;

    axios.get('/api/leads', {
      signal: request.signal,
      params,
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        if (request.signal.aborted) return;
        if (res.data.success) {
          setLeads(res.data.data.leads);
          setPages(Math.max(1, res.data.data.pagination.pages));
          setTotal(res.data.data.pagination.total);
        }
      })
      .catch((err: any) => {
        if (request.signal.aborted || axios.isCancel(err)) return;
        console.error('Error fetching leads:', err);
        toast.error('تعذر تحميل العملاء؛ أعد المحاولة.');
      })
      .finally(() => { if (!request.signal.aborted) setLoading(false); });
  }, [search, statusFilter, page, view]);

  useEffect(() => {
    const timer = window.setTimeout(fetchLeads, 200);
    return () => { window.clearTimeout(timer); requestRef.current?.abort(); };
  }, [fetchLeads]);

  // البث المباشر اللحظي (SSE)
  const token = localStorage.getItem('token');
  useEffect(() => {
    const refresh = () => fetchLeads();
    window.addEventListener('crm-lead-updated', refresh);
    return () => window.removeEventListener('crm-lead-updated', refresh);
  }, [fetchLeads]);

  // حساب مؤشرات الأداء السريعة
  const newLeadsCount = leads.filter(l => l.status === 'NEW').length;
  const followUpsCount = leads.filter(l => l.status === 'CONTACTED' || l.status === 'QUALIFIED').length;
  const technicalPendingCount = leads.filter(l => !l.technicalIntake?.isCompleted).length;
  const closedWonCount = leads.filter(l => l.status === 'CONVERTED').length;

  // تأكيد استلام سريع للطلب من الجدول
  const handleQuickAcknowledge = async (leadId: string) => {
    try {
      const res = await axios.post(`/api/leads/${leadId}/acknowledge`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        toast.success(res.data.message);
        fetchLeads();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل تأكيد استلام الطلب.');
    }
  };

  // مؤشر مرحلة المسار (4 خطوات)
  const getStageBadge = (lead: any) => {
    if(lead.voiceReviewStatus==='PENDING')return <span className="text-xs bg-amber-50 text-amber-900 px-3 py-1 rounded-full">بانتظار تنسيق التسويق</span>;
    if(!lead.assignedEngineerId)return <span className="text-xs bg-amber-50 text-amber-900 px-3 py-1 rounded-full">بانتظار المراجعة والإسناد</span>;
    if(lead.paymentReceipt?.isReceived&&lead.paymentReceipt.paymentType==='DEPOSIT')return <span className="text-xs rounded-full bg-amber-50 text-amber-900 px-3 py-1">عربون مسجل · التنفيذ مستمر</span>;
    if (lead.paymentReceipt?.isReceived) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0F6237] bg-[#137A45]/15 border border-[#137A45]/40 px-2.5 py-0.5 rounded-full">
          <CheckCircle2 className="w-3 h-3 text-[#0F6237]" />
          <span>تم التعاقد والدفع 💰</span>
        </span>
      );
    }
    if (lead.technicalIntake?.isCompleted) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-800 bg-sky-100 border border-sky-300 px-2.5 py-0.5 rounded-full">
          <Code2 className="w-3 h-3 text-sky-700" />
          <span>المواصفات معتمدة 📝</span>
        </span>
      );
    }
    if (lead.contactConfirmedAt) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
          <FileText className="w-3 h-3 text-amber-700" />
          <span>بانتظار توثيق المواصفات</span>
        </span>
      );
    }
    if (lead.acknowledgedAt) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-full animate-pulse">
          <Phone className="w-3 h-3 text-amber-700" />
          <span>بانتظار أول تواصل (5د)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-aethra-ink bg-aethra-cyan border border-[#1396AF] px-2.5 py-0.5 rounded-full animate-pulse">
        <Zap className="w-3 h-3 text-aethra-ink" />
        <span>بانتظار تأكيد الاستلام (10د)</span>
      </span>
    );
  };

  // دالة حساب مؤشر الوقت المنقضي
  const getElapsedBadge = (createdAt: string, status: string) => {
    if (status !== 'NEW') return null;
    const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);

    if (hours < 2) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-aethra-ink bg-aethra-cyan px-2 py-0.5 rounded-full border border-[#1396AF]">
          <Clock className="w-3 h-3 text-aethra-ink" />
          <span>جديد ({Math.round(hours * 60)} د)</span>
        </span>
      );
    } else if (hours < 6) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
          <Clock className="w-3 h-3" />
          <span>تأخر {Math.round(hours)} ساعات</span>
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-full animate-pulse">
          <AlertTriangle className="w-3 h-3" />
          <span>معلق (+{Math.round(hours)} س)</span>
        </span>
      );
    }
  };

  return (
    <div className="space-y-6">
      <nav aria-label="نطاق الطلبات" className="flex flex-wrap gap-2 mb-5">{([['mine','المسندة لي'],...(hasPermission(user,'leads:view_submitted')?[['submitted',hasPermission(user,'voice:review')?'سجلتها أو نسقتها':'سجلتها بنفسي']]:[]),...(hasPermission(user,'leads:view_track')?[['team','طلبات فريقي']]:[]),...(hasPermission(user,'voice:review')?[['voice','تسجيلات تنتظر التنسيق']]:[])] as ['mine'|'submitted'|'team'|'voice',string][]).map(([key,label])=><button key={key} className={`rounded-xl border px-4 py-2 text-sm ${view===key?'bg-aethra-ink text-white':'bg-white'}`} onClick={()=>{setView(key);setPage(1);}}>{label}</button>)}</nav>

      {/* Header الترحيبي (يتكيف حسب رتبة المهندس أو التيم ليدر) */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-surface-border p-6 rounded-xl shadow-none">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-aethra-ink">
              {`مرحباً، ${user?.name}`}
            </h2>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
              isTeamLeader ? 'bg-aethra-ink text-aethra-cyan' : 'bg-aethra-cyan text-aethra-ink'
            }`}>
              {isTeamLeader ? 'تيم ليدر — طلباتي ومتابعة فريقي' : hasPermission(user,'routing:receive')?'مساحة عمل المهندس':'تسجيل العملاء وتنسيق الطلبات'}
            </span>
            {user?.trackId?.name && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-stone-100 border border-surface-border text-aethra-ink">
                {user.trackId.name}
              </span>
            )}
          </div>
          <p className="text-xs text-surface-muted mt-1">
            {isTeamLeader
              ? 'تابع طلباتك بنفس أدوات المهندس، وراجع طلبات زملائك في التراك من تبويب طلبات فريقي.'
              : hasPermission(user,'routing:receive')?'تابع عملاءك المسندين، وثق المواصفات الفنية بعد أول تواصل، وأغلق التعاقدات الناجحة.':'تابع الطلبات اللي سجلتها ونسق التسجيلات الصوتية حسب صلاحياتك.'
            }
          </p>
        </div>

        <button
          onClick={fetchLeads}
          className="flex items-center gap-2 text-xs font-bold bg-aethra-paper hover:bg-aethra-cyan text-aethra-ink px-4 py-2.5 rounded-xl border border-surface-border transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تحديث القائمة</span>
        </button>
      </div>

      {/* بطاقات المؤشرات الأربعة */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* 1. عدد العملاء الجدد */}
        <div className="bg-white border border-surface-border rounded-xl p-4 shadow-none transition">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-surface-muted">العملاء الجدد</p>
            <span className="w-2.5 h-2.5 rounded-full bg-aethra-cyan"></span>
          </div>
          <p className="text-2xl font-semibold text-aethra-ink mt-2">{newLeadsCount}</p>
          <p className="text-[10px] text-surface-muted mt-1">بانتظار أول تواصل هاتفي</p>
        </div>

        {/* 2. المتابعات الجارية */}
        <div className="bg-white border border-surface-border rounded-xl p-4 shadow-none transition">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-surface-muted">متابعات وتفاوض</p>
            <Clock className="w-4 h-4 text-aethra-ink" />
          </div>
          <p className="text-2xl font-semibold text-aethra-ink mt-2">{followUpsCount}</p>
          <p className="text-[10px] text-surface-muted mt-1">قيد الاتصال وتجهيز العروض</p>
        </div>

        {/* 3. المواصفات الفنية المعلقة */}
        <div className="bg-white border border-surface-border rounded-xl p-4 shadow-none transition">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-surface-muted">بانتظار المواصفات الفنية</p>
            <Code2 className="w-4 h-4 text-amber-800" />
          </div>
          <p className="text-2xl font-semibold text-aethra-ink mt-2">{technicalPendingCount}</p>
          <p className="text-[10px] text-surface-muted mt-1">تتطلب اعتماد نطاق العمل</p>
        </div>

        {/* 4. الصفقات المغلقة (أخضر للنجاح) */}
        <div className="bg-white border border-surface-border rounded-xl p-4 shadow-none transition border-r-4 border-r-[#137A45]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-[#137A45]">الصفقات المغلقة (Won)</p>
            <CheckCircle2 className="w-4 h-4 text-[#137A45]" />
          </div>
          <p className="text-2xl font-semibold text-[#137A45] mt-2">{closedWonCount}</p>
          <p className="text-[10px] text-surface-muted mt-1">تعاقدات ناجحة للتراك</p>
        </div>
      </div>

      {/* شريط البحث والتصفية */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-surface-border p-4 rounded-xl shadow-none">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-surface-muted absolute right-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="بحث باسم العميل، رقم الهاتف، أو كود الطلب..."
            className="w-full bg-aethra-paper border border-surface-border rounded-xl pr-10 pl-3.5 py-2.5 text-xs text-aethra-ink focus:border-aethra-ink focus:bg-white focus:outline-none transition shadow-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-surface-muted" />
          <select
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="bg-aethra-paper border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-aethra-ink font-bold focus:border-aethra-ink focus:bg-white focus:outline-none transition shadow-none"
          >
            <option value="">كافة الحالات</option>
            <option value="NEW">جديد (NEW)</option>
            <option value="CONTACTED">تم التواصل (CONTACTED)</option>
            <option value="QUALIFIED">مؤهل (QUALIFIED)</option>
            <option value="QUOTATION_SENT">تم إرسال العرض (QUOTATION_SENT)</option>
            <option value="NEGOTIATION">تفاوض (NEGOTIATION)</option>
            <option value="CONVERTED">تم الاتفاق (CONVERTED)</option>
            <option value="LOST">ملغي / فُقد (LOST)</option>
          </select>
        </div>
      </div>

      {/* جدول العملاء المنظم للمكتبي وبطاقات متجاوبة للموبايل */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden shadow-none">
        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-aethra-paper text-aethra-ink font-bold uppercase text-[11px] border-b border-surface-border">
              <tr>
                <th className="px-5 py-4">كود الطلب</th>
                <th className="px-5 py-4">اسم العميل</th>
                {isTeamLeader && <th className="px-5 py-4">المهندس المستلم</th>}
                <th className="px-5 py-4">الدولة والهاتف</th>
                <th className="px-5 py-4">مسار الخطوات (4 مراحل)</th>
                <th className="px-5 py-4">الحالة</th>
                <th className="px-5 py-4">سرعة الاستجابة</th>
                <th className="px-5 py-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {loading ? (
                <tr>
                  <td colSpan={isTeamLeader ? 8 : 7} className="text-center py-12 text-surface-muted">
                    <OrbitLoader className="mr-2" />
                    جاري تحميل بيانات العملاء...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={isTeamLeader ? 8 : 7} className="text-center py-12 text-surface-muted">
                    {isTeamLeader
                      ? 'لا يوجد عملاء مسندين لهذا التراك حالياً.'
                      : 'لا يوجد عملاء مسندين إليك حالياً.'}
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead._id} className="hover:bg-aethra-paper/80 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-aethra-ink">
                      {lead.leadCode}
                      {lead.isDuplicate && (
                        <span className="mr-2 text-[9px] font-bold bg-aethra-cyan text-aethra-ink px-2 py-0.5 rounded-full border border-[#1396AF]">
                          مكرر ({lead.repeatCount + 1})
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-aethra-ink">{lead.customerName}</p>
                      <p className="text-[10px] text-surface-muted">{lead.leadSource || 'موقع عام'}</p>
                    </td>

                    {isTeamLeader && (
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-aethra-ink bg-aethra-paper border border-surface-border px-2.5 py-1 rounded-lg">
                          {lead.assignedEngineerId?.name || 'غير مسند'}
                        </span>
                      </td>
                    )}

                    <td className="px-5 py-3.5 font-mono">
                      <p className="text-aethra-ink font-bold">{lead.phone}</p>
                      <p className="text-[10px] text-surface-muted">{lead.country}</p>
                    </td>

                    {/* مؤشر مرحلة المسار (4 خطوات) */}
                    <td className="px-5 py-3.5">
                      {getStageBadge(lead)}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                        lead.status === 'NEW' ? 'bg-aethra-cyan text-aethra-ink border-[#1396AF]' :
                        lead.status === 'CONTACTED' ? 'bg-sky-100 text-sky-800 border-sky-200' :
                        lead.status === 'QUALIFIED' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                        lead.status === 'CONVERTED' ? 'bg-[#137A45]/20 text-[#137A45] border-[#137A45]' :
                        lead.status === 'LOST' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                        'bg-stone-100 text-stone-800 border-stone-200'
                      }`}>
                        {lead.status === 'NEW' ? 'عميل جديد' :
                         lead.status === 'CONTACTED' ? 'تم التواصل' :
                         lead.status === 'QUALIFIED' ? 'مؤهل' :
                         lead.status === 'QUOTATION_SENT' ? 'تم إرسال العرض' :
                         lead.status === 'NEGOTIATION' ? 'قيد التفاوض' :
                         lead.status === 'CONVERTED' ? 'صفقة ناجحة' :
                         lead.status === 'LOST' ? 'ملغي' : lead.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      {getElapsedBadge(lead.createdAt, lead.status) || (
                        <span className="text-[11px] font-medium text-surface-muted">
                          {lead.responseTimeMinutes ? `أول رد خلال ${lead.responseTimeMinutes} دقيقة` : 'تم التواصل'}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        {/* زر تأكيد استلام سريع (إذا لم يتم الاستلام بعد) */}
                        {own(lead) && !lead.acknowledgedAt && (
                          <button
                            onClick={() => handleQuickAcknowledge(lead._id)}
                            title="تأكيد استلام الطلب وبدء مهلة الـ 5 دقائق للتواصل"
                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-aethra-cyan hover:bg-[#43DDF9] text-aethra-ink font-semibold text-xs transition cursor-pointer border border-[#1396AF] shadow-none"
                          >
                            <Zap className="w-3.5 h-3.5 text-aethra-ink" />
                            <span>استلام ⚡</span>
                          </button>
                        )}

                        {/* زر واتساب فوري */}
                        <a
                          href={`https://wa.me/${(lead.whatsappNormalized || lead.phoneNormalized || '').replace('+', '')}?text=${encodeURIComponent(`مرحباً أستاذ ${lead.customerName}، معك ${user.name} من Aethra بخصوص طلبكم رقم ${lead.leadCode}.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="محادثة واتساب مباشرة"
                          className="p-2 rounded-xl bg-[#137A45] hover:bg-[#0F6237] text-white transition shadow-none cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </a>

                        {/* زر عرض تفاصيل العميل والخط الزمني والمواصفات */}
                        <button
                          onClick={() => {
                            setSelectedLeadId(lead._id);
                            setIsDrawerOpen(true);
                          }}
                          title="عرض تفاصيل العميل والمواصفات الفنية"
                          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-aethra-ink hover:bg-black text-aethra-cyan font-bold text-xs transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isTeamLeader ? 'متابعة' : 'تفاصيل'}</span>
                        </button>

                        {/* زر اعتذار المهندس عن العميل (للمهندس المسند فقط) */}
                        {own(lead) && lead.status === 'NEW' && !lead.acknowledgedAt && (
                          <button
                            onClick={() => setDecliningLead(lead)}
                            title="اعتذار عن استلام العميل مع ذكر السبب"
                            className="p-2 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-surface-border hover:border-rose-300 transition cursor-pointer"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (< md) for Engineer Workspace */}
        <div className="md:hidden divide-y divide-surface-border">
          {loading ? (
            <div className="text-center py-10 text-xs text-surface-muted"><OrbitLoader className="mr-2" />جاري تحميل بيانات العملاء...</div>
          ) : leads.length === 0 ? (
            <div className="text-center py-10 text-xs text-surface-muted">لا يوجد عملاء مسندين حالياً.</div>
          ) : (
            leads.map((lead) => (
              <div key={lead._id} className="p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-aethra-paper border border-surface-border px-2 py-0.5 rounded text-aethra-ink">
                      {lead.leadCode}
                    </span>
                    {lead.isDuplicate && (
                      <span className="text-[9px] font-bold bg-aethra-cyan text-aethra-ink px-1.5 py-0.5 rounded-full border border-[#1396AF]">
                        مكرر ({lead.repeatCount + 1})
                      </span>
                    )}
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    lead.status === 'NEW' ? 'bg-aethra-cyan text-aethra-ink border-[#1396AF]' :
                    lead.status === 'CONTACTED' ? 'bg-sky-100 text-sky-800 border-sky-200' :
                    lead.status === 'CONVERTED' ? 'bg-[#137A45]/20 text-[#137A45] border-[#137A45]' :
                    'bg-stone-100 text-stone-800 border-stone-200'
                  }`}>
                    {lead.status === 'NEW' ? 'عميل جديد' :
                     lead.status === 'CONTACTED' ? 'تم التواصل' :
                     lead.status === 'CONVERTED' ? 'صفقة ناجحة' : lead.status}
                  </span>
                </div>

                <div>
                  <h4 className="font-semibold text-sm text-aethra-ink">{lead.customerName}</h4>
                  <p className="text-xs text-surface-muted mt-0.5 font-mono">{lead.phone} • {lead.country}</p>
                </div>

                {isTeamLeader && lead.assignedEngineerId && (
                  <div className="text-xs bg-aethra-paper p-2 rounded-xl border border-surface-border flex items-center justify-between">
                    <span className="text-surface-muted">المهندس المسؤول:</span>
                    <strong className="text-aethra-ink">م. {lead.assignedEngineerId.name}</strong>
                  </div>
                )}

                {/* مؤشر مرحلة المسار ومؤشر الاستجابة */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  {getStageBadge(lead)}
                  {getElapsedBadge(lead.createdAt, lead.status)}
                </div>

                {/* زر استلام سريع للموبايل إذا لم يستلم بعد */}
                {own(lead) && !lead.acknowledgedAt && (
                  <button
                    onClick={() => handleQuickAcknowledge(lead._id)}
                    className="w-full py-2.5 rounded-xl bg-aethra-cyan text-aethra-ink font-semibold text-xs border border-[#1396AF] shadow-none flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Zap className="w-3.5 h-3.5 text-aethra-ink" />
                    <span>تأكيد استلام الطلب الآن ⚡</span>
                  </button>
                )}

                {/* أزرار الإجراءات السريعة للموبايل */}
                <div className="flex items-center gap-2 pt-2 border-t border-surface-border">
                  <a
                    href={`https://wa.me/${(lead.whatsappNormalized || lead.phoneNormalized || '').replace('+', '')}?text=${encodeURIComponent(`مرحباً أستاذ ${lead.customerName}، معك ${user.name} من Aethra بخصوص طلبكم رقم ${lead.leadCode}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#137A45] text-white text-xs font-bold shadow-none transition active:scale-95"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>واتساب</span>
                  </a>

                  <button
                    onClick={() => {
                      setSelectedLeadId(lead._id);
                      setIsDrawerOpen(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-aethra-ink text-aethra-cyan text-xs font-bold transition active:scale-95"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{isTeamLeader ? 'متابعة' : 'المواصفات'}</span>
                  </button>

                  {own(lead) && lead.status === 'NEW' && (
                    <button
                      onClick={() => setDecliningLead(lead)}
                      title="اعتذار عن الاستلام"
                      className="p-2.5 rounded-xl bg-white text-rose-600 border border-surface-border active:scale-95"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 p-4 text-sm">
        <button disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 border rounded-xl disabled:opacity-40">السابق</button>
        <span>صفحة {page} من {pages} — {total} عميل؛ المؤشرات أعلاه للصفحة الحالية</span>
        <button disabled={loading || page >= pages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 border rounded-xl disabled:opacity-40">التالي</button>
      </div>

      {/* Drawer لعرض وإدارة العميل وتوثيق المواصفات الفنية */}
      <LeadDetailDrawer key={selectedLeadId} onSelectLead={setSelectedLeadId} onOpenExecution={onOpenExecution}
        leadId={selectedLeadId}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedLeadId(null);
        }}
        onLeadUpdated={fetchLeads}
        user={user}
      />

      {/* Modal اعتذار المهندس */}
      {decliningLead && (
        <DeclineLeadModal
          lead={decliningLead}
          isOpen={true}
          onClose={() => setDecliningLead(null)}
          onSuccess={() => {
            setDecliningLead(null);
            fetchLeads();
          }}
        />
      )}
    </div>
  );
};
