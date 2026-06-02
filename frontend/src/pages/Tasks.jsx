import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { 
  Plus, Loader2, Calendar, Clock, User, CheckCircle2, Circle, CheckSquare, Square,
  MoreVertical, Pencil, Trash2, AlertCircle, Flag, Filter, Link2, X, MessageSquare, Send,
  CalendarDays, List, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Toaster, toast } from 'sonner';
import { usePermissions, canEdit } from '../context/PermissionContext';
import { formatDate } from '../lib/dateUtils';
import { DatePickerAz } from '../components/DateTimePickerAz';
import { SearchableSelect } from '../components/SearchableSelect';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statuses = ['Gözləyir', 'İcrada', 'Tamamlandı', 'Ləğv edildi'];
const priorities = ['Yüksək', 'Orta', 'Aşağı'];
const relatedTypes = ['Layihələr', 'Görüşlər', 'İclas'];

const getStatusColor = (status) => {
  switch (status) {
    case 'Tamamlandı': return 'bg-green-100 text-green-700';
    case 'İcrada': return 'bg-blue-100 text-blue-700';
    case 'Gözləyir': return 'bg-amber-100 text-amber-700';
    case 'Ləğv edildi': return 'bg-red-100 text-red-700';
    default: return 'bg-slate-100 text-slate-700';
  }
};

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'Yüksək': return 'text-red-500';
    case 'Orta': return 'text-amber-500';
    case 'Aşağı': return 'text-green-500';
    default: return 'text-slate-500';
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'Tamamlandı': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'İcrada': return <Clock className="w-5 h-5 text-blue-500" />;
    case 'Gözləyir': return <Circle className="w-5 h-5 text-amber-500" />;
    case 'Ləğv edildi': return <AlertCircle className="w-5 h-5 text-red-500" />;
    default: return <Circle className="w-5 h-5 text-slate-400" />;
  }
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [showArchive, setShowArchive] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);
  const [options, setOptions] = useState({ departments: [], projects: [] });
  const [assemblies, setAssemblies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filters, setFilters] = useState({ status: 'all', priority: 'all', assignee: '', responsible_person: '', date_from: '', date_to: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'calendar'
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(null);

  const initialFormData = {
    task_name: '', department: '', assignee: [], responsible_person: '',
    priority: 'Orta', start_date: new Date().toISOString().split('T')[0],
    end_date: '', related_object_type: '', related_object_id: '', related_object: '',
    phase: '', status: 'Gözləyir', notes: '', subtasks: []
  };

  const [formData, setFormData] = useState(initialFormData);
  // Scope filter: 'all' | 'mine' | 'team'
  const [scopeFilter, setScopeFilter] = useState('all');

  const token = localStorage.getItem('token');
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'tasks');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [tRes, eRes, oRes, aRes, uRes] = await Promise.all([
        axios.get(`${API}/tasks`, { headers }),
        axios.get(`${API}/employees`, { headers }),
        axios.get(`${API}/options/all`, { headers }),
        axios.get(`${API}/assemblies`, { headers }),
        axios.get(`${API}/settings/users`, { headers }).catch(() => ({ data: [] })),
      ]);
      setTasks(tRes.data);
      setEmployees(eRes.data);
      setOptions(oRes.data);
      setAssemblies(aRes.data);
      setUsers(uRes.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchArchive = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/tasks/archive`, { headers });
      setArchivedTasks(res.data || []);
    } catch (_e) { toast.error('Arxiv yüklənmədi'); }
  }, []);

  useEffect(() => { if (showArchive) fetchArchive(); }, [showArchive, fetchArchive]);

  const restoreArchivedTask = async (archiveId) => {
    try {
      await axios.post(`${API}/tasks/archive/${archiveId}/restore`, {}, { headers });
      toast.success('Tapşırıq bərpa olundu');
      setArchivedTasks(prev => prev.filter(t => t.archive_id !== archiveId));
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Bərpa olunmadı');
    }
  };

  const allPeople = useMemo(() => {
    const norm = (s) => (s || '')
      .toString()
      .normalize('NFC')
      .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const seen = new Map();
    users.forEach(u => {
      if ((u.status || 'Aktiv') !== 'Aktiv') return;
      const nm = norm(u.name);
      if (!nm) return;
      const key = nm.toLocaleLowerCase('az');
      if (!seen.has(key)) seen.set(key, { name: nm, department: norm(u.department) });
    });
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'az'));
  }, [users]);

  // All users available regardless of executor department selection.
  const assigneeOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    allPeople.forEach(p => {
      const key = (p.name || '').normalize('NFC').toLocaleLowerCase('az');
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(p.name);
    });
    return out;
  }, [allPeople]);

  const departments = options.departments || [];
  const projects = options.projects || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (savingTask) return; // prevent double-submit (rapid double-click / Enter spam)
    const aArr = toAssigneeArray(formData.assignee);
    if (aArr.length === 0) { toast.error('Ən azı 1 icraçı əməkdaş seçin'); return; }
    if (!formData.responsible_person?.trim()) { toast.error('Məsul şəxs məcburidir'); return; }
    setSavingTask(true);
    const payload = { ...formData, assignee: aArr };
    try {
      if (editingTask) {
        const { data: updated } = await axios.put(`${API}/tasks/${editingTask.id}`, payload, { headers });
        toast.success('Tapşırıq yeniləndi');
        // Optimistic update — replace task in local state without waiting for refetch
        setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...updated } : t));
      } else {
        const { data: created } = await axios.post(`${API}/tasks`, payload, { headers });
        toast.success('Tapşırıq əlavə edildi');
        // Dedupe optimistic insert — guard against state updaters that already added the task
        setTasks(prev => prev.some(t => t.id === created.id) ? prev : [created, ...prev]);
      }
      setShowModal(false);
      setEditingTask(null);
      setFormData(initialFormData);
    } catch (error) { toast.error('Xəta baş verdi'); }
    finally { setSavingTask(false); }
  };

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [detailTask, setDetailTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`${selectedIds.size} tapşırığı silmək istədiyinizə əminsiniz?`)) return;
    try {
      const r = await axios.post(`${API}/tasks/bulk-delete`, { ids: Array.from(selectedIds) }, { headers });
      toast.success(`${r.data?.deleted || 0} tapşırıq silindi${r.data?.skipped ? `, ${r.data.skipped} icazəsiz` : ''}`);
      setSelectedIds(new Set());
      fetchData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Xəta');
    }
  };

  const openDetail = async (task) => {
    setDetailTask(task);
    setComments([]);
    try {
      const r = await axios.get(`${API}/tasks/${task.id}/comments`, { headers });
      setComments(r.data || []);
    } catch (_) {}
  };

  const submitComment = async () => {
    if (!detailTask || !commentText.trim()) return;
    setSavingComment(true);
    try {
      const r = await axios.post(`${API}/tasks/${detailTask.id}/comments`, { text: commentText }, { headers });
      setComments(prev => [...prev, r.data]);
      setCommentText('');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Şərh göndərilmədi');
    } finally { setSavingComment(false); }
  };

  const saveResult = async (text) => {
    if (!detailTask) return;
    try {
      await axios.put(`${API}/tasks/${detailTask.id}`, { result: text }, { headers });
      setDetailTask(prev => prev ? { ...prev, result: text } : prev);
      setTasks(prev => prev.map(t => t.id === detailTask.id ? { ...t, result: text } : t));
      toast.success('Nəticə yadda saxlanıldı');
    } catch (e) {
      toast.error('Nəticə yenilənmədi');
    }
  };

  const deleteComment = async (cid) => {
    if (!detailTask) return;
    if (!window.confirm('Şərhi silmək istəyirsinizmi?')) return;
    try {
      await axios.delete(`${API}/tasks/${detailTask.id}/comments/${cid}`, { headers });
      setComments(prev => prev.filter(c => c.id !== cid));
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Şərh silinmədi');
    }
  };

  const currentUserName = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').name || ''; } catch { return ''; }
  })();
  const currentUserRole = (() => {
    try { return (JSON.parse(localStorage.getItem('user') || '{}').role || '').toLowerCase(); } catch { return ''; }
  })();

  const canDeleteTask = (task) => {
    if (!_canEdit) return false;
    if (currentUserRole === 'admin') return true;
    const creator = (task.created_by || '').trim();
    return !creator || creator === currentUserName;
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu tapşırığı arxivə köçürmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/tasks/${id}`, { headers });
      toast.success('Tapşırıq arxivləndi');
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Silinmə zamanı xəta');
    }
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setFormData({
      ...initialFormData,
      ...task,
      assignee: toAssigneeArray(task.assignee),
    });
    setShowModal(true);
  };

  const handleStatusChange = async (taskId, newStatus) => {
    // Optimistic update — move card to new column immediately
    const prev = tasks;
    setTasks(prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await axios.put(`${API}/tasks/${taskId}`, { status: newStatus }, { headers });
      toast.success('Status yeniləndi');
      fetchData();
    } catch (error) {
      setTasks(prev); // rollback
      toast.error('Xəta baş verdi');
    }
  };

  const handleRelatedTypeChange = (type) => {
    setFormData({ ...formData, related_object_type: type, related_object_id: '', related_object: '' });
  };

  const handleRelatedIdChange = (id) => {
    let label = id;
    if (formData.related_object_type === 'Layihələr') label = id;
    else if (formData.related_object_type === 'İclas') {
      const a = assemblies.find(x => x.assembly_code === id);
      label = a ? `${id} - ${a.purpose}` : id;
    }
    setFormData({ ...formData, related_object_id: id, related_object: label });
  };

  // Compute team-mates (same department as current user) for the dept-head 'team' filter
  const currentUserDept = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').department || ''; } catch { return ''; }
  }, []);
  const teamNames = useMemo(() => new Set(
    users.filter(u => (u.department || '') === currentUserDept && u.name).map(u => u.name)
  ), [users, currentUserDept]);

  // Normalised name comparison (handles trailing spaces, NFC/NFD, case)
  const normName = (s) => (s || '')
    .toString()
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('az');

  const isOwnTask = (t) => {
    const me = normName(currentUserName);
    if (!me) return false;
    const aList = Array.isArray(t.assignee) ? t.assignee : (t.assignee ? [t.assignee] : []);
    return aList.some(n => normName(n) === me) ||
      normName(t.responsible_person) === me ||
      normName(t.created_by) === me;
  };

  // Display helper — turn assignee (string|array) into a comma-joined string
  const assigneeDisplay = (t) => {
    const a = t.assignee;
    if (Array.isArray(a)) return a.filter(Boolean).join(', ');
    return a || '';
  };

  const toAssigneeArray = (val) => {
    if (Array.isArray(val)) return val.map(v => (v || '').toString().trim()).filter(Boolean);
    if (typeof val === 'string' && val.trim()) return [val.trim()];
    return [];
  };

  // Filter by team scope — works with array or string assignee
  const isTeamTask = (t) => {
    const aList = Array.isArray(t.assignee) ? t.assignee : (t.assignee ? [t.assignee] : []);
    if (aList.some(n => teamNames.has(n))) return true;
    if (t.responsible_person && teamNames.has(t.responsible_person)) return true;
    return false;
  };

  // Client-side filtering (instant — no backend round-trip)
  const filteredTasks = tasks.filter(t => {
    if (filters.status !== 'all' && t.status !== filters.status) return false;
    if (filters.priority !== 'all' && t.priority !== filters.priority) return false;
    if (filters.assignee) {
      const need = normName(filters.assignee);
      const aList = Array.isArray(t.assignee) ? t.assignee : (t.assignee ? [t.assignee] : []);
      if (!aList.some(n => normName(n) === need)) return false;
    }
    if (filters.responsible_person) {
      if (normName(t.responsible_person) !== normName(filters.responsible_person)) return false;
    }
    if (filters.date_from || filters.date_to) {
      const td = (t.end_date || t.start_date || '').slice(0, 10);
      if (!td) return false;
      if (filters.date_from && td < filters.date_from) return false;
      if (filters.date_to && td > filters.date_to) return false;
    }
    if (scopeFilter === 'mine' && !isOwnTask(t)) return false;
    if (scopeFilter === 'team') {
      // Show team members' tasks (others in my dept, excluding me)
      if (!isTeamTask(t)) return false;
      if (isOwnTask(t)) return false;
    }
    return true;
  });
  const tasksByStatus = statuses.reduce((acc, status) => {
    acc[status] = filteredTasks.filter(t => t.status === status);
    return acc;
  }, {});

  const activeFilterCount = [
    filters.status !== 'all',
    filters.priority !== 'all',
    !!filters.assignee,
    !!filters.responsible_person,
    !!filters.date_from,
    !!filters.date_to,
  ].filter(Boolean).length;

  // ========== Calendar helpers ==========
  const AZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
  const AZ_DAYS = ['B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B'];
  const todayStr = new Date().toISOString().split('T')[0];

  // Group filtered tasks by end_date (due date) — fall back to start_date.
  const tasksByDate = filteredTasks.reduce((acc, t) => {
    const ds = (t.end_date || t.start_date || '').slice(0, 10);
    if (!ds) return acc;
    (acc[ds] = acc[ds] || []).push(t);
    return acc;
  }, {});

  const monthGrid = (() => {
    const { year, month } = calendarMonth;
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDow = (first.getDay() + 6) % 7; // Monday-first
    const cells = [];
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

  const fmtCalDate = (d) => {
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

  const taskDotColor = (t) => {
    if (t.status === 'Tamamlandı') return 'bg-emerald-500';
    if (t.status === 'İcrada') return 'bg-blue-500';
    if (t.status === 'Ləğv edildi') return 'bg-red-400';
    if (t.priority === 'Yüksək') return 'bg-rose-500';
    return 'bg-amber-500'; // Gözləyir / default
  };

  const selectedDayTasks = selectedDay ? (tasksByDate[selectedDay] || []) : [];

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="tasks-page">
      <Toaster position="top-right" richColors />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Tapşırıqlar</h1>
          <p className="text-slate-500 text-sm mt-1">Cəmi {filteredTasks.length} tapşırıq{scopeFilter !== 'all' && <span className="text-[#9ACD32] font-semibold ml-1">({scopeFilter === 'mine' ? 'Mənim' : 'Əməkdaşlarımın'})</span>}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-white" data-testid="view-mode-toggle">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === 'kanban' ? 'bg-[#3D4F6F] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              data-testid="view-kanban-btn"
            >
              <List className="w-3.5 h-3.5" />Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === 'calendar' ? 'bg-[#3D4F6F] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              data-testid="view-calendar-btn"
            >
              <CalendarDays className="w-3.5 h-3.5" />Kalendar
            </button>
          </div>
          {/* Scope tabs */}
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-white" data-testid="task-scope-tabs">
            {[
              { value: 'all', label: 'Hamısı' },
              { value: 'mine', label: 'Mənim tapşırıqlarım' },
              ...(currentUserDept && teamNames.size > 1 ? [{ value: 'team', label: 'Əməkdaşlarımın' }] : []),
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setScopeFilter(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${scopeFilter === opt.value ? 'bg-[#9ACD32] text-[#3D4F6F]' : 'text-slate-600 hover:bg-slate-50'}`}
                data-testid={`scope-${opt.value}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}
            className={activeFilterCount > 0 ? 'border-[#9ACD32] bg-[#9ACD32]/10' : ''} data-testid="filter-btn">
            <Filter className="w-4 h-4 mr-1" />Filtr
            {activeFilterCount > 0 && <Badge className="ml-1 bg-[#9ACD32] text-[#3D4F6F] text-xs">{activeFilterCount}</Badge>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowArchive(v => !v)}
            className={showArchive ? 'border-amber-400 bg-amber-50 text-amber-700' : ''} data-testid="toggle-archive-btn">
            <Trash2 className="w-4 h-4 mr-1" />{showArchive ? 'Arxivi bağla' : 'Arxiv'}
            {archivedTasks.length > 0 && !showArchive && <Badge className="ml-1 bg-amber-100 text-amber-700 text-xs">{archivedTasks.length}</Badge>}
          </Button>
          {_canEdit && <Button onClick={() => { setFormData(initialFormData); setEditingTask(null); setShowModal(true); }}
            className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold text-xs sm:text-sm" data-testid="add-task-btn">
            <Plus className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Tapşırıq əlavə et</span>
          </Button>}
        </div>
      </div>

      {/* Bulk-delete bar */}
      {selectedIds.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 flex items-center justify-between" data-testid="bulk-delete-bar">
          <span className="text-xs font-semibold text-amber-700">{selectedIds.size} tapşırıq seçildi</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} className="h-7 text-xs">Ləğv et</Button>
            <Button size="sm" onClick={bulkDelete} className="h-7 text-xs bg-red-500 hover:bg-red-600 text-white" data-testid="bulk-delete-btn">
              <Trash2 className="w-3 h-3 mr-1" />Sil
            </Button>
          </div>
        </div>
      )}

      {showFilters && (
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-slate-100 flex flex-wrap gap-3 items-end">
          <div className="w-40">
            <Label className="text-xs">Status</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
              <SelectTrigger className="text-sm" data-testid="filter-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hamısı</SelectItem>
                {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Label className="text-xs">Prioritet</Label>
            <Select value={filters.priority} onValueChange={(v) => setFilters({...filters, priority: v})}>
              <SelectTrigger className="text-sm" data-testid="filter-priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hamısı</SelectItem>
                {priorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-56">
            <Label className="text-xs">İcraçı əməkdaş</Label>
            <SearchableSelect
              value={filters.assignee}
              onChange={(v) => setFilters({ ...filters, assignee: v })}
              options={allPeople.map(p => p.name)}
              placeholder="Hamısı"
              testId="filter-assignee"
            />
          </div>
          <div className="w-56">
            <Label className="text-xs">Məsul şəxs</Label>
            <SearchableSelect
              value={filters.responsible_person}
              onChange={(v) => setFilters({ ...filters, responsible_person: v })}
              options={allPeople.map(p => p.name)}
              placeholder="Hamısı"
              testId="filter-responsible"
            />
          </div>
          <div className="w-40">
            <Label className="text-xs">Tarixdən</Label>
            <DatePickerAz value={filters.date_from} onChange={(v) => setFilters({ ...filters, date_from: v })} testId="filter-date-from" />
          </div>
          <div className="w-40">
            <Label className="text-xs">Tarixə qədər</Label>
            <DatePickerAz value={filters.date_to} onChange={(v) => setFilters({ ...filters, date_to: v })} testId="filter-date-to" />
          </div>
          {activeFilterCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({ status: 'all', priority: 'all', assignee: '', responsible_person: '', date_from: '', date_to: '' })}
              className="text-xs h-9"
              data-testid="filter-reset-btn"
            >
              <X className="w-3 h-3 mr-1" />Filterləri sıfırla
            </Button>
          )}
        </div>
      )}

      {/* Archive panel */}
      {showArchive && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4" data-testid="task-archive-panel">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-amber-800 text-sm">Arxivlənmiş tapşırıqlar ({archivedTasks.length})</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowArchive(false)} className="h-6 text-amber-700">Bağla</Button>
          </div>
          {archivedTasks.length === 0 ? (
            <p className="text-xs text-amber-700">Arxivdə tapşırıq yoxdur.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-amber-200">
                    <th className="text-left px-2 py-1.5 text-amber-800">Tapşırıq</th>
                    <th className="text-left px-2 py-1.5 text-amber-800">İcraçı</th>
                    <th className="text-left px-2 py-1.5 text-amber-800">Yaradıcı</th>
                    <th className="text-left px-2 py-1.5 text-amber-800">Arxiv tarixi</th>
                    <th className="text-left px-2 py-1.5 text-amber-800">Arxivləyən</th>
                    <th className="text-right px-2 py-1.5 text-amber-800">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedTasks.map(t => (
                    <tr key={t.archive_id} className="border-b border-amber-100 hover:bg-amber-100/50" data-testid={`archive-row-${t.archive_id}`}>
                      <td className="px-2 py-1.5 font-medium text-slate-800">
                        {t.task_code && <span className="font-mono text-[10px] text-slate-400 mr-1">{t.task_code}</span>}
                        {t.task_name}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600">{assigneeDisplay(t) || '-'}</td>
                      <td className="px-2 py-1.5 text-slate-600">{t.created_by || '-'}</td>
                      <td className="px-2 py-1.5 text-slate-600">{formatDate(t.archived_at)}</td>
                      <td className="px-2 py-1.5 text-slate-600">{t.archived_by || '-'}</td>
                      <td className="px-2 py-1.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => restoreArchivedTask(t.archive_id)}
                          className="h-6 text-xs text-emerald-700 hover:bg-emerald-50"
                          data-testid={`restore-task-${t.archive_id}`}
                        >Bərpa et</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Kanban Board */}
      {viewMode === 'kanban' && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statuses.map(status => (
          <div key={status} className="bg-slate-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(status)}
                <h3 className="font-semibold text-sm text-[#3D4F6F]">{status}</h3>
              </div>
              <Badge variant="outline" className="text-xs">{tasksByStatus[status]?.length || 0}</Badge>
            </div>
            <div className="space-y-3">
              {tasksByStatus[status]?.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-4">Tapşırıq yoxdur</p>
              ) : tasksByStatus[status].map(task => {
                const own = isOwnTask(task);
                const subs = Array.isArray(task.subtasks) ? task.subtasks : [];
                const doneCount = subs.filter(s => s?.done).length;
                return (
                <div
                  key={task.id}
                  className={`rounded-lg p-3 shadow-sm border cursor-pointer relative ${selectedIds.has(task.id) ? 'ring-2 ring-amber-400' : ''} ${own ? 'bg-gradient-to-br from-[#FDFFEB] to-[#F4FBD7] border-[#9ACD32] ring-1 ring-[#9ACD32]/30' : 'bg-white border-slate-100'}`}
                  data-testid={`task-card-${task.id}`}
                  onClick={(e) => { if (e.target.closest('button,input,[role="menuitem"]')) return; openDetail(task); }}
                >
                  {/* Bulk-select checkbox */}
                  {canDeleteTask(task) && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(task.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(task.id)}
                      className="absolute top-2 right-2 w-3.5 h-3.5 accent-amber-500"
                      data-testid={`task-select-${task.id}`}
                    />
                  )}
                  <div className="flex items-start justify-between mb-1.5 pr-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        {task.task_code && <span className="text-[10px] text-slate-400 font-mono">{task.task_code}</span>}
                        {own && <Badge className="bg-[#9ACD32] text-[#3D4F6F] text-[9px] px-1.5 py-0">SİZ</Badge>}
                      </div>
                      <h4 className="font-medium text-sm text-slate-800 line-clamp-2">{task.task_name}</h4>
                    </div>
                    {_canEdit && <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><MoreVertical className="w-3.5 h-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(task)}><Pencil className="w-4 h-4 mr-2" />Redaktə</DropdownMenuItem>
                        {statuses.filter(s => s !== task.status).map(s => (
                          <DropdownMenuItem key={s} onClick={() => handleStatusChange(task.id, s)}>
                            {getStatusIcon(s)}<span className="ml-2">{s}</span>
                          </DropdownMenuItem>
                        ))}
                        {canDeleteTask(task) && (
                          <DropdownMenuItem onClick={() => handleDelete(task.id)} className="text-red-600" data-testid={`task-delete-${task.id}`}>
                            <Trash2 className="w-4 h-4 mr-2" />Arxivə köçür
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>}
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Flag className={`w-3.5 h-3.5 ${getPriorityColor(task.priority)}`} />
                    <span className={`text-xs ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                  </div>
                  {/* Left-aligned stack: Assignee, Responsible, Created date, Due date (highlighted) */}
                  <div className="space-y-1 mb-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <User className="w-3 h-3 shrink-0 text-slate-400" />
                      <span className="truncate">{assigneeDisplay(task) || '-'}</span>
                    </div>
                    {task.responsible_person && (
                      <p className="text-[10px] text-slate-400 pl-4">Məsul: {task.responsible_person}</p>
                    )}
                    {task.created_by && (
                      <p className="text-[10px] text-slate-400 pl-4">Yaradan: <span className="text-[#3D4F6F] font-medium">{task.created_by}</span></p>
                    )}
                    {task.created_at && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500" data-testid={`task-created-${task.id}`}>
                        <Clock className="w-3 h-3 shrink-0 text-slate-400" />
                        <span>Yaradılıb: {formatDate(task.created_at)}</span>
                      </div>
                    )}
                    {task.end_date && (
                      <div
                        className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 rounded px-1.5 py-0.5 w-fit"
                        data-testid={`task-due-${task.id}`}
                      >
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span>Bitmə: {formatDate(task.end_date)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {task.creator_department && <Badge className="text-[10px] bg-violet-50 text-violet-700 border border-violet-200">Yaradan: {task.creator_department}</Badge>}
                    {task.department && <Badge className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200">İcraçı: {task.department}</Badge>}
                    {task.related_object_type && (
                      <Badge className="text-[10px] bg-blue-50 text-blue-600">
                        <Link2 className="w-2.5 h-2.5 mr-0.5 inline" />
                        {task.related_object_id || task.related_object_type}
                      </Badge>
                    )}
                    {task.source === 'assembly' && !task.related_object_type && (
                      <Badge className="text-[10px] bg-purple-50 text-purple-600">
                        <Link2 className="w-2.5 h-2.5 mr-0.5 inline" />{task.related_object}
                      </Badge>
                    )}
                  </div>
                  {/* Subtasks checklist */}
                  {subs.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100" data-testid={`subtasks-${task.id}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Mərhələlər</span>
                        <span className="text-[10px] font-bold text-[#3D4F6F]">{doneCount}/{subs.length}</span>
                      </div>
                      <div className="h-1 rounded-full bg-slate-100 overflow-hidden mb-2">
                        <div className="h-full bg-[#9ACD32] transition-all" style={{ width: `${subs.length ? (doneCount / subs.length) * 100 : 0}%` }} />
                      </div>
                      <ul className="space-y-0.5">
                        {subs.slice(0, 4).map((s, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px]">
                            <button
                              type="button"
                              onClick={async () => {
                                const next = subs.map((x, idx) => idx === i ? { ...x, done: !x.done } : x);
                                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, subtasks: next } : t));
                                try { await axios.put(`${API}/tasks/${task.id}`, { subtasks: next }, { headers }); }
                                catch { toast.error('Mərhələ yenilənmədi'); }
                              }}
                              className="shrink-0 mt-0.5"
                              data-testid={`subtask-toggle-${task.id}-${i}`}
                            >
                              {s.done ? <CheckSquare className="w-3 h-3 text-emerald-600" /> : <Square className="w-3 h-3 text-slate-400" />}
                            </button>
                            <span className={s.done ? 'line-through text-slate-400' : 'text-slate-700'}>{s.title}</span>
                          </li>
                        ))}
                        {subs.length > 4 && <li className="text-[10px] text-slate-400 pl-4">+{subs.length - 4} daha</li>}
                      </ul>
                    </div>
                  )}
                </div>
              );})}
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 sm:p-4" data-testid="tasks-calendar">
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
          <div className="grid grid-cols-7 gap-1 mb-1">
            {AZ_DAYS.map((d, i) => (
              <div key={d} className={`text-[10px] sm:text-xs font-semibold text-center py-1.5 ${i >= 5 ? 'text-red-500' : 'text-slate-500'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthGrid.map((cell, idx) => {
              const ds = fmtCalDate(cell.date);
              const dayTasks = tasksByDate[ds] || [];
              const isToday = ds === todayStr;
              const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;
              return (
                <button
                  key={idx}
                  onClick={() => dayTasks.length > 0 && setSelectedDay(ds)}
                  className={`min-h-[70px] sm:min-h-[90px] p-1.5 rounded-lg border text-left transition-all
                    ${cell.currentMonth ? 'bg-white border-slate-200 hover:border-[#9ACD32] hover:shadow-sm' : 'bg-slate-50/50 border-slate-100 opacity-50'}
                    ${isToday ? 'ring-2 ring-[#9ACD32] border-[#9ACD32]' : ''}
                    ${dayTasks.length > 0 && cell.currentMonth ? 'cursor-pointer' : 'cursor-default'}`}
                  data-testid={`cal-day-${ds}`}
                >
                  <div className={`text-xs sm:text-sm font-semibold mb-1 ${isToday ? 'text-[#3D4F6F]' : isWeekend && cell.currentMonth ? 'text-red-400' : 'text-slate-700'}`}>
                    {cell.date.getDate()}
                  </div>
                  {dayTasks.length > 0 && (
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map(t => (
                        <div key={t.id} className="flex items-center gap-1 truncate">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${taskDotColor(t)}`}></span>
                          <span className="text-[9px] sm:text-[10px] text-slate-700 truncate font-medium">
                            {t.task_name}
                          </span>
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-[9px] sm:text-[10px] text-[#3D4F6F] font-semibold">+{dayTasks.length - 3} daha</div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] sm:text-xs text-slate-500">
            <span className="font-semibold text-[#3D4F6F]">İzah:</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span>Gözləyir</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span>İcrada</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Tamamlandı</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"></span>Ləğv edildi</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span>Yüksək prioritet</span>
          </div>
        </div>
      )}

      {/* Day-Detail Dialog (calendar day click) */}
      <Dialog open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="day-detail-dialog">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }} className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {selectedDay && formatDate(selectedDay)} — {selectedDayTasks.length} tapşırıq
            </DialogTitle>
          </DialogHeader>
          {selectedDayTasks.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">Bu gün üçün tapşırıq yoxdur</div>
          ) : (
            <div className="space-y-2">
              {selectedDayTasks
                .sort((a, b) => (a.priority || '').localeCompare(b.priority || ''))
                .map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedDay(null); openDetail(t); }}
                    className="w-full text-left border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors block"
                    data-testid={`day-task-${t.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`w-2 h-2 rounded-full ${taskDotColor(t)}`}></span>
                        {t.task_code && <span className="text-[10px] text-slate-400 font-mono">{t.task_code}</span>}
                        <Badge className={`text-[10px] ${getStatusColor(t.status)}`}>{t.status}</Badge>
                        <Badge className={`text-[10px] bg-slate-100 ${getPriorityColor(t.priority)}`}>{t.priority}</Badge>
                      </div>
                    </div>
                    <h4 className="font-medium text-sm text-slate-800 mb-1">{t.task_name}</h4>
                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <div>İcraçı: {assigneeDisplay(t) || '—'}</div>
                      {t.responsible_person && <div>Məsul: {t.responsible_person}</div>}
                      {t.created_by && <div>Yaradan: {t.created_by}</div>}
                    </div>
                  </button>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>{editingTask ? 'Tapşırığı redaktə et' : 'Tapşırıq əlavə et'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3" data-testid="task-form">
            <div>
              <Label className="text-xs">Tapşırıq adı *</Label>
              <Input value={formData.task_name} onChange={(e) => setFormData({...formData, task_name: e.target.value})} required className="text-sm" data-testid="task-name-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">İcraçı şöbə</Label>
                <Select
                  value={formData.department}
                  onValueChange={(v) => setFormData({ ...formData, department: v })}
                >
                  <SelectTrigger className="text-sm" data-testid="task-dept-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Prioritet *</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({...formData, priority: v})}>
                  <SelectTrigger className="text-sm" data-testid="task-priority-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{priorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">İcraçı əməkdaşlar * <span className="text-slate-400 font-normal">(bir neçə seçə bilərsiniz)</span></Label>
                <SearchableSelect
                  value=""
                  onChange={(v) => {
                    if (!v) return;
                    const cur = toAssigneeArray(formData.assignee);
                    if (cur.includes(v)) { toast.info(`${v} artıq seçilib`); return; }
                    setFormData({ ...formData, assignee: [...cur, v] });
                  }}
                  options={assigneeOptions.filter(n => !toAssigneeArray(formData.assignee).includes(n))}
                  placeholder="Ad-soyad yazaraq əlavə edin..."
                  testId="task-assignee-select"
                />
                {toAssigneeArray(formData.assignee).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5" data-testid="task-assignee-chips">
                    {toAssigneeArray(formData.assignee).map(nm => (
                      <Badge key={nm} className="bg-[#9ACD32]/20 text-[#3D4F6F] border border-[#9ACD32] text-[11px] gap-1 pr-1">
                        <User className="w-2.5 h-2.5" />
                        {nm}
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, assignee: toAssigneeArray(formData.assignee).filter(x => x !== nm) })}
                          className="ml-0.5 hover:bg-red-100 rounded-full p-0.5"
                          data-testid={`remove-assignee-${nm}`}
                        >
                          <X className="w-2.5 h-2.5 text-red-500" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs">Məsul şəxs *</Label>
                <SearchableSelect
                  value={formData.responsible_person}
                  onChange={(v) => setFormData({ ...formData, responsible_person: v })}
                  options={assigneeOptions}
                  placeholder="Ad-soyad yazaraq axtarın..."
                  testId="task-responsible-select"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Başlama tarixi</Label>
                <DatePickerAz value={formData.start_date} onChange={(v) => setFormData({...formData, start_date: v})} testId="task-start-date" />
              </div>
              <div>
                <Label className="text-xs">Bitmə tarixi</Label>
                <DatePickerAz value={formData.end_date} onChange={(v) => setFormData({...formData, end_date: v})} testId="task-end-date" />
              </div>
            </div>

            {/* Subtasks / checklist */}
            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
              <Label className="text-xs flex items-center gap-1 mb-1.5"><CheckSquare className="w-3 h-3" />Mərhələlər (alt başlıqlar / checklist)</Label>
              <div className="space-y-1.5 mb-2" data-testid="subtasks-list">
                {(formData.subtasks || []).map((st, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white border border-slate-100 rounded px-2 py-1">
                    <button
                      type="button"
                      onClick={() => {
                        const next = formData.subtasks.map((x, idx) => idx === i ? { ...x, done: !x.done } : x);
                        setFormData({ ...formData, subtasks: next });
                      }}
                    >
                      {st.done ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                    </button>
                    <Input
                      value={st.title || ''}
                      onChange={(e) => {
                        const next = formData.subtasks.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x);
                        setFormData({ ...formData, subtasks: next });
                      }}
                      placeholder="Mərhələ başlığı..."
                      className={`text-xs flex-1 border-0 shadow-none p-0 h-6 ${st.done ? 'line-through text-slate-400' : ''}`}
                      data-testid={`subtask-input-${i}`}
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, subtasks: formData.subtasks.filter((_, idx) => idx !== i) })}
                      className="p-1 hover:bg-red-50 rounded"
                    >
                      <X className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormData({ ...formData, subtasks: [...(formData.subtasks || []), { title: '', done: false }] })}
                className="h-7 text-xs w-full"
                data-testid="add-subtask-btn"
              >
                <Plus className="w-3 h-3 mr-1" />Mərhələ əlavə et
              </Button>
            </div>

            {/* Related Object */}
            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
              <Label className="text-xs flex items-center gap-1 mb-1.5"><Link2 className="w-3 h-3" />Əlaqəli obyekt</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={formData.related_object_type} onValueChange={handleRelatedTypeChange}>
                  <SelectTrigger className="text-sm h-8" data-testid="task-related-type"><SelectValue placeholder="Növ seçin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Yoxdur</SelectItem>
                    {relatedTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formData.related_object_type === 'Layihələr' && (
                  <Select value={formData.related_object_id} onValueChange={handleRelatedIdChange}>
                    <SelectTrigger className="text-sm h-8" data-testid="task-related-project"><SelectValue placeholder="Layihə seçin" /></SelectTrigger>
                    <SelectContent>{projects.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {formData.related_object_type === 'İclas' && (
                  <Select value={formData.related_object_id} onValueChange={handleRelatedIdChange}>
                    <SelectTrigger className="text-sm h-8" data-testid="task-related-assembly"><SelectValue placeholder="İclas seçin" /></SelectTrigger>
                    <SelectContent>{assemblies.map(a => <SelectItem key={a.assembly_code} value={a.assembly_code}>{a.assembly_code} - {a.purpose}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {formData.related_object_type === 'Görüşlər' && (
                  <Input value={formData.related_object_id} onChange={(e) => setFormData({...formData, related_object_id: e.target.value, related_object: e.target.value})} placeholder="Görüş detalı" className="text-sm h-8" data-testid="task-related-meeting" />
                )}
              </div>
            </div>

            {editingTask && (
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                  <SelectTrigger className="text-sm" data-testid="task-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Qeydlər</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="text-sm" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Ləğv et</Button>
              <Button type="submit" disabled={savingTask} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold disabled:opacity-60 disabled:cursor-not-allowed" data-testid="task-submit-btn">
                {savingTask ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saxlanılır...</>
                ) : (editingTask ? 'Yadda saxla' : 'Əlavə et')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Detail Modal — Nəticə + Şərhlər */}
      <Dialog open={!!detailTask} onOpenChange={(o) => { if (!o) { setDetailTask(null); setComments([]); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="task-detail-modal">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }} className="flex items-center gap-2">
              {detailTask?.task_code && <Badge className="bg-slate-100 text-slate-600 text-xs">{detailTask.task_code}</Badge>}
              {detailTask?.task_name}
            </DialogTitle>
          </DialogHeader>
          {detailTask && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-400">Status:</span> <span className="font-semibold">{detailTask.status}</span></div>
                <div><span className="text-slate-400">Prioritet:</span> <span className="font-semibold">{detailTask.priority}</span></div>
                <div><span className="text-slate-400">İcraçı:</span> {assigneeDisplay(detailTask) || '—'}</div>
                <div><span className="text-slate-400">Məsul:</span> {detailTask.responsible_person || '—'}</div>
                <div><span className="text-slate-400">Yaradan:</span> {detailTask.created_by || '—'}{detailTask.creator_department ? <span className="text-slate-400"> ({detailTask.creator_department})</span> : null}</div>
                <div><span className="text-slate-400">İcraçı şöbə:</span> {detailTask.department || '—'}</div>
                <div><span className="text-slate-400">Bitmə:</span> {detailTask.end_date ? formatDate(detailTask.end_date) : '—'}</div>
              </div>

              {/* Nəticə (Result) */}
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-3">
                <Label className="text-xs font-semibold text-emerald-700">Nəticə</Label>
                <Textarea
                  defaultValue={detailTask.result || ''}
                  placeholder="Tapşırığın nəticəsini buraya yazın..."
                  rows={3}
                  className="mt-1 text-sm bg-white"
                  data-testid="task-result-textarea"
                  onBlur={(e) => {
                    if (e.target.value !== (detailTask.result || '')) saveResult(e.target.value);
                  }}
                />
                <p className="text-[10px] text-slate-400 mt-1">Mətn sahəsindən çıxdıqda avtomatik saxlanır</p>
              </div>

              {/* Comments */}
              <div className="border border-slate-200 rounded-lg p-3">
                <Label className="text-xs font-semibold text-[#3D4F6F] flex items-center gap-1 mb-2">
                  <MessageSquare className="w-3 h-3" />Şərhlər ({comments.length})
                </Label>
                <div className="space-y-2 max-h-60 overflow-y-auto mb-3" data-testid="task-comments-list">
                  {comments.length === 0 && <p className="text-xs text-slate-400 italic">Hələ şərh yoxdur</p>}
                  {comments.map(c => (
                    <div key={c.id} className="bg-slate-50 rounded p-2 group">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-semibold text-[#3D4F6F]">{c.author_name}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">{c.created_at ? new Date(c.created_at).toLocaleString('az-AZ') : ''}</span>
                          {(c.author_name === currentUserName || currentUserRole === 'admin') && (
                            <button type="button" onClick={() => deleteComment(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{c.text}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Şərhinizi yazın..."
                    className="text-sm"
                    data-testid="task-comment-input"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                  />
                  <Button type="button" onClick={submitComment} disabled={savingComment || !commentText.trim()} className="bg-[#3D4F6F] text-white" data-testid="task-comment-send">
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
