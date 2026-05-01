import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Sparkles, History, Loader2, Zap, Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Per-company service usage tracker.
 * Shows package services with quota / used / remaining + per-row history toggle.
 */
export default function ServiceUsageTab({ companyId, companyName }) {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openHistory, setOpenHistory] = useState({});
  const [historyData, setHistoryData] = useState({});

  const [modalSvc, setModalSvc] = useState(null);
  const [editingUsage, setEditingUsage] = useState(null);
  const [form, setForm] = useState({ quantity: 1, used_date: '', notes: '' });

  const fetchStats = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/companies/${companyId}/service-stats`, { headers });
      setStats(res.data);
    } catch {
      toast.error('Statistikanı yükləmək alınmadı');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const loadHistory = async (svcId) => {
    if (historyData[svcId]) return;
    try {
      const res = await axios.get(`${API}/companies/${companyId}/service-usage`, { headers, params: { service_id: svcId } });
      setHistoryData(prev => ({ ...prev, [svcId]: res.data || [] }));
    } catch {
      toast.error('Tarixçəni yükləmək alınmadı');
    }
  };

  const toggleHistory = (svcId) => {
    setOpenHistory(prev => ({ ...prev, [svcId]: !prev[svcId] }));
    if (!openHistory[svcId]) loadHistory(svcId);
  };

  const openAdd = (svc) => {
    setEditingUsage(null);
    setModalSvc(svc);
    setForm({ quantity: 1, used_date: new Date().toISOString().slice(0, 10), notes: '' });
  };
  const openEdit = (svc, usage) => {
    setEditingUsage(usage);
    setModalSvc(svc);
    setForm({ quantity: usage.quantity || 1, used_date: usage.used_date || '', notes: usage.notes || '' });
  };
  const closeModal = () => { setModalSvc(null); setEditingUsage(null); };

  const submitUsage = async () => {
    if (!modalSvc) return;
    try {
      if (editingUsage) {
        await axios.put(`${API}/service-usage/${editingUsage.id}`, form, { headers });
        toast.success('Qeyd yeniləndi');
      } else {
        await axios.post(`${API}/companies/${companyId}/service-usage`, {
          service_id: modalSvc.service_id,
          service_name: modalSvc.name,
          quantity: parseInt(form.quantity, 10) || 1,
          used_date: form.used_date,
          notes: form.notes,
        }, { headers });
        toast.success('İstifadə qeyd edildi');
      }
      // Invalidate cached history for this svc
      setHistoryData(prev => { const c = { ...prev }; delete c[modalSvc.service_id]; return c; });
      if (openHistory[modalSvc.service_id]) await loadHistory(modalSvc.service_id);
      closeModal();
      fetchStats();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const removeUsage = async (svcId, usageId) => {
    if (!window.confirm('Bu istifadə qeydini silmək istəyirsiniz?')) return;
    try {
      await axios.delete(`${API}/service-usage/${usageId}`, { headers });
      toast.success('Silindi');
      setHistoryData(prev => { const c = { ...prev }; delete c[svcId]; return c; });
      if (openHistory[svcId]) await loadHistory(svcId);
      fetchStats();
    } catch { toast.error('Silmək alınmadı'); }
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-slate-400 text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" />Yüklənir...</div>;
  if (!stats) return <div className="text-center text-slate-400 text-sm py-12">Məlumat yoxdur</div>;
  if (!stats.package_name) return <div className="text-center text-slate-400 text-sm py-12">Bu şirkətə paket təyin olunmayıb. Əvvəlcə paket seçin.</div>;
  if (!stats.services.length) return <div className="text-center text-slate-400 text-sm py-12">"{stats.package_name}" paketi üçün xidmət təyin olunmayıb. Tənzimləmələr → Paketlərdən əlavə edin.</div>;

  return (
    <div className="space-y-3" data-testid="service-usage-tab">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-[#9ACD32]" />
        <h3 className="text-sm font-semibold text-[#3D4F6F]">Paket: <span className="text-[#9ACD32]">{stats.package_name}</span></h3>
        <span className="text-xs text-slate-400">· {stats.services.length} xidmət</span>
      </div>

      {/* Service rows */}
      <div className="space-y-1.5">
        {stats.services.map((svc) => {
          const isOpen = !!openHistory[svc.service_id];
          const inactive = !svc.included;
          const hasQuota = typeof svc.quota === 'number';
          const remainingPct = hasQuota && svc.quota > 0 ? Math.max(Math.min((svc.remaining / svc.quota) * 100, 100), 0) : null;
          return (
            <div
              key={svc.service_id || svc.name}
              className={`rounded-xl border transition-colors ${inactive ? 'bg-slate-50 border-slate-100 opacity-70' : 'bg-white border-slate-100 hover:border-[#9ACD32]/40'}`}
              data-testid={`usage-row-${svc.service_id}`}
            >
              <div className="flex items-center gap-3 p-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${svc.included ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  {svc.included ? <Check className="w-3.5 h-3.5 text-white" /> : <X className="w-3.5 h-3.5 text-white" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-medium ${inactive ? 'text-slate-500 line-through' : 'text-[#3D4F6F]'}`}>{svc.name}</p>
                    {svc.value && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#3D4F6F] text-white">{svc.value}</span>}
                    {svc.unlimited && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-600 text-white">limitsiz</span>}
                    {svc.legacy && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">köhnə</span>}
                  </div>
                  {svc.last_used && <p className="text-[11px] text-slate-400 mt-0.5">Sonuncu istifadə: {svc.last_used}</p>}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {hasQuota ? (
                    <div className="text-right">
                      <p className="text-xs text-slate-500">İstifadə / Qalıq</p>
                      <p className="text-sm font-bold">
                        <span className="text-[#3D4F6F]">{svc.used}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className={svc.remaining === 0 ? 'text-red-600' : svc.remaining <= 2 ? 'text-amber-600' : 'text-emerald-600'}>{svc.remaining}</span>
                      </p>
                      {remainingPct !== null && (
                        <div className="w-24 h-1 rounded-full bg-slate-100 mt-1 overflow-hidden">
                          <div className={`h-full rounded-full ${svc.remaining === 0 ? 'bg-red-500' : svc.remaining <= 2 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${remainingPct}%` }} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-600 text-[11px]">{svc.used} dəfə</Badge>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openAdd(svc)}
                    disabled={!svc.included}
                    className="text-xs border-[#9ACD32] text-[#3D4F6F] hover:bg-[#9ACD32] hover:text-[#3D4F6F] disabled:opacity-40 disabled:cursor-not-allowed"
                    data-testid={`add-usage-${svc.service_id}`}
                  >
                    <Plus className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Qeyd et</span>
                  </Button>
                  <button
                    type="button"
                    onClick={() => toggleHistory(svc.service_id)}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${isOpen ? 'bg-[#3D4F6F] text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                    data-testid={`history-toggle-${svc.service_id}`}
                  >
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline"><History className="w-3.5 h-3.5 inline mr-0.5" />{svc.history_count || 0}</span>
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-slate-100 px-3 py-2 bg-slate-50/50">
                  {!historyData[svc.service_id] ? (
                    <p className="text-xs text-slate-400 py-2 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />Tarixçə yüklənir...</p>
                  ) : historyData[svc.service_id].length === 0 ? (
                    <p className="text-xs text-slate-400 py-2 italic">Hələ qeyd yoxdur</p>
                  ) : (
                    <div className="space-y-1">
                      {historyData[svc.service_id].map((u) => (
                        <div key={u.id} className="flex items-center gap-2 text-xs bg-white border border-slate-100 rounded-lg px-2.5 py-1.5" data-testid={`usage-record-${u.id}`}>
                          <span className="font-mono text-slate-500">{u.used_date}</span>
                          <span className="px-1.5 py-0.5 rounded bg-[#3D4F6F]/10 text-[#3D4F6F] font-semibold">{u.quantity}x</span>
                          {u.auto && <Zap className="w-3 h-3 text-amber-500" title="Avtomatik qeyd" />}
                          <span className="flex-1 text-slate-600 truncate">{u.notes || '-'}</span>
                          <span className="text-[10px] text-slate-400">{u.created_by}</span>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEdit(svc, u)} data-testid={`edit-usage-${u.id}`}>
                            <Pencil className="w-3 h-3 text-slate-500" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeUsage(svc.service_id, u.id)} data-testid={`delete-usage-${u.id}`}>
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add/Edit modal */}
      <Dialog open={!!modalSvc} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-w-md" data-testid="usage-modal">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>
              {editingUsage ? 'İstifadəni redaktə et' : 'Yeni istifadə qeyd et'}
            </DialogTitle>
          </DialogHeader>
          {modalSvc && (
            <>
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
                <p><span className="font-semibold text-[#3D4F6F]">{modalSvc.name}</span></p>
                {companyName && <p className="mt-0.5">Şirkət: {companyName}</p>}
                {typeof modalSvc.quota === 'number' && (
                  <p className="mt-0.5">Limit: {modalSvc.quota} · İstifadə: {modalSvc.used} · Qalıq: {modalSvc.remaining}</p>
                )}
              </div>
              <div className="space-y-3 mt-3">
                <div>
                  <Label className="text-xs">Tarix *</Label>
                  <Input type="date" value={form.used_date} onChange={(e) => setForm({ ...form, used_date: e.target.value })} className="text-sm" data-testid="usage-date-input" />
                </div>
                <div>
                  <Label className="text-xs">Miqdar</Label>
                  <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="text-sm" data-testid="usage-qty-input" />
                </div>
                <div>
                  <Label className="text-xs">Qeyd</Label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full min-h-[60px] p-2 text-sm border rounded-lg resize-none" placeholder="Hadisə, iştirakçı, mövzu və s." data-testid="usage-notes-input" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeModal} data-testid="usage-cancel-btn">Ləğv</Button>
                <Button onClick={submitUsage} disabled={!form.used_date} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="usage-submit-btn">
                  {editingUsage ? 'Yenilə' : 'Qeyd et'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
