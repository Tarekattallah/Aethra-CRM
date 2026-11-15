import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { publicMessages } from './public-messages';
import { toast } from 'sonner';

export type PublicLanguage = 'ar' | 'en';
export type MessageValues = Record<string, string | number>;
export function translatePublic(message: string, language: PublicLanguage, values: MessageValues = {}): string {
  const text = language === 'en' ? publicMessages[message] || message : message;
  return text.replace(/\{(\w+)\}/g, (token, key) => String(values[key] ?? token));
}
type LanguageContext = { language: PublicLanguage; setLanguage: (language: PublicLanguage) => void; t: (message: string, values?: MessageValues) => string };
const Context = createContext<LanguageContext | null>(null);

export function PublicLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, updateLanguage] = useState<PublicLanguage>(() => {
    try { return localStorage.getItem('aethra.public-language') === 'en' ? 'en' : 'ar'; } catch { return 'ar'; }
  });
  const setLanguage = useCallback((next: PublicLanguage) => {
    toast.dismiss();
    updateLanguage(next);
    try { localStorage.setItem('aethra.public-language', next); } catch { /* Session-only preference when storage is unavailable. */ }
  }, []);
  const t = useCallback((message: string, values?: MessageValues) => translatePublic(message, language, values), [language]);
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePublicLanguage() {
  const context = useContext(Context);
  if (!context) throw new Error('PublicLanguageProvider is required');
  return context;
}

export function InternalIntakeLanguage({children}:{children:React.ReactNode}) {
  const value=useMemo(()=>({language:'ar' as const,setLanguage:()=>{},t:(message:string,values?:MessageValues)=>translatePublic(message,'ar',values)}),[]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
