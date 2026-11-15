import { InternalIntakeLanguage } from '../i18n/public-language';
import React from 'react';
import { PublicLeadForm } from '../pages/PublicLeadForm';
export function RequestEditor({lead,user,onClose,onSaved}:{lead:any;user:any;onClose:()=>void;onSaved:()=>void}){
  return <div className="fixed inset-0 z-[70] bg-aethra-paper overflow-y-auto" role="dialog" aria-modal="true" aria-label="تعديل بيانات استقبال الطلب"><div className="sticky top-0 z-10 bg-white border-b border-surface-border p-3 flex justify-between items-center"><strong>بيانات الطلب {lead.leadCode}</strong><button className="rounded-xl border border-surface-border px-4 py-2" onClick={onClose}>رجوع للطلب</button></div><InternalIntakeLanguage><div className="public-site"><PublicLeadForm staffUser={user} editingLead={lead} onSaved={onSaved}/></div></InternalIntakeLanguage></div>;
}
