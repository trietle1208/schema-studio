/* @ds-bundle: {"format":4,"namespace":"SchemaStudio","components":[{"name":"Icon"},{"name":"Logo"},{"name":"Button"},{"name":"Badge"},{"name":"Input"},{"name":"Select"},{"name":"Checkbox"},{"name":"SegmentedControl"},{"name":"Sidebar"},{"name":"Toolbar"},{"name":"StatusBar"},{"name":"TableNode"},{"name":"ERCanvas"},{"name":"Inspector"},{"name":"TypeSelect"},{"name":"ContextMenu"},{"name":"Modal"},{"name":"DropZone"},{"name":"SqlEditor"},{"name":"ImportSchemaDialog"},{"name":"ExportDialog"},{"name":"Toast"},{"name":"DataTable"},{"name":"VersionList"},{"name":"DiffList"},{"name":"DdlDiff"},{"name":"EmptyState"},{"name":"Workspace"}]} */
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
    return h('label', { className: cx('ss-check', p.radio && 'ss-check--radio', p.className) },
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

  // ------------------------------------------------------------------ SQL highlight
  var KW = 'CREATE|TABLE|PRIMARY|KEY|NOT|NULL|UNIQUE|DEFAULT|REFERENCES|ON|DELETE|UPDATE|CASCADE|RESTRICT|SET|INDEX|ALTER|ADD|COLUMN|DROP|IF|EXISTS|CONSTRAINT|FOREIGN|CHECK|USING|BEGIN|COMMIT|TYPE|IN|AND|OR|INSERT|INTO|VALUES|SELECT|FROM|WHERE|NO|ACTION|COMMENT|IS|RENAME|TO';
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

  function Toolbar(p) {
    var zoom = p.zoom || 1;
    return h('header', { className: 'ss-toolbar' },
      h('div', { className: 'ss-tb-crumb' },
        h('span', null, 'Schemas'), h(Icon, { name: 'chevron-right', size: 12 }),
        h('span', { className: 'ss-tb-name' }, p.schema || 'ecommerce', h(Icon, { name: 'chevron-down', size: 12, style: { color: 'var(--ink-3)' } }))),
      h(Badge, { dot: true, title: 'Database engine' }, p.engine || 'PostgreSQL'),
      h(Badge, { tone: 'accent', title: 'Current version' }, p.version || 'v12'),
      h(SaveStatus, { state: p.saveState }),
      p.saveState === 'dirty' && h(Button, { size: 'sm', kbd: ['⌘', 'S'], onClick: p.onSave }, 'Save'),
      h('span', { className: 'ss-spacer' }),
      h('div', { className: 'ss-tb-group' },
        h(IconButton, { icon: 'undo', label: 'Undo (⌘Z)', disabled: p.canUndo === false, onClick: p.onUndo }),
        h(IconButton, { icon: 'redo', label: 'Redo (⇧⌘Z)', disabled: p.canRedo === false, onClick: p.onRedo })),
      h('span', { className: 'ss-tb-sep' }),
      h('div', { className: 'ss-tb-group' },
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
    if (p.file) {
      return h('div', { className: 'ss-file' },
        h('span', { className: 'ss-file-icon' }, h(Icon, { name: 'file-code', size: 16 })),
        h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { className: 'ss-file-name' }, p.file.name), h('div', { className: 'ss-file-meta' }, p.file.meta || p.file.size)),
        h(Button, { variant: 'ghost', size: 'sm', onClick: function () { inputRef.current && inputRef.current.click(); } }, 'Replace'),
        h(IconButton, { icon: 'x', size: 'sm', label: 'Remove file', onClick: function () { p.onFile && p.onFile(null); } }),
        h('input', { ref: inputRef, type: 'file', accept: '.sql,.ddl,.txt', hidden: true }));
    }
    return h('div', {
      className: cx('ss-drop', (over || p.over) && 'is-over'), role: 'button', tabIndex: 0, style: p.style,
      onDragOver: function (e) { e.preventDefault(); setOver(true); }, onDragLeave: function () { setOver(false); },
      onDrop: function (e) { e.preventDefault(); setOver(false); var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f && p.onFile) p.onFile({ name: f.name, meta: Math.max(1, Math.round(f.size / 1024)) + ' KB' }); },
      onClick: function () { inputRef.current && inputRef.current.click(); }
    },
      h('span', { className: 'ss-drop-icon' }, h(Icon, { name: 'upload', size: 16 })),
      h('div', { className: 'ss-drop-title' }, 'Drop SQL file here or ', h('u', null, 'click to browse')),
      h('div', { className: 'ss-drop-sub' }, p.hint || '.sql or .ddl · up to 10 MB · pg_dump --schema-only output works'),
      h('input', { ref: inputRef, type: 'file', accept: '.sql,.ddl,.txt', hidden: true, onChange: function (e) { var f = e.target.files[0]; if (f && p.onFile) p.onFile({ name: f.name, meta: Math.max(1, Math.round(f.size / 1024)) + ' KB' }); } }));
  }

  function SqlEditor(p) {
    var _v = useState(p.defaultValue != null ? p.defaultValue : (p.value || '')), inner = _v[0], setInner = _v[1];
    var value = p.value != null && p.onChange ? p.value : inner;
    var lines = value.split('\n');
    var maxLen = lines.reduce(function (m, l) { return Math.max(m, l.length); }, 0);
    return h('div', { className: cx('ss-editor', p.errorLine && 'is-error'), style: assign({ height: p.height || 220 }, p.style) },
      h('div', { className: 'ss-editor-inner' },
        h('div', { className: 'ss-editor-gutter' }, lines.map(function (_, i) { var n = i + (p.firstLine || 1); return h('div', { key: i, className: n === p.errorLine ? 'is-error' : null }, n); })),
        h('div', { className: 'ss-editor-code', style: { minWidth: (maxLen + 4) + 'ch' } },
          p.errorLine && h('div', { className: 'ss-editor-errline', style: { top: 8 + (p.errorLine - (p.firstLine || 1)) * 18 } }),
          h('pre', { dangerouslySetInnerHTML: { __html: highlightSql(value) + '\n' } }),
          h('textarea', { value: value, spellCheck: false, 'aria-label': p.label || 'SQL', placeholder: p.placeholder, readOnly: p.readOnly, onChange: function (e) { if (p.onChange) p.onChange(e.target.value); else setInner(e.target.value); } }))));
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
    return h('div', { className: 'ss-empty' },
      h(EmptyArt),
      h('div', { className: 'ss-empty-title' }, p.title || 'Your database schemas will appear here.'),
      h('div', { className: 'ss-empty-sub' }, p.description || 'Import DDL from an existing database, or start a blank schema and draw tables on the canvas.'),
      h('div', { className: 'ss-empty-actions' },
        h(Button, { variant: 'primary', icon: 'upload', onClick: p.onImport, kbd: ['⌘', 'I'] }, 'Import Schema'),
        h(Button, { icon: 'plus', onClick: p.onCreate, kbd: ['⌘', 'N'] }, 'Create New Schema')),
      p.hints !== false && h('div', { className: 'ss-empty-keys' },
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
    Toast: Toast, Alert: Alert, DataTable: DataTable, VersionList: VersionList, DiffList: DiffList, DiffRow: DiffRow, DdlDiff: DdlDiff,
    EmptyState: EmptyState, Workspace: Workspace,
    highlightSql: highlightSql, validateColumns: validateColumns,
    sample: { tables: SAMPLE_TABLES, positions: SAMPLE_POSITIONS, schemas: SAMPLE_SCHEMAS, versions: SAMPLE_VERSIONS, diff: SAMPLE_DIFF, sql: SAMPLE_SQL, pasteSql: PASTE_SQL, badSql: BAD_SQL, types: TYPE_OPTIONS }
  };
})();
