import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Loader2, Calendar as CalendarIcon, Users, Check, X, Clock, Plane, Stethoscope, Home, Download, Plus, Trash2, ChevronLeft, ChevronRight, Activity, LogIn, LogOut } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Toaster, toast } from 'sonner';
import { usePermissions, canEdit } from '../context/PermissionContext';
import * as XLSX from 'xlsx';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STATUSES = ['İşdə', 'Gəlməyib', 'Məzuniyyət', 'Xəstəlik', 'İcazəli', 'Uzaq'];
const STATUS_COLORS = {
  'İşdə': 'bg-green-100 text-green-700 border-green-200',
  'Gəlməyib': 'bg-red-100 text-red-700 border-red-200',
  'Məzuniyyət': 'bg-blue-100 text-blue-700 border-blue-200',
  'Xəstəlik': 'bg-amber-100 text-amber-700 border-amber-200',
  'İcazəli': 'bg-purple-100 text-purple-700 border-purple-200',
  'Uzaq': 'bg-slate-100 text-slate-700 border-slate-200',
};
const STATUS_ICON = {
  'İşdə': Check, 'Gəlməyib': X, 'Məzuniyyət': Plane, 'Xəstəlik': Stethoscope, 'İcazəli': Clock, 'Uzaq': Home,
};
const LEAVE_TYPES = ['Məzuniyyət', 'Xəstəlik', 'İcazə', 'Digər'];
const LEAVE_STATUSES = ['Gözləyir', 'Təsdiqlənib', 'Rədd edilib'];
const LEAVE_STATUS_COLORS = { 'Gözləyir': 'bg-amber-100 text-amber-700', 'Təsdiqlənib': 'bg-green-100 text-green-700', 'Rədd edilib': 'bg-red-100 text-red-700' };

const today = () => new Date().toISOString().split('T')[0];

export default function Attendance() {
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'hr');
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [tab, setTab] = useState('daily');
  const [date, setDate] = useState(today());
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  // Leave requests
  const [leaves, setLeaves] = useState([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ employee_id: '', type: 'Məzuniyyət', start_date: '', end_date: '', reason: '' });
  const [leaveFilter, setLeaveFilter] = useState('all');

  // System sessions (giriş/çıxış vaxtları)
  const [sessions, setSessions] = useState([]);
  const [sessionsDate, setSessionsDate] = useState(today());
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try { const r = await axios.get(`${API}/employees?status=Aktiv`, { headers }); setEmployees(r.data); }
    catch { setEmployees([]); }
  }, []);

  const fetchRecords = useCallback(async (d) => {
    try { const r = await axios.get(`${API}/attendance?date=${d}`, { headers }); setRecords(r.data); }
    catch { setRecords([]); }
  }, []);

  const fetchStats = useCallback(async (m) => {
    try { const r = await axios.get(`${API}/attendance/stats?month=${m}`, { headers }); setStats(r.data); }
    catch { setStats(null); }
  }, []);

  const fetchLeaves = useCallback(async () => {
    try { const r = await axios.get(`${API}/leave-requests`, { headers }); setLeaves(r.data); }
    catch { setLeaves([]); }
  }, []);

  const fetchSessions = useCallback(async (d) => {
    setSessionsLoading(true);
    try {
      const r = await axios.get(`${API}/attendance/system-sessions?date=${d}`, { headers });
      setSessions(r.data);
    } catch { setSessions([]); }
    finally { setSessionsLoading(false); }
  }, []);

  useEffect(() => { if (tab === 'system') fetchSessions(sessionsDate); }, [tab, sessionsDate, fetchSessions]);

  useEffect(() => {
    (async () => { await Promise.all([fetchEmployees(), fetchRecords(date), fetchStats(month), fetchLeaves()]); setLoading(false); })();
  }, [fetchEmployees, fetchRecords, fetchStats, fetchLeaves, date, month]);

  useEffect(() => { fetchRecords(date); }, [date, fetchRecords]);
  useEffect(() => { fetchStats(month); }, [month, fetchStats]);

  const recordByEmp = useMemo(() => {
    const m = {}; records.forEach(r => { m[r.employee_id] = r; }); return m;
  }, [records]);

  const updateStatus = async (employee_id, status) => {
    try {
      await axios.post(`${API}/attendance`, { employee_id, date, status }, { headers });
      fetchRecords(date);
      toast.success('Yeniləndi', { duration: 1200 });
    } catch { toast.error('Xəta'); }
  };

  const markAllPresent = async () => {
    if (!window.confirm(`${employees.length} əməkdaş üçün "İşdə" statusu qeyd edilsin?`)) return;
    try {
      await axios.post(`${API}/attendance/bulk`, {
        date, records: employees.map(e => ({ employee_id: e.id, status: 'İşdə' }))
      }, { headers });
      fetchRecords(date); toast.success('Hamısı qeyd edildi');
    } catch { toast.error('Xəta'); }
  };

  const shiftDate = (d) => {
    const nd = new Date(date); nd.setDate(nd.getDate() + d); setDate(nd.toISOString().split('T')[0]);
  };

  const exportDaily = () => {
    const data = employees.map(e => {
      const r = recordByEmp[e.id];
      const empName = e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim();
      return {
        'Ad Soyad': empName,
        'Şöbə': e.department || '', 'Vəzifə': e.position || '',
        'Status': r?.status || 'Qeyd edilməyib',
        'Giriş': r?.check_in || '', 'Çıxış': r?.check_out || '', 'Qeyd': r?.notes || ''
      };
    });
    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, `Davamiyyət ${date}`);
    XLSX.writeFile(wb, `davamiyyet_${date}.xlsx`);
  };

  const exportMonthly = () => {
    if (!stats) return;
    const data = stats.per_employee.map(p => ({
      'Ad Soyad': p.employee_name, 'Şöbə': p.department, 'Vəzifə': p.position,
      ...STATUSES.reduce((acc, s) => ({ ...acc, [s]: p[s] }), {})
    }));
    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, `Aylıq ${month}`);
    XLSX.writeFile(wb, `aylik_davamiyyet_${month}.xlsx`);
  };

  const submitLeave = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/leave-requests`, leaveForm, { headers });
      toast.success('Sorğu yaradıldı'); setShowLeaveModal(false); fetchLeaves();
    } catch { toast.error('Xəta'); }
  };

  const updateLeaveStatus = async (id, status) => {
    try {
      await axios.put(`${API}/leave-requests/${id}`, { status }, { headers });
      toast.success(status);
      fetchLeaves();
      if (status === 'Təsdiqlənib') fetchRecords(date);
    } catch { toast.error('Xəta'); }
  };

  const deleteLeave = async (id) => {
    if (!window.confirm('Silmək?')) return;
    try { await axios.delete(`${API}/leave-requests/${id}`, { headers }); toast.success('Silindi'); fetchLeaves(); }
    catch { toast.error('Xəta'); }
  };

  const filteredLeaves = leaves.filter(l => leaveFilter === 'all' || l.status === leaveFilter);

  const fmtTime = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return iso; }
  };
  const fmtDuration = (sec) => {
    if (!sec || sec < 0) return '—';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}s ${m}d`;
    if (m > 0) return `${m}d ${s}san`;
    return `${s}san`;
  };
  const exportSessions = () => {
    const data = sessions.map(s => ({
      'Ad Soyad': s.user_name || '',
      'Email': s.user_email || '',
      'Giriş vaxtı': s.login_at ? new Date(s.login_at).toLocaleString('az-AZ') : '',
      'Çıxış vaxtı': s.logout_at ? new Date(s.logout_at).toLocaleString('az-AZ') : 'Aktiv',
      'Son fəaliyyət': s.last_active_at ? new Date(s.last_active_at).toLocaleString('az-AZ') : '',
      'Aktiv qalma müddəti (saat:dəq:san)': new Date((s.active_seconds || 0) * 1000).toISOString().substr(11, 8),
      'Status': s.is_open ? 'Aktiv' : 'Bağlı',
    }));
    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, `Sistem ${sessionsDate}`);
    XLSX.writeFile(wb, `sistem_fealiyyet_${sessionsDate}.xlsx`);
  };

  // Daily stats
  const dailyStats = STATUSES.reduce((acc, s) => ({ ...acc, [s]: records.filter(r => r.status === s).length }), {});
  const notMarked = employees.length - records.length;

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F]" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="attendance-page">
      <Toaster position="top-right" richColors />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#3D4F6F]">Davamiyyət</h1>
          <p className="text-slate-500 text-sm mt-1">Əməkdaş davamiyyəti və məzuniyyət sorğuları</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-4 bg-white border">
          <TabsTrigger value="daily" data-testid="tab-daily">Günlük</TabsTrigger>
          <TabsTrigger value="monthly" data-testid="tab-monthly">Aylıq Hesabat</TabsTrigger>
          <TabsTrigger value="leaves" data-testid="tab-leaves">Məzuniyyət Sorğuları</TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">Sistem fəaliyyəti</TabsTrigger>
        </TabsList>

        {/* DAILY TAB */}
        <TabsContent value="daily">
          <div className="bg-white rounded-xl shadow-sm border p-3 mb-4 flex flex-wrap items-center gap-3">
            <button onClick={() => shiftDate(-1)} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="prev-day-btn"><ChevronLeft className="w-4 h-4" /></button>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-[160px] text-sm" data-testid="date-picker" />
            <button onClick={() => shiftDate(1)} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="next-day-btn"><ChevronRight className="w-4 h-4" /></button>
            <Button onClick={() => setDate(today())} variant="outline" size="sm" className="text-xs">Bu gün</Button>
            <div className="flex-1"></div>
            <Button onClick={exportDaily} variant="outline" className="text-[#3D4F6F]" data-testid="export-daily-btn"><Download className="w-4 h-4 mr-1" />Excel</Button>
            {_canEdit && <Button onClick={markAllPresent} className="bg-green-500 text-white hover:bg-green-600" data-testid="mark-all-btn"><Check className="w-4 h-4 mr-1" />Hamısı işdədir</Button>}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
            <div className="bg-white rounded-lg p-2.5 border"><p className="text-lg font-bold text-[#3D4F6F]">{employees.length}</p><p className="text-[10px] text-slate-500">Ümumi</p></div>
            {STATUSES.map(s => (
              <div key={s} className={`rounded-lg p-2.5 border ${STATUS_COLORS[s]}`} data-testid={`stat-${s}`}>
                <p className="text-lg font-bold">{dailyStats[s]}</p><p className="text-[10px] font-medium">{s}</p>
              </div>
            ))}
            {notMarked > 0 && <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200"><p className="text-lg font-bold text-slate-500">{notMarked}</p><p className="text-[10px] text-slate-500">Qeyd edilməyib</p></div>}
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Əməkdaş</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Şöbə</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Status</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Giriş</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Çıxış</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Qeyd</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">Əməkdaş yoxdur</td></tr> :
                    employees.map(e => {
                      const r = recordByEmp[e.id];
                      const Icon = r?.status ? STATUS_ICON[r.status] : null;
                      return (
                        <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50" data-testid={`att-row-${e.id}`}>
                          <td className="px-3 py-2.5">
                            <p className="text-sm font-medium text-[#3D4F6F]">{e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim()}</p>
                            <p className="text-[10px] text-slate-400">{e.position}</p>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">{e.department}</td>
                          <td className="px-3 py-2.5">
                            {_canEdit ? (
                              <Select value={r?.status || ''} onValueChange={v => updateStatus(e.id, v)}>
                                <SelectTrigger className={`text-xs h-8 w-[140px] ${r?.status ? STATUS_COLORS[r.status] : 'bg-slate-50 text-slate-400'}`} data-testid={`status-select-${e.id}`}>
                                  <div className="flex items-center gap-1.5">
                                    {Icon && <Icon className="w-3 h-3" />}
                                    <SelectValue placeholder="Seçin" />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                              </Select>
                            ) : r?.status ? <Badge className={STATUS_COLORS[r.status]}>{r.status}</Badge> : <span className="text-[11px] text-slate-400">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {_canEdit ? <Input type="time" value={r?.check_in || ''} onChange={ev => axios.post(`${API}/attendance`, { employee_id: e.id, date, status: r?.status || 'İşdə', check_in: ev.target.value, check_out: r?.check_out || '' }, { headers }).then(() => fetchRecords(date))} className="text-xs h-7 w-[100px]" /> : <span className="text-xs text-slate-500">{r?.check_in || '—'}</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {_canEdit ? <Input type="time" value={r?.check_out || ''} onChange={ev => axios.post(`${API}/attendance`, { employee_id: e.id, date, status: r?.status || 'İşdə', check_in: r?.check_in || '', check_out: ev.target.value }, { headers }).then(() => fetchRecords(date))} className="text-xs h-7 w-[100px]" /> : <span className="text-xs text-slate-500">{r?.check_out || '—'}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-400 max-w-[180px] truncate">{r?.notes || ''}</td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* MONTHLY TAB */}
        <TabsContent value="monthly">
          <div className="bg-white rounded-xl shadow-sm border p-3 mb-4 flex flex-wrap items-center gap-3">
            <Label className="text-xs text-slate-500">Ay:</Label>
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-[160px] text-sm" data-testid="month-picker" />
            <div className="flex-1"></div>
            <Button onClick={exportMonthly} variant="outline" className="text-[#3D4F6F]" data-testid="export-monthly-btn"><Download className="w-4 h-4 mr-1" />Excel</Button>
          </div>

          {stats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
                {STATUSES.map(s => (
                  <div key={s} className={`rounded-lg p-3 border ${STATUS_COLORS[s]}`}>
                    <p className="text-2xl font-bold">{stats.totals[s]}</p><p className="text-xs font-medium">{s}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Əməkdaş</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Şöbə</th>
                        {STATUSES.map(s => <th key={s} className="text-center px-2 py-3 text-xs font-semibold text-[#3D4F6F]">{s}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.per_employee.map(p => (
                        <tr key={p.employee_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 text-sm font-medium text-[#3D4F6F]">{p.employee_name}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">{p.department}</td>
                          {STATUSES.map(s => <td key={s} className="text-center px-2 py-2.5 text-sm font-semibold">{p[s] || '—'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* LEAVES TAB */}
        <TabsContent value="leaves">
          <div className="bg-white rounded-xl shadow-sm border p-3 mb-4 flex flex-wrap items-center gap-3">
            <Select value={leaveFilter} onValueChange={setLeaveFilter}>
              <SelectTrigger className="w-[160px] text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün sorğular</SelectItem>
                {LEAVE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex-1"></div>
            {_canEdit && <Button onClick={() => { setLeaveForm({ employee_id: '', type: 'Məzuniyyət', start_date: '', end_date: '', reason: '' }); setShowLeaveModal(true); }} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="add-leave-btn"><Plus className="w-4 h-4 mr-1" />Yeni Sorğu</Button>}
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Əməkdaş</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Növ</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Başlanğıc</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Bitmə</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Səbəb</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Status</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaves.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">Sorğu yoxdur</td></tr> :
                    filteredLeaves.map(l => (
                      <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 text-sm font-medium text-[#3D4F6F]">{l.employee_name}</td>
                        <td className="px-3 py-2.5"><Badge className="bg-slate-100 text-slate-600 text-[10px]">{l.type}</Badge></td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">{l.start_date}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">{l.end_date}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500 max-w-[200px] truncate">{l.reason}</td>
                        <td className="px-3 py-2.5"><Badge className={LEAVE_STATUS_COLORS[l.status]}>{l.status}</Badge></td>
                        <td className="px-3 py-2.5 text-right">
                          {_canEdit && <div className="flex justify-end gap-1">
                            {l.status === 'Gözləyir' && <>
                              <button onClick={() => updateLeaveStatus(l.id, 'Təsdiqlənib')} className="p-1.5 hover:bg-green-50 rounded-lg text-green-500" title="Təsdiqlə" data-testid={`approve-${l.id}`}><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => updateLeaveStatus(l.id, 'Rədd edilib')} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" title="Rədd et"><X className="w-3.5 h-3.5" /></button>
                            </>}
                            <button onClick={() => deleteLeave(l.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                          </div>}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* SYSTEM SESSIONS TAB */}
        <TabsContent value="system">
          <div className="bg-white rounded-xl shadow-sm border p-3 mb-4 flex flex-wrap items-center gap-3">
            <Activity className="w-4 h-4 text-[#3D4F6F]" />
            <Input type="date" value={sessionsDate} onChange={e => setSessionsDate(e.target.value)} className="w-[160px] text-sm" data-testid="sessions-date-picker" />
            <Button onClick={() => setSessionsDate(today())} variant="outline" size="sm" className="text-xs">Bu gün</Button>
            <Button onClick={() => fetchSessions(sessionsDate)} variant="outline" size="sm" className="text-xs">Yenilə</Button>
            <div className="flex-1"></div>
            <Button onClick={exportSessions} variant="outline" className="text-[#3D4F6F]" data-testid="export-sessions-btn"><Download className="w-4 h-4 mr-1" />Excel</Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="bg-white rounded-lg p-3 border" data-testid="stat-sessions-total"><p className="text-lg font-bold text-[#3D4F6F]">{sessions.length}</p><p className="text-[10px] text-slate-500">Cəmi sessiya</p></div>
            <div className="bg-white rounded-lg p-3 border border-green-100" data-testid="stat-sessions-active"><p className="text-lg font-bold text-green-600">{sessions.filter(s => s.is_open).length}</p><p className="text-[10px] text-slate-500">Aktiv</p></div>
            <div className="bg-white rounded-lg p-3 border" data-testid="stat-sessions-users"><p className="text-lg font-bold text-[#3D4F6F]">{new Set(sessions.map(s => s.user_id)).size}</p><p className="text-[10px] text-slate-500">Unikal istifadəçi</p></div>
            <div className="bg-white rounded-lg p-3 border" data-testid="stat-sessions-time"><p className="text-lg font-bold text-[#3D4F6F]">{fmtDuration(sessions.reduce((acc, s) => acc + (s.active_seconds || 0), 0))}</p><p className="text-[10px] text-slate-500">Ümumi aktiv vaxt</p></div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">İstifadəçi</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Email</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]"><LogIn className="w-3.5 h-3.5 inline mr-1" />Giriş</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]"><LogOut className="w-3.5 h-3.5 inline mr-1" />Çıxış</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]"><Clock className="w-3.5 h-3.5 inline mr-1" />Son fəaliyyət</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Aktiv müddət</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionsLoading ? <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#3D4F6F] mx-auto" /></td></tr> :
                    sessions.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">Bu tarixdə sessiya qeydə alınmayıb</td></tr> :
                    sessions.map(s => (
                      <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50" data-testid={`session-${s.id}`}>
                        <td className="px-3 py-2.5 text-sm font-medium text-[#3D4F6F]">{s.user_name}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">{s.user_email}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{fmtTime(s.login_at)}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{s.logout_at ? fmtTime(s.logout_at) : <span className="text-green-600 font-medium">— hələ aktiv —</span>}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{fmtTime(s.last_active_at)}</td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-[#3D4F6F] whitespace-nowrap">{fmtDuration(s.active_seconds)}</td>
                        <td className="px-3 py-2.5">
                          {s.is_open
                            ? <Badge className="bg-green-100 text-green-700 text-[10px]">Aktiv</Badge>
                            : <Badge className="bg-slate-100 text-slate-600 text-[10px]">Bağlı</Badge>}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showLeaveModal} onOpenChange={setShowLeaveModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[#3D4F6F]">Yeni Məzuniyyət Sorğusu</DialogTitle></DialogHeader>
          <form onSubmit={submitLeave} className="space-y-3">
            <div>
              <Label className="text-xs">Əməkdaş *</Label>
              <Select value={leaveForm.employee_id} onValueChange={v => setLeaveForm({ ...leaveForm, employee_id: v })}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Növ *</Label>
              <Select value={leaveForm.type} onValueChange={v => setLeaveForm({ ...leaveForm, type: v })}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{LEAVE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Başlanğıc *</Label><Input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })} required className="text-sm" /></div>
              <div><Label className="text-xs">Bitmə *</Label><Input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })} required className="text-sm" /></div>
            </div>
            <div><Label className="text-xs">Səbəb</Label><textarea value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} className="w-full min-h-[40px] p-2 text-sm border rounded-lg resize-none" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowLeaveModal(false)}>Ləğv et</Button><Button type="submit" className="bg-[#3D4F6F] text-white" data-testid="submit-leave-btn">Yarat</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
