import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader2, Trophy, RefreshCw, Edit3 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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

      {loading ? <Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F] mx-auto mt-12" /> : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-center px-3 py-2 text-xs font-semibold text-[#3D4F6F]">#</th>
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
              {items.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400 text-sm">Aktiv üzv şirkət yoxdur</td></tr>
              ) : items.map((it, idx) => (
                <tr key={it.company_id} className="border-b border-slate-50 hover:bg-slate-50/40" data-testid={`eval-row-${it.company_id}`}>
                  <td className="text-center font-mono text-slate-400">{idx + 1}</td>
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
