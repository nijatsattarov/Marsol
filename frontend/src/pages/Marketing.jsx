import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Loader2, Mail, RefreshCw, Send, Users, BarChart3,
  Plus, MessageSquare, Eye, MousePointerClick, AlertCircle, CheckCircle2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Toaster, toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Marketing() {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [ping, setPing] = useState(null);
  const [audiences, setAudiences] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ audience_id: '', subject: '', preview_text: '', from_name: 'Marsol Group', reply_to: 'info@marsol.az', html: '', send_now: false });

  const [showSync, setShowSync] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncAudienceId, setSyncAudienceId] = useState('');

  const [reportOpen, setReportOpen] = useState(null);
  const [report, setReport] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a, c] = await Promise.all([
        axios.get(`${API}/marketing/mailchimp/ping`, { headers }).catch(() => ({ data: { ok: false } })),
        axios.get(`${API}/marketing/mailchimp/audiences`, { headers }).catch(() => ({ data: { audiences: [] } })),
        axios.get(`${API}/marketing/mailchimp/campaigns`, { headers }).catch(() => ({ data: { campaigns: [] } })),
      ]);
      setPing(p.data); setAudiences(a.data.audiences || []); setCampaigns(c.data.campaigns || []);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async () => {
    if (!form.audience_id || !form.subject || !form.html) { toast.error('Auditoriya, mövzu və məzmun tələb olunur'); return; }
    setCreating(true);
    try {
      await axios.post(`${API}/marketing/mailchimp/campaigns`, form, { headers });
      toast.success(form.send_now ? 'Kampaniya göndərildi' : 'Kampaniya yadda saxlandı');
      setShowCreate(false);
      setForm({ audience_id: '', subject: '', preview_text: '', from_name: 'Marsol Group', reply_to: 'info@marsol.az', html: '', send_now: false });
      fetchAll();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Xəta'); }
    finally { setCreating(false); }
  };

  const handleSync = async () => {
    if (!syncAudienceId) { toast.error('Auditoriya seçin'); return; }
    setSyncing(true); setSyncResult(null);
    try {
      const r = await axios.post(`${API}/marketing/mailchimp/audiences/${syncAudienceId}/sync-companies`, {}, { headers });
      setSyncResult(r.data); toast.success(`${r.data.synced} şirkət sinxronlaşdırıldı`);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Xəta'); }
    finally { setSyncing(false); }
  };

  const openReport = async (campaign) => {
    setReportOpen(campaign); setReport(null);
    try {
      const r = await axios.get(`${API}/marketing/mailchimp/campaigns/${campaign.id}/report`, { headers });
      setReport(r.data);
    } catch { toast.error('Hesabat yüklənə bilmədi'); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="marketing-page">
      <Toaster position="top-right" richColors />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#3D4F6F]">Marketinq</h1>
          <p className="text-sm text-slate-500 mt-1">Email kampaniyaları və auditoriya idarəetməsi (Mailchimp)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}><RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Yenilə</Button>
          <Button size="sm" variant="outline" onClick={() => setShowSync(true)} data-testid="sync-btn"><Users className="w-4 h-4 mr-1" /> Şirkətləri sinxronlaşdır</Button>
          <Button size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" onClick={() => setShowCreate(true)} data-testid="new-campaign-btn"><Plus className="w-4 h-4 mr-1" /> Yeni kampaniya</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-slate-100 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Hesab</p>
          <div className="flex items-center gap-2 mt-1">
            {ping?.ok ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
            <p className="text-sm font-semibold text-[#3D4F6F]">{ping?.account || 'Bağlı deyil'}</p>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">DC: {ping?.datacenter} · Etiket: {ping?.label}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Auditoriyalar</p>
          <p className="text-2xl font-bold text-[#3D4F6F] mt-1">{audiences.length}</p>
          <p className="text-[10px] text-slate-400 mt-1">Cəmi {audiences.reduce((s, a) => s + (a.member_count || 0), 0).toLocaleString()} abunəçi</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Kampaniyalar</p>
          <p className="text-2xl font-bold text-[#3D4F6F] mt-1">{campaigns.length}</p>
          <p className="text-[10px] text-slate-400 mt-1">{campaigns.filter(c => c.status === 'sent').length} göndərilib</p>
        </div>
      </div>

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns" data-testid="tab-campaigns">Kampaniyalar</TabsTrigger>
          <TabsTrigger value="audiences" data-testid="tab-audiences">Auditoriyalar</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden mt-3">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Mövzu</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Auditoriya</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Tarix</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Status</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Göndərildi</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-[#3D4F6F]"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
                ) : campaigns.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">Kampaniya yoxdur</td></tr>
                ) : campaigns.map(c => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/40" data-testid={`campaign-row-${c.id}`}>
                    <td className="px-3 py-2"><p className="font-medium text-[#3D4F6F]">{c.subject}</p><p className="text-[10px] text-slate-400">{c.title}</p></td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.list_name || c.list_id}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{c.send_time ? new Date(c.send_time).toLocaleDateString('az-AZ') : '—'}</td>
                    <td className="px-3 py-2"><Badge className={c.status === 'sent' ? 'bg-green-100 text-green-700 text-[10px]' : 'bg-slate-100 text-slate-600 text-[10px]'}>{c.status}</Badge></td>
                    <td className="px-3 py-2 text-right font-medium">{c.emails_sent || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {c.status === 'sent' && (
                        <button onClick={() => openReport(c)} className="p-1 hover:bg-slate-100 rounded" title="Hesabat" data-testid={`report-btn-${c.id}`}>
                          <BarChart3 className="w-4 h-4 text-slate-500" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="audiences">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {audiences.map(a => (
              <div key={a.id} className="bg-white rounded-xl border border-slate-100 p-4">
                <Mail className="w-5 h-5 text-[#9ACD32] mb-2" />
                <p className="font-semibold text-[#3D4F6F]">{a.name}</p>
                <p className="text-xs text-slate-400 mt-1">ID: <code className="bg-slate-100 px-1 rounded text-[10px]">{a.id}</code></p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-2xl font-bold text-[#3D4F6F]">{(a.member_count || 0).toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400">abunəçi</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Yeni email kampaniyası</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Auditoriya *</Label>
                <Select value={form.audience_id} onValueChange={(v) => setForm({ ...form, audience_id: v })}>
                  <SelectTrigger className="text-sm" data-testid="campaign-audience"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{audiences.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.member_count})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Göndərən ad</Label><Input value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.target.value })} className="text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Reply-to email *</Label><Input value={form.reply_to} onChange={(e) => setForm({ ...form, reply_to: e.target.value })} className="text-sm" /></div>
              <div><Label className="text-xs">Preview text</Label><Input value={form.preview_text} onChange={(e) => setForm({ ...form, preview_text: e.target.value })} className="text-sm" placeholder="Inbox-da görünən" /></div>
            </div>
            <div><Label className="text-xs">Mövzu *</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="text-sm" data-testid="campaign-subject" /></div>
            <div>
              <Label className="text-xs">HTML məzmun *</Label>
              <textarea value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} className="w-full min-h-[200px] p-2 text-sm border rounded-lg font-mono" placeholder="<html><body><h1>Salam!</h1>...</body></html>" data-testid="campaign-html" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.send_now} onChange={(e) => setForm({ ...form, send_now: e.target.checked })} className="accent-[#9ACD32]" data-testid="send-now-checkbox" />
              İndi göndər (yoxdursa qaralama olaraq saxlanır)
            </label>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Ləğv et</Button>
              <Button onClick={handleCreate} disabled={creating} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125]" data-testid="create-campaign-submit">
                {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                {form.send_now ? 'Göndər' : 'Yadda saxla'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSync} onOpenChange={setShowSync}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Şirkətləri Mailchimp-ə sinxronlaşdır</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Bütün aktiv üzv şirkətlərin email-ləri seçilmiş Mailchimp auditoriyasına abunəçi olaraq əlavə/yenilənir.</p>
            <div>
              <Label className="text-xs">Auditoriya *</Label>
              <Select value={syncAudienceId} onValueChange={setSyncAudienceId}>
                <SelectTrigger className="text-sm" data-testid="sync-audience-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>{audiences.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {syncResult && (
              <div className="bg-slate-50 border rounded p-3 text-xs">
                <p><strong className="text-green-700">{syncResult.synced}</strong> sinxronlaşdırıldı · <strong className="text-red-600">{syncResult.failed}</strong> xəta · {syncResult.skipped_no_email} email-siz</p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setShowSync(false)}>Bağla</Button>
              <Button onClick={handleSync} disabled={syncing || !syncAudienceId} className="bg-[#3D4F6F] text-white" data-testid="sync-submit">
                {syncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Users className="w-4 h-4 mr-1" />}
                Sinxronlaşdır
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reportOpen} onOpenChange={(o) => !o && setReportOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Kampaniya hesabatı</DialogTitle></DialogHeader>
          {reportOpen && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[#3D4F6F]">{reportOpen.subject}</p>
              {!report ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : report.ok ? (
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Göndərildi" value={report.stats.emails_sent} icon={<Mail className="w-4 h-4" />} />
                  <Stat label="Açılış" value={report.stats.unique_opens || report.stats.opens} sub={`${(report.stats.open_rate * 100).toFixed(1)}%`} icon={<Eye className="w-4 h-4" />} />
                  <Stat label="Klik" value={report.stats.clicks} sub={`${(report.stats.click_rate * 100).toFixed(1)}%`} icon={<MousePointerClick className="w-4 h-4" />} />
                  <Stat label="Bounce" value={report.stats.bounces} icon={<AlertCircle className="w-4 h-4" />} />
                  <Stat label="Abunəlikdən çıxma" value={report.stats.unsubscribes} icon={<MessageSquare className="w-4 h-4" />} />
                </div>
              ) : <p className="text-sm text-red-600">{report.error}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, sub, icon }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 border">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-slate-300">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-[#3D4F6F] mt-1">{value || 0}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}
