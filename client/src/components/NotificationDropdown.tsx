import { useSSE } from '../hooks/useSSE';
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Bell,
  CheckCheck,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Users,
  ArrowRightLeft,
  X,
  ShieldAlert,
  Layers,
  Inbox
} from 'lucide-react';
import { toast } from 'sonner';

export interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  leadId?: {
    leadCode?: string;
    customerName?: string;
  };
}

interface NotificationDropdownProps {
  user: any;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  useSSE(token);

  // جلب الإشعارات من الـ API
  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await axios.get('/api/notifications', { headers });
      if (res.data.success) {
        setNotifications(res.data.data.notifications || []);
        setUnreadCount(res.data.data.unreadCount || 0);
      }
    } catch { toast.error('تعذر جلب الإشعارات.'); }
  };

  useEffect(() => {
    fetchNotifications();
    const refresh = () => { void fetchNotifications(); };
    window.addEventListener('crm-notification', refresh);

    // إغلاق القائمة عند النقر خارجها
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => { document.removeEventListener('mousedown', handleClickOutside); window.removeEventListener('crm-notification', refresh); };
  }, []);

  // تمييز إشعار واحد كمقروء
  const handleMarkAsRead = async (id: string) => {
    try {
      await axios.patch(`/api/notifications/${id}/read`, {}, { headers });
    } catch {
      toast.error('تعذر تحديث الإشعار.'); return;
    }
    setNotifications(prev =>
      prev.map(n => n._id === id ? { ...n, isRead: true } : n)
    );
    if (notifications.some(n => n._id === id && !n.isRead)) setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // تمييز الكل كمقروء
  const handleMarkAllRead = async () => {
    try {
      await axios.patch('/api/notifications/read-all', {}, { headers });
      toast.success('تم تعليم جميع الإشعارات كمقروءة.');
    } catch {
      toast.error('تعذر تحديث الإشعار.'); return;
    }
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  // اختيار الأيقونة المناسبة لنوع الإشعار
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'NEW_LEAD_ASSIGNED':
        return <Sparkles className="w-4 h-4 text-aethra-ink" />;
      case 'UNASSIGNED_LEAD_ALERT':
        return <AlertTriangle className="w-4 h-4 text-amber-800" />;
      case 'TECHNICAL_INTAKE_COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-[#137A45]" />;
      case 'LEAD_REASSIGNED':
        return <ArrowRightLeft className="w-4 h-4 text-indigo-600" />;
      default:
        return <Bell className="w-4 h-4 text-aethra-ink" />;
    }
  };

  // تنسيق الوقت النسبي
  const formatTimeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    return `منذ ${Math.floor(diffHours / 24)} يوم`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* زر الجرس مع شارة الإشعارات غير المقروءة */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-11 h-11 flex items-center justify-center rounded-xl bg-aethra-paper hover:bg-aethra-cyan text-aethra-ink border border-surface-border transition-colors cursor-pointer active:scale-95 shadow-none"
        title="التنبيهات والإشعارات"
      >
        <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-aethra-ink" />

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-aethra-ink text-aethra-cyan border-2 border-white text-[10px] font-semibold rounded-full flex items-center justify-center animate-pulse shadow-none">
            {unreadCount > 9 ? '+9' : unreadCount}
          </span>
        )}
      </button>

      {/* القائمة المنبثقة الفاخرة */}
      {isOpen && (
        <div className="fixed top-[76px] left-3 right-3 sm:left-6 sm:right-auto w-auto sm:w-96 max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-88px)] bg-white border border-surface-border rounded-xl shadow-none z-50 overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="p-4 bg-aethra-paper border-b border-surface-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-aethra-cyan flex items-center justify-center text-aethra-ink font-bold">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-aethra-ink">التنبيهات والإشعارات</h4>
                <p className="text-[10px] text-surface-muted">
                  {unreadCount > 0 ? `${unreadCount} تنبيهات غير مقروءة` : 'كافة الإشعارات مقروءة'}
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] font-bold text-aethra-ink hover:text-black bg-white hover:bg-aethra-cyan px-2.5 py-1 rounded-lg border border-surface-border transition cursor-pointer shadow-none"
                title="تعليم الكل كمقروء"
              >
                <CheckCheck className="w-3 h-3" />
                <span>تعليم الكل</span>
              </button>
            )}
          </div>

          {/* List of Notifications */}
          <div className="max-h-80 overflow-y-auto divide-y divide-surface-border scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-surface-muted space-y-2">
                <Inbox className="w-8 h-8 mx-auto text-surface-muted/50" />
                <p className="font-bold text-aethra-ink">لا توجد إشعارات حالياً</p>
                <p className="text-[11px] text-surface-muted">سيتم إشعارك فور وصول عملاء جدد أو تحديث الحالات.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => handleMarkAsRead(n._id)}
                  className={`p-3.5 flex items-start gap-3 transition cursor-pointer hover:bg-aethra-paper ${
                    !n.isRead ? 'bg-[#FFFDF0]' : 'bg-white'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                    !n.isRead ? 'bg-aethra-cyan border-[#1396AF]' : 'bg-aethra-paper border-surface-border'
                  }`}>
                    {getNotificationIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className={`text-xs truncate ${!n.isRead ? 'font-semibold text-aethra-ink' : 'font-bold text-stone-700'}`}>
                        {n.title}
                      </h5>
                      <span className="text-[10px] text-surface-muted whitespace-nowrap font-mono flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTimeAgo(n.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-surface-muted mt-1 leading-relaxed line-clamp-2">
                      {n.message}
                    </p>

                    {n.leadId?.leadCode && (
                      <span className="inline-block mt-1 font-mono text-[10px] font-bold text-aethra-ink bg-aethra-paper border border-surface-border px-1.5 py-0.5 rounded">
                        {n.leadId.leadCode}
                      </span>
                    )}
                  </div>

                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-aethra-cyan border border-[#1396AF] flex-shrink-0 mt-1.5"></span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-aethra-paper border-t border-surface-border text-center text-[10px] text-surface-muted flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#137A45] animate-ping"></span>
            <span>نظام البث الحي اللحظي (SSE) مفعّل</span>
          </div>
        </div>
      )}
    </div>
  );
};

