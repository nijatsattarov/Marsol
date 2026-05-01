/**
 * Read-only renderer for custom fields in detail/view modals.
 * Shows ONLY fields that have a non-empty value on the entity.
 *
 * Usage:
 *   <CustomFieldsView fields={customFields} entity={company} />
 *   <CustomFieldsView fields={customFields} entity={employee} groupByTab />
 */
import { Label } from './ui/label';

export default function CustomFieldsView({ fields = [], entity = {}, groupByTab = false }) {
  if (!fields?.length) return null;

  // Pick fields that have a value present on the entity
  const filled = fields.filter((cf) => {
    const v = entity[cf.field_name];
    return v !== undefined && v !== null && String(v).trim() !== '';
  });

  if (!filled.length) return null;

  if (!groupByTab) {
    return (
      <div className="pt-3 mt-3 border-t border-slate-200" data-testid="custom-fields-view">
        <p className="text-xs font-semibold text-slate-500 mb-2">Xüsusi sahələr</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filled.map((cf) => (
            <FieldRow key={cf.id} cf={cf} value={entity[cf.field_name]} />
          ))}
        </div>
      </div>
    );
  }

  // Group by sub_tab so each section appears next to its sibling fields
  const groups = filled.reduce((acc, cf) => {
    const k = cf.sub_tab || 'other';
    (acc[k] = acc[k] || []).push(cf);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(groups).map(([tab, list]) => (
        <div key={tab} className="pt-3 mt-3 border-t border-slate-200" data-testid={`custom-fields-${tab}`}>
          <p className="text-xs font-semibold text-slate-500 mb-2 capitalize">Xüsusi sahələr — {tab}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {list.map((cf) => (
              <FieldRow key={cf.id} cf={cf} value={entity[cf.field_name]} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function FieldRow({ cf, value }) {
  const display = cf.field_type === 'date' && value
    ? new Date(value).toLocaleDateString('az-AZ')
    : Array.isArray(value)
      ? value.join(', ')
      : String(value);
  return (
    <div>
      <Label className="text-xs text-slate-500">{cf.field_label || cf.field_name}</Label>
      <p className="text-sm font-medium text-[#3D4F6F] break-words">{display}</p>
    </div>
  );
}
