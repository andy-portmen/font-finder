'use strict';

function rgb2hex(rgb) {
  rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
  return (rgb && rgb.length === 4) ? '#' +
    ('0' + parseInt(rgb[1]).toString(16)).slice(-2) +
    ('0' + parseInt(rgb[2]).toString(16)).slice(-2) +
    ('0' + parseInt(rgb[3]).toString(16)).slice(-2) : rgb;
}

chrome.runtime.sendMessage({
  cmd: 'get'
}, analyzed => {
  console.log(analyzed);
  document.querySelector('[data-obj=url]').textContent = analyzed.url;
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
      element.textContent = analyzed.getComputedStyle[e];
    }

    if (e.indexOf('color') !== -1) {
      const hex = document.querySelector(`[data-obj="${e}-hex"]`);
      if (hex) {
        hex.textContent = rgb2hex(analyzed.getComputedStyle[e]);
      }
      const color = element.parentNode.querySelector('div');
      if (color) {
        color.style.backgroundColor = analyzed.getComputedStyle[e];
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

if (location.search.indexOf('mode=window') !== -1) {
  chrome.runtime.getBackgroundPage(background => {
    window.onbeforeunload = () => {
      background.persist(window.screenX, window.screenY, window.outerWidth, window.outerHeight);
    };
  });
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
