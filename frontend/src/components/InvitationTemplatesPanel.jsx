import { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, RotateCcw, Save, Info } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PLACEHOLDERS = [
  { token: '{guest_name}', label: 'Qonağın adı' },
  { token: '{event_name}', label: 'Tədbirin adı' },
  { token: '{event_date}', label: 'Tədbirin tarixi' },
  { token: '{event_time}', label: 'Tədbirin saatı' },
  { token: '{event_location}', label: 'Tədbirin ünvanı' },
];

export default function InvitationTemplatesPanel() {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({}); // { event_type: body }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/invitation-templates`, { headers });
      setItems(r.data || []);
      const d = {}; (r.data || []).forEach(it => { d[it.event_type] = it.body; });
      setDrafts(d);
    } catch (e) { toast.error('Şablonlar yüklənmədi'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line

  const onSave = async (et) => {
    setSaving(et);
    try {
      await axios.put(`${API}/invitation-templates/${encodeURIComponent(et)}`, { body: drafts[et] }, { headers });
      toast.success(`"${et}" şablonu yadda saxlanıldı`);
      fetchAll();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Yadda saxlama xətası');
    } finally { setSaving(''); }
  };

  const onReset = async (et) => {
    if (!window.confirm(`"${et}" şablonu defolta sıfırlansın?`)) return;
    try {
      await axios.delete(`${API}/invitation-templates/${encodeURIComponent(et)}`, { headers });
      toast.success('Defolt şablona sıfırlandı');
      fetchAll();
    } catch (e) { toast.error('Xəta'); }
  };

  const insertPlaceholder = (et, token) => {
    setDrafts(prev => ({ ...prev, [et]: (prev[et] || '') + token }));
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#3D4F6F]" /></div>;

  return (
    <div className="space-y-4" data-testid="invitation-templates-panel">
      <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-800">
          Hər fəaliyyət növü üçün dəvətnamə mətnini fərdi şəkildə tənzimləyə bilərsiniz.
          Aşağıdakı placeholder-lər mətndə avtomatik əvəzlənir: {PLACEHOLDERS.map((p, i) => (
            <code key={p.token} className="bg-white px-1.5 py-0.5 rounded border border-blue-200 ml-1 font-mono text-[10px]">{p.token}</code>
          ))}
        </div>
      </div>

      {items.map(it => (
        <div key={it.event_type} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm" data-testid={`tpl-${it.event_type}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[#3D4F6F] text-sm">{it.event_type === 'default' ? 'Default (digər tədbirlər)' : it.event_type}</h3>
              {it.is_default && <Badge className="bg-slate-100 text-slate-600 text-[10px]">Default</Badge>}
              {!it.is_default && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Fərdiləşdirilmiş</Badge>}
            </div>
            <div className="flex items-center gap-2">
              {!it.is_default && (
                <Button size="sm" variant="outline" onClick={() => onReset(it.event_type)} className="h-8 text-xs text-amber-600 border-amber-200" data-testid={`tpl-reset-${it.event_type}`}>
                  <RotateCcw className="w-3 h-3 mr-1" />Sıfırla
                </Button>
              )}
              <Button size="sm" onClick={() => onSave(it.event_type)} disabled={saving === it.event_type} className="h-8 text-xs bg-[#3D4F6F] text-white" data-testid={`tpl-save-${it.event_type}`}>
                {saving === it.event_type ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}Yadda saxla
              </Button>
            </div>
          </div>

          <Label className="text-[10px] text-slate-500 uppercase tracking-wide">Şablon mətni (yeni sətir = dəvətnamə şəklində yeni sətir)</Label>
          <textarea
            value={drafts[it.event_type] || ''}
            onChange={(e) => setDrafts(prev => ({ ...prev, [it.event_type]: e.target.value }))}
            rows={5}
            className="w-full mt-1 p-3 text-sm border rounded-lg font-mono text-[#3D4F6F] focus:outline-none focus:ring-2 focus:ring-[#9ACD32]/50"
            data-testid={`tpl-body-${it.event_type}`}
          />

          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-[10px] text-slate-400">Placeholder əlavə et:</span>
            {PLACEHOLDERS.map(p => (
              <button key={p.token} type="button" onClick={() => insertPlaceholder(it.event_type, p.token)} className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-mono">
                {p.token}
              </button>
            ))}
          </div>

          {it.updated_at && (
            <p className="text-[10px] text-slate-400 mt-2">
              Son redaktə: {new Date(it.updated_at).toLocaleString('az-AZ')} {it.updated_by && `· ${it.updated_by}`}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
