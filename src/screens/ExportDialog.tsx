import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Checkbox, Radio } from '../components/Checkbox';
import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { SegmentedControl } from '../components/SegmentedControl';
import { Select } from '../components/Select';
import { SqlEditor } from '../components/SqlEditor';
import { Alert } from '../components/Toast';
import { byteLength, countLines, exportFileName, formatBytes, migrationFileName, type ExportFormat } from '../core/files';
import { DEFAULT_GENERATE_OPTIONS, EXPORT_ENGINES, generatorFor, migratorFor, type GenerateOptions } from '../core/generate';
import { convertsTypes, convertTables } from '../core/generate/convert';
import { generateJson } from '../core/generate/json';
import { t } from '../core/i18n';
import type { Table } from '../core/model';
import { countInferred, declareInferred } from '../core/relations';
import { ENGINES } from '../core/schemaList';
import { parseTheme, themeOptions, type Theme } from '../core/theme';
import { timestamp } from '../core/time';
import { findProblems } from '../core/validate';
import { versionLabel } from '../core/versions';
import { useVersions } from '../db/useSchemas';
import { useSettingsStore } from '../store/settings';
import { useUiStore, type ExportSource } from '../store/ui';
import { useDiagramExport } from './diagramExport';
import { copyExport, copyImage, exportFile, exportImage } from './exportActions';

const APP_NAME = 'Schema Studio';

type Option = Exclude<keyof GenerateOptions, 'header'>;

/** How many destructive changes the warning spells out before it only counts the rest. */
const SPELLED_OUT = 2;

const databases = () =>
  ENGINES.map((engine) => {
    const supported = EXPORT_ENGINES.includes(engine);
    return { value: engine, label: supported ? engine : t('common.soon', { name: engine }), disabled: !supported };
  });

/** How many px of a PNG a unit of the canvas can be. */
const SCALES = [1, 2, 3].map((scale) => ({ value: String(scale), label: `${scale}×` }));
const PREVIEW_HEIGHT = 372;

interface DiagramPreviewProps {
  /** The picture; null while it is not drawn yet. */
  svg: string | null;
  theme: Theme;
}

/** The diagram as it will be exported, fitted into the preview. What it leaves see-through shows as a chequered board. */
function DiagramPreview({ svg, theme }: DiagramPreviewProps) {
  const source = useMemo(() => svg && `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, [svg]);
  return (
    // In the theme of the picture, whatever the app is painted in: a picture without a background is to be read on its own.
    <div className="ss-diagram-preview" data-theme={theme} style={{ height: PREVIEW_HEIGHT }}>
      {source && <img src={source} alt={t('export.previewAlt')} />}
    </div>
  );
}

export interface ExportDialogProps {
  schema: ExportSource;
}

export function ExportDialog({ schema }: ExportDialogProps) {
  const closeDialog = useUiStore((s) => s.closeDialog);
  const [format, setFormat] = useState<ExportFormat>('sql');
  // DDL is written for an engine that has a generator, whatever the schema was made for.
  const [database, setDatabase] = useState(EXPORT_ENGINES.includes(schema.engine) ? schema.engine : EXPORT_ENGINES[0]);
  const [options, setOptions] = useState<GenerateOptions>(DEFAULT_GENERATE_OPTIONS);
  // Foreign keys that were inferred are not in the database, so the file only has them when asked.
  const inferred = useMemo(() => countInferred(schema.tables), [schema.tables]);
  const [wantsInferred, setWantsInferred] = useState(false);
  // The time in the file's header is that of opening the dialog, so the preview does not change under the reader.
  const [openedAt] = useState(Date.now);

  // A migration starts from a saved version: any but the one being exported, unless that has unsaved changes on top.
  const stored = useVersions(schema.id);
  const bases = useMemo(
    () => (stored ?? []).filter((v) => schema.unsaved || v.version !== schema.version),
    [stored, schema.unsaved, schema.version],
  );
  const [wantsMigration, setWantsMigration] = useState(schema.migrateFrom !== undefined);
  const [pickedBase, setPickedBase] = useState(schema.migrateFrom ?? null);
  // Without a pick the migration starts from the version before the exported one.
  const base =
    bases.find((v) => v.version === pickedBase) ?? bases.find((v) => v.version <= (schema.version ?? 0)) ?? bases[0] ?? null;
  const canMigrate = format === 'sql' && base !== null && migratorFor(database) !== null;
  const migrating = wantsMigration && canMigrate;

  const version = schema.version === null ? t('export.notSaved') : versionLabel(schema.version);
  // What the file says it holds. A file reads the same whatever language the app is in.
  const target = `${schema.version === null ? 'not saved' : versionLabel(schema.version)}${schema.unsaved ? ' + unsaved changes' : ''}`;
  // A schema made for another engine is written with the types of the database it is exported for.
  const converted = format === 'sql' && convertsTypes(schema.engine, database);
  const migration = useMemo(() => {
    if (!migrating || !base) return null;
    const header = [
      `${schema.name} · migration ${versionLabel(base.version)} → ${target} · ${database}`,
      `generated by ${APP_NAME} ${timestamp(openedAt)}`,
      ...(converted ? [`data types converted from ${schema.engine}`] : []),
    ];
    const tables = (of: readonly Table[]) => convertTables(of, schema.engine, database);
    return migratorFor(database)?.migrate(tables(base.snapshot.tables), tables(schema.tables), { header }) ?? null;
  }, [migrating, base, schema, target, database, converted, openedAt]);
  const text = useMemo(() => {
    if (migration) return migration.sql;
    const tables = wantsInferred && options.foreignKeys ? declareInferred(schema.tables) : schema.tables;
    if (format === 'json') return generateJson({ name: schema.name, version: schema.version, engine: schema.engine }, tables, options);
    const header = [
      `${schema.name} · ${target} · ${database}`,
      `generated by ${APP_NAME} ${timestamp(openedAt)}`,
      ...(converted ? [`data types converted from ${schema.engine}`] : []),
    ];
    return generatorFor(database)?.generate(convertTables(tables, schema.engine, database), { ...options, header }) ?? '';
  }, [migration, format, database, converted, options, wantsInferred, schema, target, openedAt]);

  // The diagram as a picture, in the theme the app is painted in until another is picked.
  const pictured = format === 'svg' || format === 'png';
  const [theme, setTheme] = useState(() => useSettingsStore.getState().theme);
  const [transparent, setTransparent] = useState(false);
  const [embedFonts, setEmbedFonts] = useState(true);
  const [scale, setScale] = useState(2);
  const snapshot = useMemo(
    () => ({ tables: schema.tables, positions: schema.positions, groups: schema.groups }),
    [schema.tables, schema.positions, schema.groups],
  );
  const diagram = useDiagramExport(snapshot, { theme, transparent, embedFonts, scale }, pictured);
  /** A diagram has to have a table on its canvas to be a picture. */
  const placed = useMemo(
    () => schema.tables.filter((t) => Object.hasOwn(schema.positions, t.name)).length,
    [schema.tables, schema.positions],
  );
  const ready = !pictured || (diagram !== null && placed > 0);

  const fileName =
    migration && base
      ? migrationFileName(schema.name, base.version, schema.unsaved ? null : schema.version)
      : exportFileName(schema.name, schema.version, format);
  const destructive = migration?.destructive ?? [];
  const problems = useMemo(() => findProblems(schema.tables).length, [schema.tables]);
  const toggle = (option: Option) => (checked: boolean) => setOptions((current) => ({ ...current, [option]: checked }));
  const save = () => {
    if (!ready) return;
    if (format === 'png' && diagram) void exportImage(fileName, diagram.png());
    else exportFile(fileName, pictured && diagram ? diagram.file : text);
  };
  const copy = () => {
    if (!ready) return;
    if (format === 'png' && diagram) void copyImage(diagram.png());
    else void copyExport(pictured && diagram ? diagram.file : text);
  };
  // A PNG is only drawn when it is exported: what is known of it before is how large it will be.
  let size = formatBytes(byteLength(text));
  if (pictured) {
    size = !diagram ? '' : format === 'png' ? `${diagram.pixels.width} × ${diagram.pixels.height} px` : formatBytes(byteLength(diagram.file));
  }

  // ⌘⏎ exports from anywhere in the dialog. The handler is renewed on every render, so it sees the current text.
  const confirm = useRef(save);
  useEffect(() => {
    confirm.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      confirm.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Modal
      title={t('export.title')}
      subtitle={`${schema.name} · ${version} · ${t('count.tables', { count: schema.tables.length })}${schema.unsaved ? ` · ${t('export.unsaved')}` : ''}`}
      width={860}
      onClose={closeDialog}
      bodyStyle={{ padding: 0 }}
      footerStart={
        <span className="ss-modal-foot-hint">
          <Icon name="file-code" size={14} />
          <span className="ss-mono">{fileName}</span>
          {size && `· ${size}`}
        </span>
      }
      footer={
        <>
          <Button icon="copy" disabled={!ready} onClick={copy}>
            {t('common.copy')}
          </Button>
          <Button onClick={closeDialog}>{t('common.cancel')}</Button>
          <Button variant="primary" icon="download" kbd={['⌘', '⏎']} disabled={!ready} onClick={save} data-autofocus>
            {t('common.export')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', minHeight: 420 }}>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, borderRight: '1px solid var(--line-1)' }}>
          <div>
            <div className="ss-caption" style={{ marginBottom: 8 }}>
              {t('export.format')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Radio
                name="fmt"
                label="SQL"
                description={t('export.sqlDescription')}
                checked={format === 'sql'}
                onChange={() => setFormat('sql')}
              />
              <Radio
                name="fmt"
                label="JSON"
                description={t('export.jsonDescription')}
                checked={format === 'json'}
                onChange={() => setFormat('json')}
              />
              <Radio
                name="fmt"
                label="SVG"
                description={t('export.svgDescription')}
                checked={format === 'svg'}
                onChange={() => setFormat('svg')}
              />
              <Radio
                name="fmt"
                label="PNG"
                description={t('export.pngDescription')}
                checked={format === 'png'}
                onChange={() => setFormat('png')}
              />
            </div>
          </div>
          {pictured ? (
            <>
              <Field label={t('field.theme')}>
                <SegmentedControl options={themeOptions()} value={theme} onChange={(value) => setTheme(parseTheme(value))} />
              </Field>
              {format === 'png' && (
                <Field
                  label={t('export.scale')}
                  hint={
                    diagram && diagram.scale < scale
                      ? t('export.scaleLimited', { scale: diagram.scale })
                      : t('export.scaleHint')
                  }
                >
                  <Select value={String(scale)} onChange={(v) => setScale(Number(v))} options={SCALES} label={t('export.scale')} />
                </Field>
              )}
              <div>
                <div className="ss-caption" style={{ marginBottom: 8 }}>
                  {t('export.options')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Checkbox
                    label={t('export.transparent')}
                    description={t('export.transparentDescription')}
                    checked={transparent}
                    onChange={setTransparent}
                  />
                  {format === 'svg' && (
                    <Checkbox
                      label={t('export.embedFonts')}
                      description={t('export.embedFontsDescription')}
                      checked={embedFonts}
                      onChange={setEmbedFonts}
                    />
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <Field label={t('field.database')} hint={converted ? t('export.converted', { engine: schema.engine }) : undefined}>
                <Select value={database} onChange={setDatabase} options={databases()} disabled={format === 'json'} label={t('field.database')} />
              </Field>
              <div>
                <div className="ss-caption" style={{ marginBottom: 8 }}>
                  {t('export.options')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* A migration is everything that changed: there is nothing to leave out of it. */}
                  <Checkbox label={t('export.indexes')} checked={options.indexes} disabled={migrating} onChange={toggle('indexes')} />
                  <Checkbox label={t('export.foreignKeys')} checked={options.foreignKeys} disabled={migrating} onChange={toggle('foreignKeys')} />
                  {inferred > 0 && (
                    <Checkbox
                      label={t('export.inferred')}
                      description={t('export.inferredDescription', { count: inferred })}
                      checked={wantsInferred && options.foreignKeys && !migrating}
                      disabled={!options.foreignKeys || migrating}
                      onChange={setWantsInferred}
                    />
                  )}
                  <Checkbox label={t('export.comments')} checked={options.comments} disabled={migrating} onChange={toggle('comments')} />
                  <Checkbox
                    label={t('export.dropIfExists')}
                    checked={options.dropIfExists && format === 'sql' && !migrating}
                    // JSON describes the schema; it has no statements to drop anything.
                    disabled={format === 'json' || migrating}
                    onChange={toggle('dropIfExists')}
                  />
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--line-1)', paddingTop: 14 }}>
                <Checkbox
                  label={t('export.migration')}
                  description={
                    base
                      ? t('export.migrationBetween', { from: versionLabel(base.version), to: version })
                      : t('export.migrationAny')
                  }
                  checked={migrating}
                  // It takes an earlier saved version to start from, and SQL to write.
                  disabled={!canMigrate}
                  onChange={setWantsMigration}
                />
                {migrating && base && (
                  <div className="ss-row" style={{ marginTop: 10, paddingLeft: 22 }}>
                    <Select
                      size="sm"
                      mono
                      value={String(base.version)}
                      onChange={(v) => setPickedBase(Number(v))}
                      options={bases.map((v) => ({ value: String(v.version), label: versionLabel(v.version) }))}
                      label={t('export.baseVersion')}
                      style={{ width: 72 }}
                    />
                    <Icon name="arrow-right" size={14} style={{ color: 'var(--ink-3)' }} />
                    <Badge tone="accent">{version}</Badge>
                    {schema.unsaved && <Badge tone="modified">{t('export.unsavedBadge')}</Badge>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, background: 'var(--bg-2)' }}>
          <div className="ss-row">
            <span className="ss-caption">{t('export.preview')}</span>
            <span className="ss-spacer" />
            {pictured ? (
              <span className="ss-faint" style={{ fontSize: 12 }}>
                {diagram?.preview && placed > 0 ? `${t('count.tables', { count: placed })} · ${diagram.preview.width} × ${diagram.preview.height}` : ''}
              </span>
            ) : migration ? (
              <Badge tone="modified" sans>
                {t('count.statements', { count: migration.statements })}
              </Badge>
            ) : (
              <span className="ss-faint" style={{ fontSize: 12 }}>
                {t('count.lines', { count: countLines(text) })}
              </span>
            )}
          </div>
          {problems > 0 && !pictured && (
            <Alert tone="warn" title={t('count.invalidColumns', { count: problems })}>
              {t('export.problemsBody')}
            </Alert>
          )}
          {destructive.length > 0 && (
            <Alert tone="warn" title={t('count.destructiveChanges', { count: destructive.length })}>
              {destructive
                .slice(0, SPELLED_OUT)
                .map((d) => d.message)
                .join(' ')}
              {destructive.length > SPELLED_OUT ? ` ${t('common.andMore', { count: destructive.length - SPELLED_OUT })}` : ''}
            </Alert>
          )}
          {!pictured && (
            <SqlEditor
              value={text}
              readOnly
              // The preview gives up the height of the warnings above it.
              height={PREVIEW_HEIGHT - (problems > 0 ? 72 : 0) - (destructive.length > 0 ? 72 : 0)}
              language={format}
              label={t('export.previewLabel')}
            />
          )}
          {pictured && placed > 0 && <DiagramPreview svg={diagram?.preview?.svg ?? null} theme={theme} />}
          {pictured && placed === 0 && (
            <Alert tone="info" title={t('export.noTables')}>
              {t('export.noTablesBody')}
            </Alert>
          )}
        </div>
      </div>
    </Modal>
  );
}
