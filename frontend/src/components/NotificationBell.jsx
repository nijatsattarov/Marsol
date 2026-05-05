import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Bell, AlertTriangle, Clock, CreditCard, X, CalendarClock, CheckCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], count: 0, high_count: 0, total_count: 0 });
  const [busy, setBusy] = useState(false);

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const res = await axios.get(`${API}/notifications`, { headers });
      setData(res.data);
      // Fire-and-forget email dispatch for new notifications
      axios.post(`${API}/notifications/dispatch-emails`, {}, { headers }).catch(() => {});
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markRead = async (ids) => {
    if (busy || !ids?.length) return;
    setBusy(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    // Optimistic local update
    setData(prev => {
      const idSet = new Set(ids);
      const updated = prev.notifications.map(n => idSet.has(n.id) ? { ...n, read: true } : n);
      const unread = updated.filter(n => !n.read);
      return { ...prev, notifications: updated, count: unread.length, high_count: unread.filter(n => n.severity === 'high').length };
    });
    try { await axios.post(`${API}/notifications/mark-read`, { ids }, { headers }); }
    catch { fetchNotifications(); }
    finally { setBusy(false); }
  };

  const markAllRead = async () => {
    if (busy) return;
    setBusy(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    setData(prev => ({ ...prev, notifications: prev.notifications.map(n => ({ ...n, read: true })), count: 0, high_count: 0 }));
    try { await axios.post(`${API}/notifications/mark-all-read`, {}, { headers }); }
    catch { fetchNotifications(); }
    finally { setBusy(false); }
  };

  const getSeverityIcon = (type, severity) => {
    if (type === 'reminder') return <CalendarClock className="w-4 h-4 text-purple-500 flex-shrink-0" />;
    if (severity === 'high') return <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />;
    if (severity === 'medium') return <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />;
    return <CreditCard className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  };

  const getSeverityBg = (type, severity, read) => {
    if (read) return 'bg-white border-slate-100 opacity-60';
    if (type === 'reminder') return 'bg-purple-50 border-purple-100';
    if (severity === 'high') return 'bg-red-50 border-red-100';
    if (severity === 'medium') return 'bg-amber-50 border-amber-100';
    return 'bg-blue-50 border-blue-100';
  };

  const getTypeLabel = (type) => {
    const map = {
      debt_overdue: 'Gecikmiş ödəniş',
      debt_pending: 'Ödənilməmiş borc',
      contract_expired: 'Müqavilə bitib',
      contract_expiring: 'Müqavilə bitir',
      reminder: 'Görüş xatırlatması',
      membership_expiry: 'Üzvlük bitir',
      membership_expired: 'Üzvlük bitib',
      birthday: 'Ad günü',
    };
    return map[type] || type;
  };

  return (
    <div className="relative" data-testid="notification-bell">
      <Button
        variant="ghost" size="sm"
        onClick={() => setOpen(!open)}
        className="relative"
        data-testid="notification-bell-btn"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {data.count > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center" data-testid="notification-count">
            {data.count > 99 ? '99+' : data.count}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 w-[min(92vw,360px)] max-h-[70vh] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col" data-testid="notification-dropdown">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-[#3D4F6F]">Bildirişlər</h3>
                {data.high_count > 0 && (
                  <Badge className="bg-red-500 text-white text-[10px]">{data.high_count} təcili</Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {data.count > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    disabled={busy}
                    className="text-xs text-[#3D4F6F] hover:text-[#9ACD32] flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-50 disabled:opacity-40"
                    data-testid="mark-all-read-btn"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />Hamısını oxu
                  </button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}><X className="w-4 h-4" /></Button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {data.notifications.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Bildiriş yoxdur</p>
                </div>
              ) : (
                data.notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markRead([n.id])}
                    className={`p-3 border-b ${getSeverityBg(n.type, n.severity, n.read)} hover:brightness-95 transition-all ${!n.read ? 'cursor-pointer' : ''}`}
                    data-testid={`notification-${n.id}`}
                  >
                    <div className="flex gap-3">
                      {getSeverityIcon(n.type, n.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-medium text-xs ${n.read ? 'text-slate-500' : 'text-slate-700'}`}>{n.title}</p>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-[#9ACD32] mt-1 shrink-0" title="Oxunmamış" />}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`text-[10px] ${n.type === 'reminder' ? 'bg-purple-100 text-purple-700' : n.severity === 'high' ? 'bg-red-100 text-red-700' : n.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {getTypeLabel(n.type)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-2 bg-slate-50 border-t text-center text-xs text-slate-500">
              {data.count > 0 ? `${data.count} oxunmamış` : 'Bütün bildirişlər oxundu'}
              {data.total_count > 0 && ` · cəmi ${data.total_count}`}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
