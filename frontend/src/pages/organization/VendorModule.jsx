import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Plus, Loader2, Search, Pencil, Trash2, Download, Star, Phone, MessageCircle, MapPin, ExternalLink, Check, X, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Toaster, toast } from 'sonner';
import { usePermissions, canEdit } from '../../context/PermissionContext';
import { PhotoUploadField, SocialLinksField, PhotoUploadDisplay, SocialLinksDisplay } from '../../components/MediaFields';
import ImageLightbox from '../../components/ImageLightbox';
import * as XLSX from 'xlsx';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Strip non-digit characters; allow leading +.
function digitsOnly(s, allowPlus = true) {
  if (s === null || s === undefined) return '';
  const str = String(s);
  if (allowPlus && str.startsWith('+')) {
    return '+' + str.slice(1).replace(/\D/g, '');
  }
  return str.replace(/\D/g, '');
}

// Cache for managed lists fetched from settings.
const _managedListCache = {};

function useManagedList(listKey, headers) {
  const [opts, setOpts] = useState(_managedListCache[listKey] || []);
  useEffect(() => {
    if (!listKey) return;
    if (_managedListCache[listKey]) { setOpts(_managedListCache[listKey]); return; }
    let alive = true;
    axios.get(`${API}/settings/manageable-lists`, { headers })
      .then(r => {
        const item = (r.data || []).find(x => x.key === listKey);
        const vals = item?.values || item?.defaults || [];
        _managedListCache[listKey] = vals;
        if (alive) setOpts(vals);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [listKey, headers]);
  return opts;
}

function FieldInput({ field, value, onChange }) {
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const managedOpts = useManagedList(field.type === 'managedselect' ? field.list_key : null, headers);

  switch (field.type) {
    case 'textarea':
      return <textarea value={value || ''} onChange={e => onChange(e.target.value)} className="w-full min-h-[50px] p-2 text-sm border rounded-lg resize-none" />;
    case 'number':
      return <Input type="number" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))} step={field.step || 1} min={field.min} max={field.max} className="text-sm" />;
    case 'boolean':
      return (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => onChange(true)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${value === true ? 'bg-green-50 text-green-700 border-green-300' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>Bəli</button>
          <button type="button" onClick={() => onChange(false)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${value === false ? 'bg-red-50 text-red-700 border-red-300' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>Xeyr</button>
        </div>
      );
    case 'select':
      return (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
          <SelectContent>{(field.options || []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      );
    case 'managedselect':
      return (
        <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
          <SelectTrigger className="text-sm" data-testid={`managed-${field.key}`}><SelectValue placeholder="Seçin" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Seçilməyib —</SelectItem>
            {managedOpts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case 'multiselect':
      return (
        <div className="flex flex-wrap gap-1.5">
          {(field.options || []).map(o => {
            const active = Array.isArray(value) && value.includes(o);
            return (
              <button key={o} type="button" onClick={() => {
                const arr = Array.isArray(value) ? value : [];
                onChange(active ? arr.filter(x => x !== o) : [...arr, o]);
              }} className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${active ? 'bg-[#9ACD32] text-[#3D4F6F] border-[#9ACD32]' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                {o}
              </button>
            );
          })}
        </div>
      );
    case 'photolinks':
      return <textarea value={value || ''} onChange={e => onChange(e.target.value)} className="w-full min-h-[60px] p-2 text-xs font-mono border rounded-lg resize-none" placeholder="https://...&#10;https://..." />;
    case 'photoupload':
      return <PhotoUploadField value={value} onChange={onChange} multiple={true} />;
    case 'sociallinks':
      return <SocialLinksField value={value} onChange={onChange} />;
    case 'phone': {
      // Default to +994 prefix. Strip non-digits; allow only leading +.
      const raw = value || '';
      const handlePhone = (e) => {
        const v = e.target.value;
        const cleaned = digitsOnly(v.startsWith('+') ? v : (raw.startsWith('+') ? '+' + v : v));
        onChange(cleaned);
      };
      const handleBlur = () => {
        if (raw && !raw.startsWith('+')) onChange('+994' + raw.replace(/^0+/, ''));
      };
      return (
        <Input
          inputMode="tel"
          value={raw}
          onChange={handlePhone}
          onBlur={handleBlur}
          placeholder="+994551234567"
          className="text-sm font-mono"
        />
      );
    }
    case 'digits':
      return (
        <Input
          inputMode="numeric"
          value={value ?? ''}
          onChange={(e) => onChange(digitsOnly(e.target.value, false))}
          className="text-sm font-mono"
        />
      );
    case 'url':
    case 'text':
    default:
      return <Input value={value ?? ''} onChange={e => onChange(e.target.value)} className="text-sm" type={field.type === 'url' ? 'url' : 'text'} />;
  }
}

function renderCellValue(field, value) {
  if (value === null || value === undefined || value === '') return <span className="text-slate-300">—</span>;
  if (field.type === 'photoupload') return <PhotoUploadDisplay value={value} />;
  if (field.type === 'sociallinks') return <SocialLinksDisplay value={value} />;
  if (field.type === 'boolean') return value ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-400" />;
  if (field.type === 'multiselect' && Array.isArray(value)) return <div className="flex flex-wrap gap-1">{value.slice(0, 3).map(v => <Badge key={v} className="bg-slate-100 text-slate-600 text-[10px]">{v}</Badge>)}{value.length > 3 && <span className="text-[10px] text-slate-400">+{value.length - 3}</span>}</div>;
  if (field.type === 'url' && typeof value === 'string' && value.startsWith('http')) return <a href={value} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1 text-xs"><ExternalLink className="w-3 h-3" />Keçid</a>;
  if (field.type === 'number' && typeof value === 'number') return <span className="font-medium">{value.toLocaleString('az-AZ')}</span>;
  if (typeof value === 'string' && value.length > 40) return <span title={value}>{value.slice(0, 38)}...</span>;
  return String(value);
}

function normalizeForSubmit(form, fields) {
  const out = {};
  for (const f of fields) {
    let v = form[f.key];
    if (f.type === 'number' && v === '') v = null;
    if (f.type === 'multiselect' && !Array.isArray(v)) v = [];
    if (f.type === 'photoupload') {
      if (!Array.isArray(v)) {
        v = typeof v === 'string' && v.trim()
          ? v.split('\n').map(s => s.trim()).filter(Boolean)
          : [];
      }
    }
    if (f.type === 'sociallinks') {
      if (!Array.isArray(v)) v = [];
      v = v.filter(l => l && typeof l === 'object' && (l.url || '').trim());
    }
    out[f.key] = v;
  }
  return out;
}

export default function VendorModule({ config }) {
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'organization');
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [lightbox, setLightbox] = useState({ open: false, images: [] });

  // Module identifiers that should NOT show the photo-view button.
  const hidePhotoView = ['photovideo'].includes(config.module);

  // Detect the photo field key (could be `photos` or `samples`) for current config.
  const photoFieldKey = useMemo(() => {
    const f = config.fields.find(x => x.type === 'photoupload');
    return f?.key || null;
  }, [config.fields]);

  const fetchData = useCallback(async () => {
    try { const r = await axios.get(`${API}/organization/${config.module}`, { headers }); setItems(r.data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, [config.module]);
  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

  const emptyForm = useMemo(() => {
    const o = {};
    config.fields.forEach(f => {
      if (f.type === 'multiselect' || f.type === 'photoupload' || f.type === 'sociallinks') o[f.key] = [];
      else if (f.type === 'boolean') o[f.key] = null;
      else o[f.key] = '';
    });
    return o;
  }, [config.fields]);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setShowModal(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...emptyForm, ...item }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = normalizeForSubmit(form, config.fields);
    try {
      if (editing) { await axios.put(`${API}/organization/${config.module}/${editing.id}`, payload, { headers }); toast.success('Yeniləndi'); }
      else { await axios.post(`${API}/organization/${config.module}`, payload, { headers }); toast.success('Əlavə edildi'); }
      setShowModal(false); fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xəta baş verdi');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Silinsin? (bu təchizatçının reytinq tarixçəsi də silinəcək)')) return;
    try { await axios.delete(`${API}/organization/${config.module}/${id}`, { headers }); toast.success('Silindi'); fetchData(); }
    catch { toast.error('Xəta'); }
  };

  const categories = useMemo(() => {
    const categoryField = config.fields.find(f => f.key === 'category' || f.key === 'service_category' || f.key === 'service_type');
    if (!categoryField) return null;
    const s = new Set(items.map(i => i[categoryField.key]).filter(Boolean));
    return { field: categoryField.key, values: Array.from(s) };
  }, [items, config.fields]);

  const filtered = items.filter(i => {
    if (categories && categoryFilter !== 'all' && i[categories.field] !== categoryFilter) return false;
    if (!search) return true;
    const t = search.toLowerCase();
    return Object.entries(i).some(([k, v]) => {
      if (['_id', 'id', 'module'].includes(k)) return false;
      if (typeof v === 'string' && v.toLowerCase().includes(t)) return true;
      return false;
    });
  });

  const exportExcel = () => {
    const data = filtered.map(i => {
      const row = {};
      config.fields.forEach(f => { row[f.label] = Array.isArray(i[f.key]) ? (i[f.key] || []).join(', ') : (i[f.key] ?? ''); });
      row['Reytinq'] = i.rating_avg ?? '';
      return row;
    });
    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, config.title.slice(0, 28));
    XLSX.writeFile(wb, `${config.module}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel endirildi');
  };

  // Group fields for form
  const groupedFields = useMemo(() => {
    const groups = {};
    config.fields.forEach(f => {
      const g = f.group || 'Əsas';
      if (!groups[g]) groups[g] = [];
      groups[g].push(f);
    });
    return groups;
  }, [config.fields]);

  // Determine primary display fields for table
  const listFields = useMemo(() => {
    const list = config.fields.filter(f =>
      ['name', 'category', 'city', 'price', 'price_per_person', 'price_min', 'phone', 'contact_name', 'service_category', 'service_type', 'service_types', 'supplier', 'capacity'].includes(f.key)
    ).slice(0, 6);
    return list;
  }, [config.fields]);

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F]" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid={`org-${config.module}-page`}>
      <Toaster position="top-right" richColors />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#3D4F6F]">{config.title}</h1>
          <p className="text-slate-500 text-sm mt-1">{config.subtitle} • {items.length} qeyd</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={exportExcel} variant="outline" className="text-[#3D4F6F]"><Download className="w-4 h-4 mr-1" />Excel</Button>
          {_canEdit && <Button onClick={openCreate} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid={`add-${config.module}-btn`}><Plus className="w-4 h-4 mr-1" />Yeni</Button>}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-3 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Axtar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 text-sm" />
        </div>
        {categories && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px] text-sm h-9"><SelectValue placeholder="Kateqoriya" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün kateqoriyalar</SelectItem>
              {categories.values.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b">
                {listFields.map(f => <th key={f.key} className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F] whitespace-nowrap">{f.label}</th>)}
                <th className="text-center px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Reytinq</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={listFields.length + 2} className="text-center py-12 text-slate-400 text-sm">Qeyd yoxdur</td></tr> :
                filtered.map(i => (
                  <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50/50" data-testid={`row-${i.id}`}>
                    {listFields.map(f => <td key={f.key} className="px-3 py-2.5 text-xs text-slate-700">{renderCellValue(f, i[f.key])}</td>)}
                    <td className="px-3 py-2.5 text-center">
                      {i.rating_avg != null ? (
                        <div className="flex items-center justify-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-semibold text-[#3D4F6F]">{i.rating_avg}</span>
                          <span className="text-[10px] text-slate-400">({i.rating_count})</span>
                        </div>
                      ) : <span className="text-[10px] text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1 items-center">
                        {!hidePhotoView && photoFieldKey && (() => {
                          const imgs = i[photoFieldKey];
                          const arr = Array.isArray(imgs) ? imgs : (typeof imgs === 'string' ? imgs.split('\n').filter(Boolean) : []);
                          if (arr.length === 0) return null;
                          return (
                            <button
                              type="button"
                              onClick={() => setLightbox({ open: true, images: arr })}
                              className="p-1.5 hover:bg-blue-50 rounded-lg group"
                              title={`${arr.length} şəklə bax`}
                              data-testid={`view-images-${i.id}`}
                            >
                              <ImageIcon className="w-3.5 h-3.5 text-blue-500 group-hover:text-blue-700" />
                            </button>
                          );
                        })()}
                        {_canEdit && (<>
                          <button onClick={() => openEdit(i)} className="p-1.5 hover:bg-slate-100 rounded-lg"><Pencil className="w-3.5 h-3.5 text-slate-400" /></button>
                          <button onClick={() => handleDelete(i.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                        </>)}
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#3D4F6F]">{editing ? 'Redaktə' : 'Yeni'} — {config.title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {Object.entries(groupedFields).map(([group, fields]) => (
              <div key={group} className="bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-[#3D4F6F] uppercase tracking-wider mb-2">{group}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {fields.map(f => (
                    <div key={f.key} className={f.type === 'textarea' || f.type === 'photolinks' || f.type === 'photoupload' || f.type === 'sociallinks' || f.type === 'multiselect' ? 'md:col-span-2' : ''}>
                      <Label className="text-xs">{f.label}{f.required ? ' *' : ''}</Label>
                      <FieldInput field={f} value={form[f.key]} onChange={v => setForm({ ...form, [f.key]: v })} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2 border-t sticky bottom-0 bg-white">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Ləğv et</Button>
              <Button type="submit" className="bg-[#3D4F6F] text-white" data-testid={`submit-${config.module}`}>{editing ? 'Saxla' : 'Yarat'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
