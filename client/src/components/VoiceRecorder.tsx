import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { usePublicLanguage } from '../i18n/public-language';

export function VoiceRecorder({value,onChange,onBusy}:{value:any;onChange:(file:any)=>void;onBusy:(busy:boolean)=>void}) {
  const {t}=usePublicLanguage();
  const alive=useRef(true);const uploadingRequest=useRef<AbortController|null>(null);
  const recorder=useRef<MediaRecorder|null>(null);const stream=useRef<MediaStream|null>(null);const timer=useRef<ReturnType<typeof setTimeout>>();
  const [recording,setRecording]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [preview,setPreview]=useState('');
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;uploadingRequest.current?.abort();onBusy(false);clearTimeout(timer.current);if(recorder.current){recorder.current.onstop=null;if(recorder.current.state==='recording')recorder.current.stop();}stream.current?.getTracks().forEach(track=>track.stop());};},[onBusy]);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  const upload=async(file:File)=>{
    if(file.size>15*1024*1024){setError('الحد الأقصى للملف الواحد 15 ميجابايت.');return;}
    setBusy(true);onBusy(true);setError('');
    try{const body=new FormData();body.append('file',file);const request=new AbortController();uploadingRequest.current=request;const res=await axios.post('/api/upload',body,{signal:request.signal});if(!alive.current)return;onChange(res.data.data.file);setPreview(URL.createObjectURL(file));}
    catch{if(alive.current)setError('تعذر رفع الملف.');}finally{if(alive.current){setBusy(false);onBusy(false);}}
  };
  const start=async()=>{setError('');try{
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setError('التسجيل غير متاح هنا. ارفع ملف صوتي أو استخدم الطلب السريع.');return;}
    const media=await navigator.mediaDevices.getUserMedia({audio:true});if(!alive.current){media.getTracks().forEach(track=>track.stop());return;}stream.current=media;
    const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
    const active=new MediaRecorder(media,mime?{mimeType:mime}:undefined);recorder.current=active;const chunks:BlobPart[]=[];
    active.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    active.onstop=()=>{clearTimeout(timer.current);media.getTracks().forEach(track=>track.stop());setRecording(false);onBusy(false);const type=active.mimeType;void upload(new File(chunks,`request.${type.includes('ogg')?'ogg':type.includes('mp4')?'m4a':'webm'}`,{type}));};
    active.start();setRecording(true);onBusy(true);timer.current=setTimeout(()=>{if(active.state==='recording')active.stop();},120000);
  }catch{stream.current?.getTracks().forEach(track=>track.stop());onBusy(false);setError('تعذر فتح الميكروفون. اسمح باستخدامه أو ارفع ملف صوتي.');}};
  return <div className="rounded-xl border border-surface-border bg-aethra-paper p-5 space-y-4">
    <h3 className="font-semibold">{t('احكي طلبك بصوتك')}</h3><p className="text-sm leading-7">{t('اكتب اسمك ورقمك في الحقول فوق. في التسجيل احكي فكرتك، محتاج إيه، وأي موعد مهم. مش محتاج تقول رقمك أو أي بيانات حساسة.')}</p>
    <p className="text-sm text-surface-muted">{t('حتى دقيقتين للتسجيل. فريق التسويق يسمعه وينظم التفاصيل قبل تحويله للمهندس.')}</p>
    <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} className="px-4 py-3 rounded-xl bg-aethra-ink text-white" onClick={()=>recording?recorder.current?.stop():void start()}>{t(recording?'إيقاف وحفظ التسجيل':'ابدأ التسجيل')}</button>
    <label className="rounded-xl border border-surface-border bg-white p-3 cursor-pointer">{t(busy?'جاري الرفع…':'أو ارفع ملف صوتي')}<input disabled={busy||recording} type="file" accept="audio/webm,audio/ogg,audio/mpeg,audio/wav,audio/mp4,.m4a" className="sr-only" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(file);}}/></label></div>
    {recording&&<p role="status" className="text-rose-700">{t('جاري التسجيل…')}</p>}
    {value&&<div className="space-y-2"><p className="text-sm break-all">{t('التسجيل جاهز')}: {value.originalName}</p>{preview&&<audio controls src={preview} className="w-full"/>}<button disabled={busy||recording} type="button" className="underline text-sm" onClick={()=>{onChange(null);setPreview('');}}>{t('إزالة التسجيل')}</button></div>}
    {error&&<p role="alert" className="text-sm text-rose-700">{t(error)}</p>}
  </div>;
}
