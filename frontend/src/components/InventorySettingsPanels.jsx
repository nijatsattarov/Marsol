import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Trash2, Pencil, Loader2, Save, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function DepreciableAssetsPanel({ headers }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', rate: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', rate: '' });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/settings/depreciable-assets`, { headers });
      setItems(res.data || []);
    } catch (e) {
      toast.error('Yükləmə xətası');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Ad boş ola bilməz'); return; }
    try {
      await axios.post(`${API}/settings/depreciable-assets`, { name: form.name, rate: Math.max(Number(form.rate) || 0, 0) }, { headers });
      toast.success('Aktiv əlavə edildi');
      setForm({ name: '', rate: '' });
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xəta');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Silmək istədiyinizdən əminsiniz?')) return;
    try {
      await axios.delete(`${API}/settings/depreciable-assets/${id}`, { headers });
      toast.success('Silindi');
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xəta');
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ name: item.name, rate: item.rate });
  };

  const saveEdit = async () => {
    try {
      await axios.put(`${API}/settings/depreciable-assets/${editingId}`, {
        name: editForm.name,
        rate: Math.max(Number(editForm.rate) || 0, 0),
      }, { headers });
      toast.success('Yeniləndi');
      setEditingId(null);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xəta');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6" data-testid="depreciable-assets-panel">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Amortizasiya olunan aktivlər</h2>
          <p className="text-xs text-slate-500 mt-0.5">İnventar əlavə formunda istifadə olunan aktiv növləri və illik amortizasiya faizləri (azalan qalıq metodu)</p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-slate-50 rounded-lg" data-testid="da-form">
        <div className="flex-1">
          <Label className="text-xs mb-1">Aktiv adı *</Label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="məs. Maşın və avadanlıqlar" className="text-sm" required data-testid="da-name-input" />
        </div>
        <div className="w-full sm:w-32">
          <Label className="text-xs mb-1">Faiz (%) *</Label>
          <Input type="number" min="0" max="100" step="0.1" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} placeholder="20" className="text-sm" required data-testid="da-rate-input" />
        </div>
        <div className="flex items-end">
          <Button type="submit" size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="da-submit-btn">
            <Plus className="w-4 h-4 mr-1" />Əlavə et
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors" data-testid={`da-item-${item.id}`}>
              {editingId === item.id ? (
                <div className="flex flex-1 gap-2 items-center">
                  <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="text-sm flex-1" data-testid={`da-edit-name-${item.id}`} />
                  <Input type="number" min="0" max="100" step="0.1" value={editForm.rate} onChange={e => setEditForm({ ...editForm, rate: e.target.value })} className="text-sm w-24" data-testid={`da-edit-rate-${item.id}`} />
                  <Button variant="ghost" size="sm" onClick={saveEdit} data-testid={`da-save-${item.id}`}><Save className="w-3.5 h-3.5 text-emerald-600" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}><X className="w-3.5 h-3.5 text-slate-500" /></Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-sm text-[#3D4F6F]">{item.name}</p>
                    <Badge className="bg-amber-100 text-amber-700">{item.rate}%</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(item)} data-testid={`da-edit-${item.id}`}><Pencil className="w-3.5 h-3.5 text-[#3D4F6F]" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} data-testid={`da-delete-${item.id}`}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                  </div>
                </>
              )}
            </div>
          ))}
          {items.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Aktiv yoxdur</p>}
        </div>
      )}
    </div>
  );
}

export function InventoryCategoriesPanel({ headers }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', code_prefix: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', code_prefix: '' });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/settings/inventory-categories`, { headers });
      setItems(res.data || []);
    } catch {
      toast.error('Yükləmə xətası');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Ad boş ola bilməz'); return; }
    try {
      await axios.post(`${API}/settings/inventory-categories`, form, { headers });
      toast.success('Kateqoriya əlavə edildi');
      setForm({ name: '', code_prefix: '' });
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xəta');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Silmək istədiyinizdən əminsiniz?')) return;
    try {
      await axios.delete(`${API}/settings/inventory-categories/${id}`, { headers });
      toast.success('Silindi');
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xəta');
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ name: item.name, code_prefix: item.code_prefix || '' });
  };

  const saveEdit = async () => {
    try {
      await axios.put(`${API}/settings/inventory-categories/${editingId}`, editForm, { headers });
      toast.success('Yeniləndi');
      setEditingId(null);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xəta');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6" data-testid="inventory-categories-panel">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>İnventar kateqoriyaları</h2>
          <p className="text-xs text-slate-500 mt-0.5">Yeni inventar əlavə edildikdə inventar kodu seçilmiş kateqoriyanın prefiksindən avtomatik yaradılır (məs. KOM-001)</p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-slate-50 rounded-lg" data-testid="ic-form">
        <div className="flex-1">
          <Label className="text-xs mb-1">Kateqoriya adı *</Label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="məs. Kompüter texnikası" className="text-sm" required data-testid="ic-name-input" />
        </div>
        <div className="w-full sm:w-32">
          <Label className="text-xs mb-1">Kod prefiksi</Label>
          <Input value={form.code_prefix} onChange={e => setForm({ ...form, code_prefix: e.target.value.toUpperCase() })} placeholder="KOM" maxLength={6} className="text-sm font-mono uppercase" data-testid="ic-prefix-input" />
        </div>
        <div className="flex items-end">
          <Button type="submit" size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="ic-submit-btn">
            <Plus className="w-4 h-4 mr-1" />Əlavə et
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors" data-testid={`ic-item-${item.id}`}>
              {editingId === item.id ? (
                <div className="flex flex-1 gap-2 items-center">
                  <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="text-sm flex-1" data-testid={`ic-edit-name-${item.id}`} />
                  <Input value={editForm.code_prefix} onChange={e => setEditForm({ ...editForm, code_prefix: e.target.value.toUpperCase() })} maxLength={6} className="text-sm w-24 font-mono uppercase" data-testid={`ic-edit-prefix-${item.id}`} />
                  <Button variant="ghost" size="sm" onClick={saveEdit} data-testid={`ic-save-${item.id}`}><Save className="w-3.5 h-3.5 text-emerald-600" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}><X className="w-3.5 h-3.5 text-slate-500" /></Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-sm text-[#3D4F6F]">{item.name}</p>
                    <Badge className="bg-slate-200 text-slate-700 font-mono">{item.code_prefix}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(item)} data-testid={`ic-edit-${item.id}`}><Pencil className="w-3.5 h-3.5 text-[#3D4F6F]" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} data-testid={`ic-delete-${item.id}`}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                  </div>
                </>
              )}
            </div>
          ))}
          {items.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Kateqoriya yoxdur</p>}
        </div>
      )}
    </div>
  );
}
