import React,{createContext,useContext,useEffect,useState,useCallback} from 'react';
import axios from 'axios';

export interface PortalBrand {companyName:string;logoUrl:string;logoFilename:string|null;whatsapp:string;revision:number}
export const DEFAULT_CLIENT_BRAND:PortalBrand={companyName:'Digency',logoUrl:'/brand/digency/logo.png',logoFilename:null,whatsapp:'201116247717',revision:0};
const Context=createContext({brand:DEFAULT_CLIENT_BRAND,ready:false,error:false,refresh:()=>{},setBrand:(_brand:PortalBrand)=>{}});
export function ClientBrandProvider({children}:{children:React.ReactNode}) {
  const [brand,setBrand]=useState(DEFAULT_CLIENT_BRAND);const [ready,setReady]=useState(false);const [error,setError]=useState(false);
  const [attempt,setAttempt]=useState(0);const refresh=useCallback(()=>setAttempt(value=>value+1),[]);
  useEffect(()=>{const controller=new AbortController();setError(false);axios.get('/api/public/branding',{signal:controller.signal}).then(res=>{if(!controller.signal.aborted){setBrand(res.data.data.brand);setReady(true);}}).catch(error=>{if(!controller.signal.aborted&&!axios.isCancel(error))setError(true);});return()=>controller.abort();},[attempt]);
  return <Context.Provider value={{brand,ready,error,refresh,setBrand}}>{children}</Context.Provider>;
}
export const useClientBrand=()=>useContext(Context);
