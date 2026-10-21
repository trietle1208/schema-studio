import { cx } from '../cx';

export interface LogicToggleProps {
  value: 'AND' | 'OR';
  onChange: (value: 'AND' | 'OR') => void;
  label: string;
}

/** AND / OR. The one that is on is a solid accent (AND) or fk (OR), with text in `bg-2`. */
export function LogicToggle({ value, onChange, label }: LogicToggleProps) {
  return (
    <div className="ss-fb-logic" role="group" aria-label={label}>
      {(['AND', 'OR'] as const).map((logic) => (
        <button
          key={logic}
          type="button"
          aria-pressed={value === logic}
          className={cx(value === logic && (logic === 'AND' ? 'is-and' : 'is-or'))}
          onClick={() => onChange(logic)}
        >
          {logic}
        </button>
      ))}
    </div>
  );
}
