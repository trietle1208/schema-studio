import { describe, expect, it } from 'vitest';
import { SAMPLE_NOW, sampleChanges } from '../fixtures/changes';
import { setLocale } from '../i18n';
import { analyzeSql, warningText } from './analyzeSql';
import {
  backupBefore,
  defaultSelection,
  deployFileName,
  deployRows,
  deployScript,
  markRuns,
  scriptLines,
} from './deploy';
import {
  changeGroup,
  deployServer,
  failedOn,
  filterChanges,
  groupChanges,
  nextServer,
  outstandingOn,
  pendingChanges,
  pendingOn,
  runCounts,
} from './group';
import { pendingRuns, seqLabel, setRun, undoRun, type Change, type ServerId } from './model';
import { flagText, flagTone, groupName, runDay, serverName, statusName } from './text';

const sample = sampleChanges();
const bySeq = (seq: number): Change => sample.find((c) => c.seq === seq)!;
const seqs = (changes: readonly Change[]) => changes.map((c) => c.seq);

/** A moment in local time, as the calendar of the person reading the log has it. */
const local = (month: number, day: number, hour = 12, minute = 0) => new Date(2026, month - 1, day, hour, minute).getTime();

describe('the sample', () => {
  it('is the nine changes of the mock, newest first, each with its own numbers', () => {
    expect(seqs(sample)).toEqual([47, 46, 45, 44, 43, 42, 41, 40, 39]);
    expect(new Set(seqs(sample)).size).toBe(9);
    expect(sampleChanges()).toEqual(sample);
    expect(sampleChanges()[0]).not.toBe(sample[0]);
  });

  it('writes the number as the list does', () => {
    expect(seqLabel(46)).toBe('#0046');
    expect(seqLabel(12345)).toBe('#12345');
  });
});

describe('changeGroup', () => {
  it('sorts the sample into the groups of the mock', () => {
    const groups = groupChanges(sample, SAMPLE_NOW);
    expect(groups.map((g) => [g.group, seqs(g.changes)])).toEqual([
      ['today', [47]],
      ['thisWeek', [46, 45, 44, 43]],
      ['lastWeek', [42, 41, 40, 39]],
    ]);
  });

  it('runs weeks from Monday to Sunday, not 7 days back', () => {
    // Saturday 24 October 2026.
    expect(changeGroup(local(10, 24, 0, 0), SAMPLE_NOW)).toBe('today');
    expect(changeGroup(local(10, 23, 23, 59), SAMPLE_NOW)).toBe('thisWeek');
    expect(changeGroup(local(10, 19, 0, 0), SAMPLE_NOW)).toBe('thisWeek');
    expect(changeGroup(local(10, 18, 23, 59), SAMPLE_NOW)).toBe('lastWeek');
    expect(changeGroup(local(10, 12, 0, 0), SAMPLE_NOW)).toBe('lastWeek');
    expect(changeGroup(local(10, 11, 23, 59), SAMPLE_NOW)).toBe('older');
  });

  it('puts a change of the day before into last week on a Monday', () => {
    const monday = local(10, 26, 10, 0);
    expect(changeGroup(local(10, 26, 8, 0), monday)).toBe('today');
    expect(changeGroup(local(10, 25, 23, 0), monday)).toBe('lastWeek');
    expect(changeGroup(local(10, 21, 16, 20), monday)).toBe('lastWeek');
    expect(changeGroup(local(10, 18, 23, 0), monday)).toBe('older');
  });

  it('puts a change from the future in today', () => {
    expect(changeGroup(local(10, 30, 9, 0), SAMPLE_NOW)).toBe('today');
  });

  it('leaves out a group with no change in it', () => {
    expect(groupChanges([], SAMPLE_NOW)).toEqual([]);
    expect(groupChanges([bySeq(39)], SAMPLE_NOW).map((g) => g.group)).toEqual(['lastWeek']);
  });
});

describe('what a server still needs', () => {
  it('counts the changes that wait or failed, as the strip of the mock does', () => {
    const counts = (id: ServerId) => [pendingOn(sample, id), failedOn(sample, id), outstandingOn(sample, id)];
    expect(counts('local')).toEqual([0, 0, 0]);
    expect(counts('demo')).toEqual([1, 0, 1]);
    // Two wait, and #0042 failed: three still to run.
    expect(counts('staging')).toEqual([2, 1, 3]);
    expect(counts('production')).toEqual([5, 0, 5]);
  });

  it('counts the changes that wait somewhere, for the sidebar', () => {
    expect(pendingChanges(sample)).toBe(5);
    expect(pendingChanges([bySeq(41), bySeq(43)])).toBe(0);
  });

  it('goes to the first server where a change waits', () => {
    expect(nextServer(bySeq(47))).toBe('demo');
    expect(nextServer(bySeq(46))).toBe('staging');
    expect(nextServer(bySeq(45))).toBe('production');
    expect(nextServer(bySeq(41))).toBeNull();
  });

  it('passes by a server where a change failed or does not apply', () => {
    // #0042 failed on Staging, so Production is next; #0043 does not apply on Staging and is done everywhere else.
    expect(nextServer(bySeq(42))).toBe('production');
    expect(bySeq(43).runs.staging.status).toBe('na');
    expect(nextServer(bySeq(43))).toBeNull();
  });
});

describe('filterChanges', () => {
  it('keeps every change when no server is picked, and counts the three segments', () => {
    expect(seqs(filterChanges(sample, null, 'all'))).toEqual(seqs(sample));
    expect(seqs(filterChanges(sample, null, 'pending'))).toEqual([47, 46, 45, 44, 42]);
    expect(seqs(filterChanges(sample, null, 'failed'))).toEqual([42]);
    expect(runCounts(sample, null)).toEqual({ all: 9, pending: 5, failed: 1 });
  });

  it('lists a change that waits on one server and failed on another under both Pending and Failed', () => {
    expect(seqs(filterChanges(sample, null, 'pending'))).toContain(42);
    expect(seqs(filterChanges(sample, null, 'failed'))).toContain(42);
  });

  it('keeps what waits or failed on the server that is picked, and the segments go on from there', () => {
    expect(seqs(filterChanges(sample, 'staging', 'all'))).toEqual([47, 46, 42]);
    expect(seqs(filterChanges(sample, 'staging', 'pending'))).toEqual([47, 46]);
    expect(seqs(filterChanges(sample, 'staging', 'failed'))).toEqual([42]);
    expect(runCounts(sample, 'staging')).toEqual({ all: 3, pending: 2, failed: 1 });
    expect(runCounts(sample, 'local')).toEqual({ all: 0, pending: 0, failed: 0 });
    expect(runCounts(sample, 'production')).toEqual({ all: 5, pending: 5, failed: 0 });
  });

  it('does not change the list it was given', () => {
    const before = seqs(sample);
    filterChanges(sample, 'production', 'pending');
    expect(seqs(sample)).toEqual(before);
  });
});

describe('deployServer', () => {
  it('is the server that is picked', () => {
    expect(deployServer(sample, 'atad5s', 'staging')).toBe('staging');
  });

  it('is the last server of the pipeline where the database has a change waiting', () => {
    expect(deployServer(sample, 'atad5s', null)).toBe('production');
    expect(deployServer(sample.filter((c) => c.seq !== 47 && c.seq !== 46 && c.seq !== 45 && c.seq !== 44 && c.seq !== 42), 'atad5s', null)).toBeNull();
    // acm waits nowhere.
    expect(deployServer(sample, 'acm', null)).toBeNull();
  });
});

describe('analyzeSql', () => {
  it('says a column that is changed to another type rewrites the table, and loses nothing', () => {
    expect(analyzeSql(bySeq(46).sql, 'MySQL')).toEqual({ kind: 'rewrite', name: 'da_thanh_toan', destructive: false });
  });

  it('says DROP TABLE is destructive', () => {
    expect(analyzeSql('DROP TABLE legacy_cham_cong_tmp;')).toEqual({ kind: 'drop-table', name: 'legacy_cham_cong_tmp', destructive: true });
    expect(analyzeSql(bySeq(44).sql, 'MySQL')).toEqual({ kind: 'drop-table', name: 'legacy_cham_cong_tmp', destructive: true });
    expect(analyzeSql('drop table if exists `a b`.`c`;')).toEqual({ kind: 'drop-table', name: 'a b.c', destructive: true });
    expect(analyzeSql('DROP TABLE IF EXISTS public."Orders" CASCADE;', 'PostgreSQL')).toMatchObject({ kind: 'drop-table', name: 'public.Orders' });
  });

  it('says a dropped column is destructive, and is no rewrite', () => {
    expect(analyzeSql(bySeq(39).sql)).toEqual({ kind: 'drop-column', name: 'da_van_ban.ghi_chu_cu', destructive: true });
    expect(analyzeSql('ALTER TABLE users DROP email;')).toMatchObject({ kind: 'drop-column', name: 'users.email' });
    expect(analyzeSql('ALTER TABLE IF EXISTS ONLY users DROP COLUMN IF EXISTS "email";', 'PostgreSQL')).toMatchObject({ name: 'users.email' });
  });

  it('puts a drop before a rewrite, whichever comes first', () => {
    const sql = 'ALTER TABLE a MODIFY x INT;\nALTER TABLE b DROP COLUMN y;';
    expect(analyzeSql(sql)).toMatchObject({ kind: 'drop-column', name: 'b.y' });
    expect(analyzeSql('ALTER TABLE a MODIFY x INT, DROP COLUMN y;')).toMatchObject({ kind: 'drop-column', name: 'a.y' });
    expect(analyzeSql('ALTER TABLE a MODIFY x INT;\nALTER TABLE b CHANGE y z INT;')).toMatchObject({ kind: 'rewrite', name: 'a' });
  });

  it('reads the ways of changing a type', () => {
    expect(analyzeSql('ALTER TABLE a CHANGE COLUMN old new BIGINT;')).toMatchObject({ kind: 'rewrite', name: 'a' });
    expect(analyzeSql('ALTER TABLE a ALTER COLUMN price TYPE numeric(12,2);', 'PostgreSQL')).toMatchObject({ kind: 'rewrite', name: 'a' });
    expect(analyzeSql('ALTER TABLE a ALTER price SET DATA TYPE numeric(12,2);', 'PostgreSQL')).toMatchObject({ kind: 'rewrite', name: 'a' });
  });

  it('finds nothing to warn about in a script that adds things or only touches defaults and constraints', () => {
    expect(analyzeSql('')).toBeNull();
    expect(analyzeSql(bySeq(45).sql)).toBeNull();
    expect(analyzeSql(bySeq(42).sql)).toBeNull();
    expect(analyzeSql(bySeq(41).sql)).toBeNull();
    expect(analyzeSql(bySeq(43).sql)).toBeNull();
    expect(analyzeSql('ALTER TABLE a ADD COLUMN x INT, ALTER COLUMN y SET DEFAULT 0, ALTER COLUMN z DROP NOT NULL;', 'PostgreSQL')).toBeNull();
    expect(analyzeSql('ALTER TABLE a DROP CONSTRAINT a_pkey;')).toBeNull();
    expect(analyzeSql('ALTER TABLE a DROP FOREIGN KEY fk_a_b, DROP INDEX idx_a;')).toBeNull();
    expect(analyzeSql('DROP INDEX idx_a ON a;')).toBeNull();
    expect(analyzeSql('ALTER TABLE a ALTER COLUMN type SET DEFAULT 1;')).toBeNull();
  });

  it('does not count a comment', () => {
    expect(analyzeSql('-- DROP TABLE users;\nSELECT 1;')).toBeNull();
    expect(analyzeSql('/* DROP TABLE users;\nALTER TABLE a MODIFY x INT; */ SELECT 1;')).toBeNull();
    expect(analyzeSql('SELECT 1; -- ALTER TABLE a DROP COLUMN b;')).toBeNull();
    expect(analyzeSql('/* never closed DROP TABLE users;')).toBeNull();
  });

  it('does not count a string literal', () => {
    expect(analyzeSql("INSERT INTO notes (body) VALUES ('DROP TABLE users;');")).toBeNull();
    expect(analyzeSql("INSERT INTO notes (body) VALUES ('it''s a DROP TABLE users; note');")).toBeNull();
    expect(analyzeSql("INSERT INTO notes (body) VALUES ('it\\'s a DROP TABLE users; note');", 'MySQL')).toBeNull();
    expect(analyzeSql("INSERT INTO notes (body) VALUES ('never closed; DROP TABLE users;")).toBeNull();
    expect(analyzeSql("CREATE FUNCTION f() RETURNS void AS $body$ BEGIN DROP TABLE users; END $body$ LANGUAGE plpgsql;", 'PostgreSQL')).toBeNull();
  });

  it('counts a statement that follows a string or a comment', () => {
    expect(analyzeSql("INSERT INTO a VALUES ('x;'); -- done\nDROP TABLE a;")).toMatchObject({ kind: 'drop-table', name: 'a' });
    // In PostgreSQL a backslash is only a character, so the string ends before the DROP.
    expect(analyzeSql("SELECT 'C:\\'; DROP TABLE a;", 'PostgreSQL')).toMatchObject({ kind: 'drop-table', name: 'a' });
  });

  it('is not fooled by a name that holds a keyword', () => {
    expect(analyzeSql('ALTER TABLE "drop" ADD COLUMN "drop table" INT;')).toBeNull();
    expect(analyzeSql('CREATE TABLE `drop table x` (id INT);')).toBeNull();
  });

  it('puts the warning into words, in the language of the app', () => {
    expect(warningText({ kind: 'rewrite', name: 'da_thanh_toan', destructive: false })).toBe('Rewrites da_thanh_toan.');
    expect(warningText({ kind: 'drop-table', name: 'legacy_cham_cong_tmp', destructive: true })).toBe('Drops legacy_cham_cong_tmp.');
    expect(warningText({ kind: 'drop-column', name: 'da_van_ban.ghi_chu_cu', destructive: true })).toBe('Drops da_van_ban.ghi_chu_cu.');
    setLocale('vi');
    try {
      expect(warningText({ kind: 'rewrite', name: 'da_thanh_toan', destructive: false })).toBe('Viết lại toàn bộ da_thanh_toan.');
    } finally {
      setLocale('en');
    }
  });
});

describe('a deploy to Production', () => {
  const rows = deployRows(sample, 'atad5s', 'production');

  it('lists the changes of the database that wait there, in the order they were written', () => {
    expect(seqs(rows.map((r) => r.change))).toEqual([42, 44, 45, 46, 47]);
    // #0043 belongs to acm, and #0039 to #0041 ran.
    expect(deployRows(sample, 'acm', 'production')).toEqual([]);
  });

  it('starts with every change checked but one whose pull request is open', () => {
    expect(rows.map((r) => [r.change.seq, r.checked])).toEqual([
      [42, true],
      [44, true],
      [45, true],
      [46, true],
      [47, false],
    ]);
    expect([...defaultSelection(rows)]).toEqual([42, 44, 45, 46]);
  });

  it('says one thing about each change: a drop, a rewrite, a failure before, an open pull request', () => {
    expect(rows.map((r) => r.flag)).toEqual([
      { kind: 'failed', server: 'staging' },
      { kind: 'drop-table' },
      null,
      { kind: 'rewrite' },
      { kind: 'pr-open' },
    ]);
  });

  it('says a drop before a failure, and a failure only of an earlier server', () => {
    const risky: Change = { ...bySeq(44), seq: 50, runs: { ...bySeq(44).runs, staging: { status: 'failed' } } };
    expect(deployRows([risky], 'atad5s', 'production')[0].flag).toEqual({ kind: 'drop-table' });
    // #0042 failed on Staging, which comes before Production and not before Demo.
    expect(deployRows(sample, 'atad5s', 'staging').map((r) => r.change.seq)).toEqual([46, 47]);
    expect(deployRows([bySeq(42)], 'atad5s', 'staging')).toEqual([]);
    const open: Change = { ...bySeq(47), runs: { ...bySeq(47).runs, local: { status: 'failed' } } };
    expect(deployRows([open], 'atad5s', 'demo')[0].flag).toEqual({ kind: 'failed', server: 'local' });
  });

  it('writes the script of the checked changes, a blank line between, and counts its lines', () => {
    const script = deployScript(rows, defaultSelection(rows));
    expect(script).toBe([42, 44, 45, 46].map((seq) => bySeq(seq).sql.trim()).join('\n\n'));
    expect(script).not.toContain('ma_so_thue');
    expect(scriptLines(script)).toBe(script.split('\n').length);
    expect(scriptLines('')).toBe(0);
    expect(scriptLines('SELECT 1;')).toBe(1);
    // Checking #0047 puts it last; unchecking #0042 takes it out.
    expect(deployScript(rows, new Set([47, 44]))).toBe(`${bySeq(44).sql.trim()}\n\n${bySeq(47).sql.trim()}`);
    expect(deployScript(rows, new Set())).toBe('');
  });

  it('leaves out a change that has no SQL, and does not double the blank line', () => {
    const empty: Change = { ...bySeq(45), seq: 48, sql: '  \n' };
    const both = deployRows([bySeq(44), empty, bySeq(46)], 'atad5s', 'production');
    expect(deployScript(both, new Set([44, 48, 46]))).toBe(`${bySeq(44).sql.trim()}\n\n${bySeq(46).sql.trim()}`);
  });

  it('names the file after the database, the server and the day, in local time', () => {
    expect(deployFileName('atad5s', 'production', SAMPLE_NOW)).toBe('atad5s_production_2026-10-24.sql');
    expect(deployFileName('atad5s', 'demo', local(1, 5, 0, 5))).toBe('atad5s_demo_2026-01-05.sql');
    expect(deployFileName('my db/prod', 'staging', local(12, 31, 23, 59))).toBe('my_db_prod_staging_2026-12-31.sql');
  });

  it('names the first table that is dropped, once it is checked', () => {
    expect(backupBefore(rows, defaultSelection(rows))).toEqual({ table: 'legacy_cham_cong_tmp', seq: 44 });
    expect(backupBefore(rows, new Set([42, 45, 46]))).toBeNull();
  });

  it('asks for no backup before a column is dropped', () => {
    const column = deployRows([{ ...bySeq(39), runs: pendingRuns() }], 'atad5s', 'production');
    expect(column[0].flag).toEqual({ kind: 'drop-column' });
    expect(backupBefore(column, defaultSelection(column))).toBeNull();
  });
});

describe('setRun and undoRun', () => {
  it('sets a run and keeps what it was for one step back', () => {
    const change = bySeq(46);
    const next = setRun(change, 'staging', 'ran', local(10, 24, 12, 30));
    expect(next.runs.staging).toEqual({ status: 'ran', at: local(10, 24, 12, 30), undo: { status: 'pending' } });
    expect(next.runs.local).toBe(change.runs.local);
    expect(change.runs.staging).toEqual({ status: 'pending' });
  });

  it('only keeps the time of a run that happened', () => {
    expect(setRun(bySeq(46), 'staging', 'failed', 123).runs.staging).toEqual({ status: 'failed', undo: { status: 'pending' } });
    expect(setRun(bySeq(46), 'staging', 'na').runs.staging).toEqual({ status: 'na', undo: { status: 'pending' } });
  });

  it('takes the last setting back, with its time, and has nothing to take back after that', () => {
    const marked = setRun(bySeq(46), 'demo', 'failed');
    expect(marked.runs.demo.undo).toEqual({ status: 'ran', at: bySeq(46).runs.demo.at });
    const back = undoRun(marked, 'demo');
    expect(back.runs.demo).toEqual(bySeq(46).runs.demo);
    expect(back.runs.demo.undo).toBeUndefined();
    expect(undoRun(back, 'demo')).toBe(back);
  });

  it('leaves a run alone that is set to what it is', () => {
    const change = bySeq(46);
    expect(setRun(change, 'demo', 'ran', 1)).toBe(change);
  });
});

describe('markRuns', () => {
  const rows = deployRows(sample, 'atad5s', 'production');
  const at = local(10, 24, 13, 0);

  it('sets the runs to run at the time given, and keeps the status they had for one undo', () => {
    const marked = markRuns(sample, defaultSelection(rows), 'production', at);
    expect(seqs(marked)).toEqual([46, 45, 44, 42]);
    for (const change of marked) expect(change.runs.production).toEqual({ status: 'ran', at, undo: { status: 'pending' } });
    expect(marked.find((c) => c.seq === 42)!.runs.staging.status).toBe('failed');
  });

  it('does not touch the list it was given', () => {
    markRuns(sample, [46], 'production', at);
    expect(bySeq(46).runs.production).toEqual({ status: 'pending' });
  });

  it('leaves out a change that is not in the log and one that was run there already', () => {
    expect(markRuns(sample, [41, 9999], 'production', at)).toEqual([]);
    expect(seqs(markRuns(sample, [41, 46], 'production', at))).toEqual([46]);
  });

  it('undoes what it did', () => {
    const [marked] = markRuns(sample, [46], 'production', at);
    expect(undoRun(marked, 'production').runs.production).toEqual({ status: 'pending' });
  });
});

describe('the words of the change log', () => {
  it('names the servers, the statuses and the groups', () => {
    expect(['local', 'demo', 'staging', 'production'].map((id) => serverName(id as ServerId))).toEqual(['Local', 'Demo', 'Staging', 'Production']);
    expect((['ran', 'pending', 'failed', 'na'] as const).map(statusName)).toEqual(['Run', 'Pending', 'Failed', 'Skipped']);
    expect((['today', 'thisWeek', 'lastWeek', 'older'] as const).map(groupName)).toEqual(['Today', 'This week', 'Last week', 'Older']);
  });

  it('words the flags of a deploy, and says how loud each is', () => {
    const flags = [
      { kind: 'drop-table' },
      { kind: 'drop-column' },
      { kind: 'rewrite' },
      { kind: 'failed', server: 'staging' },
      { kind: 'pr-open' },
    ] as const;
    expect(flags.map(flagText)).toEqual(['drops a table', 'drops a column', 'rewrites table', 'failed on Staging', 'PR not merged']);
    expect(flags.map(flagTone)).toEqual(['danger', 'danger', 'warning', 'warning', 'muted']);
  });

  it('says them in Vietnamese too', () => {
    setLocale('vi');
    try {
      expect(flagText({ kind: 'failed', server: 'staging' })).toBe('lỗi trên Staging');
      expect(groupName('thisWeek')).toBe('Tuần này');
      expect(statusName('na')).toBe('Bỏ qua');
    } finally {
      setLocale('en');
    }
  });

  it('writes the day a run happened, as the server cells show it', () => {
    expect(runDay(local(10, 21, 16, 20))).toBe('21/10');
    expect(runDay(local(1, 5))).toBe('05/01');
  });
});
