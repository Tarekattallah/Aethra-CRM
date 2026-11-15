import axios from 'axios';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import App from './App';
import './index.css';
import { PublicLanguageProvider, usePublicLanguage } from './i18n/public-language';
import { ClientBrandProvider } from './branding/client-brand';

function PublicNotifications() {
  const { language, t } = usePublicLanguage();
  return <Toaster position="top-center" richColors closeButton dir={language === 'ar' ? 'rtl' : 'ltr'}
    className={`public-notifications public-${language}`} containerAriaLabel={t('التنبيهات')}
    toastOptions={{ closeButtonAriaLabel: t('إغلاق التنبيه') }} />;
}

axios.interceptors.request.use((config: any) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
axios.interceptors.response.use(response => response, error => {
  if (localStorage.getItem('token') && (error.response?.status === 401 || error.response?.data?.code === 'ACCOUNT_DISABLED')) {
    window.dispatchEvent(new Event('crm-auth-expired'));
  }
  return Promise.reject(error);
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2, // 2 minutes
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <PublicLanguageProvider>
      <ClientBrandProvider>
        <App />
        <PublicNotifications />
      </ClientBrandProvider>
      </PublicLanguageProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

