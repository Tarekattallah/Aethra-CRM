import { DeskTarget } from './WorkSidebar';
import { hasPermission, sectionPermissions, isAdministrator } from '../utils/auth';
import React, { useState, useEffect, useRef } from 'react';
import {
  Calculator,
  NotebookPen,
  ArrowRight,
  UsersRound,
  BarChart3,
  Users,
  Sliders,
  Briefcase,
  Key,
  Layers,
  ShieldCheck,
  Download,
  Zap,
  Globe,
  UserCheck,
  Megaphone,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  TrendingUp,
  FileSpreadsheet,
  Fingerprint,
  Laptop
} from 'lucide-react';
import { Logo } from './Logo';
import { useDialogFocus } from '../hooks/useDialogFocus';

export type AdminSection =
  | 'clientBrand'
  | 'passwords'
  | 'overview'
  | 'routing'
  | 'leads'
  | 'customers'
  | 'audit'
  | 'tracks'
  | 'services'
  | 'users'
  | 'roles';

interface AdminSidebarProps {
  onBack?:()=>void;
  onOpenDesk?:(target:DeskTarget)=>void;
  currentSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  onSwitchTab?: (tab: 'public' | 'staff' | 'workspace' | 'admin' | 'desk' | 'teams') => void;
  onExportExcel: () => void;
  onTriggerSla: () => void;
  onLogout: () => void;
  stats?: {
    totalLeads?: number;
    activeEngineers?: number;
    tracksCount?: number;
    usersCount?: number;
    rolesCount?: number;
  };
  user?: any;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentSection,onBack,onOpenDesk,
  onSelectSection,
  onSwitchTab,
  onExportExcel,
  onTriggerSla,
  onLogout,
  stats,
  user,
  mobileOpen,
  setMobileOpen
}) => {
  const mobileRef=useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);

  const isDrawerOpen = mobileOpen !== undefined ? mobileOpen : internalMobileOpen;
  const closeDrawer = () => {
    if (setMobileOpen) setMobileOpen(false);
    else setInternalMobileOpen(false);
    document.querySelector<HTMLButtonElement>('[aria-label="فتح قائمة الإدارة"]')?.focus();
  };
  const openDrawer = () => {
    if (setMobileOpen) setMobileOpen(true);
    else setInternalMobileOpen(true);
  };
  useDialogFocus(isDrawerOpen,mobileRef,closeDrawer);

  const navGroups = [
    {
      groupTitle: 'الرقابة والتحليلات',
      items: [
        {
          id: 'overview' as AdminSection,
          label: 'لوحة القيادة والمؤشرات',
          icon: BarChart3,
          badge: stats?.totalLeads ? `${stats.totalLeads} طلب` : undefined
        },
        {
          id: 'routing' as AdminSection,
          label: 'محرك التوزيع وطابور المهندسين',
          icon: Sliders,
          badge: stats?.activeEngineers ? `${stats.activeEngineers} نشط` : undefined
        },
        {
          id: 'leads' as AdminSection,
          label: 'الطلبات والإسناد',
          icon: ShieldCheck,
          badge: stats?.totalLeads ? `${stats.totalLeads}` : undefined
        },
        { id: 'customers' as AdminSection, label: 'ملفات العملاء', icon: Users },
        {
          id: 'audit' as AdminSection,
          label: 'سجل الرقابة والأجهزة (Audit Logs)',
          icon: Fingerprint,
          badge: 'أدمن 🔒'
        }
      ]
    },
    {
      groupTitle: 'الهيكل التنظيمي والتراكات',
      items: [
        {
          id: 'tracks' as AdminSection,
          label: 'التراكات والتيم ليدرز',
          icon: Briefcase,
          badge: stats?.tracksCount ? `${stats.tracksCount}` : undefined
        },
        {
          id: 'services' as AdminSection,
          label: 'كتالوج الخدمات الرقمية',
          icon: Layers
        }
      ]
    },
    {
      groupTitle: 'الحوكمة وفريق العمل',
      items: [
        {
          id: 'users' as AdminSection,
          label: 'المستخدمين وفريق العمل',
          icon: Users,
          badge: stats?.usersCount ? `${stats.usersCount}` : undefined
        },
        {id:'passwords' as AdminSection,label:'طلبات كلمات المرور',icon:Key},
        {id:'clientBrand' as AdminSection,label:'هوية صفحة العملاء',icon:Globe},
        {
          id: 'roles' as AdminSection,
          label: 'الرتب والصلاحيات (RBAC)',
          icon: Key,
          badge: stats?.rolesCount ? `${stats.rolesCount}` : undefined
        }
      ]
    }
  ];

  const externalViews = [
    {tab:'teams' as const,label:'فرق التنفيذ والمحادثات',icon:UsersRound},
    {
      tab: 'desk' as const,label:'مساحتي اليومية',icon:Laptop
    },
    {
      tab: 'workspace' as const,
      label: 'مساحة عمل المهندس',
      icon: UserCheck
    },
    {
      tab: 'staff' as const,
      label: 'تسجيل عميل بالنيابة',
      icon: Megaphone
    },
    {
      tab: 'public' as const,
      label: 'معاينة بوابة العملاء',
      icon: Globe
    }
  ];

  const renderSidebar = (compact: boolean) => {
    const itemClass = compact
      ? 'w-11 h-11 mx-auto justify-center p-0'
      : 'w-full gap-2.5 px-3 py-2.5';
    return (
      <div className="aethra-night-surface flex flex-col h-full min-h-0 overflow-hidden border-l border-[#24364E] select-none">
        <div className={`shrink-0 border-b border-[#24364E] flex items-center ${compact ? 'flex-col justify-center gap-3 px-2 py-3' : 'justify-between gap-3 p-4'}`}>
          <div className="min-w-0">
            <Logo size={28} className="!p-0" variant={compact ? 'mark' : 'full'} subtitle={compact ? undefined : 'مركز قيادة الإدارة التنفيذية'} />
          </div>
          <button onClick={() => setCollapsed(value => !value)} aria-label={compact ? 'توسيع القائمة' : 'طي القائمة'} aria-expanded={!compact}
            title={compact ? 'توسيع القائمة' : 'طي القائمة'}
            className="hidden md:flex shrink-0 w-9 h-9 items-center justify-center rounded-lg bg-dark-50 hover:bg-[#24364E] text-slate-400 hover:text-white transition cursor-pointer">
            {compact ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
          <button onClick={closeDrawer} aria-label="إغلاق قائمة الإدارة" className="md:hidden shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-dark-50 text-slate-300">
            <X size={18} />
          </button>
        </div>

        <nav aria-label="أقسام الإدارة" className={`admin-navigation-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4 ${compact ? 'px-2 space-y-4' : 'px-3 space-y-6'}`}>
          {onBack && <button aria-label="رجوع للصفحة السابقة" title={compact ? 'رجوع للصفحة السابقة' : undefined}
            className={`flex items-center rounded-xl text-sm text-slate-200 hover:bg-white/10 ${itemClass}`}
            onClick={() => { onBack(); closeDrawer(); }}>
            <ArrowRight size={18} className="shrink-0" /><span className={compact ? 'sr-only' : ''}>رجوع للصفحة السابقة</span>
          </button>}
          {navGroups.filter(group => group.items.some(item => hasPermission(user, sectionPermissions[item.id]))).map(group => (
            <div key={group.groupTitle} className="space-y-2">
              {!compact && <p className="px-3 text-xs font-semibold text-slate-400">{group.groupTitle}</p>}
              <div className="space-y-1">
                {group.items.filter(item => hasPermission(user, sectionPermissions[item.id])).map(item => {
                  const Icon = item.icon;
                  const active = currentSection === item.id;
                  return <button key={item.id} aria-label={item.label} aria-current={active ? 'page' : undefined} title={compact ? item.label : undefined}
                    onClick={() => { onSelectSection(item.id); closeDrawer(); }}
                    className={`flex items-center rounded-xl text-xs font-semibold transition-colors cursor-pointer ${itemClass} ${compact ? '' : 'justify-between'} ${active ? 'bg-aethra-cyan text-aethra-ink' : 'text-slate-300 hover:bg-dark-50 hover:text-white'}`}>
                    <span className={`flex items-center min-w-0 ${compact ? 'justify-center' : 'gap-2.5'}`}>
                      <Icon size={18} className="shrink-0" />{!compact && <span className="whitespace-normal text-start leading-6">{item.label}</span>}
                    </span>
                    {!compact && item.badge && <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${active ? 'bg-aethra-ink text-aethra-cyan' : 'bg-dark-50 text-slate-300'}`}>{item.badge}</span>}
                  </button>;
                })}
              </div>
            </div>
          ))}
          {onSwitchTab && <div className="space-y-2 pt-3 border-t border-[#24364E]">
            {!compact && <p className="px-3 text-xs font-semibold text-slate-400">بوابات العمل والمعاينة</p>}
            <div className="space-y-1">
              {externalViews.filter(view => view.tab !== 'public' || isAdministrator(user?.role))
                .filter(view => view.tab !== 'staff' || hasPermission(user, 'leads:create_marketing'))
                .filter(view => view.tab !== 'desk' || hasPermission(user, 'desk:use'))
                .filter(view => view.tab !== 'teams' || hasPermission(user, 'execution:view')).map(view => {
                  const Icon = view.icon;
                  return <button key={view.tab} aria-label={view.label} title={compact ? view.label : undefined}
                    onClick={() => { onSwitchTab(view.tab); closeDrawer(); }}
                    className={`flex items-center rounded-xl text-xs text-slate-300 hover:text-white hover:bg-dark-50 transition cursor-pointer ${itemClass}`}>
                    <Icon size={18} className="shrink-0" />{!compact && <span className="whitespace-normal text-start leading-6">{view.label}</span>}
                  </button>;
                })}
            </div>
          </div>}
        </nav>

        {onOpenDesk && hasPermission(user, 'desk:use') && <div className={`shrink-0 border-t border-[#24364E] py-2 space-y-1 ${compact ? 'px-2' : 'px-3'}`}>
          {[{id:'notes' as const,label:'ملاحظاتي',icon:NotebookPen},{id:'calculator' as const,label:'الآلة الحاسبة',icon:Calculator}].map(tool => (
            <button key={tool.id} aria-label={tool.label} title={compact ? tool.label : undefined}
              className={`flex items-center text-sm text-slate-200 rounded-xl hover:bg-white/10 ${itemClass}`}
              onClick={() => { onOpenDesk(tool.id); closeDrawer(); }}>
              <tool.icon size={18} className="shrink-0" />{!compact && tool.label}
            </button>
          ))}
        </div>}
        <div className={`shrink-0 border-t border-[#24364E] bg-[#0B192F] ${compact ? 'p-2' : 'p-3 space-y-3'}`}>
          {!compact && <div className="grid grid-cols-2 gap-2">
            {hasPermission(user,'settings:manage') && <button onClick={onTriggerSla} title="فحص وتصعيد مهلة الاستجابة" className="flex items-center justify-center gap-1.5 rounded-lg border border-[#24364E] p-2 text-xs text-amber-200 hover:bg-white/5"><Zap size={14}/>فحص SLA</button>}
            {hasPermission(user,'reports:export') && <button onClick={onExportExcel} title="تصدير تقرير إكسيل كامل" className="flex items-center justify-center gap-1.5 rounded-lg border border-[#24364E] p-2 text-xs text-emerald-200 hover:bg-white/5"><FileSpreadsheet size={14}/>تصدير Excel</button>}
          </div>}
          <div className={`flex items-center ${compact ? 'justify-center' : 'justify-between gap-2'}`}>
            {!compact && <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 shrink-0 rounded-lg bg-aethra-cyan text-aethra-ink font-semibold text-xs flex items-center justify-center">{user?.name?.[0] || 'A'}</span>
              <div className="min-w-0 text-right"><p className="text-xs font-semibold text-white truncate">{user?.name || 'مدير التشغيل'}</p><p className="text-xs text-slate-400 truncate">{user?.canManageProtectedAccounts ? 'إدارة المنظومة' : user?.role === 'ADMIN' ? 'مدير التشغيل' : user?.roleId?.name || 'إدارة مفوضة'}</p></div>
            </div>}
            <button onClick={onLogout} aria-label="تسجيل الخروج" title="تسجيل الخروج" className={`shrink-0 flex items-center justify-center rounded-lg text-slate-300 hover:bg-rose-950 hover:text-rose-200 ${compact ? 'w-11 h-11' : 'w-9 h-9'}`}><LogOut size={18}/></button>
          </div>
        </div>
      </div>
    );
  };
  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isDrawerOpen && (
        <div
          onClick={closeDrawer} aria-label="إغلاق قائمة الإدارة"
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
        />
      )}

      {/* Mobile Drawer */}
      {isDrawerOpen && <div ref={mobileRef} role="dialog" aria-modal="true" aria-label="قائمة الإدارة" onKeyDown={event=>{if(event.key==='Escape')closeDrawer();}} className={`md:hidden fixed top-0 right-0 bottom-0 z-50 w-72 max-w-[85vw] transform transition-transform duration-200 ease-in-out shadow-none ${
        isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {renderSidebar(false)}
      </div>}

      {/* Desktop Sticky Sidebar */}
      <aside className={`hidden md:block h-full transition-all duration-200 z-30 flex-shrink-0 ${
        collapsed ? 'w-20' : 'w-72'
      }`}>
        {renderSidebar(collapsed)}
      </aside>
    </>
  );
};

