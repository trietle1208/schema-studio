import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { t } from '../core/i18n';
import { Button } from './Button';
import { cx } from './cx';
import { Icon } from './Icon';
import { rich } from './rich';
import { IconButton } from './IconButton';

const ACCEPT = '.sql,.ddl,.txt';

/** The chosen file as the drop zone shows it. */
export interface DroppedFile {
  name: string;
  /** The line under the name, e.g. its size. */
  meta?: string;
}

export interface DropZoneProps {
  /** The chosen file; without one the zone asks for a file. */
  file?: DroppedFile | null;
  /** Called with the file that was dropped or picked, and with null when the chosen one is removed. */
  onFile?: (file: File | null) => void;
  /** Forces the look of a file being dragged over. */
  over?: boolean;
  hint?: ReactNode;
  style?: CSSProperties;
}

export function DropZone({ file, onFile, over: forcedOver, hint, style }: DropZoneProps) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const browse = () => inputRef.current?.click();
  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      hidden
      onChange={(e) => {
        const picked = e.target.files?.[0];
        // Picking the same file again must count as a change.
        e.target.value = '';
        if (picked) onFile?.(picked);
      }}
    />
  );

  if (file) {
    return (
      <div className="ss-file">
        <span className="ss-file-icon">
          <Icon name="file-code" size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ss-file-name">{file.name}</div>
          <div className="ss-file-meta">{file.meta}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={browse}>
          {t('dropzone.replace')}
        </Button>
        <IconButton icon="x" size="sm" label={t('dropzone.remove')} onClick={() => onFile?.(null)} />
        {input}
      </div>
    );
  }

  return (
    <div
      className={cx('ss-drop', (over || forcedOver) && 'is-over')}
      role="button"
      tabIndex={0}
      style={style}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) onFile?.(dropped);
      }}
      onClick={browse}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        browse();
      }}
    >
      <span className="ss-drop-icon">
        <Icon name="upload" size={16} />
      </span>
      <div className="ss-drop-title">{rich('dropzone.title', { browse: <u>{t('dropzone.browse')}</u> })}</div>
      <div className="ss-drop-sub">{hint || t('dropzone.hint', { command: 'pg_dump --schema-only' })}</div>
      {input}
    </div>
  );
}
