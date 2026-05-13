import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Loader2, Search, Calendar, Building2, Eye,
  Phone, PhoneCall, PhoneOff, CheckCircle2, XCircle,
  Filter, BarChart3, Download, Trash2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';
import * as XLSX from 'xlsx';
import { formatDate } from '../lib/dateUtils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const EVENT_TYPES = ['Breakfast', 'Ofis ziyarəti', 'Mafia', 'Sosial fəaliyyət', 'Təlim', 'B2B görüş'];

export default function ObligationHistory() {
  const currentYear = new Date().getFullYear();
  const [data, setData] = useState({ obligations: [], stats: {} });
  const [events, setEvents] = useState([]);
  const [allInvitations, setAllInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEventType, setFilterEventType] = useState('all');
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyDetail, setCompanyDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [oblRes, evRes, invRes] = await Promise.all([
        axios.get(`${API}/obligations/dashboard`, { headers }),
        axios.get(`${API}/events`, { headers }),
        axios.get(`${API}/invitations`, { headers }),
      ]);
      setData(oblRes.data);
      setEvents(evRes.data);
      setAllInvitations(invRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDetail = async (companyId) => {
    setSelectedCompany(companyId);
    setDetailLoading(true);
    try {
      const res = await axios.get(`${API}/obligations/company/${companyId}`, { headers });
      setCompanyDetail(res.data);
    } catch { toast.error('Xəta baş verdi'); }
    finally { setDetailLoading(false); }
  };

  const deleteInvitation = async (inv) => {
    if (!window.confirm(`"${inv.company_name}" üçün "${inv.event_name}" dəvətini silmək istədiyinizə əminsiniz?`)) return;
    try {
      await axios.delete(`${API}/invitations/${inv.id}`, { headers });
      toast.success('Dəvət silindi');
      // Optimistic update — no full refetch needed
      setAllInvitations(prev => prev.filter(x => x.id !== inv.id));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Silinmə zamanı xəta');
    }
  };

  const exportExcel = () => {
    if (filteredInvitations.length === 0) {
      toast.error('Export üçün məlumat yoxdur');
      return;
    }
    const statusLabel = (inv) => {
      if (inv.participation_status === 'Qatılır') return 'Qatıldı';
      if (inv.participation_status === 'Qatılmır') return 'Rədd';
      if (inv.call_status === 'Cavab vermədi') return 'Cavabsız';
      if (inv.call_status === 'Gözləyir') return 'Gözləyir';
      return '';
    };
    const invData = filteredInvitations.map((inv, i) => ({
      '#': i + 1,
      'Şirkət': inv.company_name || '',
      'Fəaliyyət': inv.event_name || '',
      'Növ': inv.event_type || '',
      'Tarix': inv.event_date || '',
      'Status': statusLabel(inv),
      'Zəng edən': inv.called_by || '',
      'Qeyd': inv.notes || ''
    }));
    const summaryData = eventTypeStats.map(s => ({
      'Növ': s.type,
      'Görüş sayı': s.eventCount,
      'Dəvət': s.total,
      'Qatıldı': s.attended,
      'Rədd': s.declined,
      'Cavabsız': s.noAnswer
    }));
    const companyData = filtered.map(o => ({
      'Şirkət': o.company_name,
      'Sahibkar': o.owner_name || '',
      'Paket': o.package || '',
      'Kvota istifadəsi': `${o.used_quota}/${o.total_quota}`,
      'Dəvət': o.total_invited,
      'Qatıldı': o.total_attended,
      'Rədd': o.total_declined,
      'Cavabsız': o.total_no_answer
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invData), 'Dəvət tarixçəsi');
    if (summaryData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Fəaliyyət növləri');
    if (companyData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(companyData), 'Şirkət üzrə icmal');
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `ohdelik-tarixcesi-${today}.xlsx`);
    toast.success('Excel yükləndi');
  };

  // Event type stats from all invitations
  const eventTypeStats = EVENT_TYPES.map(type => {
    let invs = allInvitations.filter(i => i.event_type === type);
    if (filterYear && filterYear !== 'all') invs = invs.filter(i => (i.event_date || '').startsWith(filterYear + '-'));
    if (filterDateFrom) invs = invs.filter(i => i.event_date >= filterDateFrom);
    if (filterDateTo) invs = invs.filter(i => i.event_date <= filterDateTo);
    const total = invs.length;
    const attended = invs.filter(i => i.participation_status === 'Qatılır').length;
    const declined = invs.filter(i => i.participation_status === 'Qatılmır').length;
    const noAnswer = invs.filter(i => i.call_status === 'Cavab vermədi').length;
    const evCount = events.filter(e => e.event_type === type).length;
    return { type, eventCount: evCount, total, attended, declined, noAnswer };
  }).filter(s => s.eventCount > 0 || s.total > 0);

  // Filtered companies (those with invitations)
  const filtered = data.obligations.filter(o => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      if (!o.company_name?.toLowerCase().includes(t) && !o.owner_name?.toLowerCase().includes(t)) return false;
    }
    return true;
  }).filter(o => o.total_invited > 0);

  // Filtered invitations for the table
  let filteredInvitations = allInvitations;
  if (filterYear && filterYear !== 'all') filteredInvitations = filteredInvitations.filter(i => (i.event_date || '').startsWith(filterYear + '-'));
  if (filterEventType !== 'all') filteredInvitations = filteredInvitations.filter(i => i.event_type === filterEventType);
  if (filterDateFrom) filteredInvitations = filteredInvitations.filter(i => i.event_date >= filterDateFrom);
  if (filterDateTo) filteredInvitations = filteredInvitations.filter(i => i.event_date <= filterDateTo);
  if (filterStatus === 'attended') filteredInvitations = filteredInvitations.filter(i => i.participation_status === 'Qatılır');
  if (filterStatus === 'declined') filteredInvitations = filteredInvitations.filter(i => i.participation_status === 'Qatılmır');
  if (filterStatus === 'no_answer') filteredInvitations = filteredInvitations.filter(i => i.call_status === 'Cavab vermədi');
  if (filterStatus === 'pending') filteredInvitations = filteredInvitations.filter(i => i.call_status === 'Gözləyir');
  if (searchTerm) {
    const t = searchTerm.toLowerCase();
    filteredInvitations = filteredInvitations.filter(i => i.company_name?.toLowerCase().includes(t) || i.event_name?.toLowerCase().includes(t));
  }

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="obligation-history-page">
      <Toaster position="top-right" richColors />

      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Öhdəlik Tarixçəsi</h1>
          <p className="text-slate-500 text-sm mt-1">Fəaliyyət növləri üzrə detallı hesabat və tarixçə</p>
        </div>
        <Button onClick={exportExcel} variant="outline" size="sm" className="text-[#3D4F6F] border-[#3D4F6F]/20" data-testid="history-export-btn">
          <Download className="w-4 h-4 mr-1" />Excel
        </Button>
      </div>

      {/* Event Type Stats Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6" data-testid="event-type-summary">
        <h2 className="font-semibold text-[#3D4F6F] mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />Fəaliyyət növləri üzrə hesabat
        </h2>
        {eventTypeStats.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">Hələ fəaliyyət yoxdur</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {eventTypeStats.map(s => (
              <div key={s.type} className="bg-slate-50 rounded-lg p-3 border border-slate-100" data-testid={`stat-${s.type}`}>
                <p className="text-xs font-semibold text-[#3D4F6F] mb-2">{s.type}</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Görüş sayı:</span>
                    <span className="font-bold text-[#3D4F6F]">{s.eventCount}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Dəvət:</span>
                    <span className="font-bold text-[#3D4F6F]">{s.total}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-green-600">Qatıldı:</span>
                    <span className="font-bold text-green-600">{s.attended}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-red-500">Rədd:</span>
                    <span className="font-bold text-red-500">{s.declined}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-amber-500">Cavabsız:</span>
                    <span className="font-bold text-amber-600">{s.noAnswer}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Şirkət və ya fəaliyyət axtar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" data-testid="history-search" />
          </div>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[120px] text-sm h-9" data-testid="history-year-filter"><SelectValue placeholder="İl" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün illər</SelectItem>
              {Array.from({ length: 6 }, (_, i) => currentYear + 1 - i).map(y => (
                <SelectItem key={y} value={String(y)}>{y}{y === currentYear ? ' (cari)' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterEventType} onValueChange={setFilterEventType}>
            <SelectTrigger className="w-[150px] text-sm h-9"><SelectValue placeholder="Fəaliyyət növü" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün növlər</SelectItem>
              {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] text-sm h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Hamısı</SelectItem>
              <SelectItem value="attended">Qatıldı</SelectItem>
              <SelectItem value="declined">Rədd etdi</SelectItem>
              <SelectItem value="no_answer">Cavab vermədi</SelectItem>
              <SelectItem value="pending">Gözləyir</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-[140px] text-sm h-9" placeholder="Başlanğıc" data-testid="date-from" />
          <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-[140px] text-sm h-9" placeholder="Son" data-testid="date-to" />
        </div>
      </div>

      {/* Detailed Invitations Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-6">
        <div className="p-3 border-b border-slate-100">
          <h3 className="font-semibold text-sm text-[#3D4F6F]">Dəvət tarixçəsi ({filteredInvitations.length} nəticə)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="history-table">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#3D4F6F]">#</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#3D4F6F]">Şirkət</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#3D4F6F]">Fəaliyyət</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#3D4F6F]">Növ</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#3D4F6F]">Tarix</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#3D4F6F]">Status</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#3D4F6F]">Zəng edən</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#3D4F6F]"></th>
              </tr>
            </thead>
            <tbody>
              {filteredInvitations.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400 text-sm">Nəticə tapılmadı</td></tr>
              ) : (
                filteredInvitations.slice(0, 100).map((inv, idx) => (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2 text-sm font-medium text-[#3D4F6F]">{inv.company_name}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{inv.event_name}</td>
                    <td className="px-3 py-2"><Badge className="bg-[#3D4F6F]/10 text-[#3D4F6F] text-xs">{inv.event_type}</Badge></td>
                    <td className="px-3 py-2 text-xs text-slate-600">{formatDate(inv.event_date)}</td>
                    <td className="px-3 py-2">
                      {inv.participation_status === 'Qatılır' && <Badge className="bg-green-100 text-green-700 text-xs">Qatıldı</Badge>}
                      {inv.participation_status === 'Qatılmır' && <Badge className="bg-red-100 text-red-700 text-xs">Rədd</Badge>}
                      {inv.call_status === 'Cavab vermədi' && <Badge className="bg-amber-100 text-amber-700 text-xs">Cavabsız</Badge>}
                      {inv.call_status === 'Gözləyir' && <Badge className="bg-slate-100 text-slate-500 text-xs">Gözləyir</Badge>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{inv.called_by || '-'}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(inv.company_id)} className="h-6 w-6 p-0" title="Detal" data-testid={`view-inv-${inv.id}`}>
                          <Eye className="w-3 h-3 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteInvitation(inv)} className="h-6 w-6 p-0 hover:bg-red-50" title="Sil" data-testid={`delete-inv-${inv.id}`}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredInvitations.length > 100 && (
          <div className="p-2 text-center text-xs text-slate-400 bg-slate-50 border-t">İlk 100 nəticə göstərilir (cəmi: {filteredInvitations.length})</div>
        )}
      </div>

      {/* Company Cards */}
      <h3 className="font-semibold text-[#3D4F6F] mb-3">Şirkət üzrə icmal</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && <p className="col-span-full text-center text-slate-400 py-8">Tarixçəsi olan şirkət yoxdur</p>}
        {filtered.map(obl => (
          <div key={obl.company_id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 hover:shadow-md transition-shadow" data-testid={`history-card-${obl.company_id}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-[#3D4F6F]">{obl.company_name}</p>
                <p className="text-xs text-slate-500">{obl.package} · {obl.owner_name}</p>
              </div>
              <Badge className="bg-[#3D4F6F]/10 text-[#3D4F6F] text-xs">{obl.used_quota}/{obl.total_quota}</Badge>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="text-center bg-slate-50 rounded-lg p-2">
                <p className="text-lg font-bold text-[#3D4F6F]">{obl.total_invited}</p>
                <p className="text-[10px] text-slate-500">Dəvət</p>
              </div>
              <div className="text-center bg-green-50 rounded-lg p-2">
                <p className="text-lg font-bold text-green-600">{obl.total_attended}</p>
                <p className="text-[10px] text-green-600">Qatıldı</p>
              </div>
              <div className="text-center bg-red-50 rounded-lg p-2">
                <p className="text-lg font-bold text-red-600">{obl.total_declined}</p>
                <p className="text-[10px] text-red-500">Rədd</p>
              </div>
              <div className="text-center bg-amber-50 rounded-lg p-2">
                <p className="text-lg font-bold text-amber-600">{obl.total_no_answer}</p>
                <p className="text-[10px] text-amber-500">Cavabsız</p>
              </div>
            </div>

            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => openDetail(obl.company_id)} data-testid={`view-history-${obl.company_id}`}>
              <Eye className="w-3 h-3 mr-1" />Ətraflı bax
            </Button>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedCompany} onOpenChange={(open) => { if (!open) { setSelectedCompany(null); setCompanyDetail(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F]" /></div>
          ) : companyDetail && (
            <>
              <DialogHeader>
                <DialogTitle style={{ color: '#3D4F6F' }}>{companyDetail.company_name} — Tarixçə</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-[#3D4F6F]/5 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-[#3D4F6F]">{companyDetail.remaining_quota}</p>
                  <p className="text-xs text-slate-500">Qalan kvota</p>
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
                  <h4 className="text-sm font-semibold text-[#3D4F6F] mb-2">Fəaliyyət növü üzrə statistika</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(companyDetail.type_breakdown).map(([type, stats]) => (
                      <div key={type} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                        <p className="text-xs font-semibold text-[#3D4F6F]">{type}</p>
                        <div className="flex gap-2 mt-1 text-[10px]">
                          <span className="text-slate-500">Dəvət: {stats.invited}</span>
                          <span className="text-green-600">Qatıldı: {stats.attended}</span>
                          <span className="text-red-500">Rədd: {stats.declined}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <h4 className="text-sm font-semibold text-[#3D4F6F] mb-2">Dəvət tarixçəsi</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {companyDetail.invitations?.map(inv => (
                    <div key={inv.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${inv.participation_status === 'Qatılır' ? 'bg-green-500' : inv.participation_status === 'Qatılmır' ? 'bg-red-500' : inv.call_status === 'Cavab vermədi' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#3D4F6F] truncate">{inv.event_name}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{inv.event_type}</span>
                          <span>{formatDate(inv.event_date)}</span>
                          {inv.called_by && <span>Zəng: {inv.called_by}</span>}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {inv.participation_status === 'Qatılır' && <Badge className="bg-green-100 text-green-700 text-xs">Qatıldı</Badge>}
                        {inv.participation_status === 'Qatılmır' && <Badge className="bg-red-100 text-red-700 text-xs">Rədd</Badge>}
                        {inv.call_status === 'Cavab vermədi' && <Badge className="bg-amber-100 text-amber-700 text-xs">Cavabsız</Badge>}
                        {inv.call_status === 'Gözləyir' && <Badge className="bg-slate-100 text-slate-500 text-xs">Gözləyir</Badge>}
                      </div>
                    </div>
                  ))}
                  {(!companyDetail.invitations || companyDetail.invitations.length === 0) && (
                    <p className="text-center text-slate-400 text-sm py-4">Tarixçə boşdur</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
