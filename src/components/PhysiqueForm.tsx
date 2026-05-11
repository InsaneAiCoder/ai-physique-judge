import type { FormData } from '../types';
import type { T } from '../i18n';

type Props = {
  t: T;
  value: FormData;
  onChange: (value: FormData) => void;
};

const fields: Array<keyof FormData> = ['age', 'gender', 'height', 'weight', 'experience', 'goal', 'division', 'country', 'budget', 'diet'];
const customPrefix = 'Custom: ';

export function PhysiqueForm({ t, value, onChange }: Props) {
  const setField = (field: keyof FormData, nextValue: string) => onChange({ ...value, [field]: nextValue });

  const optionsFor = (field: keyof FormData) => {
    if (field === 'gender') return t.form.genderOptions;
    if (field === 'experience') return t.form.experienceOptions;
    if (field === 'goal') return t.form.goalOptions;
    if (field === 'division') return t.form.divisionOptions;
    if (field === 'budget') return t.form.budgetOptions;
    if (field === 'diet') return t.form.dietOptions;
    return undefined;
  };

  return (
    <div className="glass rounded-3xl p-5 shadow-premium sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const options = optionsFor(field);
          const label = t.form[field];
          const selectValue = field === 'diet' && value.diet.startsWith(customPrefix) ? 'Custom' : value[field];
          return (
            <label key={field} className="space-y-2">
              <span className="text-sm font-medium text-slate-600">{label}</span>
              {options ? (
                <>
                  <select
                    value={selectValue}
                    onChange={(event) => setField(field, event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-electric focus:ring-4 focus:ring-blue-50"
                  >
                    <option value="">{t.form.select}</option>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {field === 'diet' && selectValue === 'Custom' && (
                    <input
                      value={value.diet.startsWith(customPrefix) ? value.diet.slice(customPrefix.length) : ''}
                      onChange={(event) => setField('diet', `${customPrefix}${event.target.value}`)}
                      placeholder={t.form.customDietPlaceholder}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-electric focus:ring-4 focus:ring-blue-50"
                    />
                  )}
                </>
              ) : (
                <input
                  value={value[field]}
                  inputMode={['age', 'height', 'weight'].includes(field) ? 'decimal' : 'text'}
                  onChange={(event) => setField(field, event.target.value)}
                  placeholder={t.form.placeholder}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-electric focus:ring-4 focus:ring-blue-50"
                />
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
