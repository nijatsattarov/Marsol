import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Plus, Search, Loader2, Pencil, Trash2, X, Download, Phone, Mail,
  Calendar, Building2, User, BarChart3, ArrowRight, Filter, LayoutGrid, List,
  TrendingUp, TrendingDown, Target, HandshakeIcon, Ban
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';
import * as XLSX from 'xlsx';
import { usePermissions, canEdit } from '../context/PermissionContext';
import { DatePickerAz, TimeSelectAz } from '../components/DateTimePickerAz';
import { validateRequired } from '../lib/validate';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUSES = ['Yeni', 'Əlaqə quruldu', 'Görüş təyin edildi', 'Təklif göndərildi', 'Danışıqda', 'Üzv oldu', 'Satıldı', 'İmtina'];
const STATUS_COLORS = {
  'Yeni': 'bg-slate-100 text-slate-700',
  'Əlaqə quruldu': 'bg-blue-100 text-blue-700',
  'Görüş təyin edildi': 'bg-amber-100 text-amber-700',
  'Təklif göndərildi': 'bg-purple-100 text-purple-700',
  'Danışıqda': 'bg-cyan-100 text-cyan-700',
  'Üzv oldu': 'bg-green-100 text-green-700',
  'Satıldı': 'bg-emerald-100 text-emerald-700',
  'İmtina': 'bg-red-100 text-red-700',
};

const emptyForm = {
  company_name: '', contact_name: '', position: '', phone: '', email: '',
  source: '', sale_type: '', status: 'Yeni', notes: '',
  project_id: '', package: '', kv_m: '', price_per_sqm: '', stand_number: '', hall_number: '',
  total_amount: '', participant_count: '', marsol_company: '', curator: ''
};

const emptyMeetingForm = { date: '', time: '', meeting_type: 'Müştəri görüşü', meeting_mode: 'Offline', location: '', notes: '' };

export default function CompanyDatabase() {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({});
  const [options, setOptions] = useState({ lead_sources: [], meeting_types: [] });
  const [projectTypes, setProjectTypes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [packages, setPackages] = useState([]);
  const [marsolCompanies, setMarsolCompanies] = useState([]);
  const [marsolReps, setMarsolReps] = useState([]);
  const [existingCompanies, setExistingCompanies] = useState([]);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [meetingLead, setMeetingLead] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [meetingForm, setMeetingForm] = useState(emptyMeetingForm);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table');

  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'sales');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [lRes, sRes, oRes, ptRes, pRes, pkgRes, mcRes, cRes] = await Promise.all([
        axios.get(`${API}/sales-leads`, { headers }),
        axios.get(`${API}/sales-leads/stats`, { headers }),
        axios.get(`${API}/options/all`, { headers }),
        axios.get(`${API}/settings/projects`, { headers }),
        axios.get(`${API}/project-events`, { headers }),
        axios.get(`${API}/settings/packages`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/settings/marsol-companies`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/companies?limit=2000`, { headers }).catch(() => ({ data: [] })),
      ]);
      setLeads(lRes.data);
      setStats(sRes.data);
      setOptions(oRes.data);
      setMarsolReps(oRes.data?.marsol_representatives || []);
      setProjectTypes(ptRes.data || []);
      setProjects(pRes.data || []);
      setPackages(pkgRes.data || []);
      setMarsolCompanies(mcRes.data || []);
      setExistingCompanies(cRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openModal = (lead = null) => {
    if (lead) { setEditing(lead); setForm({ ...emptyForm, ...lead }); }
    else { setEditing(null); setForm(emptyForm); }
    setShowModal(true);
  };

  const openMeetingModal = (lead) => {
    setMeetingLead(lead);
    setMeetingForm(emptyMeetingForm);
    setShowMeetingModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const rules = [
      [form.company_name, 'Şirkət adı'],
      [form.contact_name, 'Əlaqədar şəxs'],
      [form.sale_type, 'Layihə növü'],
    ];
    if (editing && isSoldStatus && form.sale_type) {
      rules.push([form.project_id, 'Hansı layihə?']);
      if (form.sale_type === 'Üzvlük') rules.push([form.package, 'Paket']);
    }
    if (!validateRequired(rules)) return;
    try {
      if (editing) {
        await axios.put(`${API}/sales-leads/${editing.id}`, form, { headers });
        toast.success('Lead yeniləndi');
      } else {
        await axios.post(`${API}/sales-leads`, form, { headers });
        toast.success('Yeni lead əlavə edildi');
      }
      setShowModal(false);
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleMeetingSubmit = async (e) => {
    e.preventDefault();
    if (!validateRequired([
      [meetingForm.date, 'Tarix'],
      [meetingForm.time, 'Saat'],
    ])) return;
    try {
      await axios.post(`${API}/sales-leads/${meetingLead.id}/create-meeting`, meetingForm, { headers });
      toast.success('Görüş yaradıldı və Görüşlər moduluna əlavə edildi');
      setShowMeetingModal(false);
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu lead-i silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/sales-leads/${id}`, { headers });
      toast.success('Lead silindi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleStatusChange = async (lead, newStatus) => {
    try {
      await axios.put(`${API}/sales-leads/${lead.id}`, { status: newStatus, sale_type: lead.sale_type }, { headers });
      if (newStatus === 'Üzv oldu') toast.success('Üzv oldu! Şirkət Məlumatlarına əlavə edildi');
      else if (newStatus === 'Satıldı') toast.success('Satış tamamlandı!');
      else toast.success('Status yeniləndi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const getAvailableStatuses = (lead) => {
    const base = ['Yeni', 'Əlaqə quruldu', 'Görüş təyin edildi', 'Təklif göndərildi', 'Danışıqda', 'İmtina'];
    if (lead.sale_type === 'Üzvlük') return [...base, 'Üzv oldu'];
    return [...base, 'Satıldı'];
  };

  // Auto-fill price_per_sqm / total_amount from selected project when applicable
  const handleProjectSelect = (projectId) => {
    const proj = projects.find(p => p.id === projectId);
    const next = { ...form, project_id: projectId };
    if (proj && form.sale_type === 'Sərgi' && proj.price_per_sqm != null && !form.price_per_sqm) {
      next.price_per_sqm = proj.price_per_sqm;
      if (form.kv_m) {
        next.total_amount = Number(form.kv_m) * Number(proj.price_per_sqm);
      }
    }
    if (proj && (form.sale_type === 'Tur' || form.sale_type === 'Təlim') && proj.total_price != null && !form.total_amount) {
      next.total_amount = proj.total_price;
    }
    setForm(next);
  };

  const recalcTotal = (kv, price) => {
    const k = Number(kv) || 0;
    const p = Number(price) || 0;
    return k && p ? k * p : '';
  };

  // Projects that can be linked: Aktiv or Planlaşdırılır, matching lead's sale_type
  const projectsForSaleType = projects.filter(p =>
    (p.status === 'Aktiv' || p.status === 'Planlaşdırılır') &&
    (!form.sale_type || p.type === form.sale_type)
  );

  const isSoldStatus = form.status === 'Satıldı' || form.status === 'Üzv oldu';

  const openNewSaleForCompany = (lead) => {
    setEditing(null);
    setForm({ ...emptyForm, company_name: lead.company_name, contact_name: lead.contact_name, position: lead.position, phone: lead.phone, email: lead.email, sale_type: '' });
    setShowModal(true);
  };

  const filtered = leads.filter(l => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    if (filterSource !== 'all' && l.source !== filterSource) return false;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      if (!l.company_name?.toLowerCase().includes(t) && !l.contact_name?.toLowerCase().includes(t) &&
          !l.lead_code?.toLowerCase().includes(t) && !l.phone?.includes(t)) return false;
    }
    return true;
  });

  const sources = options.lead_sources || [];
  const meetingTypes = options.meeting_types || [];

  const exportToExcel = () => {
    if (filtered.length === 0) return toast.error('Export ucun melumat yoxdur');
    const wb = XLSX.utils.book_new();
    const data = filtered.map((l, i) => ({
      '#': i + 1, 'ID': l.lead_code, 'Şirkət': l.company_name, 'Əlaqədar şəxs': l.contact_name,
      'Vəzifə': l.position, 'Telefon': l.phone, 'Email': l.email,
      'Mənbə': l.source, 'Status': l.status, 'Kurator': l.curator, 'Qeyd': l.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 4 }, { wch: 8 }, { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 15 }, { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, `sirket_bazasi_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel yuklendi');
  };

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="company-database-page">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Təkliflər</h1>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} lead</p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 text-xs ${viewMode === 'table' ? 'bg-[#3D4F6F] text-white' : 'bg-white text-slate-500'}`} data-testid="view-table"><List className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('kanban')} className={`px-3 py-1.5 text-xs ${viewMode === 'kanban' ? 'bg-[#3D4F6F] text-white' : 'bg-white text-slate-500'}`} data-testid="view-kanban"><LayoutGrid className="w-4 h-4" /></button>
          </div>
          <Button onClick={exportToExcel} variant="outline" className="text-[#3D4F6F] border-[#3D4F6F]/20" data-testid="export-btn"><Download className="w-4 h-4 mr-1" />Excel</Button>
          <Button onClick={() => openModal()} style={{display: _canEdit ? '' : 'none'}} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="add-lead-btn"><Plus className="w-4 h-4 mr-1" />Yeni Lead</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
        {STATUSES.map(s => (
          <div key={s} className={`rounded-lg p-2.5 border cursor-pointer transition-all ${filterStatus === s ? 'ring-2 ring-[#3D4F6F]' : ''} ${STATUS_COLORS[s]?.replace('text-', 'border-').replace('bg-', 'bg-')}`} onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)} data-testid={`stat-${s}`}>
            <p className="text-lg font-bold">{stats[s] || 0}</p>
            <p className="text-[10px] font-medium truncate">{s}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Axtar (ID, şirkət, şəxs, telefon)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" data-testid="lead-search" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[170px] text-sm h-9" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün statuslar</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-[150px] text-sm h-9" data-testid="filter-source"><SelectValue placeholder="Mənbə" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün mənbələr</SelectItem>
              {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="leads-table">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">ID</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Şirkət</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Əlaqədar şəxs</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Əlaqə</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Mənbə</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Layihə növü</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Status</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Kurator</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400 text-sm">Lead tapılmadı</td></tr>
                ) : filtered.map(l => (
                  <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50" data-testid={`lead-row-${l.id}`}>
                    <td className="px-3 py-2.5"><Badge className="bg-[#3D4F6F] text-white text-xs font-mono">{l.lead_code}</Badge></td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-medium text-[#3D4F6F]">{l.company_name}</p>
                      {l.notes && <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{l.notes}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm text-slate-700">{l.contact_name}</p>
                      {l.position && <p className="text-[10px] text-slate-400">{l.position}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      {l.phone && <p className="text-xs text-slate-600 flex items-center gap-1"><Phone className="w-3 h-3" />{l.phone}</p>}
                      {l.email && <p className="text-[10px] text-slate-400 flex items-center gap-1"><Mail className="w-2.5 h-2.5" />{l.email}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      {l.source_contact_list_id ? (
                        <a
                          href={`/sales/contact-lists?list=${l.source_contact_list_id}`}
                          onClick={(e) => { e.preventDefault(); navigate(`/sales/contact-lists?list=${l.source_contact_list_id}`); }}
                          className="inline-flex items-center text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 hover:underline rounded px-1.5 py-0.5"
                          title="Bu siyahıya keç"
                          data-testid={`source-list-link-${l.id}`}
                        >
                          {l.source_contact_list_name ? `Siyahı: ${l.source_contact_list_name}` : (l.source || 'Siyahı')}
                        </a>
                      ) : (
                        l.source && <Badge className="bg-slate-100 text-slate-600 text-[10px]">{l.source}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className={`text-[10px] ${l.sale_type === 'Üzvlük' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>{l.sale_type || '-'}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {_canEdit ? (
                        <Select value={l.status} onValueChange={(v) => handleStatusChange(l, v)}>
                          <SelectTrigger className={`text-xs h-7 w-[140px] border-0 ${STATUS_COLORS[l.status] || ''}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{getAvailableStatuses(l).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[l.status] || ''}`}>{l.status}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{l.curator || <span className="text-slate-300 italic">—</span>}</td>
                    <td className="px-3 py-2.5 text-right">
                      {_canEdit && <div className="flex justify-end gap-1">
                        <button onClick={() => openNewSaleForCompany(l)} className="p-1.5 hover:bg-indigo-50 rounded-lg" title="Yeni satış" data-testid={`new-sale-btn-${l.id}`}>
                          <Plus className="w-3.5 h-3.5 text-indigo-500" />
                        </button>
                        <button onClick={() => openMeetingModal(l)} className="p-1.5 hover:bg-amber-50 rounded-lg" title="Görüş təyin et" data-testid={`meeting-btn-${l.id}`}>
                          <Calendar className="w-3.5 h-3.5 text-amber-500" />
                        </button>
                        <button onClick={() => openModal(l)} className="p-1.5 hover:bg-slate-100 rounded-lg" data-testid={`edit-lead-${l.id}`}>
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        <button onClick={() => handleDelete(l.id)} className="p-1.5 hover:bg-red-50 rounded-lg" data-testid={`delete-lead-${l.id}`}>
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4" data-testid="kanban-board">
          {STATUSES.map(status => {
            const items = filtered.filter(l => l.status === status);
            return (
              <div key={status} className="min-w-[240px] flex-shrink-0 bg-slate-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-3">
                  <Badge className={`text-xs ${STATUS_COLORS[status]}`}>{status}</Badge>
                  <span className="text-xs text-slate-400 font-mono">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map(l => (
                    <div key={l.id} className="bg-white rounded-lg p-3 shadow-sm border border-slate-100" data-testid={`kanban-card-${l.id}`}>
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-[10px] text-slate-400 font-mono">{l.lead_code}</span>
                        {_canEdit && <div className="flex gap-0.5">
                          <button onClick={() => openMeetingModal(l)} className="p-1 hover:bg-amber-50 rounded" title="Görüş təyin et"><Calendar className="w-3 h-3 text-amber-500" /></button>
                          <button onClick={() => openModal(l)} className="p-1 hover:bg-slate-100 rounded"><Pencil className="w-3 h-3 text-slate-400" /></button>
                        </div>}
                      </div>
                      <p className="text-sm font-medium text-[#3D4F6F] mb-1">{l.company_name}</p>
                      <p className="text-xs text-slate-600">{l.contact_name}</p>
                      {l.position && <p className="text-[10px] text-slate-400">{l.position}</p>}
                      <div className="flex items-center justify-between mt-2">
                        {l.source && <Badge className="bg-slate-100 text-slate-500 text-[10px]">{l.source}</Badge>}
                        {l.phone && <span className="text-[10px] text-slate-400">{l.phone}</span>}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-center text-xs text-slate-400 py-4">Boş</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lead Form Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle style={{ color: '#3D4F6F' }}>{editing ? 'Lead redaktə et' : 'Yeni Lead'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3" data-testid="lead-form">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Şirkət adı *</Label>
                  <button
                    type="button"
                    onClick={() => setCompanyPickerOpen(true)}
                    className="text-[10px] text-[#3D4F6F] underline hover:text-[#2c3a55]"
                    data-testid="pick-existing-company"
                  >
                    Bazadan seç
                  </button>
                </div>
                <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required className="text-sm" data-testid="lead-company" />
              </div>
              <div>
                <Label className="text-xs">Əlaqədar şəxs *</Label>
                <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} required className="text-sm" data-testid="lead-contact" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Vəzifə</Label>
                <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Layihə növü *</Label>
                <Select value={form.sale_type} onValueChange={(v) => setForm({ ...form, sale_type: v, project_id: '', package: '', kv_m: '', price_per_sqm: '', stand_number: '', hall_number: '', total_amount: '', participant_count: '' })}>
                  <SelectTrigger className="text-sm" data-testid="lead-sale-type"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{projectTypes.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Mənbə</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger className="text-sm" data-testid="lead-source-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                {form.source_contact_list_name && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5" data-testid="source-list-info">
                    Siyahı: <span className="font-semibold">{form.source_contact_list_name}</span>
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs">Kurator</Label>
                <Select value={form.curator || '__none__'} onValueChange={(v) => setForm({ ...form, curator: v === '__none__' ? '' : v })}>
                  <SelectTrigger className="text-sm" data-testid="lead-curator-select"><SelectValue placeholder="Kurator seçin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Seçilməyib —</SelectItem>
                    {marsolReps.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Telefon</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="text-sm" type="email" />
              </div>
            </div>
            {editing && (
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="text-sm" data-testid="lead-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {/* SOLD-STATE DYNAMIC FIELDS */}
            {editing && isSoldStatus && form.sale_type && (
              <div className="border-t pt-3 mt-2 space-y-3 bg-emerald-50/30 rounded-lg p-3" data-testid="sold-fields">
                <p className="text-xs font-semibold text-emerald-700">Satış təfərrüatları — {form.sale_type}</p>

                {/* Project selector (not for membership-only when no project needed, but user wants it) */}
                <div>
                  <Label className="text-xs">Hansı layihə? *</Label>
                  <Select value={form.project_id} onValueChange={handleProjectSelect}>
                    <SelectTrigger className="text-sm" data-testid="lead-project-select"><SelectValue placeholder="Aktiv / Planlaşdırılan layihələr" /></SelectTrigger>
                    <SelectContent>
                      {projectsForSaleType.length === 0
                        ? <SelectItem value="__none" disabled>Uyğun layihə yoxdur</SelectItem>
                        : projectsForSaleType.map(p => <SelectItem key={p.id} value={p.id}>{p.name} <span className="text-[10px] text-slate-400 ml-1">({p.status})</span></SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                </div>

                {/* Membership: Package selector */}
                {form.sale_type === 'Üzvlük' && (
                  <div>
                    <Label className="text-xs">Paket *</Label>
                    <Select value={form.package} onValueChange={(v) => setForm({ ...form, package: v })}>
                      <SelectTrigger className="text-sm" data-testid="lead-package-select"><SelectValue placeholder="Paket seçin" /></SelectTrigger>
                      <SelectContent>
                        {packages.length === 0
                          ? <SelectItem value="__none" disabled>Paket yoxdur</SelectItem>
                          : packages.map(p => <SelectItem key={p.id} value={p.name}>{p.name}{p.price ? ` — ${p.price} AZN` : ''}</SelectItem>)
                        }
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Exhibition: sqm fields */}
                {form.sale_type === 'Sərgi' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">kv/m *</Label>
                        <Input type="number" value={form.kv_m} onChange={(e) => {
                          const v = e.target.value;
                          setForm({ ...form, kv_m: v, total_amount: recalcTotal(v, form.price_per_sqm) });
                        }} className="text-sm" data-testid="lead-kvm-input" />
                      </div>
                      <div>
                        <Label className="text-xs">kv/m qiyməti (AZN)</Label>
                        <Input type="number" value={form.price_per_sqm} onChange={(e) => {
                          const v = e.target.value;
                          setForm({ ...form, price_per_sqm: v, total_amount: recalcTotal(form.kv_m, v) });
                        }} className="text-sm" data-testid="lead-price-input" placeholder="Layihədən avtomatik və ya əllə" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Stend nömrəsi</Label>
                        <Input value={form.stand_number} onChange={(e) => setForm({ ...form, stand_number: e.target.value })} className="text-sm" data-testid="lead-stand-input" />
                      </div>
                      <div>
                        <Label className="text-xs">Zal nömrəsi</Label>
                        <Input value={form.hall_number} onChange={(e) => setForm({ ...form, hall_number: e.target.value })} className="text-sm" data-testid="lead-hall-input" />
                      </div>
                    </div>
                  </>
                )}

                {/* Tour / Training: participant count (optional) */}
                {(form.sale_type === 'Tur' || form.sale_type === 'Təlim') && (
                  <div>
                    <Label className="text-xs">İştirakçı sayı</Label>
                    <Input type="number" value={form.participant_count} onChange={(e) => setForm({ ...form, participant_count: e.target.value })} className="text-sm" data-testid="lead-participant-input" />
                  </div>
                )}

                {/* Common amount */}
                <div>
                  <Label className="text-xs">Yekun məbləğ (AZN) *</Label>
                  <Input type="number" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} className="text-sm font-semibold" data-testid="lead-total-input" />
                </div>

                {/* Marsol entity (which Marsol company signs the contract) */}
                <div>
                  <Label className="text-xs">Müqavilə Marsol müəssisəsi *</Label>
                  <Select value={form.marsol_company || ''} onValueChange={(v) => setForm({ ...form, marsol_company: v })}>
                    <SelectTrigger className="text-sm" data-testid="lead-marsol-company"><SelectValue placeholder="Müəssisə seçin" /></SelectTrigger>
                    <SelectContent>
                      {marsolCompanies.length === 0
                        ? <SelectItem value="__none" disabled>Müəssisə yoxdur — Tənzimləmələrdə əlavə edin</SelectItem>
                        : marsolCompanies.map(m => <SelectItem key={m.id || m.name} value={m.name}>{m.name}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs">Qeyd</Label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full min-h-[40px] p-2 text-sm border rounded-lg resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Ləğv et</Button>
              <Button type="submit" className="bg-[#3D4F6F] hover:bg-[#2A364C] text-white" data-testid="lead-submit-btn">{editing ? 'Yadda saxla' : 'Əlavə et'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Meeting Modal */}
      <Dialog open={showMeetingModal} onOpenChange={setShowMeetingModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle style={{ color: '#3D4F6F' }}>Görüş təyin et</DialogTitle></DialogHeader>
          {meetingLead && (
            <div className="bg-slate-50 rounded-lg p-3 mb-3 border">
              <p className="text-sm font-medium text-[#3D4F6F]">{meetingLead.company_name}</p>
              <p className="text-xs text-slate-500">{meetingLead.contact_name} {meetingLead.position ? `- ${meetingLead.position}` : ''}</p>
            </div>
          )}
          <form onSubmit={handleMeetingSubmit} className="space-y-3" data-testid="meeting-from-lead-form">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tarix *</Label>
                <DatePickerAz value={meetingForm.date} onChange={(v) => setMeetingForm({ ...meetingForm, date: v })} required testId="meeting-date" />
              </div>
              <div>
                <Label className="text-xs">Saat *</Label>
                <TimeSelectAz value={meetingForm.time} onChange={(v) => setMeetingForm({ ...meetingForm, time: v })} required testId="meeting-time" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Görüş növü</Label>
                <Select value={meetingForm.meeting_type} onValueChange={(v) => setMeetingForm({ ...meetingForm, meeting_type: v })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{meetingTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Rejim</Label>
                <Select value={meetingForm.meeting_mode} onValueChange={(v) => setMeetingForm({ ...meetingForm, meeting_mode: v })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Online">Online</SelectItem>
                    <SelectItem value="Offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Məkan / Link</Label>
              <Input value={meetingForm.location} onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })} className="text-sm" placeholder={meetingForm.meeting_mode === 'Online' ? 'Zoom/Teams linki' : 'Ünvan'} />
            </div>
            <div>
              <Label className="text-xs">Qeyd</Label>
              <textarea value={meetingForm.notes} onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })} className="w-full min-h-[30px] p-2 text-sm border rounded-lg resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowMeetingModal(false)}>Ləğv et</Button>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white" data-testid="create-meeting-btn">
                <Calendar className="w-4 h-4 mr-1" />Görüş yarat
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Şirkət bazasından seç (existing Companies module picker) */}
      <Dialog open={companyPickerOpen} onOpenChange={(v) => { setCompanyPickerOpen(v); if (!v) setPickerSearch(''); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" data-testid="company-picker-dialog">
          <DialogHeader>
            <DialogTitle>Şirkət bazasından seç</DialogTitle>
          </DialogHeader>
          <div className="pb-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Şirkət, sahibkar və ya telefon üzrə axtar..."
                className="pl-8 h-9 text-sm"
                data-testid="company-picker-search"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">{
              (() => {
                const q = pickerSearch.trim().toLowerCase();
                const count = q ? existingCompanies.filter(c =>
                  (c.brand_name || '').toLowerCase().includes(q) ||
                  (c.legal_name || '').toLowerCase().includes(q) ||
                  (c.owner_name || '').toLowerCase().includes(q) ||
                  (c.owner_phone || '').toLowerCase().includes(q) ||
                  (c.company_phone || '').toLowerCase().includes(q)
                ).length : existingCompanies.length;
                return `${count} şirkət göstərilir`;
              })()
            }</p>
          </div>
          <div className="overflow-y-auto flex-1 -mx-2 px-2">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left text-xs text-slate-600">
                  <th className="p-2">Şirkət</th>
                  <th className="p-2">Sahibkar</th>
                  <th className="p-2">Telefon</th>
                  <th className="p-2 text-right">Seç</th>
                </tr>
              </thead>
              <tbody>
                {existingCompanies
                  .filter(c => {
                    const q = pickerSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      (c.brand_name || '').toLowerCase().includes(q) ||
                      (c.legal_name || '').toLowerCase().includes(q) ||
                      (c.owner_name || '').toLowerCase().includes(q) ||
                      (c.owner_phone || '').toLowerCase().includes(q) ||
                      (c.company_phone || '').toLowerCase().includes(q)
                    );
                  })
                  .map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`picker-row-${c.id}`}>
                    <td className="p-2 font-medium text-[#3D4F6F]">{c.brand_name || c.legal_name}</td>
                    <td className="p-2 text-slate-600">{c.owner_name || '-'}</td>
                    <td className="p-2 text-slate-600 font-mono text-xs">{c.owner_phone || c.company_phone || '-'}</td>
                    <td className="p-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setForm(prev => ({
                            ...prev,
                            company_name: c.brand_name || c.legal_name || '',
                            contact_name: c.owner_name || prev.contact_name,
                            phone: c.owner_phone || c.company_phone || prev.phone,
                            email: c.owner_email || c.company_email || prev.email,
                          }));
                          setCompanyPickerOpen(false);
                          setPickerSearch('');
                          toast.success('Şirkət seçildi');
                        }}
                        className="h-7 text-xs"
                        data-testid={`picker-select-${c.id}`}
                      >
                        Seç
                      </Button>
                    </td>
                  </tr>
                ))}
                {existingCompanies.length === 0 && (
                  <tr><td colSpan={4} className="text-center p-6 text-slate-400">Şirkət bazası boşdur</td></tr>
                )}
                {existingCompanies.length > 0 && existingCompanies.filter(c => {
                  const q = pickerSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    (c.brand_name || '').toLowerCase().includes(q) ||
                    (c.legal_name || '').toLowerCase().includes(q) ||
                    (c.owner_name || '').toLowerCase().includes(q) ||
                    (c.owner_phone || '').toLowerCase().includes(q) ||
                    (c.company_phone || '').toLowerCase().includes(q)
                  );
                }).length === 0 && (
                  <tr><td colSpan={4} className="text-center p-6 text-slate-400">Axtarışa uyğun şirkət tapılmadı</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500 pt-2 border-t">İpucu: Bazada olmayan şirkət üçün pəncərəni bağla və Şirkət adı xanasına manual daxil et.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
