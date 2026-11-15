import { DashboardOverview } from '../components/DashboardOverview';
import { ClientPortalSettings } from './ClientPortalSettings';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { DeskTarget } from '../components/WorkSidebar';
import { OperationalOverview } from '../components/OperationalOverview';
import { hasPermission, sectionPermissions } from '../utils/auth';
import { ServiceCatalogManager } from './ServiceCatalogManager';
import { PasswordRequests } from './PasswordRequests';
import { isAdministrator } from '../utils/auth';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  BarChart3,
  Users,
  TrendingUp,
  Clock,
  DollarSign,
  ShieldCheck,
  Sliders,
  Download,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Power,
  Zap,
  Tag,
  Sparkles,
  UserCheck,
  Briefcase,
  Layers,
  Key,
  Plus,
  Trash2,
  Edit,
  X,
  Lock,
  Phone,
  Mail,
  Search,
  Filter,
  FileSpreadsheet,
  Check,
  ExternalLink,
  ChevronDown,
  Menu,
  Fingerprint,
  Laptop,
  Smartphone,
  Tablet,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminSidebar, AdminSection } from '../components/AdminSidebar';
import { OrbitLoader } from '../components/OrbitLoader';
import { CustomerDirectory } from './CustomerDirectory';
import { LeadDetailDrawer } from '../components/LeadDetailDrawer';

interface AdminCommandCenterProps {
  onSwitchTab?: (tab: 'public' | 'staff' | 'workspace' | 'admin' | 'desk' | 'teams') => void;
  onLogout?: () => void;
  user?: any;onBack?:()=>void;onOpenDesk?:(target:DeskTarget)=>void;onOpenExecution?:(id:string)=>void;
}

export const AdminCommandCenter: React.FC<AdminCommandCenterProps> = ({
  onSwitchTab,onBack,onOpenDesk,onOpenExecution,
  onLogout,
  user
}) => {
  const [currentSection, setCurrentSection] = useState<AdminSection>(()=>(Object.keys(sectionPermissions).find(section=>hasPermission(user,sectionPermissions[section]))||'overview') as AdminSection);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);

  const [analytics, setAnalytics] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // SLA Timers configuration
  const [slaAckMinutes, setSlaAckMinutes] = useState<number>(10);
  const [slaContMinutes, setSlaContMinutes] = useState<number>(5);
  const [savingSla, setSavingSla] = useState(false);

  // Leads state & filters
  const [leads, setLeads] = useState<any[]>([]);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [leadPage, setLeadPage] = useState(1);
  const [leadPages, setLeadPages] = useState(1);
  const [leadTotal, setLeadTotal] = useState(0);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadTrackFilter, setLeadTrackFilter] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState('');

  // Bulk Reassign Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [targetEngineerId, setTargetEngineerId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [submittingBulk, setSubmittingBulk] = useState(false);

  // Users State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'ENGINEER',
    roleId: '',
    trackId: '',
    maxDailyLeads: 5,
    specializations: [] as string[]
  });

  // Tracks State
  const [tracksList, setTracksList] = useState<any[]>([]);
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<any>(null);
  const [trackForm, setTrackForm] = useState({
    nameEn:'', descriptionEn:'', name: '',
    slug: '',
    description: '',
    teamLeaderId: '',
    color: '#1AD6F7'
  });

  // Roles State
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);

  // Audit Logs State (سجلات الرقابة وتتبع أجهزة الموظفين)
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditStats, setAuditStats] = useState<any>({});
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditEntityType, setAuditEntityType] = useState('ALL');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const roleDialogRef=useRef<HTMLDivElement>(null);
  useDialogFocus(isRoleModalOpen,roleDialogRef,()=>setIsRoleModalOpen(false));
  const [editingRole, setEditingRole] = useState<any>(null);
  const [roleForm, setRoleForm] = useState({
    name: '',
    slug: '',
    description: '',
    permissions: ['leads:create_marketing','leads:view_submitted','desk:use'] as string[]
  });

  // Services State
  const [servicesList, setServicesList] = useState<any[]>([]);
  const [serviceTrackFilter, setServiceTrackFilter] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const requestRef = useRef<AbortController>();
  const auditRequestRef = useRef<AbortController>();

  const fetchDashboardData = useCallback(() => {
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    const requestConfig = {headers, signal: request.signal};
    setLoading(true);
    Promise.all([
      hasPermission(user,'reports:view')?axios.get('/api/reports/dashboard', requestConfig):Promise.resolve({data:{success:false}}),
      axios.get('/api/settings', requestConfig),
      axios.get('/api/leads', { ...requestConfig, params: { page: leadPage, limit: 50, search: leadSearch || undefined, trackId: leadTrackFilter || undefined, status: leadStatusFilter || undefined, unassignedOnly: unassignedOnly ? 'true' : undefined } }),
      hasPermission(user,'users:manage')||hasPermission(user,'leads:assign')||hasPermission(user,'tracks:manage')?axios.get('/api/admin/users', requestConfig):Promise.resolve({data:{success:false}}),
      axios.get('/api/tracks', requestConfig),
      axios.get('/api/roles', requestConfig),
      axios.get('/api/public/services', requestConfig)
    ])
      .then(([repRes, setRes, leadsRes, usersRes, tracksRes, rolesRes, servRes]) => {
        if (request.signal.aborted) return;
        if (repRes.data.success) setAnalytics(repRes.data.data);
        if (setRes.data.success) {
          const s = setRes.data.data.settings;
          setSettings(s);
          if (s.slaAcknowledgeMinutes !== undefined) setSlaAckMinutes(s.slaAcknowledgeMinutes);
          if (s.slaContactMinutes !== undefined) setSlaContMinutes(s.slaContactMinutes);
        }
        if (leadsRes.data.success) {
          setLeads(leadsRes.data.data.leads);
          setLeadPages(Math.max(1, leadsRes.data.data.pagination.pages));
          setLeadTotal(leadsRes.data.data.pagination.total);
          setSelectedLeadIds([]);
        }
        if (usersRes.data.success) setUsersList(usersRes.data.data.users);
        if (tracksRes.data.success) setTracksList(tracksRes.data.data.tracks);
        if (rolesRes.data.success) {
          setRolesList(rolesRes.data.data.roles);
          setAvailablePermissions(rolesRes.data.data.availablePermissions);
        }
        if (servRes.data.success) setServicesList(servRes.data.data.services);
      })
      .catch(error => {
        if (request.signal.aborted || axios.isCancel(error)) return;
        toast.error('فشل جلب بيانات لوحة الإدارة.');
      })
      .finally(() => { if (!request.signal.aborted) setLoading(false); });
  }, [unassignedOnly, leadPage, leadSearch, leadTrackFilter, leadStatusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(fetchDashboardData, 200);
    return () => { window.clearTimeout(timer); requestRef.current?.abort(); };
  }, [fetchDashboardData]);

  // تحديث سياسة التوزيع
  const handleUpdateRoutingMode = async (mode: string) => {
    try {
      const res = await axios.patch('/api/settings', { routingMode: mode }, { headers });
      if (res.data.success) {
        setSettings(res.data.data.settings);
        toast.success(`تم تغيير سياسة التوزيع إلى [${mode}].`);
      }
    } catch {
      toast.error('فشل تحديث الإعدادات.');
    }
  };

  // حفظ مهل الاستجابة السريعة (SLA Timers)
  const handleUpdateSlaTimers = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSla(true);
    try {
      const res = await axios.patch('/api/settings', {
        slaAcknowledgeMinutes: Number(slaAckMinutes),
        slaContactMinutes: Number(slaContMinutes)
      }, { headers });
      if (res.data.success) {
        setSettings(res.data.data.settings);
        toast.success('تم حفظ وتحديث مهل الاستجابة السريعة (SLA) بنجاح.');
      }
    } catch {
      toast.error('فشل حفظ مهل الاستجابة.');
    } finally {
      setSavingSla(false);
    }
  };

  // فحص الـ SLA
  const handleTriggerSla = async () => {
    try {
      const res = await axios.post('/api/settings/check-sla', {}, { headers });
      toast.success(res.data.message);
      fetchDashboardData();
    } catch {
      toast.error('فشل فحص مهلة الرد.');
    }
  };

  // تصدير إكسيل
  const handleExportExcel = async () => {
    try {
      const res = await axios.get('/api/reports/export', { headers, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Aethra_Leads_Report_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('تم تصدير تقرير Excel بنجاح.');
    } catch {
      toast.error('فشل تصدير ملف Excel.');
    }
  };

  // جلب سجلات الرقابة وتتبع الأجهزة (Audit Logs)
  const fetchAuditLogs = useCallback(() => {
    auditRequestRef.current?.abort();
    const request = new AbortController();
    auditRequestRef.current = request;
    setAuditLoading(true);
    axios.get('/api/audit-logs', {
      headers,
      signal: request.signal,
      params: {
        page: auditPage,
        limit: 30,
        entityType: auditEntityType !== 'ALL' ? auditEntityType : undefined,
        action: auditActionFilter !== 'ALL' ? auditActionFilter : undefined,
        search: auditSearch.trim() || undefined
      }
    })
      .then((res: any) => {
        if (request.signal.aborted) return;
        if (res.data.success) {
          setAuditLogs(res.data.data.logs || []);
          setAuditStats(res.data.data.stats || {});
          setAuditTotalPages(res.data.data.pages || 1);
        }
      })
      .catch(error => {
        if (request.signal.aborted || axios.isCancel(error)) return;
        toast.error('فشل جلب سجلات الرقابة وتتبع الأجهزة.');
      })
      .finally(() => { if (!request.signal.aborted) setAuditLoading(false); });
  }, [auditPage, auditEntityType, auditActionFilter, auditSearch]);

  useEffect(() => {
    const timer = currentSection === 'audit' ? window.setTimeout(fetchAuditLogs, 200) : undefined;
    return () => { window.clearTimeout(timer); auditRequestRef.current?.abort(); };
  }, [currentSection, fetchAuditLogs]);

  // تصدير سجلات الرقابة بتنسيق CSV
  const handleExportAuditCSV = async () => {
    try {
      const res = await axios.get('/api/audit-logs/export', { headers, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Aethra_Audit_Logs_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('تم تصدير سجلات الرقابة والأجهزة بنجاح.');
    } catch {
      toast.error('فشل تصدير سجلات الرقابة.');
    }
  };

  // إعادة الإسناد الجماعي
  const handleBulkReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEngineerId) {
      toast.error('يرجى اختيار المهندس المستلم.');
      return;
    }

    setSubmittingBulk(true);
    try {
      const res = await axios.post('/api/admin/leads/bulk-reassign', {
        leadIds: selectedLeadIds,
        targetEngineerId,
        reason: reassignReason || 'إعادة توزيع جماعية من الإدارة'
      }, { headers });

      if (res.data.success) {
        toast.success(res.data.message);
        setIsBulkModalOpen(false);
        setSelectedLeadIds([]);
        setTargetEngineerId('');
        setReassignReason('');
        fetchDashboardData();
      }
    } catch {
      toast.error('فشل إعادة الإسناد.');
    } finally {
      setSubmittingBulk(false);
    }
  };

  // حفظ مستخدم (إنشاء أو تعديل)
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const res = await axios.put(`/api/admin/users/${editingUser._id}`, userForm, { headers });
        if (res.data.success) toast.success(res.data.message);
      } else {
        const res = await axios.post('/api/admin/users', userForm, { headers });
        if (res.data.success) toast.success(res.data.message);
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل حفظ بيانات المستخدم.');
    }
  };

  // حذف مستخدم
  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب [${name}]؟`)) return;
    try {
      const res = await axios.delete(`/api/admin/users/${id}`, { headers });
      if (res.data.success) {
        toast.success(res.data.message);
        fetchDashboardData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل حذف المستخدم.');
    }
  };

  // تفعيل / تعطيل مستخدم
  const handleToggleUserActive = async (targetUser: any) => {
    try {
      const res = await axios.put(`/api/admin/users/${targetUser._id}`, { isActive: !targetUser.isActive }, { headers });
      if (res.data.success) {
        toast.success(`تم ${!targetUser.isActive ? 'تفعيل' : 'تعطيل'} حساب [${targetUser.name}].`);
        fetchDashboardData();
      }
    } catch {
      toast.error('فشل تغيير حالة الحساب.');
    }
  };

  // حفظ تراك
  const handleSaveTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTrack) {
        const res = await axios.put(`/api/tracks/${editingTrack._id}`, trackForm, { headers });
        if (res.data.success) toast.success(res.data.message);
      } else {
        const res = await axios.post('/api/tracks', trackForm, { headers });
        if (res.data.success) toast.success(res.data.message);
      }
      setIsTrackModalOpen(false);
      setEditingTrack(null);
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل حفظ التراك.');
    }
  };

  // حفظ رتبة وصلاحيات
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRole) {
        const res = await axios.put(`/api/roles/${editingRole._id}`, roleForm, { headers });
        if (res.data.success) toast.success(res.data.message);
      } else {
        const res = await axios.post('/api/roles', roleForm, { headers });
        if (res.data.success) toast.success(res.data.message);
      }
      setIsRoleModalOpen(false);
      setEditingRole(null);
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل حفظ الرول.');
    }
  };

  // حذف رول مخصص
  const handleDeleteRole = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف رول [${name}]؟`)) return;
    try {
      const res = await axios.delete(`/api/roles/${id}`, { headers });
      if (res.data.success) {
        toast.success(res.data.message);
        fetchDashboardData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل حذف الرول.');
    }
  };

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllLeads = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map(l => l._id));
    }
  };

  const activeEngineersCount = analytics?.engineerMatrix?.filter((e: any) => e.isActive).length || 0;

  // Filtered Leads
  const filteredLeads = leads;

  // Filtered Users
  const filteredUsers = usersList.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.phone?.includes(q);
  });

  // Filtered Services
  const filteredServices = servicesList.filter(s => {
    if (!serviceTrackFilter) return true;
    return s.trackId?._id === serviceTrackFilter || s.trackId === serviceTrackFilter;
  });

  return (
    <div className="flex w-full h-full min-h-0 bg-aethra-paper overflow-x-hidden">
      {/* ----------------- SIDEBAR ----------------- */}
      <AdminSidebar
        currentSection={currentSection} onBack={onBack} onOpenDesk={onOpenDesk}
        onSelectSection={section=>{if(hasPermission(user,sectionPermissions[section]))setCurrentSection(section);}}
        onSwitchTab={onSwitchTab}
        onExportExcel={handleExportExcel}
        onTriggerSla={handleTriggerSla}
        onLogout={onLogout || (() => {})}
        stats={{
          totalLeads: analytics?.kpis?.totalLeads || leads.length,
          activeEngineers: activeEngineersCount,
          tracksCount: tracksList.length,
          usersCount: usersList.length,
          rolesCount: rolesList.length
        }}
        user={user}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />

      {/* ----------------- MAIN CONTENT AREA ----------------- */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Top Header Bar for Admin */}
        <header className="bg-white border-b border-surface-border px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 shadow-none">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileSidebarOpen(true)} aria-label="فتح قائمة الإدارة"
              className="md:hidden p-2 rounded-xl bg-aethra-ink text-aethra-cyan hover:bg-black transition cursor-pointer active:scale-95 shadow-none"
              title="فتح القائمة الجانبية"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-aethra-cyan"></span>
                <h1 className="text-base sm:text-lg font-semibold text-aethra-ink">
                  {currentSection === 'overview' && 'لوحة القيادة والمؤشرات التنفيذية'}
                  {currentSection === 'routing' && 'خوارزمية التوزيع وطابور المهندسين'}
                  {currentSection === 'leads' && 'الطلبات والإسناد'}
                  {currentSection === 'customers' && 'ملفات العملاء'}
                  {currentSection === 'tracks' && 'إدارة التراكات والتيم ليدرز'}
                  {currentSection === 'services' && 'كتالوج الخدمات الرقمية والتخصصات'}{currentSection==='passwords' && 'طلبات كلمات المرور'}
                  {currentSection === 'users' && 'إدارة المستخدمين وفريق العمل'}
                  {currentSection === 'roles' && 'منظومة الرتب والصلاحيات (RBAC)'}
                  {currentSection === 'clientBrand' && 'هوية صفحة تسجيل العملاء'}
                  {currentSection === 'audit' && 'سجل الرقابة وتتبع أجهزة الموظفين (Audit Logs)'}
                </h1>
              </div>
              <p className="text-[11px] sm:text-xs text-surface-muted mt-0.5 line-clamp-1 sm:line-clamp-none">
                {currentSection === 'overview' && 'نظرة شاملة على أداء الشركة، الصفقات، وحجم الطلبات عبر كافة التراكات.'}
                {currentSection === 'routing' && 'ضبط سياسة التوزيع التلقائي ومراقبة مناوبات المهندسين في طابور العمل.'}
                {currentSection === 'leads' && 'متابعة كل طلب بشكل مستقل ومراجعة الخدمات والأقسام قبل الإسناد.'}
                {currentSection === 'customers' && 'بيانات العميل وطلباته السابقة والحالية في ملف واحد.'}
                {currentSection === 'tracks' && 'تراكات الشركة المتخصصة (برمجة، تسويق، مونتاج، AI) وتعيين قادة الفرق.'}
                {currentSection === 'services' && 'الخدمات المتاحة للعملاء وربطها بالتراكات المسؤولة عنها.'}
                {currentSection === 'users' && 'إدارة حسابات المهندسين، قادة الفرق، ومسؤولي التسويق وصلاحياتهم.'}
                {currentSection === 'roles' && 'تحديد صلاحيات الوصول بدقة متناهية وإنشاء رتب مخصصة لفرق العمل.'}
                {currentSection === 'audit' && 'سجل رقابي مخصص لمدير النظام فقط، لتتبع حركات الموظفين وتفاصيل أجهزتهم (النوع، النظام، المتصفح، وعنوان الـ IP).'}
              </p>
            </div>
          </div>

          {/* Quick Header Actions based on Active Section */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {currentSection === 'users' && (
              <button
                onClick={() => {
                  setEditingUser(null);
                  setUserForm({
                    name: '',
                    email: '',
                    password: '',
                    phone: '',
                    role: 'ENGINEER',
                    roleId: rolesList.find(r => r.slug === 'ENGINEER')?._id || '',
                    trackId: tracksList[0]?._id || '',
                    maxDailyLeads: 5,
                    specializations: []
                  });
                  setIsUserModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-aethra-cyan text-aethra-ink font-bold text-xs shadow-none border border-[#1396AF] transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مستخدم جديد</span>
              </button>
            )}

            {currentSection === 'tracks' && (
              <button
                onClick={() => {
                  setEditingTrack(null);
                  setTrackForm({nameEn:'', descriptionEn:'',
                    name: '',
                    slug: '',
                    description: '',
                    teamLeaderId: '',
                    color: '#1AD6F7'
                  });
                  setIsTrackModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-aethra-cyan text-aethra-ink font-bold text-xs shadow-none border border-[#1396AF] transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء تراك جديد</span>
              </button>
            )}

            {currentSection === 'roles' && (
              <button
                onClick={() => {
                  setEditingRole(null);
                  setRoleForm({
                    name: '',
                    slug: '',
                    description: '',
                    permissions: ['leads:create_marketing','leads:view_submitted','desk:use']
                  });
                  setIsRoleModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-aethra-cyan text-aethra-ink font-bold text-xs shadow-none border border-[#1396AF] transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء رول مخصص جديد</span>
              </button>
            )}

            {currentSection === 'audit' && (
              <button
                onClick={handleExportAuditCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-stone-50 text-aethra-ink font-bold text-xs border border-surface-border shadow-none transition cursor-pointer"
                title="تصدير سجل الرقابة كاملاً كملف CSV"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">تصدير CSV</span>
              </button>
            )}

            {hasPermission(user,'reports:export') && <button
              onClick={handleExportExcel} disabled={!hasPermission(user,'reports:export')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-aethra-paper hover:bg-stone-200 text-aethra-ink text-xs font-bold border border-surface-border transition cursor-pointer"
              title="تصدير تقرير إكسيل"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>}

            <button
              onClick={fetchDashboardData}
              className="p-2 rounded-xl bg-aethra-paper hover:bg-aethra-cyan text-aethra-ink border border-surface-border transition cursor-pointer"
              title="تحديث البيانات فوراً"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Section Body */}
        <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto space-y-6">
          {currentSection==='services' && <ServiceCatalogManager/>}
          {currentSection==='passwords' && <PasswordRequests user={user}/>}
          {currentSection!=='overview' && <button className="underline text-sm" onClick={()=>setCurrentSection((Object.keys(sectionPermissions).find(section=>hasPermission(user,sectionPermissions[section]))||'overview') as AdminSection)}>رجوع لبداية الإدارة</button>}
          {currentSection==='overview'&&<DashboardOverview data={analytics} user={user} onRequests={hasPermission(user,'leads:view_all')?()=>{setCurrentSection('leads');setUnassignedOnly(true);}:undefined} onTeams={()=>onSwitchTab?.('teams')}/>}
          {/* ======================= SECTION 1: OVERVIEW & KPIS ======================= */}
          {false && currentSection === 'overview' && (
            <div className="space-y-6 animate-in fade-in">
              <OperationalOverview data={analytics?.operational} onQueue={hasPermission(user,'leads:view_all')?()=>{setCurrentSection('leads');setUnassignedOnly(true);}:undefined}/>
              {/* Executive Dark Card */}
              <div className="aethra-night-surface rounded-xl p-6 sm:p-8 shadow-none border border-dark-50 relative overflow-hidden">
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-dark-50 pb-6">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-aethra-cyan text-aethra-ink text-xs font-semibold mb-2 shadow-none">
                      <Sparkles className="w-3.5 h-3.5 text-aethra-ink" />
                      <span>مركز القيادة التنفيذية — Aethra CRM</span>
                    </div>
                    <h2 className="text-2xl font-semibold text-white">الأداء العام ومؤشرات النمو</h2>
                    <p className="text-xs text-slate-300 mt-1 max-w-xl">
                      توزيع ذكي ومتكافئ للعملاء، متابعة حية لسرعة استجابة المهندسين، ومراقبة أداء كافة التراكات.
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={handleTriggerSla} disabled={!hasPermission(user,'settings:manage')}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold transition hover:bg-amber-500/30 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>فحص وتصعيد العملاء المتأخرين (SLA)</span>
                    </button>
                  </div>
                </div>

                {/* 5 KPIs Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 pt-6">
                  <div className="bg-dark-50/90 border border-[#24364E] rounded-xl p-4">
                    <p className="text-xs text-slate-400 font-medium">إجمالي الطلبات</p>
                    <p className="text-2xl font-semibold text-white mt-1.5">{analytics?.kpis?.totalLeads || leads.length}</p>
                    <p className="text-[10px] text-slate-400 mt-1">كافة الطلبات المسجلة</p>
                  </div>

                  <div className="bg-dark-50/90 border border-[#24364E] rounded-xl p-4">
                    <p className="text-xs text-slate-400 font-medium">المهندسون النشطون</p>
                    <p className="text-2xl font-semibold text-aethra-cyan mt-1.5">{activeEngineersCount} مهندساً</p>
                    <p className="text-[10px] text-slate-400 mt-1">في طابور التوزيع</p>
                  </div>

                  <div className="bg-dark-50/90 border border-[#24364E] rounded-xl p-4">
                    <p className="text-xs text-slate-400 font-medium">التراكات الرقمية</p>
                    <p className="text-2xl font-semibold text-white mt-1.5">{tracksList.length} تراكات</p>
                    <p className="text-[10px] text-slate-400 mt-1">برمجة، تسويق، مونتاج، AI</p>
                  </div>

                  <div className="bg-dark-50/90 border border-[#24364E] rounded-xl p-4">
                    <p className="text-xs font-bold text-[#67E8A5]">إجمالي الدفعات الموثقة</p>
                    <p className="text-xl font-semibold text-[#67E8A5] mt-1.5">
                      {(analytics?.kpis?.revenueByCurrency || []).map((r: any) => `${r.amount.toLocaleString()} ${r.currency}`).join(' / ') || '0'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">{analytics?.kpis?.convertedLeads || 0} صفقة ناجحة (Won)</p>
                  </div>

                  <div className="bg-dark-50/90 border border-[#24364E] rounded-xl p-4">
                    <p className="text-xs text-slate-400 font-medium">متوسط زمن أول رد</p>
                    <p className="text-2xl font-semibold text-white mt-1.5">
                      {analytics?.kpis?.avgResponseTimeMinutes ? `${analytics.kpis.avgResponseTimeMinutes} د` : 'فوري'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">مؤشر سرعة الاستجابة SLA</p>
                  </div>
                </div>
              </div>

              {/* بطاقات التراكات الرقمية السريعة */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-aethra-ink flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-aethra-ink" />
                    <span>تراكات عمل Aethra ({tracksList.length})</span>
                  </h3>
                  <button
                    onClick={() => setCurrentSection('tracks')} disabled={!hasPermission(user,'tracks:manage')}
                    className="text-xs text-aethra-ink hover:underline font-bold"
                  >
                    عرض التفاصيل والإدارة &larr;
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {tracksList.map(t => (
                    <button type="button"
                      key={t._id}
                      onClick={() => setCurrentSection('tracks')} disabled={!hasPermission(user,'tracks:manage')}
                      className="bg-white border border-surface-border rounded-xl p-4 shadow-none transition cursor-pointer space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: t.color || '#1AD6F7' }} />
                          <h4 className="text-xs font-semibold text-aethra-ink">{t.name}</h4>
                        </div>
                        <span className="text-[10px] font-mono text-surface-muted">{t.slug}</span>
                      </div>
                      <p className="text-[11px] text-surface-muted line-clamp-2">{t.description || 'تراك متخصص في الحلول الرقمية.'}</p>
                      <div className="flex items-center justify-between pt-2 border-t border-surface-border text-[10px]">
                        <span className="text-surface-muted">تيم ليدر: <strong className="text-aethra-ink">{t.teamLeaderId?.name || 'غير محدد'}</strong></span>
                        <span className="bg-aethra-paper border border-surface-border px-2 py-0.5 rounded font-bold text-aethra-ink">
                          {t.leadsCount || 0} عميل
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* مقارنة سريعة لسياسة التوزيع ومناوبة المهندسين */}
              <div className="bg-white border border-surface-border rounded-xl p-6 shadow-none flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-aethra-ink flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-aethra-ink" />
                    <span>خوارزمية التوزيع النشطة حالياً: <strong className="bg-aethra-cyan text-aethra-ink px-2.5 py-0.5 rounded-full text-xs font-semibold">{settings?.routingMode || 'AUTO_ROUND_ROBIN'}</strong></span>
                  </h3>
                  <p className="text-xs text-surface-muted mt-1">
                    يُحدد المهندس المستلم عند وصول الطلب وفق التراك وسياسة التوزيع والسعة المتاحة.
                  </p>
                </div>

                <button
                  onClick={() => setCurrentSection('routing')} disabled={!hasPermission(user,'settings:manage')}
                  className="px-4 py-2.5 rounded-xl bg-aethra-ink text-aethra-cyan font-bold text-xs transition hover:bg-black cursor-pointer shadow-none"
                >
                  إدارة سياسات التوزيع وطابور المهندسين &larr;
                </button>
              </div>
            </div>
          )}

          {/* ======================= SECTION 2: ROUTING & QUEUE ======================= */}
          {currentSection === 'routing' && (
            <div className="space-y-6 animate-in fade-in">
              {/* خيارات الخوارزمية */}
              <div className="bg-white border border-surface-border rounded-xl p-6 sm:p-7 shadow-none space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border pb-4">
                  <div>
                    <h3 className="text-base font-semibold text-aethra-ink flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-aethra-ink" />
                      <span>خوارزمية التوزيع التلقائي للعملاء (Routing Engine)</span>
                    </h3>
                    <p className="text-xs text-surface-muted mt-0.5">
                      حدد سياسة توزيع العملاء على مهندسي ومتخصصي التراكات المختلفة
                    </p>
                  </div>

                  <button
                    onClick={handleTriggerSla} disabled={!hasPermission(user,'settings:manage')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-700" />
                    <span>فحص وتصعيد العملاء المتأخرين (SLA Escalation)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {[
                    { id: 'AUTO_ROUND_ROBIN', title: 'تناوبي عادل (Round-Robin)', desc: 'توزيع بالتساوي على مهندسي التراك بالتتالي لضمان العدالة الكاملة.' },
                    { id: 'AUTO_LEAST_BUSY', title: 'الأقل ضغطاً (Least Busy)', desc: 'إسناد العميل للمهندس صاحب أقل عدد من العملاء النشطين.' },
                    { id: 'AUTO_SKILL_BASED', title: 'بناءً على التخصص (Skill-Based)', desc: 'فلترة المهندسين المتخصصين بنوع الخدمة ومجال الطلب أولاً.' },
                    { id: 'MANUAL', title: 'توزيع يدوي (Manual Queue)', desc: 'إيقاف التوزيع التلقائي ليقوم الأدمن بإسناد العملاء يدوياً.' }
                  ].map(mode => (
                    <div
                      key={mode.id}
                      onClick={() => handleUpdateRoutingMode(mode.id)}
                      className={`p-5 rounded-xl border transition-all cursor-pointer ${
                        settings?.routingMode === mode.id
                          ? 'bg-aethra-cyan border-[#1396AF] text-aethra-ink shadow-none ring-2 ring-aethra-cyan'
                          : 'bg-aethra-paper border-surface-border text-surface-muted hover:text-aethra-ink hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-aethra-ink">{mode.title}</span>
                        {settings?.routingMode === mode.id && <CheckCircle2 className="w-4 h-4 text-aethra-ink" />}
                      </div>
                      <p className={`text-[11px] leading-relaxed ${settings?.routingMode === mode.id ? 'text-aethra-ink font-medium' : 'text-surface-muted'}`}>
                        {mode.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* مهل الاستجابة السريعة لمسار المهندس (SLA Timers Policy) */}
              <div className="bg-white border border-surface-border rounded-xl p-6 sm:p-7 shadow-none space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border pb-4">
                  <div>
                    <h3 className="text-base font-semibold text-aethra-ink flex items-center gap-2">
                      <Clock className="w-5 h-5 text-aethra-ink" />
                      <span>مهل الاستجابة السريعة والتواصل (SLA Countdown Timers)</span>
                    </h3>
                    <p className="text-xs text-surface-muted mt-0.5">
                      حدد المهل الزمنية الإلزامية للمهندس لتأكيد استلام الطلب وتأكيد أول تواصل مع العميل (يمكن تغييرها في أي وقت)
                    </p>
                  </div>
                </div>

                <form onSubmit={handleUpdateSlaTimers} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                  <div className="bg-aethra-paper p-4 rounded-xl border border-surface-border space-y-1.5">
                    <label className="block text-xs font-semibold text-aethra-ink">
                      مهلة تأكيد استلام الطلب (Step 1)
                    </label>
                    <p className="text-[11px] text-surface-muted">
                      المدة المتاحة للمهندس لتأكيد استلام الطلب بعد إسناده إليه
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        required
                        value={slaAckMinutes}
                        onChange={(e) => setSlaAckMinutes(Number(e.target.value))}
                        className="bg-white border border-surface-border rounded-xl px-3 py-2 text-xs font-semibold text-aethra-ink w-24 text-center focus:border-aethra-ink focus:outline-none"
                      />
                      <span className="text-xs font-bold text-surface-muted">دقائق (افتراضياً: 10 د)</span>
                    </div>
                  </div>

                  <div className="bg-aethra-paper p-4 rounded-xl border border-surface-border space-y-1.5">
                    <label className="block text-xs font-semibold text-aethra-ink">
                      مهلة تأكيد التواصل مع العميل (Step 2)
                    </label>
                    <p className="text-[11px] text-surface-muted">
                      المدة المتاحة للمهندس بعد استلام الطلب لإتمام أول تواصل
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        required
                        value={slaContMinutes}
                        onChange={(e) => setSlaContMinutes(Number(e.target.value))}
                        className="bg-white border border-surface-border rounded-xl px-3 py-2 text-xs font-semibold text-aethra-ink w-24 text-center focus:border-aethra-ink focus:outline-none"
                      />
                      <span className="text-xs font-bold text-surface-muted">دقائق (افتراضياً: 5 د)</span>
                    </div>
                  </div>

                  <div className="flex items-center h-full pb-1">
                    <button
                      type="submit"
                      disabled={savingSla}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-aethra-cyan hover:bg-[#43DDF9] text-aethra-ink text-xs font-semibold transition border border-[#1396AF] shadow-none cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-aethra-ink" />
                      <span>{savingSla ? 'جاري الحفظ...' : 'حفظ مهل الـ SLA الجديدة'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* مقارنة أداء كل مهندس وسعة الاستيعاب */}
              <div className="bg-white border border-surface-border rounded-xl overflow-hidden shadow-none">
                <div className="p-6 border-b border-surface-border flex flex-wrap items-center justify-between gap-3 bg-aethra-paper">
                  <div>
                    <h3 className="text-base font-semibold text-aethra-ink flex items-center gap-2">
                      <Users className="w-5 h-5 text-aethra-ink" />
                      <span>طابور المهندسين ومقارنة القدرة الاستيعابية ({analytics?.engineerMatrix?.length || 0})</span>
                    </h3>
                    <p className="text-xs text-surface-muted mt-1">
                      يعتمد الإسناد التالي على التراك والتخصص والسعة المتاحة وقت تسجيل الطلب.
                    </p>
                  </div>
                </div>

                {/* Desktop Table View (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-aethra-paper text-aethra-ink font-bold uppercase text-[11px] border-b border-surface-border">
                      <tr>
                        <th className="px-5 py-4">المهندس / التخصص</th>
                        <th className="px-5 py-4">حالة التواجد</th>
                        <th className="px-5 py-4">السقف اليومي</th>
                        <th className="px-5 py-4">مستلم اليوم</th>
                        <th className="px-5 py-4">إجمالي الطلبات</th>
                        <th className="px-5 py-4">صفقات ناجحة</th>
                        <th className="px-5 py-4">نسبة التحويل</th>
                        <th className="px-5 py-4">متوسط سرعة الرد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {analytics?.engineerMatrix?.map((eng: any, idx: number) => {
                        const isNextInQueue = false;
                        return (
                          <tr
                            key={eng.id}
                            className={`transition ${isNextInQueue ? 'bg-aethra-cyan/20 border-r-4 border-r-[#1AD6F7]' : 'hover:bg-aethra-paper'}`}
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                {isNextInQueue && (
                                  <span className="bg-aethra-cyan text-aethra-ink text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-[#1396AF] shadow-none">
                                    التالي في الدور ★
                                  </span>
                                )}
                                <div>
                                  <p className="font-semibold text-aethra-ink">{eng.name}</p>
                                  <p className="text-[10px] text-surface-muted">{eng.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                eng.isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-stone-200 text-stone-700'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${eng.isActive ? 'bg-[#137A45]' : 'bg-stone-500'}`} />
                                {eng.isActive ? 'نشط ومتاح' : 'متوقف مؤقتاً'}
                              </span>
                            </td>
                            <td className="px-5 py-4 font-bold text-aethra-ink">{eng.maxDailyLeads || 'بدون حد'} عميل/يوم</td>
                            <td className="px-5 py-4 font-bold text-aethra-ink">{eng.todayCount} / {eng.maxDailyLeads || 'بدون حد'}</td>
                            <td className="px-5 py-4 font-bold text-aethra-ink">{eng.assignedTotal}</td>
                            <td className="px-5 py-4 font-semibold text-[#137A45]">{eng.convertedCount}</td>
                            <td className="px-5 py-4 font-bold text-aethra-ink">{eng.conversionRate}%</td>
                            <td className="px-5 py-4 text-surface-muted">{eng.avgResponseTimeMinutes ? `${eng.avgResponseTimeMinutes} دقيقة` : 'غير متوفر'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View (< md) */}
                <div className="md:hidden divide-y divide-surface-border">
                  {analytics?.engineerMatrix?.map((eng: any, idx: number) => {
                    const isNextInQueue = false;
                    return (
                      <div
                        key={eng.id}
                        className={`p-4 space-y-3 transition ${isNextInQueue ? 'bg-aethra-cyan/15 border-r-4 border-r-[#1AD6F7]' : 'bg-white'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm text-aethra-ink">{eng.name}</h4>
                              {isNextInQueue && (
                                <span className="bg-aethra-cyan text-aethra-ink text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#1396AF] shadow-none">
                                  التالي ★
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-surface-muted">{eng.email}</p>
                          </div>

                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            eng.isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-stone-200 text-stone-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${eng.isActive ? 'bg-[#137A45]' : 'bg-stone-500'}`} />
                            {eng.isActive ? 'نشط' : 'متوقف'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 bg-aethra-paper p-2.5 rounded-xl border border-surface-border text-center text-xs">
                          <div>
                            <span className="text-[10px] text-surface-muted block">السقف اليومي</span>
                            <span className="font-bold text-aethra-ink">{eng.maxDailyLeads || 'بدون حد'} عميل</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-surface-muted block">مستلم اليوم</span>
                            <span className="font-bold text-aethra-ink">{eng.todayCount} / {eng.maxDailyLeads || 'بدون حد'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-surface-muted block">نسبة التحويل</span>
                            <span className="font-semibold text-[#137A45]">{eng.conversionRate}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ======================= SECTION 3: LEADS & BULK REASSIGN ======================= */}
          {currentSection === 'customers' && <CustomerDirectory onOpenRequest={setOpenRequestId} />}
          {currentSection === 'leads' && (
            <div className="bg-white border border-surface-border rounded-xl overflow-hidden shadow-none space-y-4 animate-in fade-in">
              <div className="p-6 border-b border-surface-border flex flex-wrap items-center justify-between gap-3 bg-aethra-paper">
                <div>
                  <h3 className="text-base font-semibold text-aethra-ink flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-aethra-ink" />
                    <span>الطلبات والإسناد ({leadTotal})</span>
                  </h3>
                  <p className="text-xs text-surface-muted mt-0.5">
                    كل طلب له رقم مستقل. الطلبات المتكاملة وغير المحددة تنتظر المراجعة لتحديد المسؤول الرئيسي.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <label className="flex items-center gap-2 text-xs font-bold text-aethra-ink cursor-pointer bg-white px-3 py-2 rounded-xl border border-surface-border">
                    <input
                      type="checkbox"
                      checked={unassignedOnly}
                      onChange={(e) => { setLeadPage(1); setUnassignedOnly(e.target.checked); }}
                      className="rounded border-surface-border text-aethra-ink focus:ring-0"
                    />
                    <span>بانتظار المراجعة أو الإسناد</span>
                  </label>

                  {selectedLeadIds.length > 0 && (
                    <button
                      onClick={() => setIsBulkModalOpen(true)} disabled={!hasPermission(user,'leads:assign')}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-aethra-cyan text-aethra-ink text-xs font-semibold shadow-none border border-[#1396AF] transition cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>إعادة إسناد ({selectedLeadIds.length}) طلب</span>
                    </button>
                  )}
                </div>
              </div>

              {/* شريط الفلاتر والبحث */}
              <div className="px-6 py-2 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-surface-muted absolute right-3 top-3" />
                  <input
                    type="text"
                    value={leadSearch}
                    onChange={(e) => { setLeadPage(1); setLeadSearch(e.target.value); } }
                    placeholder="بحث باسم العميل، الهاتف، أو كود الطلب..."
                    className="w-full bg-aethra-paper border border-surface-border rounded-xl pr-9 pl-3 py-2 text-xs text-aethra-ink focus:outline-none focus:bg-white"
                  />
                </div>

                <select
                  value={leadTrackFilter}
                  onChange={(e) => { setLeadPage(1); setLeadTrackFilter(e.target.value); } }
                  className="bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink"
                >
                  <option value="">-- كافة التراكات --</option>
                  {tracksList.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>

                <select
                  value={leadStatusFilter}
                  onChange={(e) => { setLeadPage(1); setLeadStatusFilter(e.target.value); } }
                  className="bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink"
                >
                  <option value="">-- كافة الحالات --</option>
                  <option value="NEW">جديد (NEW)</option>
                  <option value="CONTACTED">تم التواصل (CONTACTED)</option>
                  <option value="QUALIFIED">مؤهل (QUALIFIED)</option>
                  <option value="QUOTATION_SENT">عرض سعر مرسل (QUOTATION_SENT)</option>
                  <option value="CONVERTED">صفقة ناجحة (CONVERTED)</option>
                  <option value="LOST">مفقود (LOST)</option>
                </select>
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-aethra-paper text-aethra-ink font-bold uppercase text-[11px] border-b border-surface-border">
                    <tr>
                      <th className="px-5 py-3.5 w-10">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                          onChange={selectAllLeads}
                          className="rounded border-surface-border"
                        />
                      </th>
                      <th className="px-5 py-3.5">كود الطلب</th>
                      <th className="px-5 py-3.5">العميل</th>
                      <th className="px-5 py-3.5">الأقسام والخدمات</th>
                      <th className="px-5 py-3.5">المهندس الحالي</th>
                      <th className="px-5 py-3.5">المواصفات الفنية</th>
                      <th className="px-5 py-3.5">طريقة التوزيع</th>
                      <th className="px-5 py-3.5">الحالة</th>
                      <th className="px-5 py-3.5">المصدر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {filteredLeads.map(lead => (
                      <tr key={lead._id} className="hover:bg-aethra-paper transition">
                        <td className="px-5 py-3.5">
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(lead._id)}
                            onChange={() => toggleSelectLead(lead._id)}
                            className="rounded border-surface-border"
                          />
                        </td>
                        <td className="px-5 py-3.5 font-mono font-bold text-aethra-ink"><button type="button" onClick={() => setOpenRequestId(lead._id)} className="underline underline-offset-4">{lead.leadCode}</button>{lead.projectName && <p className="text-xs font-sans mt-2">{lead.projectName}</p>}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-aethra-ink">{lead.customerName}</p>
                          <p className="text-[10px] text-surface-muted">{lead.phone} • {lead.country}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="bg-aethra-paper text-aethra-ink border border-surface-border px-2 py-0.5 rounded text-[11px] font-bold">
                            {lead.departmentIds?.map((department: any) => department.name).join('، ') || lead.trackId?.name || 'تحديد الاحتياج'}
                          </span>
                          <p className="text-[11px] text-surface-muted mt-2">{lead.serviceIds?.map((service: any) => service.name).join('، ') || lead.currentServiceId?.name || 'محتاج مساعدة في التحديد'}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          {lead.assignedEngineerId ? (
                            <span className="font-bold text-aethra-ink">م. {lead.assignedEngineerId.name}</span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                              بانتظار المراجعة والإسناد
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {lead.technicalIntake?.isCompleted ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                              <Check className="w-3 h-3 text-emerald-700" />
                              <span>مكتملة (${lead.technicalIntake.dealValue || 0})</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              بانتظار المهندس
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[11px] text-surface-muted">{lead.assignmentMethod}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            lead.status === 'CONVERTED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold' :
                            lead.status === 'NEW' ? 'bg-aethra-cyan text-aethra-ink border-[#1396AF]' :
                            'bg-aethra-paper text-aethra-ink border-surface-border'
                          }`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-surface-muted">{lead.leadSource}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View (< md) for Leads */}
              <div className="md:hidden divide-y divide-surface-border">
                {filteredLeads.map(lead => (
                  <div key={lead._id} className="p-4 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.includes(lead._id)}
                          onChange={() => toggleSelectLead(lead._id)}
                          className="rounded border-surface-border w-4 h-4 text-aethra-ink"
                        />
                        <button type="button" onClick={() => setOpenRequestId(lead._id)} className="font-mono font-bold text-xs bg-aethra-paper border border-surface-border px-2 py-0.5 rounded text-aethra-ink underline">
                          {lead.leadCode}
                        </button>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        lead.status === 'CONVERTED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold' :
                        lead.status === 'NEW' ? 'bg-aethra-cyan text-aethra-ink border-[#1396AF]' :
                        'bg-aethra-paper text-aethra-ink border-surface-border'
                      }`}>
                        {lead.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-aethra-ink">{lead.customerName}</h4>
                      <p className="text-xs text-surface-muted mt-0.5">{lead.phone} • {lead.country}</p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-aethra-paper border border-surface-border px-2.5 py-1 rounded-lg text-[11px] font-bold text-aethra-ink">
                        الأقسام: {lead.departmentIds?.map((department: any) => department.name).join('، ') || lead.trackId?.name || 'تحديد الاحتياج'}
                      </span>
                      <span className="bg-aethra-paper border border-surface-border px-2.5 py-1 rounded-lg text-[11px] font-bold text-aethra-ink">
                        {lead.assignedEngineerId ? `م. ${lead.assignedEngineerId.name}` : 'بانتظار الإسناد'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-surface-border">
                      <a
                        href={`https://wa.me/${(lead.whatsappNormalized || lead.phoneNormalized || '').replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#137A45] text-white text-xs font-bold transition shadow-none active:scale-95"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>واتساب</span>
                      </a>
                      <a
                        href={`tel:${lead.phone}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-aethra-paper text-aethra-ink text-xs font-bold border border-surface-border transition active:scale-95"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>اتصال</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-4 p-4 text-sm">
                <button disabled={loading || leadPage <= 1} onClick={() => setLeadPage(p => p - 1)} className="px-4 py-2 border rounded-xl disabled:opacity-40">السابق</button>
                <span>صفحة {leadPage} من {leadPages} — {leadTotal} عميل</span>
                <button disabled={loading || leadPage >= leadPages} onClick={() => setLeadPage(p => p + 1)} className="px-4 py-2 border rounded-xl disabled:opacity-40">التالي</button>
              </div>
            </div>
          )}

          {/* ======================= SECTION 3.5: AUDIT LOGS & DEVICE TRACKING ======================= */}
          {currentSection === 'audit' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Header Box */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-surface-border p-5 sm:p-6 rounded-xl shadow-none">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-aethra-ink text-aethra-cyan flex items-center justify-center shadow-none">
                    <Fingerprint className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-semibold text-aethra-ink">
                        سجل الرقابة وتتبع أجهزة الموظفين (Audit & Device Logs)
                      </h3>
                      <span className="text-[10px] font-bold bg-aethra-ink text-aethra-cyan px-2 py-0.5 rounded-full border border-dark-50">
                        🔒 خاص بالإدارة فقط
                      </span>
                    </div>
                    <p className="text-xs text-surface-muted mt-1">
                      رقابة أمنية لحظية على كافة العمليات مع تسجيل تفاصيل الأجهزة (كمبيوتر / هاتف / تابلت)، أنظمة التشغيل، المتصفحات، وعناوين الـ IP.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportAuditCSV}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-stone-50 text-aethra-ink font-bold text-xs border border-surface-border shadow-none transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>تصدير تقرير CSV</span>
                  </button>
                  <button
                    onClick={fetchAuditLogs}
                    disabled={auditLoading}
                    className="p-2.5 rounded-xl bg-aethra-paper hover:bg-aethra-cyan text-aethra-ink border border-surface-border transition cursor-pointer shadow-none"
                    title="تحديث السجلات"
                  >
                    {auditLoading ? <OrbitLoader className="!w-4 !h-4" /> : <RefreshCw className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* بطاقات إحصائيات الأجهزة */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white border border-surface-border p-4 rounded-xl shadow-none flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-surface-muted block">كمبيوتر / لابتوب</span>
                    <span className="text-lg font-semibold text-aethra-ink">{auditStats?.desktopCount || 0}</span>
                  </div>
                </div>

                <div className="bg-white border border-surface-border p-4 rounded-xl shadow-none flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-surface-muted block">هواتف محمولة</span>
                    <span className="text-lg font-semibold text-aethra-ink">{auditStats?.mobileCount || 0}</span>
                  </div>
                </div>

                <div className="bg-white border border-surface-border p-4 rounded-xl shadow-none flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Tablet className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-surface-muted block">أجهزة لوحية (تابلت)</span>
                    <span className="text-lg font-semibold text-aethra-ink">{auditStats?.tabletCount || 0}</span>
                  </div>
                </div>

                <div className="bg-white border border-surface-border p-4 rounded-xl shadow-none flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-aethra-cyan/30 text-aethra-ink flex items-center justify-center">
                    <Fingerprint className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-surface-muted block">إجمالي حركات الرقابة</span>
                    <span className="text-lg font-semibold text-aethra-ink">{auditStats?.totalAll || 0}</span>
                  </div>
                </div>
              </div>

              {/* أدوات البحث والفلترة */}
              <div className="bg-white border border-surface-border p-4 rounded-xl shadow-none space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* شريط البحث */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-surface-muted absolute right-3 top-3" />
                    <input
                      type="text"
                      value={auditSearch}
                      onChange={(e) => {
                        setAuditSearch(e.target.value);
                        setAuditPage(1);
                      }}
                      placeholder="بحث بالموظف، نوع العملية، كود العميل، أو عنوان IP..."
                      className="w-full bg-aethra-paper border border-surface-border rounded-xl pr-9 pl-4 py-2 text-xs text-aethra-ink focus:outline-none focus:border-aethra-ink transition"
                    />
                  </div>

                  {/* فلتر الكيان */}
                  <div>
                    <select
                      value={auditEntityType}
                      onChange={(e) => {
                        setAuditEntityType(e.target.value);
                        setAuditPage(1);
                      }}
                      className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink font-bold focus:outline-none"
                    >
                      <option value="ALL">كافة الأقسام والكيانات</option>
                      <option value="LEAD">طلبات وعملاء (Leads)</option>
                      <option value="PAYMENT">عمليات وإيصالات الدفع (Payments)</option>
                      <option value="AUTH">تسجيل دخول وأمان (Auth)</option>
                      <option value="USER">إدارة الموظفين (Users)</option>
                      <option value="SETTINGS">إعدادات النظام والـ SLA</option>
                    </select>
                  </div>

                  {/* فلتر نوع العملية */}
                  <div>
                    <select
                      value={auditActionFilter}
                      onChange={(e) => {
                        setAuditActionFilter(e.target.value);
                        setAuditPage(1);
                      }}
                      className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink font-bold focus:outline-none"
                    >
                      <option value="ALL">كافة الإجراءات والعمليات</option>
                      <option value="LOGIN">تسجيل دخول للنظام</option>
                      <option value="LEAD_ACKNOWLEDGED">تأكيد استلام الطلب (SLA 1)</option>
                      <option value="FIRST_CONTACT_CONFIRMED">تأكيد أول تواصل مع العميل (SLA 2)</option>
                      <option value="TECHNICAL_INTAKE_COMPLETED">اعتماد المواصفات الفنية</option>
                      <option value="PAYMENT_RECEIVED">استلام دفعة مالية وإغلاق الصفقة</option>
                      <option value="STATUS_CHANGE">تغيير حالة العميل</option>
                      <option value="LEAD_REASSIGNED">إعادة إسناد العميل</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* جدول سجل الرقابة وتتبع الأجهزة */}
              <div className="bg-white border border-surface-border rounded-xl overflow-hidden shadow-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-aethra-paper border-b border-surface-border text-surface-muted text-[11px] font-semibold uppercase">
                      <tr>
                        <th className="py-3.5 px-4">الوقت والتاريخ</th>
                        <th className="py-3.5 px-4">الموظف والرتبة</th>
                        <th className="py-3.5 px-4">الإجراء والعملية</th>
                        <th className="py-3.5 px-4">الكيان / العميل</th>
                        <th className="py-3.5 px-4">الجهاز المستخدم (Device Info)</th>
                        <th className="py-3.5 px-4">عنوان الـ IP</th>
                        <th className="py-3.5 px-4">التفاصيل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {auditLoading ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-surface-muted">
                            جاري تحميل سجلات الرقابة وتتبع الأجهزة...
                          </td>
                        </tr>
                      ) : auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-16 text-center">
                            <Fingerprint className="w-10 h-10 text-surface-muted/40 mx-auto mb-2" />
                            <p className="font-bold text-aethra-ink">لا توجد سجلات مطابقة للبحث حالياً</p>
                            <p className="text-[11px] text-surface-muted mt-1">
                              يتم تسجيل كافة الحركات تلقائياً فور قيام أي موظف بإجراء في المنظومة.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log: any) => (
                          <tr key={log._id} className="hover:bg-aethra-paper/80 transition">
                            {/* التاريخ والوقت */}
                            <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-aethra-ink">
                              {new Date(log.createdAt).toLocaleString('ar-EG')}
                            </td>

                            {/* الموظف */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-aethra-cyan text-aethra-ink font-semibold text-xs flex items-center justify-center">
                                  {log.userName?.[0] || 'U'}
                                </div>
                                <div>
                                  <span className="font-bold text-aethra-ink block leading-tight">{log.userName || 'النظام'}</span>
                                  <span className="text-[10px] font-mono text-surface-muted leading-tight">{log.userRole || 'SYSTEM'}</span>
                                </div>
                              </div>
                            </td>

                            {/* الإجراء والعملية */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                log.action === 'PAYMENT_RECEIVED' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                                log.action === 'LEAD_ACKNOWLEDGED' ? 'bg-aethra-cyan/20 text-aethra-ink border-[#1396AF]' :
                                log.action === 'FIRST_CONTACT_CONFIRMED' ? 'bg-blue-50 text-blue-800 border-blue-300' :
                                log.action === 'TECHNICAL_INTAKE_COMPLETED' ? 'bg-purple-50 text-purple-800 border-purple-300' :
                                log.action === 'LOGIN' ? 'bg-stone-100 text-aethra-ink border-surface-border' :
                                'bg-amber-50 text-amber-900 border-amber-300'
                              }`}>
                                {log.actionTitle || log.action}
                              </span>
                            </td>

                            {/* الكود أو الكيان */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {log.entityCode ? (
                                <span className="font-mono text-[11px] font-bold text-aethra-ink bg-aethra-paper px-2 py-0.5 rounded border border-surface-border">
                                  {log.entityCode}
                                </span>
                              ) : (
                                <span className="text-surface-muted text-[11px] font-mono">{log.entityType}</span>
                              )}
                            </td>

                            {/* الجهاز المستخدم */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 bg-aethra-paper border border-surface-border px-2.5 py-1 rounded-xl text-[11px] text-aethra-ink">
                                {log.deviceType === 'MOBILE' ? (
                                  <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                ) : log.deviceType === 'TABLET' ? (
                                  <Tablet className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                ) : (
                                  <Laptop className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                )}
                                <span className="font-bold">{log.deviceSummary || 'جهاز غير محدد'}</span>
                              </div>
                            </td>

                            {/* عنوان الـ IP */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="font-mono text-[11px] text-surface-muted bg-aethra-paper px-2 py-0.5 rounded border border-surface-border">
                                {log.ipAddress || '127.0.0.1'}
                              </span>
                            </td>

                            {/* التفاصيل */}
                            <td className="py-3.5 px-4 text-surface-muted text-[11px] max-w-xs truncate" title={log.details}>
                              {log.details || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {auditTotalPages > 1 && (
                  <div className="p-4 bg-aethra-paper border-t border-surface-border flex items-center justify-between text-xs">
                    <span className="text-surface-muted">
                      الصفحة {auditPage} من {auditTotalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAuditPage(prev => Math.max(1, prev - 1))}
                        disabled={auditPage === 1}
                        className="px-3 py-1.5 rounded-xl bg-white border border-surface-border text-aethra-ink font-bold disabled:opacity-50 cursor-pointer"
                      >
                        السابق
                      </button>
                      <button
                        onClick={() => setAuditPage(prev => Math.min(auditTotalPages, prev + 1))}
                        disabled={auditPage === auditTotalPages}
                        className="px-3 py-1.5 rounded-xl bg-white border border-surface-border text-aethra-ink font-bold disabled:opacity-50 cursor-pointer"
                      >
                        التالي
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {currentSection === 'tracks' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-surface-border p-6 rounded-xl shadow-none">
                <div>
                  <h3 className="text-base font-semibold text-aethra-ink flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-aethra-ink" />
                    <span>تراكات عمل Aethra والتيم ليدرز ({tracksList.length})</span>
                  </h3>
                  <p className="text-xs text-surface-muted mt-0.5">
                    كل تراك يضم متخصصين، والتيم ليدر يتابع طلباته بنفس أدوات المهندس ويشوف طلبات زملائه.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingTrack(null);
                    setTrackForm({nameEn:'', descriptionEn:'',
                      name: '',
                      slug: '',
                      description: '',
                      teamLeaderId: '',
                      color: '#1AD6F7'
                    });
                    setIsTrackModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-aethra-cyan text-aethra-ink font-bold text-xs shadow-none border border-[#1396AF] transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء تراك جديد</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tracksList.map((t) => (
                  <div
                    key={t._id}
                    className="bg-white border border-surface-border rounded-xl p-5 shadow-none space-y-4 shadow-none transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-4 h-4 rounded-full shadow-none"
                          style={{ backgroundColor: t.color || '#1AD6F7' }}
                        />
                        <div>
                          <h4 className="text-sm font-semibold text-aethra-ink">{t.name}</h4>
                          <p className="text-[11px] font-mono text-surface-muted">{t.slug}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setEditingTrack(t);
                          setTrackForm({
                            name: t.name,nameEn:t.nameEn||'',descriptionEn:t.descriptionEn||'',
                            slug: t.slug,
                            description: t.description || '',
                            teamLeaderId: t.teamLeaderId?._id || '',
                            color: t.color || '#1AD6F7'
                          });
                          setIsTrackModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-aethra-ink text-xs font-bold transition cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-surface-muted leading-relaxed">
                      {t.description || 'لا يوجد وصف مضاف لهذا التراك.'}
                    </p>

                    {/* التيم ليدر المسؤول */}
                    <div className="bg-aethra-paper border border-surface-border rounded-xl p-3 text-xs space-y-1">
                      <p className="text-[10px] font-bold text-surface-muted uppercase">التيم ليدر المسؤول:</p>
                      {t.teamLeaderId ? (
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-aethra-ink">👔 {t.teamLeaderId.name}</span>
                          <span className="text-[11px] text-surface-muted">{t.teamLeaderId.phone || t.teamLeaderId.email}</span>
                        </div>
                      ) : (
                        <span className="text-amber-800 font-medium">لم يتم تعيين تيم ليدر بعد</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1">
                      <div className="bg-aethra-paper p-2 rounded-xl border border-surface-border">
                        <span className="text-[10px] text-surface-muted block">عدد المهندسين</span>
                        <span className="text-sm font-semibold text-aethra-ink">{t.engineersCount || 0}</span>
                      </div>
                      <div className="bg-aethra-paper p-2 rounded-xl border border-surface-border">
                        <span className="text-[10px] text-surface-muted block">إجمالي الطلبات</span>
                        <span className="text-sm font-semibold text-aethra-ink">{t.leadsCount || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================= SECTION 5: SERVICES CATALOG ======================= */}
          {false && currentSection === 'services' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-surface-border p-6 rounded-xl shadow-none">
                <div>
                  <h3 className="text-base font-semibold text-aethra-ink flex items-center gap-2">
                    <Layers className="w-5 h-5 text-aethra-ink" />
                    <span>كتالوج الخدمات الرقمية والتخصصات ({filteredServices.length})</span>
                  </h3>
                  <p className="text-xs text-surface-muted mt-0.5">
                    الخدمات التي يطلبها العملاء في الاستمارات العامة والإعلانية، وكيفية ارتباطها بالتراكات.
                  </p>
                </div>

                <select
                  value={serviceTrackFilter}
                  onChange={(e) => setServiceTrackFilter(e.target.value)}
                  className="bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink"
                >
                  <option value="">-- كافة التراكات --</option>
                  {tracksList.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredServices.map((service) => (
                  <div
                    key={service._id}
                    className="bg-white border border-surface-border rounded-xl p-5 shadow-none space-y-3 shadow-none transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-aethra-cyan text-aethra-ink flex items-center justify-center font-bold text-sm">
                        🐝
                      </div>
                      <span className="text-[10px] font-mono text-surface-muted bg-aethra-paper px-2 py-0.5 rounded border border-surface-border">
                        {service.slug}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-aethra-ink">{service.name}</h4>
                      <p className="text-xs text-surface-muted mt-1 line-clamp-2">
                        {service.description || 'خدمة تقنية وحلول رقمية متكاملة.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-surface-border flex items-center justify-between text-xs">
                      <span className="text-surface-muted">التراك: <strong className="text-aethra-ink">{service.trackId?.name || 'عام'}</strong></span>
                      {service.basePrice && (
                        <span className="font-semibold text-[#137A45] font-mono">
                          ${service.basePrice}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================= SECTION 6: USERS & TEAM ======================= */}
          {currentSection === 'users' && (
            <div className="bg-white border border-surface-border rounded-xl overflow-hidden shadow-none space-y-4 animate-in fade-in">
              <div className="p-6 border-b border-surface-border flex flex-wrap items-center justify-between gap-3 bg-aethra-paper">
                <div>
                  <h3 className="text-base font-semibold text-aethra-ink flex items-center gap-2">
                    <Users className="w-5 h-5 text-aethra-ink" />
                    <span>إدارة المستخدمين وفريق العمل ({filteredUsers.length})</span>
                  </h3>
                  <p className="text-xs text-surface-muted mt-0.5">
                    إنشاء المستخدمين وتعيين الرتب، التراكات المناسبة، وتحديد السقف اليومي.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative min-w-[200px]">
                    <Search className="w-4 h-4 text-surface-muted absolute right-3 top-3" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="بحث باسم العضو أو البريد..."
                      className="w-full bg-white border border-surface-border rounded-xl pr-9 pl-3 py-2 text-xs text-aethra-ink focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={() => {
                      setEditingUser(null);
                      setUserForm({
                        name: '',
                        email: '',
                        password: '',
                        phone: '',
                        role: 'ENGINEER',
                        roleId: rolesList.find(r => r.slug === 'ENGINEER')?._id || '',
                        trackId: tracksList[0]?._id || '',
                        maxDailyLeads: 5,
                        specializations: []
                      });
                      setIsUserModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-aethra-cyan text-aethra-ink font-bold text-xs shadow-none border border-[#1396AF] transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة مستخدم جديد</span>
                  </button>
                </div>
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-aethra-paper text-aethra-ink font-bold uppercase text-[11px] border-b border-surface-border">
                    <tr>
                      <th className="px-5 py-4">الاسم والبريد</th>
                      <th className="px-5 py-4">الرتبة</th>
                      <th className="px-5 py-4">تراك التخصص</th>
                      <th className="px-5 py-4">السقف اليومي</th>
                      <th className="px-5 py-4">الطلبات النشطة</th>
                      <th className="px-5 py-4">الحالة</th>
                      <th className="px-5 py-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {filteredUsers.map((u) => (
                      <tr key={u._id} className="hover:bg-aethra-paper transition">
                        <td className="px-5 py-4">
                          <p className="font-bold text-aethra-ink">{u.name}</p>
                          <p className="text-[11px] text-surface-muted">{u.email} {u.phone ? `(${u.phone})` : ''}</p>
                        </td>

                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                            isAdministrator(u.role) ? 'bg-aethra-ink text-aethra-cyan border-aethra-ink' :
                            u.role === 'TEAM_LEADER' ? 'bg-indigo-100 text-indigo-900 border-indigo-200' :
                            u.role === 'MARKETING' ? 'bg-amber-100 text-amber-900 border-amber-200' :
                            'bg-white text-aethra-ink border-surface-border'
                          }`}>
                            {u.roleId?.name || u.role}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          {u.trackId ? (
                            <span className="font-bold text-aethra-ink bg-aethra-paper border border-surface-border px-2.5 py-1 rounded-lg">
                              {u.trackId.name}
                            </span>
                          ) : (
                            <span className="text-surface-muted text-[11px]">—</span>
                          )}
                        </td>

                        <td className="px-5 py-4 font-bold text-aethra-ink">
                          {u.maxDailyLeads > 0 ? `${u.maxDailyLeads} عميل/يوم` : 'غير محدود'}
                        </td>

                        <td className="px-5 py-4 font-semibold text-aethra-ink">
                          {u.activeLeadsCount || 0}
                        </td>

                        <td className="px-5 py-4">
                          <button
                            onClick={() => handleToggleUserActive(u)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition ${
                              u.isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-stone-200 text-stone-700'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-[#137A45]' : 'bg-stone-500'}`} />
                            <span>{u.isActive ? 'نشط' : 'معطل'}</span>
                          </button>
                        </td>

                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setUserForm({
                                  name: u.name,
                                  email: u.email,
                                  password: '',
                                  phone: u.phone || '',
                                  role: u.role,
                                  roleId: u.roleId?._id || '',
                                  trackId: u.trackId?._id || '',
                                  maxDailyLeads: u.maxDailyLeads || 5,
                                  specializations: u.specializations?.map((s: any) => s._id) || []
                                });
                                setIsUserModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-aethra-ink transition cursor-pointer"
                              title="تعديل"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u._id, u.name)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View (< md) for Users */}
              <div className="md:hidden divide-y divide-surface-border">
                {filteredUsers.map((u) => (
                  <div key={u._id} className="p-4 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-aethra-cyan text-aethra-ink font-semibold text-xs flex items-center justify-center">
                          {u.name[0]}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-aethra-ink">{u.name}</h4>
                          <p className="text-[11px] text-surface-muted">{u.email}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleUserActive(u)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition ${
                          u.isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-[#137A45]' : 'bg-stone-500'}`} />
                        <span>{u.isActive ? 'نشط' : 'معطل'}</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        isAdministrator(u.role) ? 'bg-aethra-ink text-aethra-cyan border-aethra-ink' :
                        u.role === 'TEAM_LEADER' ? 'bg-indigo-100 text-indigo-900 border-indigo-200' :
                        u.role === 'MARKETING' ? 'bg-amber-100 text-amber-900 border-amber-200' :
                        'bg-aethra-paper text-aethra-ink border-surface-border'
                      }`}>
                        {u.roleId?.name || u.role}
                      </span>
                      {u.trackId && (
                        <span className="bg-aethra-paper border border-surface-border px-2 py-0.5 rounded text-[11px] font-bold text-aethra-ink">
                          تراك {u.trackId.name}
                        </span>
                      )}
                      <span className="text-surface-muted text-[11px] py-0.5">
                        السقف: {u.maxDailyLeads > 0 ? `${u.maxDailyLeads} عميل/يوم` : 'مفتوح'}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setUserForm({
                            name: u.name,
                            email: u.email,
                            password: '',
                            phone: u.phone || '',
                            role: u.role,
                            roleId: u.roleId?._id || '',
                            trackId: u.trackId?._id || '',
                            maxDailyLeads: u.maxDailyLeads || 5,
                            specializations: u.specializations?.map((s: any) => s._id) || []
                          });
                          setIsUserModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 text-aethra-ink text-xs font-bold transition active:scale-95"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>

                      <button
                        onClick={() => handleDeleteUser(u._id, u.name)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold transition active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentSection==='clientBrand'&&user?.canManageProtectedAccounts&&<ClientPortalSettings/>}
          {/* ======================= SECTION 7: ROLES & RBAC ======================= */}
          {currentSection === 'roles' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-surface-border p-6 rounded-xl shadow-none">
                <div>
                  <h3 className="text-base font-semibold text-aethra-ink flex items-center gap-2">
                    <Key className="w-5 h-5 text-aethra-ink" />
                    <span>إدارة الأدوار والصلاحيات</span>
                  </h3>
                  <p className="text-xs text-surface-muted mt-0.5">
                    عدّل صلاحيات الأدوار الموجودة، بما فيها الأدوار الأساسية، أو أنشئ دورًا مخصصًا. الأدوار الأساسية قابلة للتعديل ولا تُحذف.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingRole(null);
                    setRoleForm({
                      name: '',
                      slug: '',
                      description: '',
                      permissions: ['leads:create_marketing','leads:view_submitted','desk:use']
                    });
                    setIsRoleModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-aethra-cyan text-aethra-ink font-bold text-xs shadow-none border border-[#1396AF] transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء رول مخصص جديد</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rolesList.map((r) => (
                  <div
                    key={r._id}
                    className="bg-white border border-surface-border rounded-xl p-5 shadow-none space-y-3.5 shadow-none transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {r.isSystem ? (
                          <span className="p-1.5 rounded-lg bg-stone-100 text-aethra-ink">
                            <Lock className="w-4 h-4 text-surface-muted" />
                          </span>
                        ) : (
                          <span className="p-1.5 rounded-lg bg-aethra-cyan text-aethra-ink">
                            <Key className="w-4 h-4" />
                          </span>
                        )}
                        <div>
                          <h4 className="text-sm font-semibold text-aethra-ink">{r.name}</h4>
                          <p className="text-[10px] font-mono text-surface-muted">{r.slug}</p>
                        </div>
                      </div>

                      {r.canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingRole(r);
                              setRoleForm({
                                name: r.name,
                                slug: r.slug,
                                description: r.description || '',
                                permissions: r.permissions || []
                              });
                              setIsRoleModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-aethra-ink transition cursor-pointer"
                            title="تعديل الصلاحيات"
                            aria-label={`تعديل صلاحيات ${r.name}`}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {r.canDelete && <button
                            onClick={() => handleDeleteRole(r._id, r.name)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>}
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-surface-muted leading-relaxed">
                      {r.description || 'لا يوجد وصف محدد.'}
                    </p>

                    {/* الصلاحيات الممنوحة */}
                    <div>
                      <p className="text-[10px] font-bold text-surface-muted uppercase mb-1.5">{r.unrestricted?'كامل صلاحيات إدارة المنظومة':`الصلاحيات الممنوحة (${r.permissions?.length || 0}):`}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(r.unrestricted?availablePermissions.map(p=>p.key):r.permissions)?.map((permKey: string) => {
                          const permObj = availablePermissions.find(p => p.key === permKey);
                          return (
                            <span
                              key={permKey}
                              className="text-[10px] font-bold bg-aethra-paper border border-surface-border px-2 py-0.5 rounded-md text-aethra-ink"
                            >
                              {permObj?.label || permKey}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================= MODAL: مستخدم جديد أو تعديل ======================= */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-surface-border rounded-xl max-w-lg w-full p-6 shadow-none max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border mb-4">
              <h3 className="text-base font-semibold text-aethra-ink">
                {editingUser ? `تعديل حساب [${editingUser.name}]` : 'إضافة مستخدم جديد'}
              </h3>
              <button onClick={() => setIsUserModalOpen(false)} className="p-1 rounded-lg text-surface-muted hover:text-aethra-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-aethra-ink mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink focus:outline-none"
                  placeholder="م. كريم حسن"
                />
              </div>

              <div>
                <label className="block font-bold text-aethra-ink mb-1">البريد الإلكتروني *</label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink focus:outline-none"
                  placeholder="eng.user@company.com"
                />
              </div>

              <div>
                <label className="block font-bold text-aethra-ink mb-1">
                  كلمة المرور {editingUser && '(اتركها فارغة إذا لم ترغب في التغيير)'} *
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink focus:outline-none"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block font-bold text-aethra-ink mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-right text-aethra-ink focus:outline-none"
                  placeholder="+201012345678"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-aethra-ink mb-1">الرتبة في النظام *</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value, roleId: rolesList.find(r => r.slug === e.target.value)?._id || '' })}
                    className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink"
                  >
                    <option value="ADMIN">مدير النظام (ADMIN)</option>
                    {user?.canManageProtectedAccounts && <option value={user.role}>{user.roleId?.name||'إدارة المنظومة'}</option>}
                    <option value="TEAM_LEADER">تيم ليدر تراك (TEAM_LEADER)</option>
                    <option value="ENGINEER">مهندس / أخصائي تقني (ENGINEER)</option>
                    <option value="MARKETING">موظف تسويق وحملات (MARKETING)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-aethra-ink mb-1">الرول المخصص (الصلاحيات)</label>
                  <select
                    value={userForm.roleId}
                    onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value, role: rolesList.find(r => r._id === e.target.value)?.slug || userForm.role })}
                    className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink"
                  >
                    <option value="">-- اختياري --</option>
                    {rolesList.map(r => (
                      <option key={r._id} value={r._id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-aethra-ink mb-1">تراك التخصص *</label>
                <select
                  value={userForm.trackId}
                  onChange={(e) => setUserForm({ ...userForm, trackId: e.target.value })}
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink"
                >
                  <option value="">-- بدون تراك محدد (عام) --</option>
                  {tracksList.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-aethra-ink mb-1">السقف اليومي لاستقبال العملاء</label>
                <input
                  type="number"
                  value={userForm.maxDailyLeads}
                  onChange={(e) => setUserForm({ ...userForm, maxDailyLeads: Number(e.target.value) })}
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink"
                  min={0}
                  max={50}
                />
                <span className="text-[10px] text-surface-muted">0 تعني بدون سقف يومي</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 text-surface-muted text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-aethra-cyan text-aethra-ink text-xs font-semibold border border-[#1396AF] cursor-pointer"
                >
                  {editingUser ? 'حفظ التعديلات' : 'إنشاء المستخدم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: تراك جديد أو تعديل ======================= */}
      {isTrackModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-surface-border rounded-xl max-w-md w-full p-6 shadow-none">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border mb-4">
              <h3 className="text-base font-semibold text-aethra-ink">
                {editingTrack ? `تعديل تراك [${editingTrack.name}]` : 'إنشاء تراك جديد'}
              </h3>
              <button onClick={() => setIsTrackModalOpen(false)} className="p-1 rounded-lg text-surface-muted hover:text-aethra-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTrack} className="space-y-4 text-xs">
              <label className="block space-y-2"><span>اسم التراك بالإنجليزي</span><input className="w-full p-3 border rounded-xl" value={trackForm.nameEn} onChange={e=>setTrackForm({...trackForm,nameEn:e.target.value})}/></label><label className="block space-y-2"><span>وصف التراك بالإنجليزي</span><textarea className="w-full p-3 border rounded-xl" value={trackForm.descriptionEn} onChange={e=>setTrackForm({...trackForm,descriptionEn:e.target.value})}/></label>
              <div>
                <label className="block font-bold text-aethra-ink mb-1">اسم التراك *</label>
                <input
                  type="text"
                  required
                  value={trackForm.name}
                  onChange={(e) => setTrackForm({ ...trackForm, name: e.target.value })}
                  placeholder="مثال: الذكاء الاصطناعي وبوتات المحادثة"
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink"
                />
              </div>

              <div>
                <label className="block font-bold text-aethra-ink mb-1">الرمز التعريفي (Slug) *</label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={trackForm.slug}
                  onChange={(e) => setTrackForm({ ...trackForm, slug: e.target.value })}
                  placeholder="ai-bots"
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-right text-aethra-ink"
                />
              </div>

              <div>
                <label className="block font-bold text-aethra-ink mb-1">الوصف</label>
                <textarea
                  rows={2}
                  value={trackForm.description}
                  onChange={(e) => setTrackForm({ ...trackForm, description: e.target.value })}
                  placeholder="وصف الخدمات التي يقدمها هذا التراك..."
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl p-2.5 text-xs text-aethra-ink"
                />
              </div>

              <div>
                <label className="block font-bold text-aethra-ink mb-1">التيم ليدر المسؤول عن التراك</label>
                <select
                  value={trackForm.teamLeaderId}
                  onChange={(e) => setTrackForm({ ...trackForm, teamLeaderId: e.target.value })}
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink"
                >
                  <option value="">-- بدون تيم ليدر حالياً --</option>
                  {usersList.filter(u=>!isAdministrator(u.role)&&hasPermission(u,'execution:manage') && u.isActive).map(u => (
                    <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-aethra-ink mb-1">لون التمييز</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={trackForm.color}
                    onChange={(e) => setTrackForm({ ...trackForm, color: e.target.value })}
                    className="w-10 h-8 rounded border border-surface-border cursor-pointer"
                  />
                  <span className="font-mono text-xs">{trackForm.color}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsTrackModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 text-surface-muted text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-aethra-cyan text-aethra-ink text-xs font-semibold border border-[#1396AF] cursor-pointer"
                >
                  {editingTrack ? 'حفظ التعديلات' : 'إنشاء التراك'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: رول مخصص جديد أو تعديل الصلاحيات ======================= */}
      {isRoleModalOpen && (
        <div ref={roleDialogRef} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="تعديل الدور والصلاحيات">
          <div className="bg-white border border-surface-border rounded-xl max-w-lg w-full p-6 shadow-none max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border mb-4">
              <h3 className="text-base font-semibold text-aethra-ink">
                {editingRole ? `تعديل صلاحيات رول [${editingRole.name}]` : 'إنشاء رتبة جديدة مع الصلاحيات (Custom Role)'}
              </h3>
              <button onClick={() => setIsRoleModalOpen(false)} className="p-1 rounded-lg text-surface-muted hover:text-aethra-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-aethra-ink mb-1">اسم الرول *</label>
                <input
                  type="text"
                  required
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  placeholder="مثال: مسؤول مبيعات وتفاوض متقدم"
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink"
                />
              </div>

              <div>
                <label className="block font-bold text-aethra-ink mb-1">الرمز التعريفي (Slug) *</label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  disabled={!!editingRole}
                  value={roleForm.slug}
                  onChange={(e) => setRoleForm({ ...roleForm, slug: e.target.value.toUpperCase() })}
                  placeholder="SENIOR_SALES"
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-right text-aethra-ink"
                />
              </div>

              <div>
                <label className="block font-bold text-aethra-ink mb-1">الوصف</label>
                <input
                  type="text"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  placeholder="وصف مهام هذا الدور في الشركة..."
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink"
                />
              </div>

              <div>
                <label className="block font-bold text-aethra-ink mb-2">تحديد الصلاحيات الممنوحة لهذا الرول *</label><p className="text-sm text-surface-muted mb-3 leading-7">التحكم يشمل تسجيل العميل والمساحة اليومية والدفعات وفرق التنفيذ. تظل حدود التراك وملكية الطلب وعضوية الفريق إلزامية. إدارة الفريق تتطلب تعيين صاحبه قائدًا للتراك، واعتماد الانتهاء له صلاحية مستقلة. الإسناد وتعديل الاستقبال وإدارة العملاء تشمل عرض الطلبات، والتصدير يشمل عرض التقارير، واستقبال الطلبات يشمل متابعة المسندة.</p>
                {editingRole?.isSystem&&<p className="rounded-xl bg-cyan-50 p-3 mb-3 leading-6">الدور الأساسي قابل لتعديل الصلاحيات مع ثبات رمزه وعدم إمكانية حذفه. الحفظ يحدّث الحسابات التي تورّث منه وينهي جلساتها القديمة؛ الحسابات ذات الصلاحيات المخصصة تبقى كما هي.</p>}
                {editingRole?.unrestricted&&<p className="rounded-xl bg-amber-50 p-3 mb-3 leading-6">هذا الحساب يحتفظ دائمًا بكامل صلاحيات إدارة المنظومة.</p>}
                <div className="space-y-2 bg-aethra-paper p-3 rounded-xl border border-surface-border max-h-56 overflow-y-auto">
                  {[...new Set(availablePermissions.map(p=>p.category))].map(category=><fieldset key={category} className="border border-surface-border rounded-xl p-2 space-y-2"><legend className="font-semibold px-2">{category}</legend><div className="flex gap-3 px-2"><button type="button" className="underline text-xs" disabled={editingRole?.unrestricted} onClick={()=>setRoleForm(current=>({...current,permissions:[...new Set([...current.permissions,...availablePermissions.filter(p=>p.category===category&&!p.exclusiveToOwner).map(p=>p.key)])]}))}>تحديد المجموعة</button><button type="button" className="underline text-xs" disabled={editingRole?.unrestricted} onClick={()=>setRoleForm(current=>({...current,permissions:current.permissions.filter(key=>!availablePermissions.some(p=>p.category===category&&p.key===key))}))}>إلغاء المجموعة</button></div>{availablePermissions.filter(p=>p.category===category).map(p => {
                    const isBaseline=editingRole?.unrestricted;
                    const isChecked = !!isBaseline || roleForm.permissions.includes(p.key);
                    return (
                      <label
                        key={p.key}
                        className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white transition cursor-pointer border border-transparent hover:border-surface-border"
                      >
                        <input
                          type="checkbox"
                          checked={p.exclusiveToOwner?!!editingRole?.unrestricted:isChecked} disabled={isBaseline||p.exclusiveToOwner}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRoleForm({ ...roleForm, permissions: [...roleForm.permissions, p.key] });
                            } else {
                              setRoleForm({ ...roleForm, permissions: roleForm.permissions.filter(k => k !== p.key) });
                            }
                          }}
                          className="rounded border-surface-border text-aethra-ink"
                        />
                        <div>
                          <p className="font-bold text-aethra-ink">{p.label}</p>
                          <p className="text-[10px] text-surface-muted font-mono">{p.key} ({p.category})</p>
                        </div>
                      </label>
                    );
                  })}</fieldset>)}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 text-surface-muted text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-aethra-cyan text-aethra-ink text-xs font-semibold border border-[#1396AF] cursor-pointer"
                >
                  {editingRole ? 'تحديث الصلاحيات' : 'إنشاء الرول'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: إعادة الإسناد الجماعي ======================= */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-surface-border rounded-xl max-w-md w-full p-6 shadow-none">
            <h3 className="text-base font-semibold text-aethra-ink mb-1">
              إعادة إسناد جماعي ({selectedLeadIds.length}) عميل
            </h3>
            <p className="text-xs text-surface-muted mb-4">
              اختر المهندس الجديد ليتم نقل العملاء المحددين إلى عهدته فوراً.
            </p>

            <form onSubmit={handleBulkReassignSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-aethra-ink mb-1.5">المهندس المستهدف *</label>
                <select
                  value={targetEngineerId}
                  onChange={(e) => setTargetEngineerId(e.target.value)}
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink font-bold focus:border-aethra-ink focus:outline-none"
                  required
                >
                  <option value="">-- اختر مهندس --</option>
                  {usersList.filter(u => u.isActive && !isAdministrator(u.role) && hasPermission(u,'routing:receive')).map((eng: any) => (
                    <option key={eng._id} value={eng._id}>
                      م. {eng.name} ({eng.trackId?.name || 'عام'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-aethra-ink mb-1.5">سبب إعادة التوزيع</label>
                <input
                  type="text"
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="مثال: موازنة الحمل أو إجازة للمهندس الحالي..."
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl px-3 py-2 text-xs text-aethra-ink focus:border-aethra-ink focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-aethra-paper text-surface-muted text-xs font-bold hover:bg-stone-200 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingBulk}
                  className="px-5 py-2 rounded-xl bg-aethra-cyan text-aethra-ink text-xs font-semibold shadow-none border border-[#1396AF] transition cursor-pointer"
                >
                  {submittingBulk ? 'جاري التحويل...' : 'تأكيد الإسناد الجماعي'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <LeadDetailDrawer key={openRequestId} onSelectLead={setOpenRequestId} onOpenExecution={onOpenExecution} leadId={openRequestId} isOpen={!!openRequestId} onClose={() => setOpenRequestId(null)} onLeadUpdated={fetchDashboardData} user={user} />
    </div>
  );
};
