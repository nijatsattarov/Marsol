import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Download } from 'lucide-react';

/**
 * Universal Excel Export Column Picker.
 *
 * Props:
 *  - open, onOpenChange: dialog state
 *  - columns: [{ key, label, width?, get?(row, index) }]
 *  - defaultKeys: array of column keys initially selected
 *  - rows: data array
 *  - sheetName, fileName: xlsx output naming
 *  - title: dialog title (default "Excel ixrac — sütunları seçin")
 *  - onSuccess: optional callback after export
 *  - storageKey: optional localStorage key to remember user selection
 */
export default function ExcelColumnPicker({
  open,
  onOpenChange,
  columns = [],
  defaultKeys,
  rows = [],
  sheetName = 'Sheet1',
  fileName = 'export',
  title = 'Excel ixrac — sütunları seçin',
  onSuccess,
  storageKey,
}) {
  const initialKeys = defaultKeys && defaultKeys.length ? defaultKeys : columns.map(c => c.key);
  const [selected, setSelected] = useState(() => {
    if (storageKey) {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (Array.isArray(saved) && saved.length) return saved.filter(k => columns.some(c => c.key === k));
      } catch { /* ignore */ }
    }
    return initialKeys;
  });

  useEffect(() => {
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(selected)); } catch { /* ignore */ }
    }
  }, [selected, storageKey]);

  const allKeys = columns.map(c => c.key);

  const performExport = () => {
    const cols = columns.filter(c => selected.includes(c.key));
    const data = rows.map((r, i) => {
      const row = {};
      cols.forEach(col => {
        row[col.label] = col.get ? col.get(r, i) : (r[col.key] ?? '');
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = cols.map(c => ({ wch: c.width || 15 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `${fileName}_${date}.xlsx`);
    onOpenChange(false);
    if (onSuccess) onSuccess({ rows: data.length, cols: cols.length });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" data-testid="excel-picker-dialog">
        <DialogHeader>
          <DialogTitle style={{ color: '#3D4F6F' }}>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-500">{selected.length} sütun seçilib · {rows.length} qeyd</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSelected(allKeys)} className="text-[#9ACD32] hover:underline">Hamısı</button>
            <span className="text-slate-300">·</span>
            <button type="button" onClick={() => setSelected(initialKeys)} className="text-[#3D4F6F] hover:underline">Default</button>
            <span className="text-slate-300">·</span>
            <button type="button" onClick={() => setSelected([])} className="text-red-500 hover:underline">Sıfırla</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 max-h-[50vh] overflow-y-auto border rounded-md p-3 bg-slate-50">
          {columns.map(col => {
            const checked = selected.includes(col.key);
            return (
              <label
                key={col.key}
                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${checked ? 'bg-white border border-[#9ACD32]/30' : 'hover:bg-white'}`}
                data-testid={`export-col-${col.key}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setSelected(prev => e.target.checked ? [...prev, col.key] : prev.filter(k => k !== col.key));
                  }}
                  className="accent-[#9ACD32] w-3.5 h-3.5"
                />
                <span className="text-xs text-[#3D4F6F]">{col.label}</span>
              </label>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="excel-picker-cancel">Ləğv et</Button>
          <Button
            onClick={performExport}
            disabled={selected.length === 0}
            className="bg-[#9ACD32] text-[#3D4F6F] hover:bg-[#8BC125] font-semibold"
            data-testid="excel-picker-confirm"
          >
            <Download className="w-4 h-4 mr-1" />İxrac et
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
