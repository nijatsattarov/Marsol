import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Settings as SettingsIcon, Package, FolderKanban, Users, Columns3,
  Plus, Pencil, Trash2, Loader2, Shield, Eye, UserCog, User,
  ChevronDown, Search, X, Building2, Layers, Briefcase, Activity, Building,
  Calendar, Target, TrendingUp, Image as ImageIcon, Upload
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Toaster, toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MODULES = [
  { value: 'companies', label: 'Şirkət Məlumatları' },
  { value: 'hr', label: 'İnsan Resurları' },
  { value: 'finance', label: 'Maliyyə' },
  { value: 'sales', label: 'Satış' },
  { value: 'meetings', label: 'Görüşlər' },
  { value: 'tasks', label: 'Tapşırıqlar' },
  { value: 'projects', label: 'Layihələr' },
  { value: 'marketing', label: 'Marketinq' },
];

const MODULE_TABS = {
  companies: [
    { value: 'company', label: 'Şirkət' },
    { value: 'owner', label: 'Sahibkar' },
    { value: 'contact', label: 'Əlaqədar şəxs' },
    { value: 'contract', label: 'Müqavilə' },
    { value: 'payment', label: 'Ödəniş' },
  ],
  hr: [
    { value: 'personal', label: 'Şəxsi' },
    { value: 'education', label: 'Təhsil' },
    { value: 'experience', label: 'İş təcrübəsi' },
    { value: 'contact', label: 'Əlaqə' },
    { value: 'contract', label: 'Müqavilə' },
    { value: 'salary', label: 'Əmək haqqı' },
    { value: 'documents', label: 'Sənədlər' },
  ],
  finance: [{ value: 'general', label: 'Ümumi' }],
  sales: [{ value: 'general', label: 'Ümumi' }],
  meetings: [{ value: 'general', label: 'Ümumi' }],
  tasks: [{ value: 'general', label: 'Ümumi' }],
  projects: [{ value: 'general', label: 'Ümumi' }],
  marketing: [{ value: 'general', label: 'Ümumi' }],
};

const FIELD_TYPES = [
  { value: 'text', label: 'Mətn' },
  { value: 'number', label: 'Rəqəm' },
  { value: 'amount', label: 'Məbləğ (AZN)' },
  { value: 'date', label: 'Tarix' },
  { value: 'select', label: 'Seçim (dropdown)' },
  { value: 'textarea', label: 'Uzun mətn' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefon' },
];

const ROLES = [
  { value: 'admin', label: 'Admin', icon: Shield, color: 'bg-red-100 text-red-700' },
  { value: 'manager', label: 'Menecer', icon: UserCog, color: 'bg-blue-100 text-blue-700' },
  { value: 'user', label: 'İstifadəçi', icon: User, color: 'bg-green-100 text-green-700' },
  { value: 'viewer', label: 'Baxıcı', icon: Eye, color: 'bg-slate-100 text-slate-700' },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('packages');
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState([]);
  const [projects, setProjects] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [users, setUsers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [subSectors, setSubSectors] = useState([]);
  const [positions, setPositions] = useState([]);
  const [activities, setActivities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [marsolCompanies, setMarsolCompanies] = useState([]);
  const [meetingTypes, setMeetingTypes] = useState([]);
  const [newMeetingType, setNewMeetingType] = useState('');
  const [leadSources, setLeadSources] = useState([]);
  const [newLeadSource, setNewLeadSource] = useState('');
  const [saleTypes, setSaleTypes] = useState([]);
  const [newSaleType, setNewSaleType] = useState('');
  const [warningDays, setWarningDays] = useState('10');
  const [roles, setRoles] = useState([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', permissions: {} });
  const [forumFields, setForumFields] = useState([]);
  const [forumEnabled, setForumEnabled] = useState([]);
  const [forumDescription, setForumDescription] = useState('Zəhmət olmasa şirkət məlumatlarını doldurun');
  const [branding, setBranding] = useState({ sidebar_logo_url: '', main_logo_url: '' });
  const [brandingUploading, setBrandingUploading] = useState({ sidebar: false, main: false });

  // Forms
  const [packageForm, setPackageForm] = useState({ name: '', description: '', price: 0, invitation_count: 0 });
  const [projectForm, setProjectForm] = useState({ name: '' });
  const [fieldForm, setFieldForm] = useState({ module: '', sub_tab: '', field_name: '', field_label: '', field_type: 'text', options: '', required: false });
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'user', department: '', phone: '', status: 'Aktiv' });
  const [sectorForm, setSectorForm] = useState({ name: '' });
  const [subSectorForm, setSubSectorForm] = useState({ name: '', sector: '' });
  const [positionForm, setPositionForm] = useState({ name: '' });
  const [activityForm, setActivityForm] = useState({ name: '' });
  const [regionForm, setRegionForm] = useState({ name: '' });
  const [marsolCompanyForm, setMarsolCompanyForm] = useState({ name: '' });

  // Edit states
  const [editingPackage, setEditingPackage] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editingSector, setEditingSector] = useState(null);
  const [editingSubSector, setEditingSubSector] = useState(null);
  const [editingPosition, setEditingPosition] = useState(null);
  const [editingActivity, setEditingActivity] = useState(null);

  // Modal states
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);

  // Filter
  const [fieldModuleFilter, setFieldModuleFilter] = useState('all');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [pkgRes, prjRes, cfRes, usrRes, secRes, subSecRes, posRes, actRes, regRes, mcRes, mtRes, lsRes, stRes, wdRes, rolesRes, ffRes] = await Promise.all([
        axios.get(`${API}/settings/packages`, { headers }),
        axios.get(`${API}/settings/projects`, { headers }),
        axios.get(`${API}/settings/custom-fields`, { headers }),
        axios.get(`${API}/settings/users`, { headers }),
        axios.get(`${API}/settings/sectors`, { headers }),
        axios.get(`${API}/settings/sub-sectors`, { headers }),
        axios.get(`${API}/settings/positions`, { headers }),
        axios.get(`${API}/settings/activities`, { headers }),
        axios.get(`${API}/settings/regions`, { headers }),
        axios.get(`${API}/settings/marsol-companies`, { headers }),
        axios.get(`${API}/settings/lists/meeting_types`, { headers }),
        axios.get(`${API}/settings/lists/lead_sources`, { headers }),
        axios.get(`${API}/settings/lists/sale_types`, { headers }),
        axios.get(`${API}/settings/lists/membership_warning_days`, { headers }),
        axios.get(`${API}/roles`, { headers }),
        axios.get(`${API}/forum/fields`, { headers }),
      ]);
      setPackages(pkgRes.data);
      setProjects(prjRes.data);
      setCustomFields(cfRes.data);
      setUsers(usrRes.data);
      setSectors(secRes.data);
      setSubSectors(subSecRes.data);
      setPositions(posRes.data);
      setActivities(actRes.data);
      setRegions(regRes.data);
      setMarsolCompanies(mcRes.data);
      setMeetingTypes(mtRes.data || []);
      setLeadSources(lsRes.data || []);
      setSaleTypes(stRes.data || []);
      setWarningDays((wdRes.data && wdRes.data[0]) || '10');
      setRoles(rolesRes.data || []);
      setForumFields(ffRes.data.fields || []);
      setForumEnabled(ffRes.data.enabled || []);
      try { const descRes = await axios.get(`${API}/settings/lists/forum_description`, { headers }); setForumDescription((descRes.data && descRes.data[0]) || 'Zəhmət olmasa şirkət məlumatlarını doldurun'); } catch {}
      try { const brRes = await axios.get(`${API}/settings/branding`, { headers }); setBranding(brRes.data); } catch {}
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ========= PACKAGE CRUD =========
  const handlePackageSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPackage) {
        await axios.put(`${API}/settings/packages/${editingPackage.id}`, packageForm, { headers });
        toast.success('Paket yeniləndi');
      } else {
        await axios.post(`${API}/settings/packages`, packageForm, { headers });
        toast.success('Paket əlavə edildi');
      }
      setEditingPackage(null);
      setPackageForm({ name: '', description: '', price: 0, invitation_count: 0 });
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDeletePackage = async (id) => {
    if (!window.confirm('Bu paketi silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/settings/packages/${id}`, { headers });
      toast.success('Paket silindi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  // ========= PROJECT CRUD =========
  const handleProjectSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProject) {
        await axios.put(`${API}/settings/projects/${editingProject.id}`, projectForm, { headers });
        toast.success('Layihə yeniləndi');
      } else {
        await axios.post(`${API}/settings/projects`, projectForm, { headers });
        toast.success('Layihə əlavə edildi');
      }
      setEditingProject(null);
      setProjectForm({ name: '' });
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm('Bu layihəni silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/settings/projects/${id}`, { headers });
      toast.success('Layihə silindi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  // ========= SECTOR CRUD =========
  const handleSectorSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSector) {
        await axios.put(`${API}/settings/sectors/${editingSector.id}`, sectorForm, { headers });
        toast.success('Sektor yeniləndi');
      } else {
        await axios.post(`${API}/settings/sectors`, sectorForm, { headers });
        toast.success('Sektor əlavə edildi');
      }
      setEditingSector(null);
      setSectorForm({ name: '' });
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDeleteSector = async (id) => {
    if (!window.confirm('Bu sektoru silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/settings/sectors/${id}`, { headers });
      toast.success('Sektor silindi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  // ========= SUB-SECTOR CRUD =========
  const handleSubSectorSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSubSector) {
        await axios.put(`${API}/settings/sub-sectors/${editingSubSector.id}`, subSectorForm, { headers });
        toast.success('Alt sektor yeniləndi');
      } else {
        await axios.post(`${API}/settings/sub-sectors`, subSectorForm, { headers });
        toast.success('Alt sektor əlavə edildi');
      }
      setEditingSubSector(null);
      setSubSectorForm({ name: '', sector: '' });
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDeleteSubSector = async (id) => {
    if (!window.confirm('Bu alt sektoru silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/settings/sub-sectors/${id}`, { headers });
      toast.success('Alt sektor silindi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  // ========= POSITION CRUD =========
  const handlePositionSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/settings/positions`, positionForm, { headers });
      toast.success('Vəzifə əlavə edildi');
      setPositionForm({ name: '' });
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDeletePosition = async (id) => {
    if (!window.confirm('Bu vəzifəni silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/settings/positions/${id}`, { headers });
      toast.success('Vəzifə silindi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  // ========= ACTIVITY CRUD =========
  const handleActivitySubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/settings/activities`, activityForm, { headers });
      toast.success('Fəaliyyət əlavə edildi');
      setActivityForm({ name: '' });
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDeleteActivity = async (id) => {
    if (!window.confirm('Bu fəaliyyəti silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/settings/activities/${id}`, { headers });
      toast.success('Fəaliyyət silindi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  // ========= REGION CRUD =========
  const handleRegionSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/settings/regions`, regionForm, { headers });
      toast.success('Region əlavə edildi');
      setRegionForm({ name: '' });
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDeleteRegion = async (id) => {
    if (!window.confirm('Bu regionu silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/settings/regions/${id}`, { headers });
      toast.success('Region silindi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  // ========= MARSOL COMPANIES CRUD =========
  const handleMarsolCompanySubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/settings/marsol-companies`, marsolCompanyForm, { headers });
      toast.success('Müəssisə əlavə edildi');
      setMarsolCompanyForm({ name: '' });
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDeleteMarsolCompany = async (id) => {
    if (!window.confirm('Bu müəssisəni silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/settings/marsol-companies/${id}`, { headers });
      toast.success('Müəssisə silindi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  // ========= CUSTOM FIELD CRUD =========
  const openFieldModal = (field = null) => {
    if (field) {
      setEditingField(field);
      setFieldForm({
        module: field.module,
        sub_tab: field.sub_tab || '',
        field_name: field.field_name,
        field_label: field.field_label || '',
        field_type: field.field_type,
        options: Array.isArray(field.options) ? field.options.join(', ') : '',
        required: field.required || false,
      });
    } else {
      setEditingField(null);
      setFieldForm({ module: '', sub_tab: '', field_name: '', field_label: '', field_type: 'text', options: '', required: false });
    }
    setShowFieldModal(true);
  };

  const handleFieldSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...fieldForm,
      options: fieldForm.field_type === 'select' ? fieldForm.options.split(',').map(o => o.trim()).filter(Boolean) : [],
    };
    try {
      if (editingField) {
        await axios.put(`${API}/settings/custom-fields/${editingField.id}`, payload, { headers });
        toast.success('Sahə yeniləndi');
      } else {
        await axios.post(`${API}/settings/custom-fields`, payload, { headers });
        toast.success('Sahə əlavə edildi');
      }
      setShowFieldModal(false);
      setEditingField(null);
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  const handleDeleteField = async (id) => {
    if (!window.confirm('Bu sahəni silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/settings/custom-fields/${id}`, { headers });
      toast.success('Sahə silindi');
      fetchData();
    } catch { toast.error('Xəta baş verdi'); }
  };

  // ========= USER CRUD =========
  const openUserModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserForm({ name: user.name, email: user.email, password: '', role: user.role, department: user.department || '', phone: user.phone || '', status: user.status || 'Aktiv' });
    } else {
      setEditingUser(null);
      setUserForm({ name: '', email: '', password: '', role: 'user', department: '', phone: '', status: 'Aktiv' });
    }
    setShowUserModal(true);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...userForm };
    if (!payload.password) delete payload.password;
    try {
      if (editingUser) {
        await axios.put(`${API}/settings/users/${editingUser.id}`, payload, { headers });
        toast.success('İstifadəçi yeniləndi');
      } else {
        if (!payload.password) { toast.error('Şifrə daxil edin'); return; }
        await axios.post(`${API}/settings/users`, payload, { headers });
        toast.success('İstifadəçi yaradıldı');
      }
      setShowUserModal(false);
      setEditingUser(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xəta baş verdi');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Bu istifadəçini silmək istədiyinizə əminsiniz?')) return;
    try {
      await axios.delete(`${API}/settings/users/${id}`, { headers });
      toast.success('İstifadəçi silindi');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Xəta baş verdi');
    }
  };

  const getRoleBadge = (role) => {
    const r = ROLES.find(x => x.value === role) || ROLES[2];
    return <Badge className={`${r.color} text-xs`}>{r.label}</Badge>;
  };

  const filteredFields = fieldModuleFilter === 'all' ? customFields : customFields.filter(f => f.module === fieldModuleFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="settings-page">
      <Toaster position="top-right" richColors />

      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Tənzimləmələr</h1>
        <p className="text-slate-500 text-sm mt-1">Sistem parametrləri və konfiqurasiya</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex flex-wrap gap-1">
          <TabsTrigger value="packages" className="text-xs sm:text-sm" data-testid="tab-packages"><Package className="w-4 h-4 mr-1 hidden sm:inline" />Paketlər</TabsTrigger>
          <TabsTrigger value="projects" className="text-xs sm:text-sm" data-testid="tab-projects"><FolderKanban className="w-4 h-4 mr-1 hidden sm:inline" />Layihələr</TabsTrigger>
          <TabsTrigger value="sectors" className="text-xs sm:text-sm" data-testid="tab-sectors"><Building2 className="w-4 h-4 mr-1 hidden sm:inline" />Sektorlar</TabsTrigger>
          <TabsTrigger value="sub-sectors" className="text-xs sm:text-sm" data-testid="tab-sub-sectors"><Layers className="w-4 h-4 mr-1 hidden sm:inline" />Alt Sektorlar</TabsTrigger>
          <TabsTrigger value="positions" className="text-xs sm:text-sm" data-testid="tab-positions"><Briefcase className="w-4 h-4 mr-1 hidden sm:inline" />Vəzifələr</TabsTrigger>
          <TabsTrigger value="activities" className="text-xs sm:text-sm" data-testid="tab-activities"><Activity className="w-4 h-4 mr-1 hidden sm:inline" />Fəaliyyətlər</TabsTrigger>
          <TabsTrigger value="regions" className="text-xs sm:text-sm" data-testid="tab-regions"><Building2 className="w-4 h-4 mr-1 hidden sm:inline" />Regionlar</TabsTrigger>
          <TabsTrigger value="marsol-companies" className="text-xs sm:text-sm" data-testid="tab-marsol-companies"><Building className="w-4 h-4 mr-1 hidden sm:inline" />Müəssisələr</TabsTrigger>
          <TabsTrigger value="meeting-types" className="text-xs sm:text-sm" data-testid="tab-meeting-types"><Calendar className="w-4 h-4 mr-1 hidden sm:inline" />Görüş növləri</TabsTrigger>
          <TabsTrigger value="lead-sources" className="text-xs sm:text-sm" data-testid="tab-lead-sources"><Target className="w-4 h-4 mr-1 hidden sm:inline" />Lead mənbələri</TabsTrigger>
          <TabsTrigger value="sale-types" className="text-xs sm:text-sm" data-testid="tab-sale-types"><TrendingUp className="w-4 h-4 mr-1 hidden sm:inline" />Satış növləri</TabsTrigger>
          <TabsTrigger value="warning-days" className="text-xs sm:text-sm" data-testid="tab-warning-days"><Calendar className="w-4 h-4 mr-1 hidden sm:inline" />Xəbərdarlıq</TabsTrigger>
          <TabsTrigger value="forum-fields" className="text-xs sm:text-sm" data-testid="tab-forum-fields"><Eye className="w-4 h-4 mr-1 hidden sm:inline" />Forum sahələri</TabsTrigger>
          <TabsTrigger value="custom-fields" className="text-xs sm:text-sm" data-testid="tab-custom-fields"><Columns3 className="w-4 h-4 mr-1 hidden sm:inline" />Xüsusi sahələr</TabsTrigger>
          <TabsTrigger value="roles" className="text-xs sm:text-sm" data-testid="tab-roles"><Shield className="w-4 h-4 mr-1 hidden sm:inline" />Rollar</TabsTrigger>
          <TabsTrigger value="users" className="text-xs sm:text-sm" data-testid="tab-users"><Users className="w-4 h-4 mr-1 hidden sm:inline" />İstifadəçilər</TabsTrigger>
          <TabsTrigger value="branding" className="text-xs sm:text-sm" data-testid="tab-branding"><ImageIcon className="w-4 h-4 mr-1 hidden sm:inline" />Brendinq</TabsTrigger>
        </TabsList>

        {/* ========= PACKAGES TAB ========= */}
        <TabsContent value="packages">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Üzvlük Paketləri</h2>
            </div>
            <form onSubmit={handlePackageSubmit} className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-slate-50 rounded-lg" data-testid="package-form">
              <div className="flex-1">
                <Label className="text-xs mb-1">Paket adı *</Label>
                <Input value={packageForm.name} onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} placeholder="Paket adı" className="text-sm" required data-testid="package-name-input" />
              </div>
              <div className="flex-1">
                <Label className="text-xs mb-1">Təsvir</Label>
                <Input value={packageForm.description} onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })} placeholder="Təsvir" className="text-sm" data-testid="package-desc-input" />
              </div>
              <div className="w-full sm:w-36">
                <Label className="text-xs mb-1">Qiymət (AZN)</Label>
                <Input type="number" value={packageForm.price} onChange={(e) => setPackageForm({ ...packageForm, price: parseFloat(e.target.value) || 0 })} className="text-sm" data-testid="package-price-input" />
              </div>
              <div>
                <Label className="text-xs mb-1">Dəvət sayı</Label>
                <Input type="number" value={packageForm.invitation_count} onChange={(e) => setPackageForm({ ...packageForm, invitation_count: parseInt(e.target.value) || 0 })} className="text-sm" data-testid="package-invitation-count-input" />
              </div>
              <div className="flex gap-2 items-end">
                <Button type="submit" size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="package-submit-btn">
                  {editingPackage ? 'Yenilə' : 'Əlavə et'}
                </Button>
                {editingPackage && (
                  <Button type="button" variant="outline" size="sm" onClick={() => { setEditingPackage(null); setPackageForm({ name: '', description: '', price: 0 }); }} data-testid="package-cancel-btn">Ləğv</Button>
                )}
              </div>
            </form>
            <div className="space-y-2">
              {packages.map(pkg => (
                <div key={pkg.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors" data-testid={`package-item-${pkg.id}`}>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-[#3D4F6F]">{pkg.name}</p>
                    {pkg.description && <p className="text-xs text-slate-500 mt-0.5">{pkg.description}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-[#3D4F6F] text-white text-xs">{pkg.price?.toLocaleString()} AZN</Badge>
                    {pkg.invitation_count > 0 && <Badge className="bg-[#9ACD32] text-[#3D4F6F] text-xs">{pkg.invitation_count} dəvət</Badge>}
                    <Button variant="ghost" size="sm" onClick={() => { setEditingPackage(pkg); setPackageForm({ name: pkg.name, description: pkg.description || '', price: pkg.price || 0, invitation_count: pkg.invitation_count || 0 }); }} data-testid={`package-edit-${pkg.id}`}>
                      <Pencil className="w-4 h-4 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeletePackage(pkg.id)} data-testid={`package-delete-${pkg.id}`}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
              {packages.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Paket yoxdur</p>}
            </div>
          </div>
        </TabsContent>

        {/* ========= PROJECTS TAB ========= */}
        <TabsContent value="projects">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Layihə növləri</h2>
            </div>
            <form onSubmit={handleProjectSubmit} className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-slate-50 rounded-lg" data-testid="project-form">
              <div className="flex-1">
                <Label className="text-xs mb-1">Layihə növü *</Label>
                <Input value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} placeholder="Layihə növü" className="text-sm" required data-testid="project-name-input" />
              </div>
              <div className="flex gap-2 items-end">
                <Button type="submit" size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="project-submit-btn">
                  {editingProject ? 'Yenilə' : 'Əlavə et'}
                </Button>
                {editingProject && (
                  <Button type="button" variant="outline" size="sm" onClick={() => { setEditingProject(null); setProjectForm({ name: '' }); }} data-testid="project-cancel-btn">Ləğv</Button>
                )}
              </div>
            </form>
            <div className="space-y-2">
              {projects.map(prj => (
                <div key={prj.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors" data-testid={`project-item-${prj.id}`}>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-[#3D4F6F]">{prj.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingProject(prj); setProjectForm({ name: prj.name }); }} data-testid={`project-edit-${prj.id}`}>
                      <Pencil className="w-4 h-4 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteProject(prj.id)} data-testid={`project-delete-${prj.id}`}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
              {projects.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Layihə yoxdur</p>}
            </div>
          </div>
        </TabsContent>

        {/* ========= SECTORS TAB ========= */}
        <TabsContent value="sectors">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Sektorlar</h2>
            </div>
            <form onSubmit={handleSectorSubmit} className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-slate-50 rounded-lg" data-testid="sector-form">
              <div className="flex-1">
                <Label className="text-xs mb-1">Sektor adı *</Label>
                <Input value={sectorForm.name} onChange={(e) => setSectorForm({ ...sectorForm, name: e.target.value })} placeholder="Sektor adı" className="text-sm" required data-testid="sector-name-input" />
              </div>
              <div className="flex gap-2 items-end">
                <Button type="submit" size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="sector-submit-btn">
                  {editingSector ? 'Yenilə' : 'Əlavə et'}
                </Button>
                {editingSector && (
                  <Button type="button" variant="outline" size="sm" onClick={() => { setEditingSector(null); setSectorForm({ name: '' }); }} data-testid="sector-cancel-btn">Ləğv</Button>
                )}
              </div>
            </form>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sectors.map(sec => (
                <div key={sec.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors" data-testid={`sector-item-${sec.id}`}>
                  <p className="font-medium text-sm text-[#3D4F6F]">{sec.name}</p>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingSector(sec); setSectorForm({ name: sec.name }); }} data-testid={`sector-edit-${sec.id}`}>
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteSector(sec.id)} data-testid={`sector-delete-${sec.id}`}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
              {sectors.length === 0 && <p className="col-span-full text-center text-slate-400 py-8 text-sm">Sektor yoxdur</p>}
            </div>
          </div>
        </TabsContent>

        {/* ========= SUB-SECTORS TAB ========= */}
        <TabsContent value="sub-sectors">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Alt Sektorlar</h2>
            </div>
            <form onSubmit={handleSubSectorSubmit} className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-slate-50 rounded-lg" data-testid="sub-sector-form">
              <div className="flex-1">
                <Label className="text-xs mb-1">Əsas sektor *</Label>
                <Select value={subSectorForm.sector} onValueChange={v => setSubSectorForm({ ...subSectorForm, sector: v })}>
                  <SelectTrigger className="text-sm" data-testid="sub-sector-parent-select"><SelectValue placeholder="Sektor seçin" /></SelectTrigger>
                  <SelectContent>
                    {sectors.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs mb-1">Alt sektor adı *</Label>
                <Input value={subSectorForm.name} onChange={(e) => setSubSectorForm({ ...subSectorForm, name: e.target.value })} placeholder="Alt sektor adı" className="text-sm" required data-testid="sub-sector-name-input" />
              </div>
              <div className="flex gap-2 items-end">
                <Button type="submit" size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="sub-sector-submit-btn">
                  {editingSubSector ? 'Yenilə' : 'Əlavə et'}
                </Button>
                {editingSubSector && (
                  <Button type="button" variant="outline" size="sm" onClick={() => { setEditingSubSector(null); setSubSectorForm({ name: '', sector: '' }); }}>Ləğv</Button>
                )}
              </div>
            </form>
            <div className="space-y-2">
              {subSectors.map(ss => (
                <div key={ss.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors" data-testid={`sub-sector-item-${ss.id}`}>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#3D4F6F] text-white text-xs">{ss.sector}</Badge>
                    <p className="font-medium text-sm text-[#3D4F6F]">{ss.name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingSubSector(ss); setSubSectorForm({ name: ss.name, sector: ss.sector }); }}>
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteSubSector(ss.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
              {subSectors.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Alt sektor yoxdur. Əvvəlcə sektor yaradın, sonra alt sektor əlavə edin.</p>}
            </div>
          </div>
        </TabsContent>

        {/* ========= POSITIONS TAB ========= */}
        <TabsContent value="positions">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Vəzifələr</h2>
            </div>
            <form onSubmit={handlePositionSubmit} className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-slate-50 rounded-lg" data-testid="position-form">
              <div className="flex-1">
                <Label className="text-xs mb-1">Vəzifə adı *</Label>
                <Input value={positionForm.name} onChange={(e) => setPositionForm({ ...positionForm, name: e.target.value })} placeholder="Vəzifə adı" className="text-sm" required data-testid="position-name-input" />
              </div>
              <div className="flex gap-2 items-end">
                <Button type="submit" size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="position-submit-btn">Əlavə et</Button>
              </div>
            </form>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {positions.map(pos => (
                <div key={pos.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors" data-testid={`position-item-${pos.id}`}>
                  <p className="font-medium text-sm text-[#3D4F6F]">{pos.name}</p>
                  <Button variant="ghost" size="sm" onClick={() => handleDeletePosition(pos.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              ))}
              {positions.length === 0 && <p className="col-span-full text-center text-slate-400 py-8 text-sm">Vəzifə yoxdur</p>}
            </div>
          </div>
        </TabsContent>

        {/* ========= ACTIVITIES TAB ========= */}
        <TabsContent value="activities">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Fəaliyyətlər</h2>
            </div>
            <form onSubmit={handleActivitySubmit} className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-slate-50 rounded-lg" data-testid="activity-form">
              <div className="flex-1">
                <Label className="text-xs mb-1">Fəaliyyət adı *</Label>
                <Input value={activityForm.name} onChange={(e) => setActivityForm({ ...activityForm, name: e.target.value })} placeholder="Fəaliyyət adı" className="text-sm" required data-testid="activity-name-input" />
              </div>
              <div className="flex gap-2 items-end">
                <Button type="submit" size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="activity-submit-btn">Əlavə et</Button>
              </div>
            </form>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {activities.map(act => (
                <div key={act.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors" data-testid={`activity-item-${act.id}`}>
                  <p className="font-medium text-sm text-[#3D4F6F]">{act.name}</p>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteActivity(act.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              ))}
              {activities.length === 0 && <p className="col-span-full text-center text-slate-400 py-8 text-sm">Fəaliyyət yoxdur</p>}
            </div>
          </div>
        </TabsContent>

        {/* ========= REGIONS TAB ========= */}
        <TabsContent value="regions">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Regionlar</h2>
            </div>
            <form onSubmit={handleRegionSubmit} className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-slate-50 rounded-lg" data-testid="region-form">
              <div className="flex-1">
                <Label className="text-xs mb-1">Region adı *</Label>
                <Input value={regionForm.name} onChange={(e) => setRegionForm({ ...regionForm, name: e.target.value })} placeholder="Region adı" className="text-sm" required data-testid="region-name-input" />
              </div>
              <div className="flex gap-2 items-end">
                <Button type="submit" size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="region-submit-btn">Əlavə et</Button>
              </div>
            </form>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {regions.map(reg => (
                <div key={reg.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors" data-testid={`region-item-${reg.id}`}>
                  <p className="font-medium text-sm text-[#3D4F6F]">{reg.name}</p>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteRegion(reg.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              ))}
              {regions.length === 0 && <p className="col-span-full text-center text-slate-400 py-8 text-sm">Region yoxdur</p>}
            </div>
          </div>
        </TabsContent>

        {/* ========= MARSOL COMPANIES TAB ========= */}
        <TabsContent value="marsol-companies">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Marsol Group Müəssisələri</h2>
            </div>
            <form onSubmit={handleMarsolCompanySubmit} className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-slate-50 rounded-lg" data-testid="marsol-company-form">
              <div className="flex-1">
                <Label className="text-xs mb-1">Müəssisə adı *</Label>
                <Input value={marsolCompanyForm.name} onChange={(e) => setMarsolCompanyForm({ ...marsolCompanyForm, name: e.target.value })} placeholder="Müəssisə adı" className="text-sm" required data-testid="marsol-company-name-input" />
              </div>
              <div className="flex gap-2 items-end">
                <Button type="submit" size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="marsol-company-submit-btn">Əlavə et</Button>
              </div>
            </form>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {marsolCompanies.map(mc => (
                <div key={mc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors" data-testid={`marsol-company-item-${mc.id}`}>
                  <p className="font-medium text-sm text-[#3D4F6F]">{mc.name}</p>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteMarsolCompany(mc.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              ))}
              {marsolCompanies.length === 0 && <p className="col-span-full text-center text-slate-400 py-8 text-sm">Müəssisə yoxdur</p>}
            </div>
          </div>
        </TabsContent>

        {/* ========= MEETING TYPES TAB ========= */}
        <TabsContent value="meeting-types">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#3D4F6F' }}>Görüş Növləri</h2>
            <div className="flex gap-2 mb-4">
              <Input
                value={newMeetingType}
                onChange={(e) => setNewMeetingType(e.target.value)}
                placeholder="Yeni görüş növü..."
                className="text-sm max-w-xs"
                data-testid="meeting-type-input"
              />
              <Button
                size="sm"
                disabled={!newMeetingType.trim()}
                onClick={async () => {
                  const updated = [...meetingTypes, newMeetingType.trim()];
                  try {
                    await axios.put(`${API}/settings/lists/meeting_types`, { values: updated }, { headers });
                    setMeetingTypes(updated);
                    setNewMeetingType('');
                    toast.success('Görüş növü əlavə edildi');
                  } catch { toast.error('Xəta baş verdi'); }
                }}
                className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125]"
                data-testid="add-meeting-type-btn"
              >
                <Plus className="w-4 h-4 mr-1" />Əlavə et
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {meetingTypes.map((mt, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-sm text-[#3D4F6F] font-medium">{mt}</span>
                  <button
                    onClick={async () => {
                      const updated = meetingTypes.filter((_, i) => i !== idx);
                      try {
                        await axios.put(`${API}/settings/lists/meeting_types`, { values: updated }, { headers });
                        setMeetingTypes(updated);
                        toast.success('Görüş növü silindi');
                      } catch { toast.error('Xəta baş verdi'); }
                    }}
                    className="p-1 hover:bg-red-100 rounded"
                    data-testid={`delete-meeting-type-${idx}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ))}
              {meetingTypes.length === 0 && <p className="col-span-full text-center text-slate-400 py-8 text-sm">Görüş növü yoxdur</p>}
            </div>
          </div>
        </TabsContent>

        {/* ========= LEAD SOURCES TAB ========= */}
        <TabsContent value="lead-sources">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#3D4F6F' }}>Lead Mənbələri</h2>
            <div className="flex gap-2 mb-4">
              <Input value={newLeadSource} onChange={(e) => setNewLeadSource(e.target.value)} placeholder="Yeni mənbə..." className="text-sm max-w-xs" data-testid="lead-source-input" />
              <Button size="sm" disabled={!newLeadSource.trim()} onClick={async () => {
                const updated = [...leadSources, newLeadSource.trim()];
                try {
                  await axios.put(`${API}/settings/lists/lead_sources`, { values: updated }, { headers });
                  setLeadSources(updated); setNewLeadSource(''); toast.success('Mənbə əlavə edildi');
                } catch { toast.error('Xəta baş verdi'); }
              }} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125]" data-testid="add-lead-source-btn">
                <Plus className="w-4 h-4 mr-1" />Əlavə et
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {leadSources.map((ls, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-sm text-[#3D4F6F] font-medium">{ls}</span>
                  <button onClick={async () => {
                    const updated = leadSources.filter((_, i) => i !== idx);
                    try {
                      await axios.put(`${API}/settings/lists/lead_sources`, { values: updated }, { headers });
                      setLeadSources(updated); toast.success('Mənbə silindi');
                    } catch { toast.error('Xəta baş verdi'); }
                  }} className="p-1 hover:bg-red-100 rounded" data-testid={`delete-lead-source-${idx}`}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ))}
              {leadSources.length === 0 && <p className="col-span-full text-center text-slate-400 py-8 text-sm">Mənbə yoxdur</p>}
            </div>
          </div>
        </TabsContent>

        {/* ========= SALE TYPES TAB ========= */}
        <TabsContent value="sale-types">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#3D4F6F' }}>Satış Növləri</h2>
            <div className="flex gap-2 mb-4">
              <Input value={newSaleType} onChange={(e) => setNewSaleType(e.target.value)} placeholder="Yeni satış növü..." className="text-sm max-w-xs" data-testid="sale-type-input" />
              <Button size="sm" disabled={!newSaleType.trim()} onClick={async () => {
                const updated = [...saleTypes, newSaleType.trim()];
                try {
                  await axios.put(`${API}/settings/lists/sale_types`, { values: updated }, { headers });
                  setSaleTypes(updated); setNewSaleType(''); toast.success('Satış növü əlavə edildi');
                } catch { toast.error('Xəta baş verdi'); }
              }} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125]" data-testid="add-sale-type-btn">
                <Plus className="w-4 h-4 mr-1" />Əlavə et
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {saleTypes.map((st, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-sm text-[#3D4F6F] font-medium">{st}</span>
                  <button onClick={async () => {
                    const updated = saleTypes.filter((_, i) => i !== idx);
                    try {
                      await axios.put(`${API}/settings/lists/sale_types`, { values: updated }, { headers });
                      setSaleTypes(updated); toast.success('Satış növü silindi');
                    } catch { toast.error('Xəta baş verdi'); }
                  }} className="p-1 hover:bg-red-100 rounded" data-testid={`delete-sale-type-${idx}`}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ))}
              {saleTypes.length === 0 && <p className="col-span-full text-center text-slate-400 py-8 text-sm">Satış növü yoxdur</p>}
            </div>
          </div>
        </TabsContent>

        {/* ========= WARNING DAYS TAB ========= */}
        <TabsContent value="warning-days">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#3D4F6F' }}>Üzvlük Bitmə Xəbərdarlığı</h2>
            <p className="text-sm text-slate-500 mb-4">Üzvlüyün bitməsinə neçə gün qalmış bildiriş göndərilsin?</p>
            <div className="flex gap-2 items-end">
              <div>
                <Label className="text-xs">Gün sayı</Label>
                <Input type="number" value={warningDays} onChange={(e) => setWarningDays(e.target.value)} className="text-sm w-32" min="1" max="90" data-testid="warning-days-input" />
              </div>
              <Button size="sm" onClick={async () => {
                try {
                  await axios.put(`${API}/settings/lists/membership_warning_days`, { values: [warningDays] }, { headers });
                  toast.success(`Xəbərdarlıq ${warningDays} gün olaraq təyin edildi`);
                } catch { toast.error('Xəta baş verdi'); }
              }} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125]" data-testid="save-warning-days-btn">
                Yadda saxla
              </Button>
            </div>
          </div>
        </TabsContent>


        {/* ========= FORUM FIELDS TAB ========= */}
        <TabsContent value="forum-fields">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Üzvlük Forum Sahələri</h2>
                <p className="text-xs text-slate-500 mt-1">Xarici formda hansı sahələrin görünəcəyini seçin</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setForumEnabled(forumFields.map(f => f.key))} data-testid="select-all-fields">Hamısını seç</Button>
                <Button size="sm" variant="outline" onClick={() => setForumEnabled([])} data-testid="deselect-all-fields">Heç birini</Button>
                <Button size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125]" onClick={async () => {
                  try {
                    await axios.put(`${API}/forum/fields`, { enabled: forumEnabled }, { headers });
                    await axios.put(`${API}/settings/lists/forum_description`, { values: [forumDescription] }, { headers });
                    toast.success('Forum tənzimləmələri yadda saxlandı');
                  } catch { toast.error('Xəta baş verdi'); }
                }} data-testid="save-forum-fields-btn">Yadda saxla</Button>
              </div>
            </div>

            {/* Forum description */}
            <div className="mb-4">
              <Label className="text-xs font-semibold">Forum açıqlama mətni</Label>
              <textarea value={forumDescription} onChange={(e) => setForumDescription(e.target.value)} className="w-full min-h-[60px] p-2 text-sm border rounded-lg resize-none mt-1" placeholder="Formun yuxarısında görünəcək açıqlama..." data-testid="forum-description-input" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {forumFields.map(field => (
                <label key={field.key} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${forumEnabled.includes(field.key) ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-100'}`} data-testid={`forum-field-${field.key}`}>
                  <input
                    type="checkbox"
                    checked={forumEnabled.includes(field.key)}
                    onChange={(e) => {
                      if (e.target.checked) setForumEnabled([...forumEnabled, field.key]);
                      else setForumEnabled(forumEnabled.filter(k => k !== field.key));
                    }}
                    className="w-4 h-4 accent-[#9ACD32]"
                  />
                  <span className="text-sm text-slate-700">{field.label}</span>
                  {field.custom && <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">Xüsusi</span>}
                </label>
              ))}
            </div>
          </div>
        </TabsContent>



        {/* ========= ROLES TAB ========= */}
        <TabsContent value="roles">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Rollar & İcazələr</h2>
              <Button size="sm" onClick={() => {
                setEditingRole(null);
                const defaultPerms = {};
                ['dashboard','companies','hr','sales','members','obligations','finance','organization','meetings','assembly','tasks','marketing','projects','reports','messages','files','notes','settings','notifications'].forEach(m => defaultPerms[m] = 'none');
                setRoleForm({ name: '', permissions: defaultPerms });
                setShowRoleModal(true);
              }} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125]" data-testid="add-role-btn">
                <Plus className="w-4 h-4 mr-1" />Yeni Rol
              </Button>
            </div>

            {roles.length === 0 ? (
              <p className="text-center text-slate-400 py-12 text-sm">Rol yaradılmayıb. "Yeni Rol" düyməsinə basın.</p>
            ) : (
              <div className="space-y-3">
                {roles.map(role => (
                  <div key={role.id} className="border border-slate-200 rounded-lg p-4" data-testid={`role-${role.id}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-[#3D4F6F]">{role.name}</h3>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditingRole(role);
                          setRoleForm({ name: role.name, permissions: { ...role.permissions } });
                          setShowRoleModal(true);
                        }} data-testid={`edit-role-${role.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={async () => {
                          if (!window.confirm('Bu rolu silmək istədiyinizə əminsiniz?')) return;
                          try { await axios.delete(`${API}/roles/${role.id}`, { headers }); toast.success('Rol silindi'); fetchData(); }
                          catch(e) { toast.error(e.response?.data?.detail || 'Xəta baş verdi'); }
                        }} data-testid={`delete-role-${role.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(role.permissions || {}).filter(([,v]) => v !== 'none').map(([mod, level]) => (
                        <span key={mod} className={`text-[10px] px-2 py-0.5 rounded ${level === 'write' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {mod} ({level === 'write' ? 'Tam' : 'Oxu'})
                        </span>
                      ))}
                      {Object.values(role.permissions || {}).every(v => v === 'none') && (
                        <span className="text-[10px] text-slate-400">İcazə verilməyib</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Role Modal */}
          <Dialog open={showRoleModal} onOpenChange={setShowRoleModal}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle style={{ color: '#3D4F6F' }}>{editingRole ? 'Rolu redaktə et' : 'Yeni Rol'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Rol adı *</Label>
                  <Input value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} className="text-sm" placeholder="Məs: Satış meneceri" data-testid="role-name-input" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Modul İcazələri</Label>
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-[#3D4F6F]">Modul</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-red-500">Görə bilmir</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-blue-500">Yalnız görür</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-green-500">Redaktə edə bilir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['dashboard', 'İdarə Paneli'], ['companies', 'Şirkət Məlumatları'], ['hr', 'İnsan Resursları'],
                          ['sales', 'Satış (Şirkət Bazası)'], ['members', 'Üzvlər'], ['obligations', 'Öhdəliklər'],
                          ['finance', 'Maliyyə'], ['organization', 'Təşkilatçılıq'], ['meetings', 'Görüşlər'],
                          ['assembly', 'İclaslar'], ['tasks', 'Tapşırıqlar'], ['marketing', 'Marketinq'],
                          ['projects', 'Layihələr'], ['reports', 'Hesabatlar'], ['messages', 'Mesajlar'],
                          ['files', 'Fayllar'], ['notes', 'Qeydlər'], ['settings', 'Tənzimləmələr'],
                          ['notifications', 'Bildirişlər']
                        ].map(([key, label]) => (
                          <tr key={key} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="px-3 py-2 text-xs text-slate-700 font-medium">{label}</td>
                            {['none', 'read', 'write'].map(level => (
                              <td key={level} className="text-center px-3 py-2">
                                <input
                                  type="radio"
                                  name={`perm-${key}`}
                                  checked={(roleForm.permissions[key] || 'none') === level}
                                  onChange={() => setRoleForm({ ...roleForm, permissions: { ...roleForm.permissions, [key]: level } })}
                                  className="w-4 h-4 accent-[#3D4F6F]"
                                  data-testid={`perm-${key}-${level}`}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowRoleModal(false)}>Ləğv et</Button>
                  <Button className="bg-[#3D4F6F] hover:bg-[#2A364C] text-white" disabled={!roleForm.name.trim()} onClick={async () => {
                    try {
                      if (editingRole) {
                        await axios.put(`${API}/roles/${editingRole.id}`, roleForm, { headers });
                        toast.success('Rol yeniləndi');
                      } else {
                        await axios.post(`${API}/roles`, roleForm, { headers });
                        toast.success('Rol yaradıldı');
                      }
                      setShowRoleModal(false);
                      fetchData();
                    } catch(e) { toast.error(e.response?.data?.detail || 'Xəta baş verdi'); }
                  }} data-testid="role-submit-btn">{editingRole ? 'Yadda saxla' : 'Yarat'}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>


        {/* ========= CUSTOM FIELDS TAB ========= */}
        <TabsContent value="custom-fields">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Xüsusi Sahələr</h2>
              <div className="flex gap-2">
                <Select value={fieldModuleFilter} onValueChange={setFieldModuleFilter}>
                  <SelectTrigger className="w-48 text-sm" data-testid="field-module-filter">
                    <SelectValue placeholder="Modul seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Bütün modullar</SelectItem>
                    {MODULES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={() => openFieldModal()} size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="add-field-btn">
                  <Plus className="w-4 h-4 mr-1" />Sahə əlavə et
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {filteredFields.map(field => {
                const mod = MODULES.find(m => m.value === field.module);
                return (
                  <div key={field.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors" data-testid={`field-item-${field.id}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-[#3D4F6F]">{field.field_label || field.field_name}</p>
                        <Badge className="bg-blue-100 text-blue-700 text-xs">{mod?.label || field.module}</Badge>
                        {field.sub_tab && (() => {
                          const tabDef = MODULE_TABS[field.module]?.find(t => t.value === field.sub_tab);
                          return tabDef ? <Badge className="bg-purple-100 text-purple-700 text-xs">{tabDef.label}</Badge> : null;
                        })()}
                        <Badge variant="outline" className="text-xs">{FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}</Badge>
                        {field.required && <Badge className="bg-amber-100 text-amber-700 text-xs">Məcburi</Badge>}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Sahə adı: {field.field_name}</p>
                      {field.field_type === 'select' && field.options?.length > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">Seçimlər: {field.options.join(', ')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openFieldModal(field)} data-testid={`field-edit-${field.id}`}>
                        <Pencil className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteField(field.id)} data-testid={`field-delete-${field.id}`}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {filteredFields.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Xüsusi sahə yoxdur</p>}
            </div>
          </div>
        </TabsContent>

        {/* ========= USERS TAB ========= */}
        <TabsContent value="users">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>İstifadəçi İdarəetmə</h2>
              <Button onClick={() => openUserModal()} size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="add-user-btn">
                <Plus className="w-4 h-4 mr-1" />İstifadəçi yarat
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="users-table">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Ad</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Email</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F] hidden sm:table-cell">Şöbə</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Rol</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#3D4F6F] hidden sm:table-cell">Status</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-[#3D4F6F]">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(usr => (
                    <tr key={usr.id} className="border-b border-slate-50 hover:bg-slate-50" data-testid={`user-row-${usr.id}`}>
                      <td className="px-4 py-3 text-sm font-medium">{usr.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{usr.email}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 hidden sm:table-cell">{usr.department || '-'}</td>
                      <td className="px-4 py-3">{getRoleBadge(usr.role)}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Badge className={usr.status === 'Aktiv' ? 'bg-green-100 text-green-700 text-xs' : 'bg-slate-100 text-slate-600 text-xs'}>{usr.status || 'Aktiv'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openUserModal(usr)} data-testid={`user-edit-${usr.id}`}>
                            <Pencil className="w-4 h-4 text-slate-500" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(usr.id)} data-testid={`user-delete-${usr.id}`}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">İstifadəçi yoxdur</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ========= BRANDING TAB ========= */}
        <TabsContent value="branding">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Logolar</h2>
              <p className="text-xs text-slate-500 mt-1">Sidebar loqosu tünd fon üçün (ağ versiya), əsas loqo açıq fonlar (Login, Public Form, çaplar) üçündür.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Sidebar logo */}
              <div className="border rounded-xl p-4 bg-gradient-to-br from-[#3D4F6F] to-[#2A364C]">
                <Label className="text-xs font-bold text-white/80 uppercase tracking-wider">Sidebar loqosu (tünd fon)</Label>
                <div className="bg-white/5 border border-white/20 rounded-lg h-24 flex items-center justify-center my-3">
                  {branding.sidebar_logo_url ? (
                    <img src={branding.sidebar_logo_url.startsWith('http') ? branding.sidebar_logo_url : `${process.env.REACT_APP_BACKEND_URL}${branding.sidebar_logo_url}`} alt="Sidebar" className="h-14 object-contain" data-testid="preview-sidebar-logo" />
                  ) : (
                    <p className="text-xs text-white/40">Loqo yüklənməyib (default istifadə olunur)</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer bg-white/10 hover:bg-white/20 border border-white/30 text-white text-xs font-medium py-2 px-3 rounded-lg text-center flex items-center justify-center gap-2 transition">
                    <Upload className="w-3.5 h-3.5" />
                    {brandingUploading.sidebar ? 'Yüklənir...' : 'Yüklə (PNG şəffaf tövsiyə olunur)'}
                    <input
                      type="file" accept="image/*" className="hidden"
                      disabled={brandingUploading.sidebar}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        setBrandingUploading({ ...brandingUploading, sidebar: true });
                        try {
                          const fd = new FormData(); fd.append('file', file);
                          const r = await axios.post(`${API}/upload`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
                          const next = { ...branding, sidebar_logo_url: r.data.url };
                          const saved = await axios.put(`${API}/settings/branding`, next, { headers });
                          setBranding(saved.data); toast.success('Sidebar loqosu yeniləndi');
                        } catch (err) { toast.error('Xəta baş verdi'); }
                        finally { setBrandingUploading({ ...brandingUploading, sidebar: false }); e.target.value = ''; }
                      }}
                      data-testid="upload-sidebar-logo"
                    />
                  </label>
                  {branding.sidebar_logo_url && (
                    <button
                      type="button"
                      onClick={async () => {
                        try { const r = await axios.put(`${API}/settings/branding`, { ...branding, sidebar_logo_url: '' }, { headers }); setBranding(r.data); toast.success('Sidebar loqosu defaulta qaytarıldı'); } catch { toast.error('Xəta'); }
                      }}
                      className="bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-100 text-xs font-medium py-2 px-3 rounded-lg flex items-center gap-1 transition"
                      data-testid="reset-sidebar-logo"
                    ><Trash2 className="w-3.5 h-3.5" />Sıfırla</button>
                  )}
                </div>
              </div>

              {/* Main logo */}
              <div className="border rounded-xl p-4 bg-gradient-to-br from-slate-50 to-white">
                <Label className="text-xs font-bold text-[#3D4F6F] uppercase tracking-wider">Əsas loqo (açıq fon)</Label>
                <div className="bg-slate-100 border border-slate-200 rounded-lg h-24 flex items-center justify-center my-3">
                  {branding.main_logo_url ? (
                    <img src={branding.main_logo_url.startsWith('http') ? branding.main_logo_url : `${process.env.REACT_APP_BACKEND_URL}${branding.main_logo_url}`} alt="Main" className="h-14 object-contain" data-testid="preview-main-logo" />
                  ) : (
                    <p className="text-xs text-slate-400">Loqo yüklənməyib</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer bg-[#3D4F6F] hover:bg-[#2A364C] text-white text-xs font-medium py-2 px-3 rounded-lg text-center flex items-center justify-center gap-2 transition">
                    <Upload className="w-3.5 h-3.5" />
                    {brandingUploading.main ? 'Yüklənir...' : 'Yüklə'}
                    <input
                      type="file" accept="image/*" className="hidden"
                      disabled={brandingUploading.main}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        setBrandingUploading({ ...brandingUploading, main: true });
                        try {
                          const fd = new FormData(); fd.append('file', file);
                          const r = await axios.post(`${API}/upload`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
                          const next = { ...branding, main_logo_url: r.data.url };
                          const saved = await axios.put(`${API}/settings/branding`, next, { headers });
                          setBranding(saved.data); toast.success('Əsas loqo yeniləndi');
                        } catch (err) { toast.error('Xəta baş verdi'); }
                        finally { setBrandingUploading({ ...brandingUploading, main: false }); e.target.value = ''; }
                      }}
                      data-testid="upload-main-logo"
                    />
                  </label>
                  {branding.main_logo_url && (
                    <button
                      type="button"
                      onClick={async () => {
                        try { const r = await axios.put(`${API}/settings/branding`, { ...branding, main_logo_url: '' }, { headers }); setBranding(r.data); toast.success('Əsas loqo defaulta qaytarıldı'); } catch { toast.error('Xəta'); }
                      }}
                      className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-medium py-2 px-3 rounded-lg flex items-center gap-1 transition"
                      data-testid="reset-main-logo"
                    ><Trash2 className="w-3.5 h-3.5" />Sıfırla</button>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-4">
              💡 Qeyd: Sidebar loqosu PNG şəffaf fonlu olsa, tünd fon üzərində daha yaxşı görünəcək. Dəyişikliklər səhifəni yeniləyəndən sonra tətbiq olunur.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Custom Field Modal */}
      <Dialog open={showFieldModal} onOpenChange={setShowFieldModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>{editingField ? 'Sahəni redaktə et' : 'Xüsusi sahə əlavə et'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFieldSubmit} className="space-y-4" data-testid="field-form">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Modul *</Label>
                <Select value={fieldForm.module} onValueChange={(v) => setFieldForm({ ...fieldForm, module: v, sub_tab: '' })}>
                  <SelectTrigger className="text-sm" data-testid="field-module-select"><SelectValue placeholder="Modul seçin" /></SelectTrigger>
                  <SelectContent>
                    {MODULES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tab *</Label>
                <Select value={fieldForm.sub_tab} onValueChange={(v) => setFieldForm({ ...fieldForm, sub_tab: v })} disabled={!fieldForm.module}>
                  <SelectTrigger className="text-sm" data-testid="field-subtab-select"><SelectValue placeholder="Tab seçin" /></SelectTrigger>
                  <SelectContent>
                    {(MODULE_TABS[fieldForm.module] || []).map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Sahə adı (key) *</Label>
                <Input value={fieldForm.field_name} onChange={(e) => setFieldForm({ ...fieldForm, field_name: e.target.value.replace(/\s/g, '_').toLowerCase() })} placeholder="custom_field" className="text-sm font-mono" required data-testid="field-name-input" />
              </div>
              <div>
                <Label className="text-xs">Görünən ad *</Label>
                <Input value={fieldForm.field_label} onChange={(e) => setFieldForm({ ...fieldForm, field_label: e.target.value })} placeholder="Xüsusi sahə" className="text-sm" required data-testid="field-label-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Sahə tipi *</Label>
                <Select value={fieldForm.field_type} onValueChange={(v) => setFieldForm({ ...fieldForm, field_type: v })}>
                  <SelectTrigger className="text-sm" data-testid="field-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input type="checkbox" checked={fieldForm.required} onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.checked })} className="w-4 h-4 rounded border-slate-300" data-testid="field-required-check" />
                  <span className="text-sm text-slate-700">Məcburi sahə</span>
                </label>
              </div>
            </div>
            {fieldForm.field_type === 'select' && (
              <div>
                <Label className="text-xs">Seçimlər (vergüllə ayırın)</Label>
                <Input value={fieldForm.options} onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })} placeholder="Seçim 1, Seçim 2, Seçim 3" className="text-sm" data-testid="field-options-input" />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowFieldModal(false)}>Ləğv et</Button>
              <Button type="submit" className="bg-[#3D4F6F] hover:bg-[#2A364C] text-white" data-testid="field-submit-btn">{editingField ? 'Yadda saxla' : 'Əlavə et'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* User Modal */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>{editingUser ? 'İstifadəçini redaktə et' : 'Yeni istifadəçi yarat'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUserSubmit} className="space-y-4" data-testid="user-form">
            <div>
              <Label className="text-xs">Ad Soyad *</Label>
              <Input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="Ad Soyad" className="text-sm" required data-testid="user-name-input" />
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="email@example.com" className="text-sm" required data-testid="user-email-input" />
            </div>
            <div>
              <Label className="text-xs">{editingUser ? 'Yeni şifrə (boş saxlasanız dəyişməyəcək)' : 'Şifrə *'}</Label>
              <Input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="******" className="text-sm" required={!editingUser} data-testid="user-password-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Rol *</Label>
                <Select value={userForm.role} onValueChange={(v) => setUserForm({ ...userForm, role: v })}>
                  <SelectTrigger className="text-sm" data-testid="user-role-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    {roles.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={userForm.status} onValueChange={(v) => setUserForm({ ...userForm, status: v })}>
                  <SelectTrigger className="text-sm" data-testid="user-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aktiv">Aktiv</SelectItem>
                    <SelectItem value="Deaktiv">Deaktiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Şöbə</Label>
                <Input value={userForm.department} onChange={(e) => setUserForm({ ...userForm, department: e.target.value })} placeholder="Şöbə" className="text-sm" data-testid="user-department-input" />
              </div>
              <div>
                <Label className="text-xs">Telefon</Label>
                <Input value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} placeholder="+994 XX XXX XX XX" className="text-sm" data-testid="user-phone-input" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowUserModal(false)}>Ləğv et</Button>
              <Button type="submit" className="bg-[#3D4F6F] hover:bg-[#2A364C] text-white" data-testid="user-submit-btn">{editingUser ? 'Yadda saxla' : 'Yarat'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
