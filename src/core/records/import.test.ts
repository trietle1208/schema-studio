import { afterEach, describe, expect, it } from 'vitest';
import { ecommerceTables } from '../fixtures/ecommerce';
import { existingUsers, USERS_IMPORT_CLASHES, usersImportCsv } from '../fixtures/usersImport';
import { DEFAULT_LOCALE, setLocale } from '../i18n';
import type { Table } from '../model';
import { type RecordData } from './fields';
import {
  analyzeImport,
  convertedColumns,
  CONSTANT,
  groupRows,
  importPreview,
  importReport,
  importSummary,
  mapColumns,
  runImport,
  type ImportMapping,
} from './import';
import { delimiterName, describeSource, parseJsonRows, readRecordsFile, sampleCells } from './importFile';
import { seedRecords } from '.';

afterEach(() => setLocale(DEFAULT_LOCALE));

const users = ecommerceTables.find((x) => x.name === 'users')!;
const table = (name: string): Table => ecommerceTables.find((x) => x.name === name)!;
const data: RecordData = { ...seedRecords(ecommerceTables, 1), users: existingUsers() };
const file = readRecordsFile(usersImportCsv);

describe('readRecordsFile', () => {
  it('reads users_import.csv: the delimiter, the header, 1,000 rows on lines 2 to 1001', () => {
    expect(file).toMatchObject({ format: 'csv', delimiter: ',', header: true, unit: 'line', error: null });
    expect(file.columns).toEqual(['email', 'full_name', 'country_code', 'signup_date']);
    expect(file.rows).toHaveLength(1000);
    expect(file.at[0]).toBe(2);
    expect(file.at[999]).toBe(1001);
    expect(file.rows[0]).toEqual(['an.nguyen1@example.com', 'An Nguyen', 'VN', '2024-01-01']);
    expect(file.rows[100][1]).toBe('Lê Thị "Hoa", Trần');
  });

  it('reads the same file with a byte order mark, Windows line ends and another delimiter', () => {
    const windows = readRecordsFile('\uFEFF' + usersImportCsv.replace(/\r?\n/g, '\r\n'));
    expect(windows.rows).toEqual(file.rows);
    expect(windows.at).toEqual(file.at);
    const semicolons = readRecordsFile(usersImportCsv.split('\n').slice(0, 4).join('\n').replace(/,/g, ';'));
    expect(semicolons.delimiter).toBe(';');
    expect(semicolons.rows).toHaveLength(3);
  });

  it('takes a delimiter and a header that are asked for over what it found', () => {
    const forced = readRecordsFile('a,b\n1,2', { delimiter: ';' });
    expect(forced.columns).toEqual(['a,b']);
    const noHeader = readRecordsFile(usersImportCsv, { header: false });
    expect(noHeader.columns).toEqual(['column_1', 'column_2', 'column_3', 'column_4']);
    expect(noHeader.rows).toHaveLength(1001);
    expect(noHeader.at[0]).toBe(1);
  });

  it('finds no header in a file of values, and fills a short row up', () => {
    const src = readRecordsFile('an@example.com,An\nbo@example.com');
    expect(src.header).toBe(false);
    expect(src.columns).toEqual(['column_1', 'column_2']);
    expect(src.rows).toEqual([['an@example.com', 'An'], ['bo@example.com', '']]);
  });

  it('says what is wrong with a text that cannot be read, with the line', () => {
    expect(readRecordsFile('')).toMatchObject({ error: 'The file is empty.', rows: [] });
    expect(readRecordsFile('  \n ').error).toBe('The file is empty.');
    expect(readRecordsFile('a,b\n1,"x').error).toBe('Unable to parse CSV near line 2.');
    expect(readRecordsFile('[\n{"a": 1},\n{"a": }\n]').error).toBe('Unable to parse JSON near line 3.');
    expect(readRecordsFile('[1, 2]').error).toBe('Expected an array of objects.');
    expect(readRecordsFile('[]').error).toBe('Expected an array of objects.');
    // A header and nothing under it: the names are kept, so that the first row can be taken for values.
    expect(readRecordsFile('email,name\n')).toMatchObject({ error: 'The file has a header row and no rows below it.', columns: ['email', 'name'], rows: [] });
    expect(readRecordsFile('email,name\n', { header: false }).rows).toEqual([['email', 'name']]);
    expect(readRecordsFile('an@example.com,An\n').error).toBeNull();
  });

  it('says it in Vietnamese when the app is', () => {
    setLocale('vi');
    expect(readRecordsFile('a,b\n1,"x').error).toBe('Không đọc được CSV gần dòng 2.');
  });
});

describe('parseJsonRows', () => {
  const json = JSON.stringify([
    { email: 'an@example.com', age: 31, admin: true, tags: ['a', 'b'] },
    { email: 'bo@example.com', note: null, profile: { city: 'Hue' } },
  ]);

  it('reads an array of objects: the keys in the order they appear, numbers and booleans kept', () => {
    const src = parseJsonRows(json);
    expect(src).toMatchObject({ format: 'json', delimiter: null, unit: 'row', error: null, at: [1, 2] });
    expect(src.columns).toEqual(['email', 'age', 'admin', 'tags', 'note', 'profile']);
    expect(src.rows[0]).toEqual(['an@example.com', 31, true, '["a","b"]', null, null]);
    expect(src.rows[1]).toEqual(['bo@example.com', null, null, null, null, '{"city":"Hue"}']);
  });

  it('reads one object as one row', () => {
    expect(parseJsonRows('{"a": 1}').rows).toEqual([[1]]);
  });

  it('is what readRecordsFile makes of a text that opens with [ or {, with a byte order mark too', () => {
    expect(readRecordsFile(json)).toEqual(parseJsonRows(json));
    expect(readRecordsFile('\uFEFF  ' + json)).toEqual(parseJsonRows(json));
  });

  it('turns every key into a column of the import', () => {
    const src = readRecordsFile('[{"email":"a@x.io","name":"A","created_at":"2026-03-14"}]');
    const mapping = mapColumns(users, src);
    expect(mapping.email.from).toBe('email');
    expect(mapping.created_at.from).toBe('created_at');
  });
});

describe('sampleCells and describeSource', () => {
  it('lists the first cells that hold something', () => {
    expect(sampleCells({ rows: [[''], [null], ['  '], ['a'], [3], ['b']] }, 0, 2)).toEqual(['a', 3]);
  });

  it('says what was found in a file, in a line', () => {
    expect(describeSource(file)).toBe('CSV · UTF-8 · comma · 1,000 rows · header row');
    expect(describeSource(readRecordsFile('[{"a":1}]'))).toBe('JSON · UTF-8 · 1 row · 1 key');
    expect(delimiterName('\t')).toBe('Tab');
    setLocale('vi');
    expect(describeSource(readRecordsFile('a;b\n1;2'))).toBe('CSV · UTF-8 · dấu chấm phẩy · 1 dòng · có dòng tiêu đề');
  });
});

describe('mapColumns', () => {
  it('matches the columns of users_import.csv: email by name, full_name to name, signup_date to created_at', () => {
    const m = mapColumns(users, file, data);
    expect(m.email).toEqual({ from: 'email', by: 'auto', why: 'same' });
    expect(m.name).toEqual({ from: 'full_name', by: 'auto', why: 'similar' });
    expect(m.created_at).toEqual({ from: 'signup_date', by: 'auto', why: 'type' });
    // A counter is never filled, and a column the file has nothing for is left out.
    expect(m.id).toEqual({ from: '', by: 'auto' });
    expect(m.avatar_url).toEqual({ from: '', by: 'auto' });
  });

  it('ignores case, underscores, spaces, camelCase and accents when it compares names', () => {
    const src = { columns: ['Email', 'AVATAR URL', 'Created-At'], rows: [] };
    const m = mapColumns(users, src);
    expect(m.email.from).toBe('Email');
    expect(m.avatar_url.from).toBe('AVATAR URL');
    expect(m.created_at.from).toBe('Created-At');
    const camel = mapColumns(users, { columns: ['avatarUrl', 'createdAt'], rows: [] });
    expect(camel.avatar_url.from).toBe('avatarUrl');
    expect(camel.created_at.from).toBe('createdAt');
    const plain = mapColumns(users, { columns: ['avatarurl'], rows: [] });
    expect(plain.avatar_url.from).toBe('avatarurl');
    expect(mapColumns({ ...users, columns: [{ name: 'dien_thoai', type: 'TEXT', nullable: true }] }, { columns: ['Điện thoại'], rows: [] }).dien_thoai.from).toBe('Điện thoại');
  });

  it('prefers the same name to a name that holds the name, and uses a column of the file once', () => {
    const m = mapColumns(users, { columns: ['full_name', 'name', 'email'], rows: [] });
    expect(m.name.from).toBe('name');
    const only = mapColumns(users, { columns: ['user_name'], rows: [] });
    expect(only.name).toMatchObject({ from: 'user_name', why: 'similar' });
    expect(Object.values(only).filter((x) => x.from === 'user_name')).toHaveLength(1);
  });

  it('matches the one date column to the one date column only when it is the only one', () => {
    const src = readRecordsFile('email,joined\nan@x.io,14/03/2026\nbo@x.io,15/03/2026');
    expect(mapColumns(users, src, data).created_at).toMatchObject({ from: 'joined', why: 'type' });
    // Two columns of the file that look like dates: no guess.
    const two = readRecordsFile('email,joined,left\nan@x.io,2026-03-14,2026-03-15');
    expect(mapColumns(users, two, data).created_at.from).toBe('');
    // A column of text is not a date.
    const text = readRecordsFile('email,joined\nan@x.io,someday');
    expect(mapColumns(users, text, data).created_at.from).toBe('');
  });
});

describe('analyzeImport of users_import.csv', () => {
  const mapping = mapColumns(users, file, data);
  const run = (settings = {}, map: ImportMapping = mapping) => analyzeImport(users, file, map, settings, data);

  it('counts 985 rows to add, 10 duplicates as warnings and 5 errors', () => {
    const a = run();
    expect(a.counts).toEqual({ total: 1000, valid: 985, insert: 985, update: 0, skip: 0, warnings: 10, errors: 5 });
    expect(a.filled).toEqual(['email', 'name', 'created_at']);
    expect(a.missing).toEqual([]);
    expect(a.keys).toEqual(['email']);
  });

  it('tells each error by kind and by the line of the file', () => {
    const { groups } = run();
    expect(groups.required.map((i) => [i.line, i.column, i.message])).toEqual([
      [5, 'email', 'Column "email" cannot be NULL.'],
      [418, 'email', 'Column "email" cannot be NULL.'],
    ]);
    expect(groups.date.map((i) => [i.line, i.column, i.value])).toEqual([
      [9, 'created_at', '2026-02-30'],
      [903, 'created_at', '31/04/2026'],
    ]);
    expect(groups.type.map((i) => [i.line, i.column, i.message])).toEqual([[791, 'name', 'Value is longer than 255 characters.']]);
    expect(groups.fk).toEqual([]);
  });

  it('finds the 10 emails that belong to a user', () => {
    const { groups } = run();
    expect(groups.duplicate.map((i) => i.line)).toEqual(Object.keys(USERS_IMPORT_CLASHES).map(Number));
    expect(groups.duplicate[0]).toMatchObject({ column: 'email', value: 'member1@shop.example', message: 'A row with email "member1@shop.example" already exists.', kind: 'conflict' });
  });

  it('reads the dates written in other ways: 17/01/2024, 28-01-2024 18:05, 05.02.2024', () => {
    const a = run();
    expect(a.rows[20].values.created_at).toBe('2024-01-17 00:00:00');
    expect(a.rows[35].values.created_at).toBe('2024-01-28 18:05:00');
    expect(a.rows[45].values.created_at).toBe('2024-02-05 00:00:00');
    expect(a.rows[2].values.created_at).toBe('2024-01-03 09:14:26');
    expect(a.rows[0].values).toEqual({ email: 'an.nguyen1@example.com', name: 'An Nguyen', created_at: '2024-01-01 00:00:00' });
  });

  it('reads 03/04/2026 the way the whole column writes it', () => {
    const src = readRecordsFile('email,created_at\nan@x.io,03/04/2026\nbo@x.io,04/13/2026');
    const a = analyzeImport(users, src, mapColumns(users, src), {}, data);
    expect(a.rows.map((r) => r.values.created_at)).toEqual(['2026-03-04 00:00:00', '2026-04-13 00:00:00']);
    const day = readRecordsFile('email,created_at\nan@x.io,03/04/2026\nbo@x.io,14/04/2026');
    expect(analyzeImport(users, day, mapColumns(users, day), {}, data).rows.map((r) => r.values.created_at)).toEqual(['2026-04-03 00:00:00', '2026-04-14 00:00:00']);
  });

  it('marks a row by what becomes of it: insert, conflict, invalid', () => {
    const a = run();
    expect(a.rows[0].kind).toBe('insert');
    expect(a.rows[11].kind).toBe('conflict');
    expect(a.rows[3].kind).toBe('invalid');
    expect(a.rows[3].problems).toEqual([{ column: 'email', kind: 'required', value: null, message: 'Column "email" cannot be NULL.' }]);
    expect(a.rows[0].line).toBe(2);
    expect(a.rows[0].index).toBe(0);
  });

  it('counts the rows a group touches once', () => {
    expect(groupRows([{ line: 5 }, { line: 5 }, { line: 9 }])).toBe(2);
    expect(groupRows([])).toBe(0);
  });

  it('upserts the rows whose key exists, and skips them without a warning on request', () => {
    const upsert = run({ mode: 'upsert' });
    expect(upsert.counts).toMatchObject({ valid: 995, insert: 985, update: 10, warnings: 0, errors: 5 });
    expect(upsert.key).toBe('email');
    expect(upsert.rows[11]).toMatchObject({ kind: 'update', match: { id: 1, email: 'member1@shop.example' } });
    const skip = run({ mode: 'skip' });
    expect(skip.counts).toMatchObject({ valid: 985, skip: 10, warnings: 0, errors: 5 });
  });

  it('holds a key to the rows of the file as well: the second row with an email is a duplicate', () => {
    const src = readRecordsFile('email\nan@x.io\nbo@x.io\nan@x.io\n');
    const a = analyzeImport(users, src, mapColumns(users, src), {}, data);
    expect(a.rows.map((r) => r.kind)).toEqual(['insert', 'insert', 'conflict']);
    expect(a.groups.duplicate[0].message).toBe('A row with email "an@x.io" appears on line 2.');
    const json = parseJsonRows('[{"email":"a@x.io"},{"email":"a@x.io"}]');
    expect(analyzeImport(users, json, mapColumns(users, json), {}, data).groups.duplicate[0].message).toBe('A row with email "a@x.io" appears at row 1.');
    // A row with an error does not take its key.
    const bad = readRecordsFile('email,name\nan@x.io,' + 'x'.repeat(300) + '\nan@x.io,Ok\n');
    expect(analyzeImport(users, bad, mapColumns(users, bad), {}, data).rows.map((r) => r.kind)).toEqual(['invalid', 'insert']);
  });

  it('turns empty cells into NULL, or keeps them as empty text', () => {
    const src = readRecordsFile('email,name\nan@x.io,\n');
    const asNull = analyzeImport(users, src, mapColumns(users, src), {}, data);
    expect(asNull.rows[0].values.name).toBeNull();
    const asText = analyzeImport(users, src, mapColumns(users, src), { emptyNull: false }, data);
    expect(asText.rows[0].values.name).toBe('');
  });
});

describe('analyzeImport of the mapping', () => {
  it('names a required column nothing fills, and makes every row an error', () => {
    const src = readRecordsFile('full_name\nAn\nBo\n');
    const a = analyzeImport(users, src, mapColumns(users, src), {}, data);
    expect(a.missing).toEqual(['email']);
    expect(a.counts).toMatchObject({ valid: 0, errors: 2 });
    expect(a.groups.required[0]).toMatchObject({ line: 2, column: 'email', message: 'Column "email" cannot be NULL.' });
  });

  it('fills a column with a constant, for every row', () => {
    const src = readRecordsFile('full_name\nAn\nBo\n');
    const mapping = { ...mapColumns(users, src), email: { from: CONSTANT, by: 'manual' as const, value: 'same@x.io' } };
    const a = analyzeImport(users, src, mapping, {}, data);
    expect(a.missing).toEqual([]);
    expect(a.rows.map((r) => r.values.email)).toEqual(['same@x.io', 'same@x.io']);
    // The same constant in a unique column is a duplicate from the second row on.
    expect(a.rows.map((r) => r.kind)).toEqual(['insert', 'conflict']);
  });

  it('leaves a column out that is mapped to nothing, and ignores a file column that is not there', () => {
    const src = readRecordsFile('email,full_name\nan@x.io,An\n');
    const mapping = { ...mapColumns(users, src), name: { from: '', by: 'manual' as const }, avatar_url: { from: 'no_such', by: 'manual' as const } };
    const a = analyzeImport(users, src, mapping, {}, data);
    expect(a.filled).toEqual(['email']);
    expect(a.rows[0].values).toEqual({ email: 'an@x.io' });
  });

  it('never fills a column the database counts, even when the mapping says so', () => {
    const src = readRecordsFile('id,email\n99,an@x.io\n');
    const mapping = { ...mapColumns(users, src), id: { from: 'id', by: 'manual' as const } };
    const a = analyzeImport(users, src, mapping, {}, data);
    expect(a.filled).toEqual(['email']);
    expect(a.rows[0].values).toEqual({ email: 'an@x.io' });
  });

  it('checks foreign keys against the rows of the other table, unless it is told not to', () => {
    const orders = table('orders');
    const src = readRecordsFile('user_id,total\n1,9.99\n9999,5\n');
    const mapping = mapColumns(orders, src, data);
    expect(mapping.user_id.from).toBe('user_id');
    const a = analyzeImport(orders, src, mapping, {}, data);
    expect(a.counts).toMatchObject({ valid: 1, errors: 1 });
    expect(a.groups.fk).toEqual([{ line: 3, column: 'user_id', value: 9999, message: 'No row in users has id 9999.' }]);
    expect(analyzeImport(orders, src, mapping, { checkFk: false }, data).counts).toMatchObject({ valid: 2, errors: 0 });
    // The default fills the columns the file does not have.
    expect(a.rows[0].values).toEqual({ user_id: 1, total: 9.99 });
    expect(a.missing).toEqual([]);
  });

  it('reads a JSON file into the same table', () => {
    const src = readRecordsFile('[{"email":"an@x.io","name":"An","created_at":"2026-03-14T10:00:00Z"},{"email":"bad","name":null}]');
    const a = analyzeImport(users, src, mapColumns(users, src, data), {}, data);
    expect(a.counts).toMatchObject({ insert: 2, errors: 0 });
    expect(a.rows[0].values).toEqual({ email: 'an@x.io', name: 'An', created_at: '2026-03-14 10:00:00' });
    expect(a.rows[1].values).toEqual({ email: 'bad', name: null });
  });

  it('is a clean pass for the users that are already there, imported as a file', () => {
    const csv = ['email,name', ...existingUsers().map((u) => `${u.email},${u.name}`)].join('\n');
    const src = readRecordsFile(csv);
    expect(analyzeImport(users, src, mapColumns(users, src, data), { mode: 'upsert' }, data).counts).toMatchObject({ update: 17, errors: 0, warnings: 0 });
  });
});

describe('importPreview', () => {
  const mapping = mapColumns(users, file, data);
  const preview = importPreview(users, analyzeImport(users, file, mapping, {}, data));

  it('has the columns the file fills and the first 10 rows as they would be written', () => {
    expect(preview.columns.map((c) => c.name)).toEqual(['email', 'name', 'created_at']);
    expect(preview.rows).toHaveLength(10);
    expect(preview.rows[0]).toEqual({ email: 'an.nguyen1@example.com', name: 'An Nguyen', created_at: '2024-01-01 00:00:00' });
    expect(preview.rows[2].created_at).toBe('2024-01-03 09:14:26');
  });

  it('marks the cells that will not go in, and shows what the file had there', () => {
    // Line 5 is row 4 (index 3) of the preview; line 9 is row 8 (index 7).
    expect(preview.invalid).toEqual([
      { row: 3, column: 'email', message: 'Column "email" cannot be NULL.' },
      { row: 7, column: 'created_at', message: 'Invalid timestamp format.' },
    ]);
    expect(preview.rows[3].email).toBeNull();
    expect(preview.rows[7].created_at).toBe('2026-02-30');
  });

  it('shows the default of a column the file does not fill, and only a few rows of a short file', () => {
    const src = readRecordsFile('email\nan@x.io\n');
    const a = analyzeImport(users, src, { ...mapColumns(users, src), created_at: { from: '', by: 'manual' } }, {}, data);
    expect(importPreview(users, a, 10).rows).toEqual([{ email: 'an@x.io' }]);
    expect(importPreview(users, analyzeImport(users, file, mapping, {}, data), 3).rows).toHaveLength(3);
  });
});

describe('convertedColumns', () => {
  it('names the columns whose cells change on the way in', () => {
    const mapping = mapColumns(users, file, data);
    // Dates become timestamps; text stays text.
    expect([...convertedColumns(users, file, mapping, {}, data)]).toEqual(['created_at']);
  });

  it('knows text that becomes a number, and a column that is left as it is', () => {
    const orders = table('orders');
    const src = readRecordsFile('user_id,total\n1,9.99\n2,5\n');
    expect([...convertedColumns(orders, src, mapColumns(orders, src, data), {}, data)].sort()).toEqual(['total', 'user_id']);
    const json = parseJsonRows('[{"user_id":1,"total":9.99}]');
    // Numbers that are already numbers are not converted.
    expect([...convertedColumns(orders, json, mapColumns(orders, json, data), {}, data)]).toEqual([]);
  });
});

describe('runImport and importReport', () => {
  const mapping = mapColumns(users, file, data);
  const analysis = analyzeImport(users, file, mapping, { skipInvalid: true }, data);

  it('writes the valid rows and skips the rest', () => {
    const o = runImport(analysis, { skipInvalid: true });
    expect(o).toMatchObject({ processed: 1000, inserted: 985, updated: 0, skipped: 15, failed: 0, stopped: false, rolledBack: false });
    expect(o.insert).toHaveLength(985);
    expect(o.insert[0]).toEqual({ email: 'an.nguyen1@example.com', name: 'An Nguyen', created_at: '2024-01-01 00:00:00' });
  });

  it('upserts matching rows and can stop at a refused line in a transaction', () => {
    const upsert = analyzeImport(users, file, mapping, { mode: 'upsert' }, data);
    const ok = runImport(upsert, { mode: 'upsert', oneTx: true });
    expect(ok).toMatchObject({ inserted: 985, updated: 10 });
    expect(ok.update[0].match).toMatchObject({ email: 'member1@shop.example' });

    // Line 2 is the first data row: nothing was written yet, so a transaction has nothing to roll back.
    const fail = runImport(upsert, { mode: 'upsert', oneTx: true }, { line: 2, message: 'unique_violation' });
    expect(fail).toMatchObject({ inserted: 0, updated: 0, failed: 1, stopped: true, rolledBack: false, insert: [], update: [] });
    expect(fail.error).toEqual({ line: 2, message: 'unique_violation' });
    // A later refusal undoes the rows that had gone through.
    const mid = runImport(upsert, { mode: 'upsert', oneTx: true }, { line: upsert.rows.find((r) => r.kind === 'update')!.line, message: 'unique_violation' });
    expect(mid).toMatchObject({ inserted: 0, updated: 0, failed: 1, stopped: true, rolledBack: true });
  });

  it('cancels a transaction with nothing written, and without one keeps what went through', () => {
    const o = runImport(analysis, { oneTx: true }, null, 50, true);
    expect(o).toMatchObject({ processed: 50, inserted: 0, updated: 0, rolledBack: true, insert: [] });
    const part = runImport(analysis, { oneTx: false }, null, 50, true);
    expect(part.inserted).toBeGreaterThan(0);
    expect(part.insert).toHaveLength(part.inserted);
  });

  it('writes an English CSV of every left-out row for the error report', () => {
    const csv = importReport(analysis, null);
    expect(csv.split('\n')[0]).toBe('line,column,value,reason');
    expect(csv).toContain('5,email,,"Column ""email"" cannot be NULL."');
    expect(csv).toContain('member1@shop.example');
    const withFail = importReport(analysis, runImport(analysis, { oneTx: true }, { line: 2, message: 'refused' }));
    expect(withFail).toContain('2,,,refused');
  });

  it('summarises the counts the Settings step shows', () => {
    expect(importSummary(analysis.counts)).toBe('1,000 rows · 985 valid · 10 warnings · 5 errors');
  });
});
