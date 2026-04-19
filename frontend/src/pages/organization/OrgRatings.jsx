import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Loader2, Star, Download, Trash2, ThumbsUp, ThumbsDown, AlertTriangle, Filter, TrendingUp } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Toaster, toast } from 'sonner';
import { usePermissions, canEdit } from '../../context/PermissionContext';
import { ORG_CONFIGS } from './configs';
import * as XLSX from 'xlsx';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const REHIRE_OPTIONS = ['Bəli', 'Xeyr', 'Şərtlə'];

const RECOMMEND_COLORS = {
  'Tövsiyə edilir': 'bg-green-100 text-green-700 border-green-200',
  'Şərtlə tövsiyə': 'bg-amber-100 text-amber-700 border-amber-200',
  'Tövsiyə edilmir': 'bg-red-100 text-red-700 border-red-200',
};

const RECOMMEND_ICONS = {
  'Tövsiyə edilir': ThumbsUp,
  'Şərtlə tövsiyə': AlertTriangle,
  'Tövsiyə edilmir': ThumbsDown,
};

const SCORE_FIELDS = [
  { key: 'price_score', label: 'Qiymət uyğunluğu' },
  { key: 'quality_score', label: 'Xidmət keyfiyyəti' },
  { key: 'operativity_score', label: 'Vaxtında icra' },
  { key: 'behavior_score', label: 'Ünsiyyət / davranış' },
  { key: 'flexibility_score', label: 'Elastiklik' },
  { key: 'event_fit_score', label: 'Tədbirə uyğunluq' },
];

function StarRating({ value, onChange, readOnly = false }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          type="button"
          key={n}
          onClick={() => !readOnly && onChange(n)}
          className={`${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
          disabled={readOnly}
        >
          <Star className={`w-5 h-5 ${value >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
        </button>
      ))}
    </div>
  );
}

export default function OrgRatings() {
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'organization');
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [tab, setTab] = useState('summary');
  const [summary, setSummary] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState({});  // { module: [items] }

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ vendor_type: '', vendor_id: '', event_name: '', event_date: '', price_score: 5, quality_score: 5, operativity_score: 5, behavior_score: 5, flexibility_score: 5, event_fit_score: 5, rehire_willingness: 'Bəli', comment: '' });

  const [filterType, setFilterType] = useState('all');
  const [filterRecommend, setFilterRecommend] = useState('all');

  const loadAll = useCallback(async () => {
    try {
      const [sum, hist] = await Promise.all([
        axios.get(`${API}/organization/ratings/summary`, { headers }),
        axios.get(`${API}/organization/ratings/list`, { headers }),
      ]);
      setSummary(sum.data); setHistory(hist.data);
      // Load all vendors for the modal dropdown
      const vmap = {};
      await Promise.all(Object.keys(ORG_CONFIGS).map(async mod => {
        const r = await axios.get(`${API}/organization/${mod}`, { headers });
        vmap[mod] = r.data;
      }));
      setVendors(vmap);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/organization/ratings`, form, { headers });
      toast.success('Reytinq əlavə edildi');
      setShowModal(false); loadAll();
    } catch (err) { toast.error(err.response?.data?.detail || 'Xəta'); }
  };

  const deleteRating = async (id) => {
    if (!window.confirm('Silinsin?')) return;
    try { await axios.delete(`${API}/organization/ratings/${id}`, { headers }); toast.success('Silindi'); loadAll(); }
    catch { toast.error('Xəta'); }
  };

  const filteredSummary = summary.filter(s => {
    if (filterType !== 'all' && s.vendor_type !== filterType) return false;
    if (filterRecommend !== 'all' && s.recommendation !== filterRecommend) return false;
    return true;
  });

  const filteredHistory = history.filter(h => {
    if (filterType !== 'all' && h.vendor_type !== filterType) return false;
    return true;
  });

  const exportSummary = () => {
    const data = filteredSummary.map(s => ({
      'Təchizatçı': s.vendor_name,
      'Kateqoriya': ORG_CONFIGS[s.vendor_type]?.title || s.vendor_type,
      'Qiymət balı / 5': s.avg_price,
      'Keyfiyyət balı / 5': s.avg_quality,
      'Operativlik balı / 5': s.avg_operativity,
      'Davranış balı / 5': s.avg_behavior,
      'Elastiklik / 5': s.avg_flexibility,
      'Uyğunluq / 5': s.avg_fit,
      'Ümumi bal / 5': s.overall,
      'Təkrar işləmə %': s.rehire_rate,
      'Qiymətləndirmə sayı': s.count,
      'Son istifadə': s.last_event_date,
      'Tövsiyə statusu': s.recommendation,
    }));
    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Reytinqlər');
    XLSX.writeFile(wb, `reytinqler_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F]" /></div>;

  // Stats for top cards
  const totalVendors = summary.length;
  const recommended = summary.filter(s => s.recommendation === 'Tövsiyə edilir').length;
  const notRecommended = summary.filter(s => s.recommendation === 'Tövsiyə edilmir').length;
  const overallAvg = summary.length ? (summary.reduce((a, b) => a + (b.overall || 0), 0) / summary.length).toFixed(2) : '—';

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="org-ratings-page">
      <Toaster position="top-right" richColors />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#3D4F6F]">Reytinq və Qiymətləndirmə</h1>
          <p className="text-slate-500 text-sm mt-1">Təchizatçıların tarixçə-əsaslı qiymətləndirilməsi</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportSummary} variant="outline" className="text-[#3D4F6F]"><Download className="w-4 h-4 mr-1" />Excel</Button>
          {_canEdit && <Button onClick={() => setShowModal(true)} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="add-rating-btn"><Plus className="w-4 h-4 mr-1" />Reytinq əlavə et</Button>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border p-3">
          <p className="text-[10px] text-slate-500">Qiymətləndirilmiş təchizatçı</p>
          <p className="text-2xl font-bold text-[#3D4F6F]">{totalVendors}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-3">
          <p className="text-[10px] text-green-600 flex items-center gap-1"><ThumbsUp className="w-3 h-3" />Tövsiyə edilir</p>
          <p className="text-2xl font-bold text-green-700">{recommended}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-100 p-3">
          <p className="text-[10px] text-red-600 flex items-center gap-1"><ThumbsDown className="w-3 h-3" />Tövsiyə edilmir</p>
          <p className="text-2xl font-bold text-red-700">{notRecommended}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-3">
          <p className="text-[10px] text-amber-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Ümumi orta</p>
          <p className="text-2xl font-bold text-amber-700">{overallAvg}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-3 mb-4 flex flex-wrap gap-3">
        <Filter className="w-4 h-4 text-slate-400 self-center" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px] text-sm h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Bütün kateqoriyalar</SelectItem>
            {Object.entries(ORG_CONFIGS).map(([k, v]) => <SelectItem key={k} value={k}>{v.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterRecommend} onValueChange={setFilterRecommend}>
          <SelectTrigger className="w-[180px] text-sm h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Bütün tövsiyələr</SelectItem>
            <SelectItem value="Tövsiyə edilir">Tövsiyə edilir</SelectItem>
            <SelectItem value="Şərtlə tövsiyə">Şərtlə tövsiyə</SelectItem>
            <SelectItem value="Tövsiyə edilmir">Tövsiyə edilmir</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 bg-white border">
          <TabsTrigger value="summary" data-testid="tab-summary">Ümumi Hesabat</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Qiymətləndirmə Tarixçəsi</TabsTrigger>
        </TabsList>

        {/* SUMMARY TAB */}
        <TabsContent value="summary">
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Təchizatçı</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Kateqoriya</th>
                    <th className="text-center px-2 py-3 text-xs font-semibold text-[#3D4F6F]">Qiymət</th>
                    <th className="text-center px-2 py-3 text-xs font-semibold text-[#3D4F6F]">Keyfiyyət</th>
                    <th className="text-center px-2 py-3 text-xs font-semibold text-[#3D4F6F]">Operativlik</th>
                    <th className="text-center px-2 py-3 text-xs font-semibold text-[#3D4F6F]">Davranış</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Ümumi</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Təkrar %</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Son</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Tövsiyə</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummary.length === 0 ? <tr><td colSpan={10} className="text-center py-12 text-slate-400 text-sm">Qiymətləndirmə qeydi yoxdur</td></tr> :
                    filteredSummary.map((s, i) => {
                      const RecIcon = RECOMMEND_ICONS[s.recommendation] || ThumbsUp;
                      return (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50" data-testid={`summary-${s.vendor_id}`}>
                          <td className="px-3 py-2.5 text-sm font-medium text-[#3D4F6F]">{s.vendor_name}<p className="text-[10px] text-slate-400">{s.count} qiymətləndirmə</p></td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">{ORG_CONFIGS[s.vendor_type]?.title || s.vendor_type}</td>
                          <td className="text-center px-2 py-2.5 text-xs font-medium">{s.avg_price}</td>
                          <td className="text-center px-2 py-2.5 text-xs font-medium">{s.avg_quality}</td>
                          <td className="text-center px-2 py-2.5 text-xs font-medium">{s.avg_operativity}</td>
                          <td className="text-center px-2 py-2.5 text-xs font-medium">{s.avg_behavior}</td>
                          <td className="text-center px-3 py-2.5">
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 rounded-full">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span className="text-xs font-bold text-amber-700">{s.overall}</span>
                            </div>
                          </td>
                          <td className="text-center px-3 py-2.5 text-xs">{s.rehire_rate}%</td>
                          <td className="text-center px-3 py-2.5 text-[10px] text-slate-400">{s.last_event_date || '—'}</td>
                          <td className="px-3 py-2.5">
                            <Badge className={`${RECOMMEND_COLORS[s.recommendation]} border flex items-center gap-1 text-[10px] w-fit`}>
                              <RecIcon className="w-3 h-3" />{s.recommendation}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history">
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Təchizatçı</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Kateqoriya</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Tədbir</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Tarix</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Ümumi</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Təkrar?</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Rəy</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">Qeyd yoxdur</td></tr> :
                    filteredHistory.map(h => {
                      const overall = ((h.price_score + h.quality_score + h.operativity_score + h.behavior_score) / 4).toFixed(2);
                      return (
                        <tr key={h.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 text-sm font-medium text-[#3D4F6F]">{h.vendor_name}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">{ORG_CONFIGS[h.vendor_type]?.title}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">{h.event_name || '—'}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">{h.event_date}</td>
                          <td className="text-center px-3 py-2.5">
                            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{overall}</span>
                          </td>
                          <td className="px-3 py-2.5 text-xs"><Badge className={h.rehire_willingness === 'Bəli' ? 'bg-green-50 text-green-700' : h.rehire_willingness === 'Xeyr' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}>{h.rehire_willingness}</Badge></td>
                          <td className="px-3 py-2.5 text-xs text-slate-500 max-w-[200px] truncate">{h.comment || '—'}</td>
                          <td className="px-3 py-2.5 text-right">
                            {_canEdit && <button onClick={() => deleteRating(h.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>}
                          </td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add rating modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-[#3D4F6F]">Yeni Qiymətləndirmə</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Təchizatçı növü *</Label>
                <Select value={form.vendor_type} onValueChange={v => setForm({ ...form, vendor_type: v, vendor_id: '' })}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>{Object.entries(ORG_CONFIGS).map(([k, v]) => <SelectItem key={k} value={k}>{v.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Təchizatçı *</Label>
                <Select value={form.vendor_id} onValueChange={v => setForm({ ...form, vendor_id: v })} disabled={!form.vendor_type}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    {(vendors[form.vendor_type] || []).map(v => <SelectItem key={v.id} value={v.id}>{v.name || v.vendor_name || v.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Tədbir adı</Label><Input value={form.event_name} onChange={e => setForm({ ...form, event_name: e.target.value })} className="text-sm" /></div>
              <div><Label className="text-xs">Tədbir tarixi</Label><Input type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} className="text-sm" /></div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 border space-y-2">
              {SCORE_FIELDS.map(sf => (
                <div key={sf.key} className="flex items-center justify-between">
                  <Label className="text-xs text-slate-700">{sf.label}</Label>
                  <StarRating value={form[sf.key]} onChange={v => setForm({ ...form, [sf.key]: v })} />
                </div>
              ))}
            </div>

            <div>
              <Label className="text-xs">Təkrar işləmək istəyi</Label>
              <div className="flex gap-2 mt-1">
                {REHIRE_OPTIONS.map(o => (
                  <button type="button" key={o} onClick={() => setForm({ ...form, rehire_willingness: o })} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border ${form.rehire_willingness === o ? 'bg-[#3D4F6F] text-white border-[#3D4F6F]' : 'bg-white text-slate-600 border-slate-200'}`}>{o}</button>
                ))}
              </div>
            </div>

            <div><Label className="text-xs">Rəy / Qeyd</Label><textarea value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} className="w-full min-h-[50px] p-2 text-sm border rounded-lg resize-none" /></div>

            <div className="flex justify-end gap-2 pt-2 border-t sticky bottom-0 bg-white">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Ləğv et</Button>
              <Button type="submit" className="bg-[#3D4F6F] text-white" data-testid="submit-rating-btn" disabled={!form.vendor_type || !form.vendor_id}>Saxla</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
