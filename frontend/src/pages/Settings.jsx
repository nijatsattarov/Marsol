import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Settings as SettingsIcon, Package, FolderKanban, Users, Columns3,
  Plus, Pencil, Trash2, Loader2, Shield, Eye, UserCog, User,
  ChevronDown, Search, X
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
  { value: 'finance', label: 'Maliyyə' },
  { value: 'sales', label: 'Satış' },
  { value: 'hr', label: 'İnsan Resurları' },
  { value: 'meetings', label: 'Görüşlər' },
  { value: 'tasks', label: 'Tapşırıqlar' },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Mətn' },
  { value: 'number', label: 'Rəqəm' },
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

  // Forms
  const [packageForm, setPackageForm] = useState({ name: '', description: '', price: 0 });
  const [projectForm, setProjectForm] = useState({ name: '', description: '' });
  const [fieldForm, setFieldForm] = useState({ module: '', field_name: '', field_label: '', field_type: 'text', options: '', required: false });
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'user', department: '', phone: '', status: 'Aktiv' });

  // Edit states
  const [editingPackage, setEditingPackage] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  // Modal states
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);

  // Filter
  const [fieldModuleFilter, setFieldModuleFilter] = useState('all');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      const [pkgRes, prjRes, cfRes, usrRes] = await Promise.all([
        axios.get(`${API}/settings/packages`, { headers }),
        axios.get(`${API}/settings/projects`, { headers }),
        axios.get(`${API}/settings/custom-fields`, { headers }),
        axios.get(`${API}/settings/users`, { headers }),
      ]);
      setPackages(pkgRes.data);
      setProjects(prjRes.data);
      setCustomFields(cfRes.data);
      setUsers(usrRes.data);
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
      setPackageForm({ name: '', description: '', price: 0 });
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
      setProjectForm({ name: '', description: '' });
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

  // ========= CUSTOM FIELD CRUD =========
  const openFieldModal = (field = null) => {
    if (field) {
      setEditingField(field);
      setFieldForm({
        module: field.module,
        field_name: field.field_name,
        field_label: field.field_label || '',
        field_type: field.field_type,
        options: Array.isArray(field.options) ? field.options.join(', ') : '',
        required: field.required || false,
      });
    } else {
      setEditingField(null);
      setFieldForm({ module: '', field_name: '', field_label: '', field_type: 'text', options: '', required: false });
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
          <TabsTrigger value="custom-fields" className="text-xs sm:text-sm" data-testid="tab-custom-fields"><Columns3 className="w-4 h-4 mr-1 hidden sm:inline" />Xüsusi sahələr</TabsTrigger>
          <TabsTrigger value="users" className="text-xs sm:text-sm" data-testid="tab-users"><Users className="w-4 h-4 mr-1 hidden sm:inline" />İstifadəçilər</TabsTrigger>
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
                    <Button variant="ghost" size="sm" onClick={() => { setEditingPackage(pkg); setPackageForm({ name: pkg.name, description: pkg.description || '', price: pkg.price || 0 }); }} data-testid={`package-edit-${pkg.id}`}>
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
              <h2 className="text-lg font-semibold" style={{ color: '#3D4F6F' }}>Layihələr</h2>
            </div>
            <form onSubmit={handleProjectSubmit} className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-slate-50 rounded-lg" data-testid="project-form">
              <div className="flex-1">
                <Label className="text-xs mb-1">Layihə adı *</Label>
                <Input value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} placeholder="Layihə adı" className="text-sm" required data-testid="project-name-input" />
              </div>
              <div className="flex-1">
                <Label className="text-xs mb-1">Təsvir</Label>
                <Input value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} placeholder="Təsvir" className="text-sm" data-testid="project-desc-input" />
              </div>
              <div className="flex gap-2 items-end">
                <Button type="submit" size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="project-submit-btn">
                  {editingProject ? 'Yenilə' : 'Əlavə et'}
                </Button>
                {editingProject && (
                  <Button type="button" variant="outline" size="sm" onClick={() => { setEditingProject(null); setProjectForm({ name: '', description: '' }); }} data-testid="project-cancel-btn">Ləğv</Button>
                )}
              </div>
            </form>
            <div className="space-y-2">
              {projects.map(prj => (
                <div key={prj.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors" data-testid={`project-item-${prj.id}`}>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-[#3D4F6F]">{prj.name}</p>
                    {prj.description && <p className="text-xs text-slate-500 mt-0.5">{prj.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingProject(prj); setProjectForm({ name: prj.name, description: prj.description || '' }); }} data-testid={`project-edit-${prj.id}`}>
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
      </Tabs>

      {/* Custom Field Modal */}
      <Dialog open={showFieldModal} onOpenChange={setShowFieldModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>{editingField ? 'Sahəni redaktə et' : 'Xüsusi sahə əlavə et'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFieldSubmit} className="space-y-4" data-testid="field-form">
            <div>
              <Label className="text-xs">Modul *</Label>
              <Select value={fieldForm.module} onValueChange={(v) => setFieldForm({ ...fieldForm, module: v })}>
                <SelectTrigger className="text-sm" data-testid="field-module-select"><SelectValue placeholder="Modul seçin" /></SelectTrigger>
                <SelectContent>
                  {MODULES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
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
