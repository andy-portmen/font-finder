'use strict';

var analyzed = [];
var isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;

window.persist = (left, top, width, height) => chrome.storage.local.set({
  width,
  height,
  left,
  top
});

var actions = {
  page: (tab, info) => {
    // is select.js already injected?
    chrome.tabs.executeScript(tab.id, {
      'runAt': 'document_start',
      'allFrames': false,
      'code': '!!window.div'
    }, (arr) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        window.alert(lastError.message);
      }
      const [r] = arr;
      // inject select.js
      if (!r) {
        chrome.tabs.insertCSS(tab.id, {
          'runAt': 'document_start',
          'allFrames': true,
          'matchAboutBlank': true,
          'file': '/data/inject/select.css'
        }, () => {
          chrome.tabs.executeScript(tab.id, {
            'runAt': 'document_start',
            'allFrames': true,
            'matchAboutBlank': true,
            'file': '/data/inject/select.js'
          }, () => {
            // on activeFrame show element picker
            chrome.tabs.executeScript(tab.id, {
              'runAt': 'document_start',
              'frameId': info.frameId,
              'code': `
                mouseover({
                  target: [...document.querySelectorAll(':hover')].pop() || document.activeElement
                });
              `
            });
          });
        });
      }
      // release select.js
      else {
        chrome.tabs.sendMessage(tab.id, 'release');
      }
    });
  },
  selection: (tab, info) => {
    chrome.tabs.executeScript(tab.id, {
      'runAt': 'document_start',
      'frameId': info.frameId,
      'file': '/data/inject/analyze.js'
    });
  }
};

{
  const callback = () => {
    chrome.contextMenus.create({
      id: 'selection',
      title: 'Analyze Selection',
      contexts: ['selection'],
      documentUrlPatterns: ['*://*/*']
    });
    chrome.contextMenus.create({
      id: 'page',
      title: 'Inspect Font',
      contexts: ['page'],
      documentUrlPatterns: ['*://*/*']
    });
  };
  if (isFirefox) {
    callback();
  }
  else {
    chrome.runtime.onInstalled.addListener(callback);
    chrome.runtime.onStartup.addListener(callback);
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'selection') {
    actions.selection(tab, info);
  }
  else if (info.menuItemId === 'page') {
    actions.page(tab, info);
  }
});

chrome.browserAction.onClicked.addListener(tab => actions.page(tab, {
  frameId: 0
}));

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.cmd === 'release') {
    chrome.tabs.sendMessage(sender.tab.id, 'release');
  }
  else if (request.cmd === 'analyze') {
    actions.selection(sender.tab, sender);
  }
  else if (request.cmd === 'analyzed') {
    //
    chrome.tabs.sendMessage(sender.tab.id, 'release');
    //
    request.url = sender.tab.url;
    analyzed.push(request);
    //
    chrome.runtime.sendMessage('close-inspector');
    //
    chrome.windows.getCurrent(win => {
      request.id = win.id;
      chrome.storage.local.get({
        width: 500,
        height: 600,
        left: win.left + Math.round((win.width - 500) / 2),
        top: win.top + Math.round((win.height - 600) / 2)
      }, prefs => {
        chrome.windows.create({
          url: chrome.extension.getURL('data/window/index.html'),
          type: 'panel',
          left: prefs.left,
          top: prefs.top,
          width: Math.max(prefs.width, 200),
          height: Math.max(prefs.height, 200)
        }, win => isFirefox && window.setTimeout(() => chrome.windows.update(win.id, {
          width: win.width + 1
        }), 0));
      });
    });
  }
});

// FAQs & Feedback
chrome.storage.local.get({
  'version': null,
  'faqs': true,
  'last-update': 0,
}, prefs => {
  const version = chrome.runtime.getManifest().version;

  if (prefs.version ? (prefs.faqs && prefs.version !== version) : true) {
    const now = Date.now();
    const doUpdate = (now - prefs['last-update']) / 1000 / 60 / 60 / 24 > 30;
    chrome.storage.local.set({
      version,
      'last-update': doUpdate ? Date.now() : prefs['last-update']
    }, () => {
      // do not display the FAQs page if last-update occurred less than 30 days ago.
      if (doUpdate) {
        const p = Boolean(prefs.version);
        chrome.tabs.create({
          url: chrome.runtime.getManifest().homepage_url + '?version=' + version +
            '&type=' + (p ? ('upgrade&p=' + prefs.version) : 'install'),
          active: p === false
        });
      }
    });
  }
});

{
  const {name, version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL(
    chrome.runtime.getManifest().homepage_url + '?rd=feedback&name=' + name + '&version=' + version
  );
}
