/* global Pickr */

'use strict';

const args = new URLSearchParams(location.search);

function rgb2hex(rgb) {
  rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
  return (rgb && rgb.length === 4) ? '#' +
    parseInt(rgb[1]).toString(16).padStart(2, '0') +
    parseInt(rgb[2]).toString(16).padStart(2, '0') +
    parseInt(rgb[3]).toString(16).padStart(2, '0') : rgb;
}

chrome.runtime.sendMessage({
  cmd: 'get',
  id: args.get('id')
}, analyzed => {
  if (!analyzed) {
    document.title = 'Expired! Please run a new inspection';
  }

  document.querySelector('[data-obj=url]').textContent =
    document.querySelector('[data-obj=url]').title = analyzed.url;
  for (const e of Object.keys(analyzed.getComputedStyle)) {
    const element = document.querySelector(`[data-obj="${e}"]`);
    if (element && e === 'font-family-rendered') {
      Object.entries(analyzed.getComputedStyle[e])
        .sort((a, b) => b[1].percent - a[1].percent)
        .forEach(([fontname, {percent, remote, info}]) => {
          const div = document.createElement('div');
          const a = document.createElement('a');
          a.textContent = fontname;
          a.dataset.fontname = fontname;
          a.dataset.cmd = 'open';
          a.href = '#';
          const span = document.createElement('span');
          span.textContent = `${percent.toFixed(1)}% (${remote ? 'remote' : 'local'})`;
          if (info) {
            div.title = info;
          }
          div.appendChild(a);
          div.appendChild(span);
          element.appendChild(div);
        });
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
      chrome.runtime.sendMessage({
        cmd: 'open',
        url: 'https://www.fonts.com/search/all-fonts?ShowAllFonts=All&searchtext=' + target.dataset.fontname,
        windowId: analyzed.id
      });
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
