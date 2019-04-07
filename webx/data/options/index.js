'use strict';

var info = document.getElementById('info');

// reset
document.getElementById('reset').addEventListener('click', e => {
  if (e.detail === 1) {
    info.textContent = 'Double-click to reset!';
    window.setTimeout(() => info.textContent = '', 750);
  }
  else {
    localStorage.clear();
    chrome.storage.local.clear(() => {
      chrome.runtime.reload();
      window.close();
    });
  }
});
// support
document.getElementById('support').addEventListener('click', () => chrome.tabs.create({
  url: chrome.runtime.getManifest().homepage_url + '?rd=donate'
}));
// reload
document.getElementById('reload').addEventListener('click', () => {
  window.setTimeout(() => window.close(), 0);
  chrome.runtime.reload();
});
// save
document.getElementById('save').addEventListener('click', () => chrome.storage.local.set({
  'selection': document.getElementById('selection').checked,
  'copy': document.getElementById('copy').checked,
  'replace': document.getElementById('replace').checked,
  'page': document.getElementById('page').checked,
  'find': document.getElementById('find').checked,
  'faqs': document.getElementById('faqs').checked
}, () => {
  info.textContent = 'Options Saved';
  window.setTimeout(() => info.textContent = '', 750);
}));
// localization
[...document.querySelectorAll('[data-i18n]')].forEach(e => {
  e.textContent = chrome.i18n.getMessage(e.dataset.i18n);
});

chrome.storage.local.get({
  'selection': true,
  'copy': true,
  'replace': true,
  'page': true,
  'find': true,
  'faqs': true
}, prefs => Object.entries(prefs).forEach(([key, value]) => {
  document.getElementById(key).checked = value;
}));
