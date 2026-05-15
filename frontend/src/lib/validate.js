// Generic required-field validator used across all forms.
// Each rule is { value, label, required? } or simply { value, label } (required by default).
// Returns first missing label or null if all OK. Caller toasts the message and returns early.

import { toast } from 'sonner';

function _isEmpty(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

/**
 * Validate a list of required fields. Pass an array of [value, "Label"] tuples
 * or a list of objects {value, label}.
 * Optionally pass a 3rd arg `false` to mark as optional (skipped).
 * Returns true if all OK; false (and toasts) if any required field is empty.
 *
 * @example
 *   if (!validateRequired([
 *     [form.name, 'Ad'],
 *     [form.email, 'Email'],
 *     [form.package_id, 'Paket'],
 *   ])) return;
 */
export function validateRequired(rules) {
  const missing = [];
  for (const rule of rules || []) {
    let value, label, required = true;
    if (Array.isArray(rule)) {
      [value, label, required] = rule;
      if (required === undefined) required = true;
    } else if (rule && typeof rule === 'object') {
      value = rule.value;
      label = rule.label;
      required = rule.required !== false;
    } else {
      continue;
    }
    if (required && _isEmpty(value)) missing.push(label);
  }
  if (missing.length) {
    toast.error(`Məcburi sahə(lər) boşdur: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

export default validateRequired;
