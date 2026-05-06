import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2, CheckCircle2, Building2, AlertCircle, Plus, X, Upload } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const emptyChild = () => ({ name: '', surname: '', birth_date: '', gender: '' });
const emptyOwner = () => ({
  first_name: '', last_name: '', father_name: '', position: '', phone: '', email: '',
  birth_date: '', citizenship: '', education: '', specialty: '', university: '',
  social_links: [], children: [], desired_activities: []
});

function DynSelect({ value, onChange, options, placeholder }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full h-9 px-2 text-sm border rounded-lg bg-white">
      <option value="">{placeholder || 'Seçin'}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function MultiSelect({ selected, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const available = options.filter(o => !(selected || []).includes(o));
  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 min-h-[36px] border rounded-lg px-2 py-1.5 cursor-pointer bg-white" onClick={() => setOpen(!open)}>
        {(!selected || selected.length === 0) && <span className="text-xs text-slate-400 py-0.5">{placeholder}</span>}
        {(selected || []).map((item, i) => (
          <span key={i} className="bg-[#3D4F6F]/10 text-[#3D4F6F] text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5">
            {item}
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(selected.filter((_, j) => j !== i)); }}><X className="w-2.5 h-2.5" /></button>
          </span>
        ))}
      </div>
      {open && available.length > 0 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full mt-1 left-0 w-full bg-white border rounded-lg shadow-lg max-h-[150px] overflow-y-auto">
            {available.map(o => (
              <button key={o} type="button" className="w-full text-left text-xs px-3 py-1.5 hover:bg-slate-50" onClick={() => { onChange([...(selected || []), o]); setOpen(false); }}>{o}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function PublicForm() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({});
  const [owners, setOwners] = useState([emptyOwner()]);
  const [meta, setMeta] = useState({ company_name: '', owner_phone: '', owner_name: '', fields: [], options: {}, description: '' });
  const [logoUrl, setLogoUrl] = useState('https://customer-assets.emergentagent.com/job_03e89fda-1599-48f3-846d-f1d3e818b1fa/artifacts/h0q248dw_Marsol.png');

  useEffect(() => {
    axios.get(`${API}/public/branding`).then(r => {
      if (r.data.main_logo_url) setLogoUrl(r.data.main_logo_url.startsWith('http') ? r.data.main_logo_url : `${process.env.REACT_APP_BACKEND_URL}${r.data.main_logo_url}`);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const res = await axios.get(`${API}/public/form/${token}`);
        setMeta(res.data);
        const cv = res.data.current_values || {};
        setFormData(cv);
        if (cv.owners && Array.isArray(cv.owners) && cv.owners.length > 0) {
          setOwners(cv.owners.map(o => ({ ...emptyOwner(), ...o })));
        }
      } catch (err) { setError(err.response?.data?.detail || 'Form tapılmadı'); }
      finally { setLoading(false); }
    };
    fetchForm();
  }, [token]);

  const hasField = (key) => meta.fields.some(f => f.key === key);
  const opts = meta.options || {};

  const handleFileUpload = async (field, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await axios.post(`${API}/public/upload`, fd);
      if (field === 'bank_files') {
        setFormData({ ...formData, bank_files: [...(formData.bank_files || []), { url: res.data.url, name: res.data.filename }] });
      } else {
        setFormData({ ...formData, [field]: res.data.url });
      }
    } catch { alert('Fayl yüklənmədi'); }
  };

  const updateOwner = (idx, field, val) => { const o = [...owners]; o[idx] = { ...o[idx], [field]: val }; setOwners(o); };
  const addOwner = () => setOwners([...owners, emptyOwner()]);
  const removeOwner = (idx) => { if (owners.length <= 1) return; setOwners(owners.filter((_, i) => i !== idx)); };
  const addOwnerSocial = (idx) => { const o = [...owners]; o[idx] = { ...o[idx], social_links: [...(o[idx].social_links || []), ''] }; setOwners(o); };
  const updateOwnerSocial = (oIdx, lIdx, val) => { const o = [...owners]; const links = [...(o[oIdx].social_links || [])]; links[lIdx] = val; o[oIdx] = { ...o[oIdx], social_links: links }; setOwners(o); };
  const removeOwnerSocial = (oIdx, lIdx) => { const o = [...owners]; o[oIdx] = { ...o[oIdx], social_links: (o[oIdx].social_links || []).filter((_, i) => i !== lIdx) }; setOwners(o); };
  const addChild = (oIdx) => { const o = [...owners]; o[oIdx] = { ...o[oIdx], children: [...(o[oIdx].children || []), emptyChild()] }; setOwners(o); };
  const updateChild = (oIdx, cIdx, field, val) => { const o = [...owners]; const ch = [...(o[oIdx].children || [])]; ch[cIdx] = { ...ch[cIdx], [field]: val }; o[oIdx] = { ...o[oIdx], children: ch }; setOwners(o); };
  const removeChild = (oIdx, cIdx) => { const o = [...owners]; o[oIdx] = { ...o[oIdx], children: (o[oIdx].children || []).filter((_, i) => i !== cIdx) }; setOwners(o); };
  const addCompanySocial = () => setFormData({ ...formData, social_links: [...(formData.social_links || []), ''] });
  const updateCompanySocial = (idx, val) => { const l = [...(formData.social_links || [])]; l[idx] = val; setFormData({ ...formData, social_links: l }); };
  const removeCompanySocial = (idx) => setFormData({ ...formData, social_links: (formData.social_links || []).filter((_, i) => i !== idx) });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...formData };
      if (hasField('owners')) payload.owners = owners;
      await axios.post(`${API}/public/form/${token}`, payload);
      setSubmitted(true);
    } catch (err) { setError(err.response?.data?.detail || 'Xəta baş verdi'); }
    finally { setSubmitting(false); }
  };

  // Which fields are select-based
  const selectFields = { sector: opts.sectors, sub_sector: (opts.sub_sectors || {})[formData.sector] || [], company_size: opts.company_sizes, region: opts.regions, contact_position: opts.positions };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F]" /></div>;
  if (error && !submitted) return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center"><AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" /><h2 className="text-lg font-bold text-red-600 mb-2">Xəta</h2><p className="text-slate-500">{error}</p></div></div>;
  if (submitted) return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center"><CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" /><h2 className="text-xl font-bold text-[#3D4F6F] mb-2">Təşəkkür edirik!</h2><p className="text-slate-500">Məlumatlarınız uğurla göndərildi.</p><p className="text-xs text-amber-600 mt-3 bg-amber-50 px-3 py-2 rounded">Admin təsdiqindən sonra məlumatlar profilinizdə yenilənəcək.</p></div></div>;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-block mb-4">
            <img src={logoUrl} alt="Marsol Group" className="h-12 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-[#3D4F6F]">Üzvlük Forumu</h1>
          <p className="text-slate-500 text-sm mt-1">{meta.description}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
          {/* Readonly */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-slate-400">Şirkət adı</Label><p className="text-sm font-semibold text-[#3D4F6F]">{meta.company_name}</p></div>
              <div><Label className="text-xs text-slate-400">Sahibkar</Label><p className="text-sm font-semibold text-[#3D4F6F]">{meta.owner_name}</p><p className="text-xs text-slate-500">{meta.owner_phone}</p></div>
            </div>
          </div>

          {/* Dynamic fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {meta.fields.filter(f => ['text', 'select', 'date'].includes(f.type)).map(field => (
              <div key={field.key}>
                <Label className="text-xs">{field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}</Label>
                {selectFields[field.key] ? (
                  <DynSelect value={formData[field.key]} onChange={(v) => setFormData({ ...formData, [field.key]: v })} options={selectFields[field.key]} placeholder="Seçin" />
                ) : field.type === 'date' ? (
                  <Input type="date" value={formData[field.key] || ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} className="text-sm" />
                ) : (
                  <Input value={formData[field.key] || ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} className="text-sm" />
                )}
              </div>
            ))}
          </div>

          {/* Textarea fields */}
          {meta.fields.filter(f => f.type === 'textarea').map(field => (
            <div key={field.key}><Label className="text-xs">{field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}</Label>
              <textarea value={formData[field.key] || ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} className="w-full min-h-[60px] p-2 text-sm border rounded-lg resize-none" />
            </div>
          ))}

          {/* Company Social Links */}
          {hasField('social_links') && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Şirkət sosial media</Label>
                <button type="button" onClick={addCompanySocial} className="text-[10px] text-[#9ACD32] hover:underline font-medium">+ Əlavə et</button>
              </div>
              {(formData.social_links || []).map((link, idx) => (
                <div key={idx} className="flex items-center gap-1.5 mb-1.5">
                  <Input value={link} onChange={(e) => updateCompanySocial(idx, e.target.value)} placeholder="https://..." className="text-sm h-8" />
                  <button type="button" onClick={() => removeCompanySocial(idx)} className="p-1 hover:bg-red-100 rounded"><X className="w-3 h-3 text-red-500" /></button>
                </div>
              ))}
            </div>
          )}

          {/* File uploads */}
          {meta.fields.filter(f => f.type === 'file').map(field => (
            <div key={field.key}>
              <Label className="text-xs">{field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200 text-xs">
                  <Upload className="w-3 h-3" />Fayl seç
                  <input type="file" className="hidden" onChange={(e) => handleFileUpload(field.key, e)} />
                </label>
                {field.key === 'bank_files' && (formData.bank_files || []).map((f, i) => (
                  <span key={i} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{f.name}</span>
                ))}
                {field.key !== 'bank_files' && formData[field.key] && <span className="text-[10px] text-green-600">Yükləndi</span>}
              </div>
            </div>
          ))}

          {/* Owners section */}
          {hasField('owners') && (
            <div className="border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-[#3D4F6F]">Sahibkarlar / Həmtəsisçilər</Label>
                <button type="button" onClick={addOwner} className="text-xs text-[#9ACD32] hover:underline font-medium flex items-center gap-0.5"><Plus className="w-3 h-3" />Həmtəsisçi əlavə et</button>
              </div>
              {owners.map((owner, oIdx) => (
                <div key={oIdx} className="bg-slate-50 rounded-lg p-3 border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#3D4F6F]">Sahibkar {oIdx + 1}</span>
                    {owners.length > 1 && <button type="button" onClick={() => removeOwner(oIdx)} className="text-red-500 text-xs hover:underline">Sil</button>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div><Label className="text-[10px]">Ad</Label><Input value={owner.first_name} onChange={(e) => updateOwner(oIdx, 'first_name', e.target.value)} className="text-sm h-8" /></div>
                    <div><Label className="text-[10px]">Soyad</Label><Input value={owner.last_name} onChange={(e) => updateOwner(oIdx, 'last_name', e.target.value)} className="text-sm h-8" /></div>
                    <div><Label className="text-[10px]">Ata adı</Label><Input value={owner.father_name} onChange={(e) => updateOwner(oIdx, 'father_name', e.target.value)} className="text-sm h-8" /></div>
                    <div><Label className="text-[10px]">Vəzifə</Label><DynSelect value={owner.position} onChange={(v) => updateOwner(oIdx, 'position', v)} options={opts.positions || []} placeholder="Seçin" /></div>
                    <div><Label className="text-[10px]">Telefon</Label><Input value={owner.phone} onChange={(e) => updateOwner(oIdx, 'phone', e.target.value)} className="text-sm h-8" /></div>
                    <div><Label className="text-[10px]">Email</Label><Input value={owner.email} onChange={(e) => updateOwner(oIdx, 'email', e.target.value)} className="text-sm h-8" /></div>
                    <div><Label className="text-[10px]">Doğum tarixi</Label><Input type="date" value={owner.birth_date} onChange={(e) => updateOwner(oIdx, 'birth_date', e.target.value)} className="text-sm h-8" /></div>
                    <div><Label className="text-[10px]">Vətəndaşlıq</Label><Input value={owner.citizenship} onChange={(e) => updateOwner(oIdx, 'citizenship', e.target.value)} className="text-sm h-8" /></div>
                    <div><Label className="text-[10px]">Təhsil</Label><DynSelect value={owner.education} onChange={(v) => updateOwner(oIdx, 'education', v)} options={opts.education_levels || []} placeholder="Seçin" /></div>
                    <div><Label className="text-[10px]">İxtisas</Label><Input value={owner.specialty} onChange={(e) => updateOwner(oIdx, 'specialty', e.target.value)} className="text-sm h-8" /></div>
                    <div><Label className="text-[10px]">Universitet</Label><Input value={owner.university} onChange={(e) => updateOwner(oIdx, 'university', e.target.value)} className="text-sm h-8" /></div>
                  </div>

                  {/* Desired activities - multi-select */}
                  <div>
                    <Label className="text-[10px]">Qatılmaq istədiyi fəaliyyətlər</Label>
                    <MultiSelect selected={owner.desired_activities} options={opts.activities || []} onChange={(v) => updateOwner(oIdx, 'desired_activities', v)} placeholder="Fəaliyyət seçin" />
                  </div>

                  {/* Owner social links */}
                  <div>
                    <div className="flex items-center justify-between"><Label className="text-[10px]">Sosial media</Label>
                      <button type="button" onClick={() => addOwnerSocial(oIdx)} className="text-[10px] text-[#9ACD32] hover:underline">+ Link</button>
                    </div>
                    {(owner.social_links || []).map((link, lIdx) => (
                      <div key={lIdx} className="flex items-center gap-1 mb-1">
                        <Input value={link} onChange={(e) => updateOwnerSocial(oIdx, lIdx, e.target.value)} placeholder="https://..." className="text-sm h-7" />
                        <button type="button" onClick={() => removeOwnerSocial(oIdx, lIdx)} className="p-0.5 hover:bg-red-100 rounded"><X className="w-2.5 h-2.5 text-red-500" /></button>
                      </div>
                    ))}
                  </div>

                  {/* Children */}
                  <div>
                    <div className="flex items-center justify-between"><Label className="text-[10px]">Övladlar</Label>
                      <button type="button" onClick={() => addChild(oIdx)} className="text-[10px] text-[#9ACD32] hover:underline">+ Övlad</button>
                    </div>
                    {(owner.children || []).map((child, cIdx) => (
                      <div key={cIdx} className="flex items-center gap-1.5 mb-1">
                        <Input value={child.name} onChange={(e) => updateChild(oIdx, cIdx, 'name', e.target.value)} placeholder="Ad" className="text-sm h-7 flex-1" />
                        <Input value={child.surname} onChange={(e) => updateChild(oIdx, cIdx, 'surname', e.target.value)} placeholder="Soyad" className="text-sm h-7 flex-1" />
                        <Input type="date" value={child.birth_date} onChange={(e) => updateChild(oIdx, cIdx, 'birth_date', e.target.value)} className="text-sm h-7 w-[120px]" />
                        <select value={child.gender} onChange={(e) => updateChild(oIdx, cIdx, 'gender', e.target.value)} className="text-sm h-7 border rounded px-1"><option value="">Cins</option><option value="Oğlan">Oğlan</option><option value="Qız">Qız</option></select>
                        <button type="button" onClick={() => removeChild(oIdx, cIdx)} className="p-0.5 hover:bg-red-100 rounded"><X className="w-2.5 h-2.5 text-red-500" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold py-3">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Göndər
          </Button>
        </form>
        <p className="text-center text-xs text-slate-400 mt-4">Marsol Group Idareetme Sistemi</p>
      </div>
    </div>
  );
}
