import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Loader2, Search, Pencil, Trash2, Download, UserPlus, ArrowRight, Filter } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';
import { usePermissions, canEdit } from '../context/PermissionContext';
import { validateRequired } from '../lib/validate';
import * as XLSX from 'xlsx';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const INV_STATUSES = ['Dəvət edilib', 'Gələcəm', 'Gəlməyəcəm', 'İştirak etdi'];
const STATUS_COLORS = { 'Dəvət edilib': 'bg-blue-100 text-blue-700', 'Gələcəm': 'bg-amber-100 text-amber-700', 'Gəlməyəcəm': 'bg-red-100 text-red-700', 'İştirak etdi': 'bg-green-100 text-green-700' };

export default function Invitations() {
  const [invitations, setInvitations] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ event_id: '', event_name: '', guest_name: '', guest_company: '', guest_position: '', guest_phone: '', guest_email: '', notes: '' });
  const [filterEvent, setFilterEvent] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'sales');
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [iRes, eRes] = await Promise.all([
        axios.get(`${API}/event-invitations`, { headers }),
        axios.get(`${API}/project-events`, { headers }),
      ]);
      setInvitations(iRes.data); setEvents(eRes.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateRequired([
      [form.event_id, 'Tədbir'],
      [form.guest_name, 'Qonaq adı'],
    ])) return;
    try {
      const payload = { ...form };
      if (!payload.event_name) { const ev = events.find(x => x.id === payload.event_id); if (ev) payload.event_name = ev.name; }
      if (editing) { await axios.put(`${API}/event-invitations/${editing.id}`, payload, { headers }); toast.success('Yeniləndi'); }
      else { await axios.post(`${API}/event-invitations`, payload, { headers }); toast.success('Qonaq əlavə edildi'); }
      setShowModal(false); fetchData();
    } catch { toast.error('Xəta'); }
  };

  const handleStatusChange = async (id, status, reason = '') => {
    try {
      const data = { status };
      if (status === 'Gəlməyəcəm') { const r = prompt('Səbəb:'); if (r) data.decline_reason = r; }
      await axios.put(`${API}/event-invitations/${id}`, data, { headers }); toast.success('Status yeniləndi'); fetchData();
    } catch { toast.error('Xəta'); }
  };

  const handleConvert = async (id) => {
    try { const res = await axios.post(`${API}/event-invitations/${id}/convert-to-lead`, {}, { headers }); toast.success(`Lead yaradıldı: ${res.data.lead_code}`); fetchData(); }
    catch { toast.error('Xəta'); }
  };

  const filtered = invitations.filter(i => {
    if (filterEvent !== 'all' && i.event_id !== filterEvent) return false;
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    if (searchTerm) { const t = searchTerm.toLowerCase(); if (!i.guest_name?.toLowerCase().includes(t) && !i.guest_company?.toLowerCase().includes(t) && !i.guest_phone?.includes(t)) return false; }
    return true;
  });

  const exportToExcel = () => {
    const data = filtered.map(i => ({ 'Qonaq': i.guest_name, 'Şirkət': i.guest_company, 'Vəzifə': i.guest_position, 'Telefon': i.guest_phone, 'Email': i.guest_email, 'Tədbir': i.event_name, 'Status': i.status, 'Dəvət edən': i.invited_by, 'Səbəb': i.decline_reason || '' }));
    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Dəvətlər');
    XLSX.writeFile(wb, `devetler_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F]" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="invitations-page">
      <Toaster position="top-right" richColors />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div><h1 className="text-xl sm:text-2xl font-bold text-[#3D4F6F]">Dəvətlər</h1><p className="text-slate-500 text-sm mt-1">{filtered.length} qonaq</p></div>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} variant="outline" className="text-[#3D4F6F]"><Download className="w-4 h-4 mr-1" />Excel</Button>
          {_canEdit && <Button onClick={() => { setEditing(null); setForm({ event_id: '', event_name: '', guest_name: '', guest_company: '', guest_position: '', guest_phone: '', guest_email: '', notes: '' }); setShowModal(true); }} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold"><Plus className="w-4 h-4 mr-1" />Qonaq əlavə et</Button>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {INV_STATUSES.map(s => { const count = invitations.filter(i => i.status === s && (filterEvent === 'all' || i.event_id === filterEvent)).length; return (
          <div key={s} className={`rounded-lg p-2.5 border cursor-pointer ${filterStatus === s ? 'ring-2 ring-[#3D4F6F]' : ''} ${STATUS_COLORS[s]}`} onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}>
            <p className="text-lg font-bold">{count}</p><p className="text-[10px] font-medium">{s}</p>
          </div>
        ); })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-3 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[150px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Axtar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 text-sm" /></div>
        <Select value={filterEvent} onValueChange={setFilterEvent}><SelectTrigger className="w-[200px] text-sm h-9"><SelectValue placeholder="Tədbir" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Bütün tədbirlər</SelectItem>{events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-[150px] text-sm h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Bütün statuslar</SelectItem>{INV_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-slate-50 border-b">
              <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Qonaq</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Şirkət</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Tədbir</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Status</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Dəvət edən</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]"></th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">Qonaq tapılmadı</td></tr> :
              filtered.map(inv => (
                <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-3 py-2.5">
                    <p className="text-sm font-medium text-[#3D4F6F]">{inv.guest_name}</p>
                    {inv.guest_position && <p className="text-[10px] text-slate-400">{inv.guest_position}</p>}
                    {inv.guest_phone && <p className="text-[10px] text-slate-400">{inv.guest_phone}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-600">{inv.guest_company}</td>
                  <td className="px-3 py-2.5"><Badge className="bg-slate-100 text-slate-600 text-[10px]">{inv.event_name}</Badge></td>
                  <td className="px-3 py-2.5">
                    {_canEdit ? (
                      <Select value={inv.status} onValueChange={v => handleStatusChange(inv.id, v)}>
                        <SelectTrigger className={`text-xs h-7 w-[130px] border-0 ${STATUS_COLORS[inv.status]}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{INV_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <Badge className={STATUS_COLORS[inv.status]}>{inv.status}</Badge>}
                    {inv.decline_reason && <p className="text-[10px] text-red-400 mt-0.5">Səbəb: {inv.decline_reason}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{inv.invited_by}</td>
                  <td className="px-3 py-2.5 text-right">
                    {_canEdit && <div className="flex justify-end gap-1">
                      {!inv.converted_to_lead && <button onClick={() => handleConvert(inv.id)} className="p-1.5 hover:bg-green-50 rounded-lg" title="Lead-ə çevir"><ArrowRight className="w-3.5 h-3.5 text-green-500" /></button>}
                      {inv.converted_to_lead && <Badge className="bg-green-50 text-green-600 text-[10px]">Lead</Badge>}
                      <button onClick={() => { setEditing(inv); setForm({...inv}); setShowModal(true); }} className="p-1.5 hover:bg-slate-100 rounded-lg"><Pencil className="w-3.5 h-3.5 text-slate-400" /></button>
                      <button onClick={async () => { if (!window.confirm('Silmək?')) return; await axios.delete(`${API}/event-invitations/${inv.id}`, { headers }); toast.success('Silindi'); fetchData(); }} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[#3D4F6F]">{editing ? 'Redaktə' : 'Qonaq əlavə et'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div><Label className="text-xs">Tədbir *</Label>
              <Select value={form.event_id} onValueChange={v => { const ev = events.find(x => x.id === v); setForm({...form, event_id: v, event_name: ev?.name || ''}); }}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>{events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Qonaq adı *</Label><Input value={form.guest_name} onChange={e => setForm({...form, guest_name: e.target.value})} required className="text-sm" /></div>
              <div><Label className="text-xs">Şirkət</Label><Input value={form.guest_company} onChange={e => setForm({...form, guest_company: e.target.value})} className="text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Vəzifə</Label><Input value={form.guest_position} onChange={e => setForm({...form, guest_position: e.target.value})} className="text-sm" /></div>
              <div><Label className="text-xs">Telefon</Label><Input value={form.guest_phone} onChange={e => setForm({...form, guest_phone: e.target.value})} className="text-sm" /></div>
            </div>
            <div><Label className="text-xs">Email</Label><Input value={form.guest_email} onChange={e => setForm({...form, guest_email: e.target.value})} className="text-sm" /></div>
            <div><Label className="text-xs">Qeyd</Label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full min-h-[30px] p-2 text-sm border rounded-lg resize-none" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowModal(false)}>Ləğv et</Button><Button type="submit" className="bg-[#3D4F6F] text-white">{editing ? 'Saxla' : 'Əlavə et'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
