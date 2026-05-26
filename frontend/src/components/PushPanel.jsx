import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Bell, Send, Loader2, CheckCircle2, AlertTriangle, Smartphone, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { initPush, sendTestPush, fetchPushStatus, unsubscribePush } from '../lib/firebase';

/**
 * Settings → Push bildirişləri paneli.
 * - Browser permission statusu
 * - Bu cihazda push aktivləşdir/söndür
 * - Test push göndər
 * - Qeydiyyatda olan cihazların siyahısı
 */
export default function PushPanel() {
  const [permission, setPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default');
  const [enabling, setEnabling] = useState(false);
  const [testing, setTesting] = useState(false);
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const refreshDevices = useCallback(async () => {
    setLoadingDevices(true);
    try {
      const r = await fetchPushStatus();
      setDevices(r.devices || []);
    } catch (_) { /* ignore */ }
    finally { setLoadingDevices(false); }
  }, []);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  const enable = async () => {
    setEnabling(true);
    try {
      const r = await initPush();
      if (r.ok) {
        toast.success('Push bildirişləri aktivləşdirildi');
        setPermission('granted');
        refreshDevices();
      } else if (r.reason?.startsWith('permission_')) {
        const state = r.reason.replace('permission_', '');
        setPermission(state);
        if (state === 'denied') {
          toast.error('İcazə rədd edildi. Brauzerin sayt parametrlərində bildiriş icazəsini aktiv edin.');
        } else {
          toast.warning('İcazə verilmədi');
        }
      } else if (r.reason === 'no_vapid_key') {
        toast.error('VAPID açarı konfiqurasiya olunmayıb. Server adminə müraciət edin.');
      } else if (r.reason === 'unsupported') {
        toast.error('Bu brauzer Push bildirişlərini dəstəkləmir');
      } else {
        toast.error('Push aktivləşdirmək alınmadı: ' + (r.reason || 'naməlum xəta'));
      }
    } catch (err) {
      toast.error('Xəta: ' + (err.message || 'naməlum'));
    } finally {
      setEnabling(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const r = await sendTestPush();
      const res = r.result || {};
      if (res.skipped) {
        toast.error('FCM serverdə konfiqurasiya olunmayıb (Firebase Admin SDK)');
      } else if (res.no_tokens || res.no_recipients) {
        toast.warning('Bu istifadəçi üçün cihaz qeydiyyatda yoxdur. Əvvəlcə push aktivləşdirin.');
      } else if (res.success > 0) {
        toast.success(`Test push ${res.success} cihaza göndərildi`);
      } else {
        toast.error(`Push göndərilmədi (uğursuz: ${res.failure || 0})`);
      }
    } catch (err) {
      toast.error('Test push uğursuz: ' + (err.message || 'naməlum'));
    } finally {
      setTesting(false);
    }
  };

  const disable = async ({ all = false } = {}) => {
    if (!confirm(all ? 'Bütün cihazlarda push söndürülsün?' : 'Bu cihazda push söndürülsün?')) return;
    await unsubscribePush({ allDevices: all });
    toast.success('Push söndürüldü');
    refreshDevices();
  };

  const statusBadge = () => {
    if (permission === 'granted') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium"><CheckCircle2 className="w-3 h-3" />İcazə verildi</span>;
    if (permission === 'denied') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium"><AlertTriangle className="w-3 h-3" />İcazə rədd edilib</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium"><Bell className="w-3 h-3" />Hələ icazə alınmayıb</span>;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6" data-testid="push-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#3D4F6F]" />
          <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Push bildirişləri</h2>
        </div>
        {statusBadge()}
      </div>

      <div className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
          <p className="text-sm text-slate-700 mb-3">
            Push bildirişləri Firebase Cloud Messaging (FCM) vasitəsilə göndərilir. Bildiriş aşağıdakı hadisələrdə avtomatik gəlir:
          </p>
          <ul className="text-xs text-slate-600 space-y-1 ml-4 list-disc">
            <li>Yeni tapşırıq sizə təyin olunduqda və ya yeniləndikdə</li>
            <li>Tapşırığa şərh əlavə edildikdə</li>
            <li>Yeni mesaj qəbul etdikdə</li>
            <li>Görüş təklifi alındıqda / cavablandırıldıqda</li>
            <li>Qeyd sizinlə paylaşıldıqda</li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          {permission !== 'granted' ? (
            <Button onClick={enable} disabled={enabling} className="bg-[#9ACD32] hover:bg-[#8BC34A] text-[#3D4F6F]" data-testid="push-enable-btn">
              {enabling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bell className="w-4 h-4 mr-2" />}
              {permission === 'denied' ? 'İcazəni brauzer parametrlərindən aktiv edin' : 'Bu cihazda aktivləşdir'}
            </Button>
          ) : (
            <>
              <Button onClick={sendTest} disabled={testing} variant="outline" className="border-[#3D4F6F] text-[#3D4F6F]" data-testid="push-test-btn">
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Test push göndər
              </Button>
              <Button onClick={() => disable({ all: false })} variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" data-testid="push-disable-this-btn">
                <Trash2 className="w-4 h-4 mr-2" />Bu cihazda söndür
              </Button>
              {devices.length > 1 && (
                <Button onClick={() => disable({ all: true })} variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" data-testid="push-disable-all-btn">
                  <Trash2 className="w-4 h-4 mr-2" />Bütün cihazlarda söndür ({devices.length})
                </Button>
              )}
            </>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">Qeydiyyatda olan cihazlar</p>
            <span className="text-xs text-slate-400">{devices.length} cihaz</span>
          </div>
          {loadingDevices ? (
            <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
          ) : devices.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Hələ qeydiyyatdan keçmiş cihaz yoxdur</p>
          ) : (
            <div className="space-y-2">
              {devices.map((d, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100" data-testid={`push-device-${i}`}>
                  <Smartphone className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{d.platform || 'web'}</p>
                    <p className="text-[10px] text-slate-400">Son istifadə: {d.last_used_at ? new Date(d.last_used_at).toLocaleString('az-AZ') : '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
