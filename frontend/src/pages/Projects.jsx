import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Loader2, Pencil, Trash2, Calendar, MapPin, Users, CheckCircle2, Target, Table } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';
import { usePermissions, canEdit } from '../context/PermissionContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STATUSES = ['Planlaşdırılır', 'Aktiv', 'Tamamlandı'];
const STATUS_COLORS = { 'Planlaşdırılır': 'bg-amber-100 text-amber-700', 'Aktiv': 'bg-green-100 text-green-700', 'Tamamlandı': 'bg-slate-100 text-slate-600' };

export default function Projects() {
  const [events, setEvents] = useState([]);
  const [projectTypes, setProjectTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', type: '', date: '', end_date: '', location: '', description: '', status: 'Planlaşdırılır', price_per_sqm: '' });
  const [salesView, setSalesView] = useState(null); // { event, sales }
  const [editingSale, setEditingSale] = useState(null);
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
    try {
      const payload = { ...form };
      if (payload.price_per_sqm === '' || payload.price_per_sqm == null) payload.price_per_sqm = null;
      else payload.price_per_sqm = Number(payload.price_per_sqm);
      if (editing) { await axios.put(`${API}/project-events/${editing.id}`, payload, { headers }); toast.success('Layihə yeniləndi'); }
      else { await axios.post(`${API}/project-events`, payload, { headers }); toast.success('Layihə yaradıldı'); }
      setShowModal(false); fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Silmək istədiyinizə əminsiniz?')) return;
    try { await axios.delete(`${API}/project-events/${id}`, { headers }); toast.success('Silindi'); fetchData(); }
    catch { toast.error('Xəta'); }
  };

  const openSalesView = async (event) => {
    try {
      const res = await axios.get(`${API}/project-events/${event.id}/sales`, { headers });
      setSalesView(res.data);
    } catch { toast.error('Satışları yükləmək mümkün olmadı'); }
  };

  const saveSale = async () => {
    if (!editingSale) return;
    try {
      const payload = { ...editingSale };
      ['kv_m', 'price_per_sqm', 'total_amount', 'participant_count'].forEach(k => {
        if (payload[k] === '' || payload[k] == null) payload[k] = null;
        else payload[k] = Number(payload[k]);
      });
      await axios.put(`${API}/sales-leads/${editingSale.id}`, payload, { headers });
      toast.success('Yadda saxlandı');
      setEditingSale(null);
      if (salesView) openSalesView(salesView.event);
    } catch { toast.error('Xəta baş verdi'); }
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
        {_canEdit && <Button onClick={() => { setEditing(null); setForm({ name: '', type: '', date: '', end_date: '', location: '', description: '', status: 'Planlaşdırılır', price_per_sqm: '' }); setShowModal(true); }} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="add-event-btn"><Plus className="w-4 h-4 mr-1" />Yeni Layihə</Button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map(ev => (
          <div key={ev.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 hover:shadow-md transition-shadow" data-testid={`event-${ev.id}`}>
            <div className="flex items-start justify-between mb-2">
              <Badge className={STATUS_COLORS[ev.status] || 'bg-slate-100'}>{ev.status}</Badge>
              {_canEdit && <div className="flex gap-1">
                <button onClick={() => openSalesView(ev)} className="p-1 hover:bg-emerald-50 rounded" title="Satışlar" data-testid={`sales-btn-${ev.id}`}><Table className="w-3.5 h-3.5 text-emerald-500" /></button>
                <button onClick={() => { setEditing(ev); setForm({ name: ev.name || '', type: ev.type || '', date: ev.date || '', end_date: ev.end_date || '', location: ev.location || '', description: ev.description || '', status: ev.status || 'Planlaşdırılır', price_per_sqm: ev.price_per_sqm ?? '' }); setShowModal(true); }} className="p-1 hover:bg-slate-100 rounded"><Pencil className="w-3.5 h-3.5 text-slate-400" /></button>
                <button onClick={() => handleDelete(ev.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
              </div>}
            </div>
            <h3 className="font-bold text-[#3D4F6F] text-lg mb-1">{ev.name}</h3>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-slate-50 text-slate-600 text-[10px]">{ev.type}</Badge>
              {ev.type === 'Sərgi' && ev.price_per_sqm != null && <Badge className="bg-emerald-50 text-emerald-700 text-[10px]"><Target className="w-2.5 h-2.5 mr-0.5" />{ev.price_per_sqm} AZN/m²</Badge>}
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
              <div><Label className="text-xs">kv/m qiyməti (AZN)</Label>
                <Input type="number" value={form.price_per_sqm} onChange={e => setForm({...form, price_per_sqm: e.target.value})} className="text-sm" placeholder="Məs: 150" data-testid="event-price-input" /></div>
            )}
            <div><Label className="text-xs">Açıqlama</Label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full min-h-[40px] p-2 text-sm border rounded-lg resize-none" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowModal(false)}>Ləğv et</Button><Button type="submit" className="bg-[#3D4F6F] text-white">{editing ? 'Saxla' : 'Yarat'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sales view modal */}
      <Dialog open={!!salesView} onOpenChange={(o) => !o && setSalesView(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {salesView && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[#3D4F6F]">{salesView.event.name} — Satışlar</DialogTitle>
              </DialogHeader>
              <div className="text-xs text-slate-500 mb-3">
                <Badge className="bg-slate-100 text-slate-700 mr-2">{salesView.event.type}</Badge>
                {salesView.sales.length} satış
              </div>
              {salesView.sales.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">Bu layihə üçün satış yoxdur</p>
              ) : salesView.event.type === 'Sərgi' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="sales-table-exhibition">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">ID</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Şirkət</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Sahibkar</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Telefon</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Email</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Sektor</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Alt sektor</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Stend №</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">kv/m</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Zal №</th>
                        <th className="text-right px-2 py-2 font-semibold text-[#3D4F6F]">Məbləğ (AZN)</th>
                        <th className="text-right px-2 py-2 font-semibold text-[#3D4F6F]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesView.sales.map(s => (
                        <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50" data-testid={`sale-row-${s.id}`}>
                          <td className="px-2 py-2 font-mono text-[10px]">{s.lead_code}</td>
                          <td className="px-2 py-2 font-medium">{s.company_name}</td>
                          <td className="px-2 py-2">{s.contact_name}</td>
                          <td className="px-2 py-2">{s.phone}</td>
                          <td className="px-2 py-2">{s.email}</td>
                          <td className="px-2 py-2">{s.sector}</td>
                          <td className="px-2 py-2">{s.sub_sector}</td>
                          <td className="px-2 py-2">{s.stand_number}</td>
                          <td className="px-2 py-2">{s.kv_m}</td>
                          <td className="px-2 py-2">{s.hall_number}</td>
                          <td className="px-2 py-2 text-right font-semibold">{s.total_amount}</td>
                          <td className="px-2 py-2 text-right">
                            {_canEdit && <button onClick={() => setEditingSale({ ...s })} className="p-1 hover:bg-slate-100 rounded" data-testid={`edit-sale-${s.id}`}><Pencil className="w-3 h-3 text-slate-500" /></button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : salesView.event.type === 'Tur' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="sales-table-tour">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">ID</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Şirkət</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Sahibkar</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Əlaqə №</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Email</th>
                        <th className="text-right px-2 py-2 font-semibold text-[#3D4F6F]">Məbləğ</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Qeyd</th>
                        <th className="text-right px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesView.sales.map(s => (
                        <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-2 py-2 font-mono text-[10px]">{s.lead_code}</td>
                          <td className="px-2 py-2 font-medium">{s.company_name}</td>
                          <td className="px-2 py-2">{s.contact_name}</td>
                          <td className="px-2 py-2">{s.phone}</td>
                          <td className="px-2 py-2">{s.email}</td>
                          <td className="px-2 py-2 text-right font-semibold">{s.total_amount}</td>
                          <td className="px-2 py-2 text-slate-500">{s.notes}</td>
                          <td className="px-2 py-2 text-right">{_canEdit && <button onClick={() => setEditingSale({ ...s })} className="p-1 hover:bg-slate-100 rounded" data-testid={`edit-sale-${s.id}`}><Pencil className="w-3 h-3 text-slate-500" /></button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : salesView.event.type === 'Təlim' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="sales-table-training">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">ID</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Şirkət</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Sahibkar</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Əlaqə №</th>
                        <th className="text-right px-2 py-2 font-semibold text-[#3D4F6F]">Məbləğ</th>
                        <th className="text-left px-2 py-2 font-semibold text-[#3D4F6F]">Qeyd</th>
                        <th className="text-right px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesView.sales.map(s => (
                        <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-2 py-2 font-mono text-[10px]">{s.lead_code}</td>
                          <td className="px-2 py-2 font-medium">{s.company_name}</td>
                          <td className="px-2 py-2">{s.contact_name}</td>
                          <td className="px-2 py-2">{s.phone}</td>
                          <td className="px-2 py-2 text-right font-semibold">{s.total_amount}</td>
                          <td className="px-2 py-2 text-slate-500">{s.notes}</td>
                          <td className="px-2 py-2 text-right">{_canEdit && <button onClick={() => setEditingSale({ ...s })} className="p-1 hover:bg-slate-100 rounded" data-testid={`edit-sale-${s.id}`}><Pencil className="w-3 h-3 text-slate-500" /></button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b"><tr>
                      <th className="text-left px-2 py-2">ID</th><th className="text-left px-2 py-2">Şirkət</th>
                      <th className="text-left px-2 py-2">Sahibkar</th><th className="text-left px-2 py-2">Əlaqə</th>
                      <th className="text-right px-2 py-2">Məbləğ</th>
                    </tr></thead>
                    <tbody>{salesView.sales.map(s => (
                      <tr key={s.id} className="border-b border-slate-50">
                        <td className="px-2 py-2 font-mono text-[10px]">{s.lead_code}</td>
                        <td className="px-2 py-2">{s.company_name}</td><td className="px-2 py-2">{s.contact_name}</td>
                        <td className="px-2 py-2">{s.phone}</td><td className="px-2 py-2 text-right">{s.total_amount}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit sale row modal */}
      <Dialog open={!!editingSale} onOpenChange={(o) => !o && setEditingSale(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-[#3D4F6F]">Satışı redaktə et</DialogTitle></DialogHeader>
          {editingSale && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Şirkət</Label><Input value={editingSale.company_name || ''} onChange={e => setEditingSale({ ...editingSale, company_name: e.target.value })} className="text-sm" /></div>
                <div><Label className="text-xs">Sahibkar</Label><Input value={editingSale.contact_name || ''} onChange={e => setEditingSale({ ...editingSale, contact_name: e.target.value })} className="text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Telefon</Label><Input value={editingSale.phone || ''} onChange={e => setEditingSale({ ...editingSale, phone: e.target.value })} className="text-sm" /></div>
                <div><Label className="text-xs">Email</Label><Input value={editingSale.email || ''} onChange={e => setEditingSale({ ...editingSale, email: e.target.value })} className="text-sm" /></div>
              </div>
              {editingSale.sale_type === 'Sərgi' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label className="text-xs">Stend №</Label><Input value={editingSale.stand_number || ''} onChange={e => setEditingSale({ ...editingSale, stand_number: e.target.value })} className="text-sm" /></div>
                    <div><Label className="text-xs">kv/m</Label><Input type="number" value={editingSale.kv_m || ''} onChange={e => setEditingSale({ ...editingSale, kv_m: e.target.value })} className="text-sm" /></div>
                    <div><Label className="text-xs">Zal №</Label><Input value={editingSale.hall_number || ''} onChange={e => setEditingSale({ ...editingSale, hall_number: e.target.value })} className="text-sm" /></div>
                  </div>
                </>
              )}
              <div><Label className="text-xs">Yekun məbləğ (AZN)</Label><Input type="number" value={editingSale.total_amount || ''} onChange={e => setEditingSale({ ...editingSale, total_amount: e.target.value })} className="text-sm font-semibold" /></div>
              <div><Label className="text-xs">Qeyd</Label><textarea value={editingSale.notes || ''} onChange={e => setEditingSale({ ...editingSale, notes: e.target.value })} className="w-full min-h-[40px] p-2 text-sm border rounded-lg resize-none" /></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingSale(null)}>Ləğv et</Button>
                <Button type="button" className="bg-[#3D4F6F] text-white" onClick={saveSale} data-testid="save-sale-btn">Saxla</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
