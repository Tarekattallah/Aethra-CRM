import { WorkSidebar,DeskTarget } from './components/WorkSidebar';
import { PersonalDesk } from './pages/PersonalDesk';
import { isAdministrator, canManage, configureAccountCapabilities,hasPermission } from './utils/auth';
import React, { useState, useEffect, lazy, Suspense, useRef } from 'react';
import axios from 'axios';
import {
  Users,
  ShieldCheck,
  UserCheck,
  Layers,
  Activity,
  CheckCircle2,
  Lock,
  LogIn,
  Sliders,
  Settings,
  Globe,
  Sparkles,
  X,
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from './components/Navbar';
import { ClientBrand } from './components/ClientBrand';
import { useClientBrand } from './branding/client-brand';
import { PublicLeadForm } from './pages/PublicLeadForm';
import { StaffLeadForm } from './pages/StaffLeadForm';
const ExecutionHub=lazy(()=>import('./pages/ExecutionHub').then(module=>({default:module.ExecutionHub})));
const EngineerWorkspace = lazy(() => import('./pages/EngineerWorkspace').then(module => ({ default: module.EngineerWorkspace })));
const AdminCommandCenter = lazy(() => import('./pages/AdminCommandCenter').then(module => ({ default: module.AdminCommandCenter })));
import { Logo } from './components/Logo';
import { OrbitLoader } from './components/OrbitLoader';
import { usePublicLanguage, translatePublic } from './i18n/public-language';

export default function App() {
  const {brand:clientBrand}=useClientBrand();
  const [currentTab, updateCurrentTab] = useState<'public' | 'staff' | 'workspace' | 'admin' | 'desk' | 'teams'>('public');
  const [teamsRevision,setTeamsRevision]=useState(0);
  const [executionRoomId,setExecutionRoomId]=useState<string|null>(null);
  const [deskTarget,setDeskTarget]=useState<DeskTarget>('notes');
  const [mobileNavigation,setMobileNavigation]=useState(false);
  type Tab='public'|'staff'|'workspace'|'admin'|'desk'|'teams';
  const navigation=useRef<Tab[]>([]);
  const activeTab=useRef<Tab>('public');
  const setCurrentTab=(tab:Tab)=>{if(tab==='teams'){setExecutionRoomId(null);setTeamsRevision(value=>value+1);}if(activeTab.current!==tab){navigation.current.push(activeTab.current);activeTab.current=tab;updateCurrentTab(tab);}};
  const goBack=()=>{const previous=navigation.current.pop();const tab=previous && (previous!=='public'||isAdministrator(user?.role)) && (previous!=='admin'||canManage(user))?previous:(canManage(user)?'admin':'workspace');activeTab.current=tab;updateCurrentTab(tab);};
  const openDesk=(target:DeskTarget)=>{setDeskTarget(target);setCurrentTab('desk');};
  const openExecution=(id:string)=>{setCurrentTab('teams');setExecutionRoomId(id);};
  const { language } = usePublicLanguage();
  const activeLanguage = currentTab === 'public' ? language : 'ar';
  const t = (message: string) => translatePublic(message, activeLanguage);
  useEffect(() => {
    document.documentElement.lang = activeLanguage;
    document.documentElement.dir = activeLanguage === 'ar' ? 'rtl' : 'ltr';
    const publicPage=currentTab==='public';
    document.title = publicPage ? activeLanguage === 'ar' ? 'ابدأ طلبك | '+clientBrand.companyName : 'Start your request | '+clientBrand.companyName : 'Aethra | CRM';
    const brand=publicPage?clientBrand.companyName:'Aethra';
    const description=publicPage?(activeLanguage==='ar'?'احكيلنا عن مشروعك والخدمات اللي محتاجها، وفريق '+clientBrand.companyName+' يتواصل معاك.':'Tell '+clientBrand.companyName+' about your project and the services you need. Our team will contact you.'):'Aethra | Customer Relationship Management';
    for(const [selector,value] of [['meta[name="application-name"]',brand],['meta[name="description"]',description],['meta[property="og:title"]',document.title],['meta[property="og:description"]',description],['meta[property="og:image"]',publicPage?clientBrand.logoUrl:'/brand/og-image.png'],['meta[property="og:image:alt"]',brand],['meta[name="twitter:title"]',document.title],['meta[name="twitter:description"]',description],['meta[name="twitter:image"]',publicPage?clientBrand.logoUrl:'/brand/og-image.png'],['meta[name="twitter:image:alt"]',brand]])document.querySelector(selector)?.setAttribute('content',value);
    document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"],link[rel="manifest"]').forEach(link=>link.remove());
    const icon=document.createElement('link');icon.rel='icon';icon.href=publicPage?clientBrand.logoUrl:'/brand/favicon.svg';icon.type=publicPage?'image/png':'image/svg+xml';document.head.append(icon);
    if(!publicPage){const manifest=document.createElement('link');manifest.rel='manifest';manifest.href='/brand/site.webmanifest';document.head.append(manifest);}
  }, [activeLanguage, currentTab,clientBrand.companyName,clientBrand.logoUrl]);
  const [healthStatus, setHealthStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // 6-Clicks Logo Secret State
  const [logoClicks, setLogoClicks] = useState(0);
  const [lastLogoClickTime, setLastLogoClickTime] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const expire = () => {
      localStorage.removeItem('token'); localStorage.removeItem('user');
      configureAccountCapabilities();
      setUser(null); setPassword(''); setCurrentTab('public'); setShowLoginModal(true);
      setErrorMsg('انتهت الجلسة أو تم تعطيل الحساب. يرجى تسجيل الدخول مجدداً.');
    };
    window.addEventListener('crm-auth-expired', expire);
    return () => window.removeEventListener('crm-auth-expired', expire);
  }, []);

  useEffect(() => {
    axios.get('/api/health')
      .then((res: any) => setHealthStatus(res.data.status === 'online' ? 'online' : 'offline'))
      .catch(() => setHealthStatus('offline'));

    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${storedToken}` } })
        .then((res: any) => {
          const current = res.data.data.user;
          configureAccountCapabilities(current);
          setUser(current);
          localStorage.setItem('user', JSON.stringify(current));
          setCurrentTab(canManage(current) ? 'admin' : ['STAFF', 'MARKETING'].includes(current.role) ? 'staff' : 'workspace');
        })
        .catch((error: any) => {
          if ([401, 403].includes(error.response?.status)) {
            localStorage.removeItem('token'); localStorage.removeItem('user');
          } else toast.error(t('تعذر استعادة الجلسة؛ تحقق من اتصال الخادم ثم أعد تحميل الصفحة.'));
        });
    }
  }, []);

  // دالة النقر السري 6 مرات على الشعار لفتح نافذة الموظفين (بدون إظهار أي مؤشر للزوار)
  const handleLogoClick = () => {
    if (user) {
      // إذا كان مسجلاً بالفعل، يعيده لصفحته المسؤولة
      if (canManage(user)) setCurrentTab('admin');
      else if (user.role === 'MARKETING' || user.role === 'STAFF') setCurrentTab('staff');
      else setCurrentTab('workspace');
      return;
    }

    const now = Date.now();
    const isExpired = now - lastLogoClickTime > 3500;
    const newCount = isExpired ? 1 : logoClicks + 1;

    setLastLogoClickTime(now);
    setLogoClicks(newCount);

    if (newCount === 6) {
      setLogoClicks(0);
      setShowLoginModal(true);
      toast.success(t('مرحباً بك في بوابة فريق عمل Aethra'));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      if (res.data.success) {
        const loggedUser = res.data.data.user;
        localStorage.setItem('token', res.data.data.token);
        localStorage.setItem('user', JSON.stringify(loggedUser));
        configureAccountCapabilities(loggedUser);
        setUser(loggedUser);
        setPassword('');
        setShowLoginModal(false);
        setLogoClicks(0);

        toast.success(translatePublic('أهلاً بك، {name}!', language, {name: loggedUser.name}));

        // توجيه فوري حسب الرول
        if (canManage(loggedUser)) {
          setCurrentTab('admin');
        } else if (loggedUser.role === 'MARKETING' || loggedUser.role === 'STAFF') {
          setCurrentTab('staff');
        } else {
          setCurrentTab('workspace');
        }
      }
    } catch (err: any) {
      setErrorMsg('فشل تسجيل الدخول، تأكد من صحة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try { await axios.post('/api/auth/logout'); } catch { toast.error(t('تعذر إغلاق جلسة التنزيل؛ أعد المحاولة.')); return; }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    configureAccountCapabilities();
    setUser(null);
    setPassword('');
    setCurrentTab('public');
    setShowLoginModal(false);
    setLogoClicks(0);
    toast.success(translatePublic('تم تسجيل الخروج بنجاح.', language));
  };

  return (
    <div lang={activeLanguage} dir={activeLanguage === 'ar' ? 'rtl' : 'ltr'} className={`${user && currentTab!=='public'?'h-dvh overflow-hidden':'min-h-screen'} bg-aethra-paper text-aethra-ink flex flex-col justify-between ${currentTab === 'public' ? 'public-site' : 'internal-site'}`}>


      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        user={user}
        onLogout={handleLogout}
        healthStatus={healthStatus}
        onLogoClick={handleLogoClick}
        onOpenNavigation={user && currentTab!=='admin' && currentTab!=='public'?()=>setMobileNavigation(true):undefined}
      />

      <div className="flex flex-1 min-h-0 w-full">
      {user&&currentTab!=='public'&&currentTab!=='admin'&&<WorkSidebar user={user} currentTab={currentTab} onNavigate={setCurrentTab} onBack={goBack} onLogout={handleLogout} onOpenDesk={openDesk} mobileOpen={mobileNavigation} onClose={()=>setMobileNavigation(false)}/>}
      {/* Main Content Area */}
      <main className={`flex-1 min-h-0 w-full ${user && currentTab!=='public'?'overflow-y-auto':''} ${canManage(user) && currentTab === 'admin' ? 'p-0 max-w-none overflow-hidden' : 'min-w-0 mx-auto px-4 sm:px-6 py-6'}`}>
        <Suspense fallback={<div className="p-8 text-center"><OrbitLoader label={t("جاري تحميل مساحة العمل")} /><p>{t("جاري تحميل مساحة العمل...")}</p></div>}>
        {/* 1. صفحة العميل العامة (تظهر حصراً للزوار غير المسجلين، أو لمدير النظام إن أراد معاينتها) */}
        {(!user || (isAdministrator(user?.role) && currentTab === 'public')) && currentTab === 'public' && (
          <PublicLeadForm />
        )}

        {/* 2. استمارة التسويق (تظهر حصراً لموظف التسويق أو لمدير النظام) */}
        {user && hasPermission(user,'leads:create_marketing') && currentTab === 'staff' && (
          <StaffLeadForm user={user} />
        )}

        {/* 3. مساحة عمل المهندس أو التيم ليدر (تظهر حصراً للمهندس أو التيم ليدر أو لمدير النظام) */}
        {user && (!isAdministrator(user.role) || currentTab === 'workspace') && currentTab === 'workspace' && (
          <EngineerWorkspace user={user} onOpenExecution={openExecution} />
        )}

        {/* 4. لوحة قيادة الإدارة (تظهر حصراً للأدمن) مع شريط جانبي احترافي متكامل */}
        {user && canManage(user) && currentTab === 'admin' && (
          <AdminCommandCenter
            onSwitchTab={setCurrentTab}
            onBack={goBack}
            onOpenDesk={openDesk}
            onOpenExecution={openExecution}
            onLogout={handleLogout}
            user={user}
          />
        )}
        {user && hasPermission(user,'desk:use') && currentTab==='desk' && <PersonalDesk user={user} target={deskTarget}/>}
        {user&&hasPermission(user,'execution:view')&&currentTab==='teams'&&<ExecutionHub key={teamsRevision} user={user} initialRoomId={executionRoomId}/>}
        </Suspense>
      </main>
      </div>

      {/* مودال تسجيل دخول الموظفين (يُفتح بالنقر على الشعار 6 مرات) */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-aethra-night/95 flex items-center justify-center p-3 sm:p-4">
          <div className="aethra-login aethra-night-surface border border-[#24364E] rounded-xl max-w-md w-full p-5 sm:p-8 shadow-none relative max-h-[92vh] overflow-y-auto" role="dialog" aria-modal="true" aria-label={t("تسجيل دخول الموظفين")}>
            <button
              aria-label={t("إغلاق تسجيل الدخول")}
              onClick={() => {
                setShowLoginModal(false);
                setLogoClicks(0);
              }}
              className="absolute top-5 left-5 p-2 rounded-xl bg-aethra-paper hover:bg-stone-200 text-surface-muted hover:text-aethra-ink transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6">
              <div className="flex justify-center mb-3">
                <Logo size="lg" variant="full" className="text-aethra-cyan" />
              </div>
              <p className="text-sm text-aethra-paper mb-5">{t('فكرتك تبدأ هنا')}</p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-aethra-cyan text-aethra-ink text-[11px] font-semibold mb-2 shadow-none">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t("بوابة دخول فريق عمل Aethra")}</span>
              </div>
              <h2 className="text-xl font-semibold text-white">{t("تسجيل دخول الموظفين")}</h2>
              <p className="text-xs text-slate-300 mt-1">{t("خاص بالمهندسين والتيم ليدرز وفريق الإدارة والتسويق")}</p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {t(errorMsg)}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-bold text-aethra-paper mb-1.5">{t("البريد الإلكتروني")}</label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl px-4 py-2.5 text-sm text-aethra-ink focus:outline-none focus:border-aethra-ink focus:bg-white transition"
                  placeholder="name@company.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-bold text-aethra-paper mb-1.5">{t("كلمة المرور")}</label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-aethra-paper border border-surface-border rounded-xl px-4 py-2.5 text-sm text-aethra-ink focus:outline-none focus:border-aethra-ink focus:bg-white transition"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-aethra-cyan hover:bg-[#43DDF9] text-aethra-ink font-semibold py-3 rounded-xl text-sm transition shadow-none flex items-center justify-center gap-2 cursor-pointer border border-[#1396AF]"
              >
                {loading ? <><OrbitLoader className="!text-aethra-ink" label={t("جاري التحقق")} /><span>{t("جاري التحقق...")}</span></> : (
                  <>
                    <LogIn className="w-4 h-4 text-aethra-ink" />
                    <span>{t("دخول إلى حسابي")}</span>
                  </>
                )}
              </button>
              <button type="button" disabled={loading} className="text-sm text-white underline w-full py-2" onClick={async()=>{if(!email.trim()||!email.includes('@')){setErrorMsg('اكتب بريد حسابك أولًا.');return;}setLoading(true);try{const res=await axios.post('/api/auth/forgot-password',{email});setErrorMsg(res.data.message);}catch{setErrorMsg('تعذر إرسال الطلب. حاول لاحقًا.');}finally{setLoading(false);}}}>{t('نسيت كلمة المرور؟ اطلب تغييرها من الإدارة')}</button>
            </form>


          </div>
        </div>
      )}

      {/* Footer */}
      {currentTab==='public' && <footer className="border-t border-surface-border bg-[#f7f7f7] px-4 py-6 sm:py-5 text-surface-muted">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-start">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 min-w-0">
            <ClientBrand compact />
            <div className="space-y-1">
              <p className="flex items-center justify-center sm:justify-start gap-2 text-sm font-medium text-aethra-ink"><bdi>{clientBrand.companyName}</bdi><span dir="ltr">&copy; {new Date().getFullYear()}</span></p>
              <p className="text-xs">{t('جميع الحقوق محفوظة.')}</p>
            </div>
          </div>
          <p className="text-sm leading-7 max-w-xs">{t('كل فكرة تبدأ بخطوة.')}</p>
        </div>
      </footer>}
    </div>
  );
}
