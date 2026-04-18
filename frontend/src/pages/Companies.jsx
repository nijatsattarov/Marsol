import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Plus, Search, Download, Loader2, Building2, User, Phone, Mail,
  Eye, Pencil, Trash2, ArrowLeft, Filter, X, CreditCard, Upload, Link, PlusCircle, MinusCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Toaster, toast } from 'sonner';
import * as XLSX from 'xlsx';
import { usePermissions, canEdit } from '../context/PermissionContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CompanyCustomFieldsRenderer = ({ fields, tabName, formData, setFormData }) => {
  const tabFields = fields.filter(cf => cf.sub_tab === tabName);
  if (tabFields.length === 0) return null;
  return (
    <div className="pt-3 mt-3 border-t border-slate-200">
      <p className="text-xs font-semibold text-slate-500 mb-2">Xüsusi sahələr</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tabFields.map(cf => (
          <div key={cf.id}>
            <Label className="text-xs">{cf.field_label || cf.field_name}{cf.required ? ' *' : ''}</Label>
            {cf.field_type === 'select' ? (
              <Select value={formData[cf.field_name]||''} onValueChange={v => setFormData({...formData, [cf.field_name]:v})}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>{cf.options?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            ) : cf.field_type === 'textarea' ? (
              <textarea value={formData[cf.field_name]||''} onChange={e => setFormData({...formData, [cf.field_name]:e.target.value})} className="w-full text-sm border rounded-lg px-3 py-2 min-h-[60px]" />
            ) : (
              <Input type={cf.field_type==='number'||cf.field_type==='amount'?'number':cf.field_type==='date'?'date':cf.field_type==='email'?'email':'text'} value={formData[cf.field_name]||''} onChange={e => setFormData({...formData, [cf.field_name]:e.target.value})} className="text-sm" required={cf.required} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Mobile card
const CompanyCard = ({ company, index, onView, onEdit, onDelete }) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">#{index}</span>
          <h3 className="font-semibold text-[#3D4F6F] truncate">{company.brand_name}</h3>
        </div>
        <p className="text-sm text-slate-500 mt-1">{company.sector}</p>
      </div>
      <Badge className={company.status === 'Aktiv' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}>{company.status}</Badge>
    </div>
    <div className="space-y-1.5 text-sm text-slate-600 mb-3">
      {company.owner_first_name && <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 flex-shrink-0" /><span>{company.owner_first_name} {company.owner_last_name}</span></div>}
      {company.company_phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 flex-shrink-0" /><span>{company.company_phone}</span></div>}
      <div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5 flex-shrink-0" /><span>{company.package}</span></div>
      {(company.debt_amount || 0) > 0 && <div className="flex items-center gap-2 text-red-600"><CreditCard className="w-3.5 h-3.5" /><span>Borc: {company.debt_amount?.toLocaleString()} AZN</span></div>}
    </div>
    <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => onView(company)}><Eye className="w-3.5 h-3.5 mr-1" />Ətraflı bax</Button>
  </div>
);

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [viewingCompany, setViewingCompany] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('basic');
  const [customFields, setCustomFields] = useState([]);
  const [filters, setFilters] = useState({ sector: '', package: '', company_size: '', marsol_representative: '', status: '' });

  const emptyOwner = { first_name: '', last_name: '', father_name: '', position: '', phone: '', email: '', birth_date: '', citizenship: '', education: '', specialty: '', university: '', social_links: [], children: [], desired_activities: [] };
  const emptyContract = { project: '', package: '', start_date: '', end_date: '', join_date: '', total_amount: 0, paid_amount: 0, debt_amount: 0, contract_file: '' };

  const initialFormData = {
    brand_name: '', legal_name: '', voen: '', sector: '', sub_sector: '', company_size: '', employee_count: '', region: '',
    registration_date: '', address: '', company_phone: '', company_website: '',
    reference_source: '', reference_company_id: '', reference_company_name: '', reference_person_name: '', reference_person_surname: '', reference_person_position: '', reference_note: '',
    social_links: [],
    logo_url: '', bank_files: [],
    owners: [{ ...emptyOwner }],
    contact_first_name: '', contact_last_name: '', contact_position: '', contact_phone: '', contact_email: '',
    marsol_representative: '',
    contracts: [{ ...emptyContract }],
    total_amount: 0, paid_amount: 0, debt_amount: 0, payment_due_date: '', status: 'Aktiv'
  };

  const [formData, setFormData] = useState(initialFormData);
  const token = localStorage.getItem('token');
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'companies');
  const headers = { Authorization: `Bearer ${token}` };

  const recalcTotals = (contracts) => {
    const totalAll = contracts.reduce((s, c) => s + (parseFloat(c.total_amount) || 0), 0);
    const paidAll = contracts.reduce((s, c) => s + (parseFloat(c.paid_amount) || 0), 0);
    return { total_amount: totalAll, paid_amount: paidAll, debt_amount: totalAll - paidAll };
  };

  const handlePackageSelect = (pkgName, contractIdx) => {
    const pkg = options?.packages_with_prices?.find(p => p.name === pkgName);
    const price = pkg?.price || 0;
    const newContracts = [...formData.contracts];
    newContracts[contractIdx] = { ...newContracts[contractIdx], package: pkgName, total_amount: price, debt_amount: price - (parseFloat(newContracts[contractIdx].paid_amount) || 0) };
    setFormData({ ...formData, contracts: newContracts, ...recalcTotals(newContracts) });
  };

  const handleProjectSelect = (project, contractIdx) => {
    const newContracts = [...formData.contracts];
    newContracts[contractIdx] = { ...newContracts[contractIdx], project };
    setFormData({ ...formData, contracts: newContracts });
  };

  const fetchCompanies = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v && v !== 'all') params.append(k, v); });
      const res = await axios.get(`${API}/companies?${params}`, { headers });
      setCompanies(res.data);
    } catch { toast.error('Şirkətlər yüklənmədi'); }
    finally { setLoading(false); }
  }, [filters]);

  const [allCompanies, setAllCompanies] = useState([]);

  const fetchOptions = async () => {
    try {
      const [optRes, cfRes, compRes] = await Promise.all([
        axios.get(`${API}/options/all`, { headers }),
        axios.get(`${API}/settings/custom-fields?module=companies`, { headers }),
        axios.get(`${API}/options/companies`, { headers }),
      ]);
      setOptions(optRes.data);
      setCustomFields(cfRes.data);
      setAllCompanies(compRes.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchOptions(); fetchCompanies(); }, [fetchCompanies]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Flatten owner data for backward compatibility
    const payload = { ...formData };
    if (payload.owners?.[0]) {
      payload.owner_first_name = payload.owners[0].first_name;
      payload.owner_last_name = payload.owners[0].last_name;
      payload.owner_name = `${payload.owners[0].first_name} ${payload.owners[0].last_name}`.trim();
      payload.owner_phone = payload.owners[0].phone;
      payload.owner_email = payload.owners[0].email;
    }
    if (payload.contracts?.[0]) {
      payload.joined_project = payload.contracts[0].project;
      payload.package = payload.contracts[0].package;
      payload.contract_start_date = payload.contracts[0].start_date;
      payload.contract_end_date = payload.contracts[0].end_date;
      payload.join_date = payload.contracts[0].join_date;
    }
    try {
      if (editingCompany) {
        await axios.put(`${API}/companies/${editingCompany.id}`, payload, { headers });
        toast.success('Şirkət yeniləndi');
      } else {
        await axios.post(`${API}/companies`, payload, { headers });
        toast.success('Yeni şirkət əlavə edildi');
      }
      setShowAddModal(false); setEditingCompany(null); setFormData(initialFormData); fetchCompanies();
    } catch (err) { toast.error(err.response?.data?.detail || 'Xəta baş verdi'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu şirkəti silmək istədiyinizə əminsiniz?')) return;
    try { await axios.delete(`${API}/companies/${id}`, { headers }); toast.success('Şirkət silindi'); fetchCompanies(); }
    catch { toast.error('Xəta'); }
  };

  const handleEdit = (company) => {
    const data = { ...initialFormData, ...company };
    if (!data.owners || data.owners.length === 0) {
      data.owners = [{ ...emptyOwner, first_name: company.owner_first_name || company.owner_name || '', last_name: company.owner_last_name || '', phone: company.owner_phone || '', email: company.owner_email || '' }];
    }
    if (!data.contracts || data.contracts.length === 0) {
      data.contracts = [{ project: company.joined_project || '', package: company.package || '', start_date: company.contract_start_date || '', end_date: company.contract_end_date || '', join_date: company.join_date || '', total_amount: company.total_amount || 0, paid_amount: company.paid_amount || 0, debt_amount: company.debt_amount || 0, contract_file: '' }];
    }
    if (!data.social_links) data.social_links = [];
    if (!data.bank_files) data.bank_files = [];
    setEditingCompany(company); setFormData(data); setActiveTab('basic'); setShowAddModal(true);
  };

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await axios.post(`${API}/upload`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
      if (field === 'logo_url') setFormData(p => ({ ...p, logo_url: res.data.url }));
      else if (field === 'bank_files') setFormData(p => ({ ...p, bank_files: [...(p.bank_files || []), { url: res.data.url, name: res.data.filename }] }));
      toast.success('Fayl yükləndi');
    } catch { toast.error('Fayl yüklənmədi'); }
  };

  const handleContractFileUpload = async (e, idx) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await axios.post(`${API}/upload`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
      const nc = [...formData.contracts]; nc[idx] = { ...nc[idx], contract_file: res.data.url, contract_file_name: res.data.filename };
      setFormData({ ...formData, contracts: nc });
      toast.success('Fayl yükləndi');
    } catch { toast.error('Fayl yüklənmədi'); }
  };

  const updateOwner = (idx, field, value) => {
    const o = [...formData.owners]; o[idx] = { ...o[idx], [field]: value }; setFormData({ ...formData, owners: o });
  };
  const addOwner = () => setFormData({ ...formData, owners: [...formData.owners, { ...emptyOwner }] });
  const removeOwner = (idx) => { if (formData.owners.length <= 1) return; const o = formData.owners.filter((_, i) => i !== idx); setFormData({ ...formData, owners: o }); };

  const addContract = () => { const nc = [...formData.contracts, { ...emptyContract }]; setFormData({ ...formData, contracts: nc }); };
  const removeContract = (idx) => { if (formData.contracts.length <= 1) return; const c = formData.contracts.filter((_, i) => i !== idx); setFormData({ ...formData, contracts: c, ...recalcTotals(c) }); };

  const addSocialLink = (ownerIdx = null) => {
    if (ownerIdx !== null) {
      const o = [...formData.owners]; o[ownerIdx] = { ...o[ownerIdx], social_links: [...(o[ownerIdx].social_links || []), ''] }; setFormData({ ...formData, owners: o });
    } else {
      setFormData({ ...formData, social_links: [...(formData.social_links || []), ''] });
    }
  };
  const updateSocialLink = (linkIdx, value, ownerIdx = null) => {
    if (ownerIdx !== null) {
      const o = [...formData.owners]; const links = [...(o[ownerIdx].social_links || [])]; links[linkIdx] = value; o[ownerIdx] = { ...o[ownerIdx], social_links: links }; setFormData({ ...formData, owners: o });
    } else {
      const links = [...(formData.social_links || [])]; links[linkIdx] = value; setFormData({ ...formData, social_links: links });
    }
  };
  const removeSocialLink = (linkIdx, ownerIdx = null) => {
    if (ownerIdx !== null) {
      const o = [...formData.owners]; o[ownerIdx] = { ...o[ownerIdx], social_links: (o[ownerIdx].social_links || []).filter((_, i) => i !== linkIdx) }; setFormData({ ...formData, owners: o });
    } else {
      setFormData({ ...formData, social_links: (formData.social_links || []).filter((_, i) => i !== linkIdx) });
    }
  };

  const addChild = (ownerIdx) => {
    const o = [...formData.owners]; o[ownerIdx] = { ...o[ownerIdx], children: [...(o[ownerIdx].children || []), { name: '', surname: '', birth_date: '', gender: '' }] }; setFormData({ ...formData, owners: o });
  };
  const updateChild = (ownerIdx, childIdx, field, value) => {
    const o = [...formData.owners]; const ch = [...(o[ownerIdx].children || [])]; ch[childIdx] = { ...ch[childIdx], [field]: value }; o[ownerIdx] = { ...o[ownerIdx], children: ch }; setFormData({ ...formData, owners: o });
  };
  const removeChild = (ownerIdx, childIdx) => {
    const o = [...formData.owners]; o[ownerIdx] = { ...o[ownerIdx], children: (o[ownerIdx].children || []).filter((_, i) => i !== childIdx) }; setFormData({ ...formData, owners: o });
  };

  const exportToExcel = () => {
    const data = filteredCompanies.map((c, i) => ({
      '№': i + 1,
      'Şirkət adı': c.brand_name || '',
      'Hüquqi ad': c.legal_name || '',
      'Sektor': c.sector || '',
      'Alt sektor': c.sub_sector || '',
      'Paket': c.package || '',
      'Sahibkar': c.owner_name || '',
      'Sahibkar telefon': c.owner_phone || '',
      'Şirkət telefon': c.company_phone || '',
      'E-poçt': c.company_email || '',
      'Kurator': c.marsol_representative || '',
      'Region': c.region || '',
      'Ümumi borc': c.debt_amount || 0,
      'Status': c.status || '',
      'Müqavilə başlama': c.contract_start_date || '',
      'Müqavilə bitmə': c.contract_end_date || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    // Set column widths
    ws['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
      { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 25 },
      { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Şirkətlər');
    XLSX.writeFile(wb, `sirketler_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredCompanies = companies.filter(c => c.brand_name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.sector?.toLowerCase().includes(searchTerm.toLowerCase()));
  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

  // Detail View
  if (viewingCompany) {
    const v = viewingCompany;
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Toaster position="top-right" richColors />
        <Button variant="ghost" onClick={() => setViewingCompany(null)} className="mb-4"><ArrowLeft className="w-4 h-4 mr-2" />Geri</Button>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-4 mb-6">
            {v.logo_url && <img src={v.logo_url} alt="Logo" className="w-14 h-14 rounded-lg object-cover border" />}
            <div>
              <h1 className="text-2xl font-bold text-[#3D4F6F]">{v.brand_name}</h1>
              <p className="text-slate-500">{v.sector}{v.sub_sector ? ` / ${v.sub_sector}` : ''} | {v.package}</p>
            </div>
            <div className="ml-auto flex gap-2">
              <Badge className={v.status === 'Aktiv' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}>{v.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => { setViewingCompany(null); handleEdit(v); }}><Pencil className="w-4 h-4 mr-1" />Redaktə</Button>
            </div>
          </div>
          <Tabs defaultValue="company">
            <TabsList className="flex-wrap gap-1 mb-4">
              <TabsTrigger value="company" className="text-xs">Şirkət</TabsTrigger>
              <TabsTrigger value="owner" className="text-xs">Sahibkar</TabsTrigger>
              <TabsTrigger value="contact" className="text-xs">Əlaqədar şəxs</TabsTrigger>
              <TabsTrigger value="contract" className="text-xs">Müqavilə</TabsTrigger>
              <TabsTrigger value="payment" className="text-xs">Ödəniş</TabsTrigger>
            </TabsList>
            <TabsContent value="company" className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div><p className="text-slate-500 text-xs">Brend adı</p><p className="font-medium">{v.brand_name}</p></div>
              <div><p className="text-slate-500 text-xs">Hüquqi adı</p><p className="font-medium">{v.legal_name || '-'}</p></div>
              <div><p className="text-slate-500 text-xs">VÖEN</p><p className="font-medium">{v.voen || '-'}</p></div>
              <div><p className="text-slate-500 text-xs">Sektor / Alt sektor</p><p className="font-medium">{v.sector}{v.sub_sector ? ` / ${v.sub_sector}` : ''}</p></div>
              <div><p className="text-slate-500 text-xs">Ölçü</p><p className="font-medium">{v.company_size || '-'}</p></div>
              <div><p className="text-slate-500 text-xs">İşçi sayı</p><p className="font-medium">{v.employee_count || '-'}</p></div>
              <div><p className="text-slate-500 text-xs">Region</p><p className="font-medium">{v.region || '-'}</p></div>
              <div><p className="text-slate-500 text-xs">Telefon</p><p className="font-medium">{v.company_phone || '-'}</p></div>
              <div><p className="text-slate-500 text-xs">Ünvan</p><p className="font-medium">{v.address || '-'}</p></div>
            </TabsContent>
            <TabsContent value="owner">
              {(v.owners || [{ first_name: v.owner_first_name || v.owner_name, last_name: v.owner_last_name, phone: v.owner_phone, email: v.owner_email }]).map((o, i) => (
                <div key={i} className="mb-4 p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-semibold text-sm text-[#3D4F6F] mb-3">Sahibkar {i + 1}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div><p className="text-slate-500 text-xs">Ad Soyad</p><p className="font-medium">{o.first_name} {o.last_name}</p></div>
                    <div><p className="text-slate-500 text-xs">Telefon</p><p className="font-medium">{o.phone || '-'}</p></div>
                    <div><p className="text-slate-500 text-xs">Email</p><p className="font-medium">{o.email || '-'}</p></div>
                    <div><p className="text-slate-500 text-xs">Vəzifə</p><p className="font-medium">{o.position || '-'}</p></div>
                    <div><p className="text-slate-500 text-xs">Doğum tarixi</p><p className="font-medium">{o.birth_date || '-'}</p></div>
                    <div><p className="text-slate-500 text-xs">Təhsil</p><p className="font-medium">{o.education || '-'}</p></div>
                  </div>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="contact" className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div><p className="text-slate-500 text-xs">Ad Soyad</p><p className="font-medium">{v.contact_first_name} {v.contact_last_name}</p></div>
              <div><p className="text-slate-500 text-xs">Vəzifə</p><p className="font-medium">{v.contact_position || '-'}</p></div>
              <div><p className="text-slate-500 text-xs">Telefon</p><p className="font-medium">{v.contact_phone || '-'}</p></div>
              <div><p className="text-slate-500 text-xs">Email</p><p className="font-medium">{v.contact_email || '-'}</p></div>
              <div><p className="text-slate-500 text-xs">Kurator</p><p className="font-medium">{v.marsol_representative || '-'}</p></div>
            </TabsContent>
            <TabsContent value="contract">
              {(v.contracts || [{ project: v.joined_project, package: v.package, start_date: v.contract_start_date, end_date: v.contract_end_date }]).map((c, i) => (
                <div key={i} className="mb-3 p-4 bg-slate-50 rounded-lg grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div><p className="text-slate-500 text-xs">Layihə</p><p className="font-medium">{c.project || '-'}</p></div>
                  <div><p className="text-slate-500 text-xs">Paket</p><p className="font-medium">{c.package || '-'}</p></div>
                  <div><p className="text-slate-500 text-xs">Məbləğ</p><p className="font-medium">{(c.total_amount || 0).toLocaleString()} AZN</p></div>
                  <div><p className="text-slate-500 text-xs">Başlama</p><p className="font-medium">{c.start_date || '-'}</p></div>
                  <div><p className="text-slate-500 text-xs">Bitmə</p><p className="font-medium">{c.end_date || '-'}</p></div>
                  <div><p className="text-slate-500 text-xs">Qoşulma</p><p className="font-medium">{c.join_date || '-'}</p></div>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="payment" className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div><p className="text-slate-500 text-xs">Ümumi</p><p className="font-medium">{(v.total_amount || 0).toLocaleString()} AZN</p></div>
              <div><p className="text-slate-500 text-xs">Ödənilib</p><p className="font-medium text-green-600">{(v.paid_amount || 0).toLocaleString()} AZN</p></div>
              <div><p className="text-slate-500 text-xs">Borc</p><p className="font-bold text-red-600">{(v.debt_amount || 0).toLocaleString()} AZN</p></div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="companies-page">
      <Toaster position="top-right" richColors />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div><h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Şirkət Məlumatları</h1><p className="text-slate-500 text-sm mt-1">Şirkətlərin idarə edilməsi</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToExcel}><Download className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Excel</span></Button>
          <Button onClick={() => { setEditingCompany(null); setFormData(initialFormData); setActiveTab('basic'); setShowAddModal(true); }} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" size="sm" data-testid="add-company-btn"><Plus className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Yeni Şirkət</span></Button>
        </div>
      </div>
      {/* Search & Filter */}
      <div className="bg-white rounded-xl shadow-sm border p-3 mb-4">
        <div className="flex gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Axtar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" /></div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className={activeFilterCount ? 'border-[#9ACD32]' : ''}><Filter className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Filtrlər</span>{activeFilterCount > 0 && <Badge className="ml-1 bg-[#9ACD32] text-[#3D4F6F] text-xs">{activeFilterCount}</Badge>}</Button>
        </div>
        {showFilters && options && (
          <div className="mt-3 pt-3 border-t grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Select value={filters.sector} onValueChange={v => setFilters({...filters, sector: v})}><SelectTrigger className="text-sm"><SelectValue placeholder="Sektor" /></SelectTrigger><SelectContent><SelectItem value="all">Hamısı</SelectItem>{options.sectors?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={filters.package} onValueChange={v => setFilters({...filters, package: v})}><SelectTrigger className="text-sm"><SelectValue placeholder="Paket" /></SelectTrigger><SelectContent><SelectItem value="all">Hamısı</SelectItem>{options.packages?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={filters.marsol_representative} onValueChange={v => setFilters({...filters, marsol_representative: v})}><SelectTrigger className="text-sm"><SelectValue placeholder="Kurator" /></SelectTrigger><SelectContent><SelectItem value="all">Hamısı</SelectItem>{options.marsol_representatives?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={filters.status} onValueChange={v => setFilters({...filters, status: v})}><SelectTrigger className="text-sm"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Hamısı</SelectItem>{options.statuses?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            {activeFilterCount > 0 && <Button variant="ghost" size="sm" onClick={() => setFilters({ sector:'',package:'',company_size:'',marsol_representative:'',status:'' })} className="text-xs"><X className="w-3 h-3 mr-1" />Təmizlə</Button>}
          </div>
        )}
      </div>
      {/* Mobile cards */}
      <div className="sm:hidden grid grid-cols-1 gap-3 mb-4">{filteredCompanies.map((c, i) => <CompanyCard key={c.id} company={c} index={i+1} onView={v => setViewingCompany(v)} onEdit={handleEdit} onDelete={handleDelete} />)}</div>
      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="companies-table">
            <thead><tr className="bg-slate-50 border-b">
              {['ID','Şirkət','Sektor','Paket','Sahibkar','Telefon','Kurator','Borc','Status','Əməliyyat'].map(h => <th key={h} className={`text-left px-3 py-3 text-xs font-semibold text-[#3D4F6F] ${h==='Əməliyyat'?'text-right':''} ${h==='ID'?'w-12':''}`}>{h}</th>)}
            </tr></thead>
            <tbody>{filteredCompanies.length === 0 ? <tr><td colSpan={10} className="text-center py-12 text-slate-400">Şirkət tapılmadı</td></tr> :
              filteredCompanies.map((c, i) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-3 py-3 text-sm font-mono text-slate-500">{i+1}</td>
                  <td className="px-3 py-3"><p className="font-medium text-sm text-[#3D4F6F]">{c.brand_name}</p>{c.legal_name && <p className="text-xs text-slate-400">{c.legal_name}</p>}</td>
                  <td className="px-3 py-3 text-sm text-slate-600">{c.sector}</td>
                  <td className="px-3 py-3"><Badge className="bg-[#3D4F6F] text-white text-xs">{c.package}</Badge></td>
                  <td className="px-3 py-3 text-sm">{c.owner_name || `${c.owner_first_name || ''} ${c.owner_last_name || ''}`.trim()}</td>
                  <td className="px-3 py-3 text-sm text-slate-600">{c.company_phone}</td>
                  <td className="px-3 py-3 text-sm text-slate-600">{c.marsol_representative}</td>
                  <td className="px-3 py-3"><span className={`text-sm font-bold ${(c.debt_amount||0)>0?'text-red-600':'text-green-600'}`}>{(c.debt_amount||0).toLocaleString()}</span></td>
                  <td className="px-3 py-3"><Badge className={c.status==='Aktiv'?'bg-green-100 text-green-700':'bg-slate-100 text-slate-600'}>{c.status}</Badge></td>
                  <td className="px-3 py-3 text-right"><div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setViewingCompany(c)}><Eye className="w-4 h-4 text-slate-500" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(c)}><Pencil className="w-4 h-4 text-slate-500" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div></td>
                </tr>
              ))
            }</tbody>
          </table>
        </div>
      </div>

      {/* ADD/EDIT MODAL */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}><DialogContent className="max-w-3xl p-0"><DialogHeader className="p-4 pb-0"><DialogTitle style={{color:'#3D4F6F'}}>{editingCompany ? 'Şirkəti redaktə et' : 'Yeni şirkət əlavə et'}</DialogTitle></DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-100px)]"><form onSubmit={handleSubmit} className="p-4 pt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto gap-1 mb-4">
              <TabsTrigger value="basic" className="text-xs">Şirkət</TabsTrigger>
              <TabsTrigger value="owner" className="text-xs">Sahibkar</TabsTrigger>
              <TabsTrigger value="rep" className="text-xs">Əlaqədar şəxs</TabsTrigger>
              <TabsTrigger value="contract" className="text-xs">Müqavilə</TabsTrigger>
              <TabsTrigger value="payment" className="text-xs">Ödəniş</TabsTrigger>
            </TabsList>

            {/* ŞIRKƏT TAB */}
            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label className="text-xs">Brend adı *</Label><Input value={formData.brand_name} onChange={e => setFormData({...formData, brand_name: e.target.value})} required className="text-sm" data-testid="company-brand-input" /></div>
                <div><Label className="text-xs">Hüquqi adı</Label><Input value={formData.legal_name} onChange={e => setFormData({...formData, legal_name: e.target.value})} className="text-sm" /></div>
                <div><Label className="text-xs">VÖEN</Label><Input value={formData.voen} onChange={e => setFormData({...formData, voen: e.target.value})} className="text-sm" data-testid="company-voen-input" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label className="text-xs">Sektor *</Label>
                  <Select value={formData.sector} onValueChange={v => setFormData({...formData, sector: v, sub_sector: ''})}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>{options?.sectors?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Alt sektor</Label>
                  <Select value={formData.sub_sector} onValueChange={v => setFormData({...formData, sub_sector: v})} disabled={!formData.sector}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>
                      {(options?.sub_sectors?.[formData.sector] || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      {!(options?.sub_sectors?.[formData.sector]?.length) && <SelectItem value="none" disabled>Alt sektor yoxdur</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Ölçü</Label>
                  <Select value={formData.company_size} onValueChange={v => setFormData({...formData, company_size: v})}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>{options?.company_sizes?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label className="text-xs">İşçi sayı</Label><Input type="number" value={formData.employee_count} onChange={e => setFormData({...formData, employee_count: e.target.value})} className="text-sm" /></div>
                <div><Label className="text-xs">Region</Label>
                  <Select value={formData.region} onValueChange={v => setFormData({...formData, region: v})}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>{options?.regions?.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Qeydiyyat tarixi</Label><Input type="date" value={formData.registration_date} onChange={e => setFormData({...formData, registration_date: e.target.value})} className="text-sm" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label className="text-xs">Ünvan</Label><Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="text-sm" /></div>
                <div><Label className="text-xs">Telefon</Label><Input value={formData.company_phone} onChange={e => setFormData({...formData, company_phone: e.target.value})} className="text-sm" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label className="text-xs">Veb sayt</Label><Input value={formData.company_website} onChange={e => setFormData({...formData, company_website: e.target.value})} className="text-sm" /></div>
                <div><Label className="text-xs">Referans mənbəsi</Label>
                  <Select value={formData.reference_source} onValueChange={v => setFormData({...formData, reference_source: v, reference_company_id: '', reference_company_name: '', reference_person_name: '', reference_person_surname: '', reference_person_position: '', reference_note: ''})}>
                    <SelectTrigger className="text-sm" data-testid="reference-source-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>{options?.reference_sources?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {/* Referans detalları */}
              {formData.reference_source === 'Şirkət' && (
                <div className="p-3 bg-blue-50 rounded-lg space-y-3">
                  <Label className="text-xs font-semibold text-[#3D4F6F]">Referans şirkət məlumatları</Label>
                  <div><Label className="text-xs">Referans şirkət</Label>
                    <Select value={formData.reference_company_id} onValueChange={v => {
                      const comp = allCompanies.find(c => c.id === v);
                      setFormData({...formData, reference_company_id: v, reference_company_name: comp?.brand_name || ''});
                    }}>
                      <SelectTrigger className="text-sm" data-testid="reference-company-select"><SelectValue placeholder="Şirkət seçin" /></SelectTrigger>
                      <SelectContent>{allCompanies.map(c => <SelectItem key={c.id} value={c.id}>{c.brand_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Nümayəndə adı</Label><Input value={formData.reference_person_name} onChange={e => setFormData({...formData, reference_person_name: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">Nümayəndə soyadı</Label><Input value={formData.reference_person_surname} onChange={e => setFormData({...formData, reference_person_surname: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">Nümayəndə vəzifəsi</Label><Input value={formData.reference_person_position} onChange={e => setFormData({...formData, reference_person_position: e.target.value})} className="text-sm" /></div>
                  </div>
                </div>
              )}
              {formData.reference_source === 'Şəxs' && (
                <div className="p-3 bg-green-50 rounded-lg space-y-3">
                  <Label className="text-xs font-semibold text-[#3D4F6F]">Referans şəxs məlumatları</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Ad</Label><Input value={formData.reference_person_name} onChange={e => setFormData({...formData, reference_person_name: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">Soyad</Label><Input value={formData.reference_person_surname} onChange={e => setFormData({...formData, reference_person_surname: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">Vəzifə</Label><Input value={formData.reference_person_position} onChange={e => setFormData({...formData, reference_person_position: e.target.value})} className="text-sm" /></div>
                  </div>
                </div>
              )}
              {(formData.reference_source === 'Media' || formData.reference_source === 'Digər') && formData.reference_source && (
                <div><Label className="text-xs">Referans qeydi</Label><Input value={formData.reference_note} onChange={e => setFormData({...formData, reference_note: e.target.value})} className="text-sm" placeholder="Qeyd..." /></div>
              )}
              {/* Sosial media linkleri */}
              <div>
                <div className="flex items-center justify-between"><Label className="text-xs">Sosial media</Label><Button type="button" variant="ghost" size="sm" onClick={() => addSocialLink()} className="text-xs h-6"><PlusCircle className="w-3 h-3 mr-1" />Əlavə et</Button></div>
                {(formData.social_links || []).map((link, i) => (
                  <div key={i} className="flex gap-2 mt-1"><Input value={link} onChange={e => updateSocialLink(i, e.target.value)} className="text-sm" placeholder="https://" /><Button type="button" variant="ghost" size="sm" onClick={() => removeSocialLink(i)} className="text-red-500 h-9"><MinusCircle className="w-4 h-4" /></Button></div>
                ))}
              </div>
              {/* Logo & Fayllar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Logo</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {formData.logo_url && <img src={formData.logo_url} alt="logo" className="w-10 h-10 rounded border object-cover" />}
                    <label className="flex items-center gap-1 px-3 py-2 bg-slate-50 border rounded-lg cursor-pointer hover:bg-slate-100 text-xs"><Upload className="w-3.5 h-3.5" />Logo yüklə<input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'logo_url')} /></label>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Bank rekvizitləri (fayl)</Label>
                  <label className="flex items-center gap-1 px-3 py-2 bg-slate-50 border rounded-lg cursor-pointer hover:bg-slate-100 text-xs mt-1"><Upload className="w-3.5 h-3.5" />Fayl yüklə<input type="file" className="hidden" onChange={e => handleFileUpload(e, 'bank_files')} /></label>
                  {(formData.bank_files || []).map((f, i) => <p key={i} className="text-xs text-slate-500 mt-1">{f.name}</p>)}
                </div>
              </div>
              <CompanyCustomFieldsRenderer fields={customFields} tabName="company" formData={formData} setFormData={setFormData} />
            </TabsContent>

            {/* SAHİBKAR TAB */}
            <TabsContent value="owner" className="space-y-4">
              {formData.owners.map((owner, oi) => (
                <div key={oi} className="p-4 bg-slate-50 rounded-lg space-y-3 relative">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-sm text-[#3D4F6F]">Sahibkar {oi + 1}</h4>
                    {formData.owners.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => removeOwner(oi)} className="text-red-500 h-6 text-xs"><MinusCircle className="w-3 h-3 mr-1" />Sil</Button>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Ad *</Label><Input value={owner.first_name} onChange={e => updateOwner(oi,'first_name',e.target.value)} className="text-sm" /></div>
                    <div><Label className="text-xs">Soyad *</Label><Input value={owner.last_name} onChange={e => updateOwner(oi,'last_name',e.target.value)} className="text-sm" /></div>
                    <div><Label className="text-xs">Ata adı</Label><Input value={owner.father_name} onChange={e => updateOwner(oi,'father_name',e.target.value)} className="text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Vəzifə</Label>
                      <Select value={owner.position} onValueChange={v => updateOwner(oi,'position',v)}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{options?.positions?.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Telefon</Label><Input value={owner.phone} onChange={e => updateOwner(oi,'phone',e.target.value)} className="text-sm" /></div>
                    <div><Label className="text-xs">Email</Label><Input type="email" value={owner.email} onChange={e => updateOwner(oi,'email',e.target.value)} className="text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Doğum tarixi</Label><Input type="date" value={owner.birth_date} onChange={e => updateOwner(oi,'birth_date',e.target.value)} className="text-sm" /></div>
                    <div><Label className="text-xs">Vətəndaşlığı</Label><Input value={owner.citizenship} onChange={e => updateOwner(oi,'citizenship',e.target.value)} className="text-sm" /></div>
                    <div><Label className="text-xs">Təhsil</Label>
                      <Select value={owner.education} onValueChange={v => updateOwner(oi,'education',v)}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{options?.education_levels?.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">İxtisas</Label><Input value={owner.specialty} onChange={e => updateOwner(oi,'specialty',e.target.value)} className="text-sm" /></div>
                    <div><Label className="text-xs">Məzun olduğu müəssisə</Label><Input value={owner.university} onChange={e => updateOwner(oi,'university',e.target.value)} className="text-sm" /></div>
                  </div>
                  {/* Fəaliyyətlər */}
                  <div><Label className="text-xs">Qatılmaq istədiyi fəaliyyətlər</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {options?.activities?.map(act => {
                        const selected = (owner.desired_activities || []).includes(act);
                        return <button key={act} type="button" onClick={() => {
                          const acts = selected ? (owner.desired_activities || []).filter(a => a !== act) : [...(owner.desired_activities || []), act];
                          updateOwner(oi, 'desired_activities', acts);
                        }} className={`px-2 py-1 rounded-full text-xs border transition-colors ${selected ? 'bg-[#3D4F6F] text-white border-[#3D4F6F]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#3D4F6F]'}`}>{act}</button>;
                      })}
                    </div>
                  </div>
                  {/* Sosial media */}
                  <div>
                    <div className="flex items-center justify-between"><Label className="text-xs">Sosial media</Label><Button type="button" variant="ghost" size="sm" onClick={() => addSocialLink(oi)} className="text-xs h-6"><PlusCircle className="w-3 h-3 mr-1" />Əlavə et</Button></div>
                    {(owner.social_links || []).map((link, li) => (
                      <div key={li} className="flex gap-2 mt-1"><Input value={link} onChange={e => updateSocialLink(li, e.target.value, oi)} className="text-sm" placeholder="https://" /><Button type="button" variant="ghost" size="sm" onClick={() => removeSocialLink(li, oi)} className="text-red-500 h-9"><MinusCircle className="w-4 h-4" /></Button></div>
                    ))}
                  </div>
                  {/* Övladlar */}
                  <div>
                    <div className="flex items-center justify-between"><Label className="text-xs">Övladlar</Label><Button type="button" variant="ghost" size="sm" onClick={() => addChild(oi)} className="text-xs h-6"><PlusCircle className="w-3 h-3 mr-1" />Övlad əlavə et</Button></div>
                    {(owner.children || []).map((child, ci) => (
                      <div key={ci} className="flex gap-2 mt-2 items-end">
                        <div className="flex-1"><Label className="text-[10px]">Ad</Label><Input value={child.name} onChange={e => updateChild(oi,ci,'name',e.target.value)} className="text-sm" /></div>
                        <div className="flex-1"><Label className="text-[10px]">Soyad</Label><Input value={child.surname} onChange={e => updateChild(oi,ci,'surname',e.target.value)} className="text-sm" /></div>
                        <div className="w-32"><Label className="text-[10px]">Doğum tarixi</Label><Input type="date" value={child.birth_date} onChange={e => updateChild(oi,ci,'birth_date',e.target.value)} className="text-sm" /></div>
                        <div className="w-24"><Label className="text-[10px]">Cinsi</Label>
                          <Select value={child.gender} onValueChange={v => updateChild(oi,ci,'gender',v)}>
                            <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Seç" /></SelectTrigger>
                            <SelectContent><SelectItem value="Oğlan">Oğlan</SelectItem><SelectItem value="Qız">Qız</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeChild(oi, ci)} className="text-red-500 h-9"><MinusCircle className="w-4 h-4" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addOwner} className="w-full text-xs"><PlusCircle className="w-4 h-4 mr-1" />Sahibkar əlavə et</Button>
              <CompanyCustomFieldsRenderer fields={customFields} tabName="owner" formData={formData} setFormData={setFormData} />
            </TabsContent>

            {/* ƏLAQƏDAR ŞƏXS TAB */}
            <TabsContent value="rep" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label className="text-xs">Ad</Label><Input value={formData.contact_first_name} onChange={e => setFormData({...formData, contact_first_name: e.target.value})} className="text-sm" /></div>
                <div><Label className="text-xs">Soyad</Label><Input value={formData.contact_last_name} onChange={e => setFormData({...formData, contact_last_name: e.target.value})} className="text-sm" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label className="text-xs">Vəzifə</Label>
                  <Select value={formData.contact_position} onValueChange={v => setFormData({...formData, contact_position: v})}>
                    <SelectTrigger className="text-sm" data-testid="contact-position-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>{options?.positions?.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Telefon</Label><Input value={formData.contact_phone} onChange={e => setFormData({...formData, contact_phone: e.target.value})} className="text-sm" /></div>
                <div><Label className="text-xs">Email</Label><Input type="email" value={formData.contact_email} onChange={e => setFormData({...formData, contact_email: e.target.value})} className="text-sm" /></div>
              </div>
              <CompanyCustomFieldsRenderer fields={customFields} tabName="contact" formData={formData} setFormData={setFormData} />
            </TabsContent>

            {/* MÜQAVİLƏ TAB */}
            <TabsContent value="contract" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div><Label className="text-xs">Kurator *</Label>
                  <Select value={formData.marsol_representative} onValueChange={v => setFormData({...formData, marsol_representative: v})}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>{options?.marsol_representatives?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {formData.contracts.map((ct, ci) => (
                <div key={ci} className="p-4 bg-slate-50 rounded-lg space-y-3 relative">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-sm text-[#3D4F6F]">Müqavilə {ci + 1}</h4>
                    {formData.contracts.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => removeContract(ci)} className="text-red-500 h-6 text-xs"><MinusCircle className="w-3 h-3 mr-1" />Sil</Button>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Layihə</Label>
                      <Select value={ct.project} onValueChange={v => handleProjectSelect(v, ci)}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{options?.projects?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Paket</Label>
                      <Select value={ct.package} onValueChange={v => handlePackageSelect(v, ci)}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{options?.packages?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Ümumi məbləğ (AZN)</Label>
                      <Input type="number" value={ct.total_amount} className="text-sm bg-white" readOnly />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Qoşulma tarixi</Label><Input type="date" value={ct.join_date} onChange={e => { const nc=[...formData.contracts]; nc[ci]={...nc[ci], join_date: e.target.value}; setFormData({...formData, contracts: nc}); }} className="text-sm" /></div>
                    <div><Label className="text-xs">Başlama tarixi</Label><Input type="date" value={ct.start_date} onChange={e => { const nc=[...formData.contracts]; nc[ci]={...nc[ci], start_date: e.target.value}; setFormData({...formData, contracts: nc}); }} className="text-sm" /></div>
                    <div><Label className="text-xs">Bitmə tarixi</Label><Input type="date" value={ct.end_date} onChange={e => { const nc=[...formData.contracts]; nc[ci]={...nc[ci], end_date: e.target.value}; setFormData({...formData, contracts: nc}); }} className="text-sm" /></div>
                  </div>
                  <div>
                    <Label className="text-xs">Müqavilə skanı</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <label className="flex items-center gap-1 px-3 py-2 bg-white border rounded-lg cursor-pointer hover:bg-slate-100 text-xs"><Upload className="w-3.5 h-3.5" />Fayl yüklə<input type="file" className="hidden" onChange={e => handleContractFileUpload(e, ci)} /></label>
                      {ct.contract_file && <span className="text-xs text-green-600">{ct.contract_file_name || 'Yükləndi'}</span>}
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addContract} className="w-full text-xs"><PlusCircle className="w-4 h-4 mr-1" />Müqavilə əlavə et</Button>
              <CompanyCustomFieldsRenderer fields={customFields} tabName="contract" formData={formData} setFormData={setFormData} />
            </TabsContent>

            {/* ÖDƏNİŞ TAB */}
            <TabsContent value="payment" className="space-y-4">
              {formData.contracts.map((ct, ci) => (
                <div key={ci} className="p-4 bg-slate-50 rounded-lg space-y-3">
                  <h4 className="font-semibold text-sm text-[#3D4F6F]">Müqavilə {ci + 1}{ct.package ? ` — ${ct.package}` : ''}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Ümumi məbləğ (AZN)</Label><Input type="number" value={ct.total_amount} onChange={e => { const nc=[...formData.contracts]; const t=parseFloat(e.target.value)||0; nc[ci]={...nc[ci], total_amount:t, debt_amount:t-(parseFloat(nc[ci].paid_amount)||0)}; setFormData({...formData, contracts:nc, ...recalcTotals(nc)}); }} className="text-sm" data-testid={`payment-total-${ci}`} /></div>
                    <div><Label className="text-xs">Ödənilən (AZN)</Label><Input type="number" value={ct.paid_amount} onChange={e => { const nc=[...formData.contracts]; const p=parseFloat(e.target.value)||0; nc[ci]={...nc[ci], paid_amount:p, debt_amount:(parseFloat(nc[ci].total_amount)||0)-p}; setFormData({...formData, contracts:nc, ...recalcTotals(nc)}); }} className="text-sm" data-testid={`payment-paid-${ci}`} /></div>
                    <div><Label className="text-xs">Qalıq borc (AZN)</Label><Input type="number" value={(parseFloat(ct.total_amount)||0) - (parseFloat(ct.paid_amount)||0)} className="text-sm bg-white" readOnly /><p className={`text-xs mt-1 font-semibold ${((parseFloat(ct.total_amount)||0)-(parseFloat(ct.paid_amount)||0))>0?'text-red-600':'text-green-600'}`}>{((parseFloat(ct.total_amount)||0)-(parseFloat(ct.paid_amount)||0)).toLocaleString()} AZN</p></div>
                  </div>
                </div>
              ))}
              {/* Ümumi cəm */}
              <div className="p-4 bg-[#3D4F6F] rounded-lg text-white">
                <h4 className="font-semibold text-sm mb-3">Ümumi yekun</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div><p className="text-xs text-slate-300">Ümumi</p><p className="text-lg font-bold">{(formData.total_amount||0).toLocaleString()} AZN</p></div>
                  <div><p className="text-xs text-slate-300">Ödənilib</p><p className="text-lg font-bold text-green-400">{(formData.paid_amount||0).toLocaleString()} AZN</p></div>
                  <div><p className="text-xs text-slate-300">Borc</p><p className="text-lg font-bold text-red-400">{(formData.debt_amount||0).toLocaleString()} AZN</p></div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label className="text-xs">Ödəniş son tarixi</Label><Input type="date" value={formData.payment_due_date} onChange={e => setFormData({...formData, payment_due_date: e.target.value})} className="text-sm" /></div>
                <div><Label className="text-xs">Status</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{options?.statuses?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <CompanyCustomFieldsRenderer fields={customFields} tabName="payment" formData={formData} setFormData={setFormData} />
            </TabsContent>
          </Tabs>
          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Ləğv et</Button>
            <Button type="submit" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold">{editingCompany ? 'Yadda saxla' : 'Əlavə et'}</Button>
          </div>
        </form></ScrollArea>
      </DialogContent></Dialog>
    </div>
  );
}
