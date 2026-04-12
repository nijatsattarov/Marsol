import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Plus, Search, Loader2, Pencil, Trash2, X, Download,
  Eye, Calendar, Users2, Target, ListChecks, ClipboardCheck
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';
import * as XLSX from 'xlsx';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const emptyAgenda = () => ({ title: '', tasks: [{ title: '', responsible_person: '' }] });

const emptyForm = {
  department: '', purpose: '',
  agendas: [emptyAgenda()],
  discussion_topics: [''],
  deadline: '', next_assembly_date: '',
  decisions: ['']
};

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

  const openModal = (assembly = null) => {
    if (assembly) {
      setEditing(assembly);
      const agendas = (assembly.agendas || []).map(a => ({
        title: a.title || '',
        tasks: (a.tasks || []).length ? a.tasks.map(t => ({ title: t.title || '', responsible_person: t.responsible_person || '' })) : [{ title: '', responsible_person: '' }]
      }));
      setForm({
        department: assembly.department || '',
        purpose: assembly.purpose || '',
        agendas: agendas.length ? agendas : [emptyAgenda()],
        discussion_topics: (assembly.discussion_topics || []).length ? assembly.discussion_topics : [''],
        deadline: assembly.deadline || '',
        next_assembly_date: assembly.next_assembly_date || '',
        decisions: (assembly.decisions || []).length ? assembly.decisions : [''],
      });
    } else {
      setEditing(null);
      setForm({ ...emptyForm, agendas: [emptyAgenda()], discussion_topics: [''], decisions: [''] });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      agendas: form.agendas.filter(a => a.title.trim()).map(a => ({
        title: a.title.trim(),
        tasks: a.tasks.filter(t => t.title.trim()).map(t => ({ title: t.title.trim(), responsible_person: t.responsible_person }))
      })),
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
  const addTask = (agendaIdx) => setForm(p => {
    const a = [...p.agendas];
    a[agendaIdx] = { ...a[agendaIdx], tasks: [...a[agendaIdx].tasks, { title: '', responsible_person: '' }] };
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
      const persons = (a.agendas || []).flatMap(ag => (ag.tasks || []).map(tk => tk.responsible_person || '')).join(' ').toLowerCase();
      if (!a.assembly_code?.toLowerCase().includes(t) && !a.purpose?.toLowerCase().includes(t) &&
          !a.department?.toLowerCase().includes(t) && !persons.includes(t)) return false;
    }
    return true;
  });

  const departments = options.departments || [];
  const employeeNames = [...new Set(employees.map(e => `${e.first_name || ''} ${e.last_name || ''}`.trim()).filter(Boolean))];

  // Count helpers
  const getTotalTasks = (a) => (a.agendas || []).reduce((sum, ag) => sum + (ag.tasks || []).length, 0);
  const getResponsibles = (a) => [...new Set((a.agendas || []).flatMap(ag => (ag.tasks || []).map(t => t.responsible_person)).filter(Boolean))];

  const exportToExcel = () => {
    if (filtered.length === 0) return toast.error('Export ucun melumat yoxdur');
    const wb = XLSX.utils.book_new();
    const rows = [];
    filtered.forEach(a => {
      (a.agendas || []).forEach(ag => {
        (ag.tasks || []).forEach(t => {
          rows.push({
            'Iclas ID': a.assembly_code,
            'Aparici Sobe': a.department,
            'Meqsed': a.purpose,
            'Gundem': ag.title,
            'Tapshiriq': t.title,
            'Mesul Shexs': t.responsible_person,
            'Son tarix': a.deadline,
            'Novbeti iclas': a.next_assembly_date,
          });
        });
        if (!(ag.tasks || []).length) {
          rows.push({
            'Iclas ID': a.assembly_code, 'Aparici Sobe': a.department,
            'Meqsed': a.purpose, 'Gundem': ag.title,
            'Tapshiriq': '', 'Mesul Shexs': '',
            'Son tarix': a.deadline, 'Novbeti iclas': a.next_assembly_date,
          });
        }
      });
    });
    // Add decisions as second sheet
    const decRows = filtered.flatMap(a => (a.decisions || []).map(d => ({ 'Iclas ID': a.assembly_code, 'Qerar': d })));
    const ws1 = XLSX.utils.json_to_sheet(rows);
    ws1['!cols'] = [{ wch: 10 }, { wch: 16 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Iclaslar');
    if (decRows.length) {
      const ws2 = XLSX.utils.json_to_sheet(decRows);
      ws2['!cols'] = [{ wch: 10 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Qerarlar');
    }
    XLSX.writeFile(wb, `iclaslar_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel fayli yuklendi');
  };

  const ListField = ({ label, field, placeholder }) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs">{label}</Label>
        <button type="button" onClick={() => addItem(field)} className="text-[10px] text-[#9ACD32] hover:underline font-medium">+ Əlavə et</button>
      </div>
      {form[field].map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5 mb-1.5">
          <Input value={item} onChange={(e) => updateItem(field, idx, e.target.value)} placeholder={placeholder} className="text-sm h-8" />
          {form[field].length > 1 && (
            <button type="button" onClick={() => removeItem(field, idx)} className="p-1 hover:bg-red-100 rounded flex-shrink-0">
              <X className="w-3 h-3 text-red-500" />
            </button>
          )}
        </div>
      ))}
    </div>
  );

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="assembly-page">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>İclaslar</h1>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} iclas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} variant="outline" className="text-[#3D4F6F] border-[#3D4F6F]/20 hover:bg-[#3D4F6F]/5" data-testid="export-excel-btn">
            <Download className="w-4 h-4 mr-1" />Excel
          </Button>
          <Button onClick={() => openModal()} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="add-assembly-btn">
            <Plus className="w-4 h-4 mr-1" />Yeni İclas
          </Button>
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
          <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-[140px] text-sm h-9" data-testid="filter-date-from" placeholder="Tarixdən" />
          <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-[140px] text-sm h-9" data-testid="filter-date-to" placeholder="Tarixə" />
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
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Məsul Şəxslər</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Son tarix</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Növbəti iclas</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Detallar</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">İclas tapılmadı</td></tr>
              ) : (
                filtered.map((a) => {
                  const responsibles = getResponsibles(a);
                  return (
                    <tr key={a.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${expandedRow === a.id ? 'bg-slate-50/70' : ''}`} data-testid={`assembly-row-${a.id}`}>
                      <td className="px-3 py-2.5">
                        <Badge className="bg-[#3D4F6F] text-white text-xs font-mono">{a.assembly_code}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-slate-600">{a.department || '-'}</td>
                      <td className="px-3 py-2.5 text-sm text-[#3D4F6F] font-medium max-w-[200px] truncate">{a.purpose || '-'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {responsibles.slice(0, 2).map((p, i) => (
                            <Badge key={i} className="bg-slate-100 text-slate-600 text-[10px]">{p}</Badge>
                          ))}
                          {responsibles.length > 2 && <Badge className="bg-slate-100 text-slate-400 text-[10px]">+{responsibles.length - 2}</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{a.deadline || '-'}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{a.next_assembly_date || '-'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => setExpandedRow(expandedRow === a.id ? null : a.id)}
                          className={`p-1.5 rounded-lg transition-colors ${expandedRow === a.id ? 'bg-[#3D4F6F] text-white' : 'hover:bg-slate-100 text-slate-400'}`}
                          data-testid={`view-detail-${a.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openModal(a)} className="p-1.5 hover:bg-slate-100 rounded-lg" data-testid={`edit-assembly-${a.id}`}>
                            <Pencil className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                          <button onClick={() => handleDelete(a.id)} className="p-1.5 hover:bg-red-50 rounded-lg" data-testid={`delete-assembly-${a.id}`}>
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Expanded Detail */}
        {expandedRow && (() => {
          const a = assemblies.find(x => x.id === expandedRow);
          if (!a) return null;
          return (
            <div className="border-t bg-slate-50/50 p-4 space-y-4" data-testid="assembly-detail">
              {/* Agendas with nested tasks */}
              {(a.agendas || []).length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Gündəmlər / Tapşırıqlar / Məsul Şəxslər</p>
                  <div className="space-y-3">
                    {a.agendas.map((ag, i) => (
                      <div key={i} className="bg-white rounded-lg border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-[#3D4F6F] flex items-center gap-2">
                          <Target className="w-3.5 h-3.5 text-blue-500" />
                          {ag.title}
                        </p>
                        {(ag.tasks || []).length > 0 && (
                          <div className="mt-2 ml-5 space-y-1.5">
                            {ag.tasks.map((t, j) => (
                              <div key={j} className="flex items-center gap-2 text-xs">
                                <ListChecks className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                <span className="text-slate-700">{t.title}</span>
                                {t.responsible_person && (
                                  <Badge className="bg-purple-50 text-purple-600 text-[10px] ml-auto">
                                    <Users2 className="w-2.5 h-2.5 mr-0.5 inline" />{t.responsible_person}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(a.discussion_topics || []).length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Müzakirə mövzuları</p>
                    <ul className="space-y-0.5">
                      {a.discussion_topics.map((m, i) => <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-purple-500 font-bold">{i+1}.</span>{m}</li>)}
                    </ul>
                  </div>
                )}
                {(a.decisions || []).length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Qəbul edilən qərarlar</p>
                    <ul className="space-y-0.5">
                      {a.decisions.map((d, i) => <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-green-500 font-bold">{i+1}.</span>{d}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Form Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>{editing ? 'İclası redaktə et' : 'Yeni İclas'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3" data-testid="assembly-form">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Aparıcı Şöbə *</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger className="text-sm" data-testid="assembly-dept-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Son tarix</Label>
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
                  {/* Tasks under this agenda */}
                  <div className="ml-6 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">Tapşırıqlar</span>
                      <button type="button" onClick={() => addTask(aIdx)} className="text-[10px] text-[#9ACD32] hover:underline font-medium" data-testid={`add-task-${aIdx}`}>+ Tapşırıq</button>
                    </div>
                    {agenda.tasks.map((task, tIdx) => (
                      <div key={tIdx} className="flex items-center gap-1.5" data-testid={`task-${aIdx}-${tIdx}`}>
                        <Input value={task.title} onChange={(e) => updateTask(aIdx, tIdx, 'title', e.target.value)} placeholder="Tapşırıq" className="text-sm h-7 flex-1" />
                        <Select value={task.responsible_person} onValueChange={(v) => updateTask(aIdx, tIdx, 'responsible_person', v)}>
                          <SelectTrigger className="text-sm h-7 w-[160px]" data-testid={`responsible-${aIdx}-${tIdx}`}><SelectValue placeholder="Məsul şəxs" /></SelectTrigger>
                          <SelectContent>
                            {employeeNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {agenda.tasks.length > 1 && (
                          <button type="button" onClick={() => removeTask(aIdx, tIdx)} className="p-1 hover:bg-red-100 rounded flex-shrink-0"><X className="w-3 h-3 text-red-500" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <ListField label="Müzakirə mövzuları" field="discussion_topics" placeholder="Müzakirə mövzusu" />
            <ListField label="Qəbul edilən qərarlar" field="decisions" placeholder="Qərar" />
            <div>
              <Label className="text-xs">Növbəti iclas tarixi</Label>
              <Input type="date" value={form.next_assembly_date} onChange={(e) => setForm({ ...form, next_assembly_date: e.target.value })} className="text-sm" data-testid="assembly-next-date" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Ləğv et</Button>
              <Button type="submit" className="bg-[#3D4F6F] hover:bg-[#2A364C] text-white" data-testid="assembly-submit-btn">{editing ? 'Yadda saxla' : 'Yarat'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
