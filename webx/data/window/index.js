'use strict';

function rgb2hex(rgb) {
  rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
  return (rgb && rgb.length === 4) ? '#' +
    ('0' + parseInt(rgb[1]).toString(16)).slice(-2) +
    ('0' + parseInt(rgb[2]).toString(16)).slice(-2) +
    ('0' + parseInt(rgb[3]).toString(16)).slice(-2) : rgb;
}

var background = chrome.extension.getBackgroundPage();
var analyzed = background.analyzed.shift();
document.querySelector('[data-obj=url]').textContent = analyzed.url;
for (const e in analyzed.getComputedStyle) {
  const element = document.querySelector(`[data-obj="${e}"]`);
  if (element) {
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

document.addEventListener('click', ({target}) => {
  const cmd = target.dataset.cmd;
  if (cmd === 'open') {
    chrome.tabs.create({
      url: 'https://www.fonts.com/search/all-fonts?ShowAllFonts=All&searchtext=' + target.textContent,
      windowId: analyzed.id
    });
  }
});

chrome.runtime.onMessage.addListener(request => {
  if (request === 'close-inspector') {
    window.close();
  }
});

window.onbeforeunload = () => {
  background.persist(window.screenX, window.screenY, window.outerWidth, window.outerHeight);
};
