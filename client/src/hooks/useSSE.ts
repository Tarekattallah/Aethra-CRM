import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

// نغمة تنبيه لطيفة باستخدام Web Audio API دون الحاجة لملفات mp3 خارجية
function playNotificationChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => { void ctx.close(); };
  } catch (err) {
    // تجاهل في حال منع المتصفح للصوت قبل تفاعل المستخدم
  }
}

export function useSSE(token: string | null, onNewLead?: (lead: any) => void) {
  const callbackRef = useRef(onNewLead);
  callbackRef.current = onNewLead;
  useEffect(() => {
    if (!token) return;

    const eventSource = new EventSource('/api/notifications/stream');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'CONNECTED') {
          window.dispatchEvent(new Event('crm-notification'));
          window.dispatchEvent(new Event('crm-lead-updated'));
        }
        if (data.type === 'LEAD_UPDATED') { callbackRef.current?.(data.lead); return; }

        if (data.type === 'NEW_LEAD_ASSIGNED') {
          playNotificationChime();
          toast.success(data.title || 'تم إسناد عميل جديد إليك!', {
            description: data.message || `العميل: ${data.lead?.customerName} (${data.lead?.leadCode})`,
            duration: 8000
          });
          callbackRef.current?.(data.lead);
        } else if (data.type === 'DUPLICATE_CUSTOMER_RETURNED') {
          playNotificationChime();
          toast.warning(data.title || 'تنبيه: عميل مكرر عاد من جديد!', {
            description: data.message,
            duration: 8000
          });
          callbackRef.current?.(data.lead);
        } else if (data.type === 'LEAD_REASSIGNED') {
          playNotificationChime();
          toast.info(data.title, { description: data.message });
          callbackRef.current?.(data.lead);
        }
      } catch (err) {
        // رسائل غير json مثل keepalive
      }
    };

    eventSource.onerror = () => {
      // يحاول EventSource إعادة الاتصال تلقائياً
    };

    return () => {
      eventSource.close();
    };
  }, [token]);
}

