import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  FileText, Plus, Upload, Download, Loader2, Pencil, Trash2, X,
  Building2, Hash, User as UserIcon, Calendar, Calculator, FileUp
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Toaster, toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STANDARD_SERVICES = [
  'Arxa və yan divarlar, şirkətin adı ilə lövhə, 1 masa, 2 stul, zibil qutusu, 3 yuvalı elektrik uzadıcı, xalça döşəmə;',
  'Sərgi üçün çap ediləcək 2000 tiraj kataloqda 1(bir) səhifə reklam (A5).',
  'Sertifikat',
  'Sərgi foye hissəsində 6x4 metr ölçülü monitorda vaxtaşırı şirkətinizin loqosunun yayımlanması',
  '“Brendwall” da Sifarişçiyə məxsus loqo',
  'Marsolexpo.az saytında şirkətiniz üçün ayrılmış bölmədə məlumatlarınızın bir illik yerləşdirilməsi',
  '“Sərgidə biz də varıq” posterinin tərəfimizdən tərtib olunması;',
  'Sərgi günlərində təşkil olunan B2B və B2G görüşlərdə iştirak imkanı;',
  'Coffee Break zonasında təqdim olunan xidmətlərdən ödənişsiz istifadə (ancaq stend iştirakçıları üçün)',
  'Sərgi sonrası axşam ziyafətinə bir nəfərə dəvətnamə',
  'Axşam ziyafətində “Brendwall” da loqo',
  'Sərgi müddətində, vaxtaşırı kampaniya və endirimlərin səsləndirilməsi;',
  'Sərgi iştirakçısı şirkət rəhbərlərilə sərgi öncəsi təşkil edilən görüşlərdə iştirak imkanı;',
];

const emptyAddendum = () => ({
  parent_contract_number: '', parent_contract_date: '',
  sifarisci_company: '', sifarisci_voen: '', sifarisci_authorized: '',
  addendum_date: new Date().toISOString().slice(0, 10),
  stand_number: '',
  stand_width: 0,
  stand_length: 0,
  pricing: { price_net: 0, vat_enabled: true, vat_rate: 18 },
});

const emptyNewContract = () => ({
  contract_number: '',
  contract_date: new Date().toISOString().slice(0, 10),
  sifarisci_company: '',
  sifarisci_voen: '',
  sifarisci_authorized: '',
  iban: '',
  bank_name: '',
  branch_code: '',
  bank_voen: '',
  correspondent_account: '',
  swift: '',
  stand_number: '',
  stand_width: 0,
  stand_length: 0,
  price: 0,
  vat_enabled: true,
  vat_rate: 18,
});

const computeTotal = (p) => {
  const net = Number(p?.price_net || 0);
  const vat = p?.vat_enabled ? net * (Number(p?.vat_rate || 18) / 100) : 0;
  return { net, vat: Math.round(vat * 100) / 100, total: Math.round((net + vat) * 100) / 100 };
};

export default function Contracts() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [form, setForm] = useState(emptyAddendum());
  const [newForm, setNewForm] = useState(emptyNewContract());
  const [savingNew, setSavingNew] = useState(false);
  const [editing, setEditing] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/contracts`, { headers });
      setContracts(r.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Müqavilələr yüklənmədi');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast.error('Yalnız .docx faylı qəbul edilir');
      return;
    }
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await axios.post(`${API}/contracts/extract`, fd, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      });
      setForm(prev => ({
        ...prev,
        parent_contract_number: r.data.contract_number || '',
        parent_contract_date: r.data.contract_date || '',
        sifarisci_company: r.data.sifarisci_company || '',
        sifarisci_voen: r.data.sifarisci_voen || '',
        sifarisci_authorized: r.data.sifarisci_authorized || '',
      }));
      const missing = [];
      if (!r.data.contract_number) missing.push('Müqavilə №');
      if (!r.data.contract_date) missing.push('Əsas müqavilə tarixi');
      if (!r.data.sifarisci_company) missing.push('Şirkət adı');
      if (!r.data.sifarisci_voen) missing.push('VÖEN');
      if (missing.length) {
        toast.warning(`Bəzi sahələr tapılmadı: ${missing.join(', ')}. Əl ilə doldurun.`);
      } else {
        toast.success('Müqavilə məlumatları tam çıxarıldı');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Çıxarma alınmadı');
    } finally {
      setExtracting(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.sifarisci_company.trim()) { toast.error('Sifarişçi şirkət adı məcburidir'); return; }
    if (saving) return;
    setSaving(true);
    try {
      let saved;
      if (editing) {
        saved = (await axios.put(`${API}/contracts/${editing.id}`, form, { headers })).data;
        toast.success('Müqavilə yeniləndi');
      } else {
        saved = (await axios.post(`${API}/contracts/addendum`, form, { headers })).data;
        toast.success('Əlavə müqavilə yaradıldı');
      }
      setShowModal(false);
      setForm(emptyAddendum());
      setEditing(null);
      fetchData();
      // Trigger download
      try {
        const blobRes = await axios.get(`${API}/contracts/${saved.id}/download`, { headers, responseType: 'blob' });
        const url = URL.createObjectURL(blobRes.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Elave_${(saved.parent_contract_number || 'muqavile').replace('/', '-')}_N${saved.addendum_number || 1}.docx`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      } catch { /* silent */ }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Saxlanılmadı');
    } finally { setSaving(false); }
  };

  const handleSubmitNew = async (e) => {
    e.preventDefault();
    if (!newForm.sifarisci_company.trim()) { toast.error('Şirkət adı məcburidir'); return; }
    if (!newForm.contract_number.trim()) { toast.error('Müqavilə nömrəsi məcburidir'); return; }
    if (savingNew) return;
    setSavingNew(true);
    try {
      const saved = (await axios.post(`${API}/contracts/new`, newForm, { headers })).data;
      toast.success('Yeni müqavilə yaradıldı');
      setShowNewModal(false);
      setNewForm(emptyNewContract());
      fetchData();
      // Auto-download the freshly-generated DOCX
      try {
        const blobRes = await axios.get(`${API}/contracts/${saved.id}/download`, { headers, responseType: 'blob' });
        const url = URL.createObjectURL(blobRes.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Muqavile_${(saved.contract_number || 'yeni').replace('/', '-')}.docx`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      } catch { /* silent */ }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Saxlanılmadı');
    } finally { setSavingNew(false); }
  };

  const handleDownload = async (c) => {
    try {
      const r = await axios.get(`${API}/contracts/${c.id}/download`, { headers, responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Elave_${(c.parent_contract_number || 'muqavile').replace('/', '-')}_N${c.addendum_number || 1}.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Yüklənmədi');
    }
  };

  const handleDownloadInvoice = async (c) => {
    try {
      const r = await axios.get(`${API}/contracts/${c.id}/invoice`, { headers, responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HF_${(c.parent_contract_number || 'muqavile').replace('/', '-')}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Hesab Faktura yüklənmədi');
    }
  };

  const handleDownloadStandPlan = async (c) => {
    try {
      const r = await axios.get(`${API}/contracts/${c.id}/stand-plan`, { headers, responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `StendPlan_${(c.parent_contract_number || 'muqavile').replace('/', '-')}.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Stend Planı yüklənmədi');
    }
  };

  const handleEdit = (c) => {
    setEditing(c);
    setForm({
      parent_contract_number: c.parent_contract_number || '',
      parent_contract_date: c.parent_contract_date || '',
      sifarisci_company: c.sifarisci_company || '',
      sifarisci_voen: c.sifarisci_voen || '',
      sifarisci_authorized: c.sifarisci_authorized || '',
      addendum_date: c.addendum_date || new Date().toISOString().slice(0, 10),
      stand_number: c.stand_number || '',
      stand_width: c.stand_width || 0,
      stand_length: c.stand_length || 0,
      pricing: c.pricing || { price_net: 0, vat_enabled: true, vat_rate: 18 },
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Müqavilə silinsin?')) return;
    try {
      await axios.delete(`${API}/contracts/${id}`, { headers });
      toast.success('Silindi');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Silinmədi');
    }
  };

  const { net, vat, total } = computeTotal(form.pricing);

  return (
    <div className="p-4 sm:p-6 max-w-[1500px] mx-auto" data-testid="contracts-page">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2" style={{ color: '#3D4F6F' }}>
            <FileText className="w-6 h-6" />Sərgi Müqavilə Redaktoru
          </h1>
          <p className="text-slate-500 text-sm mt-1">Yeni sərgi müqavilələri və əlavə müqavilələri avtomatik generasiya edin</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => { setNewForm(emptyNewContract()); setShowNewModal(true); }}
            className="bg-[#3D4F6F] text-white hover:bg-[#2A364C] font-semibold"
            data-testid="new-contract-btn"
          ><Plus className="w-4 h-4 mr-1" />Yeni Müqavilə</Button>
          <Button
            onClick={() => { setEditing(null); setForm(emptyAddendum()); setShowModal(true); }}
            className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold"
            data-testid="new-addendum-btn"
          ><Plus className="w-4 h-4 mr-1" />Yeni Əlavə Müqavilə</Button>
        </div>
      </div>

      {/* Contracts list */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" />Yüklənir...</div>
        ) : contracts.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Hələ heç bir müqavilə yoxdur</p>
            <p className="text-xs mt-1">Yeni Əlavə Müqavilə yaratmaq üçün yuxarıdakı düyməni klikləyin</p>
          </div>
        ) : (
          <table className="w-full" data-testid="contracts-table">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F] text-left">№</th>
                <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F] text-left">Əsas müqavilə</th>
                <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F] text-left">Sifarişçi</th>
                <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F] text-left">VÖEN</th>
                <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F] text-left">Sərgi</th>
                <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F] text-right">Məbləğ</th>
                <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F] text-left">Tarix</th>
                <th className="px-3 py-2 text-xs font-semibold text-[#3D4F6F] text-right">Əməliyyat</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => {
                const ct = computeTotal(c.pricing);
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50" data-testid={`contract-row-${c.id}`}>
                    <td className="px-3 py-2 text-sm">
                      <Badge className="bg-amber-50 text-amber-700 border border-amber-200">Əlavə №{c.addendum_number}</Badge>
                    </td>
                    <td className="px-3 py-2 text-sm font-mono text-slate-700">{c.parent_contract_number || '—'}</td>
                    <td className="px-3 py-2 text-sm text-slate-800 font-medium">{c.sifarisci_company || '—'}</td>
                    <td className="px-3 py-2 text-sm text-slate-600 font-mono">{c.sifarisci_voen || '—'}</td>
                    <td className="px-3 py-2 text-sm text-slate-600">{c.exhibition_name || '—'}</td>
                    <td className="px-3 py-2 text-sm text-right font-semibold text-slate-800">{ct.total.toFixed(2)} AZN</td>
                    <td className="px-3 py-2 text-sm text-slate-500">{(c.addendum_date || '').slice(0, 10)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleDownload(c)} className="h-7 text-xs text-emerald-700 hover:bg-emerald-50" data-testid={`download-${c.id}`} title="Əlavə Müqavilə (Word) yüklə">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDownloadInvoice(c)} className="h-7 text-xs text-indigo-700 hover:bg-indigo-50 font-semibold" data-testid={`invoice-${c.id}`} title="Hesab Faktura (Excel) yüklə">
                          <span className="text-[10px]">HF</span>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDownloadStandPlan(c)} className="h-7 text-xs text-amber-700 hover:bg-amber-50 font-semibold" data-testid={`stand-plan-${c.id}`} title="Stend Yerləşim Planı (Word) yüklə">
                          <span className="text-[10px]">Plan</span>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(c)} className="h-7 text-xs text-blue-700 hover:bg-blue-50" data-testid={`edit-${c.id}`} title="Redaktə">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)} className="h-7 text-xs text-rose-700 hover:bg-rose-50" data-testid={`delete-${c.id}`} title="Sil">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* NEW CONTRACT modal (for first-time exhibitors) */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="new-contract-modal">
          <DialogHeader>
            <DialogTitle className="text-[#3D4F6F]">Yeni Sərgi Müqaviləsi</DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Sərgiyə ilk dəfə qatılan şirkət üçün müqavilə. Sərgi: <b>23–26 İyun 2027 · Yerli şirkətlərin tanıtım sərgisi</b>. Yaddaşa aldıqda müqavilə DOCX avtomatik yüklənəcək; HF və Stend planı ayrıca düymələrdən yüklənə bilər.
            </p>
          </DialogHeader>
          <form onSubmit={handleSubmitNew} className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-[#3D4F6F] mb-2 flex items-center gap-1"><Hash className="w-3.5 h-3.5" />Müqavilə məlumatları</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Müqavilə nömrəsi <span className="text-red-500">*</span></Label>
                  <Input value={newForm.contract_number} onChange={(e) => setNewForm({ ...newForm, contract_number: e.target.value })} className="text-sm font-mono" placeholder="TS002/27" data-testid="new-contract-number" />
                </div>
                <div>
                  <Label className="text-xs">Müqavilə tarixi</Label>
                  <Input type="date" value={newForm.contract_date} onChange={(e) => setNewForm({ ...newForm, contract_date: e.target.value })} className="text-sm" data-testid="new-contract-date" />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#3D4F6F] mb-2 flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />Sifarişçi məlumatları</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Şirkət adı (hüquqi forma ilə) <span className="text-red-500">*</span></Label>
                  <Input value={newForm.sifarisci_company} onChange={(e) => setNewForm({ ...newForm, sifarisci_company: e.target.value })} className="text-sm" placeholder="Nümunə MMC" data-testid="new-sifarisci-company" />
                </div>
                <div>
                  <Label className="text-xs">VÖEN</Label>
                  <Input value={newForm.sifarisci_voen} onChange={(e) => setNewForm({ ...newForm, sifarisci_voen: e.target.value })} className="text-sm font-mono" data-testid="new-sifarisci-voen" />
                </div>
                <div>
                  <Label className="text-xs">Səlahiyyətli şəxs (Ad Soyad)</Label>
                  <Input value={newForm.sifarisci_authorized} onChange={(e) => setNewForm({ ...newForm, sifarisci_authorized: e.target.value })} className="text-sm" data-testid="new-sifarisci-authorized" />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#3D4F6F] mb-2 flex items-center gap-1"><Calculator className="w-3.5 h-3.5" />Bank rekvizitləri</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Bankın adı</Label>
                  <Input value={newForm.bank_name} onChange={(e) => setNewForm({ ...newForm, bank_name: e.target.value })} className="text-sm" placeholder='«Bank» ASC filialı' data-testid="new-bank-name" />
                </div>
                <div>
                  <Label className="text-xs">Filialın kodu</Label>
                  <Input value={newForm.branch_code} onChange={(e) => setNewForm({ ...newForm, branch_code: e.target.value })} className="text-sm font-mono" data-testid="new-branch-code" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Hesablaşma hesabı (IBAN)</Label>
                  <Input value={newForm.iban} onChange={(e) => setNewForm({ ...newForm, iban: e.target.value })} className="text-sm font-mono" placeholder="AZxxNNNN0000000000000000000" data-testid="new-iban" />
                </div>
                <div>
                  <Label className="text-xs">Bankın VÖEN</Label>
                  <Input value={newForm.bank_voen} onChange={(e) => setNewForm({ ...newForm, bank_voen: e.target.value })} className="text-sm font-mono" data-testid="new-bank-voen" />
                </div>
                <div>
                  <Label className="text-xs">SWIFT</Label>
                  <Input value={newForm.swift} onChange={(e) => setNewForm({ ...newForm, swift: e.target.value })} className="text-sm font-mono" data-testid="new-swift" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Müxbir hesab</Label>
                  <Input value={newForm.correspondent_account} onChange={(e) => setNewForm({ ...newForm, correspondent_account: e.target.value })} className="text-sm font-mono" data-testid="new-correspondent" />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#3D4F6F] mb-2 flex items-center gap-1"><Hash className="w-3.5 h-3.5" />Stend və qiymət</Label>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Stend №</Label>
                  <Input value={newForm.stand_number} onChange={(e) => setNewForm({ ...newForm, stand_number: e.target.value })} className="text-sm" data-testid="new-stand-number" />
                </div>
                <div>
                  <Label className="text-xs">En (m)</Label>
                  <Input type="number" step="0.1" value={newForm.stand_width} onChange={(e) => setNewForm({ ...newForm, stand_width: parseFloat(e.target.value) || 0 })} className="text-sm" data-testid="new-stand-width" />
                </div>
                <div>
                  <Label className="text-xs">Uzunluq (m)</Label>
                  <Input type="number" step="0.1" value={newForm.stand_length} onChange={(e) => setNewForm({ ...newForm, stand_length: parseFloat(e.target.value) || 0 })} className="text-sm" data-testid="new-stand-length" />
                </div>
                <div>
                  <Label className="text-xs">Sahə (m²)</Label>
                  <Input value={(Number(newForm.stand_width || 0) * Number(newForm.stand_length || 0)).toFixed(2)} readOnly disabled className="text-sm bg-slate-50" />
                </div>
                <div>
                  <Label className="text-xs">Qiymət (AZN)</Label>
                  <Input type="number" step="0.01" value={newForm.price} onChange={(e) => setNewForm({ ...newForm, price: parseFloat(e.target.value) || 0 })} className="text-sm" data-testid="new-price" />
                </div>
                <div>
                  <Label className="text-xs">ƏDV faizi (%)</Label>
                  <Input type="number" step="0.1" value={newForm.vat_rate} onChange={(e) => setNewForm({ ...newForm, vat_rate: parseFloat(e.target.value) || 0 })} className="text-sm" data-testid="new-vat-rate" />
                </div>
                <div className="col-span-2 flex items-end gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" checked={newForm.vat_enabled} onChange={(e) => setNewForm({ ...newForm, vat_enabled: e.target.checked })} data-testid="new-vat-enabled" />
                    ƏDV daxildir
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setShowNewModal(false)} data-testid="cancel-new-btn">Ləğv et</Button>
              <Button type="submit" disabled={savingNew} className="bg-[#3D4F6F] text-white hover:bg-[#2A364C] font-semibold" data-testid="save-new-contract-btn">
                {savingNew ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Saxlanılır...</> : 'Yeni Müqaviləni Yarat'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="addendum-modal">
          <DialogHeader>
            <DialogTitle className="text-[#3D4F6F]">{editing ? 'Müqaviləyə Əlavəni Redaktə Et' : 'Yeni Əlavə Müqavilə'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Upload existing contract */}
            {!editing && (
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 bg-slate-50">
                <Label className="text-xs font-semibold text-[#3D4F6F] flex items-center gap-1 mb-2">
                  <FileUp className="w-3.5 h-3.5" />1. Köhnə (əsas) müqaviləni seç (DOCX) — sahələr avtomatik dolacaq
                </Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept=".docx" onChange={handleFileUpload} disabled={extracting} className="text-sm" data-testid="parent-contract-file" />
                  {extracting && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
                </div>
              </div>
            )}

            {/* Sifarişçi */}
            <div>
              <Label className="text-xs font-semibold text-[#3D4F6F] mb-2 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />2. Sifarişçi məlumatları (köhnə müqavilədən gəlir)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Şirkət adı <span className="text-red-500">*</span></Label>
                  <Input value={form.sifarisci_company} onChange={(e) => setForm({ ...form, sifarisci_company: e.target.value })} className="text-sm" data-testid="sifarisci-company" />
                </div>
                <div>
                  <Label className="text-xs">VÖEN</Label>
                  <Input value={form.sifarisci_voen} onChange={(e) => setForm({ ...form, sifarisci_voen: e.target.value })} className="text-sm font-mono" data-testid="sifarisci-voen" />
                </div>
                <div>
                  <Label className="text-xs">Səlahiyyətli şəxs</Label>
                  <Input value={form.sifarisci_authorized} onChange={(e) => setForm({ ...form, sifarisci_authorized: e.target.value })} className="text-sm" data-testid="sifarisci-authorized" />
                </div>
                <div>
                  <Label className="text-xs">Əsas müqavilə №</Label>
                  <Input value={form.parent_contract_number} onChange={(e) => setForm({ ...form, parent_contract_number: e.target.value })} className="text-sm font-mono" data-testid="parent-number" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Əsas müqavilə tarixi</Label>
                  <Input type="date" value={form.parent_contract_date} onChange={(e) => setForm({ ...form, parent_contract_date: e.target.value })} className="text-sm w-48" data-testid="parent-date" />
                </div>
              </div>
            </div>

            {/* Exhibition — sadəcə stend nömrəsi və yer (sərgi adı və tarixləri
                şablonda statik qalır, hər il yeni şablon yüklənir) */}
            <div>
              <Label className="text-xs font-semibold text-[#3D4F6F] mb-2 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />3. Bu il müqavilə bağlanma tarixi və Stend
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 md:col-span-1">
                  <Label className="text-xs">Bu il müqavilə bağlanma tarixi <span className="text-red-500">*</span></Label>
                  <Input type="date" value={form.addendum_date} onChange={(e) => setForm({ ...form, addendum_date: e.target.value })} className="text-sm" data-testid="addendum-date" />
                  <span className="text-[10px] text-slate-500 mt-1 block">(&laquo;Bakı şəhəri&raquo; sətrində göstərilir)</span>
                </div>
                <div>
                  <Label className="text-xs">Stend №</Label>
                  <Input value={form.stand_number} onChange={(e) => setForm({ ...form, stand_number: e.target.value })} placeholder="məs: 50" className="text-sm font-mono" data-testid="stand-number" />
                </div>
                <div className="grid grid-cols-3 gap-2 col-span-3 md:col-span-1">
                  <div>
                    <Label className="text-xs">En (m)</Label>
                    <Input type="number" step="0.1" min="0" value={form.stand_width || ''} onChange={(e) => setForm({ ...form, stand_width: parseFloat(e.target.value) || 0 })} className="text-sm font-mono" data-testid="stand-width" />
                  </div>
                  <div>
                    <Label className="text-xs">Uzunluq (m)</Label>
                    <Input type="number" step="0.1" min="0" value={form.stand_length || ''} onChange={(e) => setForm({ ...form, stand_length: parseFloat(e.target.value) || 0 })} className="text-sm font-mono" data-testid="stand-length" />
                  </div>
                  <div>
                    <Label className="text-xs">Sahə (m²)</Label>
                    <Input value={((form.stand_width || 0) * (form.stand_length || 0)).toFixed(2)} readOnly tabIndex={-1} className="text-sm font-mono bg-slate-50" data-testid="stand-area" />
                  </div>
                </div>
              </div>
            </div>

            {/* Services — STATIK (Marsol standart paket) */}
            <div>
              <Label className="text-xs font-semibold text-[#3D4F6F] mb-2 block">
                4. Xidmətlər <span className="text-slate-400 font-normal">(standart paket — dəyişdirilə bilməz)</span>
              </Label>
              <div className="border border-slate-200 rounded-lg overflow-hidden" data-testid="services-static-preview">
                <div className="bg-slate-50 px-3 py-2 text-[11px] font-semibold text-[#3D4F6F] border-b border-slate-200">
                  Müqavilədə cədvəl şəklində göstəriləcək xidmətlər
                </div>
                <ol className="divide-y divide-slate-100 text-[12px] text-slate-700">
                  {STANDARD_SERVICES.map((s, i) => (
                    <li key={i} className="flex gap-2 px-3 py-2">
                      <span className="text-slate-400 font-mono w-5 shrink-0">{i + 1}.</span>
                      <span className="leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Pricing */}
            <div>
              <Label className="text-xs font-semibold text-[#3D4F6F] mb-2 flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5" />5. Qiymət
              </Label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div>
                    <Label className="text-xs">Qiymət (ƏDV-siz, AZN)</Label>
                    <Input type="number" min="0" step="0.01" value={form.pricing.price_net}
                      onChange={(e) => setForm({ ...form, pricing: { ...form.pricing, price_net: parseFloat(e.target.value || '0') } })}
                      className="text-sm font-mono" data-testid="price-net" />
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <input type="checkbox" checked={form.pricing.vat_enabled}
                      onChange={(e) => setForm({ ...form, pricing: { ...form.pricing, vat_enabled: e.target.checked } })}
                      className="w-4 h-4 accent-emerald-600" id="vat-toggle" data-testid="vat-toggle" />
                    <Label htmlFor="vat-toggle" className="text-sm cursor-pointer">ƏDV tətbiq et (+18%)</Label>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">ƏDV məbləği</Label>
                    <div className="text-sm font-mono text-slate-700 py-2">{vat.toFixed(2)} AZN</div>
                  </div>
                </div>
                <div className="border-t pt-2 flex justify-between items-center">
                  <Label className="text-sm font-semibold text-[#3D4F6F]">Yekun məbləğ (avtomatik hesablanır):</Label>
                  <div className="text-xl font-bold text-emerald-700" data-testid="total-amount">{total.toFixed(2)} AZN</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => { setShowModal(false); setEditing(null); }}>Ləğv et</Button>
              <Button type="submit" disabled={saving} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="save-addendum-btn">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                {editing ? 'Yenilə və Yüklə' : 'Yarat və Yüklə'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
