import React, { useEffect, useState } from 'react';
import axios from 'axios';
export function VoicePlayback({recording}:{recording:any}){
  const [url,setUrl]=useState('');const [error,setError]=useState(false);
  useEffect(()=>{let objectUrl='';const controller=new AbortController();axios.get(`/api/files/${encodeURIComponent(recording.filename)}`,{responseType:'blob',signal:controller.signal}).then(res=>{objectUrl=URL.createObjectURL(res.data);setUrl(objectUrl);}).catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};},[recording.filename]);
  return <section className="p-4 rounded-xl bg-aethra-paper space-y-3"><h3 className="font-semibold">تسجيل العميل الأصلي</h3>{error?<p role="alert">تعذر تحميل التسجيل. أعد فتح الطلب للمحاولة.</p>:url?<audio controls className="w-full" src={url}/>:<p role="status">جاري تحميل التسجيل…</p>}<p className="text-sm text-surface-muted">اسمع التسجيل وسجّل ملخصًا منظمًا والخدمات المطلوبة قبل الإسناد.</p></section>;
}
