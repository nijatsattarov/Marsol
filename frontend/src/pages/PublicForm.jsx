import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2, CheckCircle2, Building2, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PublicForm() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({});
  const [meta, setMeta] = useState({ company_name: '', owner_phone: '', owner_name: '', fields: [] });

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const res = await axios.get(`${API}/public/form/${token}`);
        setMeta(res.data);
        setFormData(res.data.current_values || {});
      } catch (err) {
        setError(err.response?.data?.detail || 'Form tapılmadı');
      } finally { setLoading(false); }
    };
    fetchForm();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/public/form/${token}`, formData);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Xəta baş verdi');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F]" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-red-600 mb-2">Xəta</h2>
        <p className="text-slate-500">{error}</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-[#3D4F6F] mb-2">Təşəkkür edirik!</h2>
        <p className="text-slate-500">Məlumatlarınız uğurla göndərildi.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-[#3D4F6F] text-white px-4 py-2 rounded-xl mb-4">
            <Building2 className="w-5 h-5" />
            <span className="font-bold text-sm">MARSOL GROUP</span>
          </div>
          <h1 className="text-xl font-bold text-[#3D4F6F]">Üzvlük Forumu</h1>
          <p className="text-slate-500 text-sm mt-1">Zəhmət olmasa şirkət məlumatlarını doldurun</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
          {/* Readonly fields */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-400">Şirkət adı</Label>
                <p className="text-sm font-semibold text-[#3D4F6F]">{meta.company_name}</p>
              </div>
              <div>
                <Label className="text-xs text-slate-400">Sahibkar</Label>
                <p className="text-sm font-semibold text-[#3D4F6F]">{meta.owner_name}</p>
                <p className="text-xs text-slate-500">{meta.owner_phone}</p>
              </div>
            </div>
          </div>

          {/* Dynamic fields */}
          {meta.fields.map(field => (
            <div key={field.key}>
              <Label className="text-xs">{field.label}</Label>
              {field.key === 'address' || field.key === 'bank_details' || field.key === 'children_info' ? (
                <textarea
                  value={formData[field.key] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  className="w-full min-h-[60px] p-2 text-sm border rounded-lg resize-none"
                  data-testid={`form-field-${field.key}`}
                />
              ) : (
                <Input
                  value={formData[field.key] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  className="text-sm"
                  data-testid={`form-field-${field.key}`}
                />
              )}
            </div>
          ))}

          <Button type="submit" className="w-full bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-bold py-3" data-testid="form-submit-btn">
            Göndər
          </Button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-4">Marsol Group Idareetme Sistemi</p>
      </div>
    </div>
  );
}
