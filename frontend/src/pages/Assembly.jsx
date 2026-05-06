import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Plus, Search, Loader2, Pencil, Trash2, X, Download,
  Eye, Users2, Target, ListChecks, ClipboardList
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const emptyTask = () => ({ title: '', responsible_persons: [], assignees: [], deadline: '' });
const emptyAgenda = () => ({ title: '', tasks: [emptyTask()] });

const emptyForm = {
  department: '', purpose: '',
  agendas: [emptyAgenda()],
  general_tasks: [emptyTask()],
  discussion_topics: [''],
  deadline: '', next_assembly_date: '',
  decisions: ['']
};

// Multi-select tag component
function PersonTags({ selected, options, onChange, placeholder, testId }) {
  const [open, setOpen] = useState(false);
  const available = options.filter(o => !selected.includes(o));
  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 min-h-[28px] border rounded-md px-1.5 py-1 cursor-pointer bg-white" onClick={() => setOpen(!open)} data-testid={testId}>
        {selected.length === 0 && <span className="text-xs text-slate-400 py-0.5">{placeholder}</span>}
        {selected.map((p, i) => (
          <span key={i} className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
            {p}
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(selected.filter((_, j) => j !== i)); }} className="hover:text-red-500">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
      {open && available.length > 0 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full mt-1 left-0 w-full bg-white border rounded-md shadow-lg max-h-[140px] overflow-y-auto">
            {available.map(n => (
              <button key={n} type="button" className="w-full text-left text-xs px-2 py-1.5 hover:bg-slate-50" onClick={() => { onChange([...selected, n]); setOpen(false); }}>
                {n}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Generic dynamic-list field (declared at module scope so its identity is stable
// between renders; otherwise <Input> would unmount on every keystroke and lose focus).
function ListField({ label, items, placeholder, onAdd, onUpdate, onRemove, testId }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs">{label}</Label>
        <button type="button" onClick={onAdd} className="text-[10px] text-[#9ACD32] hover:underline font-medium">+ Əlavə et</button>
      </div>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5 mb-1.5">
          <Input value={item} onChange={(e) => onUpdate(idx, e.target.value)} placeholder={placeholder} className="text-sm h-8" data-testid={testId ? `${testId}-${idx}` : undefined} />
          {items.length > 1 && (
            <button type="button" onClick={() => onRemove(idx)} className="p-1 hover:bg-red-100 rounded flex-shrink-0"><X className="w-3 h-3 text-red-500" /></button>
          )}
        </div>
      ))}
    </div>
  );
}

// Shared task row (module-scope for stable identity across renders).
function TaskRow({ task, onUpdate, onRemove, canRemove, prefix, employeeNames }) {
  return (
    <div className="space-y-1.5 bg-slate-50/80 rounded-md p-2 border border-slate-100" data-testid={`${prefix}`}>
      <div className="flex items-center gap-1.5">
        <Input value={task.title} onChange={(e) => onUpdate('title', e.target.value)} placeholder="Tapşırıq" className="text-sm h-7 flex-1" />
        <div className="w-[120px]">
          <Input type="date" value={task.deadline} onChange={(e) => onUpdate('deadline', e.target.value)} className="text-sm h-7" />
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove} className="p-1 hover:bg-red-100 rounded flex-shrink-0"><X className="w-3 h-3 text-red-500" /></button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <span className="text-[10px] text-slate-400">Məsul şəxslər</span>
          <PersonTags selected={task.responsible_persons} options={employeeNames} onChange={(v) => onUpdate('responsible_persons', v)} placeholder="Məsul seçin" testId={`${prefix}-resp`} />
        </div>
        <div>
          <span className="text-[10px] text-slate-400">Əməkdaşlar</span>
          <PersonTags selected={task.assignees} options={employeeNames} onChange={(v) => onUpdate('assignees', v)} placeholder="Əməkdaş seçin" testId={`${prefix}-assign`} />
        </div>
      </div>
    </div>
  );
}

// Detail task row for expanded view (module-scope).
function DetailTaskRow({ t }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs py-1">
      <ListChecks className="w-3 h-3 text-amber-500 flex-shrink-0" />
      <span className="text-slate-700 font-medium">{t.title}</span>
      {t.deadline && <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{t.deadline}</span>}
      {(t.responsible_persons || []).map((p, i) => <Badge key={`r${i}`} className="bg-purple-50 text-purple-600 text-[10px]">{p}</Badge>)}
      {(t.assignees || []).map((p, i) => <Badge key={`a${i}`} className="bg-blue-50 text-blue-600 text-[10px]">{p}</Badge>)}
    </div>
  );
}

export default function Assembly() {
  const [assemblies, setAssemblies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [options, setOptions] = useState({ departments: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterDept, setFilterDept] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);

  const token = localStorage.getItem('token');
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'assembly');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [aRes, eRes, oRes] = await Promise.all([
        axios.get(`${API}/assemblies`, { headers }),
        axios.get(`${API}/employees`, { headers }),
        axios.get(`${API}/options/all`, { headers }),
      ]);
      setAssemblies(aRes.data);
      setEmployees(eRes.data);
      setOptions(oRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const parseTask = (t) => ({
    title: t.title || '',
    responsible_persons: t.responsible_persons || (t.responsible_person ? [t.responsible_person] : []),
    assignees: t.assignees || (t.assignee ? [t.assignee] : []),
    deadline: t.deadline || ''
  });

  const openModal = (assembly = null) => {
    if (assembly) {
      setEditing(assembly);
      const agendas = (assembly.agendas || []).map(a => ({
        title: a.title || '',
        tasks: (a.tasks || []).length ? a.tasks.map(parseTask) : [emptyTask()]
      }));
      setForm({
        department: assembly.department || '',
        purpose: assembly.purpose || '',
        agendas: agendas.length ? agendas : [emptyAgenda()],
        general_tasks: (assembly.general_tasks || []).length ? assembly.general_tasks.map(parseTask) : [emptyTask()],
        discussion_topics: (assembly.discussion_topics || []).length ? assembly.discussion_topics : [''],
        deadline: assembly.deadline || '',
        next_assembly_date: assembly.next_assembly_date || '',
        decisions: (assembly.decisions || []).length ? assembly.decisions : [''],
      });
    } else {
      setEditing(null);
      setForm({ ...emptyForm, agendas: [emptyAgenda()], general_tasks: [emptyTask()], discussion_topics: [''], decisions: [''] });
    }
    setShowModal(true);
  };

  const cleanTask = (t) => ({ title: t.title.trim(), responsible_persons: t.responsible_persons, assignees: t.assignees, deadline: t.deadline });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      agendas: form.agendas.filter(a => a.title.trim()).map(a => ({
        title: a.title.trim(),
        tasks: a.tasks.filter(t => t.title.trim()).map(cleanTask)
      })),
      general_tasks: form.general_tasks.filter(t => t.title.trim()).map(cleanTask),
      discussion_topics: form.discussion_topics.filter(a => a.trim()),
      decisions: form.decisions.filter(a => a.trim()),
    };
    try {
      if (editing) {
        await axios.put(`${API}/assemblies/${editing.id}`, payload, { headers });
        toast.success('İclas yeniləndi');
      } else {
        await axios.post(`${API}/assemblies`, payload, { headers });
        toast.success('İclas yaradıldı');
      }
      setShowModal(false);
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu iclası silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/assemblies/${id}`, { headers });
      toast.success('İclas silindi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  // Agenda helpers
  const addAgenda = () => setForm(p => ({ ...p, agendas: [...p.agendas, emptyAgenda()] }));
  const removeAgenda = (idx) => setForm(p => ({ ...p, agendas: p.agendas.filter((_, i) => i !== idx) }));
  const updateAgendaTitle = (idx, val) => setForm(p => {
    const a = [...p.agendas]; a[idx] = { ...a[idx], title: val }; return { ...p, agendas: a };
  });

  // Task helpers (for agenda tasks)
  const addTask = (agendaIdx) => setForm(p => {
    const a = [...p.agendas];
    a[agendaIdx] = { ...a[agendaIdx], tasks: [...a[agendaIdx].tasks, emptyTask()] };
    return { ...p, agendas: a };
  });
  const removeTask = (agendaIdx, taskIdx) => setForm(p => {
    const a = [...p.agendas];
    a[agendaIdx] = { ...a[agendaIdx], tasks: a[agendaIdx].tasks.filter((_, i) => i !== taskIdx) };
    return { ...p, agendas: a };
  });
  const updateTask = (agendaIdx, taskIdx, field, val) => setForm(p => {
    const a = [...p.agendas];
    const tasks = [...a[agendaIdx].tasks];
    tasks[taskIdx] = { ...tasks[taskIdx], [field]: val };
    a[agendaIdx] = { ...a[agendaIdx], tasks };
    return { ...p, agendas: a };
  });

  // General task helpers
  const addGeneralTask = () => setForm(p => ({ ...p, general_tasks: [...p.general_tasks, emptyTask()] }));
  const removeGeneralTask = (idx) => setForm(p => ({ ...p, general_tasks: p.general_tasks.filter((_, i) => i !== idx) }));
  const updateGeneralTask = (idx, field, val) => setForm(p => {
    const t = [...p.general_tasks]; t[idx] = { ...t[idx], [field]: val }; return { ...p, general_tasks: t };
  });

  // Simple list helpers
  const addItem = (field) => setForm(p => ({ ...p, [field]: [...p[field], ''] }));
  const removeItem = (field, idx) => setForm(p => ({ ...p, [field]: p[field].filter((_, i) => i !== idx) }));
  const updateItem = (field, idx, val) => setForm(p => { const arr = [...p[field]]; arr[idx] = val; return { ...p, [field]: arr }; });

  const filtered = assemblies.filter(a => {
    if (filterDept !== 'all' && a.department !== filterDept) return false;
    if (filterDateFrom && (a.created_at || '') < filterDateFrom) return false;
    if (filterDateTo && (a.created_at || '') > filterDateTo + 'T23:59:59') return false;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      const allPersons = [
        ...(a.agendas || []).flatMap(ag => (ag.tasks || []).flatMap(tk => [...(tk.responsible_persons || []), ...(tk.assignees || [])])),
        ...(a.general_tasks || []).flatMap(tk => [...(tk.responsible_persons || []), ...(tk.assignees || [])])
      ].join(' ').toLowerCase();
      if (!a.assembly_code?.toLowerCase().includes(t) && !a.purpose?.toLowerCase().includes(t) &&
          !a.department?.toLowerCase().includes(t) && !allPersons.includes(t)) return false;
    }
    return true;
  });

  const departments = options.departments || [];
  const employeeNames = [...new Set(employees.map(e => `${e.first_name || ''} ${e.last_name || ''}`.trim()).filter(Boolean))];

  const getResponsibles = (a) => [...new Set([
    ...(a.agendas || []).flatMap(ag => (ag.tasks || []).flatMap(t => [...(t.responsible_persons || []), ...(t.assignees || [])])),
    ...(a.general_tasks || []).flatMap(t => [...(t.responsible_persons || []), ...(t.assignees || [])])
  ].filter(Boolean))];

  const exportToExcel = () => {
    if (filtered.length === 0) return toast.error('Export ucun melumat yoxdur');
    const wb = XLSX.utils.book_new();
    const rows = [];
    filtered.forEach(a => {
      (a.agendas || []).forEach(ag => {
        (ag.tasks || []).forEach(t => {
          rows.push({
            'Iclas ID': a.assembly_code, 'Aparici Sobe': a.department, 'Meqsed': a.purpose,
            'Gundem': ag.title, 'Tapshiriq': t.title,
            'Mesul Shexsler': (t.responsible_persons || []).join(', '),
            'Emekdashlar': (t.assignees || []).join(', '),
            'Tapshiriq son tarix': t.deadline || '', 'Son tarix': a.deadline, 'Novbeti iclas': a.next_assembly_date,
          });
        });
      });
      (a.general_tasks || []).forEach(t => {
        rows.push({
          'Iclas ID': a.assembly_code, 'Aparici Sobe': a.department, 'Meqsed': a.purpose,
          'Gundem': 'Ümumi', 'Tapshiriq': t.title,
          'Mesul Shexsler': (t.responsible_persons || []).join(', '),
          'Emekdashlar': (t.assignees || []).join(', '),
          'Tapshiriq son tarix': t.deadline || '', 'Son tarix': a.deadline, 'Novbeti iclas': a.next_assembly_date,
        });
      });
    });
    const decRows = filtered.flatMap(a => (a.decisions || []).map(d => ({ 'Iclas ID': a.assembly_code, 'Qerar': d })));
    const ws1 = XLSX.utils.json_to_sheet(rows);
    ws1['!cols'] = [{ wch: 10 }, { wch: 16 }, { wch: 30 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Iclaslar');
    if (decRows.length) {
      const ws2 = XLSX.utils.json_to_sheet(decRows);
      ws2['!cols'] = [{ wch: 10 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Qerarlar');
    }
    XLSX.writeFile(wb, `iclaslar_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel fayli yuklendi');
  };

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="assembly-page">
      <Toaster position="top-right" richColors />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>İclaslar</h1>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} iclas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} variant="outline" className="text-[#3D4F6F] border-[#3D4F6F]/20 hover:bg-[#3D4F6F]/5" data-testid="export-excel-btn">
            <Download className="w-4 h-4 mr-1" />Excel
          </Button>
          {_canEdit && <Button onClick={() => openModal()} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="add-assembly-btn">
            <Plus className="w-4 h-4 mr-1" />Yeni İclas
          </Button>}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Axtar (ID, məqsəd, şöbə, məsul)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" data-testid="assembly-search" />
          </div>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[160px] text-sm h-9" data-testid="filter-dept"><SelectValue placeholder="Şöbə" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün şöbələr</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-[140px] text-sm h-9" data-testid="filter-date-from" />
          <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-[140px] text-sm h-9" data-testid="filter-date-to" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="assembly-table">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">İclas ID</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Aparıcı Şöbə</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Məqsəd</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Şəxslər</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">İclas tarixi</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Növbəti iclas</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Detallar</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">İclas tapılmadı</td></tr>
              ) : filtered.map((a) => {
                const persons = getResponsibles(a);
                return (
                  <tr key={a.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${expandedRow === a.id ? 'bg-slate-50/70' : ''}`} data-testid={`assembly-row-${a.id}`}>
                    <td className="px-3 py-2.5"><Badge className="bg-[#3D4F6F] text-white text-xs font-mono">{a.assembly_code}</Badge></td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">{a.department || '-'}</td>
                    <td className="px-3 py-2.5 text-sm text-[#3D4F6F] font-medium max-w-[200px] truncate">{a.purpose || '-'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {persons.slice(0, 3).map((p, i) => <Badge key={i} className="bg-slate-100 text-slate-600 text-[10px]">{p}</Badge>)}
                        {persons.length > 3 && <Badge className="bg-slate-100 text-slate-400 text-[10px]">+{persons.length - 3}</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{a.deadline || '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{a.next_assembly_date || '-'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => setExpandedRow(expandedRow === a.id ? null : a.id)}
                        className={`p-1.5 rounded-lg transition-colors ${expandedRow === a.id ? 'bg-[#3D4F6F] text-white' : 'hover:bg-slate-100 text-slate-400'}`}
                        data-testid={`view-detail-${a.id}`}><Eye className="w-4 h-4" /></button>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        {_canEdit && <button onClick={() => openModal(a)} className="p-1.5 hover:bg-slate-100 rounded-lg" data-testid={`edit-assembly-${a.id}`}><Pencil className="w-3.5 h-3.5 text-slate-400" /></button>}
                        {_canEdit && <button onClick={() => handleDelete(a.id)} className="p-1.5 hover:bg-red-50 rounded-lg" data-testid={`delete-assembly-${a.id}`}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expanded Detail */}
        {expandedRow && (() => {
          const a = assemblies.find(x => x.id === expandedRow);
          if (!a) return null;
          return (
            <div className="border-t bg-slate-50/50 p-4 space-y-4" data-testid="assembly-detail">
              {(a.agendas || []).length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Gündəmlər / Tapşırıqlar</p>
                  <div className="space-y-3">
                    {a.agendas.map((ag, i) => (
                      <div key={i} className="bg-white rounded-lg border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-[#3D4F6F] flex items-center gap-2">
                          <Target className="w-3.5 h-3.5 text-blue-500" />{ag.title}
                        </p>
                        {(ag.tasks || []).length > 0 && (
                          <div className="mt-2 ml-5 space-y-1">
                            {ag.tasks.map((t, j) => <DetailTaskRow key={j} t={t} />)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(a.general_tasks || []).length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Ümumi Tapşırıqlar</p>
                  <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-1">
                    {a.general_tasks.map((t, i) => <DetailTaskRow key={i} t={t} />)}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(a.discussion_topics || []).length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Müzakirə mövzuları</p>
                    <ul className="space-y-0.5">{a.discussion_topics.map((m, i) => <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-purple-500 font-bold">{i+1}.</span>{m}</li>)}</ul>
                  </div>
                )}
                {(a.decisions || []).length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Qəbul edilən qərarlar</p>
                    <ul className="space-y-0.5">{a.decisions.map((d, i) => <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-green-500 font-bold">{i+1}.</span>{d}</li>)}</ul>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Form Modal */}
      <Dialog open={showModal} onOpenChange={(open) => {
        if (open) { setShowModal(true); return; }
        if (window.confirm('Bağlamaq istədiyinizdən əminsiniz? Saxlanılmamış dəyişikliklər itəcək.')) {
          setShowModal(false);
        }
      }}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>{editing ? 'İclası redaktə et' : 'Yeni İclas'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3" data-testid="assembly-form">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Aparıcı Şöbə *</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger className="text-sm" data-testid="assembly-dept-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">İclasın keçirildiyi tarix</Label>
                <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="text-sm" data-testid="assembly-deadline" />
              </div>
            </div>
            <div>
              <Label className="text-xs">İclasın məqsədi *</Label>
              <textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} required className="w-full min-h-[40px] p-2 text-sm border rounded-lg resize-none" placeholder="İclasın məqsədini yazın" data-testid="assembly-purpose" />
            </div>

            {/* Agendas with nested tasks */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold text-[#3D4F6F] flex items-center gap-1"><Target className="w-3.5 h-3.5" />Gündəmlər və Tapşırıqlar</Label>
                <button type="button" onClick={addAgenda} className="text-[10px] text-[#9ACD32] hover:underline font-medium" data-testid="add-agenda-btn">+ Gündəm əlavə et</button>
              </div>
              {form.agendas.map((agenda, aIdx) => (
                <div key={aIdx} className="mb-3 bg-white rounded-lg border border-slate-200 p-3" data-testid={`agenda-${aIdx}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-[#3D4F6F] bg-[#3D4F6F]/10 px-2 py-0.5 rounded">{aIdx + 1}</span>
                    <Input value={agenda.title} onChange={(e) => updateAgendaTitle(aIdx, e.target.value)} placeholder="Gündəm maddəsi" className="text-sm h-8 flex-1" data-testid={`agenda-title-${aIdx}`} />
                    {form.agendas.length > 1 && (
                      <button type="button" onClick={() => removeAgenda(aIdx)} className="p-1 hover:bg-red-100 rounded flex-shrink-0"><X className="w-3 h-3 text-red-500" /></button>
                    )}
                  </div>
                  <div className="ml-6 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">Tapşırıqlar</span>
                      <button type="button" onClick={() => addTask(aIdx)} className="text-[10px] text-[#9ACD32] hover:underline font-medium" data-testid={`add-task-${aIdx}`}>+ Tapşırıq</button>
                    </div>
                    {agenda.tasks.map((task, tIdx) => (
                      <TaskRow key={tIdx} task={task} prefix={`task-${aIdx}-${tIdx}`}
                        employeeNames={employeeNames}
                        onUpdate={(f, v) => updateTask(aIdx, tIdx, f, v)}
                        onRemove={() => removeTask(aIdx, tIdx)}
                        canRemove={agenda.tasks.length > 1} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* General Tasks */}
            <div className="border border-orange-200 rounded-lg p-3 bg-orange-50/30">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold text-[#3D4F6F] flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" />Ümumi Tapşırıqlar</Label>
                <button type="button" onClick={addGeneralTask} className="text-[10px] text-[#9ACD32] hover:underline font-medium" data-testid="add-general-task-btn">+ Tapşırıq əlavə et</button>
              </div>
              <div className="space-y-2">
                {form.general_tasks.map((task, idx) => (
                  <TaskRow key={idx} task={task} prefix={`general-task-${idx}`}
                    employeeNames={employeeNames}
                    onUpdate={(f, v) => updateGeneralTask(idx, f, v)}
                    onRemove={() => removeGeneralTask(idx)}
                    canRemove={form.general_tasks.length > 1} />
                ))}
              </div>
            </div>

            <ListField label="Müzakirə mövzuları" items={form.discussion_topics} placeholder="Müzakirə mövzusu"
              onAdd={() => addItem('discussion_topics')}
              onUpdate={(idx, v) => updateItem('discussion_topics', idx, v)}
              onRemove={(idx) => removeItem('discussion_topics', idx)}
              testId="discussion-topic" />
            <ListField label="Qəbul edilən qərarlar" items={form.decisions} placeholder="Qərar"
              onAdd={() => addItem('decisions')}
              onUpdate={(idx, v) => updateItem('decisions', idx, v)}
              onRemove={(idx) => removeItem('decisions', idx)}
              testId="decision" />
            <div>
              <Label className="text-xs">Növbəti iclas tarixi</Label>
              <Input type="date" value={form.next_assembly_date} onChange={(e) => setForm({ ...form, next_assembly_date: e.target.value })} className="text-sm" data-testid="assembly-next-date" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => {
                if (window.confirm('Bağlamaq istədiyinizdən əminsiniz? Saxlanılmamış dəyişikliklər itəcək.')) setShowModal(false);
              }}>Ləğv et</Button>
              <Button type="submit" className="bg-[#3D4F6F] hover:bg-[#2A364C] text-white" data-testid="assembly-submit-btn">{editing ? 'Yadda saxla' : 'Yarat'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
