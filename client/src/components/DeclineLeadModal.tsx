import React, { useState } from 'react';
import axios from 'axios';
import { AlertCircle, X, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';

interface DeclineLeadModalProps {
  lead: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (leadId: string) => void;
}

export const DeclineLeadModal: React.FC<DeclineLeadModalProps> = ({
  lead,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !lead) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('يرجى توضيح سبب الاعتذار عن استلام العميل.');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`/api/leads/${lead._id}/decline`, { reason }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        toast.success('تم تسجيل الاعتذار ونقل العميل فوراً للمهندس التالي المتاح.');
        onSuccess(lead._id);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل تسجيل الاعتذار.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-surface-border rounded-xl max-w-lg w-full p-6 sm:p-7 shadow-none relative">
        <button
          onClick={onClose}
          className="absolute top-5 left-5 text-surface-muted hover:text-aethra-ink p-1.5 rounded-xl hover:bg-stone-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-aethra-cyan border border-[#1396AF] text-aethra-ink">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-aethra-ink">الاعتذار عن استلام العميل</h3>
            <p className="text-xs text-surface-muted">سيتم نقل العميل تلقائياً للمهندس التالي في طابور التوزيع</p>
          </div>
        </div>

        <div className="bg-aethra-paper border border-surface-border rounded-xl p-4 mb-4 text-xs space-y-1.5">
          <p className="flex justify-between">
            <span className="text-surface-muted">اسم العميل:</span>
            <span className="font-semibold text-aethra-ink">{lead.customerName} ({lead.leadCode})</span>
          </p>
          <p className="flex justify-between">
            <span className="text-surface-muted">الخدمة المطلوبة:</span>
            <span className="font-bold text-aethra-ink">{lead.currentServiceId?.name || lead.initialServiceId?.name || 'استشارة'}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-aethra-ink mb-1.5">سبب الاعتذار والملاحظة الإدارية *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثلاً: انشغال بتسليم مشروع قائم حالياً، أو تخصص العميل يناسب زميلاً آخر..."
              rows={3}
              className="w-full bg-aethra-paper border border-surface-border rounded-xl p-3 text-xs text-aethra-ink focus:border-aethra-ink focus:bg-white focus:outline-none transition leading-relaxed"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-aethra-paper hover:bg-stone-100 text-surface-muted hover:text-aethra-ink text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-aethra-ink hover:bg-black text-aethra-cyan text-xs font-semibold transition flex items-center gap-2 shadow-none cursor-pointer"
            >
              {submitting ? 'جاري التحويل...' : 'تأكيد ونقل العميل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
