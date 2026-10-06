# ERCanvas

The ER diagram: a dot-grid canvas of `TableNode`s joined by relationship curves, with a legend, a minimap and a table context menu.

- Props: `tables`, `positions` (`{[name]: {x,y}}`; pass `onMove(name, xy)` to control them, otherwise the canvas keeps its own), `onMoveEnd(name)`, `selected`, `onSelect(name|null)`, `selectedColumn`, `onSelectColumn`, `zoom`, `fitSignal`, `dimUnrelated`, `dirtyTables`, `invalidColumns`, `menuItems(table, close)`, `onDeleteTable(name)`, `initialMenu`, `hint`, `showLegend`, `showMinimap`.
- Relationships run from the referenced column (bar = one) to the foreign-key column (crow's foot = many) in `relation`; lines touching the selected table switch to `relation-active` and unrelated tables dim.
- Dragging snaps to 8px. Clicking empty canvas clears selection; dragging it pans.
- The canvas is the visual focus of the app: nothing overlays it except the legend, minimap, context menu and transient hints.
