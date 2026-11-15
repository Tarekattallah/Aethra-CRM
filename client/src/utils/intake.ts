export const PROJECT_TYPES = [
  ['NEW_PROJECT', 'مشروع جديد'], ['IMPROVE_EXISTING', 'تطوير مشروع قائم'],
  ['ONE_TIME', 'خدمة لمرة واحدة'], ['MONTHLY_RETAINER', 'تعاقد شهري'],
  ['CONSULTATION', 'استشارة'], ['COMPLETE_SOLUTION', 'حل متكامل']
] as const;
export const BUDGET_RANGES = [
  ['UNDER_5000', 'أقل من 5,000'], ['5000_15000', '5,000 – 15,000'],
  ['15000_30000', '15,000 – 30,000'], ['30000_50000', '30,000 – 50,000'],
  ['OVER_50000', 'أكثر من 50,000'], ['NOT_SURE', 'محتاج عرض سعر لتحديد الميزانية']
] as const;
export const PAYMENT_PREFERENCES = [
  ['ONE_TIME', 'دفعة واحدة'], ['MILESTONES', 'على مراحل'], ['MONTHLY', 'شهريًا']
] as const;
export const REFERRAL_SOURCES = [
  ['UNKNOWN', 'مش فاكر / مش متأكد'], ['FACEBOOK', 'فيسبوك'], ['INSTAGRAM', 'إنستجرام'],
  ['TIKTOK', 'تيك توك'], ['GOOGLE', 'بحث جوجل'], ['WHATSAPP', 'واتساب'],
  ['FRIEND', 'ترشيح من شخص'], ['LINKEDIN', 'لينكدإن'], ['YOUTUBE', 'يوتيوب'], ['OTHER', 'مكان تاني']
] as const;
export interface PhoneCountry { code: string; name: string; callingCode: string }
export const FALLBACK_PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'EG', name: 'مصر', callingCode: '+20' },
  { code: 'SA', name: 'المملكة العربية السعودية', callingCode: '+966' },
  { code: 'AE', name: 'الإمارات العربية المتحدة', callingCode: '+971' }
];
export function captureCampaignAttribution(pageUrl: string, referrer: string) {
  const page = new URL(pageUrl);
  const read = (key: string) => page.searchParams.get(key)?.trim().slice(0, 200) || undefined;
  let referrerHost: string | undefined;
  try { const host = new URL(referrer).hostname; if (host !== page.hostname) referrerHost = host.slice(0, 200); } catch { /* direct visit */ }
  return { utmSource: read('utm_source'), utmMedium: read('utm_medium'), utmCampaign: read('utm_campaign'),
    utmContent: read('utm_content'), referrerHost, landingPath: page.pathname.slice(0, 500) };
}
export function intakeLabel(options: readonly (readonly [string, string])[], code?: string) {
  return options.find(([value]) => value === code)?.[1] || code || 'غير محدد';
}
