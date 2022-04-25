'use strict';

const toast = document.getElementById('toast');

// reset
document.getElementById('reset').addEventListener('click', e => {
  if (e.detail === 1) {
    toast.textContent = 'Double-click to reset!';
    window.setTimeout(() => toast.textContent = '', 750);
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
// save
document.getElementById('save').addEventListener('click', () => chrome.storage.local.set({
  'selection': document.getElementById('selection').checked,
  'copy': document.getElementById('copy').checked,
  'replace': document.getElementById('replace').checked,
  'page': document.getElementById('page').checked,
  'find': document.getElementById('find').checked,
  'faqs': document.getElementById('faqs').checked
}, () => {
  toast.textContent = 'Options Saved';
  window.setTimeout(() => toast.textContent = '', 750);
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

document.getElementById('access').onclick = () => chrome.permissions.request({
  origins: ['<all_urls>']
}, granted => {
  const lastError = chrome.runtime.lastError;

  toast.textContent = granted ? 'Granted' : ('Denied' + (lastError ? ' ' + lastError.message : ''));
  window.setTimeout(() => toast.textContent = '', 3000);
});

document.getElementById('preview').onclick = () => chrome.tabs.create({
  url: 'https://www.youtube.com/watch?v=CGI3Atdzt64'
});
