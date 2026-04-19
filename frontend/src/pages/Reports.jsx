import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Sparkles, Loader2, Download, Save, Lightbulb, Database, RotateCcw, AlertCircle, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Toaster, toast } from 'sonner';
import * as XLSX from 'xlsx';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const LIST_FIELDS = [
  { key: 'name', label: 'Ad / Soyad' },
  { key: 'company', label: 'Şirkət' },
  { key: 'phone', label: 'Telefon' },
  { key: 'email', label: 'Email' },
  { key: 'position', label: 'Vəzifə' },
  { key: 'notes', label: 'Qeyd' },
];

export default function Reports() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [examples, setExamples] = useState([]);
  const [history, setHistory] = useState([]);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveForm, setSaveForm] = useState({ title: '', description: '', mapping: {} });
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchExamples = useCallback(async () => {
    try { const r = await axios.get(`${API}/ai/examples`, { headers }); setExamples(r.data.examples || []); }
    catch { setExamples([]); }
  }, []);
  useEffect(() => { fetchExamples(); }, [fetchExamples]);

  const runAnalyze = async (q) => {
    const query = (q ?? prompt).trim();
    if (!query) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await axios.post(`${API}/ai/analyze`, { prompt: query }, { headers, timeout: 120000 });
      setResult(res.data);
      setHistory(h => [{ prompt: query, at: new Date().toLocaleTimeString('az-AZ') }, ...h].slice(0, 10));
      toast.success('Analiz hazırdır');
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Xəta baş verdi';
      setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  };

  const exportToExcel = () => {
    if (!result) return;
    const data = result.rows.map(row => {
      const obj = {};
      result.headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = result.headers.map(h => ({ wch: Math.min(Math.max(h.length + 4, 12), 40) }));
    XLSX.utils.book_append_sheet(wb, ws, result.title.slice(0, 28));
    XLSX.writeFile(wb, `${result.title.replace(/[^\w\sƏəÖöÜüŞşÇçĞğİıI]/g, '')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel endirildi');
  };

  const openSaveModal = () => {
    if (!result) return;
    setSaveForm({
      title: result.title,
      description: `AI sorğusu: ${result.prompt}`,
      mapping: { ...(result.list_mapping || {}) },
    });
    setShowSaveModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.post(`${API}/ai/save-to-list`, {
        title: saveForm.title,
        description: saveForm.description,
        headers: result.headers,
        rows: result.rows,
        mapping: saveForm.mapping,
      }, { headers });
      toast.success(res.data.message);
      setShowSaveModal(false);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Xəta');
    } finally { setSaving(false); }
  };

  const copyTable = () => {
    if (!result) return;
    const lines = [result.headers.join('\t'), ...result.rows.map(r => r.map(c => c ?? '').join('\t'))];
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Cədvəl kopyalandı');
  };

  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runAnalyze();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-testid="reports-page">
      <Toaster position="top-right" richColors />

      {/* Hero header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-[#9ACD32]/20 to-emerald-100 rounded-full mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#3D4F6F]" />
            <span className="text-[11px] font-semibold text-[#3D4F6F]">AI Data Analyst</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#3D4F6F]">Hesabatlar</h1>
          <p className="text-slate-500 text-sm mt-1 max-w-xl">Sistemdəki data haqqında istənilən sualı Azərbaycan dilində yazın — AI sizə başlıqlı cədvəl hazırlayacaq.</p>
        </div>
      </div>

      {/* Prompt box */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 mb-4" data-testid="prompt-panel">
        <div className="flex items-start gap-3">
          <div className="hidden sm:flex w-10 h-10 rounded-full bg-gradient-to-br from-[#3D4F6F] to-[#2A364C] items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-[#9ACD32]" />
          </div>
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Məsələn: '5 yaş üzəri uşağı olan sahibkarlar' və ya 'İyun ayında doğum günü olan üzvlər'..."
              className="w-full min-h-[70px] p-3 text-sm bg-white border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#9ACD32]/50 focus:border-[#9ACD32]"
              data-testid="ai-prompt-input"
              disabled={loading}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
              <p className="text-[10px] text-slate-400">Ctrl+Enter ilə göndər</p>
              <div className="flex gap-2">
                {prompt && !loading && <Button variant="outline" size="sm" onClick={() => { setPrompt(''); setResult(null); setError(null); }}><RotateCcw className="w-3 h-3 mr-1" />Sıfırla</Button>}
                <Button onClick={() => runAnalyze()} disabled={loading || !prompt.trim()} className="bg-[#3D4F6F] hover:bg-[#2A364C] text-white" data-testid="ai-analyze-btn">
                  {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Analiz edilir...</> : <><Sparkles className="w-4 h-4 mr-1" />Analiz et</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Examples chips (only if no result) */}
      {!result && !loading && examples.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4" data-testid="examples-panel">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-[#3D4F6F]">Nümunə sorğular</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex, i) => (
              <button
                key={i}
                onClick={() => { setPrompt(ex); runAnalyze(ex); }}
                className="text-xs px-3 py-2 bg-slate-50 hover:bg-[#9ACD32]/20 text-slate-700 rounded-lg border border-slate-200 hover:border-[#9ACD32] transition-colors"
                data-testid={`example-${i}`}
                disabled={loading}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3" data-testid="error-panel">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div><p className="text-sm font-medium text-red-700">Xəta</p><p className="text-xs text-red-600 mt-0.5">{error}</p></div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl shadow-sm border p-10 flex flex-col items-center justify-center gap-3" data-testid="loading-panel">
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#3D4F6F] to-[#2A364C] flex items-center justify-center animate-pulse">
              <Sparkles className="w-7 h-7 text-[#9ACD32]" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-[#9ACD32] border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-[#3D4F6F] font-medium">AI sisteminizdəki datanı analiz edir...</p>
          <p className="text-xs text-slate-400">Bu bir neçə saniyə çəkə bilər</p>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" data-testid="result-panel">
          <div className="p-4 border-b bg-gradient-to-r from-[#3D4F6F] to-[#2A364C] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-4 h-4 text-[#9ACD32]" />
                <Badge className="bg-[#9ACD32]/20 text-[#9ACD32] border-[#9ACD32]/30 text-[10px] font-mono">{result.collection}</Badge>
                <Badge className="bg-white/10 text-white border-white/20 text-[10px]">{result.row_count} sətir</Badge>
              </div>
              <h2 className="text-lg font-bold" data-testid="result-title">{result.title}</h2>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={copyTable} variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20"><Copy className="w-3.5 h-3.5 mr-1" />Kopyala</Button>
              <Button onClick={exportToExcel} variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20" data-testid="export-excel-btn"><Download className="w-3.5 h-3.5 mr-1" />Excel</Button>
              <Button onClick={openSaveModal} size="sm" className="bg-[#9ACD32] hover:bg-[#8BC125] text-[#3D4F6F] font-semibold" data-testid="save-to-list-btn"><Save className="w-3.5 h-3.5 mr-1" />Siyahıya əlavə et</Button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            {result.rows.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">Bu sorğu üçün nəticə tapılmadı</div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-400 w-10">#</th>
                    {result.headers.map((h, i) => (
                      <th key={i} className="text-left px-3 py-2.5 text-xs font-semibold text-[#3D4F6F] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-50 hover:bg-slate-50/60" data-testid={`result-row-${ri}`}>
                      <td className="px-3 py-2 text-[10px] text-slate-400">{ri + 1}</td>
                      {result.headers.map((h, ci) => {
                        const v = row[ci];
                        return (
                          <td key={ci} className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                            {v === null || v === undefined || v === '' ? <span className="text-slate-300">—</span> :
                              typeof v === 'number' ? v.toLocaleString('az-AZ') :
                                typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && !loading && (
        <div className="mt-4 bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <h3 className="text-xs font-semibold text-[#3D4F6F] mb-2 flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" />Son sorğular</h3>
          <div className="space-y-1">
            {history.map((h, i) => (
              <button key={i} onClick={() => { setPrompt(h.prompt); runAnalyze(h.prompt); }} className="w-full text-left text-xs text-slate-600 hover:text-[#3D4F6F] hover:bg-slate-50 rounded-lg px-2 py-1.5 flex items-center justify-between gap-2">
                <span className="truncate">{h.prompt}</span><span className="text-[10px] text-slate-400">{h.at}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Save to list Modal */}
      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-[#3D4F6F] flex items-center gap-2"><Save className="w-5 h-5" />Siyahıya əlavə et</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <Label className="text-xs">Siyahı başlığı *</Label>
              <Input value={saveForm.title} onChange={e => setSaveForm({ ...saveForm, title: e.target.value })} required className="text-sm" data-testid="save-title-input" />
            </div>
            <div>
              <Label className="text-xs">Açıqlama</Label>
              <textarea value={saveForm.description} onChange={e => setSaveForm({ ...saveForm, description: e.target.value })} className="w-full min-h-[40px] p-2 text-sm border rounded-lg resize-none" />
            </div>

            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <div className="flex items-center gap-1 mb-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <p className="text-xs font-semibold text-[#3D4F6F]">Sütun xəritələnməsi</p>
              </div>
              <p className="text-[10px] text-slate-500 mb-2">AI avtomatik tanıyıb, lazımsa dəyişin:</p>
              <div className="space-y-2">
                {LIST_FIELDS.map(f => (
                  <div key={f.key} className="grid grid-cols-2 gap-2 items-center">
                    <Label className="text-[11px] text-slate-600">{f.label}</Label>
                    <Select
                      value={saveForm.mapping[f.key] ?? '__none__'}
                      onValueChange={v => setSaveForm({ ...saveForm, mapping: { ...saveForm.mapping, [f.key]: v === '__none__' ? null : v } })}
                    >
                      <SelectTrigger className="text-xs h-8" data-testid={`mapping-${f.key}`}><SelectValue placeholder="(seçilməyib)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">(istifadə etmə)</SelectItem>
                        {result?.headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              <span className="font-semibold text-[#3D4F6F]">{result?.rows.length || 0}</span> sətir "Siyahılar" modulunda yeni siyahı kimi saxlanılacaq.
            </p>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowSaveModal(false)}>Ləğv et</Button>
              <Button type="submit" disabled={saving} className="bg-[#3D4F6F] text-white" data-testid="submit-save-btn">
                {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Saxlanılır...</> : 'Yadda saxla'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
