import { isAdministrator } from '../utils/auth';
import React from 'react';
import {
  Menu,
  Globe,
  FileText,
  UserCheck,
  ShieldAlert,
  LogOut,
  MessageSquare,
  Briefcase,
  Sparkles
} from 'lucide-react';
import { Logo } from './Logo';
import { ClientBrand } from './ClientBrand';
import { useClientBrand } from '../branding/client-brand';
import { NotificationDropdown } from './NotificationDropdown';
import { usePublicLanguage } from '../i18n/public-language';

interface NavbarProps {
  currentTab: 'public' | 'staff' | 'workspace' | 'admin' | 'desk' | 'teams';
  setCurrentTab: (tab: 'public' | 'staff' | 'workspace' | 'admin' | 'desk' | 'teams') => void;
  user: any;
  onLogout: () => void;
  healthStatus: string;
  onOpenNavigation?:()=>void;
  onLogoClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  user,
  onLogout,
  healthStatus,
  onLogoClick,onOpenNavigation
}) => {
  const { language, setLanguage, t: translate } = usePublicLanguage();
  const isPublic = currentTab === 'public';
  const {brand}=useClientBrand();
  const t = (message: string) => isPublic ? translate(message) : message;
  const roleLabel=user?.canManageProtectedAccounts?'إدارة المنظومة':user?.role==='ADMIN'?'مدير التشغيل':user?.roleId?.name||({ENGINEER:'مهندس',TEAM_LEADER:'قائد فريق',MARKETING:'استقبال العملاء',STAFF:'فريق العمل'} as Record<string,string>)[user?.role]||'فريق العمل';
  return (
    <header className={`${isPublic?'bg-[#f7f7f7] border-surface-border':'aethra-night-surface border-[#24364E]'} shrink-0 relative z-40 border-b shadow-none`}>
      <div className={isPublic?'w-full max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-4':'w-full min-h-[76px] px-4 sm:px-6 py-3 grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3'}>
        <div className="flex items-center gap-3 min-w-0 justify-self-start">
        {onOpenNavigation&&<button className="md:hidden shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-white" onClick={onOpenNavigation} aria-label="فتح قائمة العمل"><Menu size={22}/></button>}
        {/* Brand / Logo (السر: النقر 6 مرات للموظفين بدون أي مظهر أو علامة تلفت نظر الزوار) */}
        <button type="button" aria-label={isPublic?brand.companyName:'Aethra'}
          onClick={onLogoClick}
          className="cursor-pointer flex-shrink-0 text-aethra-cyan"
        >
          {isPublic?<ClientBrand/>:<Logo
            size={32}
            variant="full"
            subtitle={
              isPublic ? t('فكرتك تبدأ هنا') : user?.trackId?.name
                ? `تراك ${user.trackId.name}`
                : "إدارة علاقات العملاء"
            }
            className="aethra-logo--responsive !p-0"
          />}
        </button>
        </div>

        {/* المنتصف: بادج هادئ وراقي يوضح سياق العمل الحالي (بدون أزرار عشوائية تشوش الواجهة) */}
        <div className={isPublic?'hidden':'hidden lg:flex items-center justify-center min-w-0 justify-self-center'}>
          {!isPublic && user && isAdministrator(user.role) && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-aethra-ink text-aethra-cyan text-xs font-semibold shadow-none border border-dark-50">
              <ShieldAlert className="w-3.5 h-3.5 text-aethra-cyan" />
              <span>{t("مركز القيادة والتحكم الإداري")}</span>
            </div>
          )}

          {!isPublic && user && user.role === 'ENGINEER' && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-aethra-paper text-aethra-ink text-xs font-bold border border-surface-border shadow-none">
              <UserCheck className="w-3.5 h-3.5 text-aethra-ink" />
              <span>{t("مساحة عمل المهندس ومتابعة العملاء")}</span>
            </div>
          )}

          {!isPublic && user && user.role === 'TEAM_LEADER' && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-aethra-paper text-aethra-ink text-xs font-bold border border-surface-border shadow-none">
              <Briefcase className="w-3.5 h-3.5 text-aethra-ink" />
              <span>{t("مساحة عمل التراك — تيم ليدر")}</span>
            </div>
          )}

          {!isPublic && user && (user.role === 'MARKETING' || user.role === 'STAFF') && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-aethra-paper text-aethra-ink text-xs font-bold border border-surface-border shadow-none">
              <FileText className="w-3.5 h-3.5 text-aethra-ink" />
              <span>{t("تسجيل طلب بالنيابة عن العميل")}</span>
            </div>
          )}
        </div>

        {/* القسم الأيسر: الإشعارات اللحظية، مؤشر الخادم، وبطاقة الحساب */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 justify-self-end">
          {isPublic && <button type="button" lang={language === 'ar' ? 'en' : 'ar'}
            aria-label={t(language === 'ar' ? 'التبديل إلى الإنجليزية' : 'التبديل إلى العربية')}
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="public-language-switch inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#3b62ac] text-[#284a8b] bg-white">
            <Globe aria-hidden="true" className="w-4 h-4" />{language === 'ar' ? 'English' : t("العربية")}
          </button>}
          {/* مؤشر صحة وسحابة Aethra Cloud */}
          {!isPublic && <div
            className="hidden xl:flex items-center gap-2 px-2 text-xs text-slate-300"
            title={healthStatus === 'online' ? t("الخادم السحابي متصل ويعمل") : t("جاري فحص الاتصال")}
          >
            <span className={`w-2 h-2 rounded-full ${healthStatus === 'online' ? 'bg-[#137A45]' : 'bg-amber-400 animate-ping'}`} />
            <span className="font-medium text-xs">Aethra Cloud</span>
          </div>}

          {user ? (
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* قائمة الإشعارات والتنبيهات المباشرة */}
              {!isPublic && <NotificationDropdown user={user} />}

              {/* بطاقة المستخدم */}
              <div className="flex items-center gap-2.5 h-11 min-w-0 bg-aethra-paper border border-surface-border px-2 sm:px-3 rounded-xl" title={`${user.name} · ${roleLabel}`}>
                <div className="w-6 h-6 rounded-lg bg-aethra-cyan text-aethra-ink font-semibold text-xs flex items-center justify-center flex-shrink-0">
                  {user.name?.[0] || 'U'}
                </div>
                <div className="text-right hidden sm:block min-w-0">
                  <p className="text-sm font-semibold text-aethra-ink leading-tight truncate max-w-[150px]"><bdi>{user.name}</bdi></p>
                  <p className="text-xs text-surface-muted leading-tight mt-1 truncate max-w-[150px]">
                    {roleLabel}
                  </p>
                </div>
              </div>

              {/* زر تسجيل الخروج */}
              <button
                onClick={onLogout}
                title={t("تسجيل الخروج")}
                aria-label={t('تسجيل الخروج')}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-aethra-paper hover:bg-rose-50 text-surface-muted hover:text-rose-600 border border-surface-border transition cursor-pointer active:scale-95 shadow-none"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* زر واتساب راقي واحترافي للعملاء الزوار */
            <a
              href={`https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(t('مرحبًا {company}، محتاج مساعدة في مشروعي.').replace('{company}',brand.companyName))}`}
              aria-label={t('تواصل مباشر')}
              title={t('تواصل مباشر')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#137A45] hover:bg-[#0F6237] text-white text-xs font-bold shadow-none transition cursor-pointer active:scale-95"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden min-[360px]:inline">{t("تواصل مباشر")}</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
};
