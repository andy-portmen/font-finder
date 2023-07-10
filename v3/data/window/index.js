/* global Pickr, fuzzysort */

'use strict';

const args = new URLSearchParams(location.search);

function rgb2hex(rgb) {
  rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
  return (rgb && rgb.length === 4) ? '#' +
    parseInt(rgb[1]).toString(16).padStart(2, '0') +
    parseInt(rgb[2]).toString(16).padStart(2, '0') +
    parseInt(rgb[3]).toString(16).padStart(2, '0') : rgb;
}

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
    document.title = 'Expired! Please run a new inspection';
  }

  console.log(analyzed);

  document.querySelector('[data-obj=url]').textContent =
    document.querySelector('[data-obj=url]').title = analyzed.url;
  for (const e of Object.keys(analyzed.getComputedStyle)) {
    const element = document.querySelector(`[data-obj="${e}"]`);

    if (element && e === 'font-family-rendered') {
      const fonts = analyzed.getComputedStyle[e];
      Object.entries(fonts).sort((a, b) => () => {
        return b[1].percent - a[1].percent;
      }).forEach(([fontname, {percent, remote, info}]) => {
        const div = document.createElement('div');
        const a = document.createElement('a');
        a.textContent = fontname;

        if (fontname && fontname.includes('system') === false) {
          a.dataset.fontname = fontname;
          a.dataset.cmd = 'open';
          a.href = '#';
        }
        const span = document.createElement('span');
        span.textContent = `${percent.toFixed(1)}% (${remote ? 'web font' : 'local'})`;
        if (info) {
          div.title = info;
        }
        div.appendChild(a);
        div.appendChild(span);
        element.appendChild(div);
      });
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
    document.getElementById('msg').textContent = 'A complex element is selected';
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
    chrome.runtime.sendMessage({
      cmd: 'release'
    });
  }
});

// localization
[...document.querySelectorAll('[data-i18n]')].forEach(e => {
  e.textContent = chrome.i18n.getMessage(e.dataset.i18n);
});

// Use System Fonts
document.getElementById('userFonts').onclick = () => self.queryLocalFonts().then(fonts => {
  chrome.storage.local.get({
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
}).finally(() => chrome.storage.local.set({
  userFontsAccess: false
}));
chrome.storage.local.get({
  userFontsAccess: true
}, prefs => {
  if (prefs.userFontsAccess === true && typeof queryLocalFonts !== 'undefined') {
    document.getElementById('userFonts').classList.remove('hidden');
  }
});
