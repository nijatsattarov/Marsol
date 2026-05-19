import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, X, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Lightweight searchable single-select. Options are sorted alphabetically
 * (locale-aware) and filtered as the user types.
 *
 * Props:
 *   value, onChange, options (string[]), placeholder, disabled, testId, className.
 */
export function SearchableSelect({ value, onChange, options = [], placeholder = 'Seçin', disabled, testId, className }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  // Sort + filter
  const sorted = useMemo(() => [...options].sort((a, b) => a.localeCompare(b, 'az')), [options]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('az');
    if (!q) return sorted;
    return sorted.filter(o => o.toLocaleLowerCase('az').includes(q));
  }, [sorted, query]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // When value changes externally, sync the visible query
  useEffect(() => { if (!open) setQuery(value || ''); }, [value, open]);

  return (
    <div ref={ref} className={cn('relative', className)} data-testid={testId}>
      <div className="flex items-center gap-1 border rounded-md h-9 px-2 bg-white focus-within:ring-2 focus-within:ring-[#9ACD32]/30">
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          type="text"
          value={open ? query : (value || '')}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(''); }}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent outline-none text-sm min-w-0"
          data-testid={testId ? `${testId}-input` : undefined}
        />
        {value && !disabled && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(''); setQuery(''); }} className="text-slate-400 hover:text-red-500">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', open && 'rotate-180')} />
      </div>
      {open && (
        <div className="absolute z-40 mt-1 w-full max-h-60 overflow-y-auto bg-white border rounded-md shadow-lg" data-testid={testId ? `${testId}-options` : undefined}>
          {filtered.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">Heç nə tapılmadı</div>}
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); setQuery(opt); }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 flex items-center justify-between',
                value === opt && 'bg-slate-100 font-medium'
              )}
            >
              <span>{opt}</span>
              {value === opt && <Check className="w-3.5 h-3.5 text-emerald-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchableSelect;
