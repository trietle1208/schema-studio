import { Fragment } from 'react';
import { t } from '../core/i18n';
import { cx } from './cx';
import { Icon } from './Icon';

export interface StepperProps {
  steps: string[];
  /** Index of the current step, from 0. */
  current: number;
  /** A step that is done is a button that goes back to it; without this none is clickable. */
  onStep?: (index: number) => void;
  label?: string;
}

/** The numbered steps of a dialog that is a path with an end: Import Records. */
export function Stepper({ steps, current, onStep, label }: StepperProps) {
  return (
    <ol className="ss-steps" aria-label={label ?? t('stepper.label')}>
      {steps.map((name, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <Fragment key={i}>
            {i > 0 && <li className={cx('ss-step-line', i <= current && 'is-done')} aria-hidden />}
            <li className={cx('ss-step', `is-${state}`)} aria-current={state === 'current' ? 'step' : undefined}>
              <button type="button" className="ss-step-btn" disabled={state !== 'done' || !onStep} onClick={() => onStep?.(i)}>
                <span className="ss-step-n">{state === 'done' ? <Icon name="check" size={12} strokeWidth={3} /> : i + 1}</span>
                <span className="ss-step-label">{name}</span>
              </button>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
