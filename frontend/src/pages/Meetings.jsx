import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Plus, Search, Loader2, Calendar, Clock, MapPin, Users2,
  Pencil, Trash2, Video, Building2, Filter, Bell, X,
  Monitor, User
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';
import { usePermissions, canEdit } from '../context/PermissionContext';

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

  const token = localStorage.getItem('token');
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'meetings');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [mRes, eRes, oRes, uRes] = await Promise.all([
        axios.get(`${API}/meetings`, { headers }),
        axios.get(`${API}/employees`, { headers }),
        axios.get(`${API}/options/all`, { headers }),
        axios.get(`${API}/settings/users`, { headers }).catch(() => ({ data: [] })),
      ]);
      setMeetings(mRes.data);
      setEmployees(eRes.data);
      setOptions(oRes.data);
      setUsers(uRes.data || []);
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
        {_canEdit && <Button onClick={() => openModal()} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="add-meeting-btn">
          <Plus className="w-4 h-4 mr-1" />Yeni Görüş
        </Button>}
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
          <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-[140px] text-sm h-9" data-testid="filter-date-from" />
          <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-[140px] text-sm h-9" data-testid="filter-date-to" />
        </div>
      </div>

      {/* Table */}
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
                      <p className="text-xs text-slate-600">{m.date}</p>
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
                      {_canEdit && <div className="flex justify-end gap-1">
                        <button onClick={() => openModal(m)} className="p-1.5 hover:bg-slate-100 rounded-lg" data-testid={`edit-meeting-${m.id}`}>
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        <button onClick={() => handleDelete(m.id)} className="p-1.5 hover:bg-red-50 rounded-lg" data-testid={`delete-meeting-${m.id}`}>
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="text-sm" data-testid="meeting-date-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Saat *</Label>
                <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required className="text-sm" />
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
                <Input type="date" value={form.next_meeting} onChange={(e) => setForm({ ...form, next_meeting: e.target.value })} className="text-sm" />
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
                  <Input type="date" value={rem.date} onChange={(e) => updateReminder(idx, 'date', e.target.value)} className="text-xs h-7 flex-1" />
                  <Input type="time" value={rem.time} onChange={(e) => updateReminder(idx, 'time', e.target.value)} className="text-xs h-7 w-24" />
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
    </div>
  );
}
