import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Trash2, Pencil, Loader2, Save, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SocialPlatformsPanel({ headers }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', icon: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', icon: '' });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/settings/social-platforms`, { headers });
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
      await axios.post(`${API}/settings/social-platforms`, form, { headers });
      toast.success('Platform əlavə edildi');
      setForm({ name: '', icon: '' });
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xəta');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Silmək istədiyinizdən əminsiniz?')) return;
    try {
      await axios.delete(`${API}/settings/social-platforms/${id}`, { headers });
      toast.success('Silindi');
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xəta');
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ name: item.name, icon: item.icon || '' });
  };

  const saveEdit = async () => {
    try {
      await axios.put(`${API}/settings/social-platforms/${editingId}`, editForm, { headers });
      toast.success('Yeniləndi');
      setEditingId(null);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xəta');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6" data-testid="social-platforms-panel">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Sosial media platformları</h2>
          <p className="text-xs text-slate-500 mt-0.5">Vendor / məkan formalarında "Sosial media linkləri" sahəsində seçim üçün istifadə olunur. İkon adı lucide-react adlarından biri olmalıdır (məs. <code>facebook</code>, <code>instagram</code>, <code>linkedin</code>).</p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-slate-50 rounded-lg" data-testid="sp-form">
        <div className="flex-1">
          <Label className="text-xs mb-1">Platform adı *</Label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="məs. Pinterest" className="text-sm" required data-testid="sp-name-input" />
        </div>
        <div className="w-full sm:w-40">
          <Label className="text-xs mb-1">İkon (opsional)</Label>
          <Input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value.toLowerCase() })} placeholder="globe" className="text-sm font-mono" data-testid="sp-icon-input" />
        </div>
        <div className="flex items-end">
          <Button type="submit" size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="sp-submit-btn">
            <Plus className="w-4 h-4 mr-1" />Əlavə et
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors" data-testid={`sp-item-${item.id}`}>
              {editingId === item.id ? (
                <div className="flex flex-1 gap-2 items-center">
                  <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="text-sm flex-1" data-testid={`sp-edit-name-${item.id}`} />
                  <Input value={editForm.icon} onChange={e => setEditForm({ ...editForm, icon: e.target.value.toLowerCase() })} className="text-sm w-28 font-mono" data-testid={`sp-edit-icon-${item.id}`} />
                  <Button variant="ghost" size="sm" onClick={saveEdit} data-testid={`sp-save-${item.id}`}><Save className="w-3.5 h-3.5 text-emerald-600" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}><X className="w-3.5 h-3.5 text-slate-500" /></Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-sm text-[#3D4F6F]">{item.name}</p>
                    {item.icon && <Badge className="bg-slate-200 text-slate-600 font-mono text-[10px]">{item.icon}</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(item)} data-testid={`sp-edit-${item.id}`}><Pencil className="w-3.5 h-3.5 text-[#3D4F6F]" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} data-testid={`sp-delete-${item.id}`}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                  </div>
                </>
              )}
            </div>
          ))}
          {items.length === 0 && <p className="col-span-full text-center text-slate-400 py-8 text-sm">Platform yoxdur</p>}
        </div>
      )}
    </div>
  );
}
