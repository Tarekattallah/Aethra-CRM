import React from 'react';
import { BUDGET_RANGES, PAYMENT_PREFERENCES, PROJECT_TYPES, REFERRAL_SOURCES, intakeLabel } from '../utils/intake';

export function RequestIntakeSummary({ lead }: { lead: any }) {
  const fields = [
    ['تم تقديمه بواسطة', lead.submittedByUserId?.name || lead.marketingEmployeeName || 'العميل بنفسه'], ['تنسيق التسجيل بواسطة',lead.voiceReviewedBy?.name], ['قناة التسجيل', lead.intakeChannel==='INTERNAL_STAFF'?'موظف بالنيابة عن العميل':'العميل بنفسه'], ['المشروع أو النشاط', lead.companyName], ['دور مقدم الطلب', lead.position],
    ['طريقة تقديم الطلب', lead.voiceRecording ? (lead.voiceReviewStatus==='REVIEWED'?'طلب صوتي تم تنسيقه':'طلب صوتي ينتظر التنسيق') : lead.intakeMode === 'QUICK' ? 'طلب سريع' : lead.intakeMode === 'DETAILED' ? 'طلب بالتفاصيل' : lead.intakeMode==='VOICE'?'طلب صوتي':''],
    ['عرفنا منين؟', lead.referralSource && lead.referralSource !== 'UNKNOWN' ? intakeLabel(REFERRAL_SOURCES, lead.referralSource) : ''],
    ['تفاصيل المصدر', lead.referralSource === 'OTHER' ? lead.referralDetails : ''],
    ['مصدر رابط الحملة', lead.campaignAttribution?.utmSource],
    ['وسيلة الحملة', lead.campaignAttribution?.utmMedium],
    ['اسم الحملة', lead.campaignAttribution?.utmCampaign],
    ['محتوى الحملة', lead.campaignAttribution?.utmContent],
    ['الموقع المحيل', lead.campaignAttribution?.referrerHost],
    ['الوصف', lead.projectDescription], ['الهدف', lead.mainGoal], ['الجمهور', lead.targetAudience],
    ['المشكلة', lead.problemToSolve], ['النتائج المتوقعة', lead.expectedResults],
    ['الخدمة الأخرى', lead.otherService],
    ['مشروع قائم', typeof lead.hasExistingProject === 'boolean' ? lead.hasExistingProject ? 'نعم' : 'لا' : ''],
    ['نوع الطلب', lead.projectTypes?.map((code: string) => intakeLabel(PROJECT_TYPES, code)).join('، ')],
    ['الميزانية التقديرية', lead.budgetRange ? `${intakeLabel(BUDGET_RANGES, lead.budgetRange)} ${lead.budgetRange === 'NOT_SURE' ? '' : lead.currency}` : lead.estimatedBudget !== undefined ? `${lead.estimatedBudget} ${lead.currency}` : ''],
    ['البداية المطلوبة', lead.preferredStartDate ? new Date(lead.preferredStartDate).toLocaleDateString('ar-EG') : ''],
    ['التسليم المطلوب', lead.expectedDeadline ? new Date(lead.expectedDeadline).toLocaleDateString('ar-EG') : ''],
    ['الدفع المفضل', lead.paymentPreference ? intakeLabel(PAYMENT_PREFERENCES, lead.paymentPreference) : '']
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  const links = [lead.websiteUrl, ...(lead.socialLinks || []), ...(lead.referenceLinks || [])].filter((link: unknown): link is string => typeof link === 'string' && /^https?:\/\//i.test(link));
  return <section className="rounded-xl border border-surface-border p-4 space-y-4">
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-sm">{lead.projectName || 'تفاصيل الطلب الأصلي'}</h3>
      {lead.needsAssessment && !lead.assignedEngineerId && <span className="text-xs bg-amber-50 text-amber-900 rounded-full px-3 py-1">بانتظار المراجعة والإسناد</span>}
    </div>
    <div className="flex flex-wrap gap-2">{lead.departmentIds?.map((department: any) => <span key={department._id} className="rounded-lg bg-aethra-paper px-2 py-1 text-xs">{department.name}</span>)}{lead.serviceIds?.map((service: any) => <span key={service._id} className="rounded-lg bg-aethra-cyan/15 px-2 py-1 text-xs">{service.name}</span>)}</div>
    {lead.serviceSelection === 'NOT_SURE' && <p className="text-sm text-surface-muted">العميل محتاج مساعدة في تحديد الخدمات المناسبة.</p>}
    <dl className="space-y-3">{fields.map(([label, value]) => <div key={label} className="grid sm:grid-cols-[140px_minmax(0,1fr)] gap-1 text-sm"><dt className="text-surface-muted">{label}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd></div>)}</dl>
    {lead.serviceIds?.map((service: any) => <div key={service._id} className="space-y-2">{(lead.serviceQuestionsSnapshot?.[service._id]||service.dynamicFormFields)?.map((field: any) => {
      const value = lead.serviceRequirements?.[service._id]?.[field.name];
      return value !== undefined && value !== '' ? <p key={field.name} className="text-sm whitespace-pre-wrap break-words"><span className="text-surface-muted">{service.name} · {field.label}: </span>{typeof value === 'boolean' ? value ? 'نعم' : 'لا' : String(value)}</p> : null;
    })}</div>)}
    {links.length > 0 && <div className="space-y-2 border-t border-surface-border pt-3"><p className="text-xs text-surface-muted">الموقع والروابط والمراجع</p>{links.map((link: string, index: number) => <a key={`${index}-${link}`} href={link} target="_blank" rel="noreferrer" className="block underline text-sm break-all">{link}</a>)}</div>}
    {lead.privacyAcceptedAt && <p className="text-xs text-surface-muted">تم تسجيل موافقة استخدام البيانات والتواصل مع الطلب.</p>}
  </section>;
}
