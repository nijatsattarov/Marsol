import { Input } from './ui/input';

/**
 * Phone input — plain pass-through.
 *
 * The system NEVER auto-prepends a country code or any other number. Whatever
 * the user types is exactly what is stored. If the user wants a country prefix
 * they must type it themselves (e.g. "+994 50 123 45 67" or "0501234567").
 *
 * Earlier this component prefixed everything with "+994" by default, which led
 * to surprising values being saved when the user left the field untouched or
 * forgot to switch the country dropdown.
 */
export default function PhoneInput({ value = '', onChange, placeholder = 'Telefon', testId, className = '', disabled = false }) {
  return (
    <Input
      type="tel"
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`text-sm ${className}`}
      data-testid={testId}
    />
  );
}
