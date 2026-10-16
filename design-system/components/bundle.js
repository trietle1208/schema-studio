/* @ds-bundle: {"format":4,"namespace":"SchemaStudio","components":[{"name":"Icon"},{"name":"Logo"},{"name":"Button"},{"name":"Badge"},{"name":"Input"},{"name":"Select"},{"name":"Checkbox"},{"name":"SegmentedControl"},{"name":"Sidebar"},{"name":"Toolbar"},{"name":"StatusBar"},{"name":"TableNode"},{"name":"ERCanvas"},{"name":"Inspector"},{"name":"TypeSelect"},{"name":"ContextMenu"},{"name":"Modal"},{"name":"DropZone"},{"name":"SqlEditor"},{"name":"ImportSchemaDialog"},{"name":"ExportDialog"},{"name":"Toast"},{"name":"DataTable"},{"name":"TableList"},{"name":"DataGrid"},{"name":"TableHeader"},{"name":"TableStructure"},{"name":"TableRelationships"},{"name":"DataToolbar"},{"name":"FilterChips"},{"name":"SelectionBar"},{"name":"Pagination"},{"name":"RecordEditor"},{"name":"Stepper"},{"name":"Progress"},{"name":"ImportRecordsDialog"},{"name":"FilterBuilder"},{"name":"QueryConsole"},{"name":"VersionList"},{"name":"DiffList"},{"name":"DdlDiff"},{"name":"EmptyState"},{"name":"Workspace"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var useState = React.useState, useRef = React.useRef, useEffect = React.useEffect, useMemo = React.useMemo, Fragment = React.Fragment;

  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  function assign() { return Object.assign.apply(Object, [{}].concat(Array.prototype.slice.call(arguments))); }

  // ------------------------------------------------------------------ icons
  var ICONS = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M9.5 9.5v10"/>',
    database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.75"/><path d="M4.5 5.5v13c0 1.5 3.4 2.75 7.5 2.75s7.5-1.25 7.5-2.75v-13"/><path d="M4.5 12c0 1.5 3.4 2.75 7.5 2.75s7.5-1.25 7.5-2.75"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5M14.5 8.5l2 2"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    'zoom-in': '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M11 8.5v5M8.5 11h5"/>',
    'zoom-out': '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8.5 11h5"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 13.5l5-5 5 5M5 4h14"/>',
    share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M10.5 10h.01M14 10h.01M17 10h.01M8 14h8"/>',
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
    'chevron-right': '<path d="M9 6l6 6-6 6"/>',
    'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
    'chevron-up': '<path d="M6 15l6-6 6 6"/>',
    'chevrons-ud': '<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>',
    'arrow-up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
    'arrow-down': '<path d="M12 5v14M6 13l6 6 6-6"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    layers: '<path d="M12 3.5L3.5 8 12 12.5 20.5 8z"/><path d="M3.5 12.5L12 17l8.5-4.5"/><path d="M3.5 16.5L12 21l8.5-4.5"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v4.5H8"/><path d="M12 8v4l3 2"/>',
    diff: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 8.5V14a4 4 0 0 0 4 4h5.5"/><path d="M18 15.5V10a4 4 0 0 0-4-4H8.5"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    'file-code': '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M10.5 12l-2 2 2 2M13.5 12l2 2-2 2"/>',
    clipboard: '<rect x="5.5" y="4.5" width="13" height="16" rx="2"/><rect x="9" y="3" width="6" height="3" rx="1"/>',
    plug: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'check-circle': '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
    warning: '<path d="M12 4L2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>',
    copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V5.5a1.5 1.5 0 0 0-1.5-1.5H5.5A1.5 1.5 0 0 0 4 5.5V14a1.5 1.5 0 0 0 1.5 1.5h3"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    more: '<circle cx="5.5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18.5" cy="12" r="1"/>',
    filter: '<path d="M4 5h16l-6.2 7.5V19l-3.6-1.8v-4.7z"/>',
    grip: '<circle cx="9" cy="6" r=".9"/><circle cx="15" cy="6" r=".9"/><circle cx="9" cy="12" r=".9"/><circle cx="15" cy="12" r=".9"/><circle cx="9" cy="18" r=".9"/><circle cx="15" cy="18" r=".9"/>',
    hash: '<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>',
    columns: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    folder: '<path d="M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4.5l2 2H19a1.5 1.5 0 0 1 1.5 1.5V17a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17z"/>',
    code: '<path d="M8.5 8l-4 4 4 4M15.5 8l4 4-4 4"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.75"/>',
    restore: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v4.5H8"/>',
    migration: '<path d="M4 7h11M11 3.5L15 7l-4 3.5"/><path d="M20 17H9M13 13.5L9 17l4 3.5"/>',
    command: '<path d="M9 9V6.5A2.5 2.5 0 1 0 6.5 9H9zm0 0h6m-6 0v6m6-6V6.5A2.5 2.5 0 1 1 17.5 9H15zm0 0v6m0 0h-6m6 0v2.5a2.5 2.5 0 1 0 2.5-2.5H15zm-6 0v2.5A2.5 2.5 0 1 1 6.5 15H9z"/>',
    sidebar: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15"/>',
    panel: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M14.5 4.5v15"/>',
    move: '<path d="M12 3v18M3 12h18M9 5.5L12 3l3 2.5M9 18.5l3 2.5 3-2.5M5.5 9L3 12l2.5 3M18.5 9L21 12l-2.5 3"/>',
    sparkle: '<path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4.5V11h-6.5"/>',
    play: '<path d="M7.5 4.5v15L19 12z"/>',
    bookmark: '<path d="M6.5 4.5h11v15L12 15.5l-5.5 4z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'
  };

  function Icon(p) {
    var size = p.size || 16;
    return h('svg', {
      className: cx('ss-icon', p.className), width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: p.strokeWidth || 1.75, strokeLinecap: 'round', strokeLinejoin: 'round',
      style: p.style, 'aria-hidden': p.label ? undefined : true, 'aria-label': p.label, role: p.label ? 'img' : undefined,
      dangerouslySetInnerHTML: { __html: ICONS[p.name] || '' }
    });
  }

  function Logo(p) {
    var size = p.size || 20;
    var mark = h('svg', { className: 'ss-icon', width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true },
      h('rect', { x: 2, y: 2.5, width: 10, height: 8, rx: 2, style: { fill: 'var(--accent)' } }),
      h('rect', { x: 12.75, y: 13.75, width: 8.5, height: 7, rx: 2, style: { fill: 'none', stroke: 'var(--accent)', strokeWidth: 1.75 } }),
      h('path', { d: 'M7 10.5v4.25a2.5 2.5 0 0 0 2.5 2.5h3.25', style: { fill: 'none', stroke: 'var(--accent)', strokeWidth: 1.75, strokeLinecap: 'round' } })
    );
    if (p.markOnly) return mark;
    return h('span', { className: 'ss-row', style: { gap: 8 } }, mark, h('span', { style: { font: '600 13px/16px var(--font-sans)', letterSpacing: '-.01em' } }, 'Schema Studio'));
  }

  // ------------------------------------------------------------------ primitives
  function Kbd(p) {
    var keys = Array.isArray(p.keys) ? p.keys : (p.children != null ? [p.children] : []);
    if (keys.length === 1) return h('kbd', { className: 'ss-kbd' }, keys[0]);
    return h('span', { className: 'ss-kbds' }, keys.map(function (k, i) { return h('kbd', { key: i, className: 'ss-kbd' }, k); }));
  }

  function Button(p) {
    var variant = p.variant || 'secondary';
    var rest = assign(p); ['variant', 'size', 'icon', 'iconRight', 'kbd', 'active', 'className', 'children'].forEach(function (k) { delete rest[k]; });
    var iconOnly = p.icon && (p.children == null || p.children === false);
    return h('button', assign({ type: 'button' }, rest, {
      className: cx('ss-btn', 'ss-btn--' + variant, p.size === 'sm' && 'ss-btn--sm', iconOnly && 'ss-btn--icon', p.active && 'is-active', p.className)
    }),
      p.icon && h(Icon, { name: p.icon, size: p.size === 'sm' ? 14 : 16 }),
      p.children,
      p.iconRight && h(Icon, { name: p.iconRight, size: 14 }),
      p.kbd && h(Kbd, { keys: [].concat(p.kbd) })
    );
  }

  function IconButton(p) {
    var rest = assign(p); delete rest.label; delete rest.icon;
    return h(Button, assign({ variant: 'ghost' }, rest, { icon: p.icon, title: p.title || p.label, 'aria-label': p.label }));
  }

  function Badge(p) {
    return h('span', { className: cx('ss-badge', 'ss-badge--' + (p.tone || 'neutral'), p.sans && 'ss-badge--sans', p.className), title: p.title },
      p.dot && h('span', { className: 'ss-badge-dot' }),
      p.icon && h(Icon, { name: p.icon, size: 12 }),
      p.children);
  }

  function Avatar(p) { return h('span', { className: 'ss-avatar', title: p.name, style: p.size ? { width: p.size, height: p.size } : null }, p.initials); }

  function Input(p) {
    var rest = assign(p); ['icon', 'mono', 'error', 'size', 'suffix', 'className', 'inputRef'].forEach(function (k) { delete rest[k]; });
    var input = h('input', assign({ type: 'text' }, rest, {
      ref: p.inputRef,
      'aria-invalid': p.error ? true : undefined,
      className: cx('ss-input', p.mono && 'ss-input--mono', p.size === 'sm' && 'ss-input--sm', p.icon && 'ss-input--icon', p.suffix && 'ss-input--suffix', p.error && 'ss-input--error', p.className)
    }));
    if (!p.icon && !p.suffix) return input;
    return h('div', { className: 'ss-input-wrap' }, p.icon && h(Icon, { name: p.icon, size: 14 }), input, p.suffix && h('span', { className: 'ss-input-suffix' }, p.suffix));
  }

  function Field(p) {
    return h('div', { className: cx('ss-field', p.className), style: p.style },
      p.label && h('label', { className: 'ss-field-label' }, h('span', null, p.label), p.aside && h('span', { className: 'ss-faint' }, p.aside)),
      p.children,
      p.error ? h('div', { className: 'ss-field-error', role: 'alert' }, h(Icon, { name: 'alert', size: 13 }), p.error)
        : p.hint && h('div', { className: 'ss-field-hint' }, p.hint));
  }

  function Select(p) {
    var opts = (p.options || []).map(function (o) { return typeof o === 'string' ? { value: o, label: o } : o; });
    return h('div', { className: cx('ss-select', p.mono && 'ss-select--mono', p.size === 'sm' && 'ss-select--sm', p.className), style: p.style },
      h('select', { value: p.value, onChange: function (e) { p.onChange && p.onChange(e.target.value); }, 'aria-label': p.label, disabled: p.disabled },
        opts.map(function (o) { return h('option', { key: o.value, value: o.value }, o.label); })),
      h(Icon, { name: 'chevron-down', size: 14 }));
  }

  function Checkbox(p) {
    return h('label', { className: cx('ss-check', p.radio && 'ss-check--radio', p.disabled && 'is-disabled', p.className) },
      h('input', { type: p.radio ? 'radio' : 'checkbox', name: p.name, checked: !!p.checked, disabled: p.disabled, onChange: function (e) { p.onChange && p.onChange(e.target.checked); } }),
      h('span', { className: 'ss-check-box' }, !p.radio && p.checked && h(Icon, { name: 'check', size: 11, strokeWidth: 3 })),
      h('span', null, p.label, p.description && h('span', { className: 'ss-check-desc' }, p.description)));
  }
  function Radio(p) { return h(Checkbox, assign(p, { radio: true })); }

  function Switch(p) {
    return h('label', { className: 'ss-switch' },
      h('input', { type: 'checkbox', checked: !!p.checked, onChange: function (e) { p.onChange && p.onChange(e.target.checked); }, 'aria-label': p.ariaLabel || p.label }),
      h('span', { className: 'ss-switch-track' }),
      p.label && h('span', null, p.label));
  }

  function SegmentedControl(p) {
    return h('div', { className: cx('ss-seg', p.block && 'ss-seg--block'), role: 'tablist' },
      p.options.map(function (o) {
        return h('button', {
          key: o.value, type: 'button', role: 'tab', 'aria-selected': p.value === o.value, disabled: o.disabled,
          className: cx('ss-seg-item', p.value === o.value && 'is-active'), onClick: function () { p.onChange && p.onChange(o.value); }
        }, o.icon && h(Icon, { name: o.icon, size: 14 }), o.label, o.badge && h(Badge, { sans: true }, o.badge));
      }));
  }

  // ------------------------------------------------------------------ sample data
  function col(name, type, o) { return assign({ name: name, type: type, nullable: false }, o || {}); }
  var SAMPLE_TABLES = [
    { name: 'users', schema: 'public', comment: 'Registered customers. One row per account.', columns: [
      col('id', 'BIGSERIAL', { pk: true }),
      col('email', 'VARCHAR(255)', { unique: true }),
      col('name', 'VARCHAR(255)', { nullable: true }),
      col('avatar_url', 'TEXT', { nullable: true }),
      col('created_at', 'TIMESTAMP', { default: 'now()' })
    ], indexes: [
      { name: 'users_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] },
      { name: 'users_email_unique', type: 'UNIQUE', using: 'btree', columns: ['email'] },
      { name: 'users_created_at_idx', type: 'INDEX', using: 'btree', columns: ['created_at'] }
    ] },
    { name: 'orders', schema: 'public', comment: 'Customer orders. Totals are stored, not derived.', columns: [
      col('id', 'BIGSERIAL', { pk: true }),
      col('user_id', 'BIGINT', { fk: { table: 'users', column: 'id', onDelete: 'CASCADE' } }),
      col('status', 'VARCHAR(50)', { default: "'pending'" }),
      col('total', 'DECIMAL(12,2)'),
      col('created_at', 'TIMESTAMP', { default: 'now()' })
    ], indexes: [
      { name: 'orders_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] },
      { name: 'orders_user_id_idx', type: 'INDEX', using: 'btree', columns: ['user_id'] },
      { name: 'orders_status_created_idx', type: 'INDEX', using: 'btree', columns: ['status', 'created_at'] }
    ] },
    { name: 'order_items', schema: 'public', comment: '', columns: [
      col('id', 'BIGSERIAL', { pk: true }),
      col('order_id', 'BIGINT', { fk: { table: 'orders', column: 'id', onDelete: 'CASCADE' } }),
      col('product_id', 'BIGINT', { fk: { table: 'products', column: 'id', onDelete: 'RESTRICT' } }),
      col('quantity', 'INTEGER', { default: '1' }),
      col('price', 'DECIMAL(12,2)')
    ], indexes: [
      { name: 'order_items_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] },
      { name: 'order_items_order_id_idx', type: 'INDEX', using: 'btree', columns: ['order_id'] }
    ] },
    { name: 'products', schema: 'public', comment: 'Sellable catalogue items.', columns: [
      col('id', 'BIGSERIAL', { pk: true }),
      col('name', 'VARCHAR(255)'),
      col('sku', 'VARCHAR(100)', { unique: true }),
      col('price', 'DECIMAL(12,2)')
    ], indexes: [
      { name: 'products_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] },
      { name: 'products_sku_unique', type: 'UNIQUE', using: 'btree', columns: ['sku'] }
    ] },
    { name: 'payments', schema: 'public', comment: '', columns: [
      col('id', 'BIGSERIAL', { pk: true }),
      col('order_id', 'BIGINT', { fk: { table: 'orders', column: 'id', onDelete: 'RESTRICT' } }),
      col('provider', 'VARCHAR(32)'),
      col('amount', 'DECIMAL(12,2)'),
      col('paid_at', 'TIMESTAMPTZ', { nullable: true })
    ], indexes: [{ name: 'payments_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] }] }
  ];
  var SAMPLE_POSITIONS = {
    users: { x: 24, y: 48 }, orders: { x: 304, y: 24 }, order_items: { x: 584, y: 160 },
    products: { x: 304, y: 328 }, payments: { x: 24, y: 336 }
  };
  var SAMPLE_SCHEMAS = [
    { name: 'ecommerce', engine: 'PostgreSQL', tables: 24, relationships: 31, version: 'v12', updated: '2 hours ago', updatedRank: 1, favorite: true, owner: 'LH' },
    { name: 'blog', engine: 'PostgreSQL', tables: 12, relationships: 14, version: 'v4', updated: 'Yesterday', updatedRank: 2, owner: 'LH' },
    { name: 'analytics', engine: 'ClickHouse', tables: 18, relationships: 6, version: 'v8', updated: '3 days ago', updatedRank: 3, favorite: true, owner: 'LH' },
    { name: 'inventory', engine: 'MySQL', tables: 15, relationships: 19, version: 'v6', updated: '1 week ago', updatedRank: 4, owner: 'LH' },
    { name: 'billing', engine: 'PostgreSQL', tables: 9, relationships: 11, version: 'v3', updated: '2 weeks ago', updatedRank: 5, owner: 'LH' },
    { name: 'auth_service', engine: 'SQLite', tables: 6, relationships: 5, version: 'v2', updated: 'Aug 28', updatedRank: 6, owner: 'LH' }
  ];
  var SAMPLE_VERSIONS = [
    { version: 'v12', current: true, time: 'Current', timestamp: 'Oct 6, 2026 · 08:14', author: 'Luong Hoang', initials: 'LH', message: 'Normalize order line items', tables: 24, relationships: 31, indexes: 18, added: 5, modified: 1, removed: 3 },
    { version: 'v11', time: '2 hours ago', timestamp: 'Oct 6, 2026 · 06:02', author: 'Luong Hoang', initials: 'LH', message: 'Widen orders.status to VARCHAR(50)', tables: 24, relationships: 30, indexes: 17, added: 0, modified: 1, removed: 0 },
    { version: 'v10', time: 'Yesterday', timestamp: 'Oct 5, 2026 · 17:40', author: 'Luong Hoang', initials: 'LH', message: 'Add payments table', tables: 24, relationships: 30, indexes: 17, added: 2, modified: 0, removed: 0 },
    { version: 'v9', time: '3 days ago', timestamp: 'Oct 3, 2026 · 11:25', author: 'Luong Hoang', initials: 'LH', message: 'Index users.created_at for reporting', tables: 23, relationships: 29, indexes: 16, added: 1, modified: 0, removed: 0 },
    { version: 'v8', time: '5 days ago', timestamp: 'Oct 1, 2026 · 09:12', author: 'Luong Hoang', initials: 'LH', message: 'Drop guest_checkouts', tables: 23, relationships: 29, indexes: 15, added: 0, modified: 2, removed: 1 },
    { version: 'v7', time: 'Sep 24', timestamp: 'Sep 24, 2026 · 15:51', author: 'Luong Hoang', initials: 'LH', message: 'Imported from ecommerce_prod.sql', tables: 24, relationships: 28, indexes: 15, added: 24, modified: 0, removed: 0 }
  ];
  var SAMPLE_DIFF = [
    { group: 'Tables', items: [
      { op: 'add', path: 'order_items', detail: '5 columns · 2 indexes · 2 foreign keys' },
      { op: 'del', path: 'legacy_orders', detail: '6 columns · 1,284 rows in last import' }
    ] },
    { group: 'Columns', items: [
      { op: 'add', path: 'users.avatar_url', detail: 'TEXT NULL' },
      { op: 'add', path: 'products.sku', detail: 'VARCHAR(100) NOT NULL UNIQUE' },
      { op: 'mod', path: 'orders.total', detail: 'DECIMAL(10,2) → DECIMAL(12,2)' }
    ] },
    { group: 'Indexes', items: [
      { op: 'add', path: 'order_items_order_id_idx', detail: 'btree (order_id)' },
      { op: 'add', path: 'products_sku_unique', detail: 'UNIQUE btree (sku)' },
      { op: 'del', path: 'legacy_orders_user_id_idx', detail: 'btree (user_id)' }
    ] },
    { group: 'Relationships', items: [
      { op: 'add', path: 'order_items.order_id → orders.id', detail: 'ON DELETE CASCADE' },
      { op: 'add', path: 'order_items.product_id → products.id', detail: 'ON DELETE RESTRICT' },
      { op: 'del', path: 'legacy_orders.user_id → users.id', detail: 'ON DELETE SET NULL' }
    ] }
  ];
  var SAMPLE_SQL = [
    '-- ecommerce schema · exported from prod (pg_dump 16.4)',
    'CREATE TABLE users (',
    '  id          BIGSERIAL PRIMARY KEY,',
    '  email       VARCHAR(255) NOT NULL UNIQUE,',
    '  name        VARCHAR(255),',
    '  avatar_url  TEXT,',
    '  created_at  TIMESTAMP NOT NULL DEFAULT now()',
    ');',
    '',
    'CREATE TABLE orders (',
    '  id          BIGSERIAL PRIMARY KEY,',
    '  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,',
    "  status      VARCHAR(50) NOT NULL DEFAULT 'pending',",
    '  total       DECIMAL(12,2) NOT NULL,',
    '  created_at  TIMESTAMP NOT NULL DEFAULT now()',
    ');',
    '',
    'CREATE INDEX orders_user_id_idx ON orders (user_id);'
  ].join('\n');

  // ------------------------------------------------------------------ sample records
  // Rows of the ecommerce sample, keyed by table name; values are null, numbers, booleans or strings
  // (timestamps as `YYYY-MM-DD HH:mm:ss`, as the seed writes them). Foreign keys point at rows that exist.
  var SAMPLE_RECORDS = (function () {
    var DAY = 86400000;
    function stamp(ms) { return new Date(ms).toISOString().slice(0, 19).replace('T', ' '); }
    var userRows = [
      ['luong.hoang@example.com', 'Luong Hoang', 1], ['minh.tran@example.com', 'Minh Tran', 1], ['linh.pham@example.com', 'Linh Pham', 0],
      ['dev.team@example.com', null, 0], ['hannah.becker@example.com', 'Hannah Becker', 1], ['diego.alvarez@example.com', 'Diego Alvarez', 2],
      ['sofia.rossi@example.com', 'Sofia Rossi', 1], ['kenji.tanaka@example.com', 'Kenji Tanaka', 0], ['priya.nair@example.com', 'Priya Nair', 1],
      ['omar.haddad@example.com', 'Omar Haddad', 1], ['billing.ops@example.com', null, 1], ['elena.petrova@example.com', 'Elena Petrova', 0],
      ['noah.williams@example.com', 'Noah Williams', 1], ['aisha.khan@example.com', 'Aisha Khan', 1], ['lucas.martin@example.com', 'Lucas Martin', 0],
      ['mai.le@example.com', 'Mai Le', 1], ['k.ito@example.com', null, 1], ['tom.fischer@example.com', 'Tom Fischer', 1],
      ['zoe.clark@example.com', 'Zoe Clark', 0], ['quang.vo@example.com', 'Quang Vo', 1]
    ];
    var users = userRows.map(function (u, i) {
      return {
        id: i + 1, email: u[0], name: u[1],
        avatar_url: u[2] === 0 ? null : u[2] === 2
          ? 'https://cdn.example.com/avatars/6/original/diego-alvarez-profile-photo-2026-03-14T09-12-44Z.jpg?w=1024&h=1024&fit=crop&crop=faces&auto=format&q=85&sig=7c1f0e5b9a3d4482b6e0f1a2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6'
          : 'https://cdn.example.com/avatars/' + (i + 1) + '.png',
        created_at: stamp(Date.UTC(2026, 2, 2, 9, 14, 7) + i * (3 * DAY + 5 * 3600000 + 17 * 60000 + 41000))
      };
    });
    var productRows = [['Mechanical keyboard', 'KB-MX-87', 129.9], ['USB-C dock', 'DK-USBC-11', 89], ['27" monitor', 'MN-27-4K', 349.5], ['Desk mat', 'DM-XL-GRY', 24.99], ['Webcam 1080p', 'WC-1080', 59], ['Laptop stand', 'LS-ALU-02', 39.9], ['Noise-cancelling headset', 'HS-NC-700', 219], ['Ergonomic mouse', 'MS-ERG-05', 74.5], ['Cable organiser', 'CO-6PK', 12.5], ['Portable SSD 1TB', 'SSD-1T-P3', 119]];
    var products = productRows.map(function (r, i) { return { id: i + 1, name: r[0], sku: r[1], price: r[2] }; });
    var itemOrder = [], i2;
    for (i2 = 0; i2 < 20; i2++) itemOrder.push(i2 + 1);
    [3, 5, 8, 8, 11, 14, 14, 17, 19, 20].forEach(function (o) { itemOrder.push(o); });
    var items = itemOrder.map(function (orderId, i) {
      var product = products[(i * 3 + orderId) % products.length];
      return { id: i + 1, order_id: orderId, product_id: product.id, quantity: 1 + (i * 5) % 4, price: product.price };
    });
    var statuses = ['pending', 'paid', 'shipped', 'delivered', 'delivered', 'cancelled', 'paid', 'delivered', 'shipped', 'delivered'];
    var orderUsers = [1, 2, 2, 3, 5, 1, 6, 7, 2, 9, 10, 5, 13, 1, 14, 16, 18, 2, 20, 7];
    var orders = orderUsers.map(function (userId, i) {
      var total = items.filter(function (it) { return it.order_id === i + 1; }).reduce(function (sum, it) { return sum + it.quantity * it.price; }, 0);
      return { id: i + 1, user_id: userId, status: statuses[(i * 3) % statuses.length], total: Math.round(total * 100) / 100, created_at: stamp(Date.UTC(2026, 5, 1, 8, 30, 12) + i * (2 * DAY + 7 * 3600000 + 9 * 60000 + 23000)) };
    });
    return { users: users, orders: orders, order_items: items, products: products, payments: [] };
  })();

  // ------------------------------------------------------------------ SQL highlight
  var KW = 'CREATE|TABLE|PRIMARY|KEY|NOT|NULL|UNIQUE|DEFAULT|REFERENCES|ON|DELETE|UPDATE|CASCADE|RESTRICT|SET|INDEX|ALTER|ADD|COLUMN|DROP|IF|EXISTS|CONSTRAINT|FOREIGN|CHECK|USING|BEGIN|COMMIT|TYPE|IN|AND|OR|INSERT|INTO|VALUES|SELECT|FROM|WHERE|NO|ACTION|COMMENT|IS|RENAME|TO|ORDER|BY|LIMIT|OFFSET|LIKE|ILIKE|BETWEEN|DESC|ASC|DISTINCT|AS|TRUE|FALSE';
  var TY = 'BIGSERIAL|SERIAL|SMALLSERIAL|BIGINT|INTEGER|INT|SMALLINT|DECIMAL|NUMERIC|VARCHAR|CHAR|TEXT|BOOLEAN|BOOL|TIMESTAMPTZ|TIMESTAMP|DATE|TIME|UUID|JSONB|JSON|BYTEA|REAL|DOUBLE|PRECISION|INET|DateTime|UInt64|UInt32|String|Float64';
  var TOKEN_RE = new RegExp("(--[^\\n]*)|('(?:[^'\\\\]|\\\\.)*'?)|\\b(" + KW + ")\\b|\\b(" + TY + ")\\b|\\b(\\d+(?:\\.\\d+)?)\\b", 'gi');
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function highlightSql(src) {
    var out = '', last = 0, m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(src))) {
      out += esc(src.slice(last, m.index));
      var cls = m[1] ? 'com' : m[2] ? 'str' : m[3] ? 'kw' : m[4] ? 'ty' : 'num';
      out += '<span class="ss-tok-' + cls + '">' + esc(m[0]) + '</span>';
      last = m.index + m[0].length;
      if (m[0].length === 0) TOKEN_RE.lastIndex++;
    }
    return out + esc(src.slice(last));
  }
  // JSON: keys are types, strings strings, numbers numbers and true / false / null keywords. Only wraps text, so a textarea laid over it stays aligned.
  var JSON_TOKEN_RE = /("(?:[^"\\\n]|\\.)*"?)(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  function highlightJson(src) {
    var out = '', last = 0, m;
    JSON_TOKEN_RE.lastIndex = 0;
    while ((m = JSON_TOKEN_RE.exec(src))) {
      out += esc(src.slice(last, m.index));
      if (m[1] !== undefined) out += '<span class="ss-tok-' + (m[2] ? 'ty' : 'str') + '">' + esc(m[1]) + '</span>' + (m[2] ? esc(m[2]) : '');
      else out += '<span class="ss-tok-' + (m[3] ? 'kw' : 'num') + '">' + esc(m[0]) + '</span>';
      last = m.index + m[0].length;
      if (m[0].length === 0) JSON_TOKEN_RE.lastIndex++;
    }
    return out + esc(src.slice(last));
  }

  // ------------------------------------------------------------------ table node
  var NODE_W = 228, HEAD_H = 33, ROW_H = 24;
  function nodeHeight(t) { return HEAD_H + t.columns.length * ROW_H + 4 + 2; }

  function NodeRow(p) {
    var c = p.column;
    var keyEl = c.pk ? h(Icon, { name: 'key', size: 13, className: 'ss-node-key', label: 'Primary key' })
      : c.fk ? h(Icon, { name: 'link', size: 13, className: 'ss-node-fk', label: 'Foreign key → ' + c.fk.table + '.' + c.fk.column })
        : h('span');
    var empty = !c.name;
    return h('div', {
      className: cx('ss-node-row', p.selected && 'is-selected', c.draft && 'is-draft', p.invalid && 'is-invalid', c.added && 'is-added'),
      onClick: p.onClick, onPointerDown: function (e) { e.stopPropagation(); }, title: c.comment || undefined
    },
      keyEl,
      h('span', { className: cx('ss-node-col', empty && 'is-empty') }, empty ? 'unnamed' : c.name),
      h('span', { className: 'ss-node-type' }, c.type || '—', c.nullable && h('span', { className: 'ss-node-null', title: 'Nullable' }, '?')),
      h('span', { className: 'ss-node-flag', title: c.unique ? 'Unique' : undefined }, c.unique ? 'UQ' : ''));
  }

  function TableNode(p) {
    var t = p.table;
    return h('div', {
      className: cx('ss-node', p.static && 'ss-node--static', p.selected && 'is-selected', p.dimmed && 'is-dimmed', p.dragging && 'is-dragging', p.state === 'added' && 'is-added', p.state === 'removed' && 'is-removed'),
      style: assign(p.static ? {} : { left: p.x || 0, top: p.y || 0 }, p.style),
      onPointerDown: p.onPointerDown, onPointerMove: p.onPointerMove, onPointerUp: p.onPointerUp,
      onContextMenu: p.onContextMenu, onClick: function (e) { e.stopPropagation(); p.onSelect && p.onSelect(t.name); },
      'data-table': t.name, role: 'group', 'aria-label': 'Table ' + t.name
    },
      h('div', { className: 'ss-node-head', 'data-drag': '1' },
        h(Icon, { name: 'table', size: 14 }),
        h('span', { className: 'ss-node-name' }, t.schema && t.schema !== 'public' ? h('span', { className: 'ss-node-schema' }, t.schema + '.') : null, t.name || 'unnamed'),
        p.dirty && h('span', { className: 'ss-dirty-dot', title: 'Unsaved changes' }),
        h('span', { className: 'ss-node-count' }, t.columns.length)),
      h('div', { className: 'ss-node-body' },
        t.columns.map(function (c, i) {
          return h(NodeRow, {
            key: i, column: c, selected: p.selected && p.selectedColumn === i, invalid: p.invalidColumns && p.invalidColumns.indexOf(i) >= 0,
            onClick: function (e) { e.stopPropagation(); p.onSelect && p.onSelect(t.name); p.onSelectColumn && p.onSelectColumn(i); }
          });
        })));
  }

  // ------------------------------------------------------------------ menu
  function ContextMenu(p) {
    return h('div', { className: 'ss-menu', role: 'menu', style: p.style, onPointerDown: function (e) { e.stopPropagation(); }, onClick: function (e) { e.stopPropagation(); } },
      p.label && h('div', { className: 'ss-menu-label' }, p.label),
      p.items.map(function (it, i) {
        if (it === '-' || it.separator) return h('div', { key: i, className: 'ss-menu-sep', role: 'separator' });
        return h('button', {
          key: i, type: 'button', role: 'menuitem', className: cx('ss-menu-item', it.danger && 'is-danger', it.active && 'is-active'),
          onClick: function () { it.onSelect && it.onSelect(); p.onClose && p.onClose(); }
        }, it.icon ? h(Icon, { name: it.icon, size: 14 }) : h('span', { style: { width: 14 } }), it.label, it.shortcut && h('span', { className: 'ss-menu-sc' }, it.shortcut));
      }));
  }

  // ------------------------------------------------------------------ canvas
  function edgePath(a, b) {
    // a: {x,y,side:+1 right / -1 left}, b same
    var dx = Math.max(36, Math.abs(b.x - a.x) / 2);
    return 'M' + a.x + ' ' + a.y + ' C' + (a.x + a.side * dx) + ' ' + a.y + ' ' + (b.x + b.side * dx) + ' ' + b.y + ' ' + b.x + ' ' + b.y;
  }
  function computeEdges(tables, pos) {
    var byName = {}; tables.forEach(function (t) { byName[t.name] = t; });
    var edges = [];
    tables.forEach(function (t) {
      t.columns.forEach(function (c, i) {
        if (!c.fk || !byName[c.fk.table] || !pos[t.name] || !pos[c.fk.table]) return;
        var r = byName[c.fk.table], ri = Math.max(0, r.columns.findIndex(function (x) { return x.name === c.fk.column; }));
        var pt = pos[t.name], pr = pos[r.name];
        var fy = pt.y + HEAD_H + i * ROW_H + ROW_H / 2 + 1, ry = pr.y + HEAD_H + ri * ROW_H + ROW_H / 2 + 1;
        var a, b;
        if (pr.x + NODE_W + 24 <= pt.x) { a = { x: pr.x + NODE_W, y: ry, side: 1 }; b = { x: pt.x, y: fy, side: -1 }; }
        else if (pt.x + NODE_W + 24 <= pr.x) { a = { x: pr.x, y: ry, side: -1 }; b = { x: pt.x + NODE_W, y: fy, side: 1 }; }
        else { a = { x: pr.x + NODE_W, y: ry, side: 1 }; b = { x: pt.x + NODE_W, y: fy, side: 1 }; }
        edges.push({ id: t.name + '.' + c.name, from: r.name, to: t.name, a: a, b: b, removed: c.removed });
      });
    });
    return edges;
  }
  function EdgeEnds(e) {
    // one bar at the PK end, a crow's foot at the FK end
    var a = e.a, b = e.b;
    var oneX = a.x + a.side * 8;
    var foot = b.x + b.side * 9;
    return h(Fragment, null,
      h('path', { className: 'ss-edge-end', d: 'M' + oneX + ' ' + (a.y - 5) + ' V' + (a.y + 5) }),
      h('path', { className: 'ss-edge-end', d: 'M' + foot + ' ' + b.y + ' L' + b.x + ' ' + (b.y - 5) + ' M' + foot + ' ' + b.y + ' L' + b.x + ' ' + (b.y + 5) + ' M' + foot + ' ' + b.y + ' L' + b.x + ' ' + b.y }));
  }

  function Minimap(p) {
    var names = Object.keys(p.positions);
    if (!names.length) return null;
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    var hByName = {}; p.tables.forEach(function (t) { hByName[t.name] = nodeHeight(t); });
    names.forEach(function (n) { var q = p.positions[n]; minX = Math.min(minX, q.x); minY = Math.min(minY, q.y); maxX = Math.max(maxX, q.x + NODE_W); maxY = Math.max(maxY, q.y + (hByName[n] || 120)); });
    // pretend more tables live off-screen (24 in the schema)
    maxX += 520; maxY += 260;
    var W = 168, H = 108, pad = 8, s = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxY - minY));
    function X(x) { return pad + (x - minX) * s; } function Y(y) { return pad + (y - minY) * s; }
    var ghosts = [[960, 40, 7], [960, 300, 5], [1240, 120, 6], [700, 560, 4], [1040, 520, 5], [40, 620, 4]];
    return h('div', { className: 'ss-minimap', 'aria-label': 'Minimap' },
      h('svg', { width: W, height: H },
        ghosts.map(function (g, i) { return h('rect', { key: 'g' + i, className: 'n', x: X(g[0]), y: Y(g[1]), width: NODE_W * s, height: (HEAD_H + g[2] * ROW_H) * s, rx: 1.5, opacity: 0.6 }); }),
        names.map(function (n) { var q = p.positions[n]; return h('rect', { key: n, className: cx('n', p.selected === n && 'is-sel'), x: X(q.x), y: Y(q.y), width: NODE_W * s, height: (hByName[n] || 120) * s, rx: 1.5 }); }),
        h('rect', { className: 'vp', x: X(-p.offset.x / p.zoom), y: Y(-p.offset.y / p.zoom), width: (p.viewW / p.zoom) * s, height: (p.viewH / p.zoom) * s, rx: 2 })));
  }

  function ERCanvas(p) {
    var zoom = p.zoom || 1;
    var _pos = useState(p.positions || SAMPLE_POSITIONS), positions = _pos[0], setPositions = _pos[1];
    var _off = useState(p.offset || { x: 0, y: 0 }), offset = _off[0], setOffset = _off[1];
    var _drag = useState(null), dragging = _drag[0], setDragging = _drag[1];
    var _menu = useState(p.initialMenu || null), menu = _menu[0], setMenu = _menu[1];
    var _size = useState({ w: 840, h: 800 }), size = _size[0], setSize = _size[1];
    var drag = useRef(null), ref = useRef(null);
    var pos = p.positions && p.onMove ? p.positions : positions;
    useEffect(function () {
      if (!ref.current) return;
      var el = ref.current; var update = function () { setSize({ w: el.clientWidth, h: el.clientHeight }); };
      update();
      if (window.ResizeObserver) { var ro = new ResizeObserver(update); ro.observe(el); return function () { ro.disconnect(); }; }
    }, []);
    useEffect(function () { if (p.fitSignal) setOffset({ x: 0, y: 0 }); }, [p.fitSignal]);

    function move(name, xy) {
      if (p.onMove) p.onMove(name, xy);
      else setPositions(function (prev) { var n = assign(prev); n[name] = xy; return n; });
    }
    function onNodeDown(name, e) {
      if (e.button !== 0) return;
      setMenu(null);
      if (!e.target.closest('[data-drag]')) return;
      e.preventDefault(); e.stopPropagation();
      p.onSelect && p.onSelect(name);
      var q = pos[name];
      drag.current = { name: name, sx: e.clientX, sy: e.clientY, ox: q.x, oy: q.y, moved: false };
      e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
    }
    function onNodeMove(e) {
      var d = drag.current; if (!d || d.pan) return;
      var dx = (e.clientX - d.sx) / zoom, dy = (e.clientY - d.sy) / zoom;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      if (!d.moved) { d.moved = true; setDragging(d.name); }
      move(d.name, { x: Math.round((d.ox + dx) / 8) * 8, y: Math.round((d.oy + dy) / 8) * 8 });
    }
    function onUp() { if (drag.current && drag.current.moved && p.onMoveEnd) p.onMoveEnd(drag.current.name); drag.current = null; setDragging(null); }
    function onBgDown(e) {
      if (e.button !== 0) return;
      setMenu(null);
      drag.current = { pan: true, sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y, moved: false };
      e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
    }
    function onBgMove(e) {
      var d = drag.current; if (!d || !d.pan) return;
      var dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      d.moved = true; setDragging('__pan');
      setOffset({ x: d.ox + dx, y: d.oy + dy });
    }
    function onBgUp() { var d = drag.current; if (d && d.pan && !d.moved) { p.onSelect && p.onSelect(null); } drag.current = null; setDragging(null); }
    function onNodeMenu(name, e) {
      e.preventDefault(); e.stopPropagation();
      var r = ref.current.getBoundingClientRect();
      p.onSelect && p.onSelect(name);
      setMenu({ table: name, x: e.clientX - r.left, y: e.clientY - r.top });
    }

    var edges = computeEdges(p.tables, pos);
    var sel = p.selected;
    var menuItems = menu ? (p.menuItems ? p.menuItems(menu.table, function () { setMenu(null); }) : [
      { icon: 'pencil', label: 'Rename table', shortcut: 'F2' },
      { icon: 'plus', label: 'Add column', shortcut: '⌘⏎' },
      { icon: 'link', label: 'Add foreign key…' },
      { icon: 'copy', label: 'Duplicate', shortcut: '⌘D' },
      '-',
      { icon: 'code', label: 'Copy CREATE TABLE', shortcut: '⇧⌘C' },
      { icon: 'eye', label: 'Focus related tables' },
      '-',
      { icon: 'trash', label: 'Delete table', shortcut: '⌫', danger: true, onSelect: function () { p.onDeleteTable && p.onDeleteTable(menu.table); } }
    ]) : null;

    return h('div', {
      ref: ref, className: cx('ss-canvas', dragging === '__pan' && 'is-panning'), style: p.style,
      onPointerDown: onBgDown, onPointerMove: onBgMove, onPointerUp: onBgUp, onContextMenu: function (e) { e.preventDefault(); },
      role: 'application', 'aria-label': 'ER diagram canvas'
    },
      h('div', { className: 'ss-canvas-layer', style: { transform: 'translate(' + offset.x + 'px,' + offset.y + 'px) scale(' + zoom + ')' } },
        h('svg', { className: 'ss-edges', width: 1, height: 1 },
          edges.map(function (e) {
            var active = sel && (e.from === sel || e.to === sel);
            return h('g', { key: e.id, className: cx('ss-edge-g', active && 'is-active', sel && !active && 'is-dim', e.removed && 'is-removed') },
              h('path', { className: 'ss-edge', d: edgePath(e.a, e.b) }), h(EdgeEnds, e));
          })),
        p.tables.map(function (t) {
          var q = pos[t.name]; if (!q) return null;
          var related = !sel || sel === t.name || edges.some(function (e) { return (e.from === sel && e.to === t.name) || (e.to === sel && e.from === t.name); });
          return h(TableNode, {
            key: t.name, table: t, x: q.x, y: q.y, selected: sel === t.name, dimmed: p.dimUnrelated && !related,
            dragging: dragging === t.name, dirty: p.dirtyTables && p.dirtyTables.indexOf(t.name) >= 0,
            selectedColumn: p.selectedColumn, invalidColumns: sel === t.name ? p.invalidColumns : null,
            onSelect: p.onSelect, onSelectColumn: p.onSelectColumn,
            onPointerDown: function (e) { onNodeDown(t.name, e); }, onPointerMove: onNodeMove, onPointerUp: onUp,
            onContextMenu: function (e) { onNodeMenu(t.name, e); }
          });
        })),
      p.hint && h('div', { className: 'ss-canvas-hint' }, p.hint),
      p.showLegend !== false && h('div', { className: 'ss-legend' },
        h('span', null, h(Icon, { name: 'key', size: 12, style: { color: 'var(--pk)' } }), 'primary key'),
        h('span', null, h(Icon, { name: 'link', size: 12, style: { color: 'var(--fk)' } }), 'foreign key'),
        h('span', null, h('b', { style: { color: 'var(--ink-2)', fontWeight: 500 } }, '?'), 'nullable'),
        h('span', null, h('b', { style: { color: 'var(--ink-2)', fontWeight: 600, fontSize: 9.5 } }, 'UQ'), 'unique')),
      p.showMinimap !== false && h(Minimap, { tables: p.tables, positions: pos, selected: sel, zoom: zoom, offset: offset, viewW: size.w, viewH: size.h }),
      menu && h('div', { className: 'ss-canvas-menu', style: { left: menu.x, top: menu.y } }, h(ContextMenu, { label: 'public.' + menu.table, items: menuItems, onClose: function () { setMenu(null); } })));
  }

  // ------------------------------------------------------------------ type select
  var TYPE_OPTIONS = [
    ['BIGSERIAL', 'auto-increment'], ['SERIAL', 'auto-increment'], ['BIGINT', 'integer'], ['INTEGER', 'integer'], ['SMALLINT', 'integer'],
    ['DECIMAL(12,2)', 'exact numeric'], ['NUMERIC', 'exact numeric'], ['VARCHAR(255)', 'text'], ['VARCHAR(100)', 'text'], ['VARCHAR(50)', 'text'], ['TEXT', 'text'],
    ['BOOLEAN', 'logical'], ['TIMESTAMP', 'date/time'], ['TIMESTAMPTZ', 'date/time'], ['DATE', 'date/time'], ['UUID', 'identifier'], ['JSONB', 'document'], ['BYTEA', 'binary']
  ];
  function TypeSelect(p) {
    var _o = useState(!!p.defaultOpen), open = _o[0], setOpen = _o[1];
    var _q = useState(null), q = _q[0], setQ = _q[1];
    var val = q != null ? q : (p.value || '');
    var needle = (q || '').toUpperCase();
    var list = TYPE_OPTIONS.filter(function (o) { return !needle || o[0].indexOf(needle) >= 0; });
    function pick(t) { p.onChange && p.onChange(t); setQ(null); setOpen(false); }
    return h('div', { className: 'ss-typesel' },
      h(Input, {
        mono: true, value: val, placeholder: 'Type', error: p.error, size: p.size, className: p.inputClassName,
        onFocus: function () { setOpen(true); }, onBlur: function () { setOpen(false); if (q != null) { p.onChange && p.onChange(q.toUpperCase()); setQ(null); } },
        onChange: function (e) { setQ(e.target.value); setOpen(true); },
        onKeyDown: function (e) { if (e.key === 'Enter' && list[0]) { e.preventDefault(); pick(list[0][0]); } if (e.key === 'Escape') setOpen(false); },
        'aria-label': 'Data type', suffix: h(Icon, { name: 'chevrons-ud', size: 13, style: { color: 'var(--ink-3)' } })
      }),
      open && list.length > 0 && h('div', { className: cx('ss-pop', p.placement === 'top' && 'ss-pop--top', p.align === 'end' && 'ss-pop--end'), role: 'listbox' },
        h('div', { className: 'ss-pop-group ss-caption' }, needle ? 'Matches' : 'PostgreSQL types'),
        list.map(function (o, i) {
          var name = o[0], at = needle ? name.indexOf(needle) : -1;
          var label = at >= 0 ? [name.slice(0, at), h('mark', { key: 'm' }, name.slice(at, at + needle.length)), name.slice(at + needle.length)] : name;
          return h('div', {
            key: name, role: 'option', 'aria-selected': name === p.value, className: cx('ss-pop-item', (name === p.value || (needle && i === 0)) && 'is-active'),
            onMouseDown: function (e) { e.preventDefault(); pick(name); }
          }, h('span', null, label), h('small', null, o[1]));
        })));
  }

  // ------------------------------------------------------------------ inspector
  function validateColumns(t) {
    var errs = {}, seen = {};
    t.columns.forEach(function (c, i) {
      if (!c.name || !c.name.trim()) errs[i] = 'Column name cannot be empty.';
      else if (!/^[a-z_][a-z0-9_]*$/i.test(c.name)) errs[i] = 'Use letters, digits and underscores; start with a letter.';
      else if (seen[c.name]) errs[i] = 'Column "' + c.name + '" already exists in ' + t.name + '.';
      else if (!c.type) errs[i] = 'Choose a data type.';
      seen[c.name] = true;
    });
    return errs;
  }

  function InspectorSection(p) {
    var _c = useState(!!p.collapsed), collapsed = _c[0], setCollapsed = _c[1];
    return h('section', { className: cx('ss-insp-sec', collapsed && 'is-collapsed') },
      h('div', { className: 'ss-insp-sec-head', onClick: function () { setCollapsed(!collapsed); }, role: 'button', 'aria-expanded': !collapsed },
        h(Icon, { name: 'chevron-down', size: 14 }),
        h('span', { className: 'ss-caption', style: { color: 'var(--ink-2)' } }, p.title),
        p.count != null && h('span', { className: 'ss-insp-sec-count' }, p.count),
        h('span', { className: 'ss-spacer' }),
        p.onAdd && h(IconButton, { icon: 'plus', size: 'sm', label: p.addLabel || 'Add', onClick: function (e) { e.stopPropagation(); p.onAdd(); } })),
      h('div', { className: 'ss-insp-sec-body' }, p.children));
  }

  function ColumnEditor(p) {
    var c = p.column, t = p.table;
    function set(patch) { p.onChange(assign(c, patch)); }
    var fkOptions = [{ value: '', label: '— none —' }].concat(p.tables.filter(function (x) { return x.name !== t.name; }).map(function (x) {
      var pk = x.columns.find(function (cc) { return cc.pk; }); return pk ? { value: x.name + '.' + pk.name, label: x.name + '.' + pk.name } : null;
    }).filter(Boolean));
    return h('div', { className: 'ss-coledit', onClick: function (e) { e.stopPropagation(); } },
      h(Field, { label: 'Default', className: 'ss-span1' }, h(Input, { mono: true, size: 'sm', value: c.default || '', placeholder: c.nullable ? 'NULL' : 'none', onChange: function (e) { set({ default: e.target.value }); } })),
      h(Field, { label: 'References' }, h(Select, { mono: true, size: 'sm', value: c.fk ? c.fk.table + '.' + c.fk.column : '', options: fkOptions, onChange: function (v) { set({ fk: v ? { table: v.split('.')[0], column: v.split('.')[1], onDelete: (c.fk && c.fk.onDelete) || 'RESTRICT' } : null }); } })),
      c.fk && h(Field, { label: 'On delete', className: 'ss-span2' }, h(SegmentedControl, { block: true, value: c.fk.onDelete || 'RESTRICT', onChange: function (v) { set({ fk: assign(c.fk, { onDelete: v }) }); }, options: [{ value: 'RESTRICT', label: 'RESTRICT' }, { value: 'CASCADE', label: 'CASCADE' }, { value: 'SET NULL', label: 'SET NULL' }, { value: 'NO ACTION', label: 'NO ACTION' }] })),
      h('div', { className: 'ss-span2 ss-coledit-checks' },
        h(Checkbox, { label: 'Nullable', checked: c.nullable, disabled: c.pk, onChange: function (v) { set({ nullable: v }); } }),
        h(Checkbox, { label: 'Primary key', checked: c.pk, onChange: function (v) { set({ pk: v, nullable: v ? false : c.nullable }); } }),
        h(Checkbox, { label: 'Unique', checked: c.unique, onChange: function (v) { set({ unique: v }); } })),
      h(Field, { label: 'Comment', className: 'ss-span2' }, h(Input, { size: 'sm', value: c.comment || '', placeholder: 'Describe this column', onChange: function (e) { set({ comment: e.target.value }); } })),
      h('div', { className: 'ss-span2 ss-coledit-foot' },
        h('span', { className: 'ss-faint', style: { fontSize: 11, fontFamily: 'var(--font-mono)' } }, 'ALTER TABLE ' + t.name + ' …'),
        h(Button, { variant: 'danger-ghost', size: 'sm', icon: 'trash', onClick: p.onDelete }, 'Delete column')));
  }

  function Inspector(p) {
    var t = p.table;
    var _ren = useState(!!p.renaming), renaming = _ren[0], setRenaming = _ren[1];
    var _draftName = useState(t ? t.name : ''), draftName = _draftName[0], setDraftName = _draftName[1];
    useEffect(function () { if (t) setDraftName(t.name); }, [t && t.name]);
    if (!t) {
      return h('aside', { className: 'ss-inspector' },
        h('div', { className: 'ss-insp-head' }, h('div', { className: 'ss-insp-title' }, h(Icon, { name: 'database', size: 16 }), h('span', { className: 'ss-insp-name', style: { cursor: 'default' } }, p.schemaName || 'ecommerce'))),
        h('div', { className: 'ss-insp-empty', style: { padding: 16 } }, 'Select a table to edit its columns, indexes and foreign keys. ', h('br'), h('br'), h('span', { className: 'ss-row' }, h(Kbd, { keys: ['⌘', 'K'] }), 'Jump to table')));
    }
    var errors = validateColumns(t);
    var tableErr = renaming && !draftName.trim() ? 'Table name cannot be empty.' : null;
    function setCol(i, c) { var cols = t.columns.slice(); cols[i] = c; p.onChange(assign(t, { columns: cols })); }
    function delCol(i) { var cols = t.columns.slice(); cols.splice(i, 1); p.onChange(assign(t, { columns: cols })); p.onSelectColumn && p.onSelectColumn(null); }
    function addCol() { var cols = t.columns.concat([{ name: '', type: 'TEXT', nullable: true, draft: true }]); p.onChange(assign(t, { columns: cols })); p.onSelectColumn && p.onSelectColumn(cols.length - 1); }
    function commitName() { if (!draftName.trim()) return; setRenaming(false); if (draftName !== t.name) p.onRename && p.onRename(t.name, draftName.trim()); }
    var incoming = []; (p.tables || []).forEach(function (o) { o.columns.forEach(function (c) { if (c.fk && c.fk.table === t.name) incoming.push({ from: o.name + '.' + c.name, to: t.name + '.' + c.fk.column, onDelete: c.fk.onDelete }); }); });
    var outgoing = t.columns.filter(function (c) { return c.fk; }).map(function (c) { return { from: t.name + '.' + c.name, to: c.fk.table + '.' + c.fk.column, onDelete: c.fk.onDelete }; });
    var sc = p.selectedColumn;

    return h('aside', { className: 'ss-inspector', 'aria-label': 'Inspector' },
      h('div', { className: 'ss-insp-head' },
        h('div', { className: 'ss-insp-title' },
          h(Icon, { name: 'table', size: 16 }),
          renaming
            ? h('input', { className: cx('ss-insp-name', tableErr && 'is-error'), autoFocus: !p.renaming, value: draftName, onChange: function (e) { setDraftName(e.target.value); }, onBlur: commitName, onKeyDown: function (e) { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setDraftName(t.name); setRenaming(false); } }, 'aria-label': 'Table name' })
            : h('button', { className: 'ss-insp-name', onClick: function () { setRenaming(true); }, title: 'Rename (F2)' }, t.name),
          h(IconButton, { icon: 'pencil', label: 'Rename (F2)', onClick: function () { setRenaming(true); } }),
          h(IconButton, { icon: 'copy', label: 'Duplicate (⌘D)', onClick: function () { p.onDuplicate && p.onDuplicate(t.name); } }),
          h(IconButton, { icon: 'trash', label: 'Delete (⌫)', onClick: function () { p.onDelete && p.onDelete(t.name); } })),
        tableErr && h('div', { className: 'ss-field-error' }, h(Icon, { name: 'alert', size: 13 }), tableErr),
        h('div', { className: 'ss-insp-meta' }, h('span', null, t.schema || 'public'), '·', h('span', null, t.columns.length + ' columns'), '·', h('span', null, (t.indexes || []).length + ' indexes'), '·', h('span', null, (outgoing.length + incoming.length) + ' relations'))),
      h('div', { className: 'ss-insp-body' },
        h(InspectorSection, { title: 'Columns', count: t.columns.length, onAdd: addCol, addLabel: 'Add column (⌘⏎)' },
          h('div', { className: 'ss-col-head' }, h('span'), h('span', null, 'Name'), h('span', null, 'Type'), h('span', { title: 'Not null' }, 'NN'), h('span', { title: 'Primary key' }, 'PK'), h('span', { title: 'Unique' }, 'UQ')),
          t.columns.map(function (c, i) {
            var selected = sc === i, err = errors[i];
            return h(Fragment, { key: i },
              h('div', { className: cx('ss-colrow', selected && 'is-selected', err && 'is-invalid'), onClick: function () { p.onSelectColumn && p.onSelectColumn(selected ? null : i); } },
                h(Icon, { name: 'grip', size: 14, className: 'ss-colrow-grip' }),
                h('input', {
                  className: cx('ss-cell-input', err && 'is-error'), value: c.name, placeholder: 'column_name', spellCheck: false, 'aria-label': 'Column name', 'aria-invalid': !!err,
                  autoFocus: !!(c.draft && selected && p.autoFocusDraft), onClick: function (e) { e.stopPropagation(); p.onSelectColumn && p.onSelectColumn(i); },
                  onChange: function (e) { setCol(i, assign(c, { name: e.target.value })); }
                }),
                selected
                  ? h('div', { onClick: function (e) { e.stopPropagation(); } }, h(TypeSelect, { value: c.type, size: 'sm', placement: 'top', align: 'end', defaultOpen: p.typeMenuOpen && c.draft, onChange: function (v) { setCol(i, assign(c, { type: v })); } }))
                  : h('span', { className: 'ss-cell-input ss-cell-type', style: { display: 'flex', alignItems: 'center', overflow: 'hidden' } }, c.type),
                h('button', { className: cx('ss-flag', !c.nullable && 'is-on'), title: c.nullable ? 'Nullable — click for NOT NULL' : 'NOT NULL', onClick: function (e) { e.stopPropagation(); if (!c.pk) setCol(i, assign(c, { nullable: !c.nullable })); } }, 'NN'),
                h('button', { className: cx('ss-flag ss-flag--pk', c.pk && 'is-on'), title: 'Primary key', onClick: function (e) { e.stopPropagation(); setCol(i, assign(c, { pk: !c.pk, nullable: c.pk ? c.nullable : false })); } }, 'PK'),
                h('button', { className: cx('ss-flag', c.unique && 'is-on'), title: 'Unique', onClick: function (e) { e.stopPropagation(); setCol(i, assign(c, { unique: !c.unique })); } }, 'UQ')),
              err && h('div', { className: 'ss-colrow-error' }, h('div', { className: 'ss-field-error', role: 'alert' }, h(Icon, { name: 'alert', size: 13 }), err)),
              selected && h(ColumnEditor, { column: c, table: t, tables: p.tables || [], onChange: function (nc) { setCol(i, nc); }, onDelete: function () { delCol(i); } }));
          }),
          h('div', { className: 'ss-insp-add' }, h(Button, { variant: 'ghost', size: 'sm', icon: 'plus', onClick: addCol, kbd: ['⌘', '⏎'] }, 'Add column'))),
        h(InspectorSection, { title: 'Indexes', count: (t.indexes || []).length, onAdd: function () { }, addLabel: 'Add index' },
          (t.indexes || []).map(function (ix) {
            return h('div', { key: ix.name, className: 'ss-insp-item' },
              h(Icon, { name: ix.type === 'PRIMARY KEY' ? 'key' : 'hash', size: 14, style: ix.type === 'PRIMARY KEY' ? { color: 'var(--pk)' } : null }),
              h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, ix.name),
              ix.type !== 'INDEX' ? h(Badge, null, ix.type === 'PRIMARY KEY' ? 'PK' : 'UNIQUE') : h('span'),
              h('span', { className: 'ss-insp-item-sub' }, ix.using + ' (' + ix.columns.join(', ') + ')'));
          }),
          h('div', { className: 'ss-insp-add' }, h(Button, { variant: 'ghost', size: 'sm', icon: 'plus' }, 'Add index'))),
        h(InspectorSection, { title: 'Foreign keys', count: outgoing.length + incoming.length, onAdd: function () { }, addLabel: 'Add foreign key' },
          outgoing.concat(incoming).length === 0 && h('div', { className: 'ss-insp-empty' }, 'No relationships yet.'),
          outgoing.map(function (r) {
            return h('div', { key: 'o' + r.from, className: 'ss-insp-item' }, h(Icon, { name: 'arrow-right', size: 14, style: { color: 'var(--fk)' } }),
              h('span', null, r.from, h('span', { className: 'ss-faint' }, ' → '), r.to), h(Badge, null, r.onDelete || 'RESTRICT'),
              h('span', { className: 'ss-insp-item-sub' }, 'outgoing · ON DELETE ' + (r.onDelete || 'RESTRICT')));
          }),
          incoming.map(function (r) {
            return h('div', { key: 'i' + r.from, className: 'ss-insp-item' }, h(Icon, { name: 'link', size: 14, style: { color: 'var(--fk)' } }),
              h('span', null, r.from, h('span', { className: 'ss-faint' }, ' → '), r.to), h(Badge, null, r.onDelete || 'RESTRICT'),
              h('span', { className: 'ss-insp-item-sub' }, 'incoming · referenced by ' + r.from.split('.')[0]));
          }),
          h('div', { className: 'ss-insp-add' }, h(Button, { variant: 'ghost', size: 'sm', icon: 'plus' }, 'Add foreign key'))),
        h(InspectorSection, { title: 'Table settings', collapsed: p.settingsCollapsed },
          h('div', { className: 'ss-insp-kv' },
            h('label', null, 'Comment'), h('textarea', { className: 'ss-input', rows: 2, value: t.comment || '', placeholder: 'What does a row represent?', onChange: function (e) { p.onChange(assign(t, { comment: e.target.value })); } }),
            h('label', null, 'Schema'), h(Select, { size: 'sm', mono: true, value: t.schema || 'public', options: ['public', 'sales', 'catalog', 'audit'], onChange: function (v) { p.onChange(assign(t, { schema: v })); } }),
            h('label', null, 'Tablespace'), h(Select, { size: 'sm', mono: true, value: 'pg_default', options: ['pg_default', 'fast_ssd'] }),
            h('label', null, 'Fillfactor'), h(Input, { size: 'sm', mono: true, defaultValue: '100' }),
            h('label', null, 'Unlogged'), h(Switch, { checked: false, ariaLabel: 'Unlogged table' })))));
  }

  // ------------------------------------------------------------------ shell pieces
  function Sidebar(p) {
    var schemas = p.schemas || SAMPLE_SCHEMAS.slice(0, 4);
    var nav = [
      { id: 'schemas', icon: 'layers', label: 'Schemas', count: p.empty ? 0 : (p.schemaCount || 6) },
      { id: 'recent', icon: 'clock', label: 'Recent' },
      { id: 'favorites', icon: 'star', label: 'Favorites', count: p.empty ? null : 2 }
    ];
    return h('nav', { className: 'ss-sidebar', 'aria-label': 'Sidebar' },
      h('div', { className: 'ss-sb-brand' }, h(Logo, null), h('span', { className: 'ss-spacer' }), h(IconButton, { icon: 'sidebar', size: 'sm', label: 'Collapse sidebar (⌘B)' })),
      h('button', { className: 'ss-sb-ws', type: 'button' }, h('span', { className: 'ss-sb-ws-mark' }, 'P'), h('span', { style: { flex: 1 } }, p.workspace || 'Personal'), h(Icon, { name: 'chevrons-ud', size: 14, style: { color: 'var(--ink-3)' } })),
      h('div', { className: 'ss-sb-nav' }, nav.map(function (n) {
        return h('button', { key: n.id, type: 'button', className: cx('ss-nav-item', (p.active || 'schemas') === n.id && 'is-active'), onClick: function () { p.onNavigate && p.onNavigate(n.id); } },
          h(Icon, { name: n.icon, size: 16 }), n.label, n.count != null && h('span', { className: 'ss-nav-count' }, n.count));
      })),
      h('div', { className: 'ss-sb-section' }, h('span', { className: 'ss-caption' }, 'Saved schemas'), h(IconButton, { icon: 'plus', size: 'sm', label: 'New schema (⌘N)', onClick: p.onNew })),
      p.empty
        ? h('div', { className: 'ss-sb-list' }, h('div', { className: 'ss-sb-empty' }, 'No schemas yet. Import a .sql file or start from scratch.'))
        : h('div', { className: 'ss-sb-list' }, schemas.map(function (s) {
          return h('button', { key: s.name, type: 'button', className: cx('ss-sb-item', p.activeSchema === s.name && 'is-active'), onClick: function () { p.onSelectSchema && p.onSelectSchema(s.name); } },
            h(Icon, { name: 'database', size: 14 }),
            h('span', { className: 'ss-sb-item-name' }, s.name),
            h('span', { className: 'ss-sb-item-time' }, s.updated.replace(' ago', '').replace(' hours', 'h').replace(' days', 'd').replace(' week', 'w').replace('Yesterday', '1d')),
            h('span', { className: 'ss-sb-item-meta' }, s.engine + ' · ' + s.tables + ' tables'));
        })),
      h('div', { className: 'ss-sb-foot' },
        h('button', { type: 'button', className: 'ss-nav-item' }, h(Icon, { name: 'settings', size: 16 }), 'Settings', h('span', { className: 'ss-nav-count' }, '⌘,')),
        h('button', { type: 'button', className: 'ss-nav-item' }, h(Icon, { name: 'keyboard', size: 16 }), 'Keyboard shortcuts', h('span', { className: 'ss-nav-count' }, '⌘/')),
        h('div', { className: 'ss-sb-user' }, h(Avatar, { initials: p.userInitials || 'LH', name: p.userName || 'Luong Hoang' }),
          h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { className: 'ss-sb-user-name' }, p.userName || 'Luong Hoang'), h('div', { className: 'ss-sb-user-plan' }, 'Local workspace')),
          h(Icon, { name: 'chevrons-ud', size: 14, style: { color: 'var(--ink-3)' } }))));
  }

  function SaveStatus(p) {
    var s = p.state || 'saved';
    if (s === 'dirty') return h('span', { className: 'ss-save is-dirty', role: 'status' }, h('span', { className: 'ss-save-dot' }), p.label || 'Unsaved changes');
    if (s === 'saving') return h('span', { className: 'ss-save', role: 'status' }, 'Saving…');
    return h('span', { className: 'ss-save is-saved', role: 'status' }, h(Icon, { name: 'check', size: 14 }), p.label || 'Saved');
  }

  var WORKSPACE_MODES = [{ value: 'diagram', label: 'Diagram' }, { value: 'data', label: 'Data' }, { value: 'query', label: 'Query' }];

  function Toolbar(p) {
    var zoom = p.zoom || 1;
    var showModes = p.mode !== undefined || !!p.onMode;
    var mode = p.mode || 'diagram';
    return h('header', { className: 'ss-toolbar' },
      h('div', { className: 'ss-tb-crumb' },
        h('span', null, 'Schemas'), h(Icon, { name: 'chevron-right', size: 12 }),
        h('span', { className: 'ss-tb-name' }, p.schema || 'ecommerce', h(Icon, { name: 'chevron-down', size: 12, style: { color: 'var(--ink-3)' } }))),
      h(Badge, { dot: true, title: 'Database engine' }, p.engine || 'PostgreSQL'),
      h(Badge, { tone: 'accent', title: 'Current version' }, p.version || 'v12'),
      showModes && h(SegmentedControl, { options: WORKSPACE_MODES, value: mode, onChange: p.onMode }),
      h(SaveStatus, { state: p.saveState }),
      p.saveState === 'dirty' && h(Button, { size: 'sm', kbd: ['⌘', 'S'], onClick: p.onSave }, 'Save'),
      h('span', { className: 'ss-spacer' }),
      h('div', { className: 'ss-tb-group' },
        h(IconButton, { icon: 'undo', label: 'Undo (⌘Z)', disabled: p.canUndo === false, onClick: p.onUndo }),
        h(IconButton, { icon: 'redo', label: 'Redo (⇧⌘Z)', disabled: p.canRedo === false, onClick: p.onRedo })),
      mode === 'diagram' && h('span', { className: 'ss-tb-sep' }),
      mode === 'diagram' && h('div', { className: 'ss-tb-group' },
        h(IconButton, { icon: 'zoom-out', label: 'Zoom out (⌘−)', onClick: function () { p.onZoom && p.onZoom(Math.max(0.25, Math.round((zoom - 0.1) * 100) / 100)); } }),
        h('button', { className: 'ss-tb-zoom', title: 'Reset zoom (⌘0)', onClick: function () { p.onZoom && p.onZoom(1); } }, Math.round(zoom * 100) + '%'),
        h(IconButton, { icon: 'zoom-in', label: 'Zoom in (⌘+)', onClick: function () { p.onZoom && p.onZoom(Math.min(2, Math.round((zoom + 0.1) * 100) / 100)); } }),
        h(IconButton, { icon: 'fit', label: 'Fit to screen (⇧1)', onClick: p.onFit })),
      h('span', { className: 'ss-tb-sep' }),
      h('div', { className: 'ss-tb-search' }, h(Input, { icon: 'search', placeholder: 'Search tables…', size: 'sm', suffix: h(Kbd, { keys: ['⌘', 'K'] }), value: p.search, onChange: p.onSearch ? function (e) { p.onSearch(e.target.value); } : undefined, readOnly: !p.onSearch })),
      h(IconButton, { icon: 'history', label: 'Version history (⌘H)', onClick: p.onHistory }),
      h(Button, { icon: 'share', onClick: p.onShare }, 'Share'),
      h(Button, { variant: 'primary', icon: 'download', onClick: p.onExport }, 'Export'));
  }

  function StatusBar(p) {
    return h('footer', { className: 'ss-status' },
      (p.left || []).map(function (x, i) { return h('span', { key: 'l' + i, className: 'ss-status-item' }, x); }),
      h('span', { className: 'ss-spacer' }),
      (p.right || []).map(function (x, i) { return h('span', { key: 'r' + i, className: 'ss-status-item' }, x); }));
  }

  function AppShell(p) {
    return h('div', { className: 'ss-app ss-root', style: p.style },
      p.sidebar !== false && (p.sidebar || h(Sidebar, { activeSchema: 'ecommerce' })),
      h('div', { className: 'ss-main' }, p.children),
      p.overlay);
  }

  // ------------------------------------------------------------------ feedback
  function Toast(p) {
    var tone = p.tone || 'success';
    var icon = tone === 'success' ? 'check-circle' : tone === 'error' ? 'alert' : 'info';
    return h('div', { className: cx('ss-toast', 'ss-toast--' + tone), role: 'status' },
      h(Icon, { name: icon, size: 16 }),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', { className: 'ss-toast-title' }, p.title),
        p.description && h('div', { className: 'ss-toast-desc' }, p.description),
        p.actions && h('div', { className: 'ss-toast-actions' }, p.actions.map(function (a, i) { return h('a', { key: i, onClick: a.onClick }, a.label); }))),
      p.onClose !== false && h(IconButton, { icon: 'x', size: 'sm', label: 'Dismiss', onClick: p.onClose }));
  }

  function Alert(p) {
    var tone = p.tone || 'info';
    var icon = tone === 'success' ? 'check-circle' : tone === 'error' ? 'alert' : tone === 'warn' ? 'warning' : 'info';
    return h('div', { className: cx('ss-alert', 'ss-alert--' + tone), role: tone === 'error' ? 'alert' : 'status', style: p.style },
      h(Icon, { name: icon, size: 16, style: { marginTop: 1 } }),
      h('div', { className: 'ss-alert-body', style: { flex: 1 } }, p.title && h('div', { className: 'ss-alert-title' }, p.title), p.children),
      p.action);
  }

  // ------------------------------------------------------------------ modal
  function Modal(p) {
    useEffect(function () {
      if (!p.onClose) return;
      function k(e) { if (e.key === 'Escape') p.onClose(); }
      window.addEventListener('keydown', k); return function () { window.removeEventListener('keydown', k); };
    }, [p.onClose]);
    return h('div', { className: 'ss-overlay', onPointerDown: function (e) { if (e.target === e.currentTarget && p.onClose) p.onClose(); } },
      h('div', { className: 'ss-modal', role: 'dialog', 'aria-modal': true, 'aria-label': p.title, style: { width: p.width || 640 } },
        h('div', { className: 'ss-modal-head' },
          p.icon && h('div', { className: 'ss-drop-icon', style: assign({ margin: 0, width: 28, height: 28 }, p.iconStyle) }, h(Icon, { name: p.icon, size: 16 })),
          h('div', { style: { flex: 1 } }, h('div', { className: 'ss-modal-title' }, p.title), p.subtitle && h('div', { className: 'ss-modal-sub' }, p.subtitle)),
          p.headerAside,
          p.onClose && h(IconButton, { icon: 'x', size: 'sm', label: 'Close (Esc)', onClick: p.onClose })),
        h('div', { className: 'ss-modal-body', style: p.bodyStyle }, p.children),
        (p.footer || p.footerStart) && h('div', { className: 'ss-modal-foot' }, p.footerStart, h('span', { className: 'ss-spacer' }), p.footer)));
  }

  function ConfirmDialog(p) {
    return h(Modal, {
      title: p.title, width: p.width || 440, onClose: p.onCancel, icon: p.danger ? 'trash' : 'info',
      iconStyle: p.danger ? { background: 'var(--removed-subtle)', color: 'var(--removed)' } : null,
      footer: h(Fragment, null, h(Button, { onClick: p.onCancel, kbd: 'Esc' }, p.cancelLabel || 'Cancel'), h(Button, { variant: p.danger ? 'danger' : 'primary', onClick: p.onConfirm, kbd: ['⌘', '⏎'] }, p.confirmLabel || 'Confirm'))
    }, p.children);
  }

  function DropZone(p) {
    var _o = useState(false), over = _o[0], setOver = _o[1];
    var inputRef = useRef(null);
    // `onFile` gets `{name, meta, raw}`; `raw` is the File itself, for a host that reads it.
    function pick(f) { if (f && p.onFile) p.onFile({ name: f.name, meta: Math.max(1, Math.round(f.size / 1024)) + ' KB', raw: f }); }
    var input = h('input', { ref: inputRef, type: 'file', accept: p.accept || '.sql,.ddl,.txt', hidden: true, onChange: function (e) { pick(e.target.files[0]); e.target.value = ''; } });
    if (p.file) {
      return h('div', { className: 'ss-file' },
        h('span', { className: 'ss-file-icon' }, h(Icon, { name: p.fileIcon || 'file-code', size: 16 })),
        h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { className: 'ss-file-name' }, p.file.name), h('div', { className: 'ss-file-meta' }, p.file.meta || p.file.size)),
        h(Button, { variant: 'ghost', size: 'sm', onClick: function () { inputRef.current && inputRef.current.click(); } }, 'Replace'),
        h(IconButton, { icon: 'x', size: 'sm', label: 'Remove file', onClick: function () { p.onFile && p.onFile(null); } }),
        input);
    }
    return h('div', {
      className: cx('ss-drop', (over || p.over) && 'is-over'), role: 'button', tabIndex: 0, style: p.style,
      onDragOver: function (e) { e.preventDefault(); setOver(true); }, onDragLeave: function () { setOver(false); },
      onDrop: function (e) { e.preventDefault(); setOver(false); pick(e.dataTransfer.files && e.dataTransfer.files[0]); },
      onClick: function () { inputRef.current && inputRef.current.click(); }
    },
      h('span', { className: 'ss-drop-icon' }, h(Icon, { name: 'upload', size: 16 })),
      h('div', { className: 'ss-drop-title' }, 'Drop ' + (p.noun || 'SQL') + ' file here or ', h('u', null, 'click to browse')),
      h('div', { className: 'ss-drop-sub' }, p.hint || '.sql or .ddl · up to 10 MB · pg_dump --schema-only output works'),
      input);
  }

  function SqlEditor(p) {
    var _v = useState(p.defaultValue != null ? p.defaultValue : (p.value || '')), inner = _v[0], setInner = _v[1];
    var value = p.value != null && p.onChange ? p.value : inner;
    var json = p.language === 'json', plain = p.language === 'text';
    var lines = value.split('\n');
    var maxLen = lines.reduce(function (m, l) { return Math.max(m, l.length); }, 0);
    return h('div', { className: cx('ss-editor', p.errorLine && 'is-error'), style: assign({ height: p.height || 220 }, p.style) },
      h('div', { className: 'ss-editor-inner' },
        h('div', { className: 'ss-editor-gutter' }, lines.map(function (_, i) { var n = i + (p.firstLine || 1); return h('div', { key: i, className: n === p.errorLine ? 'is-error' : null }, n); })),
        h('div', { className: 'ss-editor-code', style: { minWidth: (maxLen + 4) + 'ch' } },
          p.errorLine && h('div', { className: 'ss-editor-errline', style: { top: 8 + (p.errorLine - (p.firstLine || 1)) * 18 } }),
          h('pre', { dangerouslySetInnerHTML: { __html: (json ? highlightJson : plain ? esc : highlightSql)(value) + '\n' } }),
          h('textarea', { value: value, spellCheck: false, 'aria-label': p.label || (json ? 'JSON' : plain ? 'Text' : 'SQL'), placeholder: p.placeholder, readOnly: p.readOnly, onChange: function (e) { if (p.onChange) p.onChange(e.target.value); else setInner(e.target.value); } }))));
  }

  function ParseStatus(p) {
    var s = p.state || 'idle';
    if (s === 'ok') return h('div', { className: 'ss-parse is-ok', role: 'status' }, h(Icon, { name: 'check-circle', size: 16 }), h('span', null, 'Parsed'), h('span', { className: 'ss-parse-sum' }, p.summary || '24 tables · 31 relationships · 18 indexes'), p.aside);
    if (s === 'error') return h('div', { className: 'ss-parse is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 16 }), h('span', null, p.message || 'Unable to parse SQL near line 42.'), p.onJump && h('a', { onClick: p.onJump }, 'Go to line'));
    if (s === 'parsing') return h('div', { className: 'ss-parse', role: 'status' }, h(Icon, { name: 'clock', size: 16 }), 'Parsing…');
    return h('div', { className: 'ss-parse' }, h(Icon, { name: 'info', size: 16, style: { color: 'var(--ink-3)' } }), p.message || 'Paste DDL or drop a file — we parse it locally before importing.');
  }

  // ------------------------------------------------------------------ dialogs
  var PASTE_SQL = [
    'CREATE TABLE products (',
    '  id          BIGSERIAL PRIMARY KEY,',
    '  name        VARCHAR(255) NOT NULL,',
    '  sku         VARCHAR(100) NOT NULL UNIQUE,',
    '  price       DECIMAL(12,2) NOT NULL',
    ');',
    '',
    'CREATE TABLE order_items (',
    '  id          BIGSERIAL PRIMARY KEY,',
    '  order_id    BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,',
    '  product_id  BIGINT NOT NULL REFERENCES products(id),',
    '  quantity    INTEGER NOT NULL DEFAULT 1,',
    '  price       DECIMAL(12,2) NOT NULL',
    ');'
  ].join('\n');
  var BAD_SQL = [
    'CREATE TABLE order_items (',
    '  id          BIGSERIAL PRIMARY KEY,',
    '  order_id    BIGINT NOT NULL REFERENCES orders(id),',
    '  product_id  BIGINT NOT NULL REFERENCES products(id)',
    '  quantity    INTEGER NOT NULL DEFAULT 1,',
    '  price       DECIMAL(12,2) NOT NULL'
  ].join('\n');

  function ImportSchemaDialog(p) {
    var _m = useState(p.mode || 'file'), mode = _m[0], setMode = _m[1];
    var _e = useState(p.engine || 'PostgreSQL'), engine = _e[0], setEngine = _e[1];
    var _f = useState(p.file === undefined ? null : p.file), file = _f[0], setFile = _f[1];
    var _s = useState(p.sql != null ? p.sql : (p.mode === 'paste' ? PASTE_SQL : '')), sql = _s[0], setSql = _s[1];
    var _n = useState(p.name || 'ecommerce_v2'), name = _n[0], setName = _n[1];
    var initialSql = useRef(sql).current;
    var state = p.state || ((file || sql.trim()) ? 'ok' : 'idle');
    function count(re) { return (sql.match(re) || []).length; }
    function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : (w === 'index' ? 'es' : w === 'relationship' ? 's' : 's')); }
    var summary = file && !sql.trim() ? '24 tables · 31 relationships · 18 indexes'
      : (sql === initialSql && p.summary) ? p.summary
        : plural(count(/CREATE\s+TABLE/gi), 'table') + ' · ' + plural(count(/REFERENCES/gi), 'relationship') + ' · ' + plural(count(/PRIMARY KEY|UNIQUE|CREATE\s+INDEX/gi), 'index');
    return h(Modal, {
      title: 'Import Schema', subtitle: 'Bring in existing DDL. Nothing is written until you confirm.', width: 680, onClose: p.onClose,
      footerStart: state === 'ok' ? h(ParseStatus, { state: 'ok', summary: summary }) : state === 'error' ? h(ParseStatus, { state: 'error', message: p.error || 'Unable to parse SQL near line 42.', onJump: function () { } }) : h('span', { className: 'ss-modal-foot-hint' }, h(Kbd, { keys: ['⌘', '⏎'] }), 'to import'),
      footer: h(Fragment, null, h(Button, { onClick: p.onClose }, 'Cancel'), h(Button, { variant: 'primary', disabled: state !== 'ok', icon: 'download', onClick: function () { p.onImport && p.onImport({ name: name, engine: engine, mode: mode }); } }, 'Import Schema'))
    },
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 180px', gap: 12 } },
        h(Field, { label: 'Schema name' }, h(Input, { mono: true, value: name, onChange: function (e) { setName(e.target.value); } })),
        h(Field, { label: 'Dialect' }, h(Select, { value: engine, onChange: setEngine, options: ['PostgreSQL', 'MySQL', 'SQLite', 'ClickHouse', 'SQL Server'] }))),
      h(SegmentedControl, { block: true, value: mode, onChange: setMode, options: [{ value: 'file', label: 'Upload SQL file', icon: 'upload' }, { value: 'paste', label: 'Paste SQL', icon: 'clipboard' }, { value: 'connect', label: 'Connect to database', icon: 'plug', badge: 'Soon', disabled: true }] }),
      mode === 'file' && h(Fragment, null,
        h(DropZone, { file: file, onFile: setFile }),
        h('div', { className: 'ss-or' }, 'or'),
        h('div', null, h('div', { className: 'ss-field-label', style: { marginBottom: 6 } }, h('span', null, 'Paste SQL'), h('span', { className: 'ss-faint', style: { fontWeight: 400 } }, 'CREATE TABLE, ALTER TABLE, CREATE INDEX')),
          h(SqlEditor, { value: sql, onChange: setSql, height: p.pasteHeight || 132, placeholder: '-- paste DDL here' }))),
      mode === 'paste' && h(Fragment, null,
        h(SqlEditor, { value: sql, onChange: setSql, height: 280, errorLine: state === 'error' ? (p.errorLine || 42) : null, firstLine: p.firstLine }),
        state === 'error' && h(Alert, { tone: 'error', title: p.error || 'Unable to parse SQL near line 42.' }, 'Expected ', h('code', null, ','), ' or ', h('code', null, ')'), ' after column definition ', h('code', null, 'product_id'), '. Fix the statement or remove it to import the rest.')),
      state === 'ok' && mode === 'file' && file && h(Alert, { tone: 'success', title: 'Ready to import' }, h('code', null, '24 tables · 31 relationships · 18 indexes'), ' · 2 warnings: ', h('code', null, 'legacy_orders'), ' has no primary key; ', h('code', null, 'audit_log'), ' uses an unsupported partition clause and will import without it.'));
  }

  var EXPORT_PREVIEW = [
    '-- ecommerce · v12 · PostgreSQL 16',
    '-- generated by Schema Studio 2026-10-06 10:27',
    '',
    'CREATE TABLE users (',
    '  id          BIGSERIAL PRIMARY KEY,',
    '  email       VARCHAR(255) NOT NULL,',
    '  name        VARCHAR(255),',
    '  avatar_url  TEXT,',
    '  created_at  TIMESTAMP NOT NULL DEFAULT now()',
    ');',
    "COMMENT ON TABLE users IS 'Registered customers.';",
    '',
    'CREATE UNIQUE INDEX users_email_unique',
    '  ON users (email);',
    '',
    'ALTER TABLE orders',
    '  ADD CONSTRAINT orders_user_id_fkey',
    '  FOREIGN KEY (user_id) REFERENCES users (id)',
    '  ON DELETE CASCADE;'
  ].join('\n');
  var MIGRATION_PREVIEW = [
    '-- migration v11 → v12 · PostgreSQL 16',
    'BEGIN;',
    '',
    'ALTER TABLE users ADD COLUMN avatar_url TEXT;',
    'ALTER TABLE products',
    '  ADD COLUMN sku VARCHAR(100) NOT NULL;',
    'ALTER TABLE orders',
    '  ALTER COLUMN total TYPE DECIMAL(12,2);',
    '',
    'CREATE TABLE order_items (',
    '  id          BIGSERIAL PRIMARY KEY,',
    '  order_id    BIGINT NOT NULL REFERENCES orders(id),',
    '  product_id  BIGINT NOT NULL REFERENCES products(id),',
    '  quantity    INTEGER NOT NULL DEFAULT 1,',
    '  price       DECIMAL(12,2) NOT NULL',
    ');',
    '',
    'DROP TABLE legacy_orders;',
    'COMMIT;'
  ].join('\n');
  var JSON_PREVIEW = [
    '{',
    '  "schema": "ecommerce",',
    '  "version": 12,',
    '  "dialect": "postgresql",',
    '  "tables": [',
    '    {',
    '      "name": "users",',
    '      "columns": [',
    '        { "name": "id", "type": "BIGSERIAL", "pk": true },',
    '        { "name": "email", "type": "VARCHAR(255)", "unique": true },',
    '        { "name": "name", "type": "VARCHAR(255)", "nullable": true }',
    '      ],',
    '      "indexes": ["users_email_unique", "users_created_at_idx"]',
    '    },',
    '    …',
    '  ]',
    '}'
  ].join('\n');

  function ExportDialog(p) {
    var _f = useState(p.format || 'sql'), fmt = _f[0], setFmt = _f[1];
    var _d = useState('PostgreSQL 16'), db = _d[0], setDb = _d[1];
    var _o = useState({ indexes: true, fks: true, comments: true, drop: false }), opt = _o[0], setOpt = _o[1];
    var _m = useState(!!p.migration), mig = _m[0], setMig = _m[1];
    function tog(k) { return function (v) { var n = assign(opt); n[k] = v; setOpt(n); }; }
    var preview = mig ? MIGRATION_PREVIEW : fmt === 'json' ? JSON_PREVIEW : EXPORT_PREVIEW;
    var fname = 'ecommerce_' + (mig ? 'v11_to_v12' : 'v12') + (fmt === 'json' && !mig ? '.json' : '.sql');
    return h(Modal, {
      title: 'Export Schema', subtitle: 'ecommerce · v12 · 24 tables', width: 860, onClose: p.onClose, bodyStyle: { padding: 0 },
      footerStart: h('span', { className: 'ss-modal-foot-hint' }, h(Icon, { name: 'file-code', size: 14 }), h('span', { className: 'ss-mono' }, fname), '· 14.2 KB'),
      footer: h(Fragment, null, h(Button, { icon: 'copy' }, 'Copy'), h(Button, { onClick: p.onClose }, 'Cancel'), h(Button, { variant: 'primary', icon: 'download', kbd: ['⌘', '⏎'], onClick: p.onExport }, 'Export'))
    },
      h('div', { style: { display: 'grid', gridTemplateColumns: '300px 1fr', minHeight: 420 } },
        h('div', { style: { padding: 16, display: 'flex', flexDirection: 'column', gap: 16, borderRight: '1px solid var(--line-1)' } },
          h('div', null, h('div', { className: 'ss-caption', style: { marginBottom: 8 } }, 'Format'),
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
              h(Radio, { name: 'fmt', label: 'SQL', description: 'DDL statements for the target database', checked: fmt === 'sql', onChange: function () { setFmt('sql'); } }),
              h(Radio, { name: 'fmt', label: 'JSON', description: 'Schema Studio model, for tooling and CI', checked: fmt === 'json', onChange: function () { setFmt('json'); setMig(false); } }))),
          h(Field, { label: 'Database' }, h(Select, { value: db, onChange: setDb, options: ['PostgreSQL 16', 'PostgreSQL 13', 'MySQL 8.0', 'SQLite 3'], disabled: fmt === 'json' })),
          h('div', null, h('div', { className: 'ss-caption', style: { marginBottom: 8 } }, 'Options'),
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
              h(Checkbox, { label: 'Include indexes', checked: opt.indexes, onChange: tog('indexes') }),
              h(Checkbox, { label: 'Include foreign keys', checked: opt.fks, onChange: tog('fks') }),
              h(Checkbox, { label: 'Include comments', checked: opt.comments, onChange: tog('comments') }),
              h(Checkbox, { label: 'Add DROP … IF EXISTS', checked: opt.drop, onChange: tog('drop') }))),
          h('div', { style: { borderTop: '1px solid var(--line-1)', paddingTop: 14 } },
            h(Checkbox, { label: 'Generate migration from previous version', description: 'ALTER statements from v11 to v12 instead of full DDL', checked: mig, disabled: fmt === 'json', onChange: setMig }),
            mig && h('div', { className: 'ss-row', style: { marginTop: 10, paddingLeft: 22 } }, h(Select, { size: 'sm', mono: true, value: 'v11', options: ['v11', 'v10', 'v9', 'v8'], style: { width: 72 } }), h(Icon, { name: 'arrow-right', size: 14, style: { color: 'var(--ink-3)' } }), h(Badge, { tone: 'accent' }, 'v12')))),
        h('div', { style: { padding: 16, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, background: 'var(--bg-2)' } },
          h('div', { className: 'ss-row' }, h('span', { className: 'ss-caption' }, 'Preview'), h('span', { className: 'ss-spacer' }), mig ? h(Badge, { tone: 'modified', sans: true }, '9 changes') : h('span', { className: 'ss-faint', style: { fontSize: 12 } }, '312 lines')),
          h(SqlEditor, { value: preview, readOnly: true, height: 372, onChange: function () { } }))));
  }

  // ------------------------------------------------------------------ data table / versions / diff
  function DataTable(p) {
    var sort = p.sort || {};
    return h('table', { className: 'ss-table' },
      h('thead', null, h('tr', null, p.columns.map(function (c) {
        var sorted = sort.key === c.key;
        return h('th', {
          key: c.key, style: { width: c.width, textAlign: c.align }, className: cx(c.sortable !== false && 'is-sortable', sorted && 'is-sorted'),
          'aria-sort': sorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined,
          onClick: c.sortable !== false && p.onSort ? function () { p.onSort({ key: c.key, dir: sorted && sort.dir === 'asc' ? 'desc' : 'asc' }); } : undefined
        }, h('span', { className: 'ss-th' }, c.label, sorted && h(Icon, { name: sort.dir === 'asc' ? 'arrow-up' : 'arrow-down', size: 12 })));
      }))),
      h('tbody', null, p.rows.map(function (r, i) {
        var k = p.rowKey ? r[p.rowKey] : i;
        return h('tr', { key: k, className: cx(p.selectedKey === k && 'is-selected'), onClick: function () { p.onRowClick && p.onRowClick(r); } },
          p.columns.map(function (c) { return h('td', { key: c.key, className: c.numeric ? 'is-num' : null, style: { textAlign: c.align } }, c.render ? c.render(r) : r[c.key]); }));
      })));
  }

  // ------------------------------------------------------------------ records: table list and data grid
  function TableList(p) {
    var _q = useState(''), own = _q[0], setOwn = _q[1];
    var q = p.search !== undefined ? p.search : own;
    var all = p.tables || [], counts = p.counts || {};
    var needle = q.trim().toLowerCase();
    var shown = needle ? all.filter(function (t) { return t.name.toLowerCase().indexOf(needle) >= 0; }) : all;
    var total = all.reduce(function (n, t) { return n + (counts[t.name] || 0); }, 0);
    function search(v) { setOwn(v); p.onSearch && p.onSearch(v); }
    return h('aside', { className: 'ss-tablelist', 'aria-label': 'Tables' },
      h('div', { className: 'ss-tl-head' }, h('span', { className: 'ss-caption' }, 'Tables'), h('span', { className: 'ss-tl-count' }, all.length)),
      h('div', { className: 'ss-tl-search' }, h(Input, { icon: 'search', size: 'sm', placeholder: 'Search tables…', 'aria-label': 'Search tables', value: q, onChange: function (e) { search(e.target.value); } })),
      h('div', { className: 'ss-tl-list', role: 'listbox', 'aria-label': 'Tables' }, shown.length
        ? shown.map(function (t) {
          var on = p.selected === t.name;
          return h('button', { key: t.name, type: 'button', role: 'option', 'aria-selected': on, className: cx('ss-tl-item', on && 'is-active'), onClick: function () { p.onSelect && p.onSelect(t.name); } },
            h(Icon, { name: 'table', size: 14 }),
            h('span', { className: 'ss-tl-name' }, t.name),
            counts[t.name] != null && h('span', { className: 'ss-tl-rows', title: counts[t.name].toLocaleString('en-US') + (counts[t.name] === 1 ? ' row' : ' rows') }, counts[t.name].toLocaleString('en-US')));
        })
        : h('div', { className: 'ss-tl-none' }, 'No tables match "' + q.trim() + '".')),
      h('div', { className: 'ss-tl-foot' }, all.length + (all.length === 1 ? ' table' : ' tables') + ' · ' + total.toLocaleString('en-US') + (total === 1 ? ' row' : ' rows')));
  }

  // What a column holds decides how its cells are set: numbers right-aligned, moments as YYYY-MM-DD HH:mm:ss.
  function cellKind(type) {
    var t = String(type || '').toUpperCase();
    if (/^(BIG|SMALL|MEDIUM|TINY)?(INT|INTEGER|SERIAL)\d?\b|^(DECIMAL|NUMERIC|REAL|DOUBLE|FLOAT|MONEY)/.test(t)) return 'number';
    if (/^BOOL/.test(t)) return 'boolean';
    if (/^(TIMESTAMP|DATETIME|DATE|TIME)(TZ)?\b/.test(t)) return 'time';
    return 'text';
  }
  function gridCell(value, c, kind) {
    if (value == null) return h('span', { className: 'ss-null' }, 'NULL');
    if (kind === 'number') {
      var scale = /\(\s*\d+\s*,\s*(\d+)\s*\)/.exec(c.type);
      return scale && typeof value === 'number' ? value.toFixed(Number(scale[1])) : String(value);
    }
    if (kind === 'boolean') return value === true || value === 1 || value === 't' || value === 'true' ? 'true' : 'false';
    if (kind === 'time') return (value instanceof Date ? value.toISOString() : String(value)).replace(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}).*$/, '$1 $2');
    return String(value);
  }
  // The menu of a row. `onRowAction(action, row)` gets the action; the same keys run it from the grid.
  var ROW_ACTIONS = [
    { action: 'view', icon: 'eye', label: 'View', shortcut: '⏎' },
    { action: 'edit', icon: 'pencil', label: 'Edit record', shortcut: 'F2' },
    { action: 'duplicate', icon: 'copy', label: 'Duplicate', shortcut: '⌘D' },
    { action: 'copy', icon: 'code', label: 'Copy as JSON', shortcut: '⇧⌘C' },
    '-',
    { action: 'delete', icon: 'trash', label: 'Delete', shortcut: '⌫', danger: true }
  ];
  var GRID_WIDTH = { number: 112, boolean: 96, time: 176, text: 220 };
  var SKELETON_WIDTH = [58, 82, 46, 70, 54, 76];

  function DataGrid(p) {
    var cols = p.columns || [], rows = p.rows || [], selected = p.selected || [], modified = p.modified || [], active = p.activeCell || null;
    var kinds = cols.map(function (c) { return cellKind(c.type); });
    // A column is as wide as its kind asks, and never narrower than its header: glyphs, name, type and the sort arrow.
    var widths = cols.map(function (c, i) {
      var head = Math.ceil(c.name.length * 7.3 + c.type.length * 6.7 + 6 + ((c.pk ? 1 : 0) + (c.fk ? 1 : 0) + (p.sort && p.sort.column === c.name ? 1 : 0)) * 18 + 26);
      return c.width || Math.max(GRID_WIDTH[kinds[i]], head);
    });
    var width = 56 + widths.reduce(function (a, b) { return a + b; }, 0);
    var ref = useRef(null);
    var allOn = rows.length > 0 && selected.length === rows.length;
    var selectable = p.selectable !== false;
    var _m = useState(null), menu = _m[0], setMenu = _m[1];
    // The row menu closes on a press outside it, on Esc, on scroll and when the window changes size.
    useEffect(function () {
      if (!menu) return;
      var el = ref.current;
      function close() { setMenu(null); }
      function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
      window.addEventListener('pointerdown', close); window.addEventListener('keydown', key, true); window.addEventListener('resize', close);
      if (el) el.addEventListener('scroll', close);
      return function () {
        window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', key, true); window.removeEventListener('resize', close);
        if (el) el.removeEventListener('scroll', close);
      };
    }, [menu]);

    function isModified(r, name) { return modified.some(function (m) { return m.row === r && m.column === name; }); }
    function badAt(r, name) { return (p.invalid || []).find(function (m) { return m.row === r && m.column === name; }); }
    function toggle(r) {
      var next = selected.indexOf(r) >= 0 ? selected.filter(function (x) { return x !== r; }) : selected.concat([r]).sort(function (a, b) { return a - b; });
      p.onSelect && p.onSelect(next);
    }
    function activate(r, name) { p.onActiveCell && p.onActiveCell({ row: r, column: name }); }
    function openMenu(e, r, name) {
      if (!p.onRowAction) return;
      e.preventDefault();
      if (name) activate(r, name);
      setMenu({ row: r, x: Math.max(8, Math.min(e.clientX, window.innerWidth - 236)), y: Math.max(8, Math.min(e.clientY, window.innerHeight - 208)) });
    }
    function onKey(e) {
      if (!rows.length || !cols.length || e.target.tagName === 'INPUT' || e.target.closest('.ss-grid-menu')) return;
      var r = active ? active.row : 0, c = active ? cols.findIndex(function (x) { return x.name === active.column; }) : 0;
      if (c < 0) c = 0;
      var mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
      var d = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] }[e.key];
      if (d) {
        e.preventDefault();
        if (active) { r = Math.max(0, Math.min(rows.length - 1, r + d[0])); c = Math.max(0, Math.min(cols.length - 1, c + d[1])); }
        activate(r, cols[c].name);
      } else if (active && e.key === 'Enter') { e.preventDefault(); p.onOpenRow && p.onOpenRow(r); }
      else if (active && e.key === ' ') { e.preventDefault(); toggle(r); }
      else if (e.key === 'Escape' && selected.length) { e.preventDefault(); p.onSelect && p.onSelect([]); }
      else if (active && p.onRowAction) {
        var action = e.key === 'F2' ? 'edit' : mod && !e.shiftKey && k === 'd' ? 'duplicate' : mod && e.shiftKey && k === 'c' ? 'copy' : e.key === 'Backspace' || e.key === 'Delete' ? 'delete' : null;
        if (action) { e.preventDefault(); p.onRowAction(action, r); }
      }
    }
    useEffect(function () {
      var el = ref.current && ref.current.querySelector('td.is-active');
      if (el && ref.current.contains(document.activeElement)) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [active && active.row, active && active.column]);

    function head(c, i) {
      var sorted = !!p.sort && p.sort.column === c.name;
      return h('th', {
        key: c.name, scope: 'col', className: cx(kinds[i] === 'number' && 'is-num', i === 0 && 'is-first'), title: c.name + ' ' + c.type,
        'aria-sort': sorted ? (p.sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
      },
        h('span', { className: 'ss-grid-hc' },
          c.pk && h(Icon, { name: 'key', size: 12, className: 'ss-grid-key is-pk', label: 'Primary key' }),
          c.fk && h(Icon, { name: 'link', size: 12, className: 'ss-grid-key is-fk', label: 'Foreign key' }),
          h('span', { className: 'ss-grid-name' }, c.name),
          h('span', { className: 'ss-grid-type' }, c.type),
          sorted && h(Icon, { name: p.sort.dir === 'asc' ? 'arrow-up' : 'arrow-down', size: 12, className: 'ss-grid-sort', label: p.sort.dir === 'asc' ? 'Sorted ascending' : 'Sorted descending' })));
    }
    function body() {
      if (p.loading) {
        return Array.from({ length: 12 }, function (_, r) {
          return h('tr', { key: r, 'aria-hidden': true },
            h('td', { className: 'ss-grid-gutter' }),
            cols.map(function (c, i) {
              return h('td', { key: c.name, className: cx(kinds[i] === 'number' && 'is-num', i === 0 && 'is-first') },
                h('span', { className: 'ss-grid-skel', style: { width: SKELETON_WIDTH[(r + i * 2) % SKELETON_WIDTH.length] + '%' } }));
            }));
        });
      }
      return rows.map(function (row, r) {
        var on = selected.indexOf(r) >= 0;
        return h('tr', { key: r, className: cx(on && 'is-selected'), 'aria-selected': on, 'aria-rowindex': r + 2, onDoubleClick: function () { p.onOpenRow && p.onOpenRow(r); } },
          h('td', { className: 'ss-grid-gutter', onContextMenu: function (e) { openMenu(e, r); } },
            h('span', { className: 'ss-grid-n' }, r + 1),
            selectable && h('label', { className: 'ss-check' },
              h('input', { type: 'checkbox', checked: on, 'aria-label': 'Select row ' + (r + 1), onChange: function () { toggle(r); } }),
              h('span', { className: 'ss-check-box' }, on && h(Icon, { name: 'check', size: 11, strokeWidth: 3 })))),
          cols.map(function (c, i) {
            var v = row[c.name], text = v == null ? null : gridCell(v, c, kinds[i]);
            var isActive = !!active && active.row === r && active.column === c.name, bad = badAt(r, c.name);
            var shown = v == null ? gridCell(v, c, kinds[i]) : text;
            return h('td', {
              key: c.name, role: 'gridcell', title: bad ? (bad.message || 'Invalid value.') + (text != null ? ' ' + text : '') : text != null && kinds[i] === 'text' ? text : undefined, 'aria-invalid': bad ? true : undefined,
              className: cx(kinds[i] === 'number' && 'is-num', kinds[i] === 'time' && 'is-time', kinds[i] === 'boolean' && 'is-bool', i === 0 && 'is-first', isActive && 'is-active', isModified(r, c.name) && 'is-modified', bad && 'is-invalid'),
              onClick: function () { activate(r, c.name); if (p.openOnClick && p.onOpenRow) p.onOpenRow(r); }, onContextMenu: function (e) { openMenu(e, r, c.name); }
            }, bad ? h('span', { className: 'ss-grid-bad' }, h('span', { className: 'ss-grid-bad-v' }, shown), h(Icon, { name: 'alert', size: 12, label: bad.message || 'Invalid value' })) : shown);
          }));
      });
    }

    var grid = h('div', { ref: ref, className: cx('ss-grid', p.density === 'compact' && 'ss-grid--compact', !selectable && 'ss-grid--plain'), role: 'grid', tabIndex: 0, 'aria-label': p.label || 'Records', 'aria-busy': p.loading || undefined, 'aria-rowcount': rows.length + 1, 'aria-colcount': cols.length + 1, onKeyDown: onKey },
      h('table', { className: 'ss-grid-table', style: { width: width } },
        h('colgroup', null, h('col', { style: { width: 56 } }), cols.map(function (c, i) { return h('col', { key: c.name, style: { width: widths[i] } }); })),
        h('thead', null, h('tr', null,
          h('th', { className: 'ss-grid-gutter', scope: 'col' }, selectable && h('label', { className: 'ss-check' },
            h('input', { type: 'checkbox', checked: allOn, disabled: !rows.length || !!p.loading, 'aria-label': 'Select all rows', onChange: function () { p.onSelect && p.onSelect(allOn ? [] : rows.map(function (_, r) { return r; })); } }),
            h('span', { className: 'ss-check-box' }, allOn && h(Icon, { name: 'check', size: 11, strokeWidth: 3 })))),
          cols.map(head))),
        h('tbody', null, body())),
      p.empty && !p.loading && h('div', { className: 'ss-grid-empty' },
        p.empty === true
          ? h(Fragment, null, h('div', { className: 'ss-grid-empty-title' }, 'This table has no rows.'), h('div', null, 'Add a record, or use Import Records to fill this table.'))
          : p.empty));
    if (!menu) return grid;
    var items = ROW_ACTIONS.map(function (a) {
      return a === '-' ? a : { icon: a.icon, label: a.label, shortcut: a.shortcut, danger: a.danger, onSelect: function () { p.onRowAction(a.action, menu.row); } };
    });
    return h(Fragment, null, grid,
      h('div', { className: 'ss-grid-menu', style: { left: menu.x, top: menu.y } },
        h(ContextMenu, { label: (p.label || 'row') + ' · row ' + (menu.row + 1), items: items, onClose: function () { setMenu(null); } })));
  }

  // ------------------------------------------------------------------ records: table header, tools, filters, pages
  // A popover that closes on Esc and on a press outside it.
  function usePopover(initialOpen) {
    var _o = useState(!!initialOpen), open = _o[0], setOpen = _o[1];
    var ref = useRef(null);
    useEffect(function () {
      if (!open) return;
      function down(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
      function key(e) { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }
      window.addEventListener('pointerdown', down); window.addEventListener('keydown', key, true);
      return function () { window.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key, true); };
    }, [open]);
    return { open: open, set: setOpen, ref: ref };
  }

  function countText(n, one, many) { return n.toLocaleString('en-US') + ' ' + (n === 1 ? one : many); }

  // The foreign keys of a table that leave it (`out`) and the ones of other tables that point at it (`inn`).
  function relationsOf(table, tables) {
    var out = [], inn = [];
    table.columns.forEach(function (c) {
      if (c.fk) out.push({ key: 'out:' + c.name, table: c.fk.table, from: table.name + '.' + c.name, to: c.fk.table + '.' + c.fk.column, onDelete: c.fk.onDelete || 'NO ACTION' });
    });
    (tables || []).forEach(function (o) {
      o.columns.forEach(function (c) {
        if (c.fk && c.fk.table === table.name) inn.push({ key: 'in:' + o.name + '.' + c.name, table: o.name, from: o.name + '.' + c.name, to: table.name + '.' + c.fk.column, onDelete: c.fk.onDelete || 'NO ACTION' });
      });
    });
    return { out: out, inn: inn };
  }

  var TABLE_TABS = [{ value: 'data', label: 'Data' }, { value: 'structure', label: 'Structure' }, { value: 'relationships', label: 'Relationships' }];
  var TABLE_MENU = [
    { icon: 'layers', label: 'Open in Diagram' },
    { icon: 'copy', label: 'Copy table name' },
    { icon: 'code', label: 'Copy CREATE TABLE' }
  ];

  function TableHeader(p) {
    var t = p.table, tab = p.tab || 'data', more = usePopover();
    var counts = { structure: t.columns.length, relationships: p.relationships };
    var meta = (p.rows != null ? countText(p.rows, 'row', 'rows') + ' · ' : '') + countText(t.columns.length, 'column', 'columns');
    function onTabKey(e, i) {
      var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      var n = (i + step + TABLE_TABS.length) % TABLE_TABS.length;
      e.currentTarget.parentNode.children[n].focus();
      p.onTab && p.onTab(TABLE_TABS[n].value);
    }
    return h('header', { className: 'ss-tbh' },
      h('nav', { className: 'ss-tbh-crumb', 'aria-label': 'Breadcrumb' },
        [p.schema, t.schema || 'public', t.name].filter(Boolean).map(function (part, i, all) {
          return h(Fragment, { key: i }, i > 0 && h('span', { 'aria-hidden': true }, '/'), h('span', { className: i === all.length - 1 ? 'is-last' : null }, part));
        })),
      h('div', { className: 'ss-tbh-row' },
        h('h2', { className: 'ss-tbh-name' }, t.name),
        p.engine && h(Badge, { dot: true, title: 'Database engine' }, p.engine),
        h('span', { className: 'ss-tbh-meta' }, meta),
        h('span', { className: 'ss-spacer' }),
        h(IconButton, { icon: 'refresh', label: 'Refresh table', disabled: p.loading, onClick: p.onRefresh }),
        h('div', { className: 'ss-anchor', ref: more.ref },
          h(IconButton, { icon: 'more', label: 'More actions', active: more.open, 'aria-haspopup': 'menu', 'aria-expanded': more.open, onClick: function () { more.set(!more.open); } }),
          more.open && h('div', { className: 'ss-anchor-pop ss-anchor-pop--end' }, h(ContextMenu, { items: p.menuItems || TABLE_MENU, onClose: function () { more.set(false); } }))),
        h(Button, { icon: 'upload', onClick: p.onImport }, 'Import Records'),
        h(Button, { icon: 'download', onClick: p.onExport }, 'Export'),
        h(Button, { variant: 'primary', icon: 'plus', kbd: ['⌘', '⏎'], onClick: p.onAdd }, 'Add record')),
      h('div', { className: 'ss-tabs', role: 'tablist', 'aria-label': 'Table views' }, TABLE_TABS.map(function (x, i) {
        var on = tab === x.value, n = counts[x.value];
        return h('button', {
          key: x.value, type: 'button', role: 'tab', 'aria-selected': on, tabIndex: on ? 0 : -1, className: cx('ss-tab', on && 'is-active'),
          onClick: function () { p.onTab && p.onTab(x.value); }, onKeyDown: function (e) { onTabKey(e, i); }
        }, x.label, n != null && h('span', { className: 'ss-tab-count' }, n));
      })));
  }

  function TableStructure(p) {
    var t = p.table;
    var rows = t.columns.map(function (c, i) { return assign(c, { n: i + 1 }); });
    return h('div', { className: 'ss-pane' },
      t.comment && h('div', { className: 'ss-pane-note' }, t.comment),
      h('div', { className: 'ss-pane-card' }, h(DataTable, {
        rowKey: 'name', rows: rows, columns: [
          { key: 'n', label: '#', width: 56, numeric: true, align: 'right', sortable: false },
          { key: 'name', label: 'Column', sortable: false, render: function (c) {
            return h('span', { className: 'ss-pane-name' },
              h('span', { className: 'ss-pane-key' }, c.pk && h(Icon, { name: 'key', size: 14, className: 'ss-grid-key is-pk', label: 'Primary key' }), !c.pk && c.fk && h(Icon, { name: 'link', size: 14, className: 'ss-grid-key is-fk', label: 'Foreign key' })),
              h('span', { className: 'ss-mono', style: { fontWeight: 500 } }, c.name));
          } },
          { key: 'type', label: 'Type', sortable: false, render: function (c) { return h('span', { className: 'ss-mono', style: { fontSize: 12, color: 'var(--ink-2)' } }, c.type); } },
          { key: 'nullable', label: 'Nullable', sortable: false, render: function (c) { return h('span', { className: 'ss-mono', style: { fontSize: 12, color: 'var(--ink-2)' } }, c.nullable ? 'NULL' : 'NOT NULL'); } },
          { key: 'default', label: 'Default', sortable: false, render: function (c) { return c.default ? h('span', { className: 'ss-mono', style: { fontSize: 12 } }, c.default) : h('span', { className: 'ss-faint' }, '—'); } },
          { key: 'keys', label: 'Keys', sortable: false, render: function (c) {
            return h('span', { className: 'ss-row', style: { gap: 4 } },
              c.pk && h(Badge, { tone: 'pk' }, 'PK'), c.unique && h(Badge, null, 'UQ'),
              c.fk && h(Badge, { tone: 'fk', icon: 'link', title: 'References ' + c.fk.table + '.' + c.fk.column }, c.fk.table + '.' + c.fk.column));
          } }
        ]
      })));
  }

  function TableRelationships(p) {
    var t = p.table, rel = relationsOf(t, p.tables);
    function group(title, list, none) {
      return h('section', { className: 'ss-pane-group', 'aria-label': title },
        h('div', { className: 'ss-row' }, h('span', { className: 'ss-caption' }, title), h('span', { className: 'ss-tl-count' }, list.length)),
        list.length
          ? h('div', { className: 'ss-pane-card' }, h(DataTable, {
            rowKey: 'key', rows: list, columns: [
              { key: 'from', label: 'Relationship', sortable: false, render: function (r) {
                return h('span', { className: 'ss-mono', style: { fontSize: 12 } }, r.from, h('span', { className: 'ss-faint' }, ' → '), r.to);
              } },
              { key: 'onDelete', label: 'On delete', width: 160, sortable: false, render: function (r) { return h('span', { className: 'ss-mono', style: { fontSize: 12, color: 'var(--ink-2)' } }, r.onDelete); } },
              { key: 'open', label: '', width: 148, sortable: false, align: 'right', render: function (r) {
                return h(Button, { variant: 'ghost', size: 'sm', iconRight: 'arrow-right', 'aria-label': 'Open ' + r.table + ' in Data', onClick: function () { p.onOpen && p.onOpen(r.table); } }, 'Open in Data');
              } }
            ]
          }))
          : h('div', { className: 'ss-pane-none' }, none));
    }
    return h('div', { className: 'ss-pane' },
      group('References', rel.out, t.name + ' has no foreign keys.'),
      group('Referenced by', rel.inn, 'No table references ' + t.name + '.'));
  }

  var FILTER_OPS = ['=', '!=', '>', '>=', '<', '<=', 'LIKE', 'IS NULL', 'IS NOT NULL'];
  var PAGE_SIZES = [25, 50, 100, 200];
  var DENSITIES = [{ value: 'regular', label: 'Regular' }, { value: 'compact', label: 'Compact' }];

  // A value as SQL writes it: strings quoted, NULL bare.
  function sqlLiteral(v) {
    if (v == null) return 'NULL';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return "'" + String(v).replace(/'/g, "''") + "'";
  }
  function filterText(f) { return f.column + ' ' + f.op + (f.value !== undefined ? ' ' + sqlLiteral(f.value) : ''); }

  function FilterForm(p) {
    var cols = p.columns;
    var _c = useState(cols[0] ? cols[0].name : ''), column = _c[0], setColumn = _c[1];
    var _o = useState('='), op = _o[0], setOp = _o[1];
    var _v = useState(''), value = _v[0], setValue = _v[1];
    var _e = useState(null), error = _e[0], setError = _e[1];
    var input = useRef(null);
    useEffect(function () { if (input.current) input.current.focus(); }, []);
    var col = cols.find(function (c) { return c.name === column; }) || cols[0];
    var kind = col ? cellKind(col.type) : 'text';
    var bare = op === 'IS NULL' || op === 'IS NOT NULL';
    function submit() {
      if (!col) return;
      if (bare) { p.onAdd({ column: col.name, op: op }); return; }
      var v = value;
      if (v === '') { setError('Value cannot be empty.'); return; }
      if (kind === 'number') { v = Number(v); if (isNaN(v)) { setError('Value must be a number.'); return; } }
      else if (kind === 'boolean') { if (v !== 'true' && v !== 'false') { setError('Value must be true or false.'); return; } v = v === 'true'; }
      p.onAdd({ column: col.name, op: op, value: v });
    }
    return h('div', { className: 'ss-menu ss-dt-pop ss-dt-pop--filter', role: 'dialog', 'aria-label': 'Add filter', onKeyDown: function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(); } } },
      h('div', { className: 'ss-menu-label' }, 'Add filter'),
      h('div', { className: 'ss-dt-form' },
        h('div', { className: 'ss-dt-form-row' },
          h(Select, { mono: true, size: 'sm', label: 'Column', value: column, onChange: function (v) { setColumn(v); setError(null); }, options: cols.map(function (c) { return c.name; }) }),
          h(Select, { mono: true, size: 'sm', label: 'Operator', value: op, onChange: function (v) { setOp(v); setError(null); }, options: FILTER_OPS })),
        !bare && h(Field, { error: error }, h(Input, { mono: true, size: 'sm', placeholder: kind === 'time' ? 'YYYY-MM-DD HH:mm:ss' : 'Value', 'aria-label': 'Value', error: !!error, value: value, inputRef: input, onChange: function (e) { setValue(e.target.value); setError(null); } })),
        h('div', { className: 'ss-dt-form-foot' }, h(Button, { variant: 'primary', size: 'sm', kbd: '⏎', onClick: submit }, 'Add filter'))));
  }

  function sortItems(cols, sort, onSort) {
    var items = cols.map(function (c) {
      var on = !!sort && sort.column === c.name;
      return {
        icon: on ? (sort.dir === 'asc' ? 'arrow-up' : 'arrow-down') : undefined, label: h('span', { className: 'ss-mono', style: { fontSize: 12 } }, c.name), active: on, shortcut: on ? sort.dir.toUpperCase() : undefined,
        onSelect: function () { onSort && onSort(!on ? { column: c.name, dir: 'asc' } : sort.dir === 'asc' ? { column: c.name, dir: 'desc' } : null); }
      };
    });
    return sort ? items.concat(['-', { icon: 'x', label: 'Clear sort', onSelect: function () { onSort && onSort(null); } }]) : items;
  }

  function ColumnsMenu(p) {
    var hidden = p.hidden, shown = p.columns.length - hidden.length;
    function toggle(name, on) { p.onHidden && p.onHidden(on ? hidden.filter(function (x) { return x !== name; }) : hidden.concat([name])); }
    return h('div', { className: 'ss-menu ss-dt-pop', role: 'group', 'aria-label': 'Columns' },
      h('div', { className: 'ss-menu-label' }, shown + ' of ' + p.columns.length + ' columns'),
      p.columns.map(function (c) {
        var on = hidden.indexOf(c.name) < 0;
        return h('div', { key: c.name, className: 'ss-dt-col' },
          h(Checkbox, { checked: on, disabled: on && shown === 1, onChange: function (v) { toggle(c.name, v); }, label: h('span', { className: 'ss-mono', style: { fontSize: 12 } }, c.name) }),
          h('span', { className: 'ss-dt-col-type' }, c.type));
      }),
      h('div', { className: 'ss-menu-sep', role: 'separator' }),
      h('div', { className: 'ss-dt-form-foot' }, h(Button, { variant: 'ghost', size: 'sm', disabled: !hidden.length, onClick: function () { p.onHidden && p.onHidden([]); } }, 'Show all')));
  }

  function DataToolbar(p) {
    var cols = p.columns || [], filters = p.filters || [], hidden = p.hidden || [], sort = p.sort || null;
    var filter = usePopover(), order = usePopover(), shown = usePopover();
    var size = p.pageSize || 50;
    function toggle(pop) { return function () { pop.set(!pop.open); }; }
    return h('div', { className: 'ss-dt', role: 'toolbar', 'aria-label': 'Record tools' },
      h('div', { className: 'ss-dt-search' }, h(Input, { icon: 'search', placeholder: 'Search records…', 'aria-label': 'Search records', value: p.search || '', onChange: function (e) { p.onSearch && p.onSearch(e.target.value); }, readOnly: !p.onSearch })),
      h('div', { className: 'ss-anchor', ref: filter.ref },
        h(Button, { icon: 'filter', active: filter.open, 'aria-haspopup': 'dialog', 'aria-expanded': filter.open, onClick: toggle(filter) }, 'Filter', filters.length > 0 && h(Badge, { tone: 'accent', title: countText(filters.length, 'filter', 'filters') }, filters.length)),
        filter.open && h('div', { className: 'ss-anchor-pop' }, h(FilterForm, { columns: cols, onAdd: function (f) { p.onAddFilter && p.onAddFilter(f); filter.set(false); } }))),
      h('div', { className: 'ss-anchor', ref: order.ref },
        h(Button, { icon: 'chevrons-ud', active: order.open, 'aria-haspopup': 'menu', 'aria-expanded': order.open, onClick: toggle(order) }, 'Sort', sort && h(Badge, { tone: 'accent' }, sort.column + (sort.dir === 'asc' ? ' ↑' : ' ↓'))),
        order.open && h('div', { className: 'ss-anchor-pop' }, h(ContextMenu, { label: 'Sort by', items: sortItems(cols, sort, p.onSort), onClose: function () { order.set(false); } }))),
      h('div', { className: 'ss-anchor', ref: shown.ref },
        h(Button, { icon: 'columns', active: shown.open, 'aria-haspopup': 'dialog', 'aria-expanded': shown.open, onClick: toggle(shown) }, 'Columns', hidden.length > 0 && h(Badge, { tone: 'accent' }, hidden.length + ' hidden')),
        shown.open && h('div', { className: 'ss-anchor-pop' }, h(ColumnsMenu, { columns: cols, hidden: hidden, onHidden: p.onHidden }))),
      h('div', { className: 'ss-dt-end' },
        h(SegmentedControl, { options: DENSITIES, value: p.density || 'regular', onChange: p.onDensity }),
        h('div', { className: 'ss-dt-size' }, h(Select, { label: 'Rows per page', value: String(size), onChange: function (v) { p.onPageSize && p.onPageSize(Number(v)); }, options: PAGE_SIZES.map(function (n) { return { value: String(n), label: n + ' rows' }; }) })),
        h(IconButton, { icon: 'refresh', label: 'Refresh records', disabled: p.loading, onClick: p.onRefresh })));
  }

  function FilterChips(p) {
    var filters = p.filters || [];
    if (!filters.length) return null;
    return h('div', { className: 'ss-fchips', role: 'group', 'aria-label': 'Active filters' },
      filters.map(function (f, i) {
        return h('span', { key: i, className: 'ss-fchip', title: filterText(f) },
          h('span', { className: 'ss-fchip-text' },
            h('span', null, f.column), ' ', h('span', { className: /^[A-Z]/.test(f.op) ? 'ss-fchip-kw' : 'ss-fchip-op' }, f.op),
            f.value !== undefined && h(Fragment, null, ' ', h('span', { className: typeof f.value === 'string' ? 'ss-fchip-str' : 'ss-fchip-num' }, sqlLiteral(f.value)))),
          h('button', { type: 'button', className: 'ss-fchip-x', 'aria-label': 'Remove filter ' + filterText(f), onClick: function () { p.onRemove && p.onRemove(i); } }, h(Icon, { name: 'x', size: 12 })));
      }),
      h(Button, { variant: 'ghost', size: 'sm', onClick: p.onClear }, 'Clear all'));
  }

  function SelectionBar(p) {
    var n = p.count || 0;
    return h('div', { className: 'ss-selbar', role: 'status' },
      h('span', { className: 'ss-selbar-count' }, countText(n, 'row', 'rows') + ' selected'),
      h(Button, { size: 'sm', icon: 'code', onClick: p.onCopy }, 'Copy as JSON'),
      h(Button, { size: 'sm', icon: 'download', onClick: p.onExport }, 'Export selected'),
      h(Button, { size: 'sm', variant: 'danger-ghost', icon: 'trash', kbd: '⌫', onClick: p.onDelete }, 'Delete selected'),
      h('span', { className: 'ss-spacer' }),
      h(IconButton, { icon: 'x', size: 'sm', label: 'Clear selection (Esc)', onClick: p.onClear }));
  }

  function Pagination(p) {
    var size = p.pageSize || 50, total = p.total || 0, pages = Math.max(1, Math.ceil(total / size));
    var page = Math.min(Math.max(1, p.page || 1), pages);
    var from = total ? (page - 1) * size + 1 : 0, to = Math.min(total, page * size);
    var _d = useState(null), draft = _d[0], setDraft = _d[1];
    function go(n) { n = Math.min(pages, Math.max(1, Math.round(n))); if (n !== page) p.onPage && p.onPage(n); }
    function commit() { if (draft != null && draft.trim() !== '' && !isNaN(Number(draft))) go(Number(draft)); setDraft(null); }
    var range = p.loading ? 'Loading…' : total ? from.toLocaleString('en-US') + '–' + to.toLocaleString('en-US') + ' of ' + countText(total, 'row', 'rows') : '0 rows';
    return h('div', { className: 'ss-pager', role: 'navigation', 'aria-label': 'Pagination' },
      h('span', { className: 'ss-pager-range' }, range),
      h('span', { className: 'ss-spacer' }),
      h(IconButton, { icon: 'chevron-left', size: 'sm', label: 'Previous page', disabled: p.loading || page <= 1, onClick: function () { go(page - 1); } }),
      h('span', { className: 'ss-pager-page' }, 'Page',
        h('input', {
          className: 'ss-input ss-input--mono ss-input--sm ss-pager-input', inputMode: 'numeric', 'aria-label': 'Page number', disabled: p.loading || pages === 1,
          value: draft != null ? draft : String(page), onFocus: function (e) { e.target.select(); }, onChange: function (e) { setDraft(e.target.value); }, onBlur: commit,
          onKeyDown: function (e) { if (e.key === 'Enter') e.target.blur(); else if (e.key === 'Escape') { e.stopPropagation(); setDraft(null); } }
        }),
        'of ' + pages.toLocaleString('en-US')),
      h(IconButton, { icon: 'chevron-right', size: 'sm', label: 'Next page', disabled: p.loading || page >= pages, onClick: function () { go(page + 1); } }));
  }

  // ------------------------------------------------------------------ records: the editor of one record
  var RECORD_W = 520, RECORD_MIN = 480, RECORD_MAX = 720, NO_ROWS = [], NO_DATA = {};

  // The line between a panel and what is next to it, dragged to make the panel wider or narrower. It takes no room in its row.
  function ResizeHandle(p) {
    var _d = useState(false), dragging = _d[0], setDragging = _d[1];
    var drag = useRef(null);
    var across = p.edge === 'top' || p.edge === 'bottom', grows = p.edge === 'right' || p.edge === 'bottom' ? 1 : -1;
    function end() { drag.current = null; setDragging(false); }
    function want(w) { p.onResize && p.onResize(Math.round(Math.max(p.min, Math.min(p.max, w)))); }
    return h('div', {
      className: cx('ss-resize', 'ss-resize--' + p.edge, dragging && 'is-dragging'), role: 'separator', 'aria-orientation': across ? 'horizontal' : 'vertical', 'aria-label': p.label,
      'aria-valuenow': p.width, 'aria-valuemin': p.min, 'aria-valuemax': p.max, tabIndex: 0, title: p.onReset ? 'Drag to resize. Double-click to reset.' : 'Drag to resize.',
      onPointerDown: function (e) { if (e.button !== 0) return; e.preventDefault(); drag.current = { x: across ? e.clientY : e.clientX, width: p.width }; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); },
      onPointerMove: function (e) { var d = drag.current; if (d) want(d.width + grows * ((across ? e.clientY : e.clientX) - d.x)); },
      onPointerUp: end, onLostPointerCapture: end, onDoubleClick: p.onReset,
      onKeyDown: function (e) {
        var key = across ? { ArrowUp: 'ArrowLeft', ArrowDown: 'ArrowRight' }[e.key] || e.key : e.key;
        var next = key === 'ArrowLeft' ? p.width - grows * 16 : key === 'ArrowRight' ? p.width + grows * 16 : key === 'Home' ? p.min : key === 'End' ? p.max : null;
        if (next === null) return;
        e.preventDefault(); want(next);
      }
    });
  }

  // JSON read by hand, so that where reading stops is the same in every browser: `line` is the line of the token it stops at.
  var JSON_ESCAPES = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
  var JSON_NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  function parseJson(text) {
    var i = 0, len = text.length;
    function bad() { throw { at: i }; }
    function ws() { while (i < len && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i++; }
    function word(w, v) { if (text.substr(i, w.length) !== w) bad(); i += w.length; return v; }
    function put(o, k, v) { Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true }); }
    function str() {
      var out = ''; i++;
      for (;;) {
        if (i >= len) bad();
        var c = text[i];
        if (c === '"') { i++; return out; }
        if (c < ' ') bad();
        if (c !== '\\') { out += c; i++; continue; }
        var e = text[i + 1];
        if (e === 'u') {
          var hex = text.substr(i + 2, 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) { i += 2; bad(); }
          out += String.fromCharCode(parseInt(hex, 16)); i += 6;
        } else {
          if (JSON_ESCAPES[e] === undefined) { i++; bad(); }
          out += JSON_ESCAPES[e]; i += 2;
        }
      }
    }
    function value(depth) {
      if (depth > 200) bad();
      ws();
      var c = text[i];
      if (c === '{') {
        var o = {}; i++; ws();
        if (text[i] === '}') { i++; return o; }
        for (;;) {
          ws(); if (text[i] !== '"') bad();
          var k = str(); ws(); if (text[i] !== ':') bad(); i++;
          put(o, k, value(depth + 1)); ws();
          if (text[i] === ',') { i++; continue; }
          if (text[i] === '}') { i++; return o; }
          bad();
        }
      }
      if (c === '[') {
        var a = []; i++; ws();
        if (text[i] === ']') { i++; return a; }
        for (;;) {
          a.push(value(depth + 1)); ws();
          if (text[i] === ',') { i++; continue; }
          if (text[i] === ']') { i++; return a; }
          bad();
        }
      }
      if (c === '"') return str();
      if (c === 't') return word('true', true);
      if (c === 'f') return word('false', false);
      if (c === 'n') return word('null', null);
      JSON_NUMBER.lastIndex = i;
      var m = JSON_NUMBER.exec(text);
      if (!m) bad();
      i += m[0].length;
      return Number(m[0]);
    }
    try {
      var v = value(0); ws();
      if (i < len) bad();
      return { ok: true, value: v };
    } catch (e) {
      var at = e && typeof e.at === 'number' ? e.at : i;
      return { ok: false, line: text.slice(0, Math.min(at, len)).split('\n').length };
    }
  }
  function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function kv(k, v) { var o = {}; o[k] = v; return o; }

  // --- what a column holds, and what the editor makes of it
  var MOMENTS = {
    timestamp: { text: 'YYYY-MM-DD HH:mm:ss', word: 'timestamp', picker: 'datetime-local', re: /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/ },
    date: { text: 'YYYY-MM-DD', word: 'date', picker: 'date', re: /^(\d{4})-(\d{2})-(\d{2})$/ },
    time: { text: 'HH:mm:ss', word: 'time', picker: 'time', re: /^(\d{2}):(\d{2}):(\d{2})$/ }
  };
  function momentKind(type) { var t = String(type).toUpperCase(); return /^DATE\b/.test(t) ? 'date' : /^TIME(?!STAMP)/.test(t) ? 'time' : 'timestamp'; }
  function validMoment(kind, s) {
    var m = MOMENTS[kind].re.exec(s);
    if (!m) return false;
    var n = m.slice(1).map(Number);
    if (kind === 'time') return n[0] < 24 && n[1] < 60 && n[2] < 60;
    var d = new Date(Date.UTC(n[0], n[1] - 1, n[2], n[3] || 0, n[4] || 0, n[5] || 0));
    return d.getUTCFullYear() === n[0] && d.getUTCMonth() === n[1] - 1 && d.getUTCDate() === n[2] && (kind === 'date' || (n[3] < 24 && n[4] < 60 && n[5] < 60));
  }
  function formatMoment(ms) { return new Date(ms).toISOString().slice(0, 19).replace('T', ' '); }

  // The counter of the database fills these in: a serial type or an identity.
  function isGenerated(c) { return /SERIAL|AUTO_INCREMENT|IDENTITY/i.test(c.type || '') || /^nextval\(|AUTO_INCREMENT|GENERATED/i.test(c.default || ''); }
  function isIntegerType(t) { return /^(BIG|SMALL|MEDIUM|TINY)?(INT|INTEGER|SERIAL)\d?\b/i.test(t); }
  function typeLength(t) { var m = /^(?:N?VAR)?CHAR(?:ACTER)?(?:\s+VARYING)?\s*\(\s*(\d+)\s*\)/i.exec(t); return m ? Number(m[1]) : null; }
  function typeScale(t) { var m = /\(\s*\d+\s*,\s*(\d+)\s*\)/.exec(t); return m ? Number(m[1]) : null; }
  // The value of a default that is a literal (`'pending'`, `1`, `true`); undefined for `now()` and other expressions.
  function literalDefault(c) {
    var d = String(c.default || '').trim().replace(/::[\w\s]+(?:\([^)]*\))?$/, '');
    if (!d) return undefined;
    if (/^'(?:[^']|'')*'$/.test(d)) return d.slice(1, -1).replace(/''/g, "'");
    if (/^-?\d+(?:\.\d+)?$/.test(d)) return Number(d);
    if (/^(true|false)$/i.test(d)) return d.toLowerCase() === 'true';
    if (/^NULL$/i.test(d)) return null;
    return undefined;
  }
  // `ENUM('a','b')` offers its values. A text column called status (or state, stage) offers what the table already holds in it.
  var ENUM_NAME = /status|(^|_)state$|stage/;
  function enumOptions(c, rows) {
    var m = /^ENUM\s*\((.*)\)\s*$/i.exec(c.type || '');
    if (m) {
      var fixed = [], re = /'((?:[^']|'')*)'/g, x;
      while ((x = re.exec(m[1]))) fixed.push(x[1].replace(/''/g, "'"));
      return fixed.length ? { values: fixed, fixed: true } : null;
    }
    if (!ENUM_NAME.test(c.name.toLowerCase()) || c.fk || cellKind(c.type) !== 'text') return null;
    var seen = [], i, v;
    for (i = 0; i < (rows || []).length; i++) {
      v = rows[i][c.name];
      if (typeof v === 'string' && v !== '' && seen.indexOf(v) < 0) { seen.push(v); if (seen.length > 12) return null; }
    }
    var d = literalDefault(c);
    if (typeof d === 'string' && seen.indexOf(d) < 0) seen.push(d);
    return seen.length ? { values: seen, fixed: false } : null;
  }
  // How the editor sets a column: generated (read-only), json, boolean, time, reference (a foreign key to a table that has rows), enum, number, longtext, or text.
  function fieldMeta(c, rows, data) {
    var t = String(c.type || '').toUpperCase();
    if (isGenerated(c)) return { kind: 'generated' };
    if (/^JSONB?\b/.test(t)) return { kind: 'json' };
    var base = cellKind(c.type);
    if (base === 'boolean') return { kind: 'boolean' };
    if (base === 'time') return { kind: 'time', moment: momentKind(t) };
    if (c.fk && data && Array.isArray(data[c.fk.table])) return { kind: 'reference' };
    var en = enumOptions(c, rows);
    if (en) return { kind: 'enum', options: en.values, fixed: en.fixed };
    if (base === 'number') return { kind: 'number' };
    if (/TEXT$/.test(t)) return { kind: 'longtext' };
    return { kind: 'text' };
  }
  function isTextKind(meta) { return meta.kind === 'text' || meta.kind === 'longtext'; }
  // The value a draft stands for: empty is NULL except in a text column, and a number typed in a number column is a number.
  function canon(c, meta, v) {
    if (v === undefined || v === null) return v;
    if (typeof v === 'string' && !isTextKind(meta) && v.trim() === '') return null;
    if (typeof v === 'string' && cellKind(c.type) === 'number' && meta.kind !== 'text' && v.trim() !== '' && isFinite(Number(v))) return Number(v);
    return v;
  }

  function uniqueKeys(table, c) {
    var pk = table.columns.filter(function (x) { return x.pk; });
    return !!c.unique || (c.pk && pk.length === 1) || (table.indexes || []).some(function (ix) { return ix.type !== 'INDEX' && ix.columns.length === 1 && ix.columns[0] === c.name; });
  }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function cannotBeEmpty(name) { return 'Column "' + name + '" cannot be empty.'; }

  // The first thing wrong with a value, in the words of the form; null when it is fine.
  function columnProblem(table, c, meta, raw, ctx) {
    var v = canon(c, meta, raw), name = c.name, nullable = !!c.nullable && !c.pk;
    if (raw === undefined && ctx.mode === 'new') return nullable || c.default ? null : cannotBeEmpty(name);
    if (v === null || v === undefined) return nullable ? null : cannotBeEmpty(name);
    if (v === '') return nullable ? null : cannotBeEmpty(name);
    var text = String(v), max;
    if (meta.kind === 'number' || (meta.kind === 'reference' && cellKind(c.type) === 'number')) {
      if (typeof v !== 'number') return 'Value must be a number.';
      if (isIntegerType(c.type) && !Number.isInteger(v)) return 'Value must be a whole number.';
      var scale = typeScale(c.type);
      if (scale != null && (text.split('.')[1] || '').length > scale) return 'Value has more than ' + scale + ' decimal places.';
    } else if (meta.kind === 'boolean') {
      if (typeof v !== 'boolean') return 'Value must be true or false.';
    } else if (meta.kind === 'time') {
      if (!validMoment(meta.moment, text)) return 'Invalid ' + MOMENTS[meta.moment].word + ' format.';
    } else if (meta.kind === 'enum') {
      if (meta.fixed && meta.options.indexOf(text) < 0) return 'Value must be one of ' + meta.options.join(', ') + '.';
      max = typeLength(c.type);
      if (max != null && text.length > max) return 'Value is longer than ' + max + ' characters.';
    } else if (meta.kind === 'json') {
      var r = parseJson(text);
      if (!r.ok) return 'Invalid JSON near line ' + r.line + '.';
    } else if (isTextKind(meta)) {
      max = typeLength(c.type);
      if (max != null && text.length > max) return 'Value is longer than ' + max + ' characters.';
      if (/(^|_)email$/i.test(name) && !EMAIL_RE.test(text)) return 'Invalid email format.';
    }
    if (c.fk && ctx.data && Array.isArray(ctx.data[c.fk.table]) && !ctx.data[c.fk.table].some(function (x) { return x[c.fk.column] != null && String(x[c.fk.column]) === text; })) {
      return 'No row in ' + c.fk.table + ' has ' + c.fk.column + ' ' + text + '.';
    }
    if (uniqueKeys(table, c) && (ctx.rows || []).some(function (x) { return x !== ctx.record && x[name] != null && String(x[name]) === text; })) {
      return 'A row with ' + name + ' "' + text + '" already exists.';
    }
    return null;
  }
  // What is wrong with the values of a record, by column name. `ctx`: `mode` ('edit' or 'new'), `rows` of the table, `record` (the row being edited, which does not clash with itself), `data` (the rows of every table, for foreign keys).
  function validateRecord(table, values, ctx) {
    ctx = ctx || {};
    var rows = ctx.rows || (ctx.data && ctx.data[table.name]) || [], errs = {};
    var metas = ctx.metas || table.columns.map(function (c) { return fieldMeta(c, rows, ctx.data); });
    var full = assign(ctx, { rows: rows });
    table.columns.forEach(function (c, i) {
      if (metas[i].kind === 'generated') return;
      var msg = columnProblem(table, c, metas[i], values[c.name], full);
      if (msg) errs[c.name] = msg;
    });
    return errs;
  }
  // `users · id = 101`: what a record is called.
  function recordLabel(table, row) {
    var keys = table.columns.filter(function (c) { return c.pk; });
    if (!keys.length) keys = table.columns.slice(0, 1);
    return table.name + ' · ' + keys.map(function (k) { return k.name + ' = ' + (row[k.name] == null ? 'NULL' : row[k.name]); }).join(', ');
  }
  // A new record starts with the literal defaults filled in and NULL where a column may be empty; the rest is left to the database.
  function initialValues(table, metas) {
    var out = {};
    table.columns.forEach(function (c, i) {
      if (metas[i].kind === 'generated') return;
      var d = literalDefault(c);
      if (d !== undefined) out[c.name] = d;
      else if (c.nullable && !c.pk && !c.default) out[c.name] = null;
    });
    return out;
  }
  // The row a new record becomes: what the database fills in (the next number of a counter, `now()`) is filled in the way it would be.
  function completeRecord(table, rows, values, now) {
    var out = {};
    table.columns.forEach(function (c) {
      var meta = fieldMeta(c, rows), v = values[c.name];
      if (v === undefined) {
        var d = literalDefault(c);
        if (meta.kind === 'generated') v = rows.reduce(function (m, r) { return typeof r[c.name] === 'number' && r[c.name] > m ? r[c.name] : m; }, 0) + 1;
        else if (d !== undefined) v = d;
        else if (/^(now\(\)|current_timestamp|localtimestamp|current_date|current_time)/i.test(c.default || '')) {
          var stamp = formatMoment(now == null ? Date.now() : now);
          v = meta.kind === 'time' && meta.moment === 'date' ? stamp.slice(0, 10) : meta.kind === 'time' && meta.moment === 'time' ? stamp.slice(11) : stamp;
        } else v = null;
      }
      out[c.name] = canon(c, meta, v);
    });
    return out;
  }
  function toRecord(table, metas, draft) {
    var out = {};
    table.columns.forEach(function (c, i) { if (draft[c.name] !== undefined) out[c.name] = canon(c, metas[i], draft[c.name]); });
    return out;
  }
  // The record as a JSON object; a JSON column holds its text, which is written as the JSON it is.
  function recordJson(table, metas, draft) {
    var o = {};
    table.columns.forEach(function (c, i) {
      var v = draft[c.name];
      if (v === undefined) return;
      v = canon(c, metas[i], v);
      if (metas[i].kind === 'json' && typeof v === 'string') { var r = parseJson(v); if (r.ok) v = r.value; }
      o[c.name] = v;
    });
    return JSON.stringify(o, null, 2);
  }
  // The draft after the JSON was edited: a column left out of it keeps its value, one that is generated or does not exist is not changed.
  function fromJson(table, metas, current, obj) {
    var next = assign(current);
    table.columns.forEach(function (c, i) {
      if (!Object.prototype.hasOwnProperty.call(obj, c.name) || metas[i].kind === 'generated') return;
      var v = obj[c.name];
      if (v !== null && typeof v === 'object') {
        var cur = current[c.name], was = typeof cur === 'string' ? parseJson(cur) : null;
        v = metas[i].kind === 'json' && was && was.ok && JSON.stringify(was.value) === JSON.stringify(v) ? cur : JSON.stringify(v);
      } else if (metas[i].kind === 'json' && v !== null && typeof v !== 'string') v = JSON.stringify(v);
      next[c.name] = v;
    });
    return next;
  }
  function jsonNotes(table, metas, current, obj) {
    var notes = [];
    Object.keys(obj).forEach(function (k) {
      var i = table.columns.findIndex(function (c) { return c.name === k; });
      if (i < 0) notes.push('Column "' + k + '" does not exist in ' + table.name + ' and is ignored.');
      else if (metas[i].kind === 'generated' && current[k] !== undefined && String(obj[k]) !== String(current[k])) notes.push('Column "' + k + '" is generated by the database and is not changed.');
    });
    return notes;
  }
  function typeLine(c) {
    var parts = [c.type];
    if (c.pk) parts.push('Primary key');
    if (c.fk) parts.push('Foreign key');
    if (c.unique && !c.pk) parts.push('Unique');
    if (!c.nullable && !c.pk) parts.push('Required');
    if (c.default) parts.push('Default ' + c.default);
    return parts.join(' · ');
  }

  // The records that point at this one (`inn`) and the ones it points at (`out`), with their rows.
  function relatedOf(table, record, tables, data) {
    var rel = relationsOf(table, tables), byName = {};
    (tables || []).forEach(function (t) { byName[t.name] = t; });
    function withRows(dir) {
      return function (r) {
        var other = byName[r.table], list = data[r.table];
        if (!other || !list) return null;
        var fromCol = r.from.split('.')[1], toCol = r.to.split('.')[1];
        var key = dir === 'in' ? record[toCol] : record[fromCol], col = dir === 'in' ? fromCol : toCol;
        return assign(r, { dir: dir, columns: other.columns, rows: key == null ? [] : list.filter(function (x) { return x[col] != null && String(x[col]) === String(key); }) });
      };
    }
    return { out: rel.out.map(withRows('out')).filter(Boolean), inn: rel.inn.map(withRows('in')).filter(Boolean) };
  }
  // What names a row of a table in a list: its email, name, title… or the first text column that is not a key.
  var LABEL_NAMES = ['email', 'name', 'title', 'sku', 'slug', 'code', 'label', 'username'];
  function labelColumn(t) {
    for (var i = 0; i < LABEL_NAMES.length; i++) {
      var c = t.columns.find(function (x) { return x.name === LABEL_NAMES[i] && !x.pk; });
      if (c) return c.name;
    }
    var any = t.columns.find(function (x) { return !x.pk && !x.fk && cellKind(x.type) === 'text' && !/^JSONB?\b/i.test(x.type); });
    return any ? any.name : null;
  }
  function copyText(text) { try { if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () { }); } catch (e) { /* no clipboard here */ } }

  // A date and time typed in the format SQL writes, with the picker of the browser behind the clock.
  function MomentInput(p) {
    var f = MOMENTS[p.kind], pick = useRef(null);
    var text = p.value == null ? '' : String(p.value);
    var native = text && validMoment(p.kind, text) ? (p.kind === 'timestamp' ? text.replace(' ', 'T') : text) : '';
    function open() { var el = pick.current; if (!el) return; try { el.showPicker(); } catch (e) { el.focus(); } }
    function chosen(v) {
      if (!v) return;
      if (p.kind === 'timestamp') v = v.replace('T', ' ');
      if (/(^|[ T])\d{2}:\d{2}$/.test(v)) v += ':00';
      p.onChange(v);
    }
    return h('div', { className: 'ss-moment' },
      h(Input, {
        mono: true, value: text, placeholder: p.placeholder || f.text, error: p.error, spellCheck: false, 'aria-label': p.column.name,
        onChange: function (e) { p.onChange(e.target.value); }, suffix: h(IconButton, { icon: 'clock', size: 'sm', label: 'Pick ' + f.word, onClick: open })
      }),
      h('input', { ref: pick, type: f.picker, step: 1, value: native, tabIndex: -1, 'aria-hidden': true, className: 'ss-moment-native', onChange: function (e) { chosen(e.target.value); } }));
  }

  // A foreign key is set by choosing a row of the table it points at: searched by its key or by what names it.
  function FkPicker(p) {
    var c = p.column, fk = c.fk, key = fk.column, rows = p.rows || [], label = p.table ? labelColumn(p.table) : null;
    var pop = usePopover(p.defaultOpen);
    var _q = useState(p.query || ''), q = _q[0], setQ = _q[1];
    var _a = useState(0), active = _a[0], setActive = _a[1];
    var listRef = useRef(null);
    var has = p.value !== undefined && p.value !== null && p.value !== '';
    var found = has ? rows.find(function (r) { return String(r[key]) === String(p.value); }) : null;
    var needle = q.trim().toLowerCase();
    var matches = needle ? rows.filter(function (r) { return String(r[key]).toLowerCase().indexOf(needle) >= 0 || (label && r[label] != null && String(r[label]).toLowerCase().indexOf(needle) >= 0); }) : rows;
    var list = matches.slice(0, 50);
    useEffect(function () { var el = listRef.current && listRef.current.querySelector('.is-active'); if (el) el.scrollIntoView({ block: 'nearest' }); }, [active, pop.open]);
    function pickRow(r) { p.onChange(r[key]); pop.set(false); setQ(''); }
    function onKey(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(list.length - 1, active + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(0, active - 1)); }
      else if (e.key === 'Enter' && !(e.metaKey || e.ctrlKey)) { e.preventDefault(); if (list[active]) pickRow(list[active]); }
      else if (e.key === 'Tab') pop.set(false);
    }
    return h('div', { className: 'ss-fkpick', ref: pop.ref },
      h('button', {
        type: 'button', className: cx('ss-fkpick-btn', p.error && 'is-error', pop.open && 'is-open'), 'aria-haspopup': 'listbox', 'aria-expanded': pop.open, 'aria-label': c.name,
        onClick: function () { if (!pop.open) { setQ(''); setActive(0); } pop.set(!pop.open); }
      },
        has
          ? h(Fragment, null, h('span', { className: 'ss-fkpick-key' }, fk.table + '.' + key + ' = ' + p.value), found && label && found[label] != null && h('span', { className: 'ss-fkpick-label' }, ' · ' + found[label]))
          : h('span', { className: 'ss-fkpick-ph' }, p.value === null ? 'NULL' : 'Choose a row in ' + fk.table),
        h(Icon, { name: 'chevrons-ud', size: 13 })),
      pop.open && h('div', { className: 'ss-pop ss-fkpick-pop' },
        h('div', { className: 'ss-fkpick-search' }, h(Input, { icon: 'search', size: 'sm', placeholder: 'Search ' + fk.table + '…', 'aria-label': 'Search ' + fk.table, value: q, autoFocus: true, onChange: function (e) { setQ(e.target.value); setActive(0); }, onKeyDown: onKey })),
        list.length
          ? h('div', { role: 'listbox', 'aria-label': fk.table, ref: listRef }, list.map(function (r, i) {
            return h('div', {
              key: i, role: 'option', 'aria-selected': has && String(r[key]) === String(p.value), className: cx('ss-pop-item', i === active && 'is-active'),
              onMouseEnter: function () { setActive(i); }, onMouseDown: function (e) { e.preventDefault(); pickRow(r); }
            }, h('span', null, String(r[key])), label && r[label] != null && h('small', null, String(r[label])));
          }))
          : h('div', { className: 'ss-fkpick-none' }, 'No row in ' + fk.table + ' matches "' + q.trim() + '".'),
        matches.length > list.length && h('div', { className: 'ss-fkpick-foot' }, list.length + ' of ' + countText(matches.length, 'row', 'rows'))));
  }

  var RECORD_TABS = [{ value: 'form', label: 'Form' }, { value: 'json', label: 'JSON' }, { value: 'related', label: 'Related records' }];

  function RecordEditor(p) {
    var table = p.table, tables = p.tables || NO_ROWS, data = p.data || NO_DATA, rows = data[table.name] || NO_ROWS;
    var mode = p.record ? 'edit' : 'new';
    var metas = useMemo(function () { return table.columns.map(function (c) { return fieldMeta(c, rows, data); }); }, [table, rows, data]);
    var base = useMemo(function () { return p.record || initialValues(table, metas); }, [p.record, table, metas]);
    var _d = useState(function () { return assign(base, p.draft); }), draft = _d[0], setDraft = _d[1];
    var _tab = useState(p.tab === 'related' && mode === 'new' ? 'form' : (p.tab || 'form')), tab = _tab[0], setTab = _tab[1];
    var _json = useState(function () { return p.jsonText != null ? p.jsonText : recordJson(table, metas, assign(base, p.draft)); }), jsonText = _json[0], setJsonText = _json[1];
    var _touched = useState({}), touched = _touched[0], setTouched = _touched[1];
    var _tried = useState(!!p.attempted), tried = _tried[0], setTried = _tried[1];
    var _rep = useState(!!p.validated), reportOn = _rep[0], setReportOn = _rep[1];
    var _conf = useState(!!p.confirmDiscard), confirm = _conf[0], setConfirm = _conf[1];
    var _w = useState(p.width || RECORD_W), width = _w[0], setWidth = _w[1];
    var _rel = useState(p.related || null), related = _rel[0], setRelated = _rel[1];
    var _cp = useState(null), copied = _cp[0], setCopied = _cp[1];
    var root = useRef(null);

    var changed = table.columns.filter(function (c, i) {
      return JSON.stringify(canon(c, metas[i], draft[c.name])) !== JSON.stringify(canon(c, metas[i], base[c.name]));
    }).map(function (c) { return c.name; });
    var parsed = tab === 'json' ? parseJson(jsonText) : null;
    var jsonOk = !parsed || (parsed.ok && isObject(parsed.value));
    var dirty = changed.length > 0 || !jsonOk;
    var errors = useMemo(function () { return validateRecord(table, draft, { rows: rows, record: p.record, data: data, mode: mode, metas: metas }); }, [table, draft, rows, data, mode, metas, p.record]);
    function visible(name) { return !!errors[name] && (mode === 'edit' || tried || touched[name] || changed.indexOf(name) >= 0); }
    var problems = table.columns.filter(function (c) { return visible(c.name); }).length;
    var rels = useMemo(function () { return mode === 'edit' ? relatedOf(table, p.record, tables, data) : { out: [], inn: [] }; }, [mode, table, p.record, tables, data]);
    var relTotal = rels.out.concat(rels.inn).reduce(function (n, r) { return n + r.rows.length; }, 0);
    var label = mode === 'edit' ? recordLabel(table, p.record) : table.name + ' · new';

    useEffect(function () { p.onDirty && p.onDirty(dirty, changed); }, [dirty, changed.join(',')]);
    useEffect(function () { return function () { p.onDirty && p.onDirty(false, []); }; }, []);
    useEffect(function () { if (p.autoFocus) focusField(null); }, []);

    function field(name) { return root.current && root.current.querySelector('[data-field="' + name + '"]'); }
    function focusField(name) {
      var scope = name ? field(name) : root.current && root.current.querySelector('.ss-rf:not(.is-generated)');
      var el = scope && scope.querySelector('.ss-input:not([readonly]), textarea, .ss-fkpick-btn, select, .ss-switch input');
      if (el) { el.focus(); if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }
    }
    function change(name, v) { setDraft(assign(draft, kv(name, v))); setTouched(assign(touched, kv(name, true))); setReportOn(false); }
    function editJson(text) {
      setJsonText(text); setReportOn(false);
      var r = parseJson(text);
      if (r.ok && isObject(r.value)) setDraft(fromJson(table, metas, draft, r.value));
    }
    function gotoLine(n) {
      var ta = root.current && root.current.querySelector('.ss-rec-editor textarea');
      if (!ta) return;
      var at = 0, k;
      for (k = 1; k < n; k++) { var nl = jsonText.indexOf('\n', at); if (nl < 0) break; at = nl + 1; }
      ta.focus(); ta.setSelectionRange(at, at);
    }
    function goTab(t) {
      if (t === tab) return;
      if (tab === 'json' && !jsonOk) { gotoLine(parsed.ok ? 1 : parsed.line); return; }
      if (t === 'json') setJsonText(recordJson(table, metas, draft));
      setTab(t);
    }
    function onTabKey(e, i) {
      var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      var n = (i + step + RECORD_TABS.length) % RECORD_TABS.length;
      e.currentTarget.parentNode.children[n].focus();
    }
    function requestClose() { if (dirty) setConfirm(true); else p.onClose && p.onClose(); }
    function discard() { setConfirm(false); p.onClose && p.onClose(); }
    function save() {
      if (confirm) return;
      if (tab === 'json' && !jsonOk) { gotoLine(parsed.ok ? 1 : parsed.line); return; }
      var bad = table.columns.filter(function (c) { return errors[c.name]; });
      if (bad.length) {
        setTried(true);
        if (tab === 'json') setReportOn(true); else if (tab === 'form') focusField(bad[0].name); else setTab('form');
        return;
      }
      if (mode === 'edit' && !dirty) return;
      p.onSave && p.onSave(toRecord(table, metas, draft));
    }
    function onKey(e) {
      var mod = e.metaKey || e.ctrlKey;
      if (confirm) { if (mod && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); discard(); } return; }
      if (mod && ((e.key.toLowerCase() === 's' && mode === 'edit') || e.key === 'Enter')) { e.preventDefault(); e.stopPropagation(); save(); }
      else if (e.key === 'Escape') { e.stopPropagation(); requestClose(); }
    }
    function copy(name, text) {
      copyText(text); setCopied(name);
      setTimeout(function () { setCopied(function (c) { return c === name ? null : c; }); }, 1200);
    }
    function resize(w) { setWidth(w); p.onWidth && p.onWidth(w); }

    // ---- the form
    function renderField(c, i) {
      var meta = metas[i], kind = meta.kind, v = draft[c.name], err = visible(c.name) ? errors[c.name] : null, generated = kind === 'generated';
      var nullOn = canon(c, meta, v) === null, isChanged = changed.indexOf(c.name) >= 0, ctl;
      var ph = v === null ? 'NULL' : v === undefined ? (c.default || '') : '';
      var scale = typeScale(c.type), shown = v == null ? '' : typeof v === 'number' && scale != null ? v.toFixed(scale) : String(v);
      function set(x) { change(c.name, x); }
      if (generated) ctl = h(Input, { mono: true, icon: 'lock', readOnly: true, value: v == null ? '' : String(v), placeholder: 'DEFAULT', 'aria-label': c.name });
      else if (kind === 'boolean') ctl = h(Switch, { checked: v === true, ariaLabel: c.name, onChange: set, label: h('span', { className: cx('ss-mono', v == null && 'ss-faint'), style: { fontSize: 12 } }, v == null ? (v === null ? 'NULL' : 'DEFAULT') : String(v)) });
      else if (kind === 'time') ctl = h(MomentInput, { column: c, kind: meta.moment, value: v, placeholder: ph, error: !!err, onChange: set });
      else if (kind === 'enum') {
        var cur = v == null ? '' : String(v), opts = meta.options.map(function (o) { return { value: o, label: o }; });
        if (cur !== '' && meta.options.indexOf(cur) < 0) opts.push({ value: cur, label: cur });
        if (cur === '') opts.unshift({ value: '', label: v === null ? 'NULL' : v === undefined && c.default ? c.default : 'Choose a value' });
        ctl = h('div', { className: cx(err && 'ss-rf-err') }, h(Select, { mono: true, value: cur, label: c.name, options: opts, onChange: set }));
      } else if (kind === 'json') {
        var jr = v == null || v === '' ? null : parseJson(String(v));
        ctl = h(SqlEditor, { language: 'json', value: v == null ? '' : String(v), onChange: set, height: 120, errorLine: err && jr && !jr.ok ? jr.line : null, label: c.name, placeholder: v === null ? 'NULL' : '' });
      } else if (kind === 'reference') {
        ctl = h(FkPicker, { column: c, value: v, rows: data[c.fk.table], table: tables.find(function (t) { return t.name === c.fk.table; }), error: !!err, defaultOpen: p.picking === c.name, query: p.picking === c.name ? p.pickQuery : undefined, onChange: set });
      } else if (kind === 'longtext') {
        ctl = h('textarea', { className: cx('ss-input ss-input--mono', err && 'ss-input--error'), rows: 3, spellCheck: false, value: v == null ? '' : String(v), placeholder: ph, 'aria-label': c.name, 'aria-invalid': err ? true : undefined, onChange: function (e) { set(e.target.value); } });
      } else {
        ctl = h(Input, { mono: true, value: shown, placeholder: ph, error: !!err, spellCheck: false, 'aria-label': c.name, inputMode: kind === 'number' ? (isIntegerType(c.type) ? 'numeric' : 'decimal') : undefined, onChange: function (e) { set(e.target.value); } });
      }
      function toggleNull() {
        if (!nullOn) set(null);
        else if (isTextKind(meta)) set('');
        else if (kind === 'boolean') set(false);
        else if (kind === 'enum') set(meta.options[0]);
        else focusField(c.name);
      }
      var nullBtn = c.nullable && !c.pk && !generated && h(Button, { size: 'sm', active: nullOn, 'aria-pressed': nullOn, title: 'Set to NULL', onClick: toggleNull }, 'NULL');
      var glyph = c.pk ? h(Icon, { name: 'key', size: 12, className: 'ss-grid-key is-pk', label: 'Primary key' }) : c.fk ? h(Icon, { name: 'link', size: 12, className: 'ss-grid-key is-fk', label: 'Foreign key' }) : null;
      var isCopied = copied === c.name;
      var copyBtn = h(IconButton, { className: cx('ss-rf-copy', isCopied && 'is-copied'), icon: isCopied ? 'check' : 'copy', size: 'sm', label: isCopied ? 'Copied' : 'Copy value', disabled: v == null || v === '', onClick: function () { copy(c.name, String(v)); } });
      return h('div', { key: c.name, className: cx('ss-rf', generated && 'is-generated'), 'data-field': c.name },
        h(Field, { label: h('span', { className: 'ss-rf-name' }, glyph, c.name, isChanged && h('span', { className: 'ss-dirty-dot', title: 'Changed' })), error: err, hint: generated ? 'Generated by the database' : undefined },
          h('div', { className: 'ss-rf-type' }, typeLine(c)),
          h('div', { className: cx('ss-rf-row', (kind === 'json' || kind === 'longtext') && 'ss-rf-row--top') }, h('div', { className: 'ss-rf-grow' }, ctl), nullBtn)),
        copyBtn);
    }

    // ---- the JSON
    function jsonBody() {
      var obj = parsed && parsed.ok && isObject(parsed.value) ? parsed.value : null;
      var notes = obj ? jsonNotes(table, metas, draft, obj) : [];
      var bad = Object.keys(errors);
      return h('div', { className: 'ss-rec-json' },
        h('div', { className: 'ss-rec-tools' },
          h(Button, { size: 'sm', icon: 'code', disabled: !jsonOk, onClick: function () { setJsonText(JSON.stringify(parsed.value, null, 2)); } }, 'Format'),
          h(Button, { size: 'sm', icon: copied === '__json' ? 'check' : 'copy', onClick: function () { copy('__json', jsonText); } }, copied === '__json' ? 'Copied' : 'Copy'),
          h(Button, { size: 'sm', icon: 'check-circle', onClick: function () { setReportOn(true); } }, 'Validate')),
        h('div', { className: 'ss-rec-editor' }, h(SqlEditor, { language: 'json', value: jsonText, onChange: editJson, label: 'Record as JSON', errorLine: parsed && !parsed.ok ? parsed.line : null, style: { height: 'auto', flex: '1 1 0', minHeight: 0 } })),
        parsed && !parsed.ok && h('div', { className: 'ss-parse is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 16 }), h('span', null, 'Invalid JSON near line ' + parsed.line + '.'), h('a', { onClick: function () { gotoLine(parsed.line); } }, 'Go to line')),
        parsed && parsed.ok && !obj && h('div', { className: 'ss-parse is-error', role: 'alert' }, h(Icon, { name: 'alert', size: 16 }), h('span', null, 'A record must be a JSON object.')),
        notes.map(function (n, i) { return h('div', { key: 'n' + i, className: 'ss-parse ss-parse--warn' }, h(Icon, { name: 'warning', size: 16 }), h('span', null, n)); }),
        reportOn && obj && (bad.length
          ? h(Alert, { tone: 'error', title: countText(bad.length, 'problem', 'problems') }, bad.map(function (n) { return h('div', { key: n }, h('code', null, n), ' ' + errors[n]); }))
          : h(Alert, { tone: 'success', title: 'No problems' }, 'All ' + countText(table.columns.length, 'column', 'columns') + ' are valid.')));
    }

    // ---- the related records
    function relItem(r) {
      var open = related === r.key, n = r.rows.length;
      return h('div', { key: r.key, className: cx('ss-rel', open && 'is-open') },
        h('button', { type: 'button', className: 'ss-rel-head', 'aria-expanded': open, disabled: !n, onClick: function () { setRelated(open ? null : r.key); } },
          h(Icon, { name: 'chevron-down', size: 14 }),
          h('span', { className: 'ss-rel-name' }, r.dir === 'in' ? r.from : h(Fragment, null, r.from, h('span', { className: 'ss-faint' }, ' → '), r.to), h('span', { className: 'ss-faint' }, ' · ' + countText(n, 'row', 'rows')))),
        open && h('div', { className: 'ss-rel-body' },
          h(DataGrid, { columns: r.columns, rows: r.rows.slice(0, 50), density: 'compact', selectable: false, label: r.table }),
          n > 50 && h('div', { className: 'ss-rel-foot' }, '50 of ' + countText(n, 'row', 'rows'))));
    }
    function relGroup(title, list, none) {
      return h('section', { key: title, className: 'ss-pane-group', 'aria-label': title },
        h('div', { className: 'ss-row' }, h('span', { className: 'ss-caption' }, title), h('span', { className: 'ss-tl-count' }, list.length)),
        list.length ? h('div', { className: 'ss-rel-list' }, list.map(relItem)) : h('div', { className: 'ss-pane-none' }, none));
    }

    var body = tab === 'json' ? jsonBody()
      : tab === 'related' ? h(Fragment, null, relGroup('References', rels.out, table.name + ' has no foreign keys.'), relGroup('Referenced by', rels.inn, 'No table references ' + table.name + '.'))
        : table.columns.map(renderField);

    return h(Fragment, null,
      h(ResizeHandle, { label: 'Resize record editor', edge: 'left', width: width, min: RECORD_MIN, max: RECORD_MAX, onResize: resize, onReset: function () { resize(RECORD_W); } }),
      h('aside', { ref: root, className: 'ss-recedit', 'aria-label': 'Record editor', style: { width: width }, onKeyDown: onKey },
        h('div', { className: 'ss-tbh ss-rec-head' },
          h('div', { className: 'ss-tbh-row' },
            h('div', { className: 'ss-rec-titles' }, h('h2', { className: 'ss-rec-title' }, mode === 'edit' ? 'Edit record' : 'New record'), h('div', { className: 'ss-rec-sub', title: label }, label)),
            h('span', { className: 'ss-spacer' }),
            dirty && h(SaveStatus, { state: 'dirty' }),
            h(IconButton, { icon: 'x', label: 'Close (Esc)', onClick: requestClose })),
          h('div', { className: 'ss-tabs', role: 'tablist', 'aria-label': 'Record views' }, RECORD_TABS.map(function (x, i) {
            var on = tab === x.value, off = x.value === 'related' && mode === 'new';
            return h('button', {
              key: x.value, type: 'button', role: 'tab', 'aria-selected': on, tabIndex: on ? 0 : -1, disabled: off, title: off ? 'A new record has no related records yet.' : undefined, className: cx('ss-tab', on && 'is-active'),
              onClick: function () { goTab(x.value); }, onKeyDown: function (e) { onTabKey(e, i); }
            }, x.label, x.value === 'related' && mode === 'edit' && h('span', { className: 'ss-tab-count' }, relTotal));
          }))),
        h('div', { className: cx('ss-rec-body', tab === 'json' && 'is-json'), role: 'tabpanel', 'aria-label': RECORD_TABS.find(function (x) { return x.value === tab; }).label }, body),
        h('div', { className: 'ss-modal-foot ss-rec-foot' },
          problems > 0 && h('span', { className: 'ss-rec-problems' }, countText(problems, 'problem', 'problems')),
          h('span', { className: 'ss-spacer' }),
          h(Button, { onClick: requestClose, kbd: 'Esc' }, 'Cancel'),
          h(Button, { variant: 'primary', disabled: mode === 'edit' && !dirty, kbd: mode === 'edit' ? ['⌘', 'S'] : ['⌘', '⏎'], onClick: save }, mode === 'edit' ? 'Save changes' : 'Create record')),
        confirm && h(ConfirmDialog, {
          title: mode === 'edit' ? 'Discard changes to ' + label + '?' : 'Discard the new record in "' + table.name + '"?', danger: true, confirmLabel: 'Discard changes', cancelLabel: 'Keep editing',
          onCancel: function () { setConfirm(false); }, onConfirm: discard
        },
          h('div', { style: { color: 'var(--ink-2)' } }, changed.length
            ? h(Fragment, null, countText(changed.length, 'changed column', 'changed columns') + ' will be lost: ', h('code', { className: 'ss-mono', style: { color: 'var(--ink-1)' } }, changed.join(', ')), '.')
            : 'The edited JSON will be lost.'))));
  }

  // ------------------------------------------------------------------ records: import
  // Everything Import Records does with data is in this section and none of it needs React: it reads a CSV or JSON file, matches
  // the columns of the file to the columns of a table, converts and checks each row the way the database would, and plays the
  // import. The dialog below only shows it. Exported for the port and its tests: parseCsv, readRecordsFile, matchColumns,
  // analyzeImport, runImport, importReport.
  var IMPORT_MAX = 50 * 1024 * 1024;
  var DELIMITERS = [{ value: ',', label: 'Comma' }, { value: ';', label: 'Semicolon' }, { value: '\t', label: 'Tab' }, { value: '|', label: 'Pipe' }];
  var DELIMITER_NAME = { ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' };
  // `mode`: insert | upsert | skip. `key`: the unique column an upsert goes by (the first one that is filled when empty).
  var IMPORT_DEFAULTS = { mode: 'insert', key: '', emptyNull: true, skipInvalid: true, checkFk: true, stopOnError: false, oneTx: true };
  var IMPORT_STEPS = ['Source', 'Map columns', 'Settings', 'Review & import'];
  var IMPORT_KEYS = ['source', 'map', 'settings', 'review'];

  // --- the file
  // CSV as RFC 4180 reads it: a quoted cell may hold the delimiter, quotes ("") and line breaks; blank lines are skipped.
  // `lines[i]` is the line of the file where row i begins; `unclosed` is the line of a quote that never closes (0 when none).
  function parseCsv(text, delimiter) {
    var d = delimiter || ',', rows = [], lines = [], row = [], cell = '', quoted = false, line = 1, start = 1, i = text.charCodeAt(0) === 0xFEFF ? 1 : 0;
    function endRow() {
      row.push(cell); cell = '';
      if (row.length > 1 || row[0] !== '') { rows.push(row); lines.push(start); }
      row = [];
    }
    for (; i < text.length; i++) {
      var ch = text[i];
      if (quoted) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
        else { if (ch === '\n') line++; cell += ch; }
      } else if (ch === '"' && cell === '') quoted = true;
      else if (ch === d) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        endRow(); line++; start = line;
      } else cell += ch;
    }
    var unclosed = quoted ? start : 0;
    if (cell !== '' || row.length) endRow();
    return { rows: rows, lines: lines, unclosed: unclosed };
  }
  // The delimiter that splits the first lines into the same number of cells, most of them.
  function sniffDelimiter(text) {
    var sample = text.replace(/^﻿/, '').split(/\r\n|\n|\r/).filter(function (l) { return l.trim() !== ''; }).slice(0, 6);
    var best = ',', top = 0;
    DELIMITERS.forEach(function (d) {
      var low = Math.min.apply(null, sample.map(function (l) { return l.split(d.value).length - 1; }).concat([Infinity]));
      if (low !== Infinity && low > top) { top = low; best = d.value; }
    });
    return best;
  }
  // A first row of names: every cell filled, different from the others, and not a number, a date or an address.
  function looksLikeHeader(row) {
    var seen = {};
    return row.length > 0 && row.every(function (c) {
      var t = c.trim().toLowerCase();
      if (!t || seen[t] || /^[-+]?[\d.,]+$/.test(t) || /^\d{4}-\d{2}-\d{2}/.test(t) || t.indexOf('@') >= 0) return false;
      seen[t] = true; return true;
    });
  }
  function uniqueNames(names) {
    var seen = {};
    return names.map(function (n, i) {
      var name = n.trim() || 'column_' + (i + 1), k = name, c = 2;
      while (seen[k]) k = name + '_' + c++;
      seen[k] = true; return k;
    });
  }
  // A CSV or JSON text as `{ format, delimiter, header, columns, rows, at, unit, error }`. A row is an array of cells in the order of
  // the columns: strings for CSV; for JSON a number or boolean keeps its type, null stays null and an object becomes JSON text.
  // `at[i]` is where row i is in the file (its line for CSV, its place in the array for JSON; `unit` says which).
  // `o.delimiter` and `o.header` override what is found. When the text cannot be read `error` says why and there are no rows.
  function readRecordsFile(text, o) {
    o = o || {};
    var none = { format: 'csv', delimiter: ',', header: true, columns: [], rows: [], at: [], unit: 'line', error: null };
    if (!text || !text.trim()) return assign(none, { error: 'The file is empty.' });
    if (/^\s*[\[{]/.test(text)) {
      var j = assign(none, { format: 'json', delimiter: null, unit: 'row' }), r = parseJson(text);
      if (!r.ok) return assign(j, { error: 'Unable to parse JSON near line ' + r.line + '.' });
      var list = Array.isArray(r.value) ? r.value : isObject(r.value) ? [r.value] : null;
      if (!list || !list.length || !list.every(isObject)) return assign(j, { error: 'Expected an array of objects.' });
      var names = [];
      list.forEach(function (item) { Object.keys(item).forEach(function (k) { if (names.indexOf(k) < 0) names.push(k); }); });
      var jrows = list.map(function (item) {
        return names.map(function (k) { var v = item[k]; return v === undefined ? null : isObject(v) || Array.isArray(v) ? JSON.stringify(v) : v; });
      });
      return assign(j, { columns: names, rows: jrows, at: jrows.map(function (_, i) { return i + 1; }) });
    }
    var delimiter = o.delimiter || sniffDelimiter(text), parsed = parseCsv(text, delimiter);
    if (parsed.unclosed) return assign(none, { delimiter: delimiter, error: 'Unable to parse CSV near line ' + parsed.unclosed + '.' });
    if (!parsed.rows.length) return assign(none, { delimiter: delimiter, error: 'The file is empty.' });
    var header = o.header == null ? looksLikeHeader(parsed.rows[0]) : !!o.header;
    var width = parsed.rows.reduce(function (m, r2) { return Math.max(m, r2.length); }, 0);
    var first = header ? parsed.rows[0] : [];
    var columns = uniqueNames(Array.from({ length: width }, function (_, i) { return i < first.length ? first[i] : ''; }));
    var body = parsed.rows.slice(header ? 1 : 0);
    return {
      format: 'csv', delimiter: delimiter, header: header, columns: columns, unit: 'line', error: null,
      rows: body.map(function (r2) { return columns.map(function (_, i) { return i < r2.length ? r2[i] : ''; }); }), at: parsed.lines.slice(header ? 1 : 0)
    };
  }
  // `CSV · UTF-8 · comma · 1,000 rows · header row`
  function describeSource(src) {
    var rows = countText(src.rows.length, 'row', 'rows');
    return src.format === 'json' ? 'JSON · UTF-8 · ' + rows + ' · ' + countText(src.columns.length, 'key', 'keys')
      : 'CSV · UTF-8 · ' + DELIMITER_NAME[src.delimiter] + ' · ' + rows + ' · ' + (src.header ? 'header row' : 'no header row');
  }
  function formatBytes(n) { return n < 1024 ? n + ' B' : n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
  function sampleCells(src, k, n) {
    var out = [];
    for (var i = 0; i < src.rows.length && out.length < n; i++) {
      var v = src.rows[i][k];
      if (v !== null && v !== undefined && String(v).trim() !== '') out.push(v);
    }
    return out;
  }

  // --- one cell as the value of a column
  function pad2(s) { return ('0' + s).slice(-2); }
  // A date, a time or a timestamp as SQL writes it; null when the text is not one. `2026-03-14` is a timestamp at midnight, a time zone is dropped.
  function importMoment(kind, text) {
    var s = String(text).trim(), m;
    if (kind === 'time') {
      m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
      var t = m && pad2(m[1]) + ':' + m[2] + ':' + (m[3] || '00');
      return t && validMoment('time', t) ? t : null;
    }
    m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/.exec(s);
    if (!m) return null;
    var day = m[1] + '-' + m[2] + '-' + m[3];
    if (kind === 'date') return validMoment('date', day) ? day : null;
    var stamp = day + ' ' + (m[4] || '00') + ':' + (m[5] || '00') + ':' + (m[6] || '00');
    return validMoment('timestamp', stamp) ? stamp : null;
  }
  function looksLikeDates(src, k, kind) {
    var cells = sampleCells(src, k, 50);
    return cells.length > 0 && cells.filter(function (v) { return importMoment(kind, v) !== null; }).length >= cells.length * 0.9;
  }
  var TRUE_WORDS = ['true', 't', 'yes', 'y', '1'], FALSE_WORDS = ['false', 'f', 'no', 'n', '0'];
  function bad(kind, message) { return { kind: kind, message: message }; }
  // One cell of the file as the value of column `c`: `{ value, problem }`. `value` is undefined where the default of the column fills in.
  // `problem.kind` is what the review groups by: required, type or date. `o.emptyNull`: an empty cell is NULL (in a text column it is otherwise '').
  function importCell(c, meta, raw, o) {
    var textual = isTextKind(meta) || meta.kind === 'enum' || (meta.kind === 'reference' && cellKind(c.type) === 'text');
    var blank = raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '' && (o.emptyNull || !textual));
    if (blank) {
      if (c.nullable && !c.pk) return { value: null };
      if (c.default) return { value: undefined };
      return { value: null, problem: bad('required', 'Column "' + c.name + '" cannot be NULL.') };
    }
    var text = typeof raw === 'string' ? raw : typeof raw === 'object' ? JSON.stringify(raw) : String(raw), max, w;
    if (meta.kind === 'number' || (meta.kind === 'reference' && cellKind(c.type) === 'number')) {
      var s = text.trim();
      if (typeof raw !== 'number' && !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s)) return { value: raw, problem: bad('type', 'Value must be a number.') };
      var n = typeof raw === 'number' ? raw : Number(s);
      if (!isFinite(n)) return { value: raw, problem: bad('type', 'Value must be a number.') };
      if (isIntegerType(c.type) && !Number.isInteger(n)) return { value: raw, problem: bad('type', 'Value must be a whole number.') };
      var scale = typeScale(c.type);
      if (scale != null && (s.split('.')[1] || '').length > scale) return { value: raw, problem: bad('type', 'Value has more than ' + scale + ' decimal places.') };
      return { value: n };
    }
    if (meta.kind === 'boolean') {
      if (typeof raw === 'boolean') return { value: raw };
      w = text.trim().toLowerCase();
      if (TRUE_WORDS.indexOf(w) >= 0) return { value: true };
      if (FALSE_WORDS.indexOf(w) >= 0) return { value: false };
      return { value: raw, problem: bad('type', 'Value must be true or false.') };
    }
    if (meta.kind === 'time') {
      var moment = importMoment(meta.moment, text);
      return moment ? { value: moment } : { value: raw, problem: bad('date', 'Invalid ' + MOMENTS[meta.moment].word + ' format.') };
    }
    if (meta.kind === 'json') {
      var parsed = parseJson(text);
      return parsed.ok ? { value: text } : { value: raw, problem: bad('type', 'Invalid JSON near line ' + parsed.line + '.') };
    }
    if (meta.kind === 'enum' && meta.fixed && meta.options.indexOf(text) < 0) return { value: raw, problem: bad('type', 'Value must be one of ' + meta.options.join(', ') + '.') };
    max = typeLength(c.type);
    if (max != null && text.length > max) return { value: raw, problem: bad('type', 'Value is longer than ' + max + ' characters.') };
    return { value: text };
  }

  // --- which column of the file fills which column of the table
  function words(name) { return String(name).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); }
  // The mapping the dialog starts from, `{ [column of the table]: { from, by, why } }`. `from` is a column of the file, '' (ignore) or '=' (a constant,
  // kept in `value`). A column the database generates is never filled. Matched, in this order: the same name; a name that holds the name
  // (`full_name` for `name`); the one date column of the file for the one date column of the table (`signup_date` for `created_at`).
  function matchColumns(table, src, data) {
    var rows = (data && data[table.name]) || [], used = {}, out = {}, names = src.columns;
    table.columns.forEach(function (c) { out[c.name] = { from: '', by: 'auto' }; });
    var open = table.columns.filter(function (c) { return !isGenerated(c); });
    function take(c, i, why) { out[c.name] = { from: names[i], by: 'auto', why: why }; used[i] = true; }
    open.forEach(function (c) {
      var i = names.findIndex(function (n, k) { return !used[k] && words(n).join('') === words(c.name).join(''); });
      if (i >= 0) take(c, i, 'Same name');
    });
    open.forEach(function (c) {
      if (out[c.name].from) return;
      var cw = words(c.name), i = names.findIndex(function (n, k) { var w = words(n); return !used[k] && cw.every(function (x) { return w.indexOf(x) >= 0; }); });
      if (i >= 0) take(c, i, 'Similar name');
    });
    var dates = open.filter(function (c) { return !out[c.name].from && fieldMeta(c, rows, data).kind === 'time'; });
    if (dates.length === 1) {
      var kind = fieldMeta(dates[0], rows, data).moment;
      var like = names.map(function (_, k) { return k; }).filter(function (k) { return !used[k] && looksLikeDates(src, k, kind); });
      if (like.length === 1) take(dates[0], like[0], 'Same type');
    }
    return out;
  }

  // --- the rows, checked
  // What the import would do with each row of the file, as the database would take it. `mapping` is the one of matchColumns; `settings` has the
  // keys of IMPORT_DEFAULTS; `data` holds the rows of every table (the unique keys and foreign keys are checked against them).
  // Returns `{ rows, groups, counts, filled, missing, keys, key }`:
  //  - rows[i] = { line, index, kind, values, problems, conflict, match }. `kind` is insert, update, skip (a duplicate left out on purpose),
  //    conflict (a duplicate that insert-only cannot take: a warning) or invalid (an error). `values` has what is written; a column left out
  //    of it takes its default.
  //  - groups = { required, duplicate, type, fk, date }: the problems of each kind as { line, column, value, message }.
  //  - counts = { total, valid (insert + update), insert, update, skip, warnings, errors }.
  //  - filled: the columns that get a value from the file or a constant. missing: required columns nothing fills (an error on every row).
  function analyzeImport(table, src, mapping, settings, data) {
    var set = assign(IMPORT_DEFAULTS, settings), existing = (data && data[table.name]) || [], cols = table.columns;
    var metas = cols.map(function (c) { return fieldMeta(c, existing, data); });
    var feeds = cols.map(function (c) {
      var m = mapping[c.name];
      if (isGenerated(c) || !m || !m.from) return null;
      if (m.from === '=') return { constant: m.value == null ? '' : m.value };
      var at = src.columns.indexOf(m.from);
      return at < 0 ? null : { at: at };
    });
    var keyIdx = [], filled = [], missing = [];
    cols.forEach(function (c, i) {
      if (feeds[i]) { filled.push(c.name); if (uniqueKeys(table, c)) keyIdx.push(i); }
      else if (!isGenerated(c) && !c.nullable && !c.default) missing.push(c.name);
    });
    var keys = keyIdx.map(function (i) { return cols[i].name; });
    var key = keys.indexOf(set.key) >= 0 ? set.key : keys[0] || '';
    var known = {}, seen = {}, fkSets = {};
    keys.forEach(function (name) {
      known[name] = {}; seen[name] = {};
      existing.forEach(function (r) { if (r[name] != null) known[name][String(r[name])] = r; });
    });
    function fkHas(c, v) {
      var id = c.name;
      if (!fkSets[id]) { fkSets[id] = {}; data[c.fk.table].forEach(function (r) { if (r[c.fk.column] != null) fkSets[id][String(r[c.fk.column])] = true; }); }
      return !!fkSets[id][String(v)];
    }
    var groups = { required: [], duplicate: [], type: [], fk: [], date: [] };
    var counts = { total: src.rows.length, valid: 0, insert: 0, update: 0, skip: 0, warnings: 0, errors: 0 };
    var rows = src.rows.map(function (cells, k) {
      var line = src.at[k], values = {}, problems = [], conflict = null, kind, match = null;
      cols.forEach(function (c, i) {
        if (isGenerated(c)) return;
        var f = feeds[i];
        if (!f) {
          if (!c.nullable && !c.default) problems.push({ column: c.name, kind: 'required', value: null, message: 'Column "' + c.name + '" cannot be NULL.' });
          return;
        }
        var raw = f.constant !== undefined ? f.constant : cells[f.at], res = importCell(c, metas[i], raw, set);
        if (res.problem) { problems.push({ column: c.name, kind: res.problem.kind, value: res.problem.kind === 'required' ? null : raw, message: res.problem.message }); return; }
        if (res.value !== undefined) values[c.name] = res.value;
        if (res.value != null && c.fk && set.checkFk && data && Array.isArray(data[c.fk.table]) && !fkHas(c, res.value)) {
          problems.push({ column: c.name, kind: 'fk', value: res.value, message: 'No row in ' + c.fk.table + ' has ' + c.fk.column + ' ' + res.value + '.' });
        }
      });
      if (!problems.length) {
        keys.forEach(function (name) {
          var v = values[name];
          if (v == null || conflict) return;
          var id = String(v);
          if (seen[name][id] != null) conflict = { column: name, repeat: true, message: 'A row with ' + name + ' "' + id + '" appears on line ' + seen[name][id] + '.' };
          else if (known[name][id]) conflict = { column: name, row: known[name][id], message: 'A row with ' + name + ' "' + id + '" already exists.' };
        });
      }
      if (problems.length) kind = 'invalid';
      else if (conflict) kind = set.mode === 'skip' ? 'skip' : set.mode === 'upsert' && conflict.row && conflict.column === key ? 'update' : 'conflict';
      else kind = 'insert';
      if (kind === 'update') match = conflict.row;
      if (kind === 'insert' || kind === 'update') keys.forEach(function (name) { if (values[name] != null) seen[name][String(values[name])] = line; });
      problems.forEach(function (pr) { groups[pr.kind].push({ line: line, column: pr.column, value: pr.value, message: pr.message }); });
      if (conflict && !problems.length) groups.duplicate.push({ line: line, column: conflict.column, value: values[conflict.column], message: conflict.message, kind: kind });
      if (kind === 'insert' || kind === 'update' || kind === 'skip') counts[kind]++;
      else if (kind === 'conflict') counts.warnings++;
      else counts.errors++;
      return { line: line, index: k, kind: kind, values: values, problems: problems, conflict: conflict, match: match };
    });
    counts.valid = counts.insert + counts.update;
    return { rows: rows, groups: groups, counts: counts, filled: filled, missing: missing, keys: keys, key: key };
  }
  // The rows a group touches, once each.
  function groupRows(items) { var seenLine = {}, n = 0; items.forEach(function (it) { if (!seenLine[it.line]) { seenLine[it.line] = true; n++; } }); return n; }
  // `1,000 rows · 985 valid · 10 warnings · 5 errors`
  function importSummary(c) {
    var parts = [countText(c.total, 'row', 'rows'), c.valid.toLocaleString('en-US') + ' valid', countText(c.warnings, 'warning', 'warnings'), countText(c.errors, 'error', 'errors')];
    if (c.skip) parts.push(c.skip.toLocaleString('en-US') + ' skipped');
    return parts.join(' · ');
  }
  // Plays the import over the rows of analyzeImport for the first `limit` rows (all when it is left out). `fail = { line, message }` makes the
  // database refuse that row (a clash that appeared after the check). A transaction (or stopping on the first error) ends the run there; a
  // transaction that ended on an error writes nothing. `cancelled` ends the run where it is, with the same rule for a transaction.
  // Returns { processed, inserted, updated, skipped, failed, error, stopped, rolledBack, insert, update }; insert and update list what was written.
  function runImport(analysis, settings, fail, limit, cancelled) {
    var set = assign(IMPORT_DEFAULTS, settings), stop = set.oneTx || set.stopOnError;
    var out = { processed: 0, inserted: 0, updated: 0, skipped: 0, failed: 0, error: null, stopped: false, rolledBack: false, insert: [], update: [] };
    var rows = analysis.rows, max = limit == null ? rows.length : Math.min(limit, rows.length);
    for (var i = 0; i < max; i++) {
      var r = rows[i];
      out.processed++;
      if (r.kind !== 'insert' && r.kind !== 'update') { out.skipped++; continue; }
      if (fail && r.line === fail.line) {
        out.failed++; out.error = fail;
        if (stop) { out.stopped = true; break; }
        continue;
      }
      if (r.kind === 'insert') { out.inserted++; out.insert.push(r.values); } else { out.updated++; out.update.push({ match: r.match, values: r.values }); }
    }
    if (set.oneTx && (out.stopped || cancelled)) {
      out.rolledBack = out.inserted + out.updated > 0;
      out.inserted = 0; out.updated = 0; out.insert = []; out.update = [];
    }
    return out;
  }
  function csvCell(v) { var s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  // The error report: a CSV of every row that was left out or refused, with its line, the column and the reason. English, like any file the app writes.
  function importReport(analysis, outcome) {
    var lines = ['line,column,value,reason'], items = [];
    ['required', 'duplicate', 'type', 'fk', 'date'].forEach(function (k) { analysis.groups[k].forEach(function (it) { items.push(it); }); });
    if (outcome && outcome.error) items.push({ line: outcome.error.line, column: '', value: '', message: outcome.error.message });
    items.sort(function (a, b) { return a.line - b.line; });
    items.forEach(function (it) { lines.push([it.line, it.column, it.value, it.message].map(csvCell).join(',')); });
    return lines.join('\n') + '\n';
  }
  function saveText(name, text, type) {
    try {
      var url = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' })), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) { /* no download here */ }
  }

  // --- users_import.csv: 1,000 rows made on the spot, the same every time. Against the users of the sample: 2 empty emails, 2 impossible dates and
  // 1 name over 255 characters (5 errors), and 10 emails that already belong to a user (10 duplicates). Row i is line i + 2; line 1 is the header.
  var SAMPLE_CSV = (function () {
    var DAY = 86400000;
    var first = ['An', 'Binh', 'Chi', 'Dung', 'Giang', 'Ha', 'Hieu', 'Khanh', 'Lan', 'Minh', 'Nam', 'Phuong', 'Quang', 'Thao', 'Trang', 'Vy'];
    var last = ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vo', 'Dang', 'Bui', 'Do', 'Ngo'];
    var countries = ['VN', 'US', 'DE', 'JP', 'BR', 'FR', 'IN', 'GB', 'SG', 'CA'];
    var users = SAMPLE_RECORDS.users;
    var noEmail = { 3: true, 416: true }, badDate = { 7: '2026-02-30', 622: '14/03/2026' }, longName = 789;
    var clash = { 11: 1, 56: 3, 130: 4, 244: 6, 359: 8, 471: 10, 580: 12, 702: 14, 855: 15, 931: 17 };
    var out = ['email,full_name,country_code,signup_date'];
    for (var i = 0; i < 1000; i++) {
      var f = first[(i * 7) % first.length], l = last[(i * 3 + Math.floor(i / 16)) % last.length], name = f + ' ' + l;
      var email = f.toLowerCase() + '.' + l.toLowerCase() + (i + 1) + '@example.com';
      var day = new Date(Date.UTC(2024, 0, 1) + Math.round(i * 0.78) * DAY).toISOString().slice(0, 10);
      var date = i % 7 === 2 ? day + ' ' + pad2(7 + i % 12) + ':' + pad2((i * 7) % 60) + ':' + pad2((i * 13) % 60) : day;
      if (noEmail[i]) email = '';
      if (clash[i] !== undefined) email = users[clash[i]].email;
      if (badDate[i]) date = badDate[i];
      if (i === longName) name = (name + ' ').repeat(40).slice(0, 300);
      out.push([email, name, countries[(i * 5) % countries.length], date].join(','));
    }
    return out.join('\n') + '\n';
  })();

  // ------------------------------------------------------------------ steps and progress
  // The numbered steps of a dialog that is a path (Import Records). A step that is done can be gone back to (`onStep(i)`); the ones ahead cannot.
  function Stepper(p) {
    var steps = p.steps || [], current = p.current || 0;
    return h('ol', { className: 'ss-steps', 'aria-label': p.label || 'Steps' }, steps.map(function (label, i) {
      var state = i < current ? 'done' : i === current ? 'current' : 'todo';
      return h(Fragment, { key: i },
        i > 0 && h('li', { className: cx('ss-step-line', i <= current && 'is-done'), 'aria-hidden': true }),
        h('li', { className: cx('ss-step', 'is-' + state), 'aria-current': state === 'current' ? 'step' : undefined },
          h('button', { type: 'button', className: 'ss-step-btn', disabled: state !== 'done' || !p.onStep, onClick: function () { p.onStep && p.onStep(i); } },
            h('span', { className: 'ss-step-n' }, state === 'done' ? h(Icon, { name: 'check', size: 12, strokeWidth: 3 }) : i + 1),
            h('span', { className: 'ss-step-label' }, label))));
    }));
  }

  function Progress(p) {
    var max = p.max || 100, v = Math.max(0, Math.min(max, p.value || 0));
    return h('div', { className: cx('ss-progress', p.tone && 'is-' + p.tone), role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': v, 'aria-label': p.label || 'Progress' },
      h('span', { style: { width: (max ? v / max * 100 : 0) + '%' } }));
  }

  // ------------------------------------------------------------------ import records dialog
  var IMPORT_GROUPS = [
    { key: 'required', title: 'Missing required values', tone: 'error' },
    { key: 'duplicate', title: 'Duplicate keys', tone: 'warn' },
    { key: 'type', title: 'Invalid types', tone: 'error' },
    { key: 'fk', title: 'Foreign keys', tone: 'error' },
    { key: 'date', title: 'Invalid dates', tone: 'error' }
  ];
  var IMPORT_MODES = { insert: 'Insert only', upsert: 'Upsert', skip: 'Skip duplicates' };

  function ImportStat(p) {
    return h('div', { className: cx('ss-imp-stat', p.tone && 'is-' + p.tone) },
      h('div', { className: 'ss-imp-stat-label' }, p.icon && h(Icon, { name: p.icon, size: 12 }), p.label),
      h('div', { className: 'ss-imp-stat-n' }, p.value));
  }
  function Mono(p) { return h('code', { className: 'ss-mono', style: { color: 'var(--ink-1)' } }, p.children); }

  // Import Records: a file or pasted text becomes rows of one table, in four steps. It keeps its own state; the host gives it the table, the rows that
  // exist (`data`: unique keys and foreign keys are checked against them) and hears `onImport({ insert, update, counts })` when rows were written.
  // The other props start it somewhere (a step, a file, a mapping, settings, a phase) for a preview or a test.
  function ImportRecordsDialog(p) {
    var table = p.table || SAMPLE_TABLES[0], data = p.data || SAMPLE_RECORDS, schema = p.schema || 'ecommerce';
    var dest = schema + '.' + (table.schema || 'public') + '.' + table.name, existing = data[table.name] || [];
    var hasFks = table.columns.some(function (c) { return c.fk; });
    var _step = useState(p.phase ? 3 : Math.max(0, IMPORT_KEYS.indexOf(p.step || 'source'))), rawStep = _step[0], setStep = _step[1];
    var _mode = useState(p.source || 'file'), mode = _mode[0], setMode = _mode[1];
    var _file = useState(p.file || null), file = _file[0], setFile = _file[1];
    var _ft = useState(p.file && p.text != null ? p.text : ''), fileText = _ft[0], setFileText = _ft[1];
    var _pt = useState(p.source === 'paste' && p.text != null ? p.text : ''), pasted = _pt[0], setPasted = _pt[1];
    var _rd = useState(false), reading = _rd[0], setReading = _rd[1];
    var _re = useState(null), readError = _re[0], setReadError = _re[1];
    var _dl = useState(null), delim = _dl[0], setDelim = _dl[1];
    var _hd = useState(null), header = _hd[0], setHeader = _hd[1];
    var _ed = useState(p.mapping || {}), edits = _ed[0], setEdits = _ed[1];
    var _set = useState(function () { return assign(IMPORT_DEFAULTS, p.settings); }), settings = _set[0], setSettings = _set[1];
    var _ph = useState(p.phase || 'review'), phase = _ph[0], setPhase = _ph[1];
    var _pr = useState(p.progress || 0), processed = _pr[0], setProcessed = _pr[1];
    var _ca = useState(null), cancelledAt = _ca[0], setCancelledAt = _ca[1];
    // The import runs on the analysis of the moment it starts: once rows are written the host's `data` holds them, and checking the file against it again would call every row a duplicate.
    var _sn = useState(null), snap = _sn[0], setSnap = _sn[1];
    var _el = useState(p.duration != null ? p.duration : 1.2), elapsed = _el[0], setElapsed = _el[1];
    var _op = useState(p.open || null), openGroups = _op[0], setOpenGroups = _op[1];
    var t0 = useRef(0), reported = useRef(false);

    var text = mode === 'file' ? fileText : pasted;
    var src = useMemo(function () { return text ? readRecordsFile(text, { delimiter: delim, header: header }) : null; }, [text, delim, header]);
    var ok = !!src && !src.error && src.rows.length > 0;
    var step = ok ? rawStep : 0;
    var auto = useMemo(function () { return ok ? matchColumns(table, src, data) : {}; }, [ok, src, table, data]);
    var mapping = useMemo(function () { return assign(auto, edits); }, [auto, edits]);
    var analysis = useMemo(function () { return ok ? analyzeImport(table, src, mapping, settings, data) : null; }, [ok, src, mapping, settings, table, data]);
    var ran = snap ? snap.analysis : analysis, ranSet = snap ? snap.settings : settings;
    var outcome = useMemo(function () { return ran ? runImport(ran, ranSet, p.fail, cancelledAt == null ? undefined : cancelledAt, cancelledAt != null) : null; }, [ran, ranSet, cancelledAt, p.fail]);
    var metas = useMemo(function () { return table.columns.map(function (c) { return fieldMeta(c, existing, data); }); }, [table, existing, data]);
    // Which mapped columns convert what the file holds (text into a number, a date into a timestamp).
    var converts = useMemo(function () {
      var out = {};
      if (!ok) return out;
      table.columns.forEach(function (c, i) {
        var m = mapping[c.name], k = m && m.from && m.from !== '=' ? src.columns.indexOf(m.from) : -1;
        if (k < 0) return;
        out[c.name] = sampleCells(src, k, 40).some(function (raw) {
          var res = importCell(c, metas[i], raw, settings);
          return !res.problem && res.value !== undefined && res.value !== null && (typeof res.value !== typeof raw || String(res.value) !== String(raw));
        });
      });
      return out;
    }, [ok, src, mapping, settings, table, metas]);
    var preview = useMemo(function () {
      if (!analysis) return null;
      var cols = table.columns.filter(function (c) { return analysis.filled.indexOf(c.name) >= 0; }), invalid = [];
      var rows = analysis.rows.slice(0, 10).map(function (r, ri) {
        var o = {};
        cols.forEach(function (c) {
          var pr = r.problems.find(function (x) { return x.column === c.name; });
          if (pr) { o[c.name] = pr.value === undefined ? null : pr.value; invalid.push({ row: ri, column: c.name, message: pr.message }); }
          else o[c.name] = c.name in r.values ? r.values[c.name] : c.default || null;
        });
        return o;
      });
      return { columns: cols, rows: rows, invalid: invalid };
    }, [analysis, table]);

    var counts = analysis ? analysis.counts : null, left = counts ? counts.warnings + counts.errors : 0;
    var blocked = !!analysis && (analysis.missing.length > 0 || analysis.filled.length === 0);
    var canImport = !!counts && counts.valid > 0 && (settings.skipInvalid || left === 0);
    var canNext = step === 0 ? ok : step === 1 ? ok && !blocked : step === 2 ? ok : canImport;
    var bytes = file ? (file.bytes != null ? file.bytes : new Blob([fileText]).size) : 0;
    var busy = step === 3 && phase === 'importing';
    var shown = p.progress != null ? p.progress : processed;
    var live = busy && ran ? runImport(ran, ranSet, p.fail, shown) : null;

    // --- source
    function forget() { setEdits({}); setCancelledAt(null); }
    function pickFile(f) {
      forget(); setDelim(null); setHeader(null); setReadError(null);
      if (!f) { setFile(null); setFileText(''); return; }
      var raw = f.raw;
      if (raw && raw.size > IMPORT_MAX) { setFile({ name: f.name, bytes: raw.size }); setFileText(''); setReadError('File is larger than 50 MB.'); return; }
      setFile({ name: f.name, bytes: raw ? raw.size : 0 });
      if (!raw) { setFileText(''); return; }
      setReading(true);
      var done = function (t) { setFileText(t); setReading(false); };
      if (raw.text) raw.text().then(done, function () { setReading(false); setReadError('Unable to read the file.'); });
      else { var rd = new FileReader(); rd.onload = function () { done(String(rd.result)); }; rd.onerror = function () { setReading(false); setReadError('Unable to read the file.'); }; rd.readAsText(raw); }
    }
    function paste(t) { forget(); setDelim(null); setHeader(null); setPasted(t); }
    function changeDelim(v) { forget(); setDelim(v); }
    function changeHeader(v) { forget(); setHeader(v); }

    // --- mapping
    function edit(name, patch) { var o = {}; o[name] = assign(mapping[name], patch, { by: 'manual' }); setEdits(assign(edits, o)); }
    function setting(patch) { setSettings(assign(settings, patch)); }

    // --- the import
    function start() {
      if (!canImport || busy) return;
      reported.current = false; t0.current = Date.now();
      setSnap({ analysis: analysis, settings: settings }); setCancelledAt(null); setProcessed(0); setPhase('importing');
    }
    function report(o) {
      if (reported.current) return;
      reported.current = true;
      if (p.onImport && o.inserted + o.updated > 0) p.onImport({ table: table.name, insert: o.insert, update: o.update, counts: { processed: o.processed, inserted: o.inserted, updated: o.updated, skipped: o.skipped, failed: o.failed } });
    }
    useEffect(function () {
      if (phase !== 'importing' || p.progress != null || !outcome) return;
      var last = outcome.processed, size = Math.max(1, Math.ceil(last / 24));
      var id = setInterval(function () { setProcessed(function (n) { return Math.min(last, n + size); }); }, 45);
      return function () { clearInterval(id); };
    }, [phase]);
    useEffect(function () {
      if (phase !== 'importing' || p.progress != null || !outcome || processed < outcome.processed) return;
      setElapsed(Math.max(0.1, (Date.now() - t0.current) / 1000)); setPhase('done'); report(outcome);
    }, [phase, processed, outcome]);
    function cancelImport() {
      var part = runImport(ran, ranSet, p.fail, processed, true);
      setElapsed(Math.max(0.1, (Date.now() - t0.current) / 1000)); setCancelledAt(processed); setPhase('done'); report(part);
    }
    function again() { forget(); setSnap(null); setStep(0); setPhase('review'); setFile(null); setFileText(''); setPasted(''); setDelim(null); setHeader(null); setReadError(null); setProcessed(0); }
    function viewRows() { p.onViewRows && p.onViewRows(outcome); p.onClose && p.onClose(); }
    function download() { if (ran) saveText(table.name + '_import_errors.csv', importReport(ran, outcome)); }
    function primary() {
      if (busy) return;
      if (step < 3) { if (canNext) setStep(step + 1); }
      else if (phase === 'review') start();
      else if (phase === 'done') viewRows();
    }
    useEffect(function () {
      function key(e) { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); primary(); } }
      window.addEventListener('keydown', key); return function () { window.removeEventListener('keydown', key); };
    });

    // --- step 1: source
    function renderSource() {
      var meta = file ? formatBytes(bytes) + (src && !src.error ? ' · ' + describeSource(src) : reading ? ' · Reading…' : '') : '';
      return h(Fragment, null,
        h(Field, { label: 'Destination' }, h('div', { className: 'ss-imp-dest' }, h(Icon, { name: 'table', size: 14 }), h('span', null, dest), h('span', { className: 'ss-spacer' }), h('span', { className: 'ss-imp-dim' }, countText(existing.length, 'row', 'rows') + ' · ' + countText(table.columns.length, 'column', 'columns')))),
        h(SegmentedControl, { block: true, value: mode, onChange: function (v) { setMode(v); }, options: [{ value: 'file', label: 'Upload file', icon: 'upload' }, { value: 'paste', label: 'Paste', icon: 'clipboard' }] }),
        mode === 'file'
          ? h(DropZone, { file: file ? { name: file.name, meta: meta } : null, onFile: pickFile, accept: '.csv,.tsv,.txt,.json', noun: 'CSV or JSON', fileIcon: 'file', hint: 'CSV, JSON · up to 50 MB' })
          : h(SqlEditor, { value: pasted, onChange: paste, height: 224, language: 'text', label: 'CSV or JSON', placeholder: 'email,full_name,signup_date\nan@example.com,An Nguyen,2026-03-14' }),
        readError && h(Alert, { tone: 'error', title: readError }, 'Choose a smaller file, or import it in parts.'),
        src && src.error && h(Alert, { tone: 'error', title: src.error }, mode === 'paste' ? 'Fix the text, or paste a CSV with one row per line.' : 'Choose another file, or open it and check that it is CSV or a JSON array of objects.'),
        ok && h(Fragment, null,
          h('div', { className: 'ss-imp-detect' },
            h(Badge, { tone: 'outline' }, src.format === 'json' ? 'JSON' : 'CSV'),
            src.format === 'csv' && h(Fragment, null,
              h('label', { className: 'ss-imp-opt' }, 'Delimiter', h(Select, { size: 'sm', label: 'Delimiter', value: src.delimiter, options: DELIMITERS, onChange: changeDelim })),
              h(Checkbox, { label: 'First row contains column names', checked: src.header, onChange: changeHeader })),
            h('span', { className: 'ss-spacer' }),
            h('span', { className: 'ss-imp-dim' }, 'UTF-8 · ' + countText(src.rows.length, 'row', 'rows') + ' · ' + countText(src.columns.length, 'column', 'columns'))),
          h('div', { className: 'ss-imp-sect' }, h('span', { className: 'ss-caption' }, 'First ' + countText(Math.min(8, src.rows.length), 'row', 'rows') + ' of the file')),
          h('div', { className: 'ss-imp-raw-box' },
            h('table', { className: 'ss-imp-raw', style: { minWidth: src.columns.length * 144 } },
              h('thead', null, h('tr', null, src.columns.map(function (n) { return h('th', { key: n, title: n }, n); }))),
              h('tbody', null, src.rows.slice(0, 8).map(function (r, ri) {
                return h('tr', { key: ri }, r.map(function (v, ci) { return h('td', { key: ci, title: v == null ? undefined : String(v) }, v == null ? h('span', { className: 'ss-null' }, 'NULL') : String(v)); }));
              }))))));
    }

    // --- step 2: map columns
    function mapAlert() {
      if (analysis.missing.length) {
        var name = analysis.missing[0];
        return h(Alert, { tone: 'error', title: 'Column "' + name + '" cannot be NULL.' }, 'No column of the file fills ', h(Mono, null, name), ', so every row would be refused. Choose a column of the file or give it a constant value.');
      }
      var order = ['required', 'type', 'date', 'fk'], kind = order.find(function (k) { return analysis.groups[k].length > 0; });
      if (!kind) return null;
      var items = analysis.groups[kind], first = items[0], n = groupRows(items), other = counts.errors - n;
      var what = kind === 'required' ? ' no value for ' : ' a value that does not fit ';
      return h(Alert, { tone: 'error', title: first.message },
        countText(n, 'row', 'rows') + (n === 1 ? ' has' : ' have') + what, h(Mono, null, first.column), ', the first on ' + src.unit + ' ' + first.line + '. ',
        n === 1 ? 'It cannot' : 'They cannot', ' be imported as ' + (n === 1 ? 'it is' : 'they are') + '.', other > 0 ? ' ' + countText(other, 'other row', 'other rows') + ' ' + (other === 1 ? 'has' : 'have') + ' problems too; Review & import lists them.' : null);
    }
    function mapRow(c, i) {
      var m = mapping[c.name] || { from: '', by: 'auto' }, gen = isGenerated(c), konst = m.from === '=';
      var opts = gen ? [{ value: '', label: 'Generated' }]
        : [{ value: '', label: 'Ignore' }].concat(src.columns.map(function (n) { return { value: n, label: n }; })).concat([{ value: '=', label: 'Constant value…' }]);
      var k = m.from && !konst ? src.columns.indexOf(m.from) : -1, sample = k >= 0 ? sampleCells(src, k, 1)[0] : undefined;
      var badges;
      if (gen) badges = [h(Badge, { key: 's', title: 'The database fills this column in.' }, 'Skipped (' + c.name + ' generated)')];
      else if (!m.from) {
        var required = !c.nullable && !c.default;
        badges = [required ? h(Badge, { key: 'r', tone: 'removed', icon: 'alert', title: 'Nothing fills this column and it cannot be NULL.' }, 'Required')
          : h(Badge, { key: 's', title: c.nullable ? 'Not in the file: NULL.' : 'Not in the file: the default ' + c.default + ' is used.' }, 'Skipped')];
      } else {
        badges = [m.by === 'auto' ? h(Badge, { key: 'a', tone: 'added', icon: 'check', title: m.why || 'Same name' }, 'Matched') : h(Badge, { key: 'm', tone: 'outline', icon: 'pencil', title: 'Chosen by you' }, 'Manual')];
        if (converts[c.name]) badges.push(h(Badge, { key: 'c', tone: 'modified', title: (src.format === 'json' ? 'Value' : 'Text') + ' → ' + c.type }, 'Type conversion'));
      }
      return h('div', { key: c.name, className: cx('ss-imp-row', gen && 'is-gen'), role: 'row' },
        h('div', { role: 'cell' }, h(Select, { size: 'sm', mono: true, label: 'File column for ' + c.name, value: gen ? '' : m.from, options: opts, disabled: gen, onChange: function (v) { edit(c.name, { from: v, value: v === '=' ? m.value || '' : undefined }); } })),
        h('div', { className: 'ss-imp-sample', role: 'cell', title: sample != null ? String(sample) : undefined },
          konst ? h(Input, { size: 'sm', mono: true, value: m.value || '', placeholder: 'Value for every row', 'aria-label': 'Constant value for ' + c.name, onChange: function (e) { edit(c.name, { from: '=', value: e.target.value }); } })
            : sample != null ? String(sample) : h('span', { className: 'ss-imp-dim' }, '—')),
        h('div', { className: 'ss-imp-arrow', 'aria-hidden': true }, h(Icon, { name: 'arrow-right', size: 14 })),
        h('div', { className: 'ss-imp-col', role: 'cell' },
          h('div', { className: 'ss-imp-col-name' }, c.pk && h(Icon, { name: 'key', size: 12, className: 'ss-grid-key is-pk', label: 'Primary key' }), c.fk && h(Icon, { name: 'link', size: 12, className: 'ss-grid-key is-fk', label: 'Foreign key' }), c.name),
          h('div', { className: 'ss-imp-col-type', title: typeLine(c) }, typeLine(c))),
        h('div', { className: 'ss-imp-status', role: 'cell' }, badges));
    }
    function renderMap() {
      var used = {};
      table.columns.forEach(function (c) { var m = mapping[c.name]; if (m && m.from && m.from !== '=') used[m.from] = true; });
      var unused = src.columns.filter(function (n) { return !used[n]; });
      var alert = mapAlert();
      return h(Fragment, null,
        h('div', { className: 'ss-imp-sect' },
          h('span', { className: 'ss-caption' }, 'Columns'),
          unused.length > 0 && h('span', { className: 'ss-imp-dim' }, 'Not imported: ', unused.map(function (n, i) { return h(Fragment, { key: n }, i > 0 && ', ', h('span', { className: 'ss-mono' }, n)); })),
          h('span', { className: 'ss-spacer' }),
          h(Button, { size: 'sm', variant: 'ghost', icon: 'restore', disabled: !Object.keys(edits).length, onClick: function () { setEdits({}); } }, 'Reset mapping')),
        h('div', { className: 'ss-imp-map', role: 'table', 'aria-label': 'Column mapping' },
          h('div', { className: 'ss-imp-row is-head', role: 'row' }, h('div', { role: 'columnheader' }, 'File column'), h('div', { role: 'columnheader' }, 'Sample'), h('div', { 'aria-hidden': true }), h('div', { role: 'columnheader' }, 'Destination column'), h('div', { role: 'columnheader' }, 'Mapping')),
          table.columns.map(mapRow)),
        alert,
        h('div', { className: 'ss-imp-sect' }, h('span', { className: 'ss-caption' }, 'Preview'), h('span', { className: 'ss-imp-dim' }, 'First ' + countText(preview.rows.length, 'row', 'rows') + ' after conversion')),
        h('div', { className: 'ss-imp-preview', style: { height: 34 + Math.max(preview.rows.length, 1) * 24 + (preview.columns.length ? 0 : 60) } },
          preview.columns.length
            ? h(DataGrid, { columns: preview.columns, rows: preview.rows, invalid: preview.invalid, density: 'compact', selectable: false, label: 'Import preview' })
            : h('div', { className: 'ss-imp-none' }, 'No column of ' + table.name + ' gets a value yet.')));
    }

    // --- step 3: settings
    function renderSettings() {
      var keys = analysis.keys, key = analysis.key, over = analysis.filled.filter(function (n) { return n !== key; });
      function radio(value, label, description, disabled) {
        return h(Radio, { key: value, name: 'import-mode', label: label, description: description, checked: settings.mode === value, disabled: disabled, onChange: function () { setting({ mode: value }); } });
      }
      var s = counts, line = importSummary(s);
      var note = !s.valid ? 'No row can be imported with these settings.'
        : (settings.mode === 'upsert' && s.update ? countText(s.insert, 'row', 'rows') + ' will be added and ' + countText(s.update, 'existing row', 'existing rows') + ' updated.' : countText(s.valid, 'row', 'rows') + ' will be added.')
        + (left ? ' ' + countText(left, 'row', 'rows') + (settings.skipInvalid ? ' will be left out and listed in the error report.' : ' ' + (left === 1 ? 'is' : 'are') + ' invalid: the import will not run until they are fixed or skipped.') : '');
      return h(Fragment, null,
        h('div', { className: 'ss-imp-cols' },
          h('div', { className: 'ss-imp-block' },
            h('div', { className: 'ss-caption' }, 'When a row already exists'),
            radio('insert', 'Insert only', 'Every row is added as a new row. A row whose unique key exists is a warning and is left out.'),
            radio('upsert', h(Fragment, null, 'Upsert on ', h('span', { className: 'ss-mono' }, key || 'a unique key')), keys.length ? 'Update the row that has the same key, and add the rows that have none.' : 'Needs a unique column that the file fills, such as email.', !keys.length),
            settings.mode === 'upsert' && keys.length > 0 && h('div', { className: 'ss-imp-sub' },
              h('div', { className: 'ss-imp-sub-row' }, h('span', { className: 'ss-imp-dim' }, 'Conflict key'), keys.length > 1 ? h(Select, { size: 'sm', mono: true, label: 'Conflict key', value: key, options: keys, onChange: function (v) { setting({ key: v }); }, style: { width: 168 } }) : h('span', { className: 'ss-mono' }, key)),
              h('div', { className: 'ss-imp-sub-row' }, h('span', { className: 'ss-imp-dim' }, 'Overwrites'),
                over.length ? h('span', { className: 'ss-imp-chips' }, over.map(function (n) { return h(Badge, { key: n, tone: 'modified' }, n); })) : h('span', { className: 'ss-imp-dim' }, 'Nothing: only the key is filled.'))),
            radio('skip', 'Skip duplicates', 'Rows whose unique key exists are left out without a warning.')),
          h('div', { className: 'ss-imp-block' },
            h('div', { className: 'ss-caption' }, 'Options'),
            h(Checkbox, { label: 'Treat empty cells as NULL', description: 'A required column that has a default takes the default instead.', checked: settings.emptyNull, onChange: function (v) { setting({ emptyNull: v }); } }),
            h(Checkbox, { label: 'Skip invalid rows', description: 'Rows with errors or warnings are left out and listed in the error report.', checked: settings.skipInvalid, onChange: function (v) { setting({ skipInvalid: v }); } }),
            h(Checkbox, { label: 'Check foreign keys', description: hasFks ? 'Each value must exist in the table it references.' : table.name + ' has no foreign keys.', checked: settings.checkFk, disabled: !hasFks, onChange: function (v) { setting({ checkFk: v }); } }),
            h(Checkbox, { label: 'Stop on first error', description: settings.oneTx ? 'A transaction always stops at the first error.' : 'Stop at the first row the database refuses.', checked: settings.stopOnError || settings.oneTx, disabled: settings.oneTx, onChange: function (v) { setting({ stopOnError: v }); } }),
            h(Checkbox, { label: 'Run in one transaction', description: 'If a row fails, nothing is written.', checked: settings.oneTx, onChange: function (v) { setting({ oneTx: v }); } }))),
        h('div', { className: 'ss-imp-sum', role: 'status' }, h('div', { className: 'ss-caption' }, 'Summary'), h('div', { className: 'ss-imp-sum-line' }, line), h('div', { className: 'ss-imp-sum-note' }, note)));
    }

    // --- step 4: review
    function fixText(key, items) {
      var m = items[0].message;
      if (key === 'required') return 'Fill in the empty cells, or give the column a constant value.';
      if (key === 'duplicate') return settings.mode === 'insert' ? 'Choose Skip duplicates to leave these rows out, or Upsert on ' + (analysis.key || 'a unique key') + ' to update the rows that exist.'
        : settings.mode === 'skip' ? 'These rows are left out because their key is already used.' : 'These rows update the row that has the same ' + analysis.key + '.';
      if (key === 'type') return /longer/.test(m) ? 'Shorten the value in the file, or widen the column.' : /number|whole|decimal/.test(m) ? 'Use digits only, with a period for decimals.' : /true or false/.test(m) ? 'Use true or false.' : /JSON/.test(m) ? 'Fix the JSON in the file.' : 'Change the value so that it fits the column.';
      if (key === 'fk') return 'Import the missing rows into the table they belong to first, or leave the cell empty.';
      return 'Write dates as YYYY-MM-DD and timestamps as YYYY-MM-DD HH:mm:ss.';
    }
    function groupTone(g, set) { return g.key !== 'duplicate' ? g.tone : (set || settings).mode === 'insert' ? 'warn' : 'info'; }
    function renderGroup(g, firstKey) {
      var items = analysis.groups[g.key], n = items.length ? groupRows(items) : 0, tone = groupTone(g);
      var open = items.length > 0 && (openGroups ? openGroups.indexOf(g.key) >= 0 : g.key === firstKey);
      var icon = !items.length ? 'check-circle' : tone === 'error' ? 'alert' : tone === 'warn' ? 'warning' : 'info';
      var clean = g.key === 'fk' ? (!hasFks ? table.name + ' has no foreign keys.' : settings.checkFk ? 'Every value exists in the table it references.' : 'Not checked.')
        : g.key === 'required' ? 'Every required column has a value.' : g.key === 'duplicate' ? 'No key is used twice.' : g.key === 'type' ? 'Every value fits its column.' : 'Every date and time can be read.';
      function toggle() {
        var cur = openGroups || (firstKey ? [firstKey] : []);
        setOpenGroups(cur.indexOf(g.key) >= 0 ? cur.filter(function (x) { return x !== g.key; }) : cur.concat([g.key]));
      }
      return h('div', { key: g.key, className: cx('ss-imp-group', 'is-' + (items.length ? tone : 'ok')) },
        h('button', { type: 'button', className: 'ss-imp-group-head', disabled: !items.length, 'aria-expanded': items.length ? open : undefined, onClick: toggle },
          h(Icon, { name: open ? 'chevron-down' : 'chevron-right', size: 14, className: 'ss-imp-chev' }),
          h(Icon, { name: icon, size: 14, className: 'ss-imp-gicon' }),
          h('span', { className: 'ss-imp-gtitle' }, g.title),
          items.length ? h('span', { className: 'ss-imp-gcount' }, countText(n, 'row', 'rows')) : h('span', { className: 'ss-imp-gclean' }, clean)),
        open && h('div', { className: 'ss-imp-gbody' },
          h('div', { className: 'ss-imp-fix' }, fixText(g.key, items)),
          h('div', { className: 'ss-imp-items' }, items.slice(0, 5).map(function (it, i) {
            return h('div', { key: i, className: 'ss-imp-item' },
              h('span', { className: 'ss-imp-dim' }, (src.unit === 'line' ? 'Line ' : 'Row ') + it.line), h('span', null, it.column),
              h('span', { className: 'ss-imp-item-v', title: it.value == null ? undefined : String(it.value) }, it.value == null || it.value === '' ? h('span', { className: 'ss-null' }, 'NULL') : String(it.value)),
              h('span', { className: 'ss-imp-item-msg' }, it.message));
          })),
          items.length > 5 && h('div', { className: 'ss-imp-dim' }, '+ ' + (items.length - 5).toLocaleString('en-US') + ' more in the error report.')));
    }
    function renderReview() {
      var firstKey = (IMPORT_GROUPS.find(function (g) { return analysis.groups[g.key].length > 0; }) || {}).key;
      var recap = [IMPORT_MODES[settings.mode] + (settings.mode === 'upsert' && analysis.key ? ' on ' + analysis.key : ''), settings.emptyNull && 'Empty cells are NULL', settings.skipInvalid ? 'Skip invalid rows' : 'Stop at invalid rows', settings.checkFk && hasFks && 'Check foreign keys', settings.oneTx ? 'One transaction' : settings.stopOnError ? 'Stop on first error' : 'No transaction'].filter(Boolean).join(' · ');
      return h(Fragment, null,
        h('div', { className: 'ss-imp-stats' },
          h(ImportStat, { label: 'Rows', value: counts.total.toLocaleString('en-US') }),
          h(ImportStat, { label: 'Will be imported', value: counts.valid.toLocaleString('en-US'), tone: 'ok', icon: 'check-circle' }),
          h(ImportStat, { label: 'Warnings', value: counts.warnings.toLocaleString('en-US'), tone: counts.warnings ? 'warn' : null, icon: 'warning' }),
          h(ImportStat, { label: 'Errors', value: counts.errors.toLocaleString('en-US'), tone: counts.errors ? 'error' : null, icon: 'alert' }),
          counts.skip > 0 && h(ImportStat, { label: 'Skipped', value: counts.skip.toLocaleString('en-US'), icon: 'info' })),
        h('div', { className: 'ss-imp-recap' }, h('span', { className: 'ss-imp-dim' }, recap), h('span', { className: 'ss-spacer' }), h(Button, { size: 'sm', variant: 'ghost', icon: 'settings', onClick: function () { setStep(2); } }, 'Edit settings')),
        !settings.skipInvalid && left > 0 && h(Alert, { tone: 'error', title: countText(left, 'row is', 'rows are') + ' invalid.' }, 'The import does not run while a row has a problem. Turn on Skip invalid rows in Settings, or fix the file.'),
        h('div', { className: 'ss-imp-groups' }, IMPORT_GROUPS.map(function (g) { return renderGroup(g, firstKey); })));
    }
    function renderRunning() {
      var total = ran.counts.total, o = live;
      return h(Fragment, null,
        h('div', { className: 'ss-imp-result' },
          h('div', { className: 'ss-imp-result-icon' }, h(Icon, { name: 'upload', size: 18 })),
          h('div', null, h('div', { className: 'ss-imp-result-title' }, 'Importing…'), h('div', { className: 'ss-imp-result-sub' }, h('span', { className: 'ss-mono' }, shown.toLocaleString('en-US') + ' of ' + total.toLocaleString('en-US') + ' rows'), ' into ', h('span', { className: 'ss-mono' }, dest)))),
        h(Progress, { value: shown, max: total, label: 'Import progress' }),
        h('div', { className: 'ss-imp-stats' },
          h(ImportStat, { label: 'Processed', value: o.processed.toLocaleString('en-US') }), h(ImportStat, { label: 'Inserted', value: o.inserted.toLocaleString('en-US'), tone: 'ok' }),
          ranSet.mode === 'upsert' && h(ImportStat, { label: 'Updated', value: o.updated.toLocaleString('en-US') }),
          h(ImportStat, { label: 'Skipped', value: o.skipped.toLocaleString('en-US') }), h(ImportStat, { label: 'Failed', value: o.failed.toLocaleString('en-US'), tone: o.failed ? 'error' : null })),
        ranSet.oneTx && h(Alert, { tone: 'info', title: 'Running in one transaction' }, 'Nothing is written until every row has been processed. If one fails, none is.'));
    }
    function renderResult() {
      var o = outcome, total = ran.counts.total, failed = o.failed > 0, cancelled = cancelledAt != null, tone = cancelled ? 'warn' : failed ? 'error' : 'ok';
      var secs = elapsed.toFixed(1) + ' s', rolled = o.rolledBack || (ranSet.oneTx && (failed || cancelled)), tally = {};
      ran.rows.slice(0, o.processed).forEach(function (r) { if (r.kind !== 'insert' && r.kind !== 'update') { var k = r.kind === 'invalid' ? r.problems[0].kind : 'duplicate'; tally[k] = (tally[k] || 0) + 1; } });
      var title = cancelled ? 'Import cancelled' : failed ? 'Import failed' : 'Import completed';
      var sub = failed || cancelled ? (rolled ? 'Nothing was written to ' : (o.inserted + o.updated).toLocaleString('en-US') + ' rows were written to ') : countText(o.inserted, 'row was', 'rows were') + ' added to ';
      return h(Fragment, null,
        h('div', { className: cx('ss-imp-result', 'is-' + tone) },
          h('div', { className: 'ss-imp-result-icon' }, h(Icon, { name: tone === 'ok' ? 'check-circle' : tone === 'error' ? 'alert' : 'warning', size: 18 })),
          h('div', null, h('div', { className: 'ss-imp-result-title' }, title),
            h('div', { className: 'ss-imp-result-sub' }, sub, h('span', { className: 'ss-mono' }, dest), tone === 'ok' ? ' in ' + secs + (o.updated ? ' and ' + countText(o.updated, 'existing row was', 'existing rows were') + ' updated' : '') + '.' : '.'))),
        h('div', { className: 'ss-imp-stats' },
          h(ImportStat, { label: 'Processed', value: o.processed === total ? total.toLocaleString('en-US') : o.processed.toLocaleString('en-US') + ' of ' + total.toLocaleString('en-US') }),
          h(ImportStat, { label: 'Inserted', value: o.inserted.toLocaleString('en-US'), tone: o.inserted ? 'ok' : null, icon: o.inserted ? 'check-circle' : null }),
          ranSet.mode === 'upsert' && h(ImportStat, { label: 'Updated', value: o.updated.toLocaleString('en-US'), tone: o.updated ? 'ok' : null }),
          h(ImportStat, { label: 'Skipped', value: o.skipped.toLocaleString('en-US'), icon: o.skipped ? 'info' : null }),
          h(ImportStat, { label: 'Failed', value: o.failed.toLocaleString('en-US'), tone: o.failed ? 'error' : null, icon: o.failed ? 'alert' : null })),
        failed && h(Alert, { tone: 'error', title: rolled ? 'Nothing was written.' : 'Line ' + o.error.line + ' was refused.' },
          (ranSet.oneTx ? 'The import ran in one transaction and line ' : 'Line ') + o.error.line + ' failed: ' + o.error.message + '. ',
          ranSet.oneTx ? 'Fix that row and import again, or turn off Run in one transaction to keep the rows that went through.' : (o.stopped ? 'The import stopped there.' : 'The other rows were written.')),
        cancelled && h(Alert, { tone: 'warn', title: rolled ? 'Nothing was written.' : (o.inserted + o.updated).toLocaleString('en-US') + ' rows were already added.' }, rolled ? 'The import ran in one transaction, so cancelling it undid every row.' : 'They stay in the working copy; ⌘Z removes them.'),
        !failed && !cancelled && o.skipped > 0 && h(Fragment, null,
          h('div', { className: 'ss-imp-sect' }, h('span', { className: 'ss-caption' }, 'Skipped rows'), h('span', { className: 'ss-imp-dim' }, 'The error report lists each one with its line and the reason.')),
          h('div', { className: 'ss-imp-items' }, IMPORT_GROUPS.filter(function (g) { return tally[g.key]; }).map(function (g) {
            var tone = groupTone(g, ranSet);
            return h('div', { key: g.key, className: cx('ss-imp-reason', 'is-' + tone) }, h(Icon, { name: tone === 'error' ? 'alert' : tone === 'warn' ? 'warning' : 'info', size: 14 }), h('span', null, g.title), h('span', { className: 'ss-imp-gcount' }, countText(tally[g.key], 'row', 'rows')));
          }))),
        o.inserted + o.updated > 0 && h('div', { className: 'ss-imp-recap' }, h(Icon, { name: 'info', size: 14, style: { color: 'var(--ink-3)' } }), h('span', { className: 'ss-imp-dim' }, 'Not saved yet. Press ⌘Z to remove ' + countText(o.inserted + o.updated, 'row', 'rows') + ' again.')));
    }

    // --- the dialog
    var body, footerStart, footer;
    var cancel = h(Button, { key: 'c', onClick: p.onClose }, 'Cancel');
    var back = h(Button, { key: 'b', icon: 'chevron-left', onClick: function () { setStep(step - 1); } }, 'Back');
    if (step === 3 && phase === 'importing') {
      body = renderRunning();
      footerStart = !ranSet.oneTx && h('span', { className: 'ss-modal-foot-hint' }, 'Rows are written as they are processed.');
      footer = h(Button, { onClick: cancelImport }, 'Cancel import');
    } else if (step === 3 && phase === 'done') {
      body = renderResult();
      var any = outcome.skipped + outcome.failed > 0;
      footerStart = h(Fragment, null, any && h(Button, { icon: 'download', onClick: download }, 'Download error report'), h(Button, { variant: 'ghost', onClick: again }, 'Import another file'));
      footer = h(Fragment, null, h(Button, { onClick: p.onClose, kbd: 'Esc' }, 'Close'), h(Button, { variant: 'primary', icon: 'eye', kbd: ['⌘', '⏎'], disabled: outcome.inserted + outcome.updated === 0, onClick: viewRows }, 'View imported rows'));
    } else {
      if (step === 0) {
        body = renderSource();
        footerStart = ok ? h(ParseStatus, { state: 'ok', summary: countText(src.rows.length, 'row', 'rows') + ' · ' + countText(src.columns.length, 'column', 'columns') })
          : src && src.error ? h(ParseStatus, { state: 'error', message: src.error })
            : readError ? h(ParseStatus, { state: 'error', message: readError })
              : reading ? h(ParseStatus, { state: 'parsing' }) : h(ParseStatus, { state: 'idle', message: 'Choose a file or paste text — it is read locally before anything is imported.' });
      } else if (step === 1) {
        body = renderMap();
        var probs = analysis.missing.length || counts.errors;
        var fillable = table.columns.filter(function (c) { return !isGenerated(c); }).length;
        footerStart = h('span', { className: 'ss-modal-foot-hint' }, analysis.filled.length + ' of ' + fillable + ' columns filled', probs > 0 && h('span', { style: { color: 'var(--removed)' } }, ' · ' + (analysis.missing.length ? 'a required column is empty' : countText(counts.errors, 'row has a problem', 'rows have problems'))));
      } else if (step === 2) {
        body = renderSettings();
        footerStart = h('span', { className: 'ss-modal-foot-hint' }, h(Kbd, { keys: ['⌘', '⏎'] }), 'to review');
      } else {
        body = renderReview();
        footerStart = h('span', { className: 'ss-modal-foot-hint' }, canImport ? countText(counts.valid, 'row', 'rows') + ' will be added to ' + table.name : !settings.skipInvalid && left > 0 ? 'Fix or skip the invalid rows to import.' : 'Nothing to import');
      }
      footer = h(Fragment, null, cancel, step > 0 && back,
        step < 3 ? h(Button, { variant: 'primary', kbd: ['⌘', '⏎'], disabled: !canNext, onClick: primary }, 'Next')
          : h(Button, { variant: 'primary', icon: 'upload', kbd: ['⌘', '⏎'], disabled: !canImport, onClick: start }, 'Import ' + countText(counts.valid, 'row', 'rows')));
    }
    return h(Modal, {
      title: 'Import Records', subtitle: h(Fragment, null, 'Add rows to ', h('span', { className: 'ss-mono' }, dest), ' from a CSV or JSON file. Nothing is written until you confirm.'), width: 960,
      onClose: busy ? undefined : p.onClose, bodyStyle: { padding: 0, gap: 0, overflow: 'hidden', height: p.height || 708 }, footerStart: footerStart, footer: footer
    },
      h(Stepper, { steps: IMPORT_STEPS, current: step, label: 'Import steps', onStep: busy || (step === 3 && phase === 'done') ? undefined : function (i) { setStep(i); } }),
      h('div', { className: 'ss-imp-content' }, body));
  }

  // ------------------------------------------------------------------ records: queries
  // Everything Query mode does with data is in this section and none of it needs React: the SQL that the Builder writes, a reader
  // for the SELECT it runs, the run itself over the rows of the sample, the plan and the formatter. The console below only shows it.
  // Exported for the port and its tests: defaultQuery, queryOps, queryProblems, buildQuery, parseQuery, formatQuery, runQuery, queryPlan.
  var QUERY_MAX_ROWS = 1000;
  var QUERY_LIMITS = [10, 25, 50, 100, 500, 1000];
  var NULL_OPS = [{ value: 'null', label: 'IS NULL' }, { value: 'notnull', label: 'IS NOT NULL' }];
  // The operators of a condition, by what the column holds.
  var QUERY_OPS = {
    text: [{ value: 'eq', label: '=' }, { value: 'ne', label: '≠' }, { value: 'contains', label: 'contains' }, { value: 'starts', label: 'starts with' }].concat(NULL_OPS),
    number: [{ value: 'eq', label: '=' }, { value: 'gt', label: '>' }, { value: 'lt', label: '<' }, { value: 'between', label: 'between' }].concat(NULL_OPS),
    time: [{ value: 'before', label: 'before' }, { value: 'after', label: 'after' }, { value: 'between', label: 'between' }].concat(NULL_OPS),
    boolean: [{ value: 'eq', label: '=' }].concat(NULL_OPS)
  };
  function queryOps(column) { return QUERY_OPS[cellKind(column.type)]; }
  function isBare(op) { return op === 'null' || op === 'notnull'; }

  // --- the Builder: a table, a group of conditions (groups nest), the columns, a sort and a limit
  // `{ table, where: { op: 'AND' | 'OR', items: (condition | group)[] }, columns: string[] | null, sort: { column, dir } | null, limit: number | null }`
  // A condition is `{ column, op, value, value2 }` with what was typed as text; a group has `items`.
  function defaultQuery(table) { return { table: table.name, where: { op: 'AND', items: [] }, columns: null, sort: null, limit: 100 }; }
  var QUERY_DATE = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/;
  function realDate(m) { var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] && (m[4] == null || (+m[4] < 24 && +m[5] < 60 && (m[6] == null || +m[6] < 60))); }
  function momentWord(type) { var k = momentKind(type); return k === 'date' ? 'date' : k === 'time' ? 'time' : 'timestamp'; }
  // What is wrong with one value typed for a column, or null.
  function valueProblem(col, text) {
    var kind = cellKind(col.type), v = String(text == null ? '' : text).trim();
    if (kind === 'boolean') return null;
    if (v === '') return 'Value cannot be empty.';
    if (kind === 'number') return isNaN(Number(v)) ? 'Value must be a number.' : null;
    if (kind === 'time') {
      var word = momentWord(col.type), m = word === 'timestamp' ? QUERY_DATE.exec(v) : MOMENTS[word].re.exec(v);
      return m && (word === 'time' || realDate(m)) ? null : 'Invalid ' + word + ' format.';
    }
    return null;
  }
  function conditionProblem(c, table) {
    var col = table.columns.find(function (x) { return x.name === c.column; });
    if (!col) return 'Choose a column.';
    if (isBare(c.op)) return null;
    return valueProblem(col, c.value) || (c.op === 'between' ? valueProblem(col, c.value2) : null);
  }
  // The conditions that cannot be written yet, with where they are (`path`: the index in each group, from the top).
  function queryProblems(spec, table) {
    var out = [];
    (function walk(g, path) {
      g.items.forEach(function (it, i) {
        if (it.items) walk(it, path.concat([i]));
        else { var m = conditionProblem(it, table); if (m) out.push({ path: path.concat([i]), message: m }); }
      });
    })(spec.where, []);
    return out;
  }

  function litOf(col, text, kind) {
    var v = String(text == null ? '' : text).trim();
    if (kind === 'number') return { t: 'lit', kind: 'num', v: Number(v) };
    if (kind === 'boolean') return { t: 'lit', kind: 'bool', v: String(text) !== 'false' };
    return { t: 'lit', kind: 'str', v: kind === 'time' ? v : String(text) };
  }
  function likeText(v) { return String(v).replace(/[\\%_]/g, '\\$&'); }
  function conditionExpr(c, table) {
    var col = table.columns.find(function (x) { return x.name === c.column; });
    if (!col || conditionProblem(c, table)) return null;
    var kind = cellKind(col.type), ref = { t: 'col', name: col.name };
    function cmp(op, v) { return { t: 'cmp', op: op, l: ref, r: litOf(col, v, kind) }; }
    switch (c.op) {
      case 'null': return { t: 'isnull', neg: false, l: ref };
      case 'notnull': return { t: 'isnull', neg: true, l: ref };
      case 'eq': return cmp('=', c.value);
      case 'ne': return cmp('<>', c.value);
      case 'gt': case 'after': return cmp('>', c.value);
      case 'lt': case 'before': return cmp('<', c.value);
      case 'contains': return { t: 'like', ci: true, neg: false, l: ref, r: { t: 'lit', kind: 'str', v: '%' + likeText(c.value) + '%' } };
      case 'starts': return { t: 'like', ci: true, neg: false, l: ref, r: { t: 'lit', kind: 'str', v: likeText(c.value) + '%' } };
      case 'between': return { t: 'between', neg: false, l: ref, a: litOf(col, c.value, kind), b: litOf(col, c.value2, kind) };
    }
    return null;
  }
  function groupExpr(g, table) {
    var nodes = g.items.map(function (it) { return it.items ? groupExpr(it, table) : conditionExpr(it, table); }).filter(Boolean);
    var t = g.op === 'OR' ? 'or' : 'and';
    return nodes.length ? nodes.reduce(function (a, b) { return { t: t, a: a, b: b }; }) : null;
  }
  // A condition that is not complete is left out of the SQL (the Builder says which, and does not run until they are fixed).
  function specQuery(spec, table) {
    var all = spec.columns && spec.columns.length && spec.columns.length < table.columns.length;
    return {
      table: spec.table, cols: all ? spec.columns.map(function (n) { return { name: n }; }) : null, where: groupExpr(spec.where, table),
      order: spec.sort ? [{ col: { name: spec.sort.column }, dir: spec.sort.dir === 'desc' ? 'DESC' : 'ASC' }] : [], limit: spec.limit == null ? null : spec.limit, offset: null
    };
  }
  function buildQuery(spec, table) { return printQuery(specQuery(spec, table)); }

  // --- SQL written out: one clause to a line, AND / OR under the first condition
  function sqlIdent(name) { return /^[a-z_][a-z0-9_]*$/.test(name) ? name : '"' + String(name).replace(/"/g, '""') + '"'; }
  function sqlOperand(o) {
    if (o.t === 'col') return sqlIdent(o.name);
    return o.kind === 'null' ? 'NULL' : o.kind === 'bool' ? String(o.v) : o.kind === 'num' ? String(o.v) : sqlLiteral(o.v);
  }
  function exprSql(e, ctx) {
    var s, prec = 3;
    switch (e.t) {
      case 'and': s = exprSql(e.a, 2) + ' AND ' + exprSql(e.b, 2); prec = 2; break;
      case 'or': s = exprSql(e.a, 1) + ' OR ' + exprSql(e.b, 1); prec = 1; break;
      case 'not': s = 'NOT ' + exprSql(e.e, 3); break;
      case 'cmp': s = sqlOperand(e.l) + ' ' + e.op + ' ' + sqlOperand(e.r); break;
      case 'like': s = sqlOperand(e.l) + (e.neg ? ' NOT ' : ' ') + (e.ci ? 'ILIKE ' : 'LIKE ') + sqlOperand(e.r); break;
      case 'isnull': s = sqlOperand(e.l) + ' IS ' + (e.neg ? 'NOT ' : '') + 'NULL'; break;
      case 'between': s = sqlOperand(e.l) + (e.neg ? ' NOT ' : ' ') + 'BETWEEN ' + sqlOperand(e.a) + ' AND ' + sqlOperand(e.b); break;
      case 'in': s = sqlOperand(e.l) + (e.neg ? ' NOT ' : ' ') + 'IN (' + e.list.map(sqlOperand).join(', ') + ')'; break;
    }
    return prec < ctx ? '(' + s + ')' : s;
  }
  function chain(e, t) { return e.t === t ? chain(e.a, t).concat(chain(e.b, t)) : [e]; }
  function whereLines(e) {
    if (e.t !== 'and' && e.t !== 'or') return ['WHERE ' + exprSql(e, 0)];
    var word = e.t === 'and' ? 'AND' : 'OR', ctx = e.t === 'and' ? 2 : 1;
    return chain(e, e.t).map(function (x, i) { return (i ? '  ' + word + ' ' : 'WHERE ') + exprSql(x, ctx); });
  }
  function printQuery(q) {
    var list = q.cols ? q.cols.map(function (c) { return sqlIdent(c.name) + (c.alias ? ' AS ' + sqlIdent(c.alias) : ''); }) : ['*'];
    var inline = 'SELECT ' + list.join(', ');
    var lines = [inline.length <= 72 ? inline : 'SELECT\n' + list.map(function (c) { return '  ' + c; }).join(',\n'), 'FROM ' + sqlIdent(q.table)];
    if (q.where) lines = lines.concat(whereLines(q.where));
    if (q.order && q.order.length) lines.push('ORDER BY ' + q.order.map(function (o) { return sqlIdent(o.col.name) + (o.dir === 'DESC' ? ' DESC' : ''); }).join(', '));
    if (q.limit != null) lines.push('LIMIT ' + q.limit);
    if (q.offset != null) lines.push('OFFSET ' + q.offset);
    return lines.join('\n') + ';';
  }

  // --- reading a SELECT. `{ ok, query }` or `{ ok: false, line, message }`: the line of the word it could not read.
  var QUERY_RESERVED = {};
  'SELECT FROM WHERE ORDER BY LIMIT OFFSET AND OR NOT IS NULL LIKE ILIKE BETWEEN IN AS ASC DESC TRUE FALSE DISTINCT ALL'.split(' ').forEach(function (w) { QUERY_RESERVED[w] = true; });
  var QUERY_WRITES = { INSERT: 1, UPDATE: 1, DELETE: 1, DROP: 1, ALTER: 1, CREATE: 1, TRUNCATE: 1, GRANT: 1, REVOKE: 1 };
  var Q_WORD = /[A-Za-z_][A-Za-z0-9_$]*/y, Q_NUMBER = /\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?/y;
  function lexQuery(sql) {
    var toks = [], i = 0, n = sql.length, line = 1, comments = false, m;
    function quoted(q, kind) {
      var out = '', at = line; i++;
      for (;;) {
        if (i >= n) throw { line: at };
        if (sql[i] === q) { if (sql[i + 1] === q) { out += q; i += 2; continue; } i++; break; }
        if (sql[i] === '\n') line++;
        out += sql[i++];
      }
      toks.push({ t: kind, v: out, line: at });
    }
    while (i < n) {
      var c = sql[i];
      if (c === '\n') { line++; i++; }
      else if (c === ' ' || c === '\t' || c === '\r') i++;
      else if (c === '-' && sql[i + 1] === '-') { comments = true; while (i < n && sql[i] !== '\n') i++; }
      else if (c === '/' && sql[i + 1] === '*') {
        var end = sql.indexOf('*/', i + 2), at = line; comments = true;
        if (end < 0) throw { line: at };
        line += sql.slice(i, end).split('\n').length - 1; i = end + 2;
      }
      else if (c === "'") quoted("'", 'str');
      else if (c === '"') quoted('"', 'id');
      else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(sql[i + 1] || ''))) { Q_NUMBER.lastIndex = i; m = Q_NUMBER.exec(sql); toks.push({ t: 'num', v: Number(m[0]), line: line }); i += m[0].length; }
      else if (/[A-Za-z_]/.test(c)) { Q_WORD.lastIndex = i; m = Q_WORD.exec(sql); toks.push({ t: 'w', v: m[0], u: m[0].toUpperCase(), line: line }); i += m[0].length; }
      else if ((c === '<' || c === '>' || c === '!') && sql[i + 1] === '=' || (c === '<' && sql[i + 1] === '>')) { toks.push({ t: 'op', v: sql.substr(i, 2) === '!=' ? '<>' : sql.substr(i, 2), line: line }); i += 2; }
      else if ('=<>,().*;-'.indexOf(c) >= 0) { toks.push({ t: 'op', v: c, line: line }); i++; }
      else throw { line: line };
    }
    toks.push({ t: 'eof', line: line });
    return { toks: toks, comments: comments };
  }
  function parseFail(line) { return { ok: false, line: line, message: 'Unable to parse SQL near line ' + line + '.' }; }
  function parseQuery(sql) {
    var lexed;
    try { lexed = lexQuery(sql); } catch (e) { return parseFail(e.line); }
    var toks = lexed.toks, p = 0;
    function fail() { throw { line: toks[p].line }; }
    function isW(w) { return toks[p].t === 'w' && toks[p].u === w; }
    function eatW(w) { if (isW(w)) { p++; return true; } return false; }
    function needW(w) { if (!eatW(w)) fail(); }
    function isOp(o) { return toks[p].t === 'op' && toks[p].v === o; }
    function eatOp(o) { if (isOp(o)) { p++; return true; } return false; }
    function needOp(o) { if (!eatOp(o)) fail(); }
    function name() {
      var t = toks[p];
      if (t.t === 'id') { p++; return { v: t.v, line: t.line }; }
      if (t.t === 'w' && !QUERY_RESERVED[t.u]) { p++; return { v: t.v.toLowerCase(), line: t.line }; }
      fail();
    }
    function colref() { var a = name(); if (eatOp('.')) { var b = name(); return { t: 'col', qual: a.v, name: b.v, line: b.line }; } return { t: 'col', name: a.v, line: a.line }; }
    function operand() {
      var t = toks[p];
      if (t.t === 'num') { p++; return { t: 'lit', kind: 'num', v: t.v, line: t.line }; }
      if (isOp('-') && toks[p + 1].t === 'num') { p += 2; return { t: 'lit', kind: 'num', v: -toks[p - 1].v, line: t.line }; }
      if (t.t === 'str') { p++; return { t: 'lit', kind: 'str', v: t.v, line: t.line }; }
      if (isW('TRUE') || isW('FALSE')) { p++; return { t: 'lit', kind: 'bool', v: t.u === 'TRUE', line: t.line }; }
      if (isW('NULL')) { p++; return { t: 'lit', kind: 'null', v: null, line: t.line }; }
      return colref();
    }
    function predicate() {
      if (eatOp('(')) { var inner = expr(); needOp(')'); return inner; }
      var l = operand(), neg = false;
      if (toks[p].t === 'op' && /^(=|<>|<|>|<=|>=)$/.test(toks[p].v)) { var op = toks[p++].v; return { t: 'cmp', op: op, l: l, r: operand() }; }
      if (eatW('IS')) { neg = eatW('NOT'); needW('NULL'); return { t: 'isnull', neg: neg, l: l }; }
      if (eatW('NOT')) neg = true;
      if (isW('LIKE') || isW('ILIKE')) { var ci = toks[p++].u === 'ILIKE'; return { t: 'like', ci: ci, neg: neg, l: l, r: operand() }; }
      if (eatW('BETWEEN')) { var a = operand(); needW('AND'); return { t: 'between', neg: neg, l: l, a: a, b: operand() }; }
      if (eatW('IN')) { needOp('('); var list = [operand()]; while (eatOp(',')) list.push(operand()); needOp(')'); return { t: 'in', neg: neg, l: l, list: list }; }
      fail();
    }
    function negation() { return eatW('NOT') ? { t: 'not', e: negation() } : predicate(); }
    function conjunction() { var e = negation(); while (eatW('AND')) e = { t: 'and', a: e, b: negation() }; return e; }
    function expr() { var e = conjunction(); while (eatW('OR')) e = { t: 'or', a: e, b: conjunction() }; return e; }
    function count() { var t = toks[p]; if (t.t !== 'num' || t.v < 0 || t.v % 1) fail(); p++; return t.v; }
    try {
      var first = toks[0];
      if (first.t === 'eof') return { ok: false, line: 1, message: 'Write a query to run.' };
      if (first.t === 'w' && QUERY_WRITES[first.u]) return { ok: false, line: first.line, message: 'Only SELECT statements can be run in Query mode.' };
      needW('SELECT');
      var q = { cols: null, where: null, order: [], limit: null, offset: null };
      if (!eatOp('*')) {
        q.cols = [];
        do { var c = colref(); if (eatW('AS')) c.alias = name().v; q.cols.push(c); } while (eatOp(','));
      }
      needW('FROM');
      var t1 = name(), t2 = eatOp('.') ? name() : null, tn = t2 || t1;
      q.table = tn.v; q.tableLine = tn.line; q.schema = t2 ? t1.v : null;
      if (eatW('WHERE')) q.where = expr();
      if (eatW('ORDER')) {
        needW('BY');
        do { var o = { col: colref(), dir: 'ASC' }; if (eatW('DESC')) o.dir = 'DESC'; else eatW('ASC'); q.order.push(o); } while (eatOp(','));
      }
      if (eatW('LIMIT')) { if (!eatW('ALL')) q.limit = count(); }
      if (eatW('OFFSET')) q.offset = count();
      while (eatOp(';'));
      if (toks[p].t !== 'eof') fail();
      return { ok: true, query: q, comments: lexed.comments };
    } catch (e) { return parseFail(e.line); }
  }
  // The SQL again as the Builder writes it. A query with comments is not formatted: they would be lost.
  function formatQuery(sql) {
    var r = parseQuery(sql);
    if (!r.ok) return r;
    if (r.comments) return { ok: false, line: 1, message: 'Unable to format a query that has comments.' };
    return { ok: true, sql: printQuery(r.query) };
  }

  // --- running it: what the database would say, over the rows of the sample
  function typeWord(type) {
    var t = String(type).toLowerCase().replace(/\(.*\)/, '').trim();
    return /^bigserial/.test(t) ? 'bigint' : /serial/.test(t) ? 'integer' : t;
  }
  // ORDER BY may name a column as the query renamed it: `SELECT name AS n ... ORDER BY n`.
  function aliased(q, ref) { var c = !ref.qual && q.cols && q.cols.find(function (x) { return x.alias === ref.name; }); return c ? c.name : null; }
  function checkQuery(q, tables) {
    var table = tables.find(function (t) { return t.name === q.table; });
    if (!table) return { line: q.tableLine, message: 'relation "' + q.table + '" does not exist.' };
    function resolve(ref) {
      if (ref.qual && ref.qual !== table.name) throw { line: ref.line, message: 'missing FROM-clause entry for table "' + ref.qual + '".' };
      var col = table.columns.find(function (c) { return c.name === ref.name; });
      if (!col) throw { line: ref.line, message: 'column ' + (ref.qual ? ref.qual + '.' + ref.name : '"' + ref.name + '"') + ' does not exist.' };
      return col;
    }
    // A literal that the column cannot take: `id = 'abc'`.
    function fits(col, lit) {
      if (lit.t !== 'lit' || lit.kind === 'null') return;
      var kind = cellKind(col.type), s = String(lit.v), bad = false;
      if (kind === 'number') bad = lit.kind === 'bool' || (lit.kind === 'str' && (s.trim() === '' || isNaN(Number(s))));
      else if (kind === 'boolean') bad = lit.kind === 'num' || (lit.kind === 'str' && !/^(true|false|t|f|yes|no|on|off|0|1)$/i.test(s.trim()));
      else if (kind === 'time') bad = lit.kind !== 'str' || !(QUERY_DATE.test(s.trim()) || MOMENTS.time.re.test(s.trim()));
      if (bad) throw { line: lit.line, message: 'invalid input syntax for type ' + typeWord(col.type) + ': "' + s + '".' };
    }
    function side(a, b) { if (a.t === 'col') { var col = resolve(a); if (b) b.forEach(function (x) { fits(col, x); }); } }
    function walk(e) {
      switch (e.t) {
        case 'and': case 'or': walk(e.a); walk(e.b); break;
        case 'not': walk(e.e); break;
        case 'cmp': side(e.l, [e.r]); side(e.r, [e.l]); break;
        case 'like': side(e.l); side(e.r); break;
        case 'isnull': side(e.l); break;
        case 'between': side(e.l, [e.a, e.b]); side(e.a); side(e.b); break;
        case 'in': side(e.l, e.list); e.list.forEach(function (x) { side(x); }); break;
      }
    }
    try {
      if (q.cols) q.cols.forEach(resolve);
      if (q.where) walk(q.where);
      q.order.forEach(function (o) { if (!aliased(q, o.col)) resolve(o.col); });
    } catch (e) { return { line: e.line, message: e.message }; }
    return { table: table };
  }
  function likeRegex(pattern, ci) {
    var out = '', i;
    for (i = 0; i < pattern.length; i++) {
      var c = pattern[i];
      if (c === '\\' && i + 1 < pattern.length) out += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      else out += c === '%' ? '.*' : c === '_' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp('^' + out + '$', ci ? 'si' : 's');
  }
  // SQL's three values: true, false and null (unknown).
  function evalWhere(e, row, table) {
    function val(o) { return o.t === 'col' ? row[o.name] : o.v; }
    function kindOf(a, b) {
      var c = a.t === 'col' ? a : b.t === 'col' ? b : null;
      if (c) return cellKind(table.columns.find(function (x) { return x.name === c.name; }).type);
      return a.kind === 'num' && b.kind === 'num' ? 'number' : 'text';
    }
    function order(x, y, kind) {
      if (x == null || y == null) return null;
      if (kind === 'number') { x = Number(x); y = Number(y); }
      else if (kind === 'boolean') { x = x === true || x === 1 || /^(t|true|yes|on|1)$/i.test(String(x)); y = y === true || y === 1 || /^(t|true|yes|on|1)$/i.test(String(y)); }
      else { x = String(x); y = String(y); }
      return x < y ? -1 : x > y ? 1 : 0;
    }
    function flip(r, neg) { return r === null ? null : neg ? !r : r; }
    switch (e.t) {
      case 'and': { var a = evalWhere(e.a, row, table); if (a === false) return false; var b = evalWhere(e.b, row, table); return b === false ? false : a === null || b === null ? null : true; }
      case 'or': { var c = evalWhere(e.a, row, table); if (c === true) return true; var d = evalWhere(e.b, row, table); return d === true ? true : c === null || d === null ? null : false; }
      case 'not': { var n = evalWhere(e.e, row, table); return n === null ? null : !n; }
      case 'cmp': {
        var o = order(val(e.l), val(e.r), kindOf(e.l, e.r));
        if (o === null) return null;
        return e.op === '=' ? o === 0 : e.op === '<>' ? o !== 0 : e.op === '<' ? o < 0 : e.op === '>' ? o > 0 : e.op === '<=' ? o <= 0 : o >= 0;
      }
      case 'like': { var v = val(e.l), pat = val(e.r); return v == null || pat == null ? null : flip(likeRegex(String(pat), e.ci).test(String(v)), e.neg); }
      case 'isnull': return (val(e.l) == null) !== !!e.neg;
      case 'between': {
        var k = kindOf(e.l, e.a), lo = order(val(e.l), val(e.a), k), hi = order(val(e.l), val(e.b), k);
        if (lo === null || hi === null) return null;
        return flip(lo >= 0 && hi <= 0, e.neg);
      }
      case 'in': {
        var k2 = kindOf(e.l, e.l), unknown = false, found = false;
        e.list.forEach(function (x) { var r = order(val(e.l), val(x), k2); if (r === null) unknown = true; else if (r === 0) found = true; });
        return flip(found ? true : unknown ? null : false, e.neg);
      }
    }
    return null;
  }
  // `{ ok: true, table, columns, rows, sources, total, shown, capped, removed, query, sql }` or `{ ok: false, line, message }`.
  // `rows` are what the query selects and `sources` the rows of the table they came from, in the same order (a row opens in the record editor).
  function runQuery(sql, tables, data) {
    var parsed = parseQuery(sql);
    if (!parsed.ok) return parsed;
    var q = parsed.query, checked = checkQuery(q, tables);
    if (!checked.table) return { ok: false, line: checked.line, message: checked.message };
    var table = checked.table, all = (data && data[table.name]) || [];
    var matched = q.where ? all.filter(function (r) { return evalWhere(q.where, r, table) === true; }) : all.slice();
    var removed = all.length - matched.length;
    if (q.order.length) {
      var keys = q.order.map(function (o) { var c = table.columns.find(function (x) { return x.name === (aliased(q, o.col) || o.col.name); }); return { name: c.name, kind: cellKind(c.type), desc: o.dir === 'DESC' }; });
      matched = matched.map(function (r, i) { return { r: r, i: i }; }).sort(function (x, y) {
        for (var k = 0; k < keys.length; k++) {
          var a = x.r[keys[k].name], b = y.r[keys[k].name], d;
          if (a == null || b == null) d = a == null && b == null ? 0 : a == null ? 1 : -1;
          else if (keys[k].kind === 'number') d = Number(a) - Number(b);
          else { a = String(a); b = String(b); d = a < b ? -1 : a > b ? 1 : 0; }
          if (d) return keys[k].desc ? -d : d;
        }
        return x.i - y.i;
      }).map(function (x) { return x.r; });
    }
    var from = q.offset || 0, to = q.limit == null ? matched.length : from + q.limit, cap = Math.min(to, from + QUERY_MAX_ROWS);
    var picked = matched.slice(from, cap);
    var columns = (q.cols || table.columns.map(function (c) { return { name: c.name }; })).map(function (ref) {
      var col = table.columns.find(function (x) { return x.name === ref.name; });
      return ref.alias ? assign(col, { name: ref.alias, pk: false, fk: null }) : col;
    });
    var refs = q.cols || table.columns.map(function (c) { return { name: c.name }; });
    var rows = picked.map(function (r) { var o = {}; refs.forEach(function (ref, i) { o[columns[i].name] = r[ref.name]; }); return o; });
    return { ok: true, table: table, columns: columns, rows: rows, sources: picked, total: matched.length, shown: rows.length, capped: cap < to && cap < matched.length, removed: removed, query: q, sql: sql, all: all.length };
  }
  // The plan, as lines: what is scanned, filtered, sorted and cut, with the rows each step holds.
  function queryPlan(r, ms) {
    var q = r.query, n = function (x) { return x.toLocaleString('en-US'); }, nodes = [];
    if (q.limit != null || q.offset != null) nodes.push({ text: 'Limit  (rows=' + n(r.shown) + ')', details: [] });
    if (q.order.length) nodes.push({ text: 'Sort  (rows=' + n(r.total) + ')', details: ['Sort Key: ' + q.order.map(function (o) { return o.col.name + (o.dir === 'DESC' ? ' DESC' : ''); }).join(', ')] });
    var scan = { text: 'Seq Scan on ' + q.table + '  (rows=' + n(r.total) + ')', details: [] };
    if (q.where) { scan.details.push('Filter: (' + exprSql(q.where, 0) + ')'); scan.details.push('Rows Removed by Filter: ' + n(r.removed)); }
    nodes.push(scan);
    var lines = [];
    nodes.forEach(function (node, i) {
      var prefix = i === 0 ? '' : new Array(6 * (i - 1) + 3).join(' ') + '->  ';
      lines.push(prefix + node.text);
      node.details.forEach(function (d) { lines.push(new Array(prefix.length + 3).join(' ') + d); });
    });
    if (ms != null) lines.push('Execution time: ' + ms + ' ms');
    return lines;
  }

  var QUERY_SAMPLE = ['SELECT', '  id,', '  email,', '  name,', '  created_at', 'FROM users', 'WHERE name IS NOT NULL', "  AND created_at >= '2026-03-01'", 'ORDER BY created_at DESC', 'LIMIT 100;'].join('\n');
  // The same with a column that is not there, on line 7.
  var QUERY_SAMPLE_BAD = ['SELECT', '  id,', '  email,', '  name,', '  created_at', 'FROM users', "WHERE countr = 'VN'", '  AND name IS NOT NULL', 'ORDER BY created_at DESC', 'LIMIT 100;'].join('\n');
  // The Builder of Screen17: three conditions and a group inside them.
  var QUERY_SAMPLE_SPEC = {
    table: 'users', columns: null, sort: { column: 'created_at', dir: 'desc' }, limit: 100,
    where: { op: 'AND', items: [
      { column: 'name', op: 'notnull', value: '', value2: '' },
      { column: 'created_at', op: 'after', value: '2026-03-01', value2: '' },
      { column: 'email', op: 'contains', value: 'example.com', value2: '' },
      { op: 'OR', items: [{ column: 'id', op: 'lt', value: '600', value2: '' }, { column: 'id', op: 'between', value: '900', value2: '1100' }] }
    ] }
  };
  var QUERY_SAVED = [
    { name: 'Signed up this quarter', sql: "SELECT id, email, created_at\nFROM users\nWHERE created_at >= '2026-04-01'\nORDER BY created_at DESC\nLIMIT 100;" },
    { name: 'Orders awaiting shipment', sql: "SELECT *\nFROM orders\nWHERE status = 'paid'\nORDER BY created_at\nLIMIT 100;" },
    { name: 'Products over 100', sql: 'SELECT id, name, sku, price\nFROM products\nWHERE price > 100\nORDER BY price DESC\nLIMIT 100;' }
  ];
  var QUERY_RECENT = [
    { sql: QUERY_SAMPLE, ok: true, ms: 12, at: '2 min ago' },
    { sql: 'SELECT id, user_id, total\nFROM orders\nWHERE total > 200\nORDER BY total DESC\nLIMIT 50;', ok: true, ms: 8, at: '18 min ago' },
    { sql: QUERY_SAMPLE_BAD, ok: false, at: '1 h ago' },
    { sql: 'SELECT *\nFROM order_items\nWHERE quantity BETWEEN 2 AND 3\nLIMIT 100;', ok: true, ms: 15, at: '3 h ago' }
  ];

  // ------------------------------------------------------------------ records: the query console
  var QUERY_GROUP_OPS = [{ value: 'AND', label: 'AND' }, { value: 'OR', label: 'OR' }];
  var QUERY_DIRS = [{ value: 'asc', label: 'ASC' }, { value: 'desc', label: 'DESC' }];
  var QUERY_MODES = [{ value: 'builder', label: 'Builder', icon: 'filter' }, { value: 'sql', label: 'SQL', icon: 'code' }];

  function newCondition(table) {
    var c = table.columns[0], kind = cellKind(c.type);
    return { column: c.name, op: queryOps(c)[0].value, value: kind === 'boolean' ? 'true' : '', value2: '' };
  }
  // A group changed at the end of `path` (the index in each group, from the top), the rest as it was.
  function mapAt(group, path, fn) {
    if (!path.length) return fn(group);
    return assign(group, { items: group.items.map(function (it, k) { return k === path[0] ? mapAt(it, path.slice(1), fn) : it; }) });
  }
  function removeAt(group, path) {
    var last = path[path.length - 1];
    return mapAt(group, path.slice(0, -1), function (g) { return assign(g, { items: g.items.filter(function (_, k) { return k !== last; }) }); });
  }
  function countConditions(g) { return g.items.reduce(function (n, it) { return n + (it.items ? countConditions(it) : 1); }, 0); }

  function QueryCondition(p) {
    var c = p.condition, table = p.table;
    var col = table.columns.find(function (x) { return x.name === c.column; }) || table.columns[0];
    var kind = cellKind(col.type), ops = queryOps(col);
    function set(patch) { p.onChange(assign(c, patch)); }
    function pickColumn(name) {
      var next = table.columns.find(function (x) { return x.name === name; }), nk = cellKind(next.type), nops = queryOps(next);
      set({ column: name, op: nops.some(function (o) { return o.value === c.op; }) ? c.op : nops[0].value, value: nk === kind ? c.value : nk === 'boolean' ? 'true' : '', value2: nk === kind ? c.value2 : '' });
    }
    var hint = kind === 'time' ? (momentWord(col.type) === 'timestamp' ? 'YYYY-MM-DD' : MOMENTS[momentWord(col.type)].text) : kind === 'number' ? 'Number' : 'Value';
    function input(field, label) {
      return h(Input, { mono: true, placeholder: hint, 'aria-label': label, error: !!p.error && !!valueProblem(col, c[field]), value: c[field], onChange: function (e) { set(kv(field, e.target.value)); } });
    }
    var value = isBare(c.op) ? h('span', { className: 'ss-qb-bare' }, 'No value needed')
      : kind === 'boolean' ? h(Select, { mono: true, label: 'Value', value: c.value || 'true', onChange: function (v) { set({ value: v }); }, options: ['true', 'false'] })
        : c.op === 'between' ? h('div', { className: 'ss-qb-pair' }, input('value', 'From'), h('span', { className: 'ss-qb-and' }, 'and'), input('value2', 'To'))
          : input('value', 'Value');
    return h('div', { className: 'ss-qb-cond' },
      h(Select, { mono: true, label: 'Column', value: col.name, onChange: pickColumn, options: table.columns.map(function (x) { return x.name; }) }),
      h(Select, { mono: true, label: 'Operator', value: c.op, onChange: function (v) { set({ op: v }); }, options: ops }),
      h('div', { className: 'ss-qb-value' }, value),
      h(IconButton, { icon: 'x', size: 'sm', label: 'Remove condition', onClick: p.onRemove }),
      p.error && h('div', { className: 'ss-field-error ss-qb-err', role: 'alert' }, h(Icon, { name: 'alert', size: 13 }), p.error));
  }

  // The Builder: a filter written by choosing instead of typing. It keeps nothing: `value` is the query (see `defaultQuery`), `onChange(query)` hears every change.
  function FilterBuilder(p) {
    var tables = p.tables || SAMPLE_TABLES, spec = p.value;
    var table = tables.find(function (t) { return t.name === spec.table; }) || tables[0];
    var _cols = usePopover(!!p.columnsOpen);
    var _copied = useState(false), copied = _copied[0], setCopied = _copied[1];
    useEffect(function () { if (!copied) return; var t = setTimeout(function () { setCopied(false); }, 1400); return function () { clearTimeout(t); }; }, [copied]);
    var problems = queryProblems(spec, table), shown = {};
    problems.forEach(function (x) { shown[x.path.join('.')] = x.message; });
    var sql = buildQuery(spec, table), total = countConditions(spec.where);
    function change(patch) { p.onChange(assign(spec, patch)); }
    function edit(path, fn) { change({ where: mapAt(spec.where, path, fn) }); }
    function copy() {
      try { navigator.clipboard.writeText(sql).then(function () { setCopied(true); }, function () { }); } catch (e) { /* no clipboard here */ }
    }
    function pickTable(name) { p.onChange(defaultQuery(tables.find(function (t) { return t.name === name; }))); }

    function group(g, path) {
      var nested = path.length > 0;
      return h('div', { key: path.join('.') || 'root', className: cx('ss-qb-group', nested && 'is-nested'), role: 'group', 'aria-label': nested ? 'Condition group' : 'Conditions' },
        h('div', { className: 'ss-qb-ghead' },
          h(SegmentedControl, { options: QUERY_GROUP_OPS, value: g.op, onChange: function (v) { edit(path, function (x) { return assign(x, { op: v }); }); } }),
          h('span', { className: 'ss-qb-gtext' }, g.op === 'AND' ? 'All of these must match' : 'Any of these may match'),
          nested && h('span', { className: 'ss-spacer' }),
          nested && h(IconButton, { icon: 'x', size: 'sm', label: 'Remove group', onClick: function () { p.onChange(assign(spec, { where: removeAt(spec.where, path) })); } })),
        g.items.length
          ? g.items.map(function (it, i) {
            var at = path.concat([i]);
            return it.items ? group(it, at) : h(QueryCondition, {
              key: at.join('.'), condition: it, table: table, error: p.showErrors ? shown[at.join('.')] : null,
              onChange: function (next) { edit(path, function (x) { return assign(x, { items: x.items.map(function (y, k) { return k === i ? next : y; }) }); }); },
              onRemove: function () { p.onChange(assign(spec, { where: removeAt(spec.where, at) })); }
            });
          })
          : h('div', { className: 'ss-pane-none' }, nested ? 'This group is empty. Add a condition or remove it.' : 'No conditions. Every row of ' + table.name + ' matches.'),
        h('div', { className: 'ss-qb-add' },
          h(Button, { variant: 'ghost', size: 'sm', icon: 'plus', onClick: function () { edit(path, function (x) { return assign(x, { items: x.items.concat([newCondition(table)]) }); }); } }, 'Add condition'),
          h(Button, { variant: 'ghost', size: 'sm', icon: 'layers', onClick: function () { edit(path, function (x) { return assign(x, { items: x.items.concat([{ op: x.op === 'AND' ? 'OR' : 'AND', items: [newCondition(table)] }]) }); }); } }, 'Add group')));
    }

    var hidden = spec.columns ? table.columns.filter(function (c) { return spec.columns.indexOf(c.name) < 0; }).map(function (c) { return c.name; }) : [];
    var visible = table.columns.length - hidden.length;
    var sortOpts = [{ value: '', label: 'None' }].concat(table.columns.map(function (c) { return { value: c.name, label: c.name }; }));
    var limitOpts = [{ value: '', label: 'No limit' }].concat(QUERY_LIMITS.concat(spec.limit != null && QUERY_LIMITS.indexOf(spec.limit) < 0 ? [spec.limit] : []).sort(function (a, b) { return a - b; }).map(function (n) { return { value: String(n), label: String(n) }; }));

    return h('div', { className: 'ss-qb' },
      h('div', { className: 'ss-qb-main' },
        h('div', { className: 'ss-qb-from' },
          h('span', { className: 'ss-caption' }, 'From'),
          h('div', { className: 'ss-qb-table' }, h(Select, { mono: true, label: 'Table', value: table.name, onChange: pickTable, options: tables.map(function (t) { return t.name; }) })),
          h('span', { className: 'ss-spacer' }),
          h(Button, { variant: 'ghost', size: 'sm', disabled: !total, onClick: function () { change({ where: { op: 'AND', items: [] } }); } }, 'Clear all')),
        group(spec.where, [])),
      h('aside', { className: 'ss-qb-side', 'aria-label': 'Output' },
        h('div', { className: 'ss-qb-fields' },
          h(Field, { label: 'Columns' },
            h('div', { className: 'ss-anchor ss-qb-anchor', ref: _cols.ref },
              h(Button, { icon: 'columns', active: _cols.open, 'aria-haspopup': 'dialog', 'aria-expanded': _cols.open, onClick: function () { _cols.set(!_cols.open); } }, visible === table.columns.length ? 'All ' + table.columns.length + ' columns' : visible + ' of ' + table.columns.length + ' columns'),
              _cols.open && h('div', { className: 'ss-anchor-pop' }, h(ColumnsMenu, {
                columns: table.columns, hidden: hidden,
                onHidden: function (list) { var keep = table.columns.filter(function (c) { return list.indexOf(c.name) < 0; }).map(function (c) { return c.name; }); change({ columns: keep.length === table.columns.length ? null : keep }); }
              })))),
          h(Field, { label: 'Limit' }, h(Select, { mono: true, label: 'Limit', value: spec.limit == null ? '' : String(spec.limit), onChange: function (v) { change({ limit: v === '' ? null : Number(v) }); }, options: limitOpts })),
          h(Field, { label: 'Sort', className: 'ss-qb-sort' },
            h('div', { className: 'ss-qb-sortrow' },
              h(Select, { mono: true, label: 'Sort by', value: spec.sort ? spec.sort.column : '', onChange: function (v) { change({ sort: v ? { column: v, dir: spec.sort ? spec.sort.dir : 'asc' } : null }); }, options: sortOpts }),
              h(SegmentedControl, { options: spec.sort ? QUERY_DIRS : QUERY_DIRS.map(function (d) { return assign(d, { disabled: true }); }), value: spec.sort ? spec.sort.dir : 'asc', onChange: function (v) { change({ sort: assign(spec.sort, { dir: v }) }); } })))),
        h('div', { className: 'ss-qb-sqlbar' },
          h('span', { className: 'ss-caption' }, 'SQL'),
          h('span', { className: 'ss-spacer' }),
          h(Button, { variant: 'ghost', size: 'sm', icon: copied ? 'check' : 'copy', onClick: copy }, copied ? 'Copied' : 'Copy'),
          p.onEditSql && h(Button, { variant: 'ghost', size: 'sm', icon: 'code', onClick: function () { p.onEditSql(sql); } }, 'Edit as SQL')),
        h('pre', { className: 'ss-qb-sql', 'aria-label': 'Generated SQL', dangerouslySetInnerHTML: { __html: highlightSql(sql) } }),
        p.showErrors && problems.length > 0 && h('div', { className: 'ss-field-error', role: 'alert' }, h(Icon, { name: 'alert', size: 13 }), 'Complete or remove ' + countText(problems.length, 'condition', 'conditions') + ' to run.'),
        p.actions && h('div', { className: 'ss-qb-actions' }, p.actions)));
  }

  // The panel under the query: Results, Messages and Plan.
  var QUERY_TABS = [{ value: 'results', label: 'Results' }, { value: 'messages', label: 'Messages' }, { value: 'plan', label: 'Plan' }];
  var QUERY_RESULTS_H = 380;

  function QuerySaveForm(p) {
    var _n = useState(''), name = _n[0], setName = _n[1];
    var _e = useState(null), error = _e[0], setError = _e[1];
    var ref = useRef(null);
    useEffect(function () { if (ref.current) ref.current.focus(); }, []);
    function submit() {
      var v = name.trim();
      if (!v) { setError('Query name cannot be empty.'); return; }
      if (p.names.indexOf(v) >= 0) { setError('A saved query named "' + v + '" already exists.'); return; }
      p.onSave(v);
    }
    return h('div', { className: 'ss-menu ss-dt-pop', role: 'dialog', 'aria-label': 'Save query', onKeyDown: function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(); } } },
      h('div', { className: 'ss-menu-label' }, 'Save query'),
      h('div', { className: 'ss-dt-form' },
        h(Field, { error: error, hint: 'Saved queries are listed in History.' }, h(Input, { placeholder: 'Signed up this quarter', 'aria-label': 'Query name', error: !!error, value: name, inputRef: ref, onChange: function (e) { setName(e.target.value); setError(null); } })),
        h('div', { className: 'ss-dt-form-foot' }, h(Button, { variant: 'primary', size: 'sm', kbd: '⏎', onClick: submit }, 'Save query'))));
  }

  function QueryHistory(p) {
    function item(x, i, saved) {
      var line = x.sql.replace(/\s+/g, ' ');
      return h('button', { key: (saved ? 's' : 'r') + i, type: 'button', className: 'ss-qh-item', title: x.sql, onClick: function () { p.onPick(x); } },
        h('span', { className: 'ss-qh-main' },
          saved && h('span', { className: 'ss-qh-name' }, x.name),
          h('span', { className: cx('ss-qh-sql', saved && 'is-sub') }, line)),
        h('span', { className: cx('ss-qh-meta', x.ok === false && 'is-error') }, x.ok === false && h(Icon, { name: 'alert', size: 12 }), [x.ok === false ? 'Failed' : x.ms != null ? x.ms + ' ms' : null, x.at].filter(Boolean).join(' · ')));
    }
    return h('div', { className: 'ss-menu ss-qh', role: 'dialog', 'aria-label': 'Query history' },
      h('div', { className: 'ss-qh-list' },
        h('div', { className: 'ss-menu-label ss-qh-head' }, h('span', null, 'Saved'), h('span', { className: 'ss-tl-count' }, p.saved.length)),
        p.saved.length ? p.saved.map(function (x, i) { return item(x, i, true); }) : h('div', { className: 'ss-pane-none ss-qh-none' }, 'No saved queries. Save query keeps one here.'),
        h('div', { className: 'ss-menu-sep', role: 'separator' }),
        h('div', { className: 'ss-menu-label ss-qh-head' }, h('span', null, 'Recent'), h('span', { className: 'ss-tl-count' }, p.recent.length)),
        p.recent.length ? p.recent.map(function (x, i) { return item(x, i, false); }) : h('div', { className: 'ss-pane-none ss-qh-none' }, 'Nothing has been run yet.')));
  }

  // Query mode: a console over the rows of the sample. Builder or SQL on top, Results / Messages / Plan below, divided by a line that is dragged.
  // It keeps its own state and its own working copy of the rows (`data`: a row edited in the record editor is changed there, and the results follow);
  // the host hears `onSaveRecord(table, row, saved)`, `onSaveQuery(entry)` and `onRun(entry)`. The other props start it somewhere for a preview or a test:
  // `mode`, `spec`, `sql`, `error` (the SQL with a mistyped column, already run), `run` (run it as it opens), `attempted` (Run was pressed with conditions to fix), `duration` (the ms shown), `tab`, `height` (of the
  // results), `saved`, `recent`, `historyOpen`, `saveOpen`, `running`, `openRow` (a row of the results that opens in the editor).
  function QueryConsole(p) {
    var tables = p.tables || SAMPLE_TABLES;
    var _data = useState(p.data || SAMPLE_RECORDS), data = _data[0], setData = _data[1];
    var _mode = useState(p.mode || (p.error || p.sql != null ? 'sql' : 'builder')), mode = _mode[0], setMode = _mode[1];
    var _spec = useState(p.spec || defaultQuery(tables[0])), spec = _spec[0], setSpec = _spec[1];
    var _sql = useState(p.sql != null ? p.sql : p.error ? QUERY_SAMPLE_BAD : QUERY_SAMPLE), sql = _sql[0], setSql = _sql[1];
    var _tried = useState(!!p.attempted), tried = _tried[0], setTried = _tried[1];
    var seq = useRef(0);
    var table = tables.find(function (t) { return t.name === spec.table; }) || tables[0];
    // Starting by running: what the first run would be, and how long it took.
    function measure(text) { var t0 = performance.now(); runQuery(text, tables, data); return Math.max(1, Math.round(performance.now() - t0)); }
    var firstSql = mode === 'builder' ? buildQuery(spec, table) : sql;
    var _ran = useState(p.run || p.error ? { sql: firstSql, ms: p.duration != null ? p.duration : measure(firstSql) } : null), ran = _ran[0], setRan = _ran[1];
    var result = useMemo(function () { return ran ? runQuery(ran.sql, tables, data) : null; }, [ran, data, tables]);
    var _tab = useState(p.tab || (p.error ? 'messages' : 'results')), tab = _tab[0], setTab = _tab[1];
    var _h = useState(p.height || QUERY_RESULTS_H), height = _h[0], setHeight = _h[1];
    var _saved = useState(p.saved || QUERY_SAVED), saved = _saved[0], setSaved = _saved[1];
    var _recent = useState(p.recent || QUERY_RECENT), recent = _recent[0], setRecent = _recent[1];
    var _notes = useState([]), notes = _notes[0], setNotes = _notes[1];
    var _cleared = useState(null), cleared = _cleared[0], setCleared = _cleared[1];
    var _fmt = useState(null), fmtError = _fmt[0], setFmtError = _fmt[1];
    var _act = useState(null), act = _act[0], setAct = _act[1];
    var _edit = useState(function () { return p.openRow != null && result && result.ok ? { id: 0, source: result.sources[p.openRow] } : null; }), edit = _edit[0], setEdit = _edit[1];
    var _ed = useState(false), editDirty = _ed[0], setEditDirty = _ed[1];
    var _ec = useState([]), editChanged = _ec[0], setEditChanged = _ec[1];
    var _ew = useState(520), editWidth = _ew[0], setEditWidth = _ew[1];
    var _pend = useState(null), pending = _pend[0], setPending = _pend[1];
    var sqlEdited = useRef(p.sql != null || !!p.error || p.mode === 'sql');
    var history = usePopover(!!p.historyOpen), saving = usePopover(!!p.saveOpen), exporting = usePopover();
    var root = useRef(null);
    var running = !!p.running;

    function runSql(text, entry) {
      var ms = p.duration != null ? p.duration : measure(text), r = runQuery(text, tables, data);
      setRan({ sql: text, ms: ms }); setNotes([]); setAct(null); setCleared(null); setFmtError(null);
      setTab(r.ok ? (tab === 'plan' ? 'plan' : 'results') : 'messages');
      var item = assign(entry, { sql: text, ok: r.ok, ms: r.ok ? ms : undefined, at: 'Just now' });
      setRecent([item].concat(recent.filter(function (x) { return x.sql !== text; })).slice(0, 8));
      if (p.onRun) p.onRun(item);
    }
    function run() {
      if (running) return;
      if (mode === 'builder') {
        if (queryProblems(spec, table).length) { setTried(true); return; }
        setTried(false); runSql(buildQuery(spec, table), { mode: 'builder', spec: spec });
      } else if (sql.trim()) runSql(sql, { mode: 'sql' });
    }
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !pending) { e.preventDefault(); e.stopPropagation(); run(); }
    }
    function switchMode(m) {
      if (m === mode) return;
      if (m === 'sql' && !sqlEdited.current) setSql(buildQuery(spec, table));
      setMode(m);
    }
    function load(x) {
      history.set(false);
      if (x.spec) { setSpec(x.spec); setMode('builder'); setTried(false); } else { setSql(x.sql); sqlEdited.current = true; setMode('sql'); setCleared(null); setFmtError(null); }
    }
    function currentSql() { return mode === 'builder' ? buildQuery(spec, table) : sql; }
    function saveQuery(name) {
      var entry = assign({ name: name, sql: currentSql() }, mode === 'builder' ? { spec: spec } : null);
      setSaved([entry].concat(saved)); saving.set(false);
      if (p.onSaveQuery) p.onSaveQuery(entry);
    }
    function gotoLine(n) {
      var ta = root.current && root.current.querySelector('.ss-qc-sql textarea');
      if (!ta) return;
      var at = 0, k;
      for (k = 1; k < n; k++) { var nl = sql.indexOf('\n', at); if (nl < 0) break; at = nl + 1; }
      ta.focus(); ta.setSelectionRange(at, at);
    }
    function format() {
      var r = formatQuery(sql);
      if (!r.ok) { setFmtError(r.message); return; }
      setSql(r.sql); setFmtError(null); sqlEdited.current = true;
    }
    function exportAs(kind) {
      exporting.set(false);
      if (!result || !result.ok) return;
      var rows = result.rows;
      if (kind === 'csv') saveText('query-results.csv', [result.columns.map(function (c) { return csvCell(c.name); }).join(',')].concat(rows.map(function (r) { return result.columns.map(function (c) { return csvCell(r[c.name]); }).join(','); })).join('\n') + '\n', 'text/csv');
      else if (kind === 'json') saveText('query-results.json', JSON.stringify(rows, null, 2) + '\n', 'application/json');
      else { try { navigator.clipboard.writeText(JSON.stringify(rows, null, 2)); } catch (e) { /* no clipboard here */ } }
      setNotes(notes.concat([{ text: (kind === 'copy' ? 'Copied ' : 'Exported ') + countText(rows.length, 'row', 'rows') + (kind === 'csv' ? ' as CSV.' : ' as JSON.') }]));
    }

    // The record editor: a row of the results opens the row of the table it came from.
    function leave(next) { if (edit && editDirty) setPending({ run: next }); else next(); }
    function openRow(r) {
      if (!result || !result.ok) return;
      var source = result.sources[r];
      if (edit && edit.source === source) return;
      leave(function () { setEdit({ id: ++seq.current, source: source }); setEditDirty(false); });
    }
    function saveRecord(values) {
      var old = edit.source, next = assign(data), saved2 = assign(old, values), tname = result.table.name;
      next[tname] = (data[tname] || []).map(function (r) { return r === old ? saved2 : r; });
      setData(next); setEdit(null); setEditDirty(false);
      setNotes(notes.concat([{ text: 'Updated ' + recordLabel(result.table, saved2) + ' in the working copy. Not saved yet.' }]));
      if (p.onSaveRecord) p.onSaveRecord(tname, old, saved2);
    }

    // ---- the header
    var names = saved.map(function (x) { return x.name; });
    var header = h('div', { className: 'ss-qc-head' },
      h('h2', { className: 'ss-rec-title' }, 'Query'),
      h(Badge, { dot: true, title: 'The rows are sample data made for this schema.' }, 'Sample data'),
      h(SegmentedControl, { options: QUERY_MODES, value: mode, onChange: switchMode }),
      h('span', { className: 'ss-spacer' }),
      h('div', { className: 'ss-anchor', ref: saving.ref },
        h(Button, { icon: 'bookmark', active: saving.open, disabled: !currentSql().trim(), 'aria-haspopup': 'dialog', 'aria-expanded': saving.open, title: 'Save query', onClick: function () { history.set(false); saving.set(!saving.open); } }, h('span', { className: 'ss-qc-lbl' }, 'Save query')),
        saving.open && h('div', { className: 'ss-anchor-pop ss-anchor-pop--end' }, h(QuerySaveForm, { names: names, onSave: saveQuery }))),
      h('div', { className: 'ss-anchor', ref: history.ref },
        h(Button, { icon: 'history', active: history.open, 'aria-haspopup': 'dialog', 'aria-expanded': history.open, title: 'History', onClick: function () { saving.set(false); history.set(!history.open); } }, h('span', { className: 'ss-qc-lbl' }, 'History')),
        history.open && h('div', { className: 'ss-anchor-pop ss-anchor-pop--end' }, h(QueryHistory, { saved: saved, recent: recent, onPick: load }))));

    // ---- the top: the Builder or the SQL
    var runButton = h(Button, { variant: 'primary', icon: 'play', disabled: running || (mode === 'sql' && !sql.trim()), kbd: ['⌘', '⏎'], onClick: run }, running ? 'Running…' : 'Run');
    var status = null;
    if (fmtError) status = h('span', { className: 'ss-qc-status is-error' }, h(Icon, { name: 'alert', size: 13 }), fmtError);
    else if (cleared !== null) status = h('span', { className: 'ss-qc-status' }, 'Editor cleared.', h('a', { onClick: function () { setSql(cleared); setCleared(null); } }, 'Undo'));
    else if (running) status = h('span', { className: 'ss-qc-status' }, 'Running…');
    else if (ran && result && result.ok) status = h('span', { className: 'ss-qc-status' }, 'Ran in ' + ran.ms + ' ms');
    else if (ran && result) status = h('span', { className: 'ss-qc-status is-error' }, h(Icon, { name: 'alert', size: 13 }), 'Failed', h('a', { onClick: function () { setTab('messages'); } }, 'Show messages'));
    var top = mode === 'builder'
      ? h(FilterBuilder, { tables: tables, value: spec, showErrors: tried, onChange: function (s) { setSpec(s); }, onEditSql: function (text) { setSql(text); sqlEdited.current = true; setMode('sql'); }, actions: runButton })
      : h('div', { className: 'ss-qc-sql' },
        h('div', { className: 'ss-qc-tools' },
          runButton,
          h(Button, { icon: 'code', disabled: !sql.trim(), onClick: format }, 'Format'),
          h(Button, { variant: 'ghost', icon: 'x', disabled: !sql.length, onClick: function () { setCleared(sql); setSql(''); setFmtError(null); sqlEdited.current = true; } }, 'Clear'),
          h('span', { className: 'ss-spacer' }), status),
        h(SqlEditor, { value: sql, onChange: function (v) { setSql(v); sqlEdited.current = true; setCleared(null); setFmtError(null); }, label: 'SQL query', placeholder: 'SELECT * FROM users LIMIT 100;', errorLine: result && !result.ok && result.line && ran && ran.sql === sql ? result.line : null, style: { height: 'auto', flex: '1 1 0', minHeight: 0 } }));

    // ---- the bottom
    var ok = !!result && result.ok;
    var meta = running ? 'Running…' : ok ? countText(result.shown, 'row', 'rows') + ' · ' + ran.ms + ' ms' : null;
    var items = messageItems();
    var resHead = h('div', { className: 'ss-qc-rhead' },
      h('div', { className: 'ss-tabs', role: 'tablist', 'aria-label': 'Query output' }, QUERY_TABS.map(function (x, i) {
        var on = tab === x.value;
        return h('button', {
          key: x.value, type: 'button', role: 'tab', 'aria-selected': on, tabIndex: on ? 0 : -1, className: cx('ss-tab', on && 'is-active'), onClick: function () { setTab(x.value); },
          onKeyDown: function (e) {
            var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
            if (!d) return;
            e.preventDefault(); var n = QUERY_TABS[(i + d + QUERY_TABS.length) % QUERY_TABS.length].value; setTab(n);
            var el = e.currentTarget.parentNode.querySelector('[data-tab="' + n + '"]'); if (el) el.focus();
          }, 'data-tab': x.value
        }, x.label,
          x.value === 'results' && ok && !running && h('span', { className: 'ss-tab-count' }, result.shown),
          x.value === 'messages' && items.length > 0 && h('span', { className: cx('ss-tab-count', result && !result.ok && 'is-error') }, items.length));
      })),
      h('span', { className: 'ss-spacer' }),
      meta && h('span', { className: 'ss-qc-meta' }, meta),
      h('div', { className: 'ss-anchor', ref: exporting.ref },
        h(Button, { size: 'sm', icon: 'download', active: exporting.open, disabled: !ok || running || !result.shown, 'aria-haspopup': 'menu', 'aria-expanded': exporting.open, onClick: function () { exporting.set(!exporting.open); } }, 'Export'),
        exporting.open && h('div', { className: 'ss-anchor-pop ss-anchor-pop--end' }, h(ContextMenu, {
          label: 'Export ' + countText(ok ? result.shown : 0, 'row', 'rows'), onClose: function () { exporting.set(false); },
          items: [{ icon: 'download', label: 'CSV', shortcut: '.csv', onSelect: function () { exportAs('csv'); } }, { icon: 'download', label: 'JSON', shortcut: '.json', onSelect: function () { exportAs('json'); } }, '-', { icon: 'copy', label: 'Copy as JSON', onSelect: function () { exportAs('copy'); } }]
        }))));

    function resultsBody() {
      if (running) return h(DataGrid, { columns: table.columns, rows: [], loading: true, selectable: false, label: 'Results' });
      if (!result) return h(EmptyState, { compact: true, title: 'No results yet.', description: 'Run the query to see its rows here.', actions: h(Button, { variant: 'primary', icon: 'play', kbd: ['⌘', '⏎'], onClick: run }, 'Run') });
      if (!result.ok) return h(EmptyState, { compact: true, title: 'The query did not run.', description: 'No rows were read. Messages says what went wrong.', actions: h(Button, { onClick: function () { setTab('messages'); } }, 'Show messages') });
      return h(DataGrid, {
        columns: result.columns, rows: result.rows, selectable: false, label: 'Results', activeCell: act, onActiveCell: setAct, onOpenRow: openRow,
        empty: result.rows.length ? false : h(EmptyState, { compact: true, title: 'No rows match the query.', description: result.all.toLocaleString('en-US') + (result.all === 1 ? ' row was' : ' rows were') + ' read from ' + result.table.name + '.', actions: null })
      });
    }
    function messageItems() {
      var list = [];
      if (!result) return list;
      if (!result.ok) {
        list.push(h(Alert, {
          key: 'err', tone: 'error', title: result.message,
          action: mode === 'sql' && result.line && ran && ran.sql === sql ? h(Button, { size: 'sm', variant: 'ghost', onClick: function () { gotoLine(result.line); } }, 'Go to line') : undefined
        }, result.line ? h('span', { className: 'ss-mono' }, 'Line ' + result.line) : null));
      } else {
        list.push(h('div', { key: 'ok', className: 'ss-qc-msg is-ok' }, h(Icon, { name: 'check-circle', size: 14 }), h('span', null, 'Query returned ' + countText(result.shown, 'row', 'rows') + ' in ' + ran.ms + ' ms.')));
        if (result.capped) list.push(h('div', { key: 'cap', className: 'ss-qc-msg' }, h(Icon, { name: 'info', size: 14 }), h('span', null, 'Showing the first ' + QUERY_MAX_ROWS.toLocaleString('en-US') + ' of ' + countText(result.total, 'row', 'rows') + '.')));
        else if (result.query.limit != null && result.total > result.shown) list.push(h('div', { key: 'lim', className: 'ss-qc-msg' }, h(Icon, { name: 'info', size: 14 }), h('span', null, countText(result.total, 'row', 'rows') + ' matched. Showing the first ' + result.shown.toLocaleString('en-US') + ' (LIMIT ' + result.query.limit + ').')));
      }
      notes.forEach(function (n, i) { list.push(h('div', { key: 'n' + i, className: 'ss-qc-msg' }, h(Icon, { name: 'info', size: 14 }), h('span', null, n.text))); });
      return list;
    }
    function messagesBody() {
      if (!result) return h('div', { className: 'ss-qc-pane' }, h('div', { className: 'ss-pane-none' }, 'No messages yet. Run a query.'));
      return h('div', { className: 'ss-qc-pane' }, items);
    }
    function planBody() {
      if (!result) return h('div', { className: 'ss-qc-pane' }, h('div', { className: 'ss-pane-none' }, 'No plan yet. Run a query.'));
      if (!result.ok) return h('div', { className: 'ss-qc-pane' }, h('div', { className: 'ss-pane-none' }, 'There is no plan for a query that did not run.'));
      return h('div', { className: 'ss-qc-pane' }, h('pre', { className: 'ss-qc-plan', 'aria-label': 'Query plan' }, queryPlan(result, ran.ms).join('\n')));
    }
    var body = tab === 'messages' ? messagesBody() : tab === 'plan' ? planBody() : resultsBody();

    var editTable = result && result.ok ? result.table : null;
    var editor = edit && editTable && h(RecordEditor, {
      key: edit.id, table: editTable, tables: tables, data: data, record: edit.source, width: editWidth, onWidth: setEditWidth, onSave: saveRecord,
      onDirty: function (d, changed) { setEditDirty(d); setEditChanged(changed); }, onClose: function () { setEdit(null); setEditDirty(false); }
    });
    var discarding = pending && editTable && h(ConfirmDialog, {
      title: 'Discard changes to ' + recordLabel(editTable, edit.source) + '?', danger: true, confirmLabel: 'Discard changes', cancelLabel: 'Keep editing',
      onCancel: function () { setPending(null); }, onConfirm: function () { var next = pending.run; setPending(null); next(); }
    }, h('div', { style: { color: 'var(--ink-2)' } }, editChanged.length ? h(Fragment, null, countText(editChanged.length, 'changed column', 'changed columns') + ' will be lost: ', h(Mono, null, editChanged.join(', ')), '.') : 'The edited JSON will be lost.'));

    return h('div', { className: 'ss-qc', ref: root },
      h('div', { className: 'ss-qc-col', onKeyDown: onKey },
        header,
        h('div', { className: 'ss-qc-top' }, top),
        h('section', { className: 'ss-qc-res', style: { height: height }, 'aria-label': 'Query output' },
          h(ResizeHandle, { label: 'Resize results', edge: 'top', width: height, min: 120, max: 640, onResize: setHeight, onReset: function () { setHeight(QUERY_RESULTS_H); } }),
          resHead,
          h('div', { className: 'ss-qc-body', role: 'tabpanel', 'aria-label': QUERY_TABS.find(function (x) { return x.value === tab; }).label }, body))),
      editor, discarding);
  }

  function VersionList(p) {
    return h('div', { className: 'ss-vlist', role: 'listbox', 'aria-label': 'Versions' }, (p.versions || SAMPLE_VERSIONS).map(function (v) {
      return h('button', { key: v.version, type: 'button', role: 'option', 'aria-selected': p.selected === v.version, className: cx('ss-ver', v.current && 'is-current', p.selected === v.version && 'is-selected'), onClick: function () { p.onSelect && p.onSelect(v.version); } },
        h('span', { className: 'ss-ver-rail' }, h('span', { className: 'ss-ver-dot' })),
        h('span', { className: 'ss-ver-body' },
          h('span', { className: 'ss-ver-top' }, h('span', { className: 'ss-ver-num' }, v.version), v.current && h(Badge, { tone: 'accent', sans: true }, 'Current'), h('span', { className: 'ss-ver-time' }, v.current ? 'just now' : v.time)),
          h('span', { className: 'ss-ver-msg', style: { display: 'block' } }, v.message),
          h('span', { className: 'ss-ver-stats' },
            v.added ? h('span', { className: 'a' }, '+' + v.added) : null,
            v.modified ? h('span', { className: 'm' }, '~' + v.modified) : null,
            v.removed ? h('span', { className: 'r' }, '−' + v.removed) : null,
            h('span', { className: 'ss-faint' }, v.author))));
    }));
  }

  var OP_GLYPH = { add: '+', del: '−', mod: '~' };
  var OP_WORD = { add: 'added', del: 'removed', mod: 'changed' };
  function DiffRow(p) {
    var it = p.item;
    return h('div', { className: cx('ss-diff', it.op === 'del' && 'op-del-row', p.selected && 'is-selected'), onClick: p.onClick, title: OP_WORD[it.op] },
      h('span', { className: 'ss-diff-op op-' + it.op, 'aria-label': OP_WORD[it.op] }, OP_GLYPH[it.op]),
      h('span', { className: 'ss-diff-path', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, it.path),
      p.kind && h('span', { className: 'ss-diff-kind' }, p.kind),
      p.showDetail !== false && it.detail && h('span', { className: 'ss-diff-detail' }, it.detail));
  }
  function DiffList(p) {
    var groups = p.groups || SAMPLE_DIFF;
    return h('div', { className: 'ss-difflist' }, groups.map(function (g) {
      return h(Fragment, { key: g.group },
        p.showGroups !== false && h('div', { className: 'ss-diff-group' }, h('span', { className: 'ss-caption' }, g.group), h('span', { className: 'ss-insp-sec-count' }, g.items.length)),
        g.items.map(function (it) { return h(DiffRow, { key: it.path, item: it, showDetail: p.showDetail, selected: p.selected === it.path, onClick: function () { p.onSelect && p.onSelect(it.path); }, kind: p.showKind ? g.group.replace(/s$/, '').toLowerCase() : null }); }));
    }));
  }

  function wordDiff(a, b) {
    var i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    var j = 0; while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
    return { pre: a.slice(0, i), a: a.slice(i, a.length - j), b: b.slice(i, b.length - j), post: a.slice(a.length - j) };
  }
  function DdlDiff(p) {
    var rows = p.rows;
    var ln = 0, rn = 0;
    var L = [], R = [];
    rows.forEach(function (r, idx) {
      var k = r[2] || 'same';
      if (k === 'fold') { L.push(h('div', { key: idx, className: 'ss-ddl-line k-fold' }, h('span'), h('span'), r[0])); R.push(h('div', { key: idx, className: 'ss-ddl-line r k-fold' }, h('span'), h('span'), r[0])); ln += r[3] || 0; rn += r[3] || 0; return; }
      var left = r[0], right = r[1] === undefined ? r[0] : r[1];
      if (k === 'mod') {
        var d = wordDiff(left, right);
        ln++; rn++;
        L.push(h('div', { key: idx, className: 'ss-ddl-line k-del' }, h('span', { className: 'ss-ddl-n' }, ln), h('span', { className: 'ss-ddl-s' }, '−'), h('span', null, d.pre, h('span', { className: 'ss-ddl-hl-del' }, d.a), d.post)));
        R.push(h('div', { key: idx, className: 'ss-ddl-line r k-add' }, h('span', { className: 'ss-ddl-n' }, rn), h('span', { className: 'ss-ddl-s' }, '+'), h('span', null, d.pre, h('span', { className: 'ss-ddl-hl-add' }, d.b), d.post)));
        return;
      }
      if (left == null) L.push(h('div', { key: idx, className: 'ss-ddl-line k-gap' }, h('span'), h('span'), ''));
      else { ln++; L.push(h('div', { key: idx, className: cx('ss-ddl-line', k === 'del' && 'k-del') }, h('span', { className: 'ss-ddl-n' }, ln), h('span', { className: 'ss-ddl-s' }, k === 'del' ? '−' : ''), h('span', { dangerouslySetInnerHTML: { __html: highlightSql(left) } }))); }
      if (right == null || k === 'del') R.push(h('div', { key: idx, className: 'ss-ddl-line r k-gap' }, h('span'), h('span'), ''));
      else { rn++; R.push(h('div', { key: idx, className: cx('ss-ddl-line r', k === 'add' && 'k-add') }, h('span', { className: 'ss-ddl-n' }, rn), h('span', { className: 'ss-ddl-s' }, k === 'add' ? '+' : ''), h('span', { dangerouslySetInnerHTML: { __html: highlightSql(right) } }))); }
    });
    return h('div', { className: 'ss-ddl', style: p.style },
      h('div', { className: 'ss-ddl-head' }, p.leftTitle || 'Version 11', h('span', { className: 'ss-faint', style: { fontWeight: 400 } }, p.leftMeta)),
      h('div', { className: 'ss-ddl-head' }, p.rightTitle || 'Version 12', h('span', { className: 'ss-faint', style: { fontWeight: 400 } }, p.rightMeta)),
      h('div', { className: 'ss-ddl-side' }, L), h('div', { className: 'ss-ddl-side' }, R));
  }

  // ------------------------------------------------------------------ empty state
  function EmptyArt() {
    return h('svg', { className: 'ss-empty-art', width: 360, height: 168, viewBox: '0 0 360 168', 'aria-hidden': true },
      h('path', { className: 'e', d: 'M128 44 C 158 44, 158 70, 196 70' }),
      h('path', { className: 'e', d: 'M128 116 C 162 116, 160 94, 196 94' }),
      h('g', null,
        h('rect', { className: 'n', x: 20.5, y: 20.5, width: 108, height: 64, rx: 6 }), h('rect', { className: 'h', x: 21, y: 21, width: 107, height: 15, rx: 5.5 }),
        h('rect', { className: 'rk', x: 30, y: 44, width: 6, height: 6, rx: 1 }), h('rect', { className: 'r', x: 42, y: 45, width: 40, height: 4, rx: 2 }),
        h('rect', { className: 'r', x: 42, y: 57, width: 54, height: 4, rx: 2 }), h('rect', { className: 'r', x: 42, y: 69, width: 30, height: 4, rx: 2 })),
      h('g', null,
        h('rect', { className: 'n', x: 20.5, y: 96.5, width: 108, height: 52, rx: 6 }), h('rect', { className: 'h', x: 21, y: 97, width: 107, height: 15, rx: 5.5 }),
        h('rect', { className: 'rk', x: 30, y: 120, width: 6, height: 6, rx: 1 }), h('rect', { className: 'r', x: 42, y: 121, width: 34, height: 4, rx: 2 }),
        h('rect', { className: 'r', x: 42, y: 133, width: 48, height: 4, rx: 2 })),
      h('g', null,
        h('rect', { className: 'n', x: 196.5, y: 52.5, width: 116, height: 64, rx: 6 }), h('rect', { className: 'h', x: 197, y: 53, width: 115, height: 15, rx: 5.5 }),
        h('rect', { className: 'rk', x: 206, y: 76, width: 6, height: 6, rx: 1 }), h('rect', { className: 'r', x: 218, y: 77, width: 36, height: 4, rx: 2 }),
        h('rect', { className: 'rf', x: 206, y: 88, width: 6, height: 6, rx: 1 }), h('rect', { className: 'r', x: 218, y: 89, width: 52, height: 4, rx: 2 }),
        h('rect', { className: 'rf', x: 206, y: 100, width: 6, height: 6, rx: 1 }), h('rect', { className: 'r', x: 218, y: 101, width: 44, height: 4, rx: 2 })),
      h('rect', { className: 'ghost', x: 236.5, y: 132.5, width: 100, height: 30, rx: 6 }),
      h('path', { className: 'plus', d: 'M286.5 141.5v12M280.5 147.5h12' }));
  }
  function EmptyState(p) {
    return h('div', { className: cx('ss-empty', p.compact && 'ss-empty--compact') },
      !p.compact && h(EmptyArt),
      h('div', { className: 'ss-empty-title' }, p.title || 'Your database schemas will appear here.'),
      (p.description || !p.compact) && h('div', { className: 'ss-empty-sub' }, p.description || 'Import DDL from an existing database, or start a blank schema and draw tables on the canvas.'),
      (p.actions !== undefined ? p.actions : !p.compact) && h('div', { className: 'ss-empty-actions' }, p.actions !== undefined ? p.actions : h(Fragment, null,
        h(Button, { variant: 'primary', icon: 'upload', onClick: p.onImport, kbd: ['⌘', 'I'] }, 'Import Schema'),
        h(Button, { icon: 'plus', onClick: p.onCreate, kbd: ['⌘', 'N'] }, 'Create New Schema'))),
      p.hints !== false && !p.compact && h('div', { className: 'ss-empty-keys' },
        h('span', null, h(Icon, { name: 'file-code', size: 14 }), 'Accepts pg_dump, mysqldump and plain DDL'),
        h('span', null, h(Kbd, { keys: ['⌘', '/'] }), 'All shortcuts')));
  }

  // ------------------------------------------------------------------ workspace (composed screen)
  function Workspace(p) {
    var _t = useState(p.tables || SAMPLE_TABLES), tables = _t[0], setTables = _t[1];
    var _pos = useState(p.positions || SAMPLE_POSITIONS), positions = _pos[0], setPositions = _pos[1];
    var _sel = useState(p.selected === undefined ? 'users' : p.selected), selected = _sel[0], setSelected = _sel[1];
    var _sc = useState(p.selectedColumn === undefined ? null : p.selectedColumn), selCol = _sc[0], setSelCol = _sc[1];
    var _z = useState(p.zoom || 1), zoom = _z[0], setZoom = _z[1];
    var _dirty = useState(p.dirty ? (p.dirtyTables || [selected]) : []), dirty = _dirty[0], setDirty = _dirty[1];
    var _hist = useState({ past: [], future: [] }), hist = _hist[0], setHist = _hist[1];
    var _toast = useState(p.toast || null), toast = _toast[0], setToast = _toast[1];
    var _confirm = useState(p.confirmDelete || null), confirm = _confirm[0], setConfirm = _confirm[1];
    var _fit = useState(0), fit = _fit[0], setFit = _fit[1];
    var _ver = useState(p.version || 12), ver = _ver[0], setVer = _ver[1];
    var _search = useState(''), search = _search[0], setSearch = _search[1];

    function commit(next, touched) {
      setHist({ past: hist.past.concat([{ tables: tables, positions: positions }]).slice(-50), future: [] });
      if (next.tables) setTables(next.tables);
      if (next.positions) setPositions(next.positions);
      if (touched && dirty.indexOf(touched) < 0) setDirty(dirty.concat([touched]));
    }
    function undo() { if (!hist.past.length) return; var last = hist.past[hist.past.length - 1]; setHist({ past: hist.past.slice(0, -1), future: [{ tables: tables, positions: positions }].concat(hist.future) }); setTables(last.tables); setPositions(last.positions); }
    function redo() { if (!hist.future.length) return; var nx = hist.future[0]; setHist({ past: hist.past.concat([{ tables: tables, positions: positions }]), future: hist.future.slice(1) }); setTables(nx.tables); setPositions(nx.positions); }
    function save() {
      var invalid = tables.some(function (t) { return Object.keys(validateColumns(t)).length; });
      if (invalid) { setToast({ tone: 'error', title: 'Fix validation errors before saving', description: 'One or more columns are invalid. Errors are marked in the inspector.' }); return; }
      setDirty([]); setVer(ver + 1);
      setToast({ tone: 'success', title: 'Saved as v' + (ver + 1), description: 'ecommerce · ' + (tables.length + 19) + ' tables · just now', actions: [{ label: 'View changes' }, { label: 'Undo' }] });
    }
    useEffect(function () {
      function k(e) {
        var mod = e.metaKey || e.ctrlKey;
        if (mod && e.key === 's') { e.preventDefault(); save(); }
        else if (mod && e.key === 'z' && !e.shiftKey) { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; e.preventDefault(); undo(); }
        else if (mod && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
        else if (e.key === 'Escape' && !confirm) { setSelCol(null); }
      }
      window.addEventListener('keydown', k); return function () { window.removeEventListener('keydown', k); };
    });
    useEffect(function () { if (!toast || p.toast) return; var t = setTimeout(function () { setToast(null); }, 5000); return function () { clearTimeout(t); }; }, [toast]);

    var table = tables.find(function (t) { return t.name === selected; }) || null;
    var invalid = table ? Object.keys(validateColumns(table)).map(Number) : [];
    var visible = search ? tables.filter(function (t) { return t.name.indexOf(search) >= 0 || t.columns.some(function (c) { return c.name.indexOf(search) >= 0; }); }) : tables;

    function updateTable(nt) {
      commit({ tables: tables.map(function (t) { return t.name === table.name ? nt : t; }) }, nt.name);
    }
    function renameTable(oldName, newName) {
      var nt = tables.map(function (t) {
        var t2 = t.name === oldName ? assign(t, { name: newName }) : t;
        return assign(t2, { columns: t2.columns.map(function (c) { return c.fk && c.fk.table === oldName ? assign(c, { fk: assign(c.fk, { table: newName }) }) : c; }) });
      });
      var np = assign(positions); np[newName] = np[oldName]; delete np[oldName];
      commit({ tables: nt, positions: np }, newName); setSelected(newName);
    }
    function duplicate(name) {
      var src = tables.find(function (t) { return t.name === name; }); var nn = name + '_copy';
      var np = assign(positions); np[nn] = { x: positions[name].x + 32, y: positions[name].y + 32 };
      commit({ tables: tables.concat([assign(src, { name: nn, columns: src.columns.map(function (c) { return assign(c, { fk: null }); }), indexes: [] })]), positions: np }, nn);
      setSelected(nn);
    }
    function doDelete(name) {
      commit({ tables: tables.filter(function (t) { return t.name !== name; }).map(function (t) { return assign(t, { columns: t.columns.map(function (c) { return c.fk && c.fk.table === name ? assign(c, { fk: null }) : c; }) }); }) }, null);
      setDirty(dirty.concat(['__deleted']));
      setSelected(null); setConfirm(null);
      setToast({ tone: 'info', title: 'Deleted table ' + name, description: 'Not saved yet. Press ⌘Z to restore it.', actions: [{ label: 'Undo', onClick: function () { undo(); setToast(null); } }] });
    }

    var deleting = confirm && tables.find(function (t) { return t.name === confirm; });
    var refs = deleting ? tables.reduce(function (n, t) { return n + t.columns.filter(function (c) { return c.fk && c.fk.table === confirm; }).length; }, 0) : 0;

    return h(Fragment, null,
      h(Toolbar, {
        schema: 'ecommerce', version: 'v' + ver, saveState: dirty.length ? 'dirty' : 'saved', zoom: zoom, onZoom: setZoom, onFit: function () { setZoom(1); setFit(fit + 1); },
        onUndo: undo, onRedo: redo, canUndo: hist.past.length > 0, canRedo: hist.future.length > 0, onSave: save,
        onExport: p.onExport, onHistory: p.onHistory, onShare: p.onShare, search: search, onSearch: setSearch
      }),
      h('div', { className: 'ss-work' },
        h(ERCanvas, {
          tables: visible, positions: positions, onMove: function (name, xy) { var np = assign(positions); np[name] = xy; setPositions(np); },
          onMoveEnd: function (name) { if (dirty.indexOf(name) < 0) setDirty(dirty.concat([name])); },
          selected: selected, onSelect: function (n) { if (n !== selected) setSelCol(null); setSelected(n); }, selectedColumn: selCol, onSelectColumn: setSelCol,
          zoom: zoom, fitSignal: fit, dimUnrelated: true, dirtyTables: dirty, invalidColumns: invalid, initialMenu: p.initialMenu,
          onDeleteTable: function (n) { setConfirm(n); }, hint: p.canvasHint
        }),
        p.inspector !== false && h(Inspector, {
          table: table, tables: tables, selectedColumn: selCol, onSelectColumn: setSelCol, onChange: updateTable,
          onRename: renameTable, onDuplicate: duplicate, onDelete: function (n) { setConfirm(n); }, typeMenuOpen: p.typeMenuOpen, renaming: p.renaming, autoFocusDraft: p.autoFocusDraft,
          settingsCollapsed: p.settingsCollapsed !== false
        })),
      h(StatusBar, {
        left: [h(Fragment, null, h('span', { className: 'ss-status-ok' }), 'Parsed'), visible.length + ' of 24 tables in view', '31 relationships', selected ? 'public.' + selected + (selCol != null && table && table.columns[selCol] ? '.' + (table.columns[selCol].name || '?') : '') : 'Nothing selected'],
        right: [invalid.length ? h('span', { style: { color: 'var(--removed)' } }, invalid.length + ' problem' + (invalid.length > 1 ? 's' : '')) : '0 problems', 'PostgreSQL 16', 'UTF-8', Math.round(zoom * 100) + '%']
      }),
      toast && h('div', { className: 'ss-toasts' }, h(Toast, assign(toast, { onClose: function () { setToast(null); } }))),
      deleting && h(ConfirmDialog, { title: 'Delete table "' + confirm + '"?', danger: true, confirmLabel: 'Delete table', onCancel: function () { setConfirm(null); }, onConfirm: function () { doDelete(confirm); } },
        h('div', { style: { color: 'var(--ink-2)' } }, 'This removes ', h('code', { className: 'ss-mono', style: { color: 'var(--ink-1)' } }, 'public.' + confirm), ' with its ' + deleting.columns.length + ' columns and ' + (deleting.indexes || []).length + ' indexes from the working copy.'),
        refs > 0 && h(Alert, { tone: 'warn', title: refs + ' foreign key' + (refs > 1 ? 's' : '') + ' will be dropped' }, tables.filter(function (t) { return t.columns.some(function (c) { return c.fk && c.fk.table === confirm; }); }).map(function (t) { return t.name; }).join(', ') + ' reference this table.'),
        h('div', { className: 'ss-faint', style: { fontSize: 12 } }, 'Nothing is lost until you save — v' + ver + ' stays in history either way.')),
      p.overlay);
  }

  // ------------------------------------------------------------------ export
  window.SchemaStudio = {
    Icon: Icon, Logo: Logo, Button: Button, IconButton: IconButton, Badge: Badge, Kbd: Kbd, Avatar: Avatar,
    Input: Input, Field: Field, Select: Select, Checkbox: Checkbox, Radio: Radio, Switch: Switch, SegmentedControl: SegmentedControl,
    Sidebar: Sidebar, Toolbar: Toolbar, SaveStatus: SaveStatus, StatusBar: StatusBar, AppShell: AppShell,
    TableNode: TableNode, ERCanvas: ERCanvas, Inspector: Inspector, TypeSelect: TypeSelect, ContextMenu: ContextMenu,
    Modal: Modal, ConfirmDialog: ConfirmDialog, DropZone: DropZone, SqlEditor: SqlEditor, ParseStatus: ParseStatus,
    ImportSchemaDialog: ImportSchemaDialog, ExportDialog: ExportDialog,
    Toast: Toast, Alert: Alert, DataTable: DataTable, TableList: TableList, DataGrid: DataGrid, TableHeader: TableHeader, TableStructure: TableStructure, TableRelationships: TableRelationships, DataToolbar: DataToolbar, FilterChips: FilterChips, SelectionBar: SelectionBar, Pagination: Pagination, RecordEditor: RecordEditor, ResizeHandle: ResizeHandle, Stepper: Stepper, Progress: Progress, ImportRecordsDialog: ImportRecordsDialog, FilterBuilder: FilterBuilder, QueryConsole: QueryConsole, VersionList: VersionList, DiffList: DiffList, DiffRow: DiffRow, DdlDiff: DdlDiff,
    EmptyState: EmptyState, Workspace: Workspace,
    highlightSql: highlightSql, highlightJson: highlightJson, validateColumns: validateColumns, relationsOf: relationsOf, parseJson: parseJson, validateRecord: validateRecord, recordLabel: recordLabel, completeRecord: completeRecord,
    parseCsv: parseCsv, readRecordsFile: readRecordsFile, matchColumns: matchColumns, analyzeImport: analyzeImport, runImport: runImport, importReport: importReport, importSummary: importSummary,
    defaultQuery: defaultQuery, queryOps: queryOps, queryProblems: queryProblems, buildQuery: buildQuery, parseQuery: parseQuery, formatQuery: formatQuery, runQuery: runQuery, queryPlan: queryPlan,
    sample: { tables: SAMPLE_TABLES, positions: SAMPLE_POSITIONS, schemas: SAMPLE_SCHEMAS, versions: SAMPLE_VERSIONS, diff: SAMPLE_DIFF, sql: SAMPLE_SQL, pasteSql: PASTE_SQL, badSql: BAD_SQL, types: TYPE_OPTIONS, records: SAMPLE_RECORDS, csv: SAMPLE_CSV, query: { sql: QUERY_SAMPLE, badSql: QUERY_SAMPLE_BAD, spec: QUERY_SAMPLE_SPEC, saved: QUERY_SAVED, recent: QUERY_RECENT } }
  };
})();
