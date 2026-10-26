# GitNexus Engineering Plan

> Task: Slim change log at `#/changes` — list, 480px detail drawer, 620px deploy modal — matching the v2 mock, not the old changelog layout.
> Evidence verified at commit 20af4fd57e3a378b9f27cdde83903c85f800cce0; GitNexus index refreshed this session (`gitnexus` 1.6.12, schema 4, `--index-only --pdg`). Index commit matches HEAD. Limits: `design-system/components/bundle.js` was dropped after a parse timeout; process ranking omitted 889 entry points. A first analyze failed with EACCES on `~/.gitnexus/registry.json` inside the sandbox; the retry outside the sandbox succeeded.
> Evidence provenance schema 2; global dirty digest cb9cd6cb636fdeb18a7aab03598911454dabd6cd4fc6526d239592d8dd3bdabb; cited-path manifest 25 sorted entries; exact generated plan path excluded.

## 1. Objective

Add a change log the user can read in about two seconds: which server is still missing which changes. Three surfaces, each with one primary button.

- List at `#/changes`. Centered column, max 1040px. No filter sidebar.
- Detail drawer, 480px, on the right.
- Deploy modal, 620px.

Copy lives in `en.ts` and `vi.ts`. Colour, radius, and type use existing tokens (`var(--token)` and the `--group-*` tokens in `src/styles/index.css`). Check dark and light. Visual target is `docs/screens/changelog-v2-list.png`, `changelog-v2-detail.png`, `changelog-v2-deploy.png`, and `docs/screens/changelog-v2.html`. Older changelog screenshots are data reference only.

## 2. Current Behaviour

There is no change-log screen, store, or `analyzeSql`. [verified] Routes are hash paths under `/schemas` only (`src/core/routes.ts`). `parseRoute` returns null unless the first segment is `schemas` (line 59), and `startRouting` then opens the latest schema or the schema list (`src/screens/navigation.ts` lines 115–134).

`enter` loads a schema only when `routeSchema(route)` is non-null and that schema is not already open (line 50). `routeSchema` returns null solely for `schemas` (lines 84–86). Dexie is at version 8 (`src/db/db.ts` lines 181–184). Migrations between two stored versions go through `migratorFor` (`src/core/generate/index.ts` lines 31–33) and `listVersions` / `getVersion` (`src/db/schemas.ts`). SQL in the app is coloured by `highlightSql` (`src/core/highlight.ts`).

The v2 mock (`docs/screens/changelog-v2.html`) is a static 1440×900 page. It draws every sample row regardless of the database dropdown. Production is the selected server in deploy mode. Only the "PR not merged" row starts unchecked.

## 3. Relevant Architecture

[graph] Clusters (resource `gitnexus://repo/schema-studio/clusters`, top of 27): Screens (367 symbols), Components, Generate, Db, Diff. The change sits in Screens + a new pure module under `src/core/changes/` + a Dexie repository. It does not go through the bridge, the diagram store, or zundo.

[verified] The shell is `AppShell` plus `Sidebar`. Sidebar nav ids `schemas | recent | favorites` filter the schema list (`src/core/sidebar.ts`); they are not app sections. `Modal` already takes `width`, `footer`, and `footerStart` (`src/components/Modal.tsx`). `SegmentedControl`, `ContextMenu`, `ConfirmDialog`, and `Button` variants `primary | secondary | ghost` are the controls to reuse. `exportFile`'s download helper in `src/screens/exportActions.ts` is private; the deploy download should be a small local copy of that blob pattern, not a change to export.

Group colours are app tokens, not design-system tokens: `--group-gray`, `--group-cyan`, `--group-violet`, `--group-orange` (`src/styles/index.css` lines 285–304). Semantic change colours stay `--added`, `--modified`, `--removed`.

## 4. GitNexus Findings

Primary symbols, source-verified after the graph lookup.

- `parseRoute` (`Function:src/core/routes.ts:parseRoute`, lines 55–77). [graph] `context` epistemic exact. Callers: `onAddressChange`, `startRouting`, `routes.test.ts`. Callees: `decoded`, `version`. No process membership.
- `routeSchema` (lines 84–86). [graph] `impact` upstream, `includeTests: true`, `maxDepth: 1`: risk CRITICAL because of process membership, `riskSharedAxes` LOW, epistemic exact, `impactedCount` 4. d=1: `routes.test.ts`, `Screens` (`src/App.tsx`), `dropsChanges`, `enter`. Do not change the null-vs-name rule for existing screens.
- `enter` (`src/screens/navigation.ts` lines 46–73). [graph] `context` callers: `go`, both `onDiscard` closures, `onAddressChange`, `startRouting`. It calls `routeSchema`, `openSchemaNamed`, `routePath`.
- `routePath` (lines 41–49). Must grow a `/changes` arm or the address bar cannot round-trip.
- `migratorFor` is the existing way to turn two snapshots into SQL. Do not add a second migrator.

[graph] `impact` on `parseRoute` upstream, depth 1, tests included: direct callers are only `routes.test.ts`, `onAddressChange`, `startRouting` (confidence 0.85, risk LOW, epistemic exact). `query` for hash routing also located `hashAddress` and `navigation.test.ts`.

Index caveat [graph]: process traces are truncated (889 entry points never ranked; `bundle.js` not parsed). Absence of a flow is not proof it does not exist. Routing claims above were checked in source.

## 5. Statement-Level PDG Findings

`pdg_query mode:controls` on `parseRoute` (27 edges, anchor lines 55–77) and `enter` (15 edges, anchor lines 46–73). Both ran against the `--pdg` index.

`parseRoute`. The guard at line 59, `segments[0] !== 'schemas'`, returns null on the true arm. Every later screen (`workspace`, `history`, `query`, `data`, `diff`) is on the false arm and still requires a schema segment. `#/changes` must be accepted before that return. A path that still falls through to `return null` (line 76) is rewritten by `startRouting` to the latest schema, so a missed branch looks like "the screen never opens".

`enter`. The predicate at line 50, `name !== null && !isOpen(name)`, gates `openSchemaNamed`. The false arm (line 70) only calls `setRoute` and `address.write`, then returns true. A change-log route whose `routeSchema` is null takes that arm and must not replace the open schema or raise "schema not found". The true arm's `!stored` path (line 64) toasts and returns false; `startRouting` would then leave the change log and open the latest schema. So `routeSchema({ screen: 'changes' })` must be null.

Ordering: `parseRoute` before `enter`. A route object that still has `schema` makes `routeSchema` type-check as a name and re-enters the load branch.

No PDG for `analyzeSql`, the list, or the drawer: those symbols do not exist yet.

## 6. Proposed Changes

### Route

- File `src/core/routes.ts`, symbols `Route`, `routePath`, `parseRoute`, `routeSchema`.
- Add `{ screen: 'changes' }` with no schema.
- `routePath` returns `/changes`.
- `parseRoute` accepts `#/changes` and `/changes/` before the `schemas` guard.
- `routeSchema` returns null for `schemas` and `changes`.
- `routeMode` stays null (it already returns null for non-workspace screens).
- Constraint: existing paths in `src/core/routes.test.ts` stay byte-identical. `dropsChanges` stays false when `routeSchema` is null, so opening the change log does not ask to discard a dirty diagram. [verified] `dropsChanges` is `name !== null && !isOpen(name) && selectDirty(...)`.

### App shell

- File `src/App.tsx`, symbols `routeTitle` and `Screens`.
- Title is the change-log message plus the app name. Do not read `route.schema` on this screen (the fallback on line 43 assumes a schema).
- Render the new screen. Keep `AppShell` and the existing sidebar. Do not add the mock's second 48px rail or the "Schema Studio / Change log" top bar; that chrome duplicates the shell. The comparison target is the 1040px column, the drawer, and the modal.
- File `src/components/Sidebar.tsx`. Add a control that is not a `SidebarNav` value (those three ids only filter schemas). Label from i18n, icon `list` (new; the mock's list glyph). Badge is the number of changes that have any server `pending`. Active while the route is `changes`. Calls `go({ screen: 'changes' })`.

### Core (pure, tested)

New directory `src/core/changes/`. No React.

- `model.ts`. Servers, fixed, in pipeline order: Local `L` `--group-gray`, Demo `D` `--group-cyan`, Staging `S` `--group-violet`, Production `P` `--group-orange`. Only Production has `protected: true`. Run status `ran | pending | failed | na`. A change has `seq`, `key`, `title`, `database`, `engine`, `branch`, optional PR (`repo`, `number`, `open | merged`, optional `url`), `createdAt`, `sql`, `rollback`, `notes`, and one run per server (`status`, `at?`, one-level `undo?`).
- `group.ts`. `changeGroup(createdAt, now)` → `today | thisWeek | lastWeek | older` by local calendar date and ISO week (Monday 00:00). `pendingOn`, `failedOn`, server counts, "next" server = first `pending` in pipeline order. Filter: server chip keeps changes that are `pending` or `failed` on that server; All / Pending / Failed apply after that. A change can appear in both Pending and Failed (`#0042`).
- `analyzeSql.ts`. One warning at most, from the SQL text, comments and string literals ignored. `DROP TABLE` → drop (destructive). `ALTER` that `DROP`s a column → destructive, no rewrite flag. `MODIFY` / `CHANGE` / `ALTER COLUMN ... TYPE` → rewrite, not the red list icon. The list's red icon is destructive only. The detail line and the deploy flag use the same result. Do not invent row counts or "run off-hours"; the comp sentence for `#0046` is not derivable. [assumed] i18n is `Rewrites {table}.` / `Drops {table}.`
- `deploy.ts`. Rows: selected database, target server status `pending`, `seq` ascending. Checkbox starts off only when `pr` is `open`. Warning text, one per row, priority drop, then rewrite, then failed on an earlier server, then PR not merged. Script is the checked SQL blocks joined by a blank line. File name `{database}_{serverId}_{yyyy-mm-dd}.sql` in the local date of `now`. Backup sentence names the first selected drop. `markRuns` sets those runs to `ran` with the provided timestamp and stores the previous status in `undo`.
- `sample.ts`. The nine rows in `changelog-v2.html` (seq 47 down to 39), titles left as in the mock (they are data). Dates chosen so groups match the comp when `now` is `2026-10-24T12:00:00+07:00`. `#0046` SQL is the mock's `ALTER` of `da_thanh_toan`. `#0044` drops `legacy_cham_cong_tmp`.

### Persistence

- File `src/db/db.ts`. Dexie version 9 adds `changes: '++id, &seq, database, createdAt'`. Do not clear older stores.
- File `src/db/changes.ts`. `listChanges`, `putChange`, `markRuns`. First read of an empty table writes the sample once. Writes are immediate (`Date.now()` at the call), not deferred to a save button.
- The tools-row text `Saved to db/changes/` is a label (git icon), not a directory write. The browser cannot write the repo. [assumed] IndexedDB is the store, matching every other record in this app.

### UI

Styles in `src/styles/index.css`, class prefix `ss-cl-`, tokens only. No hard-coded `#b98cff` or server hex from the mock. PR open uses `--added`. PR merged uses `--group-violet`.

- `src/screens/ChangeLog.tsx`. Header: "Change log", database `Select` in mono, Prepare deploy (`secondary`), New change (`primary`) with `ContextMenu`: Blank, From schema diff. Server strip is one bordered group; click toggles that server. Segmented All / Pending / Failed with live counts (not the comp's 47 / 6 / 1). Right side: saved-to label. Rows 48px, columns `# | change | database | PR | L D S P`. Groups Today / This week / Last week / Older. Hover `--bg-3`, selected `--accent-subtle` plus `--accent-line`. Status dots: ran = filled `--added` with check; pending = dashed `--modified`; failed = filled `--removed` with x; na = a dash in `--line-3`. Column letters centered on the dots.
- `src/screens/ChangeDetail.tsx`. Drawer 480px. `#seq · key`, title 17px / 600. Definition list: Date, Database, Branch (copy), Pull request (link when `url` is set, plus status). Four server cells. Click a `pending` cell to mark ran; Production confirms with `ConfirmDialog` first. The next pending cell has a solid `--accent` ring. Cell `⋯` menu: Mark failed, Skip (`na`), Undo (restores `undo`). Tabs SQL / Rollback / Notes. SQL via `highlightSql`. One `analyzeSql` line when present. Footer: Copy SQL (`secondary`) and, when some server is pending, `Mark as run on {server}` (`primary`) for the first pending server. Omit the header `⋯`; the mock draws it but names no actions.
- `src/screens/DeployDialog.tsx`. `Modal` `width={620}`. Title `Deploy to {server}`. Subtitle `{db} · {n} of {m} pending changes, in this order`. Checkboxes. Script row: file name, line count, Copy, Download (ghost). Backup line when a selected change drops a table. Footer hint, Cancel, `Mark {n} as run` (primary, `n` follows the checks). Mark persists immediately and closes.
- Database dropdown does not filter the table and does not change strip counts. It is the database for New change and for deploy. Prepare deploy uses the selected server chip; with none selected, the last server in pipeline order that still has a pending change for that database.
- Blank: next `seq`, header database, empty SQL, every server `pending`, drawer opens. From schema diff: `openSchemaNamed(database)`, `listVersions`, the two newest, `migratorFor(engine).migrate(older, newer)`. Toast when the schema is missing or has fewer than two versions. SQL and destructive result come from that migration; do not navigate to `SchemaDiff`.
- Icons to add in `src/components/icons.ts`: `list`, `rocket`, `git`, copying the paths already in `changelog-v2.html`. `warning`, `copy`, `download`, `check`, `more`, `x` already exist.

### i18n

Keys under `changes.*` in `src/core/i18n/en.ts` and `vi.ts`. Plurals for pending counts and "Mark {count} as run". No user-facing string in a component. Sample titles and SQL stay as stored, including Vietnamese titles. Exported SQL stays English.

## 7. Implementation Sequence

1. Add `src/core/changes/` (`model`, `group`, `analyzeSql`, `deploy`, `sample`) and `src/core/changes/changes.test.ts`. App behaviour unchanged.
2. Dexie version 9 and `src/db/changes.ts` plus `src/db/changes.test.ts`. Empty table seeds the sample once. Mark writes `ran` and `at` in one `put`.
3. Extend `Route`, `routePath`, `parseRoute`, `routeSchema`. Update `src/core/routes.test.ts` and add one case in `src/screens/navigation.test.ts`: `go({ screen: 'changes' })` shows that route and does not call through a missing schema name. `npm test` still green; the screen is not rendered yet.
4. Add `changes.*` messages in `en.ts` and `vi.ts`. The existing dictionary test in `src/core/i18n/index.test.ts` covers parity.
5. `ChangeLog.tsx`, styles, icons, `App.tsx` branch, sidebar entry. List, filters, groups, and the New change menu work. Drawer and deploy can be empty shells behind their buttons.
6. `ChangeDetail.tsx`: mark ran, protected confirm, failed / skip / undo, tabs, copy, footer primary.
7. `DeployDialog.tsx`: selection defaults, script copy/download, backup line, mark N as run.
8. `npm run build`, `npm test`, `npm run lint`. Then browser: dark and light, list → row → mark Staging → Production confirm → Prepare deploy → uncheck and mark. Compare the three v2 screenshots. Counts and the rewrite sentence will not match the comp's "47" or "~1.2M rows"; structure, spacing, and tokens should.

Stop after any step. Steps 1–4 leave the UI unopened. Do not regenerate screenshot goldens; there are none.

## 8. Test Strategy

New `src/core/changes/changes.test.ts`:

- Grouping at `now = 2026-10-24T05:00:00.000Z` (12:00 +07): `#0047` today, `#0046`–`#0043` this week, `#0042`–`#0039` last week.
- Server counts on the sample: Local 0, Demo 1, Staging 3 pending and the failed dot on `#0042`, Production 5. These are the comp's strip numbers for the nine visible rows, not All=47.
- Next server for `#0046` is Staging. `#0043` Staging is `na` and is not next.
- `analyzeSql` on the `#0046` statement → rewrite `da_thanh_toan`, not destructive. On `DROP TABLE legacy_cham_cong_tmp` → destructive drop. A comment that says DROP TABLE does not count. A string literal does not count.
- Deploy for atad5s / production: seq 42, 44, 45, 46, 47. `#0047` unchecked. `#0042` checked with "failed on Staging". File name `atad5s_production_2026-10-24.sql` at that `now`. Backup names `legacy_cham_cong_tmp` and `#0044`.
- `markRuns` sets `at` to the given timestamp and keeps the previous status for one undo.

Update `src/core/routes.test.ts`: `/changes` round-trips; `/changes/` parses; a schema named `changes` still opens `#/schemas/changes`.

Update `src/screens/navigation.test.ts`: going to `changes` does not toast schema-not-found and does not clear a dirty open schema.

New `src/db/changes.test.ts`: version 8 database opens as version 9; first list seeds nine rows; second list does not duplicate; mark is visible to the next list.

`src/core/i18n/index.test.ts` already requires `vi.ts` to match `en.ts`. No new assertion unless a plural key is easy to miss.

Commands that exist in `package.json`: `npm test`, `npm run build`, `npm run lint`.

Browser (executor, both themes): open `#/changes`, toggle Production, open `#0046`, mark Staging, cancel the Production confirm, open Prepare deploy, toggle `#0047`, Mark as run, confirm the strip count drops. Light theme: dashed pending ring and accent selection stay visible.

## 9. Risk and Impact Analysis

- High-risk symbol is `routeSchema`, not because the edit is wide, but because `enter` and `dropsChanges` trust it. The only safe edit is "null for `changes` too".
- d=1 of `parseRoute` (`onAddressChange`, `startRouting`, `routes.test.ts`) must keep treating unknown paths as "not a route". `#/changes` is a route; `#/changes/extra` is not.
- Dexie version 9 must not upgrade-clear `records` or `views`. Copy the version 5 pattern (add an index, leave rows).
- `enter`'s `turns` counter: `go({ screen: 'changes' })` must still ignore a stale schema read. The null `routeSchema` path never starts that read, so the race does not apply. Do not special-case `turns`.
- Performance: the sample is nine rows. No virtualisation.
- The change log is not part of schema undo. A mark must not set the diagram dirty.
- Process truncation means some `go()` callers may be missing from the graph. Source search of `route.screen` covered `App.tsx`, `navigation.ts`, and `routes.ts`. `SchemaCrumbs` and workspace shortcuts build schema routes only; they do not need a `changes` arm.

## 10. Files Expected to Change

| File | Symbols | Reason |
| ---- | ------- | ------ |
| `src/core/routes.ts` | `Route`, `routePath`, `parseRoute`, `routeSchema` | `#/changes` |
| `src/core/routes.test.ts` | route table | round-trip |
| `src/screens/navigation.test.ts` | `go` | null schema does not load |
| `src/App.tsx` | `routeTitle`, `Screens` | render the screen |
| `src/components/Sidebar.tsx` | sidebar control | entry, pending badge |
| `src/components/icons.ts` | `list`, `rocket`, `git` | mock glyphs |
| `src/core/i18n/en.ts`, `vi.ts` | `changes.*` | copy |
| `src/db/db.ts` | `db.version(9)` | `changes` table |
| `src/styles/index.css` | `ss-cl-*` | layout tokens |
| `src/core/changes/*` | new | rules and sample |
| `src/db/changes.ts` | new | persistence |
| `src/screens/ChangeLog.tsx`, `ChangeDetail.tsx`, `DeployDialog.tsx` | new | three surfaces |

`src/screens/navigation.ts` needs no edit if `routeSchema` is null for `changes`. [inferred] Confirm when implementing; do not add a branch "just in case".

## 11. Reusable Implementation Context

```yaml
implementation_context:
  task_summary: "Slim change log at #/changes (list, 480px drawer, 620px deploy) from the v2 mock, Dexie-backed, i18n en+vi, tokens only."
  acceptance_criteria:
    - "List column max 1040px, no filter sidebar, one primary (New change)."
    - "Server strip counts and filters; All/Pending/Failed counts are computed."
    - "Drawer marks the next pending server; Production confirms; cell menu can fail, skip, or undo."
    - "Deploy checks all pending except an open PR; Mark N as run writes the current time immediately."
    - "en.ts and vi.ts stay in parity; npm run build, npm test, and npm run lint pass; both themes checked in the browser."
  files_to_modify:
    - path: src/core/routes.ts
      reason: "Add changes route before the schemas guard"
    - path: src/App.tsx
      reason: "Title and screen branch"
    - path: src/components/Sidebar.tsx
      reason: "Entry that is not a schema filter"
    - path: src/db/db.ts
      reason: "Dexie version 9"
    - path: src/styles/index.css
      reason: "ss-cl layout using tokens"
    - path: src/core/i18n/en.ts
      reason: "changes.* copy"
    - path: src/core/i18n/vi.ts
      reason: "Vietnamese parity"
  tests:
    - file: src/core/changes/changes.test.ts
      scenarios:
        - "sample groups at 2026-10-24T05:00:00.000Z match Today / This week / Last week"
        - "analyzeSql distinguishes drop, rewrite, and comments"
        - "production deploy defaults and script name"
    - file: src/core/routes.test.ts
      scenarios:
        - "#/changes round-trips and does not swallow schema name changes"
    - file: src/screens/navigation.test.ts
      scenarios:
        - "go(changes) leaves a dirty schema open and shows the route"
    - file: src/db/changes.test.ts
      scenarios:
        - "empty table seeds once; markRuns persists at"
  verification_commands:
    - "npm test"
    - "npm run build"
    - "npm run lint"
  pdg_constraints:
    - "parseRoute line 59 true-arm returns null. Accept /changes before it or startRouting replaces the address."
    - "enter line 50 loads a schema only when routeSchema is non-null. changes must return null or a missing name toasts and startRouting leaves the screen."
  risks:
    - "routeSchema is in many navigation processes. Only add changes to the null branch."
    - "Dexie v9 must not clear existing tables."
  assumptions:
    - "Persistence is Dexie. The git path in the tools row is a label. Re-verify the user did not require files under db/changes/."
    - "Production is the only protected server. Re-verify before adding more."
    - "Empty changes table seeds the nine mock rows once."
    - "analyzeSql warnings do not include row counts."
  open_questions:
    - "PR url is optional. No host is specified."
    - "Header more-button on the drawer has no actions in the spec."
    - "Comp All=47 is not reproducible from the nine drawn rows."
  avoid:
    - "Do not rebuild the mock's top bar or 48px rail."
    - "Do not filter the list by the database dropdown."
    - "Do not hard-code the mock's #b98cff or server hex colours."
    - "Do not put change-log marks on the schema undo stack."
    - "Do not commit .gitnexus/ (created by this planning index; untracked; not in .gitignore)."
    - "Do not edit design-system/components/bundle.js (it was not fully parsed, and this feature is app code)."
```

`evidence_provenance` below is the schema-2 snapshot copied verbatim from `scripts/evidence-provenance.mjs`. Do not recompute it by hand.

```json
{
  "schema_version": 2,
  "head_commit": "20af4fd57e3a378b9f27cdde83903c85f800cce0",
  "generated_plan_path": "docs/plans/2026-10-26-gitnexus-plan-slim-changelog-v2.md",
  "global_dirty_digest": {
    "algorithm": "sha256",
    "canonicalization": "gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records",
    "value": "cb9cd6cb636fdeb18a7aab03598911454dabd6cd4fc6526d239592d8dd3bdabb"
  },
  "cited_path_manifest": [
    {
      "path": "docs/screens/changelog-v2.html",
      "object_kind": {
        "head": "absent",
        "index": "absent",
        "worktree": "absent",
        "untracked": "regular"
      },
      "state": "untracked",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "absent",
      "index_digest": "absent",
      "worktree_digest": "absent",
      "untracked_digest": "sha256:b3f293b54e078b2aa4f2ecf8b2ae62619e2b4b74db23e3e288ab26c941f62adc"
    },
    {
      "path": "package.json",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:34365a14f0145b4924ec3c288962f12009c45b84bb4beb83dacc015982beb6f5",
      "index_digest": "sha256:34365a14f0145b4924ec3c288962f12009c45b84bb4beb83dacc015982beb6f5",
      "worktree_digest": "sha256:34365a14f0145b4924ec3c288962f12009c45b84bb4beb83dacc015982beb6f5",
      "untracked_digest": "absent"
    },
    {
      "path": "src/App.tsx",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:08d8246444dfe818bfdd69b59d76667cb0ea381fece83d5a6dcf95bbaa564210",
      "index_digest": "sha256:08d8246444dfe818bfdd69b59d76667cb0ea381fece83d5a6dcf95bbaa564210",
      "worktree_digest": "sha256:08d8246444dfe818bfdd69b59d76667cb0ea381fece83d5a6dcf95bbaa564210",
      "untracked_digest": "absent"
    },
    {
      "path": "src/components/AppShell.tsx",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:7275f956d11aceb854d9d27357f0947b0cf79bc1be72166af745907bf48df19b",
      "index_digest": "sha256:7275f956d11aceb854d9d27357f0947b0cf79bc1be72166af745907bf48df19b",
      "worktree_digest": "sha256:7275f956d11aceb854d9d27357f0947b0cf79bc1be72166af745907bf48df19b",
      "untracked_digest": "absent"
    },
    {
      "path": "src/components/ContextMenu.tsx",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:9f42565d234fdd0c2f542c03cb098d57101e1360d3504a02f272fa8656afea88",
      "index_digest": "sha256:9f42565d234fdd0c2f542c03cb098d57101e1360d3504a02f272fa8656afea88",
      "worktree_digest": "sha256:9f42565d234fdd0c2f542c03cb098d57101e1360d3504a02f272fa8656afea88",
      "untracked_digest": "absent"
    },
    {
      "path": "src/components/Modal.tsx",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:4e2c7e84a59b5573d089418e7544ef2d2ab520326102372e2beea1c01d665f00",
      "index_digest": "sha256:4e2c7e84a59b5573d089418e7544ef2d2ab520326102372e2beea1c01d665f00",
      "worktree_digest": "sha256:4e2c7e84a59b5573d089418e7544ef2d2ab520326102372e2beea1c01d665f00",
      "untracked_digest": "absent"
    },
    {
      "path": "src/components/SegmentedControl.tsx",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:5a9f98aeac05b32a67ba4733789cedc853a500e7084bd090d5978c9f2b3cdaac",
      "index_digest": "sha256:5a9f98aeac05b32a67ba4733789cedc853a500e7084bd090d5978c9f2b3cdaac",
      "worktree_digest": "sha256:5a9f98aeac05b32a67ba4733789cedc853a500e7084bd090d5978c9f2b3cdaac",
      "untracked_digest": "absent"
    },
    {
      "path": "src/components/Sidebar.tsx",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:b39415dfaf7a755f87c7fe02b7475be9e62abcb6ef54f7b8155cfaf4a5e70863",
      "index_digest": "sha256:b39415dfaf7a755f87c7fe02b7475be9e62abcb6ef54f7b8155cfaf4a5e70863",
      "worktree_digest": "sha256:b39415dfaf7a755f87c7fe02b7475be9e62abcb6ef54f7b8155cfaf4a5e70863",
      "untracked_digest": "absent"
    },
    {
      "path": "src/components/icons.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:02c89aa627f1c8b7b72077495203a3e50583c66b947469641b4eb3d527fa9f4e",
      "index_digest": "sha256:02c89aa627f1c8b7b72077495203a3e50583c66b947469641b4eb3d527fa9f4e",
      "worktree_digest": "sha256:02c89aa627f1c8b7b72077495203a3e50583c66b947469641b4eb3d527fa9f4e",
      "untracked_digest": "absent"
    },
    {
      "path": "src/core/generate/index.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:1f02ddac20b06dd63f8625a00eaca07e4150156bb8e27fa778b1b840147e1530",
      "index_digest": "sha256:1f02ddac20b06dd63f8625a00eaca07e4150156bb8e27fa778b1b840147e1530",
      "worktree_digest": "sha256:1f02ddac20b06dd63f8625a00eaca07e4150156bb8e27fa778b1b840147e1530",
      "untracked_digest": "absent"
    },
    {
      "path": "src/core/generate/options.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:5dc7ac6ff27880cf5cd804f380271bd526d7a9eeaf93c9831482edd6e945b651",
      "index_digest": "sha256:5dc7ac6ff27880cf5cd804f380271bd526d7a9eeaf93c9831482edd6e945b651",
      "worktree_digest": "sha256:5dc7ac6ff27880cf5cd804f380271bd526d7a9eeaf93c9831482edd6e945b651",
      "untracked_digest": "absent"
    },
    {
      "path": "src/core/groups.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:4a1b3fab543d834522f4ee26ff1f6a2bdfbd00012c3883aaa97cf54a7dd3ddb5",
      "index_digest": "sha256:4a1b3fab543d834522f4ee26ff1f6a2bdfbd00012c3883aaa97cf54a7dd3ddb5",
      "worktree_digest": "sha256:4a1b3fab543d834522f4ee26ff1f6a2bdfbd00012c3883aaa97cf54a7dd3ddb5",
      "untracked_digest": "absent"
    },
    {
      "path": "src/core/highlight.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:1ac7d36023647cb190294953654f3d08b3ddda3a7e9d4d56b32c75fb71877115",
      "index_digest": "sha256:1ac7d36023647cb190294953654f3d08b3ddda3a7e9d4d56b32c75fb71877115",
      "worktree_digest": "sha256:1ac7d36023647cb190294953654f3d08b3ddda3a7e9d4d56b32c75fb71877115",
      "untracked_digest": "absent"
    },
    {
      "path": "src/core/i18n/index.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:dd353e931168ea756d01aa47b44c65166cb3c52b0cbd5ea3295feecf53d47283",
      "index_digest": "sha256:dd353e931168ea756d01aa47b44c65166cb3c52b0cbd5ea3295feecf53d47283",
      "worktree_digest": "sha256:dd353e931168ea756d01aa47b44c65166cb3c52b0cbd5ea3295feecf53d47283",
      "untracked_digest": "absent"
    },
    {
      "path": "src/core/model.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:16cfc1fc7144e8658ba89b345ea367953a675b063010e6dc542e86c685e2cbd2",
      "index_digest": "sha256:16cfc1fc7144e8658ba89b345ea367953a675b063010e6dc542e86c685e2cbd2",
      "worktree_digest": "sha256:16cfc1fc7144e8658ba89b345ea367953a675b063010e6dc542e86c685e2cbd2",
      "untracked_digest": "absent"
    },
    {
      "path": "src/core/routes.test.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:96685916e585cdb73122cb392142b85541112fa46bd5a8c4140836046175ae1e",
      "index_digest": "sha256:96685916e585cdb73122cb392142b85541112fa46bd5a8c4140836046175ae1e",
      "worktree_digest": "sha256:96685916e585cdb73122cb392142b85541112fa46bd5a8c4140836046175ae1e",
      "untracked_digest": "absent"
    },
    {
      "path": "src/core/routes.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:713811468959bd624c04b47d9c1255b67089b3efb9eb5335b3bf2c2095e9083e",
      "index_digest": "sha256:713811468959bd624c04b47d9c1255b67089b3efb9eb5335b3bf2c2095e9083e",
      "worktree_digest": "sha256:713811468959bd624c04b47d9c1255b67089b3efb9eb5335b3bf2c2095e9083e",
      "untracked_digest": "absent"
    },
    {
      "path": "src/core/sidebar.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:d99b36493ca517a41b7a4efb7c51edf9b84d750b2eac00276c8263138032a1d7",
      "index_digest": "sha256:d99b36493ca517a41b7a4efb7c51edf9b84d750b2eac00276c8263138032a1d7",
      "worktree_digest": "sha256:d99b36493ca517a41b7a4efb7c51edf9b84d750b2eac00276c8263138032a1d7",
      "untracked_digest": "absent"
    },
    {
      "path": "src/db/db.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:9850ab23018d6958c1c8540fdd4cddf4d004bc58d356e3f8a9d572ff1cc9a7a6",
      "index_digest": "sha256:9850ab23018d6958c1c8540fdd4cddf4d004bc58d356e3f8a9d572ff1cc9a7a6",
      "worktree_digest": "sha256:9850ab23018d6958c1c8540fdd4cddf4d004bc58d356e3f8a9d572ff1cc9a7a6",
      "untracked_digest": "absent"
    },
    {
      "path": "src/db/schemas.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:1a2c9f144778c554601e66c0450f2591f06f85952c19599c4ee6ab208cda9b36",
      "index_digest": "sha256:1a2c9f144778c554601e66c0450f2591f06f85952c19599c4ee6ab208cda9b36",
      "worktree_digest": "sha256:1a2c9f144778c554601e66c0450f2591f06f85952c19599c4ee6ab208cda9b36",
      "untracked_digest": "absent"
    },
    {
      "path": "src/screens/exportActions.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:d5dad685d20d6a38fc9a9c1f7bc32191525715391434d0f9b05ce87efac36027",
      "index_digest": "sha256:d5dad685d20d6a38fc9a9c1f7bc32191525715391434d0f9b05ce87efac36027",
      "worktree_digest": "sha256:d5dad685d20d6a38fc9a9c1f7bc32191525715391434d0f9b05ce87efac36027",
      "untracked_digest": "absent"
    },
    {
      "path": "src/screens/navigation.test.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:4d44afd67ce0a1ed54048740f9a3493843cfe19c99ba72f83ccd9cf77a95e825",
      "index_digest": "sha256:4d44afd67ce0a1ed54048740f9a3493843cfe19c99ba72f83ccd9cf77a95e825",
      "worktree_digest": "sha256:4d44afd67ce0a1ed54048740f9a3493843cfe19c99ba72f83ccd9cf77a95e825",
      "untracked_digest": "absent"
    },
    {
      "path": "src/screens/navigation.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:3cecc1a969c94c5f350b1d38be4b732ea5ec3965baad985a179d10eb94acc285",
      "index_digest": "sha256:3cecc1a969c94c5f350b1d38be4b732ea5ec3965baad985a179d10eb94acc285",
      "worktree_digest": "sha256:3cecc1a969c94c5f350b1d38be4b732ea5ec3965baad985a179d10eb94acc285",
      "untracked_digest": "absent"
    },
    {
      "path": "src/store/ui.ts",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:89fc3d76fda04cf20d83f871cadb2690c475108add21bd76c9ad608d65f92603",
      "index_digest": "sha256:89fc3d76fda04cf20d83f871cadb2690c475108add21bd76c9ad608d65f92603",
      "worktree_digest": "sha256:89fc3d76fda04cf20d83f871cadb2690c475108add21bd76c9ad608d65f92603",
      "untracked_digest": "absent"
    },
    {
      "path": "src/styles/index.css",
      "object_kind": {
        "head": "regular",
        "index": "regular",
        "worktree": "regular",
        "untracked": "absent"
      },
      "state": "clean",
      "rename_from": null,
      "rename_to": null,
      "head_digest": "sha256:f97aac4ea7ec6e1df26433ef16629da915a9ef6f180be66034214f2235cac3f4",
      "index_digest": "sha256:f97aac4ea7ec6e1df26433ef16629da915a9ef6f180be66034214f2235cac3f4",
      "worktree_digest": "sha256:f97aac4ea7ec6e1df26433ef16629da915a9ef6f180be66034214f2235cac3f4",
      "untracked_digest": "absent"
    }
  ]
}

```

## 12. Assumptions and Open Questions

Assumptions:

- IndexedDB (Dexie version 9) stores changes. The line "Saved to db/changes/" is copy plus the git icon, as in the mock. A real directory would need a writer outside the browser; that is out of scope unless the user says the folder must be git-backed.
- Servers are the four in the mock, fixed in code. Production is protected. Others mark ran on click.
- The first empty read seeds the nine mock rows so the screen is reviewable. Later edits stick.
- Destructive list icon means drop table or drop column. Rewrite is a yellow deploy flag and a detail warning, not a red icon. Matches which rows the mock marks.
- "This week" / "Last week" are ISO weeks, Monday local, not a rolling 7 days. On Monday 2026-10-26 a row dated 21 Oct falls in last week. Tests pin `now` to 24 Oct so the comp groups hold.
- Database dropdown selects context for create and deploy. The mock renders the `acm` row while `atad5s` is selected, so the table is not filtered by it.
- Prepare deploy with no server chip uses the last pipeline server that has a pending change for the selected database.
- Skip sets `na`. Undo restores one previous status. There is no schema-level undo.
- From schema diff uses the two newest saved versions of the schema whose name equals the selected database, via `migratorFor`. It does not open the diff screen.
- The drawer header `⋯` is omitted until it has actions.
- Search in the mock's top bar is shell chrome and is not part of this column. ⌘K stays the workspace search.

Open:

- PR link host. Store `url` when present; otherwise render the number as text.
- Whether "failed on Staging" should also default the checkbox off. The mock leaves it checked. Follow the mock.
- Whether a fully-ran change still opens a drawer whose footer has no primary. Plan: yes, Copy SQL only.

Deferred:

- Editing servers, connecting the deploy script to a live database, and a real `db/changes/` tree.
- Ignoring `.gitnexus/` in git. This planning run indexed the repo there. Do not stage it.

## 13. Definition of Done

- `#/changes` opens inside the existing shell, column max 1040px, no filter sidebar.
- Strip, segments, groups, row dots, drawer, and deploy match the v2 structure. One primary button on each surface.
- Marking a run and Mark N as run persist immediately with the current time. Production asks first. Undo, Skip, and Mark failed work on one cell.
- Deploy script name, check defaults, and backup line follow section 6.
- All new copy is in `en.ts` and `vi.ts`. Colours are tokens, including both themes.
- `npm test`, `npm run build`, and `npm run lint` pass.
- Browser pass covers the mark and deploy flow in dark and light. Known visual deltas: live counts instead of 47/6/1, rewrite warning without a row count, no duplicate top bar.
