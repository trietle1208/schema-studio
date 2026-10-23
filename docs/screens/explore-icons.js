var I = {
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M9.5 9.5v10"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  chev: '<path d="M6 9l6 6 6-6"/>', chevr: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5M14.5 8.5l2 2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.75"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.9 9.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.6 3.3M6.6 6.6C3.9 8.3 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.3-1"/>',
  layers: '<path d="M12 3.5L3.5 8 12 12.5 20.5 8z"/><path d="M3.5 12.5L12 17l8.5-4.5"/><path d="M3.5 16.5L12 21l8.5-4.5"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  focus: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  bookmark: '<path d="M6 4h12v16l-6-4-6 4z"/>', db: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.75"/><path d="M4.5 5.5v13c0 1.5 3.4 2.75 7.5 2.75s7.5-1.25 7.5-2.75v-13"/>',
  unlink: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/><path d="M4 4l16 16"/>',
  hub: '<circle cx="12" cy="12" r="3"/><circle cx="4.5" cy="5" r="1.5"/><circle cx="19.5" cy="5" r="1.5"/><circle cx="4.5" cy="19" r="1.5"/><circle cx="19.5" cy="19" r="1.5"/><path d="M6 6.2l3.8 3.8M18 6.2l-3.8 3.8M6 17.8l3.8-3.8M18 17.8l-3.8-3.8"/>',
  diagram: '<rect x="3" y="4" width="7" height="6" rx="1.5"/><rect x="14" y="14" width="7" height="6" rx="1.5"/><path d="M6.5 10v3.5a3 3 0 0 0 3 3H14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', arrowl: '<path d="M19 12H5M11 6l-6 6 6 6"/>', settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'
};
function ic(n, s, c) { return '<svg class="ss-icon" width="' + (s || 16) + '" height="' + (s || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"' + (c ? ' style="color:' + c + '"' : '') + '>' + I[n] + '</svg>'; }
function kbd(a) { return a.map(function (k) { return '<kbd class="ss-kbd">' + k + '</kbd>'; }).join(''); }
