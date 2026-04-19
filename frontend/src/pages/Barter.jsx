import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Loader2, Search, Pencil, Trash2, Download, ArrowLeftRight, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';
import { usePermissions, canEdit } from '../context/PermissionContext';
import * as XLSX from 'xlsx';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STATUSES = ['Təklif', 'Müzakirədə', 'Aktiv', 'Tamamlandı', 'Ləğv edilib'];
const STATUS_COLORS = {
  'Təklif': 'bg-blue-100 text-blue-700',
  'Müzakirədə': 'bg-amber-100 text-amber-700',
  'Aktiv': 'bg-green-100 text-green-700',
  'Tamamlandı': 'bg-slate-100 text-slate-600',
  'Ləğv edilib': 'bg-red-100 text-red-700',
};

export default function Barter() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ partner_name: '', partner_contact: '', partner_phone: '', our_service: '', their_service: '', our_value: '', their_value: '', status: 'Təklif', start_date: '', end_date: '', notes: '' });
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'finance');
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [iRes, sRes] = await Promise.all([
        axios.get(`${API}/barters`, { headers }),
        axios.get(`${API}/barters/stats`, { headers }),
      ]);
      setItems(iRes.data); setStats(sRes.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await axios.put(`${API}/barters/${editing.id}`, form, { headers }); toast.success('Yeniləndi'); }
      else { await axios.post(`${API}/barters`, form, { headers }); toast.success('Barter əlavə edildi'); }
      setShowModal(false); fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Silmək istədiyinizə əminsiniz?')) return;
    try { await axios.delete(`${API}/barters/${id}`, { headers }); toast.success('Silindi'); fetchData(); }
    catch { toast.error('Xəta'); }
  };

  const handleStatusChange = async (id, status) => {
    try { await axios.put(`${API}/barters/${id}`, { status }, { headers }); toast.success('Status yeniləndi'); fetchData(); }
    catch { toast.error('Xəta'); }
  };

  const exportToExcel = () => {
    const data = filtered.map(i => ({
      'Kod': i.barter_code, 'Tərəfdaş': i.partner_name, 'Əlaqə': i.partner_contact, 'Telefon': i.partner_phone,
      'Bizim xidmət': i.our_service, 'Bizim dəyər (AZN)': i.our_value,
      'Onların xidməti': i.their_service, 'Onların dəyəri (AZN)': i.their_value,
      'Status': i.status, 'Başlanğıc': i.start_date, 'Bitmə': i.end_date, 'Məsul': i.responsible, 'Qeyd': i.notes
    }));
    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 8 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Barterlər');
    XLSX.writeFile(wb, `barter_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filtered = items.filter(i => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      if (!i.partner_name?.toLowerCase().includes(t) &&
          !i.our_service?.toLowerCase().includes(t) &&
          !i.their_service?.toLowerCase().includes(t) &&
          !i.barter_code?.toLowerCase().includes(t)) return false;
    }
    return true;
  });

  const fmt = (v) => (v || 0).toLocaleString('az-AZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F]" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="barter-page">
      <Toaster position="top-right" richColors />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#3D4F6F]">Barter Əməliyyatları</h1>
          <p className="text-slate-500 text-sm mt-1">{items.length} əməliyyat</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} variant="outline" className="text-[#3D4F6F]" data-testid="export-barter-btn"><Download className="w-4 h-4 mr-1" />Excel</Button>
          {_canEdit && <Button onClick={() => { setEditing(null); setForm({ partner_name: '', partner_contact: '', partner_phone: '', our_service: '', their_service: '', our_value: '', their_value: '', status: 'Təklif', start_date: '', end_date: '', notes: '' }); setShowModal(true); }} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="add-barter-btn"><Plus className="w-4 h-4 mr-1" />Yeni Barter</Button>}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="bg-white rounded-xl border p-3" data-testid="stat-total">
            <div className="flex items-center gap-2 mb-1"><ArrowLeftRight className="w-4 h-4 text-[#3D4F6F]" /><p className="text-[10px] text-slate-500 font-medium">Ümumi</p></div>
            <p className="text-2xl font-bold text-[#3D4F6F]">{stats.total}</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-100 p-3" data-testid="stat-active">
            <p className="text-[10px] text-green-600 font-medium mb-1">Aktiv</p>
            <p className="text-2xl font-bold text-green-700">{stats.active}</p>
          </div>
          <div className="bg-blue-50 rounded-xl border border-blue-100 p-3" data-testid="stat-our-value">
            <div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-blue-600" /><p className="text-[10px] text-blue-600 font-medium">Verilən dəyər</p></div>
            <p className="text-lg font-bold text-blue-700">{fmt(stats.total_our_value)} AZN</p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-3" data-testid="stat-their-value">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-amber-600" /><p className="text-[10px] text-amber-600 font-medium">Alınan dəyər</p></div>
            <p className="text-lg font-bold text-amber-700">{fmt(stats.total_their_value)} AZN</p>
          </div>
          <div className={`rounded-xl border p-3 ${stats.net_balance >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`} data-testid="stat-balance">
            <div className="flex items-center gap-2 mb-1"><Scale className={`w-4 h-4 ${stats.net_balance >= 0 ? 'text-green-600' : 'text-red-600'}`} /><p className={`text-[10px] font-medium ${stats.net_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>Balans</p></div>
            <p className={`text-lg font-bold ${stats.net_balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>{stats.net_balance >= 0 ? '+' : ''}{fmt(stats.net_balance)} AZN</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-3 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Axtar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 text-sm" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px] text-sm h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Bütün statuslar</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Kod</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Tərəfdaş</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Bizim xidmət</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Onların xidməti</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Dəyərlər (AZN)</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Status</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">Barter yoxdur</td></tr> :
                filtered.map(b => (
                  <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/50" data-testid={`barter-${b.id}`}>
                    <td className="px-3 py-2.5"><Badge className="bg-slate-100 text-slate-700 text-[10px] font-mono">{b.barter_code}</Badge></td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-medium text-[#3D4F6F]">{b.partner_name}</p>
                      {b.partner_contact && <p className="text-[10px] text-slate-400">{b.partner_contact}{b.partner_phone ? ` • ${b.partner_phone}` : ''}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 max-w-[180px]">{b.our_service}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 max-w-[180px]">{b.their_service}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs text-blue-600">↓ {fmt(b.our_value)}</span>
                        <span className="text-xs text-amber-600">↑ {fmt(b.their_value)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {_canEdit ? (
                        <Select value={b.status} onValueChange={v => handleStatusChange(b.id, v)}>
                          <SelectTrigger className={`text-xs h-7 w-[120px] border-0 ${STATUS_COLORS[b.status]}`} data-testid={`status-${b.id}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : <Badge className={STATUS_COLORS[b.status]}>{b.status}</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {_canEdit && <div className="flex justify-end gap-1">
                        <button onClick={() => { setEditing(b); setForm({ ...b }); setShowModal(true); }} className="p-1.5 hover:bg-slate-100 rounded-lg"><Pencil className="w-3.5 h-3.5 text-slate-400" /></button>
                        <button onClick={() => handleDelete(b.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                      </div>}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-[#3D4F6F]">{editing ? 'Barter Redaktə' : 'Yeni Barter'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Tərəfdaş adı *</Label><Input value={form.partner_name} onChange={e => setForm({ ...form, partner_name: e.target.value })} required className="text-sm" /></div>
              <div><Label className="text-xs">Əlaqəli şəxs</Label><Input value={form.partner_contact} onChange={e => setForm({ ...form, partner_contact: e.target.value })} className="text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Telefon</Label><Input value={form.partner_phone} onChange={e => setForm({ ...form, partner_phone: e.target.value })} className="text-sm" /></div>
              <div><Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <div><Label className="text-xs text-blue-700">Bizim xidmət *</Label><Input value={form.our_service} onChange={e => setForm({ ...form, our_service: e.target.value })} required className="text-sm" /></div>
              <div><Label className="text-xs text-blue-700">Bizim dəyər (AZN)</Label><Input type="number" step="0.01" value={form.our_value} onChange={e => setForm({ ...form, our_value: e.target.value })} className="text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/50 rounded-lg border border-amber-100">
              <div><Label className="text-xs text-amber-700">Onların xidməti *</Label><Input value={form.their_service} onChange={e => setForm({ ...form, their_service: e.target.value })} required className="text-sm" /></div>
              <div><Label className="text-xs text-amber-700">Onların dəyəri (AZN)</Label><Input type="number" step="0.01" value={form.their_value} onChange={e => setForm({ ...form, their_value: e.target.value })} className="text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Başlanğıc</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="text-sm" /></div>
              <div><Label className="text-xs">Bitmə</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="text-sm" /></div>
            </div>
            <div><Label className="text-xs">Qeyd</Label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full min-h-[50px] p-2 text-sm border rounded-lg resize-none" /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Ləğv et</Button>
              <Button type="submit" className="bg-[#3D4F6F] text-white" data-testid="submit-barter-btn">{editing ? 'Saxla' : 'Yarat'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
