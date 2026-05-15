import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Plus, Search, Loader2, Calendar, Clock, MapPin, Users2,
  Pencil, Trash2, Video, Building2, Filter, Bell, X,
  Monitor, User, ChevronLeft, ChevronRight, List, CalendarDays,
  FileDown, Send, Inbox
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';
import { usePermissions, canEdit } from '../context/PermissionContext';
import { formatDate } from '../lib/dateUtils';
import { createUnicodePdf } from '../lib/pdfHelpers';
import MeetingRequestModal, { MeetingRequestInbox } from '../components/MeetingRequest';
import { DatePickerAz, TimeSelectAz } from '../components/DateTimePickerAz';
import { validateRequired } from '../lib/validate';
import autoTable from 'jspdf-autotable';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const emptyForm = {
  employee: '', meeting_setter: '', date: '', time: '',
  company: '', contact_person: '', project: '',
  meeting_type: '', meeting_mode: 'Offline', department: '',
  location: '', result: '', next_meeting: '', notes: '',
  reminders: []
};

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);
  const [options, setOptions] = useState({ meeting_types: [], departments: [], projects: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterType, setFilterType] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Calendar view state
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'calendar'
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showInboxModal, setShowInboxModal] = useState(false);
  const [incomingCount, setIncomingCount] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() }; // month 0-indexed
  });
  const [selectedDay, setSelectedDay] = useState(null); // 'YYYY-MM-DD' or null

  const token = localStorage.getItem('token');
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'meetings');
  const headers = { Authorization: `Bearer ${token}` };

  const [currentUserId, setCurrentUserId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [mRes, eRes, oRes, uRes, meRes, reqRes] = await Promise.all([
        axios.get(`${API}/meetings`, { headers }),
        axios.get(`${API}/employees`, { headers }),
        axios.get(`${API}/options/all`, { headers }),
        axios.get(`${API}/settings/users`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/auth/me`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/meeting-requests`, { headers }).catch(() => ({ data: [] })),
      ]);
      setMeetings(mRes.data);
      setEmployees(eRes.data);
      setOptions(oRes.data);
      setUsers(uRes.data || []);
      const myId = meRes.data?.id || meRes.data?.user_id || null;
      setCurrentUserId(myId);
      // count pending requests addressed to me
      const inc = (reqRes.data || []).filter(r => r.recipients?.some(x => x.id === myId && x.status === 'pending')).length;
      setIncomingCount(inc);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openModal = (meeting = null) => {
    if (meeting) {
      setEditing(meeting);
      setForm({ ...emptyForm, ...meeting });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateRequired([
      [form.employee, 'Sahə işçisi'],
      [form.date, 'Tarix'],
      [form.time, 'Saat'],
    ])) return;
    try {
      if (editing) {
        await axios.put(`${API}/meetings/${editing.id}`, form, { headers });
        toast.success('Görüş yeniləndi');
      } else {
        await axios.post(`${API}/meetings`, form, { headers });
        toast.success('Görüş yaradıldı');
      }
      setShowModal(false);
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu görüşü silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/meetings/${id}`, { headers });
      toast.success('Görüş silindi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const addReminder = () => {
    setForm(prev => ({ ...prev, reminders: [...prev.reminders, { date: '', time: '', note: '' }] }));
  };

  const removeReminder = (idx) => {
    setForm(prev => ({ ...prev, reminders: prev.reminders.filter((_, i) => i !== idx) }));
  };

  const updateReminder = (idx, field, value) => {
    setForm(prev => {
      const updated = [...prev.reminders];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, reminders: updated };
    });
  };

  const filtered = meetings.filter(m => {
    if (filterType !== 'all' && m.meeting_type !== filterType) return false;
    if (filterDept !== 'all' && m.department !== filterDept) return false;
    if (filterEmployee !== 'all' && m.employee !== filterEmployee) return false;
    if (filterDateFrom && m.date < filterDateFrom) return false;
    if (filterDateTo && m.date > filterDateTo) return false;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      if (!m.company?.toLowerCase().includes(t) && !m.employee?.toLowerCase().includes(t) &&
          !m.contact_person?.toLowerCase().includes(t) && !m.notes?.toLowerCase().includes(t)) return false;
    }
    return true;
  });

  const meetingTypes = options.meeting_types || [];
  const departments = options.departments || [];
  const projects = options.projects || [];
  const employeeNames = [...new Set([
    ...users.filter(u => (u.status || 'Aktiv') === 'Aktiv' && u.name).map(u => u.name),
    ...employees.map(e => `${e.first_name || ''} ${e.last_name || ''}`.trim()).filter(Boolean),
  ])];

  // ========== Calendar helpers ==========
  const AZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
  const AZ_DAYS = ['B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B'];
  const todayStr = new Date().toISOString().split('T')[0];

  const exportToPdf = () => {
    if (filtered.length === 0) { toast.warning('İxrac etmək üçün görüş yoxdur'); return; }
    const doc = createUnicodePdf({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.text('Görüşlər hesabatı', 14, 14);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Tarix: ${formatDate(new Date().toISOString())}  |  Sayı: ${filtered.length}`, 14, 20);
    autoTable(doc, {
      startY: 26,
      head: [[
        'Tarix', 'Vaxt', 'Şirkət', 'Sahə işçisi', 'Görüş növü', 'Rejim', 'Yer', 'Status'
      ]],
      body: filtered.map(m => [
        formatDate(m.date),
        m.time || '-',
        m.company || '-',
        m.employee || '-',
        m.meeting_type || '-',
        m.meeting_mode || '-',
        m.location || '-',
        m.result || '-',
      ]),
      styles: { font: 'Roboto', fontSize: 8, cellPadding: 2, textColor: [61, 79, 111] },
      headStyles: { font: 'Roboto', fillColor: [61, 79, 111], textColor: 255, fontStyle: 'normal' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 22 }, 1: { cellWidth: 18 }, 2: { cellWidth: 45 },
        3: { cellWidth: 40 }, 4: { cellWidth: 30 }, 5: { cellWidth: 22 },
        6: { cellWidth: 45 }, 7: { cellWidth: 28 },
      },
    });
    doc.save(`gorusler_${todayStr}.pdf`);
    toast.success('PDF yükləndi');
  };

  // Single-meeting PDF — landscape A4 with a structured details sheet (every
  // field on its own row). Useful for printing or emailing one meeting's
  // summary as an attachment.
  const exportOneToPdf = (m) => {
    const doc = createUnicodePdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFontSize(18);
    doc.text('Görüş protokolu', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`ID: ${m.id || '-'}    |    Çap tarixi: ${formatDate(new Date().toISOString())}`, 14, 25);
    doc.setDrawColor(220);
    doc.line(14, 28, 196, 28);
    autoTable(doc, {
      startY: 32,
      head: [['Sahə', 'Dəyər']],
      body: [
        ['Tarix', formatDate(m.date) || '-'],
        ['Vaxt', m.time || '-'],
        ['Şirkət', m.company || '-'],
        ['Əlaqədar şəxs', m.contact_person || '-'],
        ['Sahə işçisi', m.employee || '-'],
        ['Görüşü təyin edən', m.meeting_setter || '-'],
        ['Şöbə', m.department || '-'],
        ['Görüş növü', m.meeting_type || '-'],
        ['Rejim', m.meeting_mode || '-'],
        ['Məkan', m.location || '-'],
        ['Layihə', m.project || '-'],
        ['Növbəti görüş', formatDate(m.next_meeting) || '-'],
        ['Nəticə', m.result || '-'],
      ],
      styles: { font: 'Roboto', fontSize: 10, cellPadding: 3, textColor: [61, 79, 111] },
      headStyles: { font: 'Roboto', fillColor: [61, 79, 111], textColor: 255, fontStyle: 'normal' },
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 'auto' } },
    });
    if (m.notes) {
      const y = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(11);
      doc.setTextColor(61, 79, 111);
      doc.text('Qeydlər', 14, y);
      doc.setFontSize(10);
      doc.setTextColor(80);
      const split = doc.splitTextToSize(String(m.notes), 180);
      doc.text(split, 14, y + 6);
    }
    const fileSafeCompany = (m.company || 'gorus').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
    doc.save(`gorus_${fileSafeCompany}_${m.date || todayStr}.pdf`);
    toast.success('PDF yükləndi');
  };

  // Group meetings by date (uses already-filtered meetings)
  const meetingsByDate = filtered.reduce((acc, m) => {
    if (!m.date) return acc;
    (acc[m.date] = acc[m.date] || []).push(m);
    return acc;
  }, {});

  // Build month grid (6 rows × 7 cols, Mon-first)
  const monthGrid = (() => {
    const { year, month } = calendarMonth;
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDow = (first.getDay() + 6) % 7; // Monday-first (0=Mon)
    const cells = [];
    // padding from previous month
    for (let i = 0; i < startDow; i++) {
      const d = new Date(year, month, -startDow + i + 1);
      cells.push({ date: d, currentMonth: false });
    }
    for (let day = 1; day <= last.getDate(); day++) {
      cells.push({ date: new Date(year, month, day), currentMonth: true });
    }
    while (cells.length % 7 !== 0 || cells.length < 42) {
      const d = new Date(cells[cells.length - 1].date);
      d.setDate(d.getDate() + 1);
      cells.push({ date: d, currentMonth: d.getMonth() === month });
    }
    return cells;
  })();

  const fmtDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const shiftMonth = (delta) => {
    setCalendarMonth(prev => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const goToCurrentMonth = () => {
    const d = new Date();
    setCalendarMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

  // Color stripes for meeting modes
  const dotColor = (m) => {
    if (m.meeting_mode === 'Online') return 'bg-blue-500';
    if (m.meeting_type === 'Müştəri görüşü') return 'bg-emerald-500';
    if (m.meeting_type === 'Daxili görüş') return 'bg-amber-500';
    return 'bg-[#9ACD32]';
  };

  const selectedDayMeetings = selectedDay ? (meetingsByDate[selectedDay] || []) : [];

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="meetings-page">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Görüşlər</h1>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} görüş</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1" data-testid="meeting-view-toggle">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-white text-[#3D4F6F] shadow-sm' : 'text-slate-500 hover:text-[#3D4F6F]'}`}
              data-testid="view-table-btn"
            >
              <List className="w-3.5 h-3.5" />Cədvəl
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${viewMode === 'calendar' ? 'bg-white text-[#3D4F6F] shadow-sm' : 'text-slate-500 hover:text-[#3D4F6F]'}`}
              data-testid="view-calendar-btn"
            >
              <CalendarDays className="w-3.5 h-3.5" />Kalendar
            </button>
          </div>
          <Button onClick={exportToPdf} variant="outline" size="sm" className="text-[#3D4F6F]" data-testid="meetings-export-pdf-btn">
            <FileDown className="w-4 h-4 mr-1" />PDF
          </Button>
          {_canEdit && <Button onClick={() => setShowRequestModal(true)} variant="outline" size="sm" className="text-[#3D4F6F]" data-testid="meeting-request-btn">
            <Send className="w-4 h-4 mr-1" />Görüş istəyi
          </Button>}
          <Button onClick={() => setShowInboxModal(true)} variant="outline" size="sm" className="text-[#3D4F6F] relative" data-testid="meeting-inbox-btn">
            <Inbox className="w-4 h-4 mr-1" />Təkliflər
            {incomingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {incomingCount}
              </span>
            )}
          </Button>
          {_canEdit && <Button onClick={() => openModal()} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="add-meeting-btn">
            <Plus className="w-4 h-4 mr-1" />Yeni Görüş
          </Button>}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Axtar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" data-testid="meeting-search" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px] text-sm h-9" data-testid="filter-type"><SelectValue placeholder="Növ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün növlər</SelectItem>
              {meetingTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[130px] text-sm h-9" data-testid="filter-dept"><SelectValue placeholder="Şöbə" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün şöbələr</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-[150px] text-sm h-9" data-testid="filter-employee"><SelectValue placeholder="Əməkdaş" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün əməkdaşlar</SelectItem>
              {employeeNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="w-[150px]"><DatePickerAz value={filterDateFrom} onChange={setFilterDateFrom} placeholder="Tarix (başlanğıc)" testId="filter-date-from" /></div>
          <div className="w-[150px]"><DatePickerAz value={filterDateTo} onChange={setFilterDateTo} placeholder="Tarix (son)" testId="filter-date-to" /></div>
        </div>
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="meetings-table">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">#</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Əməkdaş</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Növ</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Rejim</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Şöbə</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Tarix/Saat</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Şirkət</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Məkan</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Xatırlatma</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400 text-sm">Görüş tapılmadı</td></tr>
              ) : (
                filtered.map((m, idx) => (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50" data-testid={`meeting-row-${m.id}`}>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-medium text-[#3D4F6F]">{m.employee}</p>
                      {m.meeting_setter && <p className="text-[10px] text-slate-400">Təyin edən: {m.meeting_setter}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className="bg-[#3D4F6F]/10 text-[#3D4F6F] text-xs">{m.meeting_type}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className={`text-xs ${m.meeting_mode === 'Online' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {m.meeting_mode === 'Online' ? <><Monitor className="w-3 h-3 mr-1 inline" />Online</> : <><User className="w-3 h-3 mr-1 inline" />Offline</>}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{m.department || '-'}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-xs text-slate-600">{formatDate(m.date)}</p>
                      <p className="text-xs text-slate-400">{m.time}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-xs text-slate-600">{m.company || '-'}</p>
                      {m.contact_person && <p className="text-[10px] text-slate-400">{m.contact_person}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{m.location || '-'}</td>
                    <td className="px-3 py-2.5">
                      {m.reminders?.length > 0 ? (
                        <Badge className="bg-amber-100 text-amber-700 text-xs"><Bell className="w-3 h-3 mr-0.5 inline" />{m.reminders.length}</Badge>
                      ) : <span className="text-xs text-slate-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => exportOneToPdf(m)} className="p-1.5 hover:bg-blue-50 rounded-lg" title="PDF" data-testid={`pdf-meeting-${m.id}`}>
                          <FileDown className="w-3.5 h-3.5 text-blue-500" />
                        </button>
                        {_canEdit && <>
                          <button onClick={() => openModal(m)} className="p-1.5 hover:bg-slate-100 rounded-lg" data-testid={`edit-meeting-${m.id}`}>
                            <Pencil className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                          <button onClick={() => handleDelete(m.id)} className="p-1.5 hover:bg-red-50 rounded-lg" data-testid={`delete-meeting-${m.id}`}>
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* CALENDAR VIEW */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 sm:p-4" data-testid="meetings-calendar">
          {/* Calendar header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg hover:bg-slate-100" data-testid="cal-prev-month"><ChevronLeft className="w-4 h-4 text-[#3D4F6F]" /></button>
              <h3 className="text-sm sm:text-base font-bold text-[#3D4F6F] min-w-[160px] text-center" data-testid="cal-current-month">
                {AZ_MONTHS[calendarMonth.month]} {calendarMonth.year}
              </h3>
              <button onClick={() => shiftMonth(1)} className="p-2 rounded-lg hover:bg-slate-100" data-testid="cal-next-month"><ChevronRight className="w-4 h-4 text-[#3D4F6F]" /></button>
            </div>
            <Button variant="outline" size="sm" onClick={goToCurrentMonth} className="text-xs" data-testid="cal-today-btn">Bu ay</Button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {AZ_DAYS.map((d, i) => (
              <div key={d} className={`text-[10px] sm:text-xs font-semibold text-center py-1.5 ${i >= 5 ? 'text-red-500' : 'text-slate-500'}`}>{d}</div>
            ))}
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-7 gap-1">
            {monthGrid.map((cell, idx) => {
              const ds = fmtDate(cell.date);
              const dayMtgs = meetingsByDate[ds] || [];
              const isToday = ds === todayStr;
              const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(ds)}
                  className={`
                    min-h-[70px] sm:min-h-[90px] p-1.5 rounded-lg border text-left transition-all
                    ${cell.currentMonth ? 'bg-white border-slate-200 hover:border-[#9ACD32] hover:shadow-sm' : 'bg-slate-50/50 border-slate-100 opacity-50'}
                    ${isToday ? 'ring-2 ring-[#9ACD32] border-[#9ACD32]' : ''}
                    ${dayMtgs.length > 0 && cell.currentMonth ? 'cursor-pointer' : 'cursor-default'}
                  `}
                  data-testid={`cal-day-${ds}`}
                >
                  <div className={`text-xs sm:text-sm font-semibold mb-1 ${isToday ? 'text-[#3D4F6F]' : isWeekend && cell.currentMonth ? 'text-red-400' : 'text-slate-700'}`}>
                    {cell.date.getDate()}
                  </div>
                  {dayMtgs.length > 0 && (
                    <div className="space-y-0.5">
                      {dayMtgs.slice(0, 3).map(m => (
                        <div key={m.id} className="flex items-center gap-1 truncate">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor(m)}`}></span>
                          <span className="text-[9px] sm:text-[10px] text-slate-600 truncate">
                            {m.time && <span className="text-slate-400 mr-0.5">{m.time}</span>}
                            <span className="font-medium">{m.employee}</span>
                          </span>
                        </div>
                      ))}
                      {dayMtgs.length > 3 && (
                        <div className="text-[9px] sm:text-[10px] text-[#3D4F6F] font-semibold">+{dayMtgs.length - 3} daha</div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] sm:text-xs text-slate-500">
            <span className="font-semibold text-[#3D4F6F]">İzah:</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Online</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Müştəri görüşü</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span>Daxili</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#9ACD32]"></span>Digər</span>
          </div>
        </div>
      )}

      {/* Day-Detail Dialog (calendar click) */}
      <Dialog open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="day-detail-dialog">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>
              <Calendar className="w-4 h-4 inline mr-2" />
              {selectedDay} — {selectedDayMeetings.length} görüş
            </DialogTitle>
          </DialogHeader>
          {selectedDayMeetings.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">Bu gün üçün görüş qeydə alınmayıb</div>
          ) : (
            <div className="space-y-2">
              {selectedDayMeetings
                .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                .map(m => (
                  <div key={m.id} className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors" data-testid={`day-meeting-${m.id}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${dotColor(m)}`}></span>
                        <span className="text-sm font-bold text-[#3D4F6F]">{m.time || '—'}</span>
                        <Badge className="bg-slate-100 text-slate-700 text-[10px]">{m.meeting_type}</Badge>
                        <Badge className={`text-[10px] ${m.meeting_mode === 'Online' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                          {m.meeting_mode}
                        </Badge>
                      </div>
                      {_canEdit && (
                        <button onClick={() => { setSelectedDay(null); openModal(m); }} className="p-1 hover:bg-slate-100 rounded" data-testid={`day-edit-${m.id}`}>
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      )}
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <User className="w-3 h-3 text-slate-400" />
                        <span className="font-medium">{m.employee}</span>
                        {m.meeting_setter && <span className="text-slate-400">• Təyin edən: {m.meeting_setter}</span>}
                      </div>
                      {m.company && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {m.company}
                          {m.contact_person && <span className="text-slate-400">• {m.contact_person}</span>}
                        </div>
                      )}
                      {m.location && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {m.location}
                        </div>
                      )}
                      {m.notes && <div className="text-slate-500 mt-1 pt-1 border-t border-slate-100 text-[11px]">{m.notes}</div>}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Meeting Form Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>{editing ? 'Görüşü redaktə et' : 'Yeni Görüş'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="meeting-form">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Əməkdaş *</Label>
                <Select value={form.employee} onValueChange={(v) => setForm({ ...form, employee: v })}>
                  <SelectTrigger className="text-sm" data-testid="meeting-employee-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    {employeeNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Görüşü təyin edən</Label>
                <Input value={form.meeting_setter} onChange={(e) => setForm({ ...form, meeting_setter: e.target.value })} className="text-sm" placeholder="Ad daxil edin" data-testid="meeting-setter-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Layihə</Label>
                <Select value={form.project} onValueChange={(v) => setForm({ ...form, project: v })}>
                  <SelectTrigger className="text-sm" data-testid="meeting-project-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Görüşün növü *</Label>
                <Select value={form.meeting_type} onValueChange={(v) => setForm({ ...form, meeting_type: v })}>
                  <SelectTrigger className="text-sm" data-testid="meeting-type-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    {meetingTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Rejim *</Label>
                <Select value={form.meeting_mode} onValueChange={(v) => setForm({ ...form, meeting_mode: v })}>
                  <SelectTrigger className="text-sm" data-testid="meeting-mode-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Online">Online</SelectItem>
                    <SelectItem value="Offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Şöbə</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger className="text-sm" data-testid="meeting-dept-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tarix *</Label>
                <DatePickerAz value={form.date} onChange={(v) => setForm({ ...form, date: v })} required testId="meeting-date-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Saat *</Label>
                <TimeSelectAz value={form.time} onChange={(v) => setForm({ ...form, time: v })} required testId="meeting-time-input" />
              </div>
              <div>
                <Label className="text-xs">Şirkət</Label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Əlaqədar şəxs</Label>
                <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Məkan / Link</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="text-sm" placeholder={form.meeting_mode === 'Online' ? 'Zoom/Teams linki' : 'Ünvan'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nəticə</Label>
                <Input value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Növbəti görüş</Label>
                <DatePickerAz value={form.next_meeting} onChange={(v) => setForm({ ...form, next_meeting: v })} testId="meeting-next-input" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Qeyd</Label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full min-h-[50px] p-2 text-sm border rounded-lg resize-none" />
            </div>

            {/* Reminders */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs flex items-center gap-1"><Bell className="w-3 h-3" />Xatırlatmalar</Label>
                <Button type="button" variant="outline" size="sm" onClick={addReminder} className="h-6 text-xs" data-testid="add-reminder-btn">
                  <Plus className="w-3 h-3 mr-0.5" />Əlavə et
                </Button>
              </div>
              {form.reminders.map((rem, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2 bg-amber-50/50 p-2 rounded-lg border border-amber-100" data-testid={`reminder-${idx}`}>
                  <DatePickerAz value={rem.date} onChange={(v) => updateReminder(idx, 'date', v)} size="sm" className="flex-1" />
                  <TimeSelectAz value={rem.time} onChange={(v) => updateReminder(idx, 'time', v)} size="sm" className="w-28" />
                  <Input placeholder="Qeyd" value={rem.note} onChange={(e) => updateReminder(idx, 'note', e.target.value)} className="text-xs h-7 flex-1" />
                  <button type="button" onClick={() => removeReminder(idx)} className="p-1 hover:bg-red-100 rounded"><X className="w-3 h-3 text-red-500" /></button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Ləğv et</Button>
              <Button type="submit" className="bg-[#3D4F6F] hover:bg-[#2A364C] text-white" data-testid="meeting-submit-btn">{editing ? 'Yadda saxla' : 'Yarat'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Meeting Request Modal — send request to internal users */}
      <MeetingRequestModal
        open={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        currentUserId={currentUserId}
        meetingTypes={options.meeting_types || []}
        onSent={fetchData}
      />

      {/* Meeting Request Inbox — accept/reject incoming requests */}
      <MeetingRequestInbox
        open={showInboxModal}
        onClose={() => setShowInboxModal(false)}
        currentUserId={currentUserId}
        onAccepted={fetchData}
      />
    </div>
  );
}
