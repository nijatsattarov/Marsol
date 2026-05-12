import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Plus, Pin, PinOff, Trash2, Pencil, Search, Tag, X, StickyNote, Loader2, Hash } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Toaster, toast } from 'sonner';
import { formatDate } from '../lib/dateUtils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const NOTE_COLORS = ['#FFFFFF', '#FEF3C7', '#FED7AA', '#FECACA', '#DBEAFE', '#D1FAE5', '#E9D5FF', '#FBCFE8'];

const emptyNote = { title: '', content: '', color: NOTE_COLORS[1], pinned: false, tags: [], shared_with_all: false };

export default function Notes() {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [notes, setNotes] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [filterPinned, setFilterPinned] = useState(false);

  const [editing, setEditing] = useState(null); // null | 'new' | note
  const [form, setForm] = useState(emptyNote);
  const [tagInput, setTagInput] = useState('');

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.q = search.trim();
      if (activeTag) params.tag = activeTag;
      if (filterPinned) params.pinned = true;
      const res = await axios.get(`${API}/notes`, { headers, params });
      setNotes(res.data || []);
      const tagRes = await axios.get(`${API}/notes/tags`, { headers });
      setTags(tagRes.data || []);
    } catch {
      toast.error('Qeydləri yükləmək alınmadı');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, activeTag, filterPinned]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const openNew = () => { setEditing('new'); setForm({ ...emptyNote }); setTagInput(''); };
  const openEdit = (n) => { setEditing(n); setForm({ ...n, tags: n.tags || [] }); setTagInput(''); };
  const closeModal = () => { setEditing(null); setForm(emptyNote); setTagInput(''); };

  const submit = async () => {
    if (!form.title.trim() && !form.content.trim()) { toast.error('Başlıq və ya məzmun lazımdır'); return; }
    try {
      if (editing === 'new') {
        await axios.post(`${API}/notes`, form, { headers });
        toast.success('Qeyd əlavə edildi');
      } else {
        await axios.put(`${API}/notes/${editing.id}`, form, { headers });
        toast.success('Qeyd yeniləndi');
      }
      closeModal();
      fetchNotes();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Xəta baş verdi');
    }
  };

  const togglePin = async (n) => {
    try {
      await axios.put(`${API}/notes/${n.id}`, { pinned: !n.pinned }, { headers });
      fetchNotes();
    } catch { toast.error('Yenilənmədi'); }
  };

  const remove = async (n) => {
    if (!window.confirm(`"${n.title || 'Bu qeyd'}" silinsin?`)) return;
    try {
      await axios.delete(`${API}/notes/${n.id}`, { headers });
      toast.success('Silindi');
      fetchNotes();
    } catch { toast.error('Silinmədi'); }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || form.tags.includes(t)) { setTagInput(''); return; }
    setForm(prev => ({ ...prev, tags: [...prev.tags, t] }));
    setTagInput('');
  };
  const removeTag = (t) => setForm(prev => ({ ...prev, tags: prev.tags.filter(x => x !== t) }));

  const pinnedNotes = useMemo(() => notes.filter(n => n.pinned), [notes]);
  const otherNotes = useMemo(() => notes.filter(n => !n.pinned), [notes]);

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-[1600px] mx-auto" data-testid="notes-page">
      <Toaster position="top-right" richColors />

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <StickyNote className="w-6 h-6 text-[#9ACD32]" />
          <h1 className="text-xl sm:text-2xl font-bold text-[#3D4F6F]">Qeydlər</h1>
          <span className="text-xs text-slate-400">· {notes.length} qeyd</span>
        </div>
        <Button onClick={openNew} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" size="sm" data-testid="new-note-btn">
          <Plus className="w-4 h-4 mr-1" /> Yeni qeyd
        </Button>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-100 p-3 mb-4 sticky top-14 z-10 shadow-sm">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Qeydlərdə axtar..." className="pl-10 text-sm" data-testid="notes-search" />
          </div>
          <Button
            size="sm"
            variant={filterPinned ? 'default' : 'outline'}
            onClick={() => setFilterPinned(p => !p)}
            className={filterPinned ? 'bg-[#3D4F6F] text-white' : ''}
            data-testid="filter-pinned-btn"
          >
            <Pin className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Sancılmış</span>
          </Button>
          {activeTag && (
            <button type="button" onClick={() => setActiveTag('')} className="flex items-center gap-1 bg-[#9ACD32]/15 border border-[#9ACD32] text-[#3D4F6F] text-xs rounded-full px-2.5 py-1 hover:bg-[#9ACD32]/25" data-testid="active-tag-filter">
              <Hash className="w-3 h-3" />{activeTag}<X className="w-3 h-3" />
            </button>
          )}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.slice(0, 14).map(t => (
              <button
                key={t.tag}
                type="button"
                onClick={() => setActiveTag(activeTag === t.tag ? '' : t.tag)}
                className={`text-[11px] flex items-center gap-1 rounded-full px-2 py-0.5 border transition-colors ${activeTag === t.tag ? 'bg-[#3D4F6F] text-white border-[#3D4F6F]' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'}`}
                data-testid={`tag-${t.tag}`}
              >
                <Hash className="w-2.5 h-2.5" />{t.tag}
                <span className="text-[10px] opacity-70">{t.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notes grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" />Yüklənir...</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Hələ qeyd yoxdur. "Yeni qeyd" düyməsi ilə başlayın.</p>
        </div>
      ) : (
        <>
          {pinnedNotes.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1"><Pin className="w-3 h-3" />Sancılmış</p>
              <NotesGrid notes={pinnedNotes} onEdit={openEdit} onPin={togglePin} onDelete={remove} onTagClick={setActiveTag} />
            </>
          )}
          {otherNotes.length > 0 && (
            <>
              {pinnedNotes.length > 0 && <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-5 mb-2">Digərləri</p>}
              <NotesGrid notes={otherNotes} onEdit={openEdit} onPin={togglePin} onDelete={remove} onTagClick={setActiveTag} />
            </>
          )}
        </>
      )}

      {/* Add/Edit modal */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-w-lg" data-testid="note-modal" style={{ backgroundColor: form.color }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>{editing === 'new' ? 'Yeni qeyd' : 'Qeydi redaktə et'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Başlıq..." className="text-base font-semibold bg-transparent border-0 border-b border-slate-300 rounded-none px-0 focus-visible:ring-0 focus-visible:border-[#3D4F6F]" data-testid="note-title-input" />
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Qeyd məzmunu..." className="w-full min-h-[140px] p-2 text-sm border border-slate-300 rounded-lg resize-y bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#9ACD32]" data-testid="note-content-input" />

            {/* Tags */}
            <div>
              <Label className="text-xs text-slate-600">Etiketlər</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {form.tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 bg-white/70 border border-slate-300 rounded-full pl-2 pr-1 py-0.5 text-xs" data-testid={`note-tag-chip-${t}`}>
                    <Hash className="w-2.5 h-2.5 text-slate-500" />{t}
                    <button type="button" onClick={() => removeTag(t)} className="text-slate-400 hover:text-red-500 p-0.5"><X className="w-3 h-3" /></button>
                  </span>
                ))}
                <div className="flex items-center gap-1">
                  <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="+ etiket" className="h-7 text-xs w-24 bg-white/70" data-testid="note-tag-input" />
                </div>
              </div>
            </div>

            {/* Color picker + pin + share */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-300/60">
              <div className="flex gap-1">
                {NOTE_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${form.color === c ? 'border-[#3D4F6F] scale-110' : 'border-slate-300'}`}
                    style={{ backgroundColor: c }}
                    title={c}
                    data-testid={`note-color-${c}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setForm({ ...form, pinned: !form.pinned })} className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${form.pinned ? 'bg-[#3D4F6F] text-white' : 'text-slate-600 hover:bg-white/60'}`} data-testid="note-pin-toggle">
                  {form.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  {form.pinned ? 'Sancılıb' : 'Sanc'}
                </button>
                <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={form.shared_with_all} onChange={(e) => setForm({ ...form, shared_with_all: e.target.checked })} className="accent-[#9ACD32]" data-testid="note-share-toggle" />
                  Hamı görsün
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeModal} data-testid="note-cancel">Ləğv</Button>
              <Button onClick={submit} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="note-save">
                {editing === 'new' ? 'Yarat' : 'Yenilə'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotesGrid({ notes, onEdit, onPin, onDelete, onTagClick }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" data-testid="notes-grid">
      {notes.map(n => (
        <div
          key={n.id}
          className="group relative rounded-xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
          style={{ backgroundColor: n.color || '#FFFFFF' }}
          data-testid={`note-card-${n.id}`}
        >
          <div className="p-3 cursor-pointer" onClick={() => onEdit(n)}>
            {n.title && <p className="font-semibold text-[#3D4F6F] mb-1 truncate">{n.title}</p>}
            {n.content && <p className="text-xs text-slate-700 whitespace-pre-line line-clamp-6">{n.content}</p>}
            {n.tags && n.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {n.tags.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onTagClick(t); }}
                    className="text-[10px] flex items-center gap-0.5 bg-white/60 hover:bg-white/90 border border-slate-200 rounded-full px-1.5 py-0.5 text-slate-600"
                  >
                    <Hash className="w-2 h-2" />{t}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-2">{n.created_by} · {formatDate(n.updated_at || n.created_at)}</p>
          </div>
          {/* Hover actions */}
          <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" onClick={() => onPin(n)} className="p-1 rounded hover:bg-black/10" title={n.pinned ? 'Sancı çıxar' : 'Sanc'} data-testid={`note-pin-${n.id}`}>
              {n.pinned ? <PinOff className="w-3.5 h-3.5 text-[#3D4F6F]" /> : <Pin className="w-3.5 h-3.5 text-slate-500" />}
            </button>
            <button type="button" onClick={() => onEdit(n)} className="p-1 rounded hover:bg-black/10" title="Redaktə" data-testid={`note-edit-${n.id}`}>
              <Pencil className="w-3.5 h-3.5 text-slate-500" />
            </button>
            <button type="button" onClick={() => onDelete(n)} className="p-1 rounded hover:bg-red-100" title="Sil" data-testid={`note-delete-${n.id}`}>
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </button>
          </div>
          {n.pinned && <Pin className="absolute top-1.5 left-1.5 w-3 h-3 text-[#3D4F6F]" />}
        </div>
      ))}
    </div>
  );
}
