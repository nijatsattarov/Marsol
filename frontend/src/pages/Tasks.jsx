import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Plus, Loader2, Calendar, Clock, User, CheckCircle2, Circle,
  MoreVertical, Pencil, Trash2, AlertCircle, Flag, Filter, Link2
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
  const [employees, setEmployees] = useState([]);
  const [options, setOptions] = useState({ departments: [], projects: [] });
  const [assemblies, setAssemblies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filters, setFilters] = useState({ status: 'all', priority: 'all' });
  const [showFilters, setShowFilters] = useState(false);

  const initialFormData = {
    task_name: '', department: '', assignee: '', responsible_person: '',
    priority: 'Orta', start_date: new Date().toISOString().split('T')[0],
    end_date: '', related_object_type: '', related_object_id: '', related_object: '',
    phase: '', status: 'Gözləyir', notes: ''
  };

  const [formData, setFormData] = useState(initialFormData);

  const token = localStorage.getItem('token');
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'tasks');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.priority !== 'all') params.append('priority', filters.priority);
      const [tRes, eRes, oRes, aRes] = await Promise.all([
        axios.get(`${API}/tasks?${params.toString()}`, { headers }),
        axios.get(`${API}/employees`, { headers }),
        axios.get(`${API}/options/all`, { headers }),
        axios.get(`${API}/assemblies`, { headers }),
      ]);
      setTasks(tRes.data);
      setEmployees(eRes.data);
      setOptions(oRes.data);
      setAssemblies(aRes.data);
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const employeeNames = [...new Set(employees.map(e => `${e.first_name || ''} ${e.last_name || ''}`.trim()).filter(Boolean))];
  const departments = options.departments || [];
  const projects = options.projects || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTask) {
        await axios.put(`${API}/tasks/${editingTask.id}`, formData, { headers });
        toast.success('Tapşırıq yeniləndi');
      } else {
        await axios.post(`${API}/tasks`, formData, { headers });
        toast.success('Tapşırıq əlavə edildi');
      }
      setShowModal(false);
      setEditingTask(null);
      setFormData(initialFormData);
      fetchData();
    } catch (error) { toast.error('Xəta baş verdi'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu tapşırığı silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/tasks/${id}`, { headers });
      toast.success('Tapşırıq silindi');
      fetchData();
    } catch (error) { toast.error('Silinmə zamanı xəta'); }
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setFormData({ ...initialFormData, ...task });
    setShowModal(true);
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await axios.put(`${API}/tasks/${taskId}`, { status: newStatus }, { headers });
      toast.success('Status yeniləndi');
      fetchData();
    } catch (error) { toast.error('Xəta baş verdi'); }
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

  const tasksByStatus = statuses.reduce((acc, status) => {
    acc[status] = tasks.filter(t => t.status === status);
    return acc;
  }, {});

  const activeFilterCount = Object.values(filters).filter(v => v !== 'all').length;

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="tasks-page">
      <Toaster position="top-right" richColors />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Tapşırıqlar</h1>
          <p className="text-slate-500 text-sm mt-1">Cəmi {tasks.length} tapşırıq</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}
            className={activeFilterCount > 0 ? 'border-[#9ACD32] bg-[#9ACD32]/10' : ''} data-testid="filter-btn">
            <Filter className="w-4 h-4 mr-1" />Filtr
            {activeFilterCount > 0 && <Badge className="ml-1 bg-[#9ACD32] text-[#3D4F6F] text-xs">{activeFilterCount}</Badge>}
          </Button>
          {_canEdit && <Button onClick={() => { setFormData(initialFormData); setEditingTask(null); setShowModal(true); }}
            className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold text-xs sm:text-sm" data-testid="add-task-btn">
            <Plus className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Tapşırıq əlavə et</span>
          </Button>}
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-slate-100 flex flex-wrap gap-3">
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
        </div>
      )}

      {/* Kanban Board */}
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
              ) : tasksByStatus[status].map(task => (
                <div key={task.id} className="bg-white rounded-lg p-3 shadow-sm border border-slate-100" data-testid={`task-card-${task.id}`}>
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      {task.task_code && <span className="text-[10px] text-slate-400 font-mono">{task.task_code}</span>}
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
                        <DropdownMenuItem onClick={() => handleDelete(task.id)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" />Sil</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>}
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Flag className={`w-3.5 h-3.5 ${getPriorityColor(task.priority)}`} />
                    <span className={`text-xs ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span className="truncate max-w-[100px]">{task.assignee || '-'}</span>
                    </div>
                    {task.end_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{task.end_date}</span>
                      </div>
                    )}
                  </div>
                  {task.responsible_person && (
                    <p className="text-[10px] text-slate-400">Məsul: {task.responsible_person}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {task.department && <Badge className="text-[10px] bg-slate-100 text-slate-600">{task.department}</Badge>}
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
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

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
                <Label className="text-xs">Şöbə</Label>
                <Select value={formData.department} onValueChange={(v) => setFormData({...formData, department: v})}>
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
                <Label className="text-xs">İcraçı əməkdaş *</Label>
                <Select value={formData.assignee} onValueChange={(v) => setFormData({...formData, assignee: v})}>
                  <SelectTrigger className="text-sm" data-testid="task-assignee-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{employeeNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Məsul şəxs *</Label>
                <Select value={formData.responsible_person} onValueChange={(v) => setFormData({...formData, responsible_person: v})}>
                  <SelectTrigger className="text-sm" data-testid="task-responsible-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{employeeNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Başlama tarixi</Label>
                <Input type="date" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} className="text-sm" data-testid="task-start-date" />
              </div>
              <div>
                <Label className="text-xs">Bitmə tarixi</Label>
                <Input type="date" value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} className="text-sm" data-testid="task-end-date" />
              </div>
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
              <Button type="submit" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold" data-testid="task-submit-btn">
                {editingTask ? 'Yadda saxla' : 'Əlavə et'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
