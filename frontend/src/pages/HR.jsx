import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Plus, Download, Search, Filter, X, Loader2, User, Phone, Mail, 
  MoreVertical, Eye, ChevronLeft, Calendar, Briefcase, GraduationCap,
  MapPin, CreditCard, Clock, ChevronDown, Pencil, Trash2, Upload, MinusCircle, PlusCircle, FileText, Image, Building
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Toaster, toast } from 'sonner';
import * as XLSX from 'xlsx';
import { ScrollArea } from '../components/ui/scroll-area';
import CustomFieldsView from '../components/CustomFieldsView';
import ExcelColumnPicker from '../components/ExcelColumnPicker';
import { usePermissions, canEdit } from '../context/PermissionContext';
import { formatDate } from '../lib/dateUtils';
import { DatePickerAz, TimeSelectAz } from '../components/DateTimePickerAz';
import { validateRequired } from '../lib/validate';
import { createUnicodePdf } from '../lib/pdfHelpers';
import autoTable from 'jspdf-autotable';
import { FileDown } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getStatusColor = (status) => {
  switch (status) {
    case 'Aktiv': return 'bg-green-100 text-green-700';
    case 'Qeyri-aktiv': return 'bg-red-100 text-red-700';
    case 'Sınaq müddətində': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-600';
  }
};

const InfoCard = ({ icon: Icon, label, value }) => (
  <div className="bg-white border border-slate-100 rounded-xl p-4">
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-slate-50">
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className="text-sm font-medium text-slate-700 break-words">{value || '-'}</p>
      </div>
    </div>
  </div>
);

const ProfileAvatar = ({ employee, size = 'md' }) => {
  const sizeClasses = { sm: 'w-8 h-8 text-sm', md: 'w-12 h-12 text-lg', lg: 'w-20 h-20 text-2xl' };
  const initial = employee.first_name?.charAt(0) || employee.full_name?.charAt(0) || 'E';
  const displayName = employee.first_name && employee.last_name ? `${employee.first_name} ${employee.last_name}` : employee.full_name;
  
  if (employee.photo_url) {
    return <img src={employee.photo_url.startsWith('http') ? employee.photo_url : `${process.env.REACT_APP_BACKEND_URL}${employee.photo_url}`} alt={displayName} className={`${sizeClasses[size]} rounded-full object-cover border-2 border-slate-200`} />;
  }
  return <div className={`${sizeClasses[size]} rounded-full bg-[#3D4F6F] flex items-center justify-center text-white font-bold`}>{initial}</div>;
};

const getDisplayName = (emp) => emp.first_name && emp.last_name ? `${emp.first_name} ${emp.last_name}` : emp.full_name || '';

// Per-employee PDF — A4 portrait with a structured one-pager of personal +
// employment + contact info, including the avatar/photo if available. Lets
// HR print or email a single employee's dossier without exposing the whole
// list.
const exportEmployeePdf = async (emp) => {
  const doc = createUnicodePdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const name = getDisplayName(emp) || 'İşçi';
  doc.setFontSize(18);
  doc.text('İşçi məlumat kartı', 14, 18);
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text(`ID: ${emp.employee_code || emp.id || '-'}    |    Çap tarixi: ${formatDate(new Date().toISOString())}`, 14, 25);
  doc.setDrawColor(220);
  doc.line(14, 28, 196, 28);

  // --- Photo (top-right) ---
  if (emp.photo_url) {
    try {
      const url = emp.photo_url.startsWith('http')
        ? emp.photo_url
        : `${process.env.REACT_APP_BACKEND_URL}${emp.photo_url}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const blob = await resp.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const m = /^data:image\/(\w+);/.exec(String(dataUrl));
        const fmt = (m ? m[1] : 'jpeg').toUpperCase();
        // 30x30mm square photo at top-right
        doc.addImage(dataUrl, fmt, 166, 4, 30, 30, undefined, 'FAST');
      }
    } catch (_e) {
      // Silent fallback — PDF still renders fine without the photo.
    }
  }

  // --- Şəxsi məlumatlar ---
  autoTable(doc, {
    startY: 32,
    head: [['Şəxsi məlumatlar', '']],
    body: [
      ['Ad Soyad', name],
      ['Ad', emp.first_name || '-'],
      ['Soyad', emp.last_name || '-'],
      ['FİN', emp.fin || '-'],
      ['Şəxsiyyət vəsiqəsi', emp.id_number || '-'],
      ['Doğum tarixi', emp.birth_date ? formatDate(emp.birth_date) : '-'],
      ['Cins', emp.gender || '-'],
      ['Ailə vəziyyəti', emp.marital_status || '-'],
      ['Vətəndaşlıq', emp.citizenship || '-'],
    ],
    styles: { font: 'Roboto', fontStyle: 'normal', fontSize: 9, cellPadding: 2.5, textColor: [61, 79, 111] },
    headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [61, 79, 111], textColor: 255 },
    columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 'auto' } },
  });

  // --- Vəzifə məlumatları ---
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['Vəzifə məlumatları', '']],
    body: [
      ['Müəssisə', emp.company || '-'],
      ['Şöbə', emp.department || '-'],
      ['Vəzifə', emp.position || '-'],
      ['İşə qəbul tarixi', emp.hire_date ? formatDate(emp.hire_date) : '-'],
      ['Status', emp.status || '-'],
      ['Maaş', emp.salary != null && emp.salary !== '' ? `${emp.salary} AZN` : '-'],
      ['İş rejimi', emp.work_mode || '-'],
    ],
    styles: { font: 'Roboto', fontStyle: 'normal', fontSize: 9, cellPadding: 2.5, textColor: [61, 79, 111] },
    headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [154, 205, 50], textColor: [61, 79, 111] },
    columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 'auto' } },
  });

  // --- Əlaqə ---
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['Əlaqə', '']],
    body: [
      ['Şəxsi telefon', emp.personal_phone || '-'],
      ['İş telefonu', emp.work_phone || '-'],
      ['Email', emp.email || '-'],
      ['Şəxsi email', emp.personal_email || '-'],
      ['Ünvan', emp.address || '-'],
    ],
    styles: { font: 'Roboto', fontStyle: 'normal', fontSize: 9, cellPadding: 2.5, textColor: [61, 79, 111] },
    headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [61, 79, 111], textColor: 255 },
    columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 'auto' } },
  });

  // --- Təhsil/Notes (free-form) ---
  if (emp.education || emp.notes) {
    let y = doc.lastAutoTable.finalY + 8;
    if (emp.education) {
      doc.setFontSize(11); doc.setTextColor(61, 79, 111);
      doc.text('Təhsil', 14, y);
      doc.setFontSize(10); doc.setTextColor(80);
      const lines = doc.splitTextToSize(String(emp.education), 180);
      doc.text(lines, 14, y + 5);
      y += 5 + lines.length * 5 + 4;
    }
    if (emp.notes) {
      doc.setFontSize(11); doc.setTextColor(61, 79, 111);
      doc.text('Qeydlər', 14, y);
      doc.setFontSize(10); doc.setTextColor(80);
      const lines = doc.splitTextToSize(String(emp.notes), 180);
      doc.text(lines, 14, y + 5);
    }
  }

  const safe = (emp.employee_code || name).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
  doc.save(`isci_${safe}.pdf`);
  toast.success('PDF yükləndi');
};

// Reusable single-document upload card with consistent UI
const DocumentUploadCard = ({ label, value, onUpload, onClear, testId, accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx' }) => {
  const fileName = value ? (typeof value === 'object' ? value.name : decodeURIComponent(value.split('/').pop()?.split('?')[0] || 'Sənəd')) : '';
  const fileUrl = typeof value === 'object' ? value?.url : value;
  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-white hover:bg-slate-50 transition-colors">
      <Label className="text-xs font-semibold text-slate-700 block mb-2">{label}</Label>
      {value ? (
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-2.5 py-1.5">
          <FileText className="w-4 h-4 text-slate-500 shrink-0" />
          <a href={fileUrl?.startsWith?.('http') ? fileUrl : `${process.env.REACT_APP_BACKEND_URL}${fileUrl}`} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-700 hover:underline truncate flex-1" title={fileName}>{fileName}</a>
          <Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-6 w-6 p-0"><X className="w-3.5 h-3.5 text-red-500" /></Button>
        </div>
      ) : (
        <label className="cursor-pointer block">
          <input type="file" accept={accept} onChange={onUpload} className="hidden" data-testid={`${testId}-upload`} />
          <span className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-dashed border-slate-300 transition-colors">
            <Upload className="w-3.5 h-3.5" /> Fayl seç
          </span>
        </label>
      )}
    </div>
  );
};

// Employee Detail View
const EmployeeDetail = ({ employee, onBack, onEdit, customFields = [] }) => {
  if (!employee) return null;
  const displayName = getDisplayName(employee);
  
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-1" /> Geri</Button>
          <div className="flex items-center gap-3">
            <ProfileAvatar employee={employee} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold" style={{ color: '#3D4F6F' }}>{displayName}</h1>
                {employee.employee_code && <Badge className="bg-slate-200 text-slate-700 text-xs">{employee.employee_code}</Badge>}
              </div>
              <p className="text-sm text-slate-500">{employee.position} • {employee.department}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className={getStatusColor(employee.status)}>{employee.status}</Badge>
          <Button size="sm" onClick={() => onEdit(employee)}><Pencil className="w-4 h-4 mr-1" /> Redaktə</Button>
        </div>
      </div>

      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="personal" className="text-xs sm:text-sm">Şəxsi</TabsTrigger>
          <TabsTrigger value="education" className="text-xs sm:text-sm">Təhsil</TabsTrigger>
          <TabsTrigger value="experience" className="text-xs sm:text-sm">İş təcrübəsi</TabsTrigger>
          <TabsTrigger value="contact" className="text-xs sm:text-sm">Əlaqə</TabsTrigger>
          <TabsTrigger value="contract" className="text-xs sm:text-sm">Müqavilə</TabsTrigger>
          <TabsTrigger value="salary" className="text-xs sm:text-sm">Əmək haqqı</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs sm:text-sm">Sənədlər</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard icon={CreditCard} label="Əməkdaş ID" value={employee.employee_code} />
            <InfoCard icon={User} label="Ad" value={employee.first_name} />
            <InfoCard icon={User} label="Soyad" value={employee.last_name} />
            <InfoCard icon={User} label="Ata adı" value={employee.father_name} />
            <InfoCard icon={Calendar} label="Doğum tarixi" value={employee.birth_date} />
            <InfoCard icon={User} label="Cins" value={employee.gender} />
            <InfoCard icon={CreditCard} label="Ş.V. seriya №" value={employee.id_card_number} />
            <InfoCard icon={CreditCard} label="FİN kod" value={employee.fin_code} />
            <InfoCard icon={User} label="Ailə vəziyyəti" value={employee.marital_status} />
            <InfoCard icon={User} label="Uşaq sayı" value={employee.children_count?.toString()} />
          </div>
          {employee.children_birth_dates?.length > 0 && (
            <div className="bg-blue-50 rounded-xl p-4">
              <h4 className="font-semibold text-blue-800 mb-2 text-sm">Uşaqların doğum tarixləri</h4>
              <div className="flex flex-wrap gap-2">
                {employee.children_birth_dates.map((d, i) => (
                  <Badge key={i} className="bg-blue-100 text-blue-700">{i+1}. uşaq: {d || '-'}</Badge>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="education" className="space-y-4">
          {employee.educations?.length > 0 ? employee.educations.map((edu, i) => (
            <div key={i} className="p-4 bg-slate-50 rounded-xl space-y-2">
              <h4 className="font-semibold text-sm text-[#3D4F6F]">Təhsil {i + 1}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoCard icon={GraduationCap} label="Təhsil səviyyəsi" value={edu.education_level} />
                <InfoCard icon={GraduationCap} label="Təhsil müəssisəsi" value={edu.education_institution} />
                <InfoCard icon={GraduationCap} label="İxtisas" value={edu.specialty} />
                <InfoCard icon={Calendar} label="Qəbul tarixi" value={edu.admission_date} />
                <InfoCard icon={Calendar} label="Bitirdiyi tarix" value={edu.graduation_date} />
              </div>
            </div>
          )) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoCard icon={GraduationCap} label="Təhsil səviyyəsi" value={employee.education_level} />
              <InfoCard icon={GraduationCap} label="Təhsil müəssisəsi" value={employee.education_institution} />
              <InfoCard icon={GraduationCap} label="İxtisas" value={employee.specialty} />
              <InfoCard icon={Calendar} label="Qəbul tarixi" value={employee.admission_date} />
              <InfoCard icon={Calendar} label="Bitirdiyi tarix" value={employee.graduation_date} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="experience" className="space-y-4">
          {employee.work_experiences?.length > 0 ? employee.work_experiences.map((we, i) => (
            <div key={i} className="p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="w-4 h-4 text-[#3D4F6F]" />
                <h4 className="font-semibold text-sm text-[#3D4F6F]">{we.company_name || `İş yeri ${i+1}`}</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoCard icon={Briefcase} label="Müəssisənin adı" value={we.company_name} />
                <InfoCard icon={Briefcase} label="Vəzifəsi" value={we.position} />
                <InfoCard icon={Calendar} label="İşə başlama tarixi" value={we.start_date} />
                <InfoCard icon={Calendar} label="Xitam verilmə tarixi" value={we.end_date} />
                <InfoCard icon={User} label="Çıxma səbəbi" value={we.leave_reason} />
              </div>
            </div>
          )) : (
            <p className="text-center text-slate-400 py-8">Əvvəlki iş təcrübəsi qeyd edilməyib</p>
          )}
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard icon={MapPin} label="Qeydiyyat ünvanı" value={employee.registration_address} />
            <InfoCard icon={MapPin} label="Faktiki ünvan" value={employee.actual_address} />
            <InfoCard icon={Phone} label="Korporativ telefon" value={employee.company_phone} />
            <InfoCard icon={Phone} label="Şəxsi telefon" value={employee.personal_phone} />
            <InfoCard icon={Mail} label="Şəxsi email" value={employee.personal_email} />
            <InfoCard icon={Mail} label="Korporativ email" value={employee.corporate_email} />
          </div>
          <div className="bg-amber-50 rounded-xl p-4 mt-4">
            <h4 className="font-semibold text-amber-800 mb-2">Təcili əlaqə</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div><span className="text-amber-600">Ad:</span> {employee.emergency_contact_name || '-'}</div>
              <div><span className="text-amber-600">Yaxınlıq:</span> {employee.emergency_contact_relation || '-'}</div>
              <div><span className="text-amber-600">Telefon:</span> {employee.emergency_contact_phone || '-'}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contract" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard icon={Briefcase} label="Şöbə" value={employee.department} />
            <InfoCard icon={Briefcase} label="Vəzifə" value={employee.position} />
            <InfoCard icon={Building} label="Marsol müəssisəsi" value={employee.marsol_company} />
            <InfoCard icon={Calendar} label="Müqavilənin bağlanma tarixi" value={employee.contract_signing_date || employee.contract_start_date} />
            <InfoCard icon={Calendar} label="İşə başlama tarixi" value={employee.work_start_date} />
            <InfoCard icon={Calendar} label="Müqavilənin bitmə tarixi" value={employee.contract_indefinite ? 'Müddətsiz' : employee.contract_end_date} />
            <InfoCard icon={Calendar} label="Sınaq müddəti bitmə" value={employee.probation_end_date} />
            <InfoCard icon={Briefcase} label="Vəzifə dəyişikliyi" value={employee.position_change ? 'Bəli' : 'Xeyr'} />
            <InfoCard icon={Briefcase} label="Əməyin ödənilməsi" value={employee.payment_system} />
            <InfoCard icon={Clock} label="İş qrafiki" value={employee.work_schedule} />
            <InfoCard icon={Calendar} label="Əsas məzuniyyət" value={`${employee.main_vacation_days || 21} gün`} />
            <InfoCard icon={Calendar} label="Əlavə məzuniyyət" value={`${employee.additional_vacation_days || 0} gün`} />
            <InfoCard icon={Clock} label="Xatırlatma" value={employee.reminders?.length > 0 ? `${employee.reminders.length} xatırlatma` : 'Yoxdur'} />
          </div>
          {employee.reminders?.length > 0 && (
            <div className="p-4 bg-amber-50 rounded-xl mt-4">
              <h4 className="font-semibold text-sm text-amber-800 mb-2">Xatırlatmalar</h4>
              <div className="space-y-2">
                {employee.reminders.map((rem, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white rounded-lg p-2 text-sm">
                    <Badge className="bg-amber-100 text-amber-700">{i+1}</Badge>
                    <span>{rem.date || '-'}</span>
                    <span className="text-slate-500">{rem.time || '-'}</span>
                    <span className="text-slate-600 flex-1">{rem.note || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(employee.position_instructions_file || employee.employment_contract_file || employee.position_change_file) && (
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold text-sm text-slate-700 mb-3">Müqavilə sənədləri</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {employee.position_instructions_file && (
                  <a href={employee.position_instructions_file.startsWith('http') ? employee.position_instructions_file : `${process.env.REACT_APP_BACKEND_URL}${employee.position_instructions_file}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100"><FileText className="w-5 h-5 text-blue-500" /><span className="text-sm">Vəzifə təlimatları</span></a>
                )}
                {employee.employment_contract_file && (
                  <a href={employee.employment_contract_file.startsWith('http') ? employee.employment_contract_file : `${process.env.REACT_APP_BACKEND_URL}${employee.employment_contract_file}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100"><FileText className="w-5 h-5 text-green-500" /><span className="text-sm">Əmək müqaviləsi</span></a>
                )}
                {employee.position_change_file && (
                  <a href={employee.position_change_file.startsWith('http') ? employee.position_change_file : `${process.env.REACT_APP_BACKEND_URL}${employee.position_change_file}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100"><FileText className="w-5 h-5 text-amber-500" /><span className="text-sm">Vəzifə dəyişikliyi</span></a>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="salary" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-xl p-5 text-center">
              <p className="text-xs text-slate-500 mb-1">Gross əmək haqqı</p>
              <p className="text-2xl font-bold" style={{ color: '#3D4F6F' }}>{(employee.gross_salary || 0).toLocaleString()} AZN</p>
            </div>
            <div className="bg-green-50 rounded-xl p-5 text-center">
              <p className="text-xs text-green-600 mb-1">Net əmək haqqı</p>
              <p className="text-2xl font-bold text-green-600">{(employee.net_salary || 0).toLocaleString()} AZN</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-5 text-center">
              <p className="text-xs text-blue-600 mb-1">Əlavə</p>
              <p className="text-2xl font-bold text-blue-600">{(employee.salary_supplement || 0).toLocaleString()} AZN</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-5 text-center">
              <p className="text-xs text-amber-600 mb-1">Mükafatlar</p>
              <p className="text-lg font-bold text-amber-600">{employee.bonuses || '-'}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employee.criminal_record_scan && (
              <a href={employee.criminal_record_scan.startsWith('http') ? employee.criminal_record_scan : `${process.env.REACT_APP_BACKEND_URL}${employee.criminal_record_scan}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100">
                <FileText className="w-5 h-5 text-red-500" /><span className="text-sm font-medium">Məhkumluq skanı</span>
              </a>
            )}
            {employee.health_certificate_scan && (
              <a href={employee.health_certificate_scan.startsWith('http') ? employee.health_certificate_scan : `${process.env.REACT_APP_BACKEND_URL}${employee.health_certificate_scan}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100">
                <FileText className="w-5 h-5 text-green-500" /><span className="text-sm font-medium">Sağlamlıq arayışı</span>
              </a>
            )}
          </div>
          {employee.certificate_scans?.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm text-amber-800 mb-2">Sertifikatlar</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {employee.certificate_scans.map((cert, i) => {
                  const certUrl = typeof cert === 'string' ? cert : cert.url;
                  const certName = typeof cert === 'string' ? `Sertifikat ${i+1}` : cert.name;
                  const fullUrl = certUrl.startsWith('http') ? certUrl : `${process.env.REACT_APP_BACKEND_URL}${certUrl}`;
                  return (
                    <a key={i} href={fullUrl} download className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl hover:bg-amber-100">
                      <GraduationCap className="w-5 h-5 text-amber-500 shrink-0" /><span className="text-sm truncate">{certName}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
          {employee.document_scans?.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm text-slate-700 mb-2">Digər sənədlər</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {employee.document_scans.map((doc, i) => {
                  const docUrl = typeof doc === 'string' ? doc : doc.url;
                  const docName = typeof doc === 'string' ? `Sənəd ${i+1}` : doc.name;
                  const fullUrl = docUrl.startsWith('http') ? docUrl : `${process.env.REACT_APP_BACKEND_URL}${docUrl}`;
                  return (
                    <a key={i} href={fullUrl} download className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100">
                      <FileText className="w-5 h-5 text-blue-500 shrink-0" /><span className="text-sm truncate">{docName}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
          {!employee.criminal_record_scan && !employee.health_certificate_scan && (!employee.certificate_scans || employee.certificate_scans.length === 0) && (!employee.document_scans || employee.document_scans.length === 0) && (
            <p className="text-center text-slate-400 py-8">Sənəd yoxdur</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Custom fields — show every filled custom field grouped by sub_tab */}
      <CustomFieldsView fields={customFields} entity={employee} groupByTab />
    </div>
  );
};

// Mobile Card
const EmployeeCard = ({ employee, onView, onEdit, onDelete }) => {
  const displayName = getDisplayName(employee);
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <ProfileAvatar employee={employee} size="sm" />
          <div>
            <h3 className="font-semibold text-[#3D4F6F]">{displayName}</h3>
            <p className="text-xs text-slate-500">{employee.employee_code} • {employee.position}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(employee)}><Eye className="w-4 h-4 mr-2" />Ətraflı</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportEmployeePdf(employee)} data-testid={`pdf-emp-${employee.id}`}><FileDown className="w-4 h-4 mr-2" />PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(employee)}><Pencil className="w-4 h-4 mr-2" />Redaktə</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(employee.id)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" />Sil</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-slate-600"><Briefcase className="w-3.5 h-3.5" /><span>{employee.department}</span></div>
        <div className="flex items-center gap-2 text-slate-600"><Phone className="w-3.5 h-3.5" /><span>{employee.personal_phone}</span></div>
        <div className="flex items-center justify-between mt-2">
          <Badge className={`text-xs ${getStatusColor(employee.status)}`}>{employee.status}</Badge>
          <span className="text-xs text-slate-500 truncate max-w-[60%]" title={employee.marsol_company}>{employee.marsol_company || '-'}</span>
        </div>
      </div>
    </div>
  );
};

const CustomFieldsRenderer = ({ fields, tabName, formData, setFormData }) => {
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
              <Input type={cf.field_type==='number'||cf.field_type==='amount'?'number':cf.field_type==='date'?'date':cf.field_type==='email'?'email':'text'} value={formData[cf.field_name]||''} onChange={e => setFormData({...formData, [cf.field_name]:e.target.value})} className="text-sm" placeholder={cf.field_type==='amount'?'0.00':''} required={cf.required} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function HR() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('personal');
  const [filters, setFilters] = useState({ department: '', status: '' });
  const [uploading, setUploading] = useState(false);
  const [options, setOptions] = useState({});
  const [customFields, setCustomFields] = useState([]);

  const departments = ['Satış', 'Marketing', 'HR', 'Maliyyə', 'Layihə', 'İT', 'İdarəetmə'];
  const statuses = ['Aktiv', 'Qeyri-aktiv', 'Sınaq müddətində'];
  const genders = ['Kişi', 'Qadın'];
  const educationLevels = ['Ali', 'Orta-ixtisas', 'Orta', 'Natamam ali'];
  const maritalStatuses = ['Evli', 'Subay', 'Boşanmış'];

  const emptyEducation = { education_level: '', education_institution: '', specialty: '', admission_date: '', graduation_date: '' };
  const emptyWorkExperience = { company_name: '', start_date: '', end_date: '', leave_reason: '', position: '' };
  const emptyReminder = { date: '', time: '09:00', note: '' };

  const initialFormData = {
    photo_url: '', first_name: '', last_name: '', father_name: '', birth_date: '', gender: '',
    id_card_number: '', fin_code: '',
    educations: [{ ...emptyEducation }],
    work_experiences: [],
    marital_status: '', children_count: 0, children_birth_dates: [],
    registration_address: '', actual_address: '',
    company_phone: '', personal_phone: '', personal_email: '', corporate_email: '',
    emergency_contact_name: '', emergency_contact_relation: '', emergency_contact_phone: '',
    department: '', position: '', marsol_company: '', contract_signing_date: '', work_start_date: '',
    contract_end_date: '', contract_indefinite: false, probation_end_date: '',
    contract_reminder: true, reminders: [{ date: '', time: '09:00', note: 'Müqavilə bitməsinə 1 ay qalmış' }],
    position_change: false,
    salary_supplement: 0, bonuses: '', payment_system: '',
    position_instructions_file: '', employment_contract_file: '', position_change_file: '',
    main_vacation_days: 21, additional_vacation_days: 0,
    gross_salary: 0, net_salary: 0, work_schedule: '',
    criminal_record_scan: '', health_certificate_scan: '', certificate_scans: [], document_scans: [],
    status: 'Aktiv'
  };

  const [formData, setFormData] = useState(initialFormData);

  const token = localStorage.getItem('token');
  const { permissions } = usePermissions();
  const _canEdit = canEdit(permissions, 'hr');
  const headers = { Authorization: `Bearer ${token}` };

  const uploadFile = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      setUploading(true);
      const res = await axios.post(`${API}/upload`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
      return res.data.url;
    } catch { toast.error('Fayl yüklənmədi'); return ''; }
    finally { setUploading(false); }
  };

  const handleFileUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await uploadFile(file);
    if (url) setFormData(prev => ({ ...prev, [field]: url }));
  };

  const handleMultiFileUpload = async (e, field = 'document_scans') => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const items = [];
    for (const file of files) {
      const url = await uploadFile(file);
      if (url) items.push({ url, name: file.name });
    }
    setFormData(prev => ({ ...prev, [field]: [...(prev[field] || []), ...items] }));
  };

  const addEducation = () => setFormData(prev => ({ ...prev, educations: [...(prev.educations || []), { ...emptyEducation }] }));
  const removeEducation = (idx) => { if ((formData.educations || []).length <= 1) return; setFormData(prev => ({ ...prev, educations: prev.educations.filter((_, i) => i !== idx) })); };
  const updateEducation = (idx, field, value) => { const eds = [...(formData.educations || [])]; eds[idx] = { ...eds[idx], [field]: value }; setFormData({ ...formData, educations: eds }); };

  // Work experience helpers
  const addWorkExperience = () => setFormData(prev => ({ ...prev, work_experiences: [...(prev.work_experiences || []), { ...emptyWorkExperience }] }));
  const removeWorkExperience = (idx) => setFormData(prev => ({ ...prev, work_experiences: prev.work_experiences.filter((_, i) => i !== idx) }));
  const updateWorkExperience = (idx, field, value) => { const wes = [...(formData.work_experiences || [])]; wes[idx] = { ...wes[idx], [field]: value }; setFormData({ ...formData, work_experiences: wes }); };

  // Reminder helpers
  const addReminder = () => setFormData(prev => ({ ...prev, reminders: [...(prev.reminders || []), { ...emptyReminder }] }));
  const removeReminder = (idx) => setFormData(prev => ({ ...prev, reminders: prev.reminders.filter((_, i) => i !== idx) }));
  const updateReminder = (idx, field, value) => { const rs = [...(formData.reminders || [])]; rs[idx] = { ...rs[idx], [field]: value }; setFormData({ ...formData, reminders: rs }); };

  const updateChildrenCount = (delta) => {
    const newCount = Math.max(0, (formData.children_count || 0) + delta);
    const dates = [...(formData.children_birth_dates || [])];
    while (dates.length < newCount) dates.push('');
    setFormData({ ...formData, children_count: newCount, children_birth_dates: dates.slice(0, newCount) });
  };

  const updateChildDate = (idx, value) => {
    const dates = [...(formData.children_birth_dates || [])];
    dates[idx] = value;
    setFormData({ ...formData, children_birth_dates: dates });
  };

  const fetchEmployees = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => { if (value && value !== 'all') params.append(key, value); });
      const response = await axios.get(`${API}/employees?${params.toString()}`, { headers });
      setEmployees(response.data);
    } catch { toast.error('Əməkdaşlar yüklənmədi'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  useEffect(() => {
    const fetchOpts = async () => {
      try {
        const [optRes, cfRes] = await Promise.all([
          axios.get(`${API}/options/all`, { headers }),
          axios.get(`${API}/settings/custom-fields?module=hr`, { headers }),
        ]);
        setOptions(optRes.data);
        setCustomFields(cfRes.data);
      } catch (err) { console.error(err); }
    };
    fetchOpts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateRequired([
      [formData.first_name, 'Ad'],
      [formData.last_name, 'Soyad'],
      [formData.gender, 'Cins'],
      [formData.personal_phone, 'Şəxsi telefon'],
      [formData.department, 'Şöbə'],
      [formData.position, 'Vəzifə'],
    ])) return;
    // Build full_name for backward compat
    const submitData = { ...formData, full_name: `${formData.first_name} ${formData.last_name}`.trim() };
    try {
      if (editingEmployee) {
        await axios.put(`${API}/employees/${editingEmployee.id}`, submitData, { headers });
        toast.success('Əməkdaş yeniləndi');
      } else {
        await axios.post(`${API}/employees`, submitData, { headers });
        toast.success('Yeni əməkdaş əlavə edildi');
      }
      setShowModal(false); setEditingEmployee(null); setFormData(initialFormData); fetchEmployees();
    } catch (error) { toast.error(error.response?.data?.detail || 'Xəta baş verdi'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu əməkdaşı silmək istədiyinizə əminsiniz?')) return;
    try { await axios.delete(`${API}/employees/${id}`, { headers }); toast.success('Əməkdaş silindi'); fetchEmployees(); }
    catch { toast.error('Silinmə zamanı xəta'); }
  };

  const handleEdit = (emp) => {
    setEditingEmployee(emp);
    const data = { ...initialFormData, ...emp };
    if (!data.first_name && data.full_name) {
      const parts = data.full_name.split(' ');
      data.first_name = parts[0] || '';
      data.last_name = parts.slice(1).join(' ') || '';
    }
    if (!data.children_birth_dates) data.children_birth_dates = [];
    while (data.children_birth_dates.length < (data.children_count || 0)) data.children_birth_dates.push('');
    if (!data.personal_email && data.email) data.personal_email = data.email;
    // Backward compat: migrate old single education to educations array
    if (!data.educations || data.educations.length === 0) {
      data.educations = [{ education_level: data.education_level || '', education_institution: data.education_institution || '', specialty: data.specialty || '', admission_date: data.admission_date || '', graduation_date: data.graduation_date || '' }];
    }
    // Backward compat: contract_start_date → contract_signing_date
    if (!data.contract_signing_date && data.contract_start_date) data.contract_signing_date = data.contract_start_date;
    if (!data.certificate_scans) data.certificate_scans = [];
    if (!data.document_scans) data.document_scans = [];
    if (!data.work_experiences) data.work_experiences = [];
    if (!data.reminders) data.reminders = data.contract_reminder ? [{ date: '', time: '09:00', note: 'Müqavilə bitməsinə 1 ay qalmış' }] : [];
    // Normalize old string-based document_scans to {url, name} objects
    data.document_scans = (data.document_scans || []).map(d => typeof d === 'string' ? { url: d, name: d.split('/').pop() } : d);
    data.certificate_scans = (data.certificate_scans || []).map(d => typeof d === 'string' ? { url: d, name: d.split('/').pop() } : d);
    setFormData(data);
    setActiveTab('personal');
    setShowModal(true);
  };

  const HR_EXPORT_COLUMNS = [
    { key: 'no', label: '№', width: 4, get: (_, i) => i + 1 },
    { key: 'employee_code', label: 'ID', width: 8 },
    { key: 'first_name', label: 'Ad', width: 16 },
    { key: 'last_name', label: 'Soyad', width: 16 },
    { key: 'department', label: 'Şöbə', width: 18 },
    { key: 'position', label: 'Vəzifə', width: 22 },
    { key: 'personal_phone', label: 'Telefon', width: 18 },
    { key: 'personal_email', label: 'Email', width: 26, get: (e) => e.personal_email || e.email || '' },
    { key: 'birth_date', label: 'Doğum tarixi', width: 13 },
    { key: 'hire_date', label: 'İşə başlama', width: 13 },
    { key: 'citizenship', label: 'Vətəndaşlıq', width: 14 },
    { key: 'education', label: 'Təhsil', width: 18 },
    { key: 'gross_salary', label: 'Gross maaş', width: 12, get: (e) => Number(e.gross_salary || 0) },
    { key: 'net_salary', label: 'Net maaş', width: 12, get: (e) => Number(e.net_salary || 0) },
    { key: 'status', label: 'Status', width: 12 },
  ];
  const HR_DEFAULT_KEYS = HR_EXPORT_COLUMNS.map(c => c.key);
  const [showExportModal, setShowExportModal] = useState(false);
  const exportToExcel = () => setShowExportModal(true);

  const filteredEmployees = employees.filter(e => {
    const name = getDisplayName(e).toLowerCase();
    const term = searchTerm.toLowerCase();
    return name.includes(term) || e.position?.toLowerCase().includes(term) || e.department?.toLowerCase().includes(term) || e.employee_code?.toLowerCase().includes(term);
  });

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#3D4F6F' }} /></div>;

  if (viewingEmployee) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Toaster position="top-right" richColors />
        <EmployeeDetail employee={viewingEmployee} customFields={customFields} onBack={() => setViewingEmployee(null)} onEdit={(e) => { setViewingEmployee(null); handleEdit(e); }} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="hr-page">
      <Toaster position="top-right" richColors />
      
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Insan Resurları</h1>
          <p className="text-slate-500 text-sm mt-1">Cəmi {employees.length} əməkdaş</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={exportToExcel} variant="outline" size="sm" className="text-xs sm:text-sm" data-testid="export-btn">
            <Download className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Excel Export</span>
          </Button>
          <Button onClick={() => { setFormData(initialFormData); setEditingEmployee(null); setActiveTab('personal'); setShowModal(true); }}
            size="sm" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold text-xs sm:text-sm" data-testid="add-employee-btn">
            <Plus className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Əməkdaş əlavə et</span><span className="sm:hidden">Əlavə et</span>
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 sm:p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Axtar (ad, vəzifə, ID)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" data-testid="search-input" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}
            className={activeFilterCount > 0 ? 'border-[#9ACD32] bg-[#9ACD32]/10' : ''}>
            <Filter className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Filtrlər</span>
            {activeFilterCount > 0 && <Badge className="ml-1 bg-[#9ACD32] text-[#3D4F6F] text-xs">{activeFilterCount}</Badge>}
          </Button>
        </div>
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Şöbə</Label>
              <Select value={filters.department} onValueChange={(v) => setFilters({...filters, department: v})}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Hamısı</SelectItem>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Hamısı</SelectItem>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredEmployees.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl p-8 text-center"><User className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p className="text-slate-500">Əməkdaş tapılmadı</p></div>
        ) : filteredEmployees.map(emp => <EmployeeCard key={emp.id} employee={emp} onView={setViewingEmployee} onEdit={handleEdit} onDelete={handleDelete} />)}
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {['ID', 'Əməkdaş', 'Şöbə', 'Vəzifə', 'Telefon', 'Email', 'Müəssisə', 'Status', ''].map(h => (
                <th key={h} className={`text-left font-semibold text-[#3D4F6F] px-4 py-3 text-sm ${!h ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-slate-500"><User className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p>Əməkdaş tapılmadı</p></td></tr>
            ) : filteredEmployees.map(emp => (
              <tr key={emp.id} className="border-b border-slate-50 hover:bg-slate-50/50" data-testid={`employee-row-${emp.id}`}>
                <td className="px-4 py-3 text-xs text-slate-500 font-mono">{emp.employee_code}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ProfileAvatar employee={emp} size="sm" />
                    <span className="font-medium text-sm">{getDisplayName(emp)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{emp.department}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{emp.position}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{emp.personal_phone}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{emp.personal_email || emp.corporate_email || emp.email}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{emp.marsol_company || '-'}</td>
                <td className="px-4 py-3"><Badge className={`text-xs ${getStatusColor(emp.status)}`}>{emp.status}</Badge></td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><ChevronDown className="w-4 h-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewingEmployee(emp)}><Eye className="w-4 h-4 mr-2" />Ətraflı</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportEmployeePdf(emp)} data-testid={`pdf-emp-row-${emp.id}`}><FileDown className="w-4 h-4 mr-2" />PDF</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(emp)}><Pencil className="w-4 h-4 mr-2" />Redaktə</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(emp.id)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" />Sil</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 sm:p-6 pb-0">
            <DialogTitle className="text-lg font-bold" style={{ color: '#3D4F6F' }}>
              {editingEmployee ? 'Əməkdaşı redaktə et' : 'Yeni əməkdaş əlavə et'}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-120px)]">
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 pt-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="flex-wrap h-auto gap-1 mb-4">
                  <TabsTrigger value="personal" className="text-xs">Şəxsi</TabsTrigger>
                  <TabsTrigger value="education" className="text-xs">Təhsil</TabsTrigger>
                  <TabsTrigger value="experience" className="text-xs">İş təcrübəsi</TabsTrigger>
                  <TabsTrigger value="contact" className="text-xs">Əlaqə</TabsTrigger>
                  <TabsTrigger value="contract" className="text-xs">Müqavilə</TabsTrigger>
                  <TabsTrigger value="salary" className="text-xs">Əmək haqqı</TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs">Sənədlər</TabsTrigger>
                </TabsList>

                {/* ŞƏXSİ TAB */}
                <TabsContent value="personal" className="space-y-4" data-testid="personal-tab">
                  {/* Photo upload */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {formData.photo_url ? (
                        <img src={formData.photo_url.startsWith('http') ? formData.photo_url : `${process.env.REACT_APP_BACKEND_URL}${formData.photo_url}`} alt="Profile" className="w-20 h-24 rounded-lg object-cover border-2 border-slate-200" />
                      ) : (
                        <div className="w-20 h-24 rounded-lg bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center">
                          <Image className="w-6 h-6 text-slate-400" />
                          <span className="text-[10px] text-slate-400 mt-1">3x4</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs font-semibold">Profil şəkli (3x4)</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'photo_url')} className="hidden" data-testid="photo-upload" />
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                            <Upload className="w-3.5 h-3.5" /> {uploading ? 'Yüklənir...' : 'Şəkil seç'}
                          </span>
                        </label>
                        {formData.photo_url && <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, photo_url: ''})}><X className="w-3.5 h-3.5 text-red-500" /></Button>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Ad *</Label><Input value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} required className="text-sm" data-testid="first-name-input" placeholder="Ad" /></div>
                    <div><Label className="text-xs">Soyad *</Label><Input value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} required className="text-sm" data-testid="last-name-input" placeholder="Soyad" /></div>
                    <div><Label className="text-xs">Ata adı</Label><Input value={formData.father_name} onChange={(e) => setFormData({...formData, father_name: e.target.value})} className="text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Doğum tarixi</Label><Input type="date" value={formData.birth_date} onChange={(e) => setFormData({...formData, birth_date: e.target.value})} className="text-sm" /></div>
                    <div>
                      <Label className="text-xs">Cins *</Label>
                      <Select value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{genders.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Ailə vəziyyəti</Label>
                      <Select value={formData.marital_status} onValueChange={(v) => setFormData({...formData, marital_status: v})}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{maritalStatuses.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Ş.V. seriya №</Label><Input value={formData.id_card_number} onChange={(e) => setFormData({...formData, id_card_number: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">FİN kod</Label><Input value={formData.fin_code} onChange={(e) => setFormData({...formData, fin_code: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">Qeydiyyat ünvanı</Label><Input value={formData.registration_address} onChange={(e) => setFormData({...formData, registration_address: e.target.value})} className="text-sm" /></div>
                  </div>

                  {/* Children */}
                  <div className="p-3 bg-slate-50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Uşaqların sayı</Label>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => updateChildrenCount(-1)} className="h-8 w-8 p-0" data-testid="children-minus"><MinusCircle className="w-5 h-5 text-red-500" /></Button>
                        <span className="text-lg font-bold w-8 text-center" style={{ color: '#3D4F6F' }}>{formData.children_count || 0}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => updateChildrenCount(1)} className="h-8 w-8 p-0" data-testid="children-plus"><PlusCircle className="w-5 h-5 text-green-500" /></Button>
                      </div>
                    </div>
                    {formData.children_count > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {Array.from({ length: formData.children_count }).map((_, i) => (
                          <div key={i}>
                            <Label className="text-xs">{i+1}. uşağın doğum tarixi</Label>
                            <Input type="date" value={formData.children_birth_dates?.[i] || ''} onChange={(e) => updateChildDate(i, e.target.value)} className="text-sm" data-testid={`child-date-${i}`} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <CustomFieldsRenderer fields={customFields} tabName="personal" formData={formData} setFormData={setFormData} />
                </TabsContent>

                {/* TƏHSİL TAB */}
                <TabsContent value="education" className="space-y-4" data-testid="education-tab">
                  {(formData.educations || []).map((edu, ei) => (
                    <div key={ei} className="p-4 bg-slate-50 rounded-lg space-y-3 relative">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-[#3D4F6F]">Təhsil {ei + 1}</h4>
                        {(formData.educations || []).length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeEducation(ei)} data-testid={`remove-education-${ei}`}><X className="w-4 h-4 text-red-500" /></Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Təhsil səviyyəsi</Label>
                          <Select value={edu.education_level} onValueChange={(v) => updateEducation(ei, 'education_level', v)}>
                            <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                            <SelectContent>{educationLevels.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div><Label className="text-xs">Təhsil müəssisəsi</Label><Input value={edu.education_institution} onChange={(e) => updateEducation(ei, 'education_institution', e.target.value)} className="text-sm" placeholder="Universitet / Kollec" /></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div><Label className="text-xs">İxtisas</Label><Input value={edu.specialty} onChange={(e) => updateEducation(ei, 'specialty', e.target.value)} className="text-sm" placeholder="İxtisas adı" /></div>
                        <div><Label className="text-xs">Qəbul tarixi</Label><Input type="date" value={edu.admission_date} onChange={(e) => updateEducation(ei, 'admission_date', e.target.value)} className="text-sm" /></div>
                        <div><Label className="text-xs">Bitirdiyi tarix</Label><Input type="date" value={edu.graduation_date} onChange={(e) => updateEducation(ei, 'graduation_date', e.target.value)} className="text-sm" /></div>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addEducation} className="w-full border-dashed" data-testid="add-education-btn">
                    <PlusCircle className="w-4 h-4 mr-2 text-green-500" /> Təhsil əlavə et
                  </Button>
                  <CustomFieldsRenderer fields={customFields} tabName="education" formData={formData} setFormData={setFormData} />
                </TabsContent>

                {/* İŞ TƏCRÜBƏSİ TAB */}
                <TabsContent value="experience" className="space-y-4" data-testid="experience-tab">
                  {(formData.work_experiences || []).map((we, wi) => (
                    <div key={wi} className="p-4 bg-slate-50 rounded-lg space-y-3 relative">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-[#3D4F6F]">İş yeri {wi + 1}</h4>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeWorkExperience(wi)} data-testid={`remove-experience-${wi}`}><X className="w-4 h-4 text-red-500" /></Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><Label className="text-xs">Müəssisənin adı</Label><Input value={we.company_name} onChange={(e) => updateWorkExperience(wi, 'company_name', e.target.value)} className="text-sm" placeholder="Şirkət adı" data-testid={`experience-company-${wi}`} /></div>
                        <div><Label className="text-xs">Vəzifəsi</Label><Input value={we.position} onChange={(e) => updateWorkExperience(wi, 'position', e.target.value)} className="text-sm" placeholder="Vəzifə" /></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div><Label className="text-xs">İşə başlama tarixi</Label><Input type="date" value={we.start_date} onChange={(e) => updateWorkExperience(wi, 'start_date', e.target.value)} className="text-sm" /></div>
                        <div><Label className="text-xs">Xitam verilmə tarixi</Label><Input type="date" value={we.end_date} onChange={(e) => updateWorkExperience(wi, 'end_date', e.target.value)} className="text-sm" /></div>
                        <div><Label className="text-xs">Çıxma səbəbi</Label><Input value={we.leave_reason} onChange={(e) => updateWorkExperience(wi, 'leave_reason', e.target.value)} className="text-sm" placeholder="Səbəb" /></div>
                      </div>
                    </div>
                  ))}
                  {(formData.work_experiences || []).length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm">Əvvəlki iş təcrübəsi yoxdur</div>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={addWorkExperience} className="w-full border-dashed" data-testid="add-experience-btn">
                    <PlusCircle className="w-4 h-4 mr-2 text-green-500" /> İş yeri əlavə et
                  </Button>
                  <CustomFieldsRenderer fields={customFields} tabName="experience" formData={formData} setFormData={setFormData} />
                </TabsContent>

                {/* ƏLAQƏ TAB */}
                <TabsContent value="contact" className="space-y-4" data-testid="contact-tab">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Şəxsi telefon *</Label><Input value={formData.personal_phone} onChange={(e) => setFormData({...formData, personal_phone: e.target.value})} required className="text-sm" /></div>
                    <div><Label className="text-xs">Korporativ telefon</Label><Input value={formData.company_phone} onChange={(e) => setFormData({...formData, company_phone: e.target.value})} className="text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Şəxsi email</Label><Input type="email" value={formData.personal_email} onChange={(e) => setFormData({...formData, personal_email: e.target.value})} className="text-sm" data-testid="personal-email" /></div>
                    <div><Label className="text-xs">Korporativ email</Label><Input type="email" value={formData.corporate_email} onChange={(e) => setFormData({...formData, corporate_email: e.target.value})} className="text-sm" data-testid="corporate-email" /></div>
                  </div>
                  <div><Label className="text-xs">Faktiki ünvan</Label><Input value={formData.actual_address} onChange={(e) => setFormData({...formData, actual_address: e.target.value})} className="text-sm" /></div>
                  <h4 className="font-semibold text-sm text-slate-700 pt-2">Təcili əlaqə</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Ad</Label><Input value={formData.emergency_contact_name} onChange={(e) => setFormData({...formData, emergency_contact_name: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">Yaxınlıq dərəcəsi</Label><Input value={formData.emergency_contact_relation} onChange={(e) => setFormData({...formData, emergency_contact_relation: e.target.value})} className="text-sm" /></div>
                    <div><Label className="text-xs">Telefon</Label><Input value={formData.emergency_contact_phone} onChange={(e) => setFormData({...formData, emergency_contact_phone: e.target.value})} className="text-sm" /></div>
                  </div>
                  <CustomFieldsRenderer fields={customFields} tabName="contact" formData={formData} setFormData={setFormData} />
                </TabsContent>

                {/* MÜQAVİLƏ TAB */}
                <TabsContent value="contract" className="space-y-4" data-testid="contract-tab">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Şöbə *</Label>
                      <Select value={formData.department} onValueChange={(v) => setFormData({...formData, department: v})}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Vəzifə *</Label><Input value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} required className="text-sm" /></div>
                  </div>
                  <div>
                    <Label className="text-xs">Marsol müəssisəsi</Label>
                    <Select value={formData.marsol_company} onValueChange={(v) => setFormData({...formData, marsol_company: v})}>
                      <SelectTrigger className="text-sm" data-testid="marsol-company-select"><SelectValue placeholder="Müəssisə seçin" /></SelectTrigger>
                      <SelectContent>{options?.marsol_companies?.map(mc => <SelectItem key={mc} value={mc}>{mc}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Müqavilənin bağlanma tarixi</Label><Input type="date" value={formData.contract_signing_date} onChange={(e) => setFormData({...formData, contract_signing_date: e.target.value})} className="text-sm" data-testid="contract-signing-date" /></div>
                    <div><Label className="text-xs">İşə başlama tarixi</Label><Input type="date" value={formData.work_start_date} onChange={(e) => setFormData({...formData, work_start_date: e.target.value})} className="text-sm" data-testid="work-start-date" /></div>
                    <div>
                      <Label className="text-xs">Müqavilənin bitmə tarixi</Label>
                      <div className="flex items-center gap-2">
                        <Input type="date" value={formData.contract_indefinite ? '' : formData.contract_end_date} onChange={(e) => setFormData({...formData, contract_end_date: e.target.value})} className="text-sm flex-1" disabled={formData.contract_indefinite} />
                        <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                          <input type="checkbox" checked={formData.contract_indefinite || false} onChange={(e) => setFormData({...formData, contract_indefinite: e.target.checked, contract_end_date: e.target.checked ? '' : formData.contract_end_date})} className="rounded" data-testid="contract-indefinite" />
                          <span className="text-xs text-slate-600">Müddətsiz</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Sınaq müddətinin bitmə tarixi</Label><Input type="date" value={formData.probation_end_date} onChange={(e) => setFormData({...formData, probation_end_date: e.target.value})} className="text-sm" /></div>
                    <div>
                      <Label className="text-xs">Vəzifə dəyişikliyi</Label>
                      <Select value={formData.position_change ? 'Bəli' : 'Xeyr'} onValueChange={(v) => setFormData({...formData, position_change: v === 'Bəli'})}>
                        <SelectTrigger className="text-sm" data-testid="position-change-select"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="Bəli">Bəli</SelectItem><SelectItem value="Xeyr">Xeyr</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Xatırlatmalar */}
                  <div className="p-3 bg-amber-50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-amber-800">Xatırlatmalar</Label>
                      <Button type="button" variant="ghost" size="sm" onClick={addReminder} data-testid="add-reminder-btn">
                        <PlusCircle className="w-4 h-4 text-amber-600 mr-1" /><span className="text-xs text-amber-700">Əlavə et</span>
                      </Button>
                    </div>
                    {(formData.reminders || []).map((rem, ri) => (
                      <div key={ri} className="flex items-center gap-2 bg-white rounded-lg p-2">
                        <span className="text-xs font-bold text-amber-700 w-5">{ri+1}.</span>
                        <div className="flex-1"><DatePickerAz value={rem.date} onChange={(v) => updateReminder(ri, 'date', v)} /></div>
                        <TimeSelectAz value={rem.time} onChange={(v) => updateReminder(ri, 'time', v)} className="w-28" />
                        <Input value={rem.note} onChange={(e) => updateReminder(ri, 'note', e.target.value)} placeholder="Qeyd" className="text-sm flex-1" />
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeReminder(ri)} className="h-8 w-8 p-0"><X className="w-3.5 h-3.5 text-red-500" /></Button>
                      </div>
                    ))}
                    {(formData.reminders || []).length === 0 && <p className="text-xs text-amber-600 text-center py-2">Xatırlatma yoxdur</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Əməyin ödənilməsi sistemi</Label>
                      <Select value={formData.payment_system} onValueChange={(v) => setFormData({...formData, payment_system: v})}>
                        <SelectTrigger className="text-sm" data-testid="payment-system-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent><SelectItem value="Vaxtamuzd">Vaxtamuzd</SelectItem><SelectItem value="İşəmuzd">İşəmuzd</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Əsas məzuniyyət (gün)</Label><Input type="number" value={formData.main_vacation_days} onChange={(e) => setFormData({...formData, main_vacation_days: parseInt(e.target.value) || 0})} className="text-sm" /></div>
                    <div><Label className="text-xs">Əlavə məzuniyyət (gün)</Label><Input type="number" value={formData.additional_vacation_days} onChange={(e) => setFormData({...formData, additional_vacation_days: parseInt(e.target.value) || 0})} className="text-sm" /></div>
                    <div><Label className="text-xs">İş qrafiki</Label><Input value={formData.work_schedule} onChange={(e) => setFormData({...formData, work_schedule: e.target.value})} placeholder="Məs: 09:00-18:00" className="text-sm" /></div>
                  </div>
                  {/* Fayl yükləmələr */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                      <Label className="text-xs font-semibold">Vəzifə təlimatları</Label>
                      {formData.position_instructions_file ? (
                        <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-green-500" /><span className="text-xs text-green-600 flex-1">Yüklənib</span><Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, position_instructions_file: ''})}><X className="w-3.5 h-3.5 text-red-500" /></Button></div>
                      ) : (
                        <label className="cursor-pointer"><input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleFileUpload(e, 'position_instructions_file')} className="hidden" data-testid="position-instructions-upload" /><span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 rounded-lg border border-slate-200"><Upload className="w-3.5 h-3.5" /> Fayl seç</span></label>
                      )}
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                      <Label className="text-xs font-semibold">Əmək müqaviləsi</Label>
                      {formData.employment_contract_file ? (
                        <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-green-500" /><span className="text-xs text-green-600 flex-1">Yüklənib</span><Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, employment_contract_file: ''})}><X className="w-3.5 h-3.5 text-red-500" /></Button></div>
                      ) : (
                        <label className="cursor-pointer"><input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleFileUpload(e, 'employment_contract_file')} className="hidden" data-testid="employment-contract-upload" /><span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 rounded-lg border border-slate-200"><Upload className="w-3.5 h-3.5" /> Fayl seç</span></label>
                      )}
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                      <Label className="text-xs font-semibold">Vəzifə dəyişikliyi faylı</Label>
                      {formData.position_change_file ? (
                        <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-green-500" /><span className="text-xs text-green-600 flex-1">Yüklənib</span><Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, position_change_file: ''})}><X className="w-3.5 h-3.5 text-red-500" /></Button></div>
                      ) : (
                        <label className="cursor-pointer"><input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleFileUpload(e, 'position_change_file')} className="hidden" data-testid="position-change-upload" /><span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 rounded-lg border border-slate-200"><Upload className="w-3.5 h-3.5" /> Fayl seç</span></label>
                      )}
                    </div>
                  </div>
                  <CustomFieldsRenderer fields={customFields} tabName="contract" formData={formData} setFormData={setFormData} />
                </TabsContent>

                {/* ƏMƏK HAQQI TAB */}
                <TabsContent value="salary" className="space-y-4" data-testid="salary-tab">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Gross əmək haqqı (AZN)</Label><Input type="number" value={formData.gross_salary} onChange={(e) => setFormData({...formData, gross_salary: parseFloat(e.target.value) || 0})} className="text-sm" /></div>
                    <div><Label className="text-xs">Net əmək haqqı (AZN)</Label><Input type="number" value={formData.net_salary} onChange={(e) => setFormData({...formData, net_salary: parseFloat(e.target.value) || 0})} className="text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs">Əmək haqqına əlavə (AZN)</Label><Input type="number" value={formData.salary_supplement} onChange={(e) => setFormData({...formData, salary_supplement: parseFloat(e.target.value) || 0})} className="text-sm" data-testid="salary-supplement" /></div>
                    <div><Label className="text-xs">Mükafatlar</Label><Input value={formData.bonuses} onChange={(e) => setFormData({...formData, bonuses: e.target.value})} placeholder="Mükafat məlumatları" className="text-sm" data-testid="bonuses-input" /></div>
                  </div>
                  <CustomFieldsRenderer fields={customFields} tabName="salary" formData={formData} setFormData={setFormData} />
                </TabsContent>

                {/* SƏNƏDLƏR TAB */}
                <TabsContent value="documents" className="space-y-4" data-testid="documents-tab">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DocumentUploadCard
                      label="Məhkumluq skanı"
                      value={formData.criminal_record_scan}
                      onUpload={(e) => handleFileUpload(e, 'criminal_record_scan')}
                      onClear={() => setFormData({ ...formData, criminal_record_scan: '' })}
                      testId="criminal-record"
                    />
                    <DocumentUploadCard
                      label="Sağlamlıq arayışı skanı"
                      value={formData.health_certificate_scan}
                      onUpload={(e) => handleFileUpload(e, 'health_certificate_scan')}
                      onClear={() => setFormData({ ...formData, health_certificate_scan: '' })}
                      testId="health-cert"
                    />
                  </div>
                  {/* Sertifikat skanları */}
                  <div className="p-4 bg-amber-50 rounded-lg space-y-3">
                    <Label className="text-xs font-semibold text-amber-800">Sertifikatlar</Label>
                    {formData.certificate_scans?.length > 0 && (
                      <div className="space-y-1">
                        {formData.certificate_scans.map((cert, i) => {
                          const certUrl = typeof cert === 'string' ? cert : cert.url;
                          const certName = typeof cert === 'string' ? `Sertifikat ${i+1}` : cert.name;
                          return (
                            <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2">
                              <GraduationCap className="w-4 h-4 text-amber-500" />
                              <a href={certUrl.startsWith('http') ? certUrl : `${process.env.REACT_APP_BACKEND_URL}${certUrl}`} download className="text-xs text-amber-700 hover:underline truncate flex-1">{certName}</a>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, certificate_scans: formData.certificate_scans.filter((_, j) => j !== i)})}><X className="w-3.5 h-3.5 text-red-500" /></Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <label className="cursor-pointer">
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple onChange={(e) => handleMultiFileUpload(e, 'certificate_scans')} className="hidden" data-testid="certificate-scans-upload" />
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors">
                        <Upload className="w-3.5 h-3.5" /> Sertifikat əlavə et
                      </span>
                    </label>
                  </div>
                  {/* Digər sənədlər */}
                  <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                    <Label className="text-xs font-semibold">Digər sənədlər</Label>
                    {formData.document_scans?.length > 0 && (
                      <div className="space-y-1">
                        {formData.document_scans.map((doc, i) => {
                          const docUrl = typeof doc === 'string' ? doc : doc.url;
                          const docName = typeof doc === 'string' ? `Sənəd ${i+1}` : doc.name;
                          return (
                            <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2">
                              <FileText className="w-4 h-4 text-blue-500" />
                              <a href={docUrl.startsWith('http') ? docUrl : `${process.env.REACT_APP_BACKEND_URL}${docUrl}`} download className="text-xs text-blue-700 hover:underline truncate flex-1">{docName}</a>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({...formData, document_scans: formData.document_scans.filter((_, j) => j !== i)})}><X className="w-3.5 h-3.5 text-red-500" /></Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <label className="cursor-pointer">
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple onChange={(e) => handleMultiFileUpload(e, 'document_scans')} className="hidden" data-testid="document-scans-upload" />
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors">
                        <Upload className="w-3.5 h-3.5" /> Sənəd əlavə et
                      </span>
                    </label>
                  </div>
                  <CustomFieldsRenderer fields={customFields} tabName="documents" formData={formData} setFormData={setFormData} />
                </TabsContent>
              </Tabs>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t mt-6">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="text-sm">Ləğv et</Button>
                <Button type="submit" className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold text-sm" disabled={uploading} data-testid="submit-employee-btn">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  {editingEmployee ? 'Yadda saxla' : 'Əlavə et'}
                </Button>
              </div>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <ExcelColumnPicker
        open={showExportModal}
        onOpenChange={setShowExportModal}
        columns={HR_EXPORT_COLUMNS}
        defaultKeys={HR_DEFAULT_KEYS}
        rows={filteredEmployees}
        sheetName="Əməkdaşlar"
        fileName="marsol_emekdaslar"
        storageKey="export_cols_hr"
        onSuccess={({ rows, cols }) => toast.success(`${rows} əməkdaş ixrac edildi (${cols} sütun)`)}
      />
    </div>
  );
}
