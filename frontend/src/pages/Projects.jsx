import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Loader2, Pencil, Trash2, Calendar, MapPin, Users, CheckCircle2, Target } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';
import { usePermissions, canEdit } from '../context/PermissionContext';
import { validateRequired } from '../lib/validate';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STATUSES = ['Planlaşdırılır', 'Aktiv', 'Tamamlandı'];
const STATUS_COLORS = { 'Planlaşdırılır': 'bg-amber-100 text-amber-700', 'Aktiv': 'bg-green-100 text-green-700', 'Tamamlandı': 'bg-slate-100 text-slate-600' };

const EMPTY_FORM = { name: '', type: '', date: '', end_date: '', location: '', description: '', status: 'Planlaşdırılır', price_per_sqm: '', total_price: '' };

export default function Projects() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [projectTypes, setProjectTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'projects');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [evRes, typeRes] = await Promise.all([
        axios.get(`${API}/project-events`, { headers }),
        axios.get(`${API}/settings/projects`, { headers }),
      ]);
      setEvents(evRes.data);
      setProjectTypes(typeRes.data || []);
    }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const rules = [
      [form.name, 'Layihə adı'],
      [form.type, 'Növ'],
    ];
    if (form.type === 'Sərgi') {
      rules.push([form.price_per_sqm, 'kv/m qiyməti']);
    }
    if (['Tur', 'Təlim'].includes(form.type)) {
      rules.push([form.total_price, 'Ümumi qiymət']);
    }
    if (!validateRequired(rules)) return;
    try {
      const payload = { ...form };
      ['price_per_sqm', 'total_price'].forEach(k => {
        if (payload[k] === '' || payload[k] == null) payload[k] = null;
        else payload[k] = Number(payload[k]);
      });
      if (editing) { await axios.put(`${API}/project-events/${editing.id}`, payload, { headers }); toast.success('Layihə yeniləndi'); }
      else { await axios.post(`${API}/project-events`, payload, { headers }); toast.success('Layihə yaradıldı'); }
      setShowModal(false); fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Silmək istədiyinizə əminsiniz?')) return;
    try { await axios.delete(`${API}/project-events/${id}`, { headers }); toast.success('Silindi'); fetchData(); }
    catch { toast.error('Xəta'); }
  };

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F]" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="projects-page">
      <Toaster position="top-right" richColors />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#3D4F6F]">Layihələr / Tədbirlər</h1>
          <p className="text-slate-500 text-sm mt-1">{events.length} layihə</p>
        </div>
        {_canEdit && <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); }} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="add-event-btn"><Plus className="w-4 h-4 mr-1" />Yeni Layihə</Button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map(ev => (
          <div
            key={ev.id}
            onClick={() => navigate(`/projects/${ev.id}`)}
            className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
            data-testid={`event-${ev.id}`}
          >
            <div className="flex items-start justify-between mb-2">
              <Badge className={STATUS_COLORS[ev.status] || 'bg-slate-100'}>{ev.status}</Badge>
              {_canEdit && <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setEditing(ev); setForm({ ...EMPTY_FORM, ...ev, price_per_sqm: ev.price_per_sqm ?? '', total_price: ev.total_price ?? '' }); setShowModal(true); }} className="p-1 hover:bg-slate-100 rounded"><Pencil className="w-3.5 h-3.5 text-slate-400" /></button>
                <button onClick={(e) => handleDelete(ev.id, e)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
              </div>}
            </div>
            <h3 className="font-bold text-[#3D4F6F] text-lg mb-1">{ev.name}</h3>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className="bg-slate-50 text-slate-600 text-[10px]">{ev.type}</Badge>
              {ev.type === 'Sərgi' && ev.price_per_sqm != null && <Badge className="bg-emerald-50 text-emerald-700 text-[10px]"><Target className="w-2.5 h-2.5 mr-0.5" />{ev.price_per_sqm} AZN/m²</Badge>}
              {(ev.type === 'Tur' || ev.type === 'Təlim') && ev.total_price != null && <Badge className="bg-emerald-50 text-emerald-700 text-[10px]">{ev.total_price} AZN</Badge>}
            </div>
            <div className="space-y-1 text-xs text-slate-500">
              {ev.date && <p className="flex items-center gap-1"><Calendar className="w-3 h-3" />{ev.date}{ev.end_date ? ` — ${ev.end_date}` : ''}</p>}
              {ev.location && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.location}</p>}
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t">
              <div className="flex items-center gap-1 text-xs"><Users className="w-3.5 h-3.5 text-blue-500" /><span className="font-semibold">{ev.guest_count || 0}</span> qonaq</div>
              <div className="flex items-center gap-1 text-xs"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /><span className="font-semibold">{ev.attended_count || 0}</span> iştirak</div>
            </div>
          </div>
        ))}
        {events.length === 0 && <p className="col-span-full text-center text-slate-400 py-12">Layihə yoxdur</p>}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[#3D4F6F]">{editing ? 'Redaktə' : 'Yeni Layihə'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div><Label className="text-xs">Layihə adı *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Növ *</Label>
                <Select value={form.type} onValueChange={v => setForm({...form, type: v})}><SelectTrigger className="text-sm" data-testid="event-type-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{projectTypes.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Başlama tarixi</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="text-sm" /></div>
              <div><Label className="text-xs">Bitmə tarixi</Label><Input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} className="text-sm" /></div>
            </div>
            <div><Label className="text-xs">Məkan</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="text-sm" /></div>
            {form.type === 'Sərgi' && (
              <div><Label className="text-xs">kv/m qiyməti (AZN) *</Label>
                <Input type="number" value={form.price_per_sqm} onChange={e => setForm({...form, price_per_sqm: e.target.value})} className="text-sm" placeholder="Məs: 150" data-testid="event-price-input" /></div>
            )}
            {(form.type === 'Tur' || form.type === 'Təlim') && (
              <div><Label className="text-xs">Ümumi qiymət (AZN) *</Label>
                <Input type="number" value={form.total_price} onChange={e => setForm({...form, total_price: e.target.value})} className="text-sm" placeholder="Məs: 500" data-testid="event-totalprice-input" /></div>
            )}
            <div><Label className="text-xs">Açıqlama</Label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full min-h-[40px] p-2 text-sm border rounded-lg resize-none" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowModal(false)}>Ləğv et</Button><Button type="submit" className="bg-[#3D4F6F] text-white">{editing ? 'Saxla' : 'Yarat'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
