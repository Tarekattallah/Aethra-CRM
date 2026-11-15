import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

/**
 * خريطة أسماء الدول العربية الشائعة إلى أكواد ISO 3166-1 alpha-2
 */
const COUNTRY_CODE_MAP: Record<string, CountryCode> = {
  'مصر': 'EG',
  'egypt': 'EG',
  'السعودية': 'SA',
  'المملكة العربية السعودية': 'SA',
  'saudi arabia': 'SA',
  'الإمارات': 'AE',
  'الإمارات العربية المتحدة': 'AE',
  'uae': 'AE',
  'الكويت': 'KW',
  'kuwait': 'KW',
  'قطر': 'QA',
  'qatar': 'QA',
  'عمان': 'OM',
  'سلطنة عمان': 'OM',
  'oman': 'OM',
  'البحرين': 'BH',
  'bahrain': 'BH',
  'الأردن': 'JO',
  'jordan': 'JO',
  'العراق': 'IQ',
  'iraq': 'IQ'
};

/**
 * دالة تطبيع رقم الهاتف وتحويله للصيغة الدولية القياسية E.164
 * e.g. "01012345678" مع دولة "مصر" -> "+201012345678"
 */
export function normalizePhoneNumber(rawPhone: string, countryInput?: string): string {
  if (!rawPhone) return '';

  const cleaned = rawPhone.trim().replace(/[٠-٩۰-۹]/g, c => String(c.charCodeAt(0) - (c <= '٩' ? 0x660 : 0x6f0))).replace(/^00/, '+');
  let defaultCountry: CountryCode = 'EG'; // الافتراضي مصر

  if (countryInput) {
    const normalizedCountry = countryInput.trim().toLowerCase();
    if (COUNTRY_CODE_MAP[normalizedCountry]) {
      defaultCountry = COUNTRY_CODE_MAP[normalizedCountry];
    } else if (countryInput.length === 2) {
      defaultCountry = countryInput.toUpperCase() as CountryCode;
    }
  }

  try {
    const phoneNumber = parsePhoneNumberFromString(cleaned, defaultCountry);
    if (phoneNumber && phoneNumber.isValid()) {
      return phoneNumber.format('E.164');
    }
  } catch (err) {
    // تجاهل والرجوع للحل الاحتياطي
  }

  return '';
}

