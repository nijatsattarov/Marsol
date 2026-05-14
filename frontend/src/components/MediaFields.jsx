import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Upload, X, Loader2, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Multi-image uploader. `value` is an array of cloudinary URLs.
 * Renders thumbnails + drag/click-to-upload area + delete buttons.
 */
export function PhotoUploadField({ value, onChange, multiple = true }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const token = localStorage.getItem('token');

  // Normalize value to array. Accepts string (legacy multiline) or array.
  let urls = [];
  if (Array.isArray(value)) urls = value;
  else if (typeof value === 'string' && value.trim()) {
    urls = value.split('\n').map(s => s.trim()).filter(Boolean);
  }

  const handleFiles = async (files) => {
    const arr = Array.from(files || []);
    if (arr.length === 0) return;
    setUploading(true);
    const uploaded = [];
    try {
      for (const file of arr) {
        if (!file.type.startsWith('image/')) {
          toast.error(`"${file.name}" şəkil deyil`);
          continue;
        }
        const fd = new FormData();
        fd.append('file', file);
        try {
          const res = await axios.post(`${API}/upload`, fd, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
          });
          if (res.data?.url) uploaded.push(res.data.url);
        } catch (err) {
          toast.error(`"${file.name}" yüklənmədi: ${err.response?.data?.detail || err.message}`);
        }
      }
      if (uploaded.length > 0) {
        onChange(multiple ? [...urls, ...uploaded] : [uploaded[0]]);
        toast.success(`${uploaded.length} şəkil yükləndi`);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = (idx) => {
    const next = urls.filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div className="space-y-2" data-testid="photo-upload-field">
      {urls.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {urls.map((url, idx) => (
            <div key={`${url}-${idx}`} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
              <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`photo-remove-${idx}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-[#3D4F6F] transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          data-testid="photo-upload-input"
        />
        {uploading ? (
          <><Loader2 className="w-4 h-4 animate-spin text-[#3D4F6F]" /><span className="text-xs text-slate-500">Yüklənir...</span></>
        ) : (
          <>
            <Upload className="w-4 h-4 text-[#3D4F6F]" />
            <span className="text-xs text-slate-600 font-medium">
              {urls.length === 0 ? 'Şəkil yüklə (PNG, JPG, WebP)' : 'Daha şəkil əlavə et'}
            </span>
          </>
        )}
      </label>
    </div>
  );
}

/**
 * Social media links field. value = array of { platform, url }.
 * Platforms are loaded from /api/settings/social-platforms.
 */
export function SocialLinksField({ value, onChange }) {
  const [platforms, setPlatforms] = useState([]);
  const token = localStorage.getItem('token');

  useEffect(() => {
    let alive = true;
    axios.get(`${API}/settings/social-platforms`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (alive) setPlatforms(r.data || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [token]);

  // Normalize value. Accepts array of objects, string (legacy newline list) or empty.
  let links = [];
  if (Array.isArray(value)) {
    links = value.map(v => typeof v === 'string' ? { platform: '', url: v } : v).filter(l => l && typeof l === 'object');
  } else if (typeof value === 'string' && value.trim()) {
    links = value.split('\n').map(s => ({ platform: '', url: s.trim() })).filter(l => l.url);
  }

  const updateOne = (idx, patch) => {
    const next = links.map((l, i) => i === idx ? { ...l, ...patch } : l);
    onChange(next);
  };

  const addLink = () => onChange([...links, { platform: '', url: '' }]);
  const removeLink = (idx) => onChange(links.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2" data-testid="social-links-field">
      {links.length === 0 && (
        <p className="text-xs text-slate-400 italic">Sosial media linki yoxdur</p>
      )}
      {links.map((link, idx) => (
        <div key={idx} className="flex gap-2 items-center" data-testid={`social-link-${idx}`}>
          <div className="w-40">
            <Select value={link.platform || '__none__'} onValueChange={(v) => updateOne(idx, { platform: v === '__none__' ? '' : v })}>
              <SelectTrigger className="text-xs h-9" data-testid={`social-platform-${idx}`}>
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Seçin —</SelectItem>
                {platforms.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input
            value={link.url || ''}
            onChange={(e) => updateOne(idx, { url: e.target.value })}
            placeholder="https://..."
            className="text-xs h-9 flex-1"
            data-testid={`social-url-${idx}`}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => removeLink(idx)} data-testid={`social-remove-${idx}`}>
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addLink} className="text-xs" data-testid="social-add-btn">
        <Plus className="w-3.5 h-3.5 mr-1" />Sosial media əlavə et
      </Button>
    </div>
  );
}

/**
 * Read-only chips renderer used inside table cells when listing photos/social links.
 */
export function PhotoUploadDisplay({ value }) {
  let urls = [];
  if (Array.isArray(value)) urls = value;
  else if (typeof value === 'string' && value.trim()) {
    urls = value.split('\n').map(s => s.trim()).filter(Boolean);
  }
  if (urls.length === 0) return <span className="text-slate-300">—</span>;
  return (
    <div className="flex items-center gap-1">
      <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
      <span className="text-xs text-slate-600">{urls.length}</span>
    </div>
  );
}

export function SocialLinksDisplay({ value }) {
  if (!Array.isArray(value) || value.length === 0) return <span className="text-slate-300">—</span>;
  return <span className="text-xs text-slate-600">{value.length} link</span>;
}
