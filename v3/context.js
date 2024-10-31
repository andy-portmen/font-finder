/* global notify, actions */

{
  const once = () => {
    if (once.done) {
      return;
    }
    once.done = true;

    chrome.storage.local.get({
      'mode': 'window',
      'selection': true,
      'copy': true,
      'replace': true,
      'page': true,
      'find': true
    }, prefs => {
      chrome.contextMenus.create({
        id: 'selection',
        title: chrome.i18n.getMessage('context_selection'),
        contexts: ['selection'],
        documentUrlPatterns: ['*://*/*'],
        visible: prefs.selection
      }, () => chrome.runtime.lastError);
      chrome.contextMenus.create({
        id: 'copy',
        title: chrome.i18n.getMessage('context_copy'),
        contexts: ['selection'],
        documentUrlPatterns: ['*://*/*'],
        visible: prefs.copy
      }, () => chrome.runtime.lastError);
      chrome.contextMenus.create({
        id: 'replace',
        title: chrome.i18n.getMessage('context_replace'),
        contexts: ['selection'],
        documentUrlPatterns: ['*://*/*'],
        visible: prefs.replace
      }, () => chrome.runtime.lastError);
      chrome.contextMenus.create({
        id: 'page',
        title: chrome.i18n.getMessage('context_page'),
        contexts: ['page'],
        documentUrlPatterns: ['*://*/*'],
        visible: prefs.page
      }, () => chrome.runtime.lastError);
      chrome.contextMenus.create({
        id: 'find',
        title: chrome.i18n.getMessage('context_find'),
        contexts: ['page'],
        documentUrlPatterns: ['*://*/*'],
        visible: prefs.find
      }, () => chrome.runtime.lastError);
      //
      chrome.contextMenus.create({
        id: 'mode:window',
        title: chrome.i18n.getMessage('context_window_mode'),
        contexts: ['action'],
        type: 'radio',
        checked: prefs.mode === 'window'
      }, () => chrome.runtime.lastError);
      chrome.contextMenus.create({
        id: 'mode:embed',
        title: chrome.i18n.getMessage('context_embed_mode'),
        contexts: ['action'],
        type: 'radio',
        checked: prefs.mode !== 'window'
      }, () => chrome.runtime.lastError);
      chrome.contextMenus.create({
        id: 'tutorial',
        title: chrome.i18n.getMessage('context_tutorial'),
        contexts: ['action']
      }, () => chrome.runtime.lastError);
    });
  };
  chrome.runtime.onInstalled.addListener(once);
  chrome.runtime.onStartup.addListener(once);
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'tutorial') {
    chrome.tabs.create({
      url: 'https://www.youtube.com/watch?v=CGI3Atdzt64'
    });
  }
  else if (info.menuItemId.startsWith('mode:')) {
    chrome.storage.local.set({
      mode: info.menuItemId.replace('mode:', '')
    });
  }
  else if (info.menuItemId === 'selection') {
    actions.selection(tab, info);
  }
  else if (info.menuItemId === 'page') {
    actions.page(tab, info);
  }
  else if (info.menuItemId === 'copy') {
    chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        frameIds: [info.frameId]
      },
      files: ['data/inject/copy.js']
    }).catch(notify);
  }
  else if (info.menuItemId === 'find') {
    chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        frameIds: [info.frameId]
      },
      files: ['data/inject/find.js']
    }).catch(notify);
  }
  else if ( info.menuItemId === 'replace') {
    chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        frameIds: [info.frameId]
      },
      files: ['data/inject/replace.js']
    }).catch(notify);
  }
});

chrome.storage.onChanged.addListener(ps => {
  if (ps.selection) {
    chrome.contextMenus.update('selection', {
      visible: ps.selection.newValue
    });
  }
  if (ps.copy) {
    chrome.contextMenus.update('copy', {
      visible: ps.copy.newValue
    });
  }
  if (ps.replace) {
    chrome.contextMenus.update('replace', {
      visible: ps.replace.newValue
    });
  }
  if (ps.page) {
    chrome.contextMenus.update('page', {
      visible: ps.page.newValue
    });
  }
  if (ps.find) {
    chrome.contextMenus.update('find', {
      visible: ps.find.newValue
    });
  }
});
