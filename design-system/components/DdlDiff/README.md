# DdlDiff

Side-by-side DDL comparison with aligned rows: removed lines on the left in `removed-subtle`, added lines on the right in `added-subtle`, hatched gaps where one side has no line, and in-line highlights for the changed part of a modified line.

- Props: `rows` — `[left, right?, kind?, foldCount?]` where `kind` is `same` (default), `add` (left null), `del`, `mod`, or `fold` (a collapsed run, label in `left`); `leftTitle`, `rightTitle`, `leftMeta`, `rightMeta`, `style`.
