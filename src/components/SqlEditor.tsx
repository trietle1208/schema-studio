import { useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { highlightJson, highlightSql } from '../core/highlight';
import { cx } from './cx';
import { Icon } from './Icon';
import { SqlTokens } from './SqlTokens';

// The line height and the padding above the first line, as bundle.css sets them for .ss-editor.
const LINE_HEIGHT = 18;
const PADDING_TOP = 8;

export interface SqlEditorActions {
  /** Scrolls a line into view and puts the caret at its start. Lines count as the gutter shows them. */
  goToLine: (line: number) => void;
}

export interface SqlEditorProps {
  /** With `onChange` the editor is controlled; `defaultValue` is where an uncontrolled one starts. */
  value?: string;
  defaultValue?: string;
  onChange?: (sql: string) => void;
  height?: number;
  /** The line to mark as the one an error is on, as the gutter numbers it. */
  errorLine?: number | null;
  /** The number of the first line, for an excerpt of a longer script. */
  firstLine?: number;
  readOnly?: boolean;
  placeholder?: string;
  label?: string;
  /** What the text is highlighted as. */
  language?: 'sql' | 'json';
  actionsRef?: Ref<SqlEditorActions>;
  style?: CSSProperties;
}

export function SqlEditor({
  value: controlled,
  defaultValue,
  onChange,
  height = 220,
  errorLine,
  firstLine = 1,
  readOnly,
  placeholder,
  label,
  language = 'sql',
  actionsRef,
  style,
}: SqlEditorProps) {
  const [inner, setInner] = useState(defaultValue ?? controlled ?? '');
  const value = controlled != null && (onChange || readOnly) ? controlled : inner;
  const box = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const lines = value.split('\n');
  const maxLength = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const tokens = useMemo(() => (language === 'json' ? highlightJson(value) : highlightSql(value)), [value, language]);
  // An error on a line that is not shown has nothing to mark.
  const marked = errorLine != null && errorLine >= firstLine && errorLine < firstLine + lines.length ? errorLine : null;

  useImperativeHandle(actionsRef, () => ({
    goToLine(line) {
      const index = Math.min(lines.length - 1, Math.max(0, line - firstLine));
      const offset = lines.slice(0, index).reduce((sum, text) => sum + text.length + 1, 0);
      textarea.current?.focus({ preventScroll: true });
      textarea.current?.setSelectionRange(offset, offset);
      // The line ends up in the middle of the editor.
      const el = box.current;
      if (el) el.scrollTop = Math.max(0, PADDING_TOP + index * LINE_HEIGHT - (el.clientHeight - LINE_HEIGHT) / 2);
    },
  }));

  return (
    <div ref={box} className={cx('ss-editor', marked !== null && 'is-error')} style={{ height, ...style }}>
      <div className="ss-editor-inner">
        <div className="ss-editor-gutter">
          {lines.map((_, i) => (
            <div key={i} className={i + firstLine === marked ? 'is-error' : undefined}>
              {i + firstLine}
            </div>
          ))}
        </div>
        <div className="ss-editor-code" style={{ minWidth: `${maxLength + 4}ch` }}>
          {marked !== null && (
            <div className="ss-editor-errline" style={{ top: PADDING_TOP + (marked - firstLine) * LINE_HEIGHT }} />
          )}
          <pre>
            <SqlTokens tokens={tokens} />
            {'\n'}
          </pre>
          <textarea
            ref={textarea}
            value={value}
            spellCheck={false}
            aria-label={label || 'SQL'}
            placeholder={placeholder}
            readOnly={readOnly}
            onChange={(e) => {
              if (onChange) onChange(e.target.value);
              else setInner(e.target.value);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export interface ParseStatusProps {
  state?: 'idle' | 'parsing' | 'ok' | 'error';
  /** What was parsed: "24 tables · 31 relationships · 18 indexes". */
  summary?: string;
  /** The error, or the hint shown while there is nothing to parse. */
  message?: string;
  /** Offers "Go to line" beside an error. */
  onJump?: () => void;
  aside?: ReactNode;
}

export function ParseStatus({ state = 'idle', summary, message, onJump, aside }: ParseStatusProps) {
  if (state === 'ok') {
    return (
      <div className="ss-parse is-ok" role="status">
        <Icon name="check-circle" size={16} />
        <span>Parsed</span>
        <span className="ss-parse-sum">{summary}</span>
        {aside}
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="ss-parse is-error" role="alert">
        <Icon name="alert" size={16} />
        <span>{message || 'Unable to parse SQL.'}</span>
        {onJump && (
          <a
            role="button"
            tabIndex={0}
            onClick={onJump}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onJump();
            }}
          >
            Go to line
          </a>
        )}
      </div>
    );
  }
  if (state === 'parsing') {
    return (
      <div className="ss-parse" role="status">
        <Icon name="clock" size={16} />
        Parsing…
      </div>
    );
  }
  return (
    <div className="ss-parse">
      <Icon name="info" size={16} style={{ color: 'var(--ink-3)' }} />
      {message || 'Paste DDL or drop a file — we parse it locally before importing.'}
    </div>
  );
}
