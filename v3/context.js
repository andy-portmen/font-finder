/* global notify, actions */

{
  const once = () => {
    chrome.storage.local.get({
      'mode': 'window',
      'selection': true,
      'copy': true,
      'replace': true,
      'page': true,
      'find': true
    }, prefs => {
      if (prefs.selection) {
        chrome.contextMenus.create({
          id: 'selection',
          title: chrome.i18n.getMessage('context_selection'),
          contexts: ['selection'],
          documentUrlPatterns: ['*://*/*']
        });
      }
      if (prefs.copy) {
        chrome.contextMenus.create({
          id: 'copy',
          title: chrome.i18n.getMessage('context_copy'),
          contexts: ['selection'],
          documentUrlPatterns: ['*://*/*']
        });
      }
      if (prefs.replace) {
        chrome.contextMenus.create({
          id: 'replace',
          title: chrome.i18n.getMessage('context_replace'),
          contexts: ['selection'],
          documentUrlPatterns: ['*://*/*']
        });
      }
      if (prefs.page) {
        chrome.contextMenus.create({
          id: 'page',
          title: chrome.i18n.getMessage('context_page'),
          contexts: ['page'],
          documentUrlPatterns: ['*://*/*']
        });
      }
      if (prefs.find) {
        chrome.contextMenus.create({
          id: 'find',
          title: chrome.i18n.getMessage('context_find'),
          contexts: ['page'],
          documentUrlPatterns: ['*://*/*']
        });
      }
      //
      chrome.contextMenus.create({
        id: 'mode:window',
        title: chrome.i18n.getMessage('context_window_mode'),
        contexts: ['action'],
        type: 'radio',
        checked: prefs.mode === 'window'
      });
      chrome.contextMenus.create({
        id: 'mode:embed',
        title: chrome.i18n.getMessage('context_embed_mode'),
        contexts: ['action'],
        type: 'radio',
        checked: prefs.mode !== 'window'
      });
      chrome.contextMenus.create({
        id: 'tutorial',
        title: chrome.i18n.getMessage('context_tutorial'),
        contexts: ['action']
      });
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
