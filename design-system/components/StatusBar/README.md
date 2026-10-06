# StatusBar

A 24px mono strip under the canvas for ambient state: parse status, tables in view, the current selection path, problem count, dialect and zoom.

- Props: `left` and `right`, arrays of nodes.
- Show counts and paths, never actions. Problems turn `removed` when non-zero.
