import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Loader2, Search, Trash2, Download, Upload, ArrowRight, ArrowLeft, Users, FileSpreadsheet } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';
import { usePermissions, canEdit } from '../context/PermissionContext';
import * as XLSX from 'xlsx';
import PhoneInput from '../components/PhoneInput';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ContactLists() {
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showListModal, setShowListModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [listForm, setListForm] = useState({ title: '', description: '' });
  const [contactForm, setContactForm] = useState({ name: '', surname: '', company: '', position: '', phone: '', email: '', birthday: '', notes: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'sales');
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchLists = useCallback(async () => {
    try { const res = await axios.get(`${API}/contact-lists`, { headers }); setLists(res.data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchLists(); }, [fetchLists]);

  const fetchContacts = async (listId) => {
    try { const res = await axios.get(`${API}/contact-lists/${listId}/contacts`, { headers }); setContacts(res.data); }
    catch { setContacts([]); }
  };

  const openList = (list) => { setSelectedList(list); fetchContacts(list.id); };
  const goBack = () => { setSelectedList(null); setContacts([]); setSearchTerm(''); };

  const handleListSubmit = async (e) => {
    e.preventDefault();
    try { await axios.post(`${API}/contact-lists`, listForm, { headers }); toast.success('Siyahı yaradıldı'); setShowListModal(false); fetchLists(); }
    catch { toast.error('Xəta'); }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    try { await axios.post(`${API}/contact-lists/${selectedList.id}/contacts`, contactForm, { headers }); toast.success('Kontakt əlavə edildi'); setShowContactModal(false); fetchContacts(selectedList.id); fetchLists(); }
    catch { toast.error('Xəta'); }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        if (data.length === 0) return toast.error('Fayl boşdur');
        await axios.post(`${API}/contact-lists/${selectedList.id}/import`, { contacts: data }, { headers });
        toast.success(`${data.length} kontakt import edildi`);
        fetchContacts(selectedList.id); fetchLists();
      } catch { toast.error('Import xətası'); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const exportContacts = () => {
    const data = filteredContacts.map(c => ({ 'Ad': c.name, 'Soyad': c.surname, 'Şirkət': c.company, 'Vəzifə': c.position, 'Telefon': c.phone, 'Email': c.email, 'Qeyd': c.notes }));
    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Kontaktlar');
    XLSX.writeFile(wb, `${selectedList.title}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleConvert = async (contactId) => {
    try { const res = await axios.post(`${API}/contacts/${contactId}/convert-to-lead`, {}, { headers }); toast.success(`Lead yaradıldı: ${res.data.lead_code}`); }
    catch { toast.error('Xəta'); }
  };

  const filteredContacts = contacts.filter(c => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return c.name?.toLowerCase().includes(t) || c.surname?.toLowerCase().includes(t) || c.company?.toLowerCase().includes(t) || c.phone?.includes(t);
  });

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F]" /></div>;

  // LIST VIEW - show all contact lists
  if (!selectedList) return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="contact-lists-page">
      <Toaster position="top-right" richColors />
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl sm:text-2xl font-bold text-[#3D4F6F]">Siyahılar</h1><p className="text-slate-500 text-sm mt-1">Sahibkar / CEO bazası</p></div>
        {_canEdit && <Button onClick={() => { setListForm({ title: '', description: '' }); setShowListModal(true); }} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold"><Plus className="w-4 h-4 mr-1" />Yeni Siyahı</Button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lists.map(l => (
          <div key={l.id} className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openList(l)} data-testid={`list-${l.id}`}>
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold text-[#3D4F6F]">{l.title}</h3>
              {_canEdit && <button onClick={async (e) => { e.stopPropagation(); if (!window.confirm('Silmək?')) return; await axios.delete(`${API}/contact-lists/${l.id}`, { headers }); toast.success('Silindi'); fetchLists(); }} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>}
            </div>
            {l.description && <p className="text-xs text-slate-500 mb-2">{l.description}</p>}
            <div className="flex items-center gap-1 text-sm"><Users className="w-4 h-4 text-blue-500" /><span className="font-semibold text-[#3D4F6F]">{l.contact_count || 0}</span><span className="text-slate-400 text-xs">kontakt</span></div>
          </div>
        ))}
        {lists.length === 0 && <p className="col-span-full text-center text-slate-400 py-12">Siyahı yoxdur</p>}
      </div>
      <Dialog open={showListModal} onOpenChange={setShowListModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-[#3D4F6F]">Yeni Siyahı</DialogTitle></DialogHeader>
          <form onSubmit={handleListSubmit} className="space-y-3">
            <div><Label className="text-xs">Başlıq *</Label><Input value={listForm.title} onChange={e => setListForm({...listForm, title: e.target.value})} required className="text-sm" placeholder="Məs: Sərgi ziyarətçiləri 2025" /></div>
            <div><Label className="text-xs">Açıqlama</Label><textarea value={listForm.description} onChange={e => setListForm({...listForm, description: e.target.value})} className="w-full min-h-[40px] p-2 text-sm border rounded-lg resize-none" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowListModal(false)}>Ləğv et</Button><Button type="submit" className="bg-[#3D4F6F] text-white">Yarat</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );

  // CONTACT VIEW - show contacts of selected list
  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="contacts-page">
      <Toaster position="top-right" richColors />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 hover:bg-slate-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-[#3D4F6F]" /></button>
          <div><h1 className="text-xl font-bold text-[#3D4F6F]">{selectedList.title}</h1><p className="text-slate-500 text-sm">{filteredContacts.length} kontakt</p></div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={exportContacts} variant="outline" className="text-[#3D4F6F]"><Download className="w-4 h-4 mr-1" />Export</Button>
          {_canEdit && <>
            <label className="inline-flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg cursor-pointer hover:bg-blue-100 text-xs font-medium">
              <Upload className="w-4 h-4" />Import
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
            </label>
            <Button onClick={() => { setContactForm({ name: '', surname: '', company: '', position: '', phone: '', email: '', birthday: '', notes: '' }); setShowContactModal(true); }} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold"><Plus className="w-4 h-4 mr-1" />Kontakt</Button>
          </>}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-3 mb-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Axtar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 text-sm" /></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-slate-50 border-b">
              <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Ad Soyad</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Şirkət</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Vəzifə</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Əlaqə</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F]">Qeyd</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-[#3D4F6F]"></th>
            </tr></thead>
            <tbody>
              {filteredContacts.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">Kontakt yoxdur</td></tr> :
              filteredContacts.map(c => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-3 py-2.5 text-sm font-medium text-[#3D4F6F]">{c.name} {c.surname}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-600">{c.company}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{c.position}</td>
                  <td className="px-3 py-2.5"><p className="text-xs text-slate-600">{c.phone}</p>{c.email && <p className="text-[10px] text-slate-400">{c.email}</p>}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-400 max-w-[150px] truncate">{c.notes}</td>
                  <td className="px-3 py-2.5 text-right">
                    {_canEdit && <div className="flex justify-end gap-1">
                      <button onClick={() => handleConvert(c.id)} className="p-1.5 hover:bg-green-50 rounded-lg" title="Lead-ə çevir"><ArrowRight className="w-3.5 h-3.5 text-green-500" /></button>
                      <button onClick={async () => { await axios.delete(`${API}/contact-lists/${selectedList.id}/contacts/${c.id}`, { headers }); toast.success('Silindi'); fetchContacts(selectedList.id); fetchLists(); }} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[#3D4F6F]">Kontakt əlavə et</DialogTitle></DialogHeader>
          <form onSubmit={handleContactSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Ad *</Label><Input value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} required className="text-sm" /></div>
              <div><Label className="text-xs">Soyad</Label><Input value={contactForm.surname} onChange={e => setContactForm({...contactForm, surname: e.target.value})} className="text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Şirkət</Label><Input value={contactForm.company} onChange={e => setContactForm({...contactForm, company: e.target.value})} className="text-sm" /></div>
              <div><Label className="text-xs">Vəzifə</Label><Input value={contactForm.position} onChange={e => setContactForm({...contactForm, position: e.target.value})} className="text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Telefon</Label><PhoneInput value={contactForm.phone} onChange={(v) => setContactForm({...contactForm, phone: v})} testId="contact-phone" /></div>
              <div><Label className="text-xs">Email</Label><Input value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} className="text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Doğum tarixi</Label><Input type="date" value={contactForm.birthday} onChange={e => setContactForm({...contactForm, birthday: e.target.value})} className="text-sm" data-testid="contact-birthday" /></div>
            </div>
            <div><Label className="text-xs">Qeyd</Label><textarea value={contactForm.notes} onChange={e => setContactForm({...contactForm, notes: e.target.value})} className="w-full min-h-[30px] p-2 text-sm border rounded-lg resize-none" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowContactModal(false)}>Ləğv et</Button><Button type="submit" className="bg-[#3D4F6F] text-white">Əlavə et</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
