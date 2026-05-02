import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, X, List, Save, Loader2, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Manage all "simple list" dropdowns (statuses, types, sizes, priorities …)
 * from a single unified panel.
 */
export default function ManageableListsPanel() {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState(null);
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/settings/manageable-lists`, { headers });
      setLists(res.data || []);
      if ((res.data || []).length && !activeKey) setActiveKey(res.data[0].key);
    } catch {
      toast.error('Siyahıları yükləmək alınmadı');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const active = lists.find(l => l.key === activeKey);
  const grouped = lists.reduce((acc, l) => { (acc[l.group] = acc[l.group] || []).push(l); return acc; }, {});

  const saveList = async (key, values) => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings/lists/${key}`, { values }, { headers });
      setLists(prev => prev.map(l => l.key === key ? { ...l, values } : l));
      toast.success('Yadda saxlandı');
    } catch {
      toast.error('Xəta baş verdi');
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    if (!active || !newItem.trim()) return;
    if ((active.values || []).includes(newItem.trim())) { toast.error('Bu dəyər artıq mövcuddur'); return; }
    const next = [...(active.values || []), newItem.trim()];
    setNewItem('');
    saveList(active.key, next);
  };

  const removeItem = (val) => {
    if (!active) return;
    if (!window.confirm(`"${val}" silinsin?`)) return;
    const next = (active.values || []).filter(v => v !== val);
    saveList(active.key, next);
  };

  const resetToDefaults = () => {
    if (!active) return;
    if (!window.confirm(`"${active.label}" default dəyərlərə qaytarılsın?`)) return;
    saveList(active.key, active.defaults || []);
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-slate-400 gap-2"><Loader2 className="w-4 h-4 animate-spin" />Yüklənir...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden" data-testid="manageable-lists-panel">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <List className="w-4 h-4 text-[#9ACD32]" />
          <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Siyahılar</h2>
          <span className="text-xs text-slate-400 ml-1">· {lists.length} idarə olunan siyahı</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">Bütün sistem daxilindəki seçim xanalarının dəyərlərini buradan idarə edin.</p>
      </div>

      <div className="flex flex-col md:flex-row">
        {/* Sidebar list picker */}
        <div className="md:w-64 md:shrink-0 md:border-r border-slate-100 md:max-h-[70vh] md:overflow-y-auto">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group}</p>
              {items.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => { setActiveKey(item.key); setNewItem(''); }}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition ${activeKey === item.key ? 'bg-[#9ACD32]/10 text-[#3D4F6F] font-semibold border-l-2 border-l-[#9ACD32]' : 'hover:bg-slate-50 text-slate-600 border-l-2 border-transparent'}`}
                  data-testid={`list-nav-${item.key}`}
                >
                  <span className="truncate">{item.label}</span>
                  <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 ml-2 shrink-0">{(item.values || []).length}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Right editor */}
        <div className="flex-1 p-4 min-h-[40vh]">
          {!active ? (
            <p className="text-slate-400 text-sm text-center py-12">Soldan siyahı seçin</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-base font-semibold text-[#3D4F6F]">{active.label}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 flex-wrap">
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded">{active.group}</span>
                    <ChevronRight className="w-3 h-3 text-slate-300" />
                    <code className="text-[10px] text-slate-500">{active.key}</code>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetToDefaults}
                  disabled={saving}
                  className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                  data-testid="reset-list-btn"
                >
                  Defaultlara qaytar
                </Button>
              </div>

              {/* Add input */}
              <div className="flex gap-2 mb-3">
                <Input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}
                  placeholder="Yeni dəyər..."
                  className="text-sm flex-1"
                  disabled={saving}
                  data-testid="new-list-item-input"
                />
                <Button
                  onClick={addItem}
                  disabled={saving || !newItem.trim()}
                  size="sm"
                  className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold"
                  data-testid="add-list-item-btn"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Əlavə et</>}
                </Button>
              </div>

              {/* Values chips */}
              {(active.values || []).length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8 italic">Siyahı boşdur. Yuxarıda yeni dəyər əlavə edin.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {active.values.map((val, i) => (
                    <div
                      key={`${val}-${i}`}
                      className="group flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full pl-3 pr-1 py-1 text-sm text-[#3D4F6F] transition-colors"
                      data-testid={`list-item-${active.key}-${i}`}
                    >
                      <span>{val}</span>
                      <button
                        type="button"
                        onClick={() => removeItem(val)}
                        className="p-0.5 rounded-full hover:bg-red-100 text-slate-400 hover:text-red-600 transition"
                        title="Sil"
                        data-testid={`remove-list-item-${active.key}-${i}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {saving && (
                <p className="text-xs text-slate-400 mt-3 flex items-center gap-1"><Save className="w-3 h-3" />Yaddaşa yazılır...</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
