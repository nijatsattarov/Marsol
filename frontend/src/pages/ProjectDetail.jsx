import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Search, Loader2, Pencil, Filter, X, Calendar, MapPin, Target, Download } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';
import * as XLSX from 'xlsx';
import { usePermissions, canEdit } from '../context/PermissionContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Per-type table configs: column key, label, type
const TABLE_CONFIGS = {
  'Sərgi': [
    { key: 'lead_code', label: 'ID', type: 'text', readonly: true },
    { key: 'company_name', label: 'Şirkət', type: 'text' },
    { key: 'contact_name', label: 'Sahibkar', type: 'text' },
    { key: 'phone', label: 'Telefon', type: 'text' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'sector', label: 'Sektor', type: 'text', readonly: true },
    { key: 'sub_sector', label: 'Alt sektor', type: 'text', readonly: true },
    { key: 'stand_number', label: 'Stend №', type: 'text' },
    { key: 'kv_m', label: 'kv/m', type: 'number' },
    { key: 'hall_number', label: 'Zal №', type: 'text' },
    { key: 'total_amount', label: 'Məbləğ', type: 'number' },
  ],
  'Tur': [
    { key: 'lead_code', label: 'ID', type: 'text', readonly: true },
    { key: 'company_name', label: 'Şirkət', type: 'text' },
    { key: 'contact_name', label: 'Sahibkar', type: 'text' },
    { key: 'phone', label: 'Əlaqə №', type: 'text' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'total_amount', label: 'Məbləğ', type: 'number' },
    { key: 'notes', label: 'Qeyd', type: 'text' },
  ],
  'Təlim': [
    { key: 'lead_code', label: 'ID', type: 'text', readonly: true },
    { key: 'company_name', label: 'Şirkət', type: 'text' },
    { key: 'contact_name', label: 'Sahibkar', type: 'text' },
    { key: 'phone', label: 'Əlaqə №', type: 'text' },
    { key: 'total_amount', label: 'Məbləğ', type: 'number' },
    { key: 'notes', label: 'Qeyd', type: 'text' },
  ],
};

const DEFAULT_COLS = [
  { key: 'lead_code', label: 'ID', type: 'text', readonly: true },
  { key: 'company_name', label: 'Şirkət', type: 'text' },
  { key: 'contact_name', label: 'Sahibkar', type: 'text' },
  { key: 'phone', label: 'Əlaqə', type: 'text' },
  { key: 'total_amount', label: 'Məbləğ', type: 'number' },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'projects');

  const [event, setEvent] = useState(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({});
  const [editing, setEditing] = useState(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const columns = useMemo(() => (event && TABLE_CONFIGS[event.type]) || DEFAULT_COLS, [event]);

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/project-events/${id}/sales`, { headers });
      setEvent(res.data.event);
      setSales(res.data.sales || []);
    } catch { toast.error('Layihəni yükləmək mümkün olmadı'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return sales.filter(s => {
      if (term) {
        const hay = [s.company_name, s.contact_name, s.phone, s.email, s.lead_code, s.stand_number].map(x => (x || '').toLowerCase()).join(' ');
        if (!hay.includes(term)) return false;
      }
      for (const [k, v] of Object.entries(filters)) {
        if (!v) continue;
        const cell = (s[k] ?? '').toString().toLowerCase();
        if (!cell.includes(v.toLowerCase())) return false;
      }
      return true;
    });
  }, [sales, searchTerm, filters]);

  const activeFilterCount = Object.values(filters).filter(v => v && v.trim()).length;

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const payload = { ...editing };
      ['kv_m', 'price_per_sqm', 'total_amount', 'paid_amount', 'participant_count'].forEach(k => {
        if (payload[k] === '' || payload[k] == null) payload[k] = null;
        else payload[k] = Number(payload[k]);
      });
      await axios.put(`${API}/sales-leads/${editing.id}`, payload, { headers });
      toast.success('Yadda saxlandı');
      setEditing(null);
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const exportExcel = () => {
    if (filtered.length === 0) return toast.error('Export üçün məlumat yoxdur');
    const data = filtered.map(s => {
      const row = {};
      columns.forEach(c => { row[c.label] = s[c.key] ?? ''; });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Satışlar');
    XLSX.writeFile(wb, `${event?.name || 'layihə'}_satışlar.xlsx`);
    toast.success('Excel yükləndi');
  };

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F]" /></div>;
  if (!event) return <div className="p-8 text-center text-slate-400">Layihə tapılmadı</div>;

  const totalSum = filtered.reduce((s, x) => s + (Number(x.total_amount) || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="project-detail-page">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="mb-4">
        <button onClick={() => navigate('/projects')} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-[#3D4F6F] mb-3" data-testid="back-to-projects">
          <ArrowLeft className="w-3.5 h-3.5" /> Layihələrə qayıt
        </button>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#3D4F6F]">{event.name}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className="bg-slate-100 text-slate-700 text-[11px]">{event.type}</Badge>
                <Badge className={`text-[11px] ${event.status === 'Aktiv' ? 'bg-green-100 text-green-700' : event.status === 'Tamamlandı' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>{event.status}</Badge>
                {event.type === 'Sərgi' && event.price_per_sqm != null && <Badge className="bg-emerald-50 text-emerald-700 text-[11px]"><Target className="w-3 h-3 mr-0.5" />{event.price_per_sqm} AZN/m²</Badge>}
                {(event.type === 'Tur' || event.type === 'Təlim') && event.total_price != null && <Badge className="bg-emerald-50 text-emerald-700 text-[11px]">{event.total_price} AZN</Badge>}
                {event.date && <span className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" />{event.date}{event.end_date ? ` — ${event.end_date}` : ''}</span>}
                {event.location && <span className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>}
              </div>
            </div>
            <Button onClick={exportExcel} variant="outline" size="sm" className="text-[#3D4F6F] border-[#3D4F6F]/20" data-testid="detail-export-btn"><Download className="w-4 h-4 mr-1" />Excel</Button>
          </div>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 sm:p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Axtar (şirkət, sahibkar, telefon, email, stend, ID)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 text-sm" data-testid="detail-search" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className={activeFilterCount > 0 ? 'border-[#9ACD32] bg-[#9ACD32]/10' : ''} data-testid="detail-filter-toggle">
            <Filter className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Filtrlər</span>
            {activeFilterCount > 0 && <Badge className="ml-1 bg-[#9ACD32] text-[#3D4F6F] text-xs">{activeFilterCount}</Badge>}
          </Button>
        </div>
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {columns.filter(c => !c.readonly || c.key === 'sector' || c.key === 'sub_sector' || c.key === 'lead_code').map(c => (
                <div key={c.key}>
                  <Label className="text-xs text-slate-500 mb-1 block">{c.label}</Label>
                  <Input value={filters[c.key] || ''} onChange={e => setFilters({ ...filters, [c.key]: e.target.value })} className="text-sm h-8" placeholder={c.label} data-testid={`filter-${c.key}`} />
                </div>
              ))}
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setFilters({})} className="mt-3 text-slate-500 text-xs"><X className="w-3 h-3 mr-1" />Filtrləri təmizlə</Button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="detail-sales-table">
            <thead>
              <tr className="bg-slate-50 border-b">
                {columns.map(c => (
                  <th key={c.key} className={`${c.type === 'number' ? 'text-right' : 'text-left'} px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]`}>{c.label}</th>
                ))}
                <th className="text-right px-3 py-3 text-[11px] font-semibold text-[#3D4F6F]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={columns.length + 1} className="text-center py-12 text-slate-400 text-sm">Satış yoxdur</td></tr>
              ) : (
                filtered.map(s => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50" data-testid={`detail-row-${s.id}`}>
                    {columns.map(c => (
                      <td key={c.key} className={`${c.type === 'number' ? 'text-right font-medium' : ''} px-3 py-2 text-xs`}>
                        {c.key === 'lead_code' ? <Badge className="bg-slate-100 text-slate-700 text-[10px] font-mono">{s[c.key]}</Badge> : c.type === 'number' ? (s[c.key] != null ? Number(s[c.key]).toLocaleString() : '—') : (s[c.key] || '—')}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      {_canEdit && <button onClick={() => setEditing({ ...s })} className="p-1 hover:bg-slate-100 rounded" data-testid={`edit-sale-${s.id}`}><Pencil className="w-3.5 h-3.5 text-slate-500" /></button>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="p-3 bg-slate-50 border-t flex flex-wrap gap-4 text-xs text-slate-600">
            <span>Cəmi: <strong>{filtered.length}</strong> satış</span>
            <span>Ümumi məbləğ: <strong>{totalSum.toLocaleString()} AZN</strong></span>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-[#3D4F6F]">Satışı redaktə et</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              {columns.filter(c => !c.readonly).map(c => (
                <div key={c.key}>
                  <Label className="text-xs">{c.label}</Label>
                  <Input type={c.type === 'number' ? 'number' : 'text'} value={editing[c.key] ?? ''} onChange={e => setEditing({ ...editing, [c.key]: e.target.value })} className="text-sm" data-testid={`edit-field-${c.key}`} />
                </div>
              ))}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Ləğv et</Button>
                <Button type="button" className="bg-[#3D4F6F] text-white" onClick={saveEdit} data-testid="save-sale-btn">Saxla</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
