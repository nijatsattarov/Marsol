import { useRef, useState } from 'react';
import axios from 'axios';
import { Upload, X, Loader2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Upload a single image (logo, avatar, project cover) directly to Cloudinary
 * via the backend. Returns `{ url, public_id, ... }` to the parent through
 * `onChange`.
 *
 * Props:
 *   value      - existing url (string) to display
 *   onChange   - (assetOrNull) => void; called with full asset metadata or null when cleared
 *   folder     - cloudinary folder prefix (e.g. "marsol/companies")
 *   label      - small label text shown above the picker
 *   size       - 'sm' | 'md' | 'lg' — visual size
 *   testId     - prefix for data-testid attributes
 */
export default function ImageUpload({ value, onChange, folder = 'marsol/files', label, size = 'md', testId = 'image-upload' }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const dims = { sm: 'w-16 h-16', md: 'w-24 h-24', lg: 'w-32 h-32' }[size] || 'w-24 h-24';

  const pick = () => inputRef.current?.click();

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error('Yalnız şəkil faylları qəbul olunur');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('folder', folder);
      const res = await axios.post(`${API}/uploads`, fd, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      onChange?.(res.data);
      toast.success('Şəkil yükləndi');
    } catch (err) {
      const detail = err?.response?.data?.detail || err.message;
      toast.error(`Xəta: ${detail}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div data-testid={testId}>
      {label && <label className="text-xs text-slate-500 mb-1 block">{label}</label>}
      <div className="flex items-center gap-3">
        <div className={`${dims} rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden relative`}>
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : busy ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          ) : (
            <ImagePlus className="w-6 h-6 text-slate-300" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={pick}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-md bg-[#3D4F6F] text-white hover:bg-[#2D3F5F] disabled:opacity-50 flex items-center gap-1"
            data-testid={`${testId}-pick`}
          >
            <Upload className="w-3 h-3" />
            {value ? 'Dəyiş' : 'Yüklə'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange?.(null)}
              className="text-xs px-3 py-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1"
              data-testid={`${testId}-clear`}
            >
              <X className="w-3 h-3" />Sil
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
          data-testid={`${testId}-input`}
        />
      </div>
    </div>
  );
}
