import { getCountries, getCountryCallingCode } from 'libphonenumber-js';

export const REFERRAL_SOURCES = ['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'GOOGLE', 'WHATSAPP', 'FRIEND', 'LINKEDIN', 'YOUTUBE', 'OTHER', 'UNKNOWN'] as const;
const labels: Record<string, string> = {
  FACEBOOK: 'فيسبوك', INSTAGRAM: 'إنستجرام', TIKTOK: 'تيك توك', GOOGLE: 'جوجل',
  WHATSAPP: 'واتساب', FRIEND: 'ترشيح من شخص', LINKEDIN: 'لينكدإن', YOUTUBE: 'يوتيوب', OTHER: 'مصدر آخر'
};
export function referralLabel(source?: string): string | undefined { return source ? labels[source] : undefined; }

const countryNames = new Intl.DisplayNames(['ar'], { type: 'region' });
const preferred = ['EG', 'SA', 'AE', 'KW', 'QA', 'JO', 'OM', 'BH'];
export const phoneCountries = getCountries().map(code => ({
  code, name: countryNames.of(code) || code, callingCode: `+${getCountryCallingCode(code)}`
})).sort((a, b) => {
  const aOrder = preferred.indexOf(a.code), bOrder = preferred.indexOf(b.code);
  if (aOrder >= 0 || bOrder >= 0) return (aOrder < 0 ? 999 : aOrder) - (bOrder < 0 ? 999 : bOrder);
  return a.name.localeCompare(b.name, 'ar');
});
