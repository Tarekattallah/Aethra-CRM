import { LeadStatus } from '../models/Lead.js';

/**
 * مصفوفة التحقق من صحة انتقال الحالات البيعية
 */
const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  [LeadStatus.NEW]: [
    LeadStatus.CONTACTED,
    LeadStatus.LOST
  ],
  [LeadStatus.CONTACTED]: [
    LeadStatus.QUALIFIED,
    LeadStatus.FOLLOW_UP,
    LeadStatus.LOST
  ],
  [LeadStatus.FOLLOW_UP]: [
    LeadStatus.CONTACTED,
    LeadStatus.QUALIFIED,
    LeadStatus.LOST
  ],
  [LeadStatus.QUALIFIED]: [
    LeadStatus.QUOTATION_SENT,
    LeadStatus.LOST,
    LeadStatus.ON_HOLD
  ],
  [LeadStatus.QUOTATION_SENT]: [
    LeadStatus.NEGOTIATION,
    LeadStatus.LOST,
    LeadStatus.ON_HOLD
  ],
  [LeadStatus.NEGOTIATION]: [
    LeadStatus.CONVERTED,
    LeadStatus.LOST,
    LeadStatus.ON_HOLD
  ],
  [LeadStatus.ON_HOLD]: [
    LeadStatus.NEGOTIATION,
    LeadStatus.CONTACTED,
    LeadStatus.LOST
  ],
  [LeadStatus.CONVERTED]: [], // حالة نهائية ناجحة (لا يمكن التعديل بعدها إلا بتدخل الأدمن)
  [LeadStatus.LOST]: [LeadStatus.CONTACTED] // إعادة إحياء الصفقة
};

export function validateStatusTransition(
  currentStatus: LeadStatus,
  targetStatus: LeadStatus,
  isAdmin: boolean = false
): { valid: boolean; message?: string } {
  if (!Object.values(LeadStatus).includes(targetStatus)) return { valid: false, message: 'حالة العميل غير صالحة.' };
  // الأدمن يمتلك صلاحية التدخل وتعديل أي حالة
  if (isAdmin) {
    return { valid: true };
  }

  if (currentStatus === targetStatus) {
    return { valid: true };
  }

  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      valid: false,
      message: `لا يمكن نقل العميل مباشرة من حالة [${currentStatus}] إلى حالة [${targetStatus}]. يجب اتباع مسار المتابعة المعتمد.`
    };
  }

  return { valid: true };
}

