import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, Check, X, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Inline editor for the services attached to a single package.
 * Each service: { id, name, description, value, included, sort_order }
 */
export default function PackageServicesManager({ packageId, packageName, onClose }) {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const [editing, setEditing] = useState(null); // service object or 'new'
  const [form, setForm] = useState({ name: '', description: '', value: '', included: true });

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/settings/packages/${packageId}/services`, { headers });
      setServices(res.data || []);
    } catch (err) {
      toast.error('Xidmətləri yükləmək alınmadı');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageId]);

  useEffect(() => { if (packageId) fetchServices(); }, [packageId, fetchServices]);

  const startNew = () => {
    setForm({ name: '', description: '', value: '', included: true });
    setEditing('new');
  };
  const startEdit = (svc) => {
    setForm({ name: svc.name || '', description: svc.description || '', value: svc.value || '', included: !!svc.included });
    setEditing(svc);
  };
  const cancelEdit = () => { setEditing(null); setForm({ name: '', description: '', value: '', included: true }); };

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Xidmət adı tələb olunur'); return; }
    try {
      if (editing === 'new') {
        await axios.post(`${API}/settings/packages/${packageId}/services`, form, { headers });
        toast.success('Xidmət əlavə edildi');
      } else {
        await axios.put(`${API}/settings/packages/${packageId}/services/${editing.id}`, form, { headers });
        toast.success('Xidmət yeniləndi');
      }
      cancelEdit();
      fetchServices();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const remove = async (svc) => {
    if (!window.confirm(`"${svc.name}" xidmətini silmək istəyirsiniz?`)) return;
    try {
      await axios.delete(`${API}/settings/packages/${packageId}/services/${svc.id}`, { headers });
      toast.success('Xidmət silindi');
      fetchServices();
    } catch { toast.error('Silmək alınmadı'); }
  };

  const toggleIncluded = async (svc) => {
    try {
      await axios.put(`${API}/settings/packages/${packageId}/services/${svc.id}`, { included: !svc.included }, { headers });
      fetchServices();
    } catch { toast.error('Yenilənmədi'); }
  };

  const seedFromBrochure = async () => {
    if (!window.confirm('Bu əməliyyat 2026 broşürdən bütün 19 xidməti seed edəcək (Premium/Business/Business+ üçün). Mövcud xidmətlər EVƏZ olunacaq. Davam edək?')) return;
    setSeeding(true);
    try {
      await axios.post(`${API}/settings/packages/services/seed`, {}, { headers });
      toast.success('Xidmətlər seed olundu');
      fetchServices();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Seed alınmadı');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <Dialog open={!!packageId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="package-services-dialog">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle style={{ color: '#3D4F6F' }}>
              <span className="font-bold">{packageName}</span> — Xidmətlər
            </DialogTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={seedFromBrochure}
              disabled={seeding}
              className="border-amber-300 text-amber-700 hover:bg-amber-50 text-xs"
              data-testid="seed-services-btn"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" /> 2026 broşürdən seed
            </Button>
          </div>
        </DialogHeader>

        {/* Add/Edit form */}
        {editing && (
          <div className="bg-[#9ACD32]/10 border border-[#9ACD32]/40 rounded-xl p-3 mb-3" data-testid="service-form">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Xidmət adı *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="text-sm" placeholder="Məs. B2B görüşlərə dəvət" data-testid="service-name-input" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Təsvir</Label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full min-h-[44px] p-2 text-sm border rounded-lg resize-none"
                  placeholder="Qısa təsvir (opsional)"
                  data-testid="service-desc-input"
                />
              </div>
              <div>
                <Label className="text-xs">Dəyər (opsional)</Label>
                <Input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="text-sm" placeholder="Məs. 15, 1 dəfə, limitsiz" data-testid="service-value-input" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.included}
                    onChange={(e) => setForm({ ...form, included: e.target.checked })}
                    className="w-4 h-4 accent-[#9ACD32]"
                    data-testid="service-included-input"
                  />
                  <span className="text-sm text-[#3D4F6F]">Bu paketə daxildir</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={cancelEdit} data-testid="service-cancel-btn">Ləğv</Button>
              <Button size="sm" onClick={submit} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="service-submit-btn">
                {editing === 'new' ? 'Əlavə et' : 'Yenilə'}
              </Button>
            </div>
          </div>
        )}

        {!editing && (
          <Button size="sm" onClick={startNew} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold mb-3 w-full sm:w-auto" data-testid="add-service-btn">
            <Plus className="w-4 h-4 mr-1" /> Yeni xidmət
          </Button>
        )}

        {/* Services list */}
        {loading ? (
          <p className="text-center text-slate-400 py-8 text-sm">Yüklənir...</p>
        ) : services.length === 0 ? (
          <p className="text-center text-slate-400 py-8 text-sm">Bu paketin xidməti yoxdur. Yuxarıdakı "2026 broşürdən seed" düyməsi ilə standart xidmət siyahısını əlavə edə bilərsiniz.</p>
        ) : (
          <div className="space-y-1.5">
            {services.map((svc) => (
              <div
                key={svc.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${svc.included ? 'bg-emerald-50/40 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}
                data-testid={`service-row-${svc.id}`}
              >
                <button
                  type="button"
                  onClick={() => toggleIncluded(svc)}
                  className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${svc.included ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'}`}
                  title={svc.included ? 'Daxildir — söndür' : 'Daxil deyil — yandır'}
                  data-testid={`toggle-included-${svc.id}`}
                >
                  {svc.included ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-semibold ${svc.included ? 'text-[#3D4F6F]' : 'text-slate-500 line-through'}`}>{svc.name}</p>
                    {svc.value && <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#3D4F6F] text-white">{svc.value}</span>}
                  </div>
                  {svc.description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{svc.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(svc)} data-testid={`service-edit-${svc.id}`}>
                    <Pencil className="w-4 h-4 text-slate-500" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(svc)} data-testid={`service-delete-${svc.id}`}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
