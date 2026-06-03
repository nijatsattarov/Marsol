import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  Upload, FileText, FileImage, FileVideo, File as FileIcon,
  Trash2, Download, Search, Loader2, ExternalLink, X, Pencil,
} from 'lucide-react';
import { formatDate, formatDateTime } from '../lib/dateUtils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmtBytes = (n) => {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

// Insert Cloudinary's `fl_attachment` flag right after the resource type so
// the CDN responds with `Content-Disposition: attachment` and the browser
// actually downloads the file instead of opening it in a new tab.
const buildDownloadUrl = (url) => {
  if (!url) return url;
  return url.replace(
    /\/(image|video|raw)\/upload\//,
    '/$1/upload/fl_attachment/'
  );
};

const iconFor = (rt) => {
  if (rt === 'image') return FileImage;
  if (rt === 'video') return FileVideo;
  return FileText;
};

const accentFor = (rt) => {
  if (rt === 'image') return 'text-emerald-500';
  if (rt === 'video') return 'text-amber-500';
  return 'text-[#3D4F6F]';
};

export default function Files() {
  const [files, setFiles] = useState([]);
  const [marsolCompanies, setMarsolCompanies] = useState([]);
  const [filterMarsol, setFilterMarsol] = useState('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [meta, setMeta] = useState({ name: '', description: '', tags: '' });
  const [pickedFile, setPickedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [editingFile, setEditingFile] = useState(null);
  const [editDesc, setEditDesc] = useState('');
  const fileInputRef = useRef(null);

  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const [r, mc] = await Promise.all([
        axios.get(`${API}/files`, { headers }),
        axios.get(`${API}/settings/marsol-companies`, { headers }).catch(() => ({ data: [] })),
      ]);
      setFiles(r.data || []);
      setMarsolCompanies(mc.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Faylları yükləmək alınmadı');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPickedFile(f);
    setMeta({ name: f.name, description: '', tags: '' });
    setShowUploadModal(true);
  };

  const handleUpload = async () => {
    if (!pickedFile) return;
    setUploading(true);
    try {
      // 1) push raw bytes to Cloudinary via backend
      const fd = new FormData();
      fd.append('file', pickedFile);
      fd.append('folder', 'marsol/files');
      const upRes = await axios.post(`${API}/uploads`, fd, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      });
      // 2) persist metadata in db.files
      const tags = meta.tags.split(',').map(s => s.trim()).filter(Boolean);
      await axios.post(`${API}/files`, {
        ...upRes.data,
        name: meta.name || pickedFile.name,
        description: meta.description,
        tags,
        folder: 'marsol/files',
      }, { headers });
      toast.success('Fayl yükləndi');
      setShowUploadModal(false);
      setPickedFile(null);
      setMeta({ name: '', description: '', tags: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchFiles();
    } catch (err) {
      const detail = err?.response?.data?.detail || err.message;
      toast.error(`Xəta: ${detail}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`"${file.name}" silinsin?`)) return;
    try {
      await axios.delete(`${API}/files/${file.id}`, { headers });
      toast.success('Fayl silindi');
      fetchFiles();
    } catch (err) {
      const detail = err?.response?.data?.detail || err.message;
      toast.error(`Xəta: ${detail}`);
    }
  };

  const handleEditDescription = (file) => {
    setEditingFile(file);
    setEditDesc(file.description || '');
  };

  const saveDescription = async () => {
    if (!editingFile) return;
    try {
      await axios.put(`${API}/files/${editingFile.id}`, { description: editDesc }, { headers });
      toast.success('Təsvir yeniləndi');
      setEditingFile(null);
      fetchFiles();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Xəta');
    }
  };

  const filtered = files.filter(f => {
    if (filterMarsol !== 'all' && (f.marsol_company || '') !== filterMarsol) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (f.name || '').toLowerCase().includes(q) ||
      (f.description || '').toLowerCase().includes(q) ||
      (f.tags || []).join(' ').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 sm:p-6 max-w-[1500px] mx-auto" data-testid="files-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: '#3D4F6F' }}>Fayllar</h1>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} fayl</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => fileInputRef.current?.click()} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="upload-file-btn">
            <Upload className="w-4 h-4 mr-1" />Fayl yüklə
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={onPickFile} data-testid="file-input" />
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Axtar (ad, təsvir, tag)..." className="pl-9 text-sm" data-testid="files-search" />
          </div>
          <select
            value={filterMarsol}
            onChange={(e) => setFilterMarsol(e.target.value)}
            className="h-9 text-sm rounded-md border border-slate-200 px-2 bg-white"
            data-testid="filter-marsol-company"
          >
            <option value="all">Bütün müəssisələr</option>
            {marsolCompanies.map(mc => <option key={mc.id} value={mc.name}>{mc.name}</option>)}
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-[40vh]"><Loader2 className="w-8 h-8 animate-spin text-[#3D4F6F]" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center">
          <FileIcon className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">Hələ fayl yüklənməyib</p>
          <p className="text-slate-400 text-xs mt-1">Sağdakı "Fayl yüklə" düyməsi ilə başlayın</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3" data-testid="files-grid">
          {filtered.map(f => {
            const Icon = iconFor(f.resource_type);
            const accent = accentFor(f.resource_type);
            const isImage = f.resource_type === 'image';
            return (
              <div key={f.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group" data-testid={`file-${f.id}`}>
                {/* Preview */}
                <div className="aspect-square bg-slate-50 flex items-center justify-center cursor-pointer relative" onClick={() => setPreview(f)}>
                  {isImage ? (
                    <img src={f.url} alt={f.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <Icon className={`w-12 h-12 ${accent}`} />
                  )}
                  {f.format && (
                    <span className="absolute top-1.5 right-1.5 bg-white/95 backdrop-blur text-[9px] font-bold px-1.5 py-0.5 rounded uppercase text-slate-600">{f.format}</span>
                  )}
                </div>
                {/* Meta */}
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-[#3D4F6F] truncate" title={f.name}>{f.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{fmtBytes(f.bytes)} • {f.uploaded_by_name}</p>
                  {f.description && (
                    <p className="text-[11px] text-slate-600 mt-1 italic line-clamp-2" title={f.description} data-testid={`file-desc-${f.id}`}>
                      {f.description}
                    </p>
                  )}
                  {f.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {f.tags.slice(0, 2).map((t, i) => <Badge key={i} className="bg-slate-100 text-slate-600 text-[9px] px-1.5 py-0">{t}</Badge>)}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={f.url} target="_blank" rel="noreferrer" className="flex-1 text-[10px] text-center py-1 bg-slate-100 hover:bg-slate-200 rounded text-[#3D4F6F]" data-testid={`file-open-${f.id}`}>
                      <ExternalLink className="w-3 h-3 inline mr-1" />Aç
                    </a>
                    <a href={buildDownloadUrl(f.url)} download={f.name} className="flex-1 text-[10px] text-center py-1 bg-slate-100 hover:bg-slate-200 rounded text-[#3D4F6F]" data-testid={`file-download-${f.id}`}>
                      <Download className="w-3 h-3 inline mr-1" />Endir
                    </a>
                    <button onClick={() => handleEditDescription(f)} className="px-1.5 py-1 bg-blue-50 hover:bg-blue-100 rounded text-blue-600" title="Təsvir" data-testid={`file-edit-${f.id}`}>
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDelete(f)} className="px-1.5 py-1 bg-red-50 hover:bg-red-100 rounded text-red-500" data-testid={`file-delete-${f.id}`}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload metadata modal */}
      <Dialog open={showUploadModal} onOpenChange={(o) => !o && !uploading && setShowUploadModal(false)}>
        <DialogContent className="max-w-md" data-testid="upload-modal">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>Fayl haqqında məlumat</DialogTitle>
          </DialogHeader>
          {pickedFile && (
            <div className="text-xs text-slate-500 bg-slate-50 rounded p-2 mb-1">
              <span className="font-medium text-[#3D4F6F]">{pickedFile.name}</span> · {fmtBytes(pickedFile.size)}
            </div>
          )}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Ad *</Label>
              <Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} className="text-sm" data-testid="upload-name" />
            </div>
            <div>
              <Label className="text-xs">Təsvir</Label>
              <Input value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} className="text-sm" placeholder="Qısa təsvir..." data-testid="upload-desc" />
            </div>
            <div>
              <Label className="text-xs">Etiketlər (vergüllə ayır)</Label>
              <Input value={meta.tags} onChange={(e) => setMeta({ ...meta, tags: e.target.value })} className="text-sm" placeholder="müqavilə, sərgi, 2026" data-testid="upload-tags" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadModal(false)} disabled={uploading}>Ləğv et</Button>
            <Button onClick={handleUpload} disabled={uploading || !meta.name} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="upload-confirm">
              {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              {uploading ? 'Yüklənir...' : 'Yüklə'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit description modal */}
      <Dialog open={!!editingFile} onOpenChange={(o) => !o && setEditingFile(null)}>
        <DialogContent className="max-w-md" data-testid="edit-desc-modal">
          <DialogHeader>
            <DialogTitle style={{ color: '#3D4F6F' }}>Fayl təsvirini redaktə et</DialogTitle>
          </DialogHeader>
          {editingFile && (
            <div className="text-xs text-slate-500 bg-slate-50 rounded p-2 mb-2">
              <span className="font-medium text-[#3D4F6F]">{editingFile.name}</span>
            </div>
          )}
          <div>
            <Label className="text-xs">Qısa təsvir</Label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full min-h-[80px] p-2 text-sm border rounded-lg resize-none"
              placeholder="Bu fayl haqqında qısa məlumat..."
              data-testid="edit-desc-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFile(null)}>Ləğv et</Button>
            <Button onClick={saveDescription} className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold" data-testid="edit-desc-save">Yadda saxla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview modal */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="preview-modal">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle style={{ color: '#3D4F6F' }} className="pr-8">
                  {preview.name}
                  <span className="text-xs font-normal text-slate-400 ml-2">{fmtBytes(preview.bytes)}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {preview.resource_type === 'image' ? (
                  <img src={preview.url} alt={preview.name} className="w-full max-h-[60vh] object-contain rounded-lg bg-slate-50" />
                ) : preview.resource_type === 'video' ? (
                  <video src={preview.url} controls className="w-full max-h-[60vh] rounded-lg bg-black" />
                ) : (
                  <div className="bg-slate-50 rounded-lg p-12 text-center">
                    <FileText className="w-16 h-16 text-[#3D4F6F] mx-auto mb-3" />
                    <a href={preview.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[#9ACD32] hover:underline font-semibold">
                      <ExternalLink className="w-4 h-4" />Yeni pəncərədə aç
                    </a>
                  </div>
                )}
                {preview.description && (
                  <p className="text-sm text-slate-600 bg-slate-50 rounded p-3">{preview.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {(preview.tags || []).map((t, i) => <Badge key={i} className="bg-slate-100 text-slate-700 text-[10px]">{t}</Badge>)}
                </div>
                <div className="text-xs text-slate-400 pt-2 border-t">
                  Yüklənib: {preview.uploaded_by_name} · {formatDateTime(preview.uploaded_at)}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
