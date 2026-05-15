import { useState } from 'react';
import { Calendar as CalIcon, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '@/lib/utils';

/**
 * Date picker that DISPLAYS DD/MM/YYYY and STORES ISO YYYY-MM-DD (so backend / native form payloads remain unchanged).
 * Usage: <DatePickerAz value={form.date} onChange={v => setForm({...form, date: v})} />
 */
export function DatePickerAz({ value, onChange, required, disabled, className, placeholder = 'GG/AA/IIII', testId, size = 'default' }) {
  const [open, setOpen] = useState(false);
  const dateObj = value ? new Date(value + 'T00:00:00') : null;
  const display = dateObj && !isNaN(dateObj.getTime())
    ? `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`
    : '';
  const h = size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          data-testid={testId}
          className={cn('w-full justify-between font-normal', h, !display && 'text-slate-400', className)}
        >
          <span>{display || placeholder}{required && !display && <span className="text-red-500 ml-1">*</span>}</span>
          <CalIcon className="w-4 h-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateObj || undefined}
          onSelect={(d) => {
            if (!d) { onChange(''); setOpen(false); return; }
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            onChange(iso);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Pre-generated 24-hour list with 15-min steps: 00:00, 00:15, ..., 23:45 */
const TIME_OPTIONS_15 = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

/**
 * 24-hour time select with 15-min intervals. Stores value as "HH:MM".
 */
export function TimeSelectAz({ value, onChange, required, disabled, className, placeholder = 'Saat', testId, size = 'default', step = 15 }) {
  const opts = step === 30
    ? TIME_OPTIONS_15.filter((_, i) => i % 2 === 0)
    : TIME_OPTIONS_15;
  // Include the current custom value if not in the list (so legacy "10:07" doesn't disappear)
  const allOpts = value && !opts.includes(value) ? [value, ...opts] : opts;
  const h = size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm';
  return (
    <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn(h, className)} data-testid={testId}>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 opacity-60" />
          <SelectValue placeholder={placeholder + (required ? ' *' : '')} />
        </div>
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {allOpts.map((t) => (
          <SelectItem key={t} value={t}>{t}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default { DatePickerAz, TimeSelectAz };
