import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Plus, Search, Loader2, Pencil, Trash2, Filter, X,
  Clock, CheckCircle2, AlertTriangle, CircleDot, Calendar,
  Building2, User, ChevronDown, FileCheck
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TYPES = ['Maliyyə', 'Xidmət', 'Çatdırılma', 'Hüquqi', 'Tədbir', 'Təlim', 'Layihə', 'Digər'];
const STATUSES = [
  { value: 'Gözləyir', icon: Clock, color: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  { value: 'İcrada', icon: CircleDot, color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  { value: 'Tamamlandı', icon: CheckCircle2, color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  { value: 'Ləğv edildi', icon: X, color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
];

const emptyForm = {
  title: '', description: '', company_id: '', company_name: '', type: 'Xidmət',
  responsible_person: '', deadline: '', status: 'Gözləyir', priority: 'Orta',
  notes: '', completion_date: ''
};

export default function Obligations() {
  const [obligations, setObligations] = useState([]);
  const [stats, setStats] = useState({});
  const [companies, setCompanies] = useState([]);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ status: '', type: '', responsible_person: '', priority: '' });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [oblRes, statsRes, cmpRes, optRes] = await Promise.all([
        axios.get(`${API}/obligations`, { headers }),
        axios.get(`${API}/obligations/stats`, { headers }),
        axios.get(`${API}/options/companies`, { headers }),
        axios.get(`${API}/options/all`, { headers }),
      ]);
      setObligations(oblRes.data);
      setStats(statsRes.data);
      setCompanies(cmpRes.data);
      setOptions(optRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openModal = (obl = null) => {
    if (obl) { setEditing(obl); setForm({ ...obl }); }
    else { setEditing(null); setForm(emptyForm); }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await axios.put(`${API}/obligations/${editing.id}`, form, { headers });
        toast.success('Öhdəlik yeniləndi');
      } else {
        await axios.post(`${API}/obligations`, form, { headers });
        toast.success('Öhdəlik yaradıldı');
      }
      setShowModal(false);
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu öhdəliyi silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/obligations/${id}`, { headers });
      toast.success('Öhdəlik silindi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const quickStatus = async (obl, newStatus) => {
    try {
      const payload = { status: newStatus };
      if (newStatus === 'Tamamlandı') payload.completion_date = new Date().toISOString().split('T')[0];
      await axios.put(`${API}/obligations/${obl.id}`, payload, { headers });
      toast.success(`Status: ${newStatus}`);
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const isOverdue = (obl) => {
    if (!obl.deadline || obl.status === 'Tamamlandı' || obl.status === 'Ləğv edildi') return false;
    return obl.deadline < new Date().toISOString().split('T')[0];
  };

  const getDaysLeft = (deadline) => {
    if (!deadline) return null;
    const diff = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const filtered = obligations.filter(o => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      if (!o.title?.toLowerCase().includes(t) && !o.company_name?.toLowerCase().includes(t) && !o.responsible_person?.toLowerCase().includes(t)) return false;
    }
    if (filters.status && filters.status !== 'all' && o.status !== filters.status) return false;
    if (filters.type && filters.type !== 'all' && o.type !== filters.type) return false;
    if (filters.responsible_person && filters.responsible_person !== 'all' && o.responsible_person !== filters.responsible_person) return false;
    if (filters.priority && filters.priority !== 'all' && o.priority !== filters.priority) return false;
    return true;
  });

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="obligations-page">
      <Toaster position="top-right" richColors />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Öhdəliklər</h1>
          <p className="text-slate-500 text-sm mt-1">Müqavilə öhdəlikləri və icra izlənməsi</p>
        </div>
        <Button onClick={() => openModal()} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="add-obligation-btn">
          <Plus className="w-4 h-4 mr-1" />Yeni Öhdəlik
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">Cəmi</p>
          <p className="text-2xl font-bold text-[#3D4F6F]">{stats.total || 0}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500">Gözləyir</p>
          <p className="text-2xl font-bold text-slate-600">{stats.pending || 0}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-100">
          <p className="text-xs text-blue-500">İcrada</p>
          <p className="text-2xl font-bold text-blue-600">{stats.in_progress || 0}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 shadow-sm border border-green-100">
          <p className="text-xs text-green-500">Tamamlandı</p>
          <p className="text-2xl font-bold text-green-600">{stats.completed || 0}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 shadow-sm border border-red-100">
          <p className="text-xs text-red-500">Vaxtı keçmiş</p>
          <p className="text-2xl font-bold text-red-600">{stats.overdue || 0}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 sm:p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Öhdəlik, şirkət və ya məsul şəxs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" data-testid="obligation-search" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className={activeFilterCount > 0 ? 'border-[#9ACD32] bg-[#9ACD32]/10' : ''} data-testid="obligation-filter-toggle">
            <Filter className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Filtrlər</span>
            {activeFilterCount > 0 && <Badge className="ml-1 bg-[#9ACD32] text-[#3D4F6F] text-xs">{activeFilterCount}</Badge>}
          </Button>
        </div>
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Status</Label>
                <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Hamısı</SelectItem>
                    {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Tip</Label>
                <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Hamısı</SelectItem>
                    {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Məsul</Label>
                <Select value={filters.responsible_person} onValueChange={(v) => setFilters({ ...filters, responsible_person: v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Hamısı</SelectItem>
                    {options?.marsol_representatives?.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Prioritet</Label>
                <Select value={filters.priority} onValueChange={(v) => setFilters({ ...filters, priority: v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Hamısı</SelectItem>
                    <SelectItem value="Yüksək">Yüksək</SelectItem>
                    <SelectItem value="Orta">Orta</SelectItem>
                    <SelectItem value="Aşağı">Aşağı</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setFilters({ status: '', type: '', responsible_person: '', priority: '' })} className="mt-3 text-slate-500 text-xs">
                <X className="w-3 h-3 mr-1" />Filtrləri təmizlə
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="obligations-table">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Öhdəlik</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Şirkət</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Tip</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Məsul</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Son tarix</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Prioritet</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Status</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Əməliyyat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400">
                  <FileCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Öhdəlik tapılmadı</p>
                </td></tr>
              ) : (
                filtered.map(obl => {
                  const overdue = isOverdue(obl);
                  const daysLeft = getDaysLeft(obl.deadline);
                  const statusDef = STATUSES.find(s => s.value === obl.status) || STATUSES[0];
                  return (
                    <tr key={obl.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${overdue ? 'bg-red-50/30' : ''}`} data-testid={`obligation-row-${obl.id}`}>
                      <td className="px-3 py-3">
                        <p className="font-medium text-sm text-[#3D4F6F]">{obl.title}</p>
                        {obl.description && <p className="text-xs text-slate-500 max-w-[200px] truncate">{obl.description}</p>}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">{obl.company_name || '-'}</td>
                      <td className="px-3 py-3"><Badge className="bg-slate-100 text-slate-700 text-xs">{obl.type}</Badge></td>
                      <td className="px-3 py-3 text-xs text-slate-600">{obl.responsible_person || '-'}</td>
                      <td className="px-3 py-3">
                        <p className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-slate-600'}`}>{obl.deadline || '-'}</p>
                        {daysLeft !== null && obl.status !== 'Tamamlandı' && obl.status !== 'Ləğv edildi' && (
                          <p className={`text-[10px] ${daysLeft < 0 ? 'text-red-500 font-bold' : daysLeft <= 7 ? 'text-amber-500' : 'text-slate-400'}`}>
                            {daysLeft < 0 ? `${Math.abs(daysLeft)} gün keçib` : daysLeft === 0 ? 'Bu gün' : `${daysLeft} gün qalıb`}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge className={`text-xs ${obl.priority === 'Yüksək' ? 'bg-red-100 text-red-700' : obl.priority === 'Aşağı' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>{obl.priority}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${statusDef.color} hover:opacity-80 transition-opacity`} data-testid={`status-btn-${obl.id}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${statusDef.dot}`} />
                              {obl.status}
                              <ChevronDown className="w-3 h-3 opacity-60" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {STATUSES.map(s => (
                              <DropdownMenuItem key={s.value} onClick={() => quickStatus(obl, s.value)} className={obl.status === s.value ? 'font-bold' : ''}>
                                <div className={`w-2 h-2 rounded-full ${s.dot} mr-2`} />{s.value}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openModal(obl)} data-testid={`edit-obligation-${obl.id}`}><Pencil className="w-3.5 h-3.5 text-slate-500" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(obl.id)} data-testid={`delete-obligation-${obl.id}`}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>{editing ? 'Öhdəliyi redaktə et' : 'Yeni Öhdəlik'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="obligation-form">
            <div>
              <Label className="text-xs">Başlıq *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="text-sm" data-testid="obligation-title-input" />
            </div>
            <div>
              <Label className="text-xs">Təsvir</Label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full min-h-[60px] p-2 text-sm border rounded-lg resize-none" placeholder="Ətraflı təsvir..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Şirkət</Label>
                <Select value={form.company_id} onValueChange={(v) => {
                  const c = companies.find(x => x.id === v);
                  setForm({ ...form, company_id: v, company_name: c?.brand_name || '' });
                }}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.brand_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tip *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Məsul şəxs</Label>
                <Select value={form.responsible_person} onValueChange={(v) => setForm({ ...form, responsible_person: v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{options?.marsol_representatives?.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Son tarix *</Label>
                <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} required className="text-sm" data-testid="obligation-deadline-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Prioritet</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yüksək">Yüksək</SelectItem>
                    <SelectItem value="Orta">Orta</SelectItem>
                    <SelectItem value="Aşağı">Aşağı</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Qeydlər</Label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full min-h-[50px] p-2 text-sm border rounded-lg resize-none" placeholder="Əlavə qeydlər..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Ləğv et</Button>
              <Button type="submit" className="bg-[#3D4F6F] hover:bg-[#2A364C] text-white" data-testid="obligation-submit-btn">{editing ? 'Yadda saxla' : 'Yarat'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
