import { useState, useMemo } from 'react';
import { COUNTRIES, DEFAULT_COUNTRY } from '../lib/countries';
import { Input } from './ui/input';

/**
 * Phone input with a country-code selector. Stores the value as a single
 * string `"+994 50 123 45 67"` so existing modules keep their flat schema.
 *
 * Behavior:
 *   • If `value` already starts with a known dial code (e.g. "+90 555..."),
 *     that country is preselected and the input shows just the local part.
 *   • Otherwise the local part is shown as-is; AZ is the default prefix and
 *     gets prepended on first edit.
 *   • `onChange` always emits the **full** "+code local" string (or "" when
 *     fully cleared) so callers don't have to compose it.
 */
export default function PhoneInput({ value = '', onChange, placeholder = 'Telefon', testId, className = '', disabled = false }) {
  const { initialDial, initialLocal } = useMemo(() => {
    const v = (value || '').trim();
    if (!v) return { initialDial: COUNTRIES.find(c => c.code === DEFAULT_COUNTRY).dial, initialLocal: '' };
    // Prefer the longest matching dial code so '+994' isn't shadowed by '+9'
    const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    const m = sorted.find(c => v.startsWith(c.dial));
    if (m) return { initialDial: m.dial, initialLocal: v.slice(m.dial.length).trimStart() };
    return { initialDial: COUNTRIES.find(c => c.code === DEFAULT_COUNTRY).dial, initialLocal: v };
  }, [value]);

  const [dial, setDial] = useState(initialDial);
  const [local, setLocal] = useState(initialLocal);

  const emit = (newDial, newLocal) => {
    setDial(newDial);
    setLocal(newLocal);
    const combined = newLocal.trim() ? `${newDial} ${newLocal.trim()}` : '';
    onChange?.(combined);
  };

  return (
    <div className={`flex items-stretch gap-1 ${className}`} data-testid={testId}>
      <select
        value={dial}
        onChange={(e) => emit(e.target.value, local)}
        disabled={disabled}
        className="text-sm px-1.5 rounded-md border border-input bg-background h-9 min-w-[88px] focus:outline-none focus:ring-2 focus:ring-[#9ACD32]/40"
        data-testid={testId ? `${testId}-dial` : undefined}
      >
        {COUNTRIES.map(c => (
          <option key={c.code} value={c.dial}>{c.flag} {c.dial}</option>
        ))}
      </select>
      <Input
        type="tel"
        value={local}
        onChange={(e) => emit(dial, e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="text-sm flex-1"
        data-testid={testId ? `${testId}-local` : undefined}
      />
    </div>
  );
}
