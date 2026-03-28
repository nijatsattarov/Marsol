import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Plus, Search, Loader2, Phone, Mail, User, Building2, Filter,
  Pencil, Trash2, ChevronRight, DollarSign, X, GripVertical,
  Calendar, Target, ArrowRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STAGES = [
  { value: 'Yeni Lead', color: 'bg-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  { value: 'Əlaqə', color: 'bg-cyan-500', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  { value: 'Təklif', color: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  { value: 'Danışıq', color: 'bg-purple-500', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  { value: 'Uğurlu', color: 'bg-green-500', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  { value: 'Uğursuz', color: 'bg-red-500', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
];

const SOURCES = ['Veb sayt', 'Referans', 'Sosial media', 'Tədbir', 'Cold call', 'Email', 'Partnyor', 'Digər'];

const emptyForm = {
  company_name: '', contact_person: '', phone: '', email: '',
  source: '', stage: 'Yeni Lead', assigned_to: '', expected_amount: 0,
  package: '', project: '', notes: '', priority: 'Orta', next_action_date: ''
};

export default function Sales() {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({});
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [searchTerm, setSearchTerm] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [leadsRes, statsRes, optRes] = await Promise.all([
        axios.get(`${API}/sales/leads`, { headers }),
        axios.get(`${API}/sales/stats`, { headers }),
        axios.get(`${API}/options/all`, { headers }),
      ]);
      setLeads(leadsRes.data);
      setStats(statsRes.data);
      setOptions(optRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openModal = (lead = null) => {
    if (lead) { setEditing(lead); setForm({ ...lead }); }
    else { setEditing(null); setForm(emptyForm); }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await axios.put(`${API}/sales/leads/${editing.id}`, form, { headers });
        toast.success('Lead yeniləndi');
      } else {
        await axios.post(`${API}/sales/leads`, form, { headers });
        toast.success('Lead əlavə edildi');
      }
      setShowModal(false);
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu lead-i silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/sales/leads/${id}`, { headers });
      toast.success('Lead silindi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const moveStage = async (lead, newStage) => {
    try {
      await axios.put(`${API}/sales/leads/${lead.id}`, { stage: newStage }, { headers });
      toast.success(`${newStage} mərhələsinə keçirildi`);
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const filteredLeads = leads.filter(l => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return l.company_name?.toLowerCase().includes(t) || l.contact_person?.toLowerCase().includes(t);
  });

  const totalExpected = leads.reduce((s, l) => s + (l.expected_amount || 0), 0);
  const wonAmount = leads.filter(l => l.stage === 'Uğurlu').reduce((s, l) => s + (l.expected_amount || 0), 0);

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="sales-page">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Satış</h1>
          <p className="text-slate-500 text-sm mt-1">Lead və satış pipeline idarəetmə</p>
        </div>
        <Button onClick={() => openModal()} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="add-lead-btn">
          <Plus className="w-4 h-4 mr-1" />Yeni Lead
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100" data-testid="sales-total">
          <p className="text-xs text-slate-500">Cəmi leadlər</p>
          <p className="text-2xl font-bold text-[#3D4F6F]">{leads.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">Gözlənilən gəlir</p>
          <p className="text-2xl font-bold text-amber-600">{totalExpected.toLocaleString()} AZN</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">Uğurlu satışlar</p>
          <p className="text-2xl font-bold text-green-600">{stats['Uğurlu']?.count || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">Qazanılmış</p>
          <p className="text-2xl font-bold text-[#9ACD32]">{wonAmount.toLocaleString()} AZN</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Lead axtar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" data-testid="sales-search" />
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageLeads = filteredLeads.filter(l => l.stage === stage.value);
          const stageIdx = STAGES.findIndex(s => s.value === stage.value);
          const nextStage = stageIdx < STAGES.length - 2 ? STAGES[stageIdx + 1] : null;
          return (
            <div key={stage.value} className={`min-w-[280px] sm:min-w-[300px] flex-1 rounded-xl ${stage.bg} border ${stage.border} p-3`} data-testid={`stage-${stage.value}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                  <h3 className={`font-semibold text-sm ${stage.text}`}>{stage.value}</h3>
                </div>
                <Badge className={`${stage.text} ${stage.bg} text-xs`}>{stageLeads.length}</Badge>
              </div>
              <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                {stageLeads.map(lead => (
                  <div key={lead.id} className="bg-white rounded-lg p-3 shadow-sm border border-slate-100 hover:shadow-md transition-shadow" data-testid={`lead-card-${lead.id}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm text-[#3D4F6F]">{lead.company_name}</p>
                        <p className="text-xs text-slate-500">{lead.contact_person}</p>
                      </div>
                      <Badge className={`text-[10px] ${lead.priority === 'Yüksək' ? 'bg-red-100 text-red-700' : lead.priority === 'Aşağı' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>{lead.priority}</Badge>
                    </div>
                    {lead.expected_amount > 0 && (
                      <p className="text-xs font-medium text-green-600 mb-1">{lead.expected_amount.toLocaleString()} AZN</p>
                    )}
                    {lead.source && <p className="text-xs text-slate-400 mb-2">Mənbə: {lead.source}</p>}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openModal(lead)}><Pencil className="w-3 h-3 text-slate-500" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(lead.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                      </div>
                      {nextStage && stage.value !== 'Uğurlu' && stage.value !== 'Uğursuz' && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500 hover:text-[#3D4F6F]" onClick={() => moveStage(lead, nextStage.value)}>
                          <ArrowRight className="w-3 h-3 mr-1" />{nextStage.value}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {stageLeads.length === 0 && <p className="text-center text-xs text-slate-400 py-6">Lead yoxdur</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lead Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>{editing ? 'Lead redaktə et' : 'Yeni Lead'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="lead-form">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Şirkət adı *</Label>
                <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required className="text-sm" data-testid="lead-company-input" />
              </div>
              <div>
                <Label className="text-xs">Əlaqədar şəxs *</Label>
                <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} required className="text-sm" data-testid="lead-contact-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="text-sm" /></div>
              <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Mənbə *</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Mərhələ</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Məsul şəxs</Label>
                <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{options?.marsol_representatives?.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Prioritet</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yüksək">Yüksək</SelectItem>
                    <SelectItem value="Orta">Orta</SelectItem>
                    <SelectItem value="Aşağı">Aşağı</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Gözlənilən məbləğ (AZN)</Label><Input type="number" value={form.expected_amount} onChange={(e) => setForm({ ...form, expected_amount: parseFloat(e.target.value) || 0 })} className="text-sm" /></div>
              <div><Label className="text-xs">Növbəti əlaqə tarixi</Label><Input type="date" value={form.next_action_date} onChange={(e) => setForm({ ...form, next_action_date: e.target.value })} className="text-sm" /></div>
            </div>
            <div>
              <Label className="text-xs">Qeyd</Label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full min-h-[60px] p-2 text-sm border rounded-lg resize-none" placeholder="Əlavə qeydlər..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Ləğv et</Button>
              <Button type="submit" className="bg-[#3D4F6F] hover:bg-[#2A364C] text-white" data-testid="lead-submit-btn">{editing ? 'Yadda saxla' : 'Yarat'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
