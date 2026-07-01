import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Loader2, Search, AlertTriangle, CheckCircle2, Clock,
  Building2, Filter, X, ChevronDown, Eye, ArrowUpDown,
  TrendingUp, Users2, Phone, PhoneOff, Download, Upload
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Toaster, toast } from 'sonner';
import * as XLSX from 'xlsx';
import { formatDate } from '../lib/dateUtils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Obligations() {
  const currentYear = new Date().getFullYear();
  const [data, setData] = useState({ obligations: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPackage, setFilterPackage] = useState('all');
  const [filterUrgency, setFilterUrgency] = useState('all');
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [sortBy, setSortBy] = useState('priority');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyDetail, setCompanyDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterYear && filterYear !== 'all') params.append('year', filterYear);
      const res = await axios.get(`${API}/obligations/dashboard?${params.toString()}`, { headers });
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filterYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDetail = async (companyId) => {
    setSelectedCompany(companyId);
    setDetailLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterYear && filterYear !== 'all') params.append('year', filterYear);
      const res = await axios.get(`${API}/obligations/company/${companyId}?${params.toString()}`, { headers });
      setCompanyDetail(res.data);
    } catch { toast.error('Xəta baş verdi'); }
    finally { setDetailLoading(false); }
  };

  const getUrgencyLevel = (obl) => {
    if (obl.remaining_quota === 0) return 'done';
    if (obl.total_invited === 0) return 'critical';
    if (obl.priority_score > 50) return 'high';
    if (obl.priority_score > 20) return 'medium';
    return 'low';
  };

  const getUrgencyBadge = (level) => {
    switch (level) {
      case 'critical': return <Badge className="bg-red-100 text-red-700 text-xs">Kritik</Badge>;
      case 'high': return <Badge className="bg-orange-100 text-orange-700 text-xs">Yüksək</Badge>;
      case 'medium': return <Badge className="bg-amber-100 text-amber-700 text-xs">Orta</Badge>;
      case 'low': return <Badge className="bg-green-100 text-green-700 text-xs">Normal</Badge>;
      case 'done': return <Badge className="bg-slate-100 text-slate-500 text-xs">Tamamlanıb</Badge>;
      default: return null;
    }
  };

  const getProgressBar = (used, total) => {
    if (total === 0) return null;
    const pct = Math.min((used / total) * 100, 100);
    const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
    return (
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    );
  };

  let filtered = data.obligations.filter(o => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      if (!o.company_name?.toLowerCase().includes(t) && !o.owner_name?.toLowerCase().includes(t)) return false;
    }
    if (filterPackage !== 'all' && o.package !== filterPackage) return false;
    if (filterUrgency !== 'all') {
      const level = getUrgencyLevel(o);
      if (filterUrgency === 'urgent' && level !== 'critical' && level !== 'high') return false;
      if (filterUrgency === 'not_invited' && o.total_invited !== 0) return false;
      if (filterUrgency === 'done' && level !== 'done') return false;
    }
    return true;
  });

  if (sortBy === 'priority') filtered.sort((a, b) => b.priority_score - a.priority_score);
  else if (sortBy === 'remaining') filtered.sort((a, b) => b.remaining_quota - a.remaining_quota);
  else if (sortBy === 'days') filtered.sort((a, b) => a.days_remaining - b.days_remaining);
  else if (sortBy === 'name') filtered.sort((a, b) => a.company_name.localeCompare(b.company_name));

  if (loading) return (
    <div className="p-6 space-y-4" data-testid="obligations-skeleton">
      <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[0,1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
      </div>
      <div className="h-12 bg-slate-100 rounded animate-pulse" />
      <div className="space-y-2">
        {[0,1,2,3,4,5,6].map(i => <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />)}
      </div>
    </div>
  );

  const stats = data.stats;

  const exportToExcel = () => {
    const urgencyLabel = (obl) => {
      const level = getUrgencyLevel(obl);
      if (level === 'critical') return 'Kritik';
      if (level === 'high') return 'Yüksək';
      if (level === 'medium') return 'Orta';
      if (level === 'done') return 'Tamamlanıb';
      return 'Normal';
    };
    const splitOwnerName = (full) => {
      const s = String(full || '').trim();
      if (!s) return { first: '', last: '' };
      const parts = s.split(/\s+/);
      return { first: parts[0], last: parts.slice(1).join(' ') };
    };
    const excelData = filtered.map((obl) => {
      const { first, last } = splitOwnerName(obl.owner_name);
      return {
        'ID': obl.display_id || '',
        'Şirkət': obl.company_name || '',
        'Ad': first,
        'Soyad': last,
        'Qoşulma tarixi': formatDate(obl.join_date),
        'Paket': obl.package || '',
        'Ümumi kvota': obl.total_quota,
        'İstifadə olunan': obl.used_quota,
        'Qalan kvota': obl.remaining_quota,
        'Cəmi dəvət': obl.total_invited,
        'Qatıldı': obl.total_attended,
        'Rədd etdi': obl.total_declined,
        'Cavab vermədi': obl.total_no_answer,
        'Müqavilə başlama': formatDate(obl.contract_start_date),
        'Müqavilə bitmə': formatDate(obl.contract_end_date),
        'Qalan gün': obl.days_remaining,
        'Prioritet bal': obl.priority_score,
        'Vəziyyət': urgencyLabel(obl),
      };
    });
    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = [
      { wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 12 },
      { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Öhdəliklər');
    XLSX.writeFile(wb, `ohdelikler_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel faylı yükləndi');
  };

  // Bulk-import obligations xlsx (same shape as export). Sends raw rows to the
  // backend which matches by Şirkət name and updates owner_name / package /
  // contract dates accordingly.
  const importFromExcel = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (rows.length === 0) { toast.error('Excel faylı boşdur'); return; }
      const token = localStorage.getItem('token');
      const yearScope = (filterYear && filterYear !== 'all') ? Number(filterYear) : null;
      const res = await axios.post(
        `${API}/obligations/import-excel`,
        { rows, year: yearScope },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { updated = 0, skipped = 0, errors = [], sample_keys = [] } = res.data || {};
      if (updated > 0) toast.success(`${updated} qeyd yeniləndi (atlanıldı: ${skipped})`);
      else {
        const detail = errors[0]?.reason ? ` (${errors[0].reason})` : '';
        const keysHint = sample_keys.length ? ` | Sütun adları: ${sample_keys.join(' | ')}` : '';
        toast.warning(`Heç bir qeyd yenilənmədi (atlanıldı: ${skipped})${detail}${keysHint}`);
      }
      if (errors.length > 0) console.warn('Import errors:', errors);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'İdxal zamanı xəta');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="obligations-page">
      <Toaster position="top-right" richColors />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Öhdəliklər</h1>
          <p className="text-slate-500 text-sm mt-1">Şirkətlərin dəvət kvotası icmalı və izlənməsi</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md cursor-pointer hover:bg-blue-100 text-xs font-medium border border-blue-100" data-testid="import-obligations-btn">
            <Upload className="w-4 h-4" /> Excel Import
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={importFromExcel} />
          </label>
          <Button variant="outline" size="sm" onClick={exportToExcel} data-testid="export-obligations-btn">
            <Download className="w-4 h-4 mr-1" />Excel Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">Cəmi üzvlər</p>
          <p className="text-2xl font-bold text-[#3D4F6F]">{stats.total || 0}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 shadow-sm border border-red-100" data-testid="stat-not-invited">
          <p className="text-xs text-red-500">Heç dəvət olunmayıb</p>
          <p className="text-2xl font-bold text-red-600">{stats.not_invited || 0}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 shadow-sm border border-amber-100">
          <p className="text-xs text-amber-600">Az dəvət olunub</p>
          <p className="text-2xl font-bold text-amber-600">{stats.under_invited || 0}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 shadow-sm border border-green-100">
          <p className="text-xs text-green-600">Tamamlanıb</p>
          <p className="text-2xl font-bold text-green-600">{stats.fully_served || 0}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 shadow-sm border border-orange-100" data-testid="stat-urgent">
          <p className="text-xs text-orange-600">Təcili</p>
          <p className="text-2xl font-bold text-orange-600">{stats.urgent || 0}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Şirkət və ya sahibkar axtar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" data-testid="obligation-search" />
          </div>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[120px] text-sm h-9" data-testid="obligation-year-filter"><SelectValue placeholder="İl" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün illər</SelectItem>
              {Array.from({ length: 6 }, (_, i) => currentYear + 1 - i).map(y => (
                <SelectItem key={y} value={String(y)}>{y}{y === currentYear ? ' (cari)' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPackage} onValueChange={setFilterPackage}>
            <SelectTrigger className="w-[130px] text-sm h-9"><SelectValue placeholder="Paket" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün paketlər</SelectItem>
              <SelectItem value="Premium">Premium</SelectItem>
              <SelectItem value="Business">Business</SelectItem>
              <SelectItem value="Business Plus">Business+</SelectItem>
              <SelectItem value="Sponsor">Sponsor</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterUrgency} onValueChange={setFilterUrgency}>
            <SelectTrigger className="w-[150px] text-sm h-9"><SelectValue placeholder="Vəziyyət" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Hamısı</SelectItem>
              <SelectItem value="urgent">Təcili</SelectItem>
              <SelectItem value="not_invited">Dəvət olunmayıb</SelectItem>
              <SelectItem value="done">Tamamlanıb</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px] text-sm h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Prioritet</SelectItem>
              <SelectItem value="remaining">Qalan kvota</SelectItem>
              <SelectItem value="days">Gün qalıb</SelectItem>
              <SelectItem value="name">Ad</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="obligations-table">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">ID</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Şirkət</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Paket</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Kvota</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">İrəliləyiş</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Dəvət</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Qatılma</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Müddət</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Vəziyyət</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400 text-sm">Nəticə tapılmadı</td></tr>
              ) : (
                filtered.map((obl) => {
                  const urgency = getUrgencyLevel(obl);
                  return (
                    <tr key={obl.company_id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${urgency === 'critical' ? 'bg-red-50/30' : ''}`} data-testid={`obl-row-${obl.company_id}`}>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-500" data-testid={`obl-id-${obl.company_id}`}>{obl.display_id || '-'}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-sm text-[#3D4F6F]">{obl.company_name}</p>
                        <p className="text-xs text-slate-400">{obl.owner_name}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge className="bg-[#3D4F6F]/10 text-[#3D4F6F] text-xs">{obl.package}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-sm font-semibold text-[#3D4F6F]">{obl.used_quota}</span>
                        <span className="text-xs text-slate-400">/{obl.total_quota}</span>
                      </td>
                      <td className="px-3 py-2.5 min-w-[100px]">
                        {getProgressBar(obl.used_quota, obl.total_quota)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">
                        {obl.total_invited} dəvət
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className="text-green-600">{obl.total_attended}</span>
                        <span className="text-slate-300 mx-0.5">/</span>
                        <span className="text-red-500">{obl.total_declined}</span>
                        {obl.total_no_answer > 0 && <span className="text-amber-500 ml-1">({obl.total_no_answer})</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-xs text-slate-600">{obl.contract_end_date ? formatDate(obl.contract_end_date) : '-'}</p>
                        {obl.days_remaining !== undefined && obl.remaining_quota > 0 && (
                          <p className={`text-[10px] font-medium ${obl.days_remaining < 60 ? 'text-red-500' : obl.days_remaining < 120 ? 'text-amber-500' : 'text-slate-400'}`}>
                            {obl.days_remaining} gün qalıb
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">{getUrgencyBadge(urgency)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(obl.company_id)} data-testid={`view-detail-${obl.company_id}`}>
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedCompany} onOpenChange={(open) => { if (!open) { setSelectedCompany(null); setCompanyDetail(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F]" /></div>
          ) : companyDetail && (
            <>
              <DialogHeader>
                <DialogTitle style={{ color: '#3D4F6F' }}>{companyDetail.company_name} — Öhdəlik Detalları</DialogTitle>
              </DialogHeader>

              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-[#3D4F6F]/5 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-[#3D4F6F]">{companyDetail.used_quota}/{companyDetail.total_quota}</p>
                  <p className="text-xs text-slate-500">Kvota istifadəsi</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-green-600">{companyDetail.total_attended}</p>
                  <p className="text-xs text-slate-500">Qatıldı</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-red-600">{companyDetail.total_declined}</p>
                  <p className="text-xs text-slate-500">Rədd etdi</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-amber-600">{companyDetail.total_no_answer}</p>
                  <p className="text-xs text-slate-500">Cavab vermədi</p>
                </div>
              </div>

              {/* Type Breakdown */}
              {companyDetail.type_breakdown && Object.keys(companyDetail.type_breakdown).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-[#3D4F6F] mb-2">Fəaliyyət növləri üzrə</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(companyDetail.type_breakdown).map(([type, stats]) => (
                      <div key={type} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                        <p className="text-xs font-medium text-[#3D4F6F]">{type}</p>
                        <div className="flex gap-2 mt-1 text-xs">
                          <span className="text-slate-500">Dəvət: {stats.invited}</span>
                          <span className="text-green-600">Qatıldı: {stats.attended}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invitation History */}
              <div>
                <h4 className="text-sm font-semibold text-[#3D4F6F] mb-2">Dəvət tarixçəsi</h4>
                {companyDetail.invitations?.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-4">Hələ dəvət yoxdur</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {companyDetail.invitations?.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/50">
                        <div>
                          <p className="text-sm font-medium text-[#3D4F6F]">{inv.event_name}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <Badge className="text-[10px] bg-[#3D4F6F]/10 text-[#3D4F6F]">{inv.event_type}</Badge>
                            <span>{inv.event_date}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          {inv.call_status === 'Cavab verdi' && inv.participation_status === 'Qatılır' && <Badge className="bg-green-100 text-green-700 text-xs">Qatıldı</Badge>}
                          {inv.call_status === 'Cavab verdi' && inv.participation_status === 'Qatılmır' && <Badge className="bg-red-100 text-red-700 text-xs">Rədd etdi</Badge>}
                          {inv.call_status === 'Cavab vermədi' && <Badge className="bg-amber-100 text-amber-700 text-xs">Cavab vermədi</Badge>}
                          {inv.call_status === 'Gözləyir' && <Badge className="bg-slate-100 text-slate-500 text-xs">Gözləyir</Badge>}
                          {inv.obligation_deducted && <p className="text-[10px] text-slate-400 mt-0.5">Öhdəlikdən düşüldü</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
