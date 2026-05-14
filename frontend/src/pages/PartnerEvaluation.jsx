import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader2, Trophy, RefreshCw, Edit3, Search, ArrowUpDown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Toaster, toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TIER_COLORS = { Platinum: 'bg-purple-100 text-purple-700', Qızıl: 'bg-amber-100 text-amber-700', Gümüş: 'bg-slate-200 text-slate-700', Standart: 'bg-blue-50 text-blue-600' };

export default function PartnerEvaluation() {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [bonus, setBonus] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [sortBy, setSortBy] = useState('total');     // 'name' | 'tier' | 'payment' | 'event' | 'other_projects' | 'meetings' | 'manual' | 'total'
  const [sortDir, setSortDir] = useState('desc');    // 'asc' | 'desc'

  // Compute the displayed list — filter then sort.
  const displayed = (() => {
    const term = search.trim().toLowerCase();
    let list = items.filter(i => {
      if (tierFilter !== 'all' && i.tier !== tierFilter) return false;
      if (!term) return true;
      return (i.brand_name || '').toLowerCase().includes(term)
          || (i.display_id || '').toLowerCase().includes(term);
    });
    const get = (it) => {
      switch (sortBy) {
        case 'name': return (it.brand_name || '').toLowerCase();
        case 'tier': return ({ Platinum: 4, 'Qızıl': 3, 'Gümüş': 2, Standart: 1 }[it.tier] || 0);
        case 'payment': return it.scores?.payment || 0;
        case 'event': return it.scores?.event || 0;
        case 'other_projects': return it.scores?.other_projects || 0;
        case 'meetings': return it.scores?.meetings || 0;
        case 'manual': return it.scores?.manual || 0;
        default: return it.total || 0;
      }
    };
    list = [...list].sort((a, b) => {
      const av = get(a); const bv = get(b);
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return list;
  })();

  const fetch = useCallback(async () => {
    setLoading(true);
    try { const r = await axios.get(`${API}/partner-evaluation`, { headers }); setItems(r.data.items || []); }
    catch { toast.error('Xəta'); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { fetch(); }, [fetch]);

  const openEdit = (item) => { setEditing(item); setBonus(item.scores.manual || 0); setNote(''); };
  const saveBonus = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/partner-evaluation/${editing.company_id}/manual-bonus`, { manual_bonus: Number(bonus), note }, { headers });
      toast.success('Yadda saxlandı'); setEditing(null); fetch();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Xəta'); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="partner-eval-page">
      <Toaster position="top-right" richColors />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#3D4F6F] flex items-center gap-2"><Trophy className="w-6 h-6 text-amber-500" />Partnyor Dəyərləndirmə</h1>
          <p className="text-sm text-slate-500 mt-1">100-ballıq sistem: ödəniş 40 + tədbir 30 + digər layihə 15 + görüş 10 + əlavə bal 5</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading}><RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Yenilə</Button>
      </div>

      {/* Search + filter bar */}
      <div className="bg-white rounded-xl border border-slate-100 p-3 mb-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Şirkət adı və ya ID üzrə axtarış..."
            className="pl-8 h-9 text-sm"
            data-testid="eval-search-input"
          />
        </div>
        <div className="w-36">
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="h-9 text-xs" data-testid="eval-tier-filter"><SelectValue placeholder="Səviyyə" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün səviyyələr</SelectItem>
              <SelectItem value="Platinum">Platinum</SelectItem>
              <SelectItem value="Qızıl">Qızıl</SelectItem>
              <SelectItem value="Gümüş">Gümüş</SelectItem>
              <SelectItem value="Standart">Standart</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9 text-xs" data-testid="eval-sort-by"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Ad (A-Z)</SelectItem>
              <SelectItem value="tier">Səviyyə</SelectItem>
              <SelectItem value="payment">Ödəniş balı</SelectItem>
              <SelectItem value="event">Tədbir balı</SelectItem>
              <SelectItem value="other_projects">Layihə balı</SelectItem>
              <SelectItem value="meetings">Görüş balı</SelectItem>
              <SelectItem value="manual">Əlavə bal</SelectItem>
              <SelectItem value="total">Cəm bal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          className="h-9 text-xs"
          data-testid="eval-sort-dir"
          title={sortDir === 'asc' ? 'Azdan çoxa' : 'Çoxdan aza'}
        >
          <ArrowUpDown className="w-3.5 h-3.5 mr-1" />{sortDir === 'asc' ? 'Azdan çoxa' : 'Çoxdan aza'}
        </Button>
        <span className="text-[11px] text-slate-500 ml-auto">{displayed.length} / {items.length}</span>
      </div>

      {loading ? <Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F] mx-auto mt-12" /> : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-center px-3 py-2 text-xs font-semibold text-[#3D4F6F]">ID</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Şirkət</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Ödəniş /40</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Tədbir /30</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Layihə /15</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Görüş /10</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Əlavə /5</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Cəm</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Səviyyə</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-[#3D4F6F]"></th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400 text-sm">{items.length === 0 ? 'Aktiv üzv şirkət yoxdur' : 'Filtrə uyğun nəticə yoxdur'}</td></tr>
              ) : displayed.map((it) => (
                <tr key={it.company_id} className="border-b border-slate-50 hover:bg-slate-50/40" data-testid={`eval-row-${it.company_id}`}>
                  <td className="text-center font-mono text-xs text-slate-500" data-testid={`eval-id-${it.company_id}`}>{it.display_id || '-'}</td>
                  <td className="px-3 py-2 font-medium text-[#3D4F6F]">{it.brand_name}</td>
                  <td className="text-center text-xs">{it.scores.payment}</td>
                  <td className="text-center text-xs">{it.scores.event}</td>
                  <td className="text-center text-xs">{it.scores.other_projects}</td>
                  <td className="text-center text-xs">{it.scores.meetings}</td>
                  <td className="text-center text-xs">{it.scores.manual}</td>
                  <td className="text-center font-bold text-[#3D4F6F]">{it.total}</td>
                  <td className="text-center"><Badge className={`text-[10px] ${TIER_COLORS[it.tier]}`}>{it.tier}</Badge></td>
                  <td className="text-right pr-3">
                    <button onClick={() => openEdit(it)} className="p-1 hover:bg-slate-100 rounded" title="Əlavə bal" data-testid={`edit-bonus-${it.company_id}`}>
                      <Edit3 className="w-4 h-4 text-slate-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Əlavə bal təyin et</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">{editing.brand_name}</p>
              <div>
                <Label className="text-xs">Əlavə bal (0-5)</Label>
                <Input type="number" min={0} max={5} value={bonus} onChange={(e) => setBonus(e.target.value)} className="text-sm" data-testid="bonus-input" />
              </div>
              <div>
                <Label className="text-xs">Qeyd</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} className="text-sm" placeholder="Niyə əlavə bal verilir..." />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => setEditing(null)}>Ləğv et</Button>
                <Button onClick={saveBonus} disabled={saving} className="bg-[#9ACD32] text-[#3D4F6F]" data-testid="save-bonus-btn">
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}Yadda saxla
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
