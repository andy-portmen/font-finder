/* global Pickr, fuzzysort */

'use strict';

const args = new URLSearchParams(location.search);
const toast = msg => {
  document.title = msg;
  clearTimeout(toast.id);
  toast.id = setTimeout(() => document.title = chrome.i18n.getMessage('window_title'), 750);
};

window.close = new Proxy(window.close, {
  apply(target, self, args) {
    if (location.search.includes('mode=window')) {
      return Reflect.apply(target, self, args);
    }
    else {
      chrome.runtime.sendMessage({
        cmd: 'close-me'
      });
      return true;
    }
  }
});

// late gains from the analysis background phases; they can arrive before the
// 'get' response registers the inspector, so early ones are queued
const pendingBio = [];
let mergeBio = null;
chrome.runtime.onMessage.addListener(request => {
  if (request && request.cmd === 'bio' && request.id === Number(args.get('id'))) {
    if (mergeBio) {
      mergeBio(request.entries);
    }
    else {
      pendingBio.push(...request.entries);
    }
  }
});

function rgb2hex(rgb) {
  rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
  return (rgb && rgb.length === 4) ? '#' +
    parseInt(rgb[1]).toString(16).padStart(2, '0') +
    parseInt(rgb[2]).toString(16).padStart(2, '0') +
    parseInt(rgb[3]).toString(16).padStart(2, '0') : rgb;
}

// cap a long U+XXXX coverage string for inline display
const capRanges = str => {
  const parts = str.split(', ');
  return parts.length > 10 ? parts.slice(0, 10).join(', ') + ', …' : str;
};

// a name reduced to dots, spaces and control characters carries no
// information; anonymized name tables (like the BBC's) ship those
const blankName = s => /^[\s.\u0000-\u001f\u007f\u00ad\u200b-\u200f\u2060\ufeff]*$/.test(s);

// Google's specimen scheme names loaded faces 'gf_<Family> variant<N>';
// display the family they wrap
const prettyFamily = name => {
  const m = /^gf_(.+?)(?: variant\d+)?$/i.exec((name || '').replace(/['"]/g, '').trim());
  return m ? m[1].replace(/_/g, ' ') : (name || '');
};

// file name of a font URL without its extension; a fallback when the file's
// own name table is anonymized (some publishers ship family '.')
const urlName = href => {
  try {
    const url = new URL(href);
    // embedded files have no file name
    if (url.protocol === 'data:') {
      return '';
    }
    return decodeURIComponent(url.pathname.split('/').pop().replace(/\.[^.]+$/, ''));
  }
  catch (e) {
    return '';
  }
};

// compose the Name cell of a font file: the CSS family when known, otherwise
// what the file itself reported, plus weight/style, subset and glyph coverage
const composeInfo = (row, names) => {
  const info = row.info;
  let family = prettyFamily(info.family);
  let subfamily = '';
  if (family === '' && names) {
    family = names.family;
    subfamily = blankName(names.subfamily || '') ? '' : names.subfamily;
    if (subfamily && family.toLowerCase().includes(subfamily.toLowerCase())) {
      subfamily = '';
    }
    // anonymized name table (e.g. '.'): show the file name instead
    if (blankName(family)) {
      family = urlName(row.cells[0].dataset.url) || family;
      subfamily = '';
    }
  }
  const coverage = info.range || (names ? names.ranges : '') || '';
  row.cells[1].textContent = [
    family, subfamily, info.weight, info.style, info.subset, coverage && capRanges(coverage)
  ].filter(Boolean).join(' · ');
  row.cells[1].title = coverage;
};

function fontType(href) {
  href = href.toLowerCase();

  const extensions = ['woff2', 'woff', 'eot', 'ttf', 'ttf', 'otf', 'pfb', 'pfm'];

  // accurate
  for (const ext of extensions) {
    if (href.includes('.' + ext) || href.includes('data:font/' + ext)) {
      return ext;
    }
  }
  // inaccurate
  for (const ext of extensions) {
    if (href.includes(ext)) {
      return ext;
    }
  }

  if (href.includes('woff2')) {
    return 'woff2';
  }
  if (href.includes('woff')) {
    return 'woff'; // Web Open Font Format
  }
  if (href.includes('eot')) {
    return 'eot';
  }
  if (href.includes('ttf')) {
    return 'ttf'; // TrueType Font
  }
  if (href.includes('ttf')) {
    return 'ttc'; // TrueType Collection (TrueType font)
  }
  if (href.includes('otf')) {
    return 'otf'; // OpenType (TrueType font)
  }
  if (href.includes('pfb')) {
    return 'pfb'; // Printer Font Binary (PostScript Font)
  }
  if (href.includes('pfm')) {
    return 'pfm'; // Printer Font Metrics (PostScript Font)
  }
  return '';
}

chrome.runtime.sendMessage({
  cmd: 'get',
  id: args.get('id')
}, analyzed => {
  if (!analyzed) {
    const msg = 'Expired! Please run a new inspection on the page';
    document.title = msg;
    setTimeout(alert, 300, msg);
    return;
  }

  console.info(analyzed);

  // rebuilt when the background phases of the analysis push bio updates
  let buildRemoteFonts = () => {};

  document.querySelector('[data-obj=url]').textContent =
    document.querySelector('[data-obj=url]').title = analyzed.url;
  for (const e of Object.keys(analyzed.getComputedStyle)) {
    const element = document.querySelector(`[data-obj="${e}"]`);

    if (element && e === 'font-family-rendered') {
      const fonts = analyzed.getComputedStyle[e];
      Object.entries(fonts).sort((a, b) => () => {
        return b[1].percent - a[1].percent;
      }).forEach(([fontname, {percent, remote, pretends, info}]) => {
        const div = document.createElement('div');
        const a = document.createElement('a');
        if (pretends.length) {
          a.textContent = fontname + ' (' + pretends.join(', ') + ')';
        }
        else {
          a.textContent = fontname;
        }
        if (pretends.length) {
          info += `

Your browser may pretend to support this font by silently replacing it with local alternatives (shown in parentheses).`;
        }

        if (fontname && fontname.includes('system') === false) {
          a.dataset.fontname = fontname;
          a.dataset.cmd = 'open';
          a.href = '#';
        }
        const span = document.createElement('span');
        span.textContent = `${percent.toFixed(1)}% (${remote ? 'web font' : 'local'})`;
        if (info) {
          div.title = info.trim();
        }
        div.appendChild(a);
        div.appendChild(span);
        element.appendChild(div);
      });
      // resolved names
      {
        const parent = document.querySelector('[data-obj=resolved-names]');
        // a left-click copies instead of navigating; middle-click still opens
        parent.addEventListener('click', e => {
          if (e.target.closest('a')) {
            e.preventDefault();
          }
        });
        let current = null;

        // rebuildable: the background phases of the analysis push bio updates
        buildRemoteFonts = () => {
          if (current) {
            current.controller?.abort();
          }
          parent.textContent = '';
          // stack order for the group sorting
          const stack = analyzed.getComputedStyle['font-family'].split(/\s*,\s*/)
            .map(f => f.replace(/['"]/g, '').trim().toLowerCase());
          // one resolution per face (family + weight + style); the resolved name
          // applies to all the subset URLs of that face
          const faces = new Map();
          const rows = [];
          // families whose URL is recoverable get rows; script-injected faces
          // without a URL are collapsed into one comma-separated row, keyed by
          // the pretty family so the gf_<Family> variantN scheme lands once
          const norm = name => prettyFamily(name).replace(/\s+/g, ' ').trim().toLowerCase();
          const urlFamilies = new Set(analyzed.bio
            .filter(o => o.fontUrl.startsWith('face:') === false)
            .map(o => norm(o.fontFamily)));
          const unknownFamilies = new Map(); // normalized name -> {name, pos}
          for (const o of analyzed.bio) {
            if (o.fontUrl.startsWith('face:')) {
              const family = o.fontFamily || '';
              const n = norm(family);
              if (n && urlFamilies.has(n) === false && unknownFamilies.has(n) === false) {
                unknownFamilies.set(n, {
                  name: prettyFamily(family) || family,
                  pos: stack.indexOf(family.trim().toLowerCase())
                });
              }
              continue;
            }
            const key = o.fontFamily ? [o.fontFamily, o.weight || '', o.style || ''].join('\u0000') : o.fontUrl;
            let face = faces.get(key);
            if (face === undefined) {
              face = {
                fontUrl: o.fontUrl,
                family: o.fontFamily || '',
                pos: o.fontFamily ? stack.indexOf(o.fontFamily.trim().toLowerCase()) : -1,
                rows: []
              };
              faces.set(key, face);
            }
            // link cell; shows the full URL (data URIs included); a left-click
            // copies it, middle-click still opens
            const a = document.createElement('a');
            a.href = o.fontUrl;
            a.dataset.cmd = 'native';
            a.dataset.obj = 'resolved-url';
            a.dataset.url = o.fontUrl;
            a.textContent = o.fontUrl;
            // name cell; explains the file without resolving it: the family, the weight
            // and the unicode-range of the @font-face that references it
            const subset = (/\.(\d+)\.woff2$/i.exec(o.fontUrl) || [])[1];
            const span = document.createElement('span');
            span.dataset.obj = 'resolved-name';
            const row = {
              cells: [a, span],
              resolved: false,
              info: {
                family: o.fontFamily || '',
                weight: o.weight && o.weight !== '400' ? o.weight : '',
                style: o.style && o.style !== 'normal' ? o.style : '',
                subset: subset ? 'subset ' + subset : '',
                range: o['unicode-range'] || ''
              }
            };
            composeInfo(row);
            face.rows.push(row);
            rows.push(row);
            for (const cell of row.cells) {
              cell.classList.add('pending');
            }
            parent.append(a, span);
          }
          // the compact list of script-loaded faces with no recoverable URL;
          // these entries are already complete (no resolution is possible), so
          // it renders synchronously and re-appends after every reflow to stay last.
          // the names are rendered like they appear in the font-family stack:
          // quoted when the name is not a bare identifier, plus the format type
          // in parentheses when a URL bio of the same (pretty) family reveals it.
          // idempotent: removes previous nodes, so the repeated reflows during
          // name resolution never duplicate the section
          const stackName = name => /^[\w$-]+$/.test(name) ? name : `"${name}"`;
          const unknownType = n => {
            const hit = analyzed.bio.find(b =>
              b.fontFamily && b.fontUrl.startsWith('face:') === false && norm(b.fontFamily) === n);
            return hit ? fontType(hit.fontUrl) : '';
          };
          let unknownDivider = null;
          let unknownLine = null;
          const renderUnknown = () => {
            // a rebuild cleared the parent; refresh the local refs anyway
            unknownDivider?.remove();
            unknownLine?.remove();
            unknownDivider = null;
            unknownLine = null;
            if (unknownFamilies.size === 0) {
              return;
            }
            // rendered like the font-family (stack) row: a .prop label on the
            // left column and the comma-separated families on one line
            unknownDivider = document.createElement('span');
            unknownDivider.classList.add('prop');
            unknownDivider.textContent = 'Web fonts loaded from a script (URL unknown)';
            unknownLine = document.createElement('div');
            const families = [...unknownFamilies.entries()].sort((a, b) => {
              const pa = a[1].pos;
              const pb = b[1].pos;
              if (pa === pb) {
                return 0; // keep the bio order
              }
              if (pa === -1) {
                return 1;
              }
              if (pb === -1) {
                return -1;
              }
              return pa - pb;
            });
            for (const [n, o] of families) {
              const type = unknownType(n);
              if (unknownLine.childNodes.length) {
                unknownLine.append(', ');
              }
              const a = document.createElement('a');
              a.href = '#';
              // a click copies the family name instead of opening the remote
              // viewer: without a URL there is nothing meaningful to open
              a.dataset.obj = 'resolved-name';
              a.dataset.value = o.name;
              a.textContent = stackName(o.name) + (type ? ` (${type})` : '');
              unknownLine.append(a);
            }
            parent.append(unknownDivider, unknownLine);
          };
          // the background phases may still be collecting fonts
          if (rows.length === 0 && unknownFamilies.size === 0) {
            const div = document.createElement('div');
            div.classList.add('group', 'other');
            div.textContent = 'No web fonts detected yet';
            parent.append(div);
          }
          renderUnknown();
          // group rows by the resolved name; the headers are created as names become known
          const groups = new Map();
          // separates the fonts the selection uses from the rest of the page
          const divider = document.createElement('div');
          divider.classList.add('group', 'other');
          divider.textContent = 'Other web fonts on this page';
          const reflow = () => {
            const ordered = [...groups.values()].sort((a, b) => {
              if (a.pos === b.pos) {
                return a.header.textContent.localeCompare(b.header.textContent);
              }
              if (a.pos === -1) {
                return 1;
              }
              if (b.pos === -1) {
                return -1;
              }
              return a.pos - b.pos;
            });
            const hasStack = ordered.some(group => group.pos !== -1);
            let others = false;
            for (const group of ordered) {
              if (hasStack && group.pos === -1 && others === false) {
                others = true;
                parent.append(divider);
              }
              parent.append(group.header);
              for (const row of group.rows) {
                parent.append(...row.cells);
              }
            }
            for (const row of rows) {
              if (row.resolved === false) {
                parent.append(...row.cells);
              }
            }
            renderUnknown();
          };
          // resolve one by one, while the section is expanded
          let controller = null;
          const runner = async ctl => {
            for (const face of faces.values()) {
              if (ctl.signal.aborted || face.done) {
                continue;
              }
              try {
                const names = await resolveFont(face.fontUrl);
                // a rebuild replaced this run; drop the stale face
                if (ctl.signal.aborted) {
                  continue;
                }
                const raw = displayName(names);
                // anonymized name table (some publishers ship family '.'):
                // fall back to the file name, then to the CSS family
                const name = blankName(raw) === false ? raw :
                  [urlName(face.fontUrl), face.family]
                    .find(s => s && blankName(s) === false) || raw;
                const key = name + '\u0000' + face.family;
                let group = groups.get(key);
                if (group === undefined) {
                  const header = document.createElement('div');
                  header.classList.add('group');
                  header.dataset.obj = 'resolved-name';
                  // keep the connection to the font stack visible
                  header.textContent = face.family && name !== face.family ?
                    name + ' (' + face.family + ')' : name;
                  if (names.postscript && blankName(names.postscript) === false) {
                    header.title = 'PostScript name: ' + names.postscript;
                  }
                  group = {
                    header,
                    rows: [],
                    pos: face.pos
                  };
                  groups.set(key, group);
                }
                for (const row of face.rows) {
                  row.resolved = true;
                  group.rows.push(row);
                  // fill in what the file itself told us
                  composeInfo(row, names);
                  for (const cell of row.cells) {
                    cell.classList.remove('pending');
                  }
                }
                face.done = true;
              }
              catch (e) {
                if (ctl.signal.aborted === false) {
                  face.done = true;
                  for (const row of face.rows) {
                    row.cells[0].title = 'Not resolved: ' + (e.message || e);
                  }
                }
              }
              reflow();
            }
          };
          const start = () => {
            if (controller && controller.signal.aborted === false) {
              return;
            }
            controller = new AbortController();
            current.controller = controller;
            runner(controller);
          };
          current = {
            controller: null,
            start
          };
          // start when the section is expanded
          if (document.getElementById('remote-check').checked) {
            start();
          }
        };
        buildRemoteFonts();
        // the prefs script checks the box after this script ran; no event fires
        chrome.storage.local.get({
          'remote-check': false
        }, prefs => {
          if (prefs['remote-check'] && current && current.controller === null) {
            current.start();
          }
        });
        document.getElementById('remote-check').addEventListener('change', e => {
          if (e.target.checked) {
            current?.start();
          }
          else {
            current?.controller?.abort();
          }
        });
      }
      // similar fonts
      fetch('fuzzysort/families.json').then(r => r.json()).then(({families}) => {
        const parent = document.querySelector('[data-obj=similar-fonts]');
        const knownFonts = analyzed.getComputedStyle['font-family'].split(/\s*,\s*/)
          .map(f => f.toLowerCase());

        const similarFonts = [];

        for (const query of Object.keys(fonts)) {
          const results = (fuzzysort.go(query, families, {
            threshold: -100,
            limit: 20
          }) || []);

          similarFonts.push(...results);
        }

        similarFonts.sort((a, b) => b.score - a.score);

        const newFonts = similarFonts.filter(f => knownFonts.includes(f.target.toLowerCase()) === false)
          .slice(0, 5)
          .map(o => o.target);

        for (const fontname of newFonts) {
          const span = document.createElement('span');
          span.textContent = fontname;
          try {
            if (document.fonts.check('12px ' + fontname) === false) {
              span.classList.add('na');
              span.title = 'This font is not available on this machine';
            }
          }
          catch (e) {}
          parent.appendChild(span);
        }
      });
    }
    else if (e === 'font-family') {
      const fonts = analyzed.getComputedStyle[e].split(/\s*,\s*/);
      const px = analyzed.getComputedStyle['font-size'];
      for (const font of fonts) {
        const a = document.createElement('a');
        a.textContent = font;
        const f = analyzed.bio.filter(a => a.fontFamily === font).shift();
        if (f) {
          const type = fontType(f.fontUrl);
          if (type) {
            a.textContent += ' (' + type + ')';
          }
        }
        if (font && font.includes('system') === false) {
          a.dataset.fontname = font;
          a.dataset.cmd = 'open';
          a.href = '#';
        }

        try {
          if (document.fonts.check(px + ' ' + font) === false) {
            a.classList.add('na');
            a.title = 'This font is not available on this machine';
          }
        }
        catch (e) {}
        element.appendChild(a);
      }
    }
    else if (element) {
      if (e.indexOf('color') !== -1) {
        element.textContent = analyzed.getComputedStyle[e].toUpperCase();
      }
      else {
        element.textContent = analyzed.getComputedStyle[e];
      }
    }

    if (e.indexOf('color') !== -1) {
      const hex = document.querySelector(`[data-obj="${e}-hex"]`);
      if (hex) {
        hex.textContent = rgb2hex(analyzed.getComputedStyle[e]).toUpperCase();
      }
      const color = element.parentNode.querySelector('div');
      if (color) {
        color.style.backgroundColor = analyzed.getComputedStyle[e];

        const picker = Pickr.create({
          el: color,
          theme: 'classic', // or 'monolith', or 'nano'
          inline: false,
          showAlways: false,
          useAsButton: true,
          default: analyzed.getComputedStyle[e],
          components: {
            palette: true,
            preview: true,
            opacity: true,
            hue: true,

            // Input / output Options
            interaction: {
              hex: true,
              rgba: true,
              hsla: true,
              hsva: true,
              cmyk: true,
              input: true,
              clear: false,
              save: false
            }
          }
        });
        picker.on('change', c => {
          element.textContent = c.toRGBA().toString(0).toUpperCase();
          hex.textContent = c.toHEXA();
          color.style.backgroundColor = c.toHEXA();
        });
      }
    }
  }

  if (analyzed.complex) {
    document.getElementById('msg').textContent =
      'A complex element is selected. To view font details of child nodes, select the node directly.';
  }
  else {
    document.getElementById('msg').remove();
  }

  document.addEventListener('click', ({target}) => {
    const cmd = target.dataset.cmd;
    if (cmd === 'open') {
      chrome.storage.local.get({
        'font-viewer': 'https://webbrowsertools.com/font-viewer/?family=[family]'
      }, prefs => chrome.runtime.sendMessage({
        cmd: 'open',
        url: prefs['font-viewer'].replace('[family]', encodeURIComponent(target.dataset.fontname)),
        windowId: analyzed.id
      }));
    }
  });

  // late gains from the analysis background phases
  mergeBio = entries => {
    for (const entry of entries) {
      const i = analyzed.bio.findIndex(o => o.fontUrl === entry.fontUrl);
      if (i === -1) {
        analyzed.bio.push(entry);
      }
      else {
        analyzed.bio[i] = entry;
      }
    }
    buildRemoteFonts();
  };
  // flush updates that arrived while the inspector was starting
  if (pendingBio.length) {
    mergeBio(pendingBio);
    pendingBio.length = 0;
  }
  chrome.runtime.onMessage.addListener(request => {
    if (request === 'close-inspector') {
      window.close();
    }
  });
});

if (location.search.includes('mode=window')) {
  window.addEventListener('beforeunload', () => chrome.runtime.sendMessage({
    cmd: 'persist',
    object: {
      left: window.screenX,
      top: window.screenY,
      width: window.outerWidth,
      height: window.outerHeight
    }
  }));
}

window.focus();
document.addEventListener('keydown', ({key}) => {
  if (key === 'Escape' || key === 'Esc') {
    window.close();
  }
});

// localization
[...document.querySelectorAll('[data-i18n]')].forEach(e => {
  e.textContent = chrome.i18n.getMessage(e.dataset.i18n);
});

// Use System Fonts
document.getElementById('userFonts').onclick = () => self.queryLocalFonts().then(fonts => {
  return chrome.storage.local.get({
    userFonts: []
  }, prefs => {
    chrome.storage.local.set({
      userFonts: fonts.map(f => f.family)
    });
    if (fonts.length === 0) {
      alert('No system font is detected');
    }
    else if (prefs.userFonts.length === fonts.length) {
      alert('Already imported all fonts!');
      document.getElementById('userFonts').classList.add('hidden');
    }
    else {
      alert(fonts.length + ' new fonts are imported');
      document.getElementById('userFonts').classList.add('hidden');
    }
  });
}).then(() => chrome.storage.local.set({
  userFontsAccess: false
}));
chrome.storage.local.get({
  userFontsAccess: true
}, prefs => {
  if (prefs.userFontsAccess === true && typeof queryLocalFonts !== 'undefined') {
    document.getElementById('userFonts').classList.remove('hidden');
  }
});

// copy
document.addEventListener('click', async e => {
  const target = e.target;

  if (target.dataset.obj && target.textContent.trim()) {
    try {
      // resolved-url cells show the family name but copy the font URL;
      // unknown-family cells copy the clean family from dataset.value rather
      // than the rendered stack name (quotes and format suffix included)
      const text = target.dataset.obj === 'resolved-url' ? target.dataset.url :
        target.dataset.value || target.textContent;
      await navigator.clipboard.writeText(text);
      toast('"' + target.dataset.obj + '" ' + chrome.i18n.getMessage('window_copy'));
    }
    catch (e) {
      toast(e.message);
    }
  }
});

// Pick
document.getElementById('pick').addEventListener('click', () => {
  chrome.runtime.sendMessage({
    cmd: 'pick',
    opener: Number(args.get('opener'))
  }, () => window.close());
});
