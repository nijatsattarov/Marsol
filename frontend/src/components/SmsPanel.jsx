import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader2, Send, RefreshCw, MessageSquare, Save, Phone, AlertCircle, CheckCircle2, History } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SmsPanel() {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, today: 0, by_category: {} });
  const [templates, setTemplates] = useState({ event_reminder: '', birthday: '' });
  const [tplDirty, setTplDirty] = useState({ event_reminder: false, birthday: false });
  const [tplSaving, setTplSaving] = useState(false);

  const [testForm, setTestForm] = useState({ phone: '', text: '' });
  const [testSending, setTestSending] = useState(false);

  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('all');
  const [logsLoading, setLogsLoading] = useState(false);

  const [dispatchLoading, setDispatchLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const r = await axios.get(`${API}/sms/balance`, { headers });
      setBalance(r.data);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) setBalance({ ok: false, error_message: 'SMS modulu üçün admin icazəsi tələb olunur' });
      else setBalance({ ok: false, error_message: 'Bağlantı xətası' });
    }
    finally { setBalanceLoading(false); }
  }, []); // eslint-disable-line

  const fetchStats = useCallback(async () => {
    try { const r = await axios.get(`${API}/sms/logs/stats`, { headers }); setStats(r.data); }
    catch { /* noop */ }
  }, []); // eslint-disable-line

  const fetchTemplates = useCallback(async () => {
    try { const r = await axios.get(`${API}/sms/templates`, { headers });
      setTemplates(r.data); setTplDirty({ event_reminder: false, birthday: false }); }
    catch { /* noop */ }
  }, []); // eslint-disable-line

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = logFilter === 'all' ? {} : { category: logFilter };
      const r = await axios.get(`${API}/sms/logs`, { headers, params });
      setLogs(r.data.items || []);
    } catch { setLogs([]); }
    finally { setLogsLoading(false); }
  }, [logFilter]); // eslint-disable-line

  useEffect(() => { fetchBalance(); fetchStats(); fetchTemplates(); }, [fetchBalance, fetchStats, fetchTemplates]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const saveTemplate = async (key) => {
    setTplSaving(true);
    try {
      await axios.put(`${API}/sms/templates/${key}`, { text: templates[key] }, { headers });
      toast.success('Şablon yadda saxlanıldı');
      setTplDirty(d => ({ ...d, [key]: false }));
    } catch (e) { toast.error(e?.response?.data?.detail || 'Xəta'); }
    finally { setTplSaving(false); }
  };

  const sendTest = async () => {
    if (!testForm.phone || !testForm.text) {
      toast.error('Telefon və mətn tələb olunur'); return;
    }
    setTestSending(true);
    try {
      const r = await axios.post(`${API}/sms/send`, testForm, { headers });
      if (r.data.ok) toast.success(`Göndərildi (transid: ${r.data.transid})`);
      else toast.error(r.data.error_message || 'Xəta');
      fetchStats(); fetchLogs(); fetchBalance();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Xəta'); }
    finally { setTestSending(false); }
  };

  const dispatchDaily = async () => {
    setDispatchLoading(true);
    try {
      const r = await axios.post(`${API}/sms/dispatch-daily`, {}, { headers });
      const d = r.data;
      toast.success(`Göndərildi: tədbir ${d.event_reminders_sent}, doğum günü ${d.birthday_sent}, atlanan ${d.skipped}, xəta ${d.failed}`);
      fetchStats(); fetchLogs(); fetchBalance();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Xəta'); }
    finally { setDispatchLoading(false); }
  };

  const fmtDate = (iso) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('az-AZ'); } catch { return iso; }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6 space-y-6" data-testid="sms-panel">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#3D4F6F' }}>
            <MessageSquare className="w-5 h-5" /> SMS (LSIM Quick SMS)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Tədbir xatırlatmaları, doğum günü təbrikləri və toplu SMS</p>
        </div>
        <Button onClick={fetchBalance} variant="outline" size="sm" disabled={balanceLoading} data-testid="sms-refresh-balance">
          <RefreshCw className={`w-4 h-4 mr-1 ${balanceLoading ? 'animate-spin' : ''}`} /> Balansı yenilə
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Balans" value={balance?.balance ?? '—'} suffix="SMS" highlight />
        <StatCard label="Bu gün göndərilən" value={stats.today} />
        <StatCard label="Cəmi göndərilən" value={stats.sent} />
        <StatCard label="Uğursuz" value={stats.failed} tone="red" />
        <StatCard label="Tədbir + Doğum günü" value={(stats.by_category?.event_reminder || 0) + (stats.by_category?.birthday || 0)} />
      </div>

      {balance && !balance.ok && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
          <AlertCircle className="w-4 h-4" /> LSIM xəta: {balance.error_message}
        </div>
      )}

      {/* Templates */}
      <div className="border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#3D4F6F] mb-3">SMS şablonları</h3>
        <p className="text-[11px] text-slate-500 mb-3">
          Yer tutucular: <code className="bg-slate-100 px-1 rounded">{`{name}`}</code>{' '}
          <code className="bg-slate-100 px-1 rounded">{`{event_name}`}</code>{' '}
          <code className="bg-slate-100 px-1 rounded">{`{date}`}</code>{' '}
          <code className="bg-slate-100 px-1 rounded">{`{time}`}</code>{' '}
          <code className="bg-slate-100 px-1 rounded">{`{venue}`}</code>{' '}
          <code className="bg-slate-100 px-1 rounded">{`{company}`}</code>
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { key: 'event_reminder', label: 'Tədbir xatırlatması (1 gün öncə)' },
            { key: 'birthday', label: 'Doğum günü təbriki' },
          ].map(({ key, label }) => (
            <div key={key}>
              <Label className="text-xs">{label}</Label>
              <textarea
                className="w-full text-sm border border-slate-200 rounded-lg p-2 mt-1 font-mono min-h-[80px]"
                value={templates[key] || ''}
                onChange={(e) => { setTemplates(t => ({ ...t, [key]: e.target.value })); setTplDirty(d => ({ ...d, [key]: true })); }}
                data-testid={`sms-template-${key}`}
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-[10px] text-slate-400">{(templates[key] || '').length} simvol</span>
                <Button size="sm" onClick={() => saveTemplate(key)} disabled={!tplDirty[key] || tplSaving}
                        className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] h-7 text-xs">
                  {tplSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Save className="w-3 h-3 mr-1" />Yadda saxla</>}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily dispatch */}
      <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-amber-900">Avtomatik gündəlik göndərmə</h3>
          <p className="text-[11px] text-amber-800 mt-0.5">Sabahkı tədbirlərə dəvətlilərə xatırlatma + bu günkü doğum günləri (idempotent)</p>
        </div>
        <Button onClick={dispatchDaily} disabled={dispatchLoading} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="sms-dispatch-daily-btn">
          {dispatchLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
          İndi işə sal
        </Button>
      </div>

      {/* Manual test */}
      <div className="border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#3D4F6F] mb-3 flex items-center gap-2"><Phone className="w-4 h-4" /> Test göndərmə</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Telefon</Label>
            <Input value={testForm.phone} onChange={(e) => setTestForm({ ...testForm, phone: e.target.value })}
                   placeholder="+994501234567" className="text-sm mt-1" data-testid="sms-test-phone" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Mətn</Label>
            <Input value={testForm.text} onChange={(e) => setTestForm({ ...testForm, text: e.target.value })}
                   placeholder="Test SMS" className="text-sm mt-1" data-testid="sms-test-text" />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={sendTest} disabled={testSending} className="bg-[#3D4F6F] text-white hover:bg-[#2d3e5f]" data-testid="sms-test-send-btn">
            {testSending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            Göndər
          </Button>
        </div>
      </div>

      {/* Logs */}
      <div className="border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h3 className="text-sm font-semibold text-[#3D4F6F] flex items-center gap-2"><History className="w-4 h-4" /> SMS Tarixçəsi</h3>
          <div className="flex items-center gap-2">
            <Select value={logFilter} onValueChange={setLogFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs" data-testid="sms-log-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hamısı</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="bulk">Toplu</SelectItem>
                <SelectItem value="event_reminder">Tədbir xatırlatması</SelectItem>
                <SelectItem value="birthday">Doğum günü</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={fetchLogs} disabled={logsLoading} className="h-8 text-xs">
              <RefreshCw className={`w-3 h-3 mr-1 ${logsLoading ? 'animate-spin' : ''}`} /> Yenilə
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Tarix</th>
                <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Kateqoriya</th>
                <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Alıcı</th>
                <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Telefon</th>
                <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Mətn</th>
                <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Hələ heç bir SMS göndərilməyib</td></tr>
              ) : logs.map(l => (
                <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-2 py-2 text-slate-500 whitespace-nowrap">{fmtDate(l.created_at)}</td>
                  <td className="px-2 py-2"><Badge className="bg-slate-100 text-slate-700 text-[10px] capitalize">{l.category}</Badge></td>
                  <td className="px-2 py-2 text-slate-700">{l.recipient_name || '—'}</td>
                  <td className="px-2 py-2 font-mono text-slate-500">{l.msisdn || l.phone}</td>
                  <td className="px-2 py-2 max-w-[300px] truncate text-slate-600" title={l.text}>{l.text}</td>
                  <td className="px-2 py-2">
                    {l.status === 'sent' ? (
                      <Badge className="bg-green-100 text-green-700 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" />Göndərildi</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 text-[10px]" title={l.error_message || ''}><AlertCircle className="w-3 h-3 mr-1" />Xəta</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, suffix, highlight, tone }) {
  const toneClass = tone === 'red' ? 'text-red-600' : highlight ? 'text-[#9ACD32]' : 'text-[#3D4F6F]';
  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}{suffix && <span className="text-xs ml-1 text-slate-400">{suffix}</span>}</p>
    </div>
  );
}
