'use strict';

const analyzed = [];
const isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;

window.persist = (left, top, width, height) => chrome.storage.local.set({
  width,
  height,
  left,
  top
});

const actions = {
  page: (tab, info) => {
    // is select.js already injected?
    chrome.tabs.executeScript({
      'runAt': 'document_start',
      'allFrames': false,
      'code': '!!window.div'
    }, arr => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        return window.alert(lastError.message);
      }
      const [r] = arr;
      // inject select.js
      if (!r) {
        // change icon
        chrome.browserAction.setIcon({
          tabId: tab.id,
          path: {
            '16': 'data/icons/inspect/16.png',
            '18': 'data/icons/inspect/18.png',
            '19': 'data/icons/inspect/19.png',
            '32': 'data/icons/inspect/32.png',
            '36': 'data/icons/inspect/36.png',
            '38': 'data/icons/inspect/38.png',
            '48': 'data/icons/inspect/48.png',
            '64': 'data/icons/inspect/64.png'
          }
        });
        chrome.tabs.insertCSS({
          'runAt': 'document_start',
          'allFrames': true,
          'matchAboutBlank': true,
          'file': '/data/inject/select.css'
        }, () => {
          chrome.tabs.executeScript({
            'runAt': 'document_start',
            'allFrames': true,
            'matchAboutBlank': true,
            'file': '/data/inject/select.js'
          }, () => {
            // on activeFrame show element picker
            chrome.tabs.executeScript({
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
        actions.release(tab);
      }
    });
  },
  selection: (tab, info) => {
    chrome.tabs.executeScript(tab.id, {
      'runAt': 'document_start',
      'frameId': info.frameId,
      'file': '/data/inject/analyze.js'
    });
  },
  release: tab => {
    chrome.browserAction.setIcon({
      tabId: tab.id,
      path: {
        '16': 'data/icons/16.png',
        '18': 'data/icons/18.png',
        '19': 'data/icons/19.png',
        '32': 'data/icons/32.png',
        '36': 'data/icons/36.png',
        '38': 'data/icons/38.png',
        '48': 'data/icons/48.png',
        '64': 'data/icons/64.png'
      }
    });
    chrome.tabs.sendMessage(tab.id, 'release');
    chrome.tabs.executeScript(tab.id, {
      runAt: 'document_start',
      code: `
        [...document.querySelectorAll('#font-finder-embedded-div')].forEach(d => d.remove());
      `
    });
  }
};

{
  const callback = () => {
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
        contexts: ['browser_action'],
        type: 'radio',
        checked: prefs.mode === 'window'
      });
      chrome.contextMenus.create({
        id: 'mode:embed',
        title: chrome.i18n.getMessage('context_embed_mode'),
        contexts: ['browser_action'],
        type: 'radio',
        checked: prefs.mode !== 'window'
      });
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
  if (info.menuItemId.startsWith('mode:')) {
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
    chrome.tabs.executeScript(tab.id, {
      frameId: info.frameId,
      matchAboutBlank: true,
      runAt: 'document_start',
      code: `{
        if (window.aElement) {
          const o = window.getComputedStyle(window.aElement);
          'font-family: ' + o.getPropertyValue('font-family') + '\\n' +
          'font-size: ' + o.getPropertyValue('font-size') + '\\n' +
          'font-style: ' + o.getPropertyValue('font-style') + '\\n' +
          'font-variant-caps: ' + o.getPropertyValue('font-variant-caps') + '\\n' +
          'font-variant-east-asian: ' + o.getPropertyValue('font-variant-east-asian') + '\\n' +
          'font-variant-ligatures: ' + o.getPropertyValue('font-variant-ligatures') + '\\n' +
          'font-variant-numeric: ' + o.getPropertyValue('font-variant-numeric') + '\\n' +
          'font-weight: ' + o.getPropertyValue('font-weight')
        }
        else {
          'Please refresh this tab and retry'
        }
      }`
    }, r => {
      chrome.permissions.request({
        permissions: ['clipboardWrite']
      }, granted => {
        if (granted) {
          const str = 'Font Details:\n\n' + r[0];
          navigator.clipboard.writeText(str).catch(() => {
            document.oncopy = e => {
              e.clipboardData.setData('text/plain', str);
              e.preventDefault();
            };
            document.execCommand('Copy', false, null);
          });
        }
      });
    });
  }
  else if (info.menuItemId === 'find') {
    chrome.tabs.executeScript(tab.id, {
      frameId: info.frameId,
      matchAboutBlank: true,
      runAt: 'document_start',
      code: `{
        const es = [...document.body.getElementsByTagName('*')];
        const names = es.map(e => window.getComputedStyle(e).getPropertyValue('font-family').split(',')
          .map(s => s.toLowerCase().replace(/^\\s+|\\s+$/g, '').replace(/['"]/g, ''))
        )
        alert([].concat(...names).filter((s, i, l) => l.indexOf(s) === i).join(', '));
      }`
    });
  }
  else if ( info.menuItemId === 'replace') {
    chrome.tabs.executeScript(tab.id, {
      frameId: info.frameId,
      matchAboutBlank: true,
      runAt: 'document_start',
      code: `{
        if (window.aElement) {
          const name = window.prompt(
            'Enter the new font name',
            window.getComputedStyle(window.aElement).getPropertyValue('font-family')
          );
          if (name) {
            window.aElement.style['font-family'] = name;
          }
        }
        else {
          alert('Please refresh this tab and retry');
        }
      }`
    });
  }
});

chrome.browserAction.onClicked.addListener(tab => actions.page(tab, {
  frameId: 0
}));

chrome.runtime.onMessage.addListener((request, sender, respond) => {
  if (request.cmd === 'release') {
    actions.release(sender.tab);
  }
  else if (request.cmd === 'open') {
    chrome.tabs.create({
      url: request.url,
      windowId: request.windowId
    });
  }
  else if (request.cmd === 'percent') {
    chrome.browserAction.setBadgeText({
      tabId: sender.tab.id,
      text: request.done ? '' : request.value
    });
  }
  else if (request.cmd === 'analyze') {
    actions.selection(sender.tab, sender);
  }
  else if (request.cmd === 'get') {
    respond(analyzed.shift());
  }
  else if (request.cmd === 'analyzed') {
    //
    actions.release(sender.tab);
    //
    request.url = sender.tab.url;
    analyzed.push(request);
    //
    chrome.runtime.sendMessage('close-inspector');
    //
    chrome.storage.local.get({
      width: 600,
      height: 650,
      mode: 'window'
    }, prefs => {
      if (prefs.mode === 'window') {
        chrome.windows.getCurrent(win => {
          request.id = win.id;
          const left = win.left + Math.round((win.width - 500) / 2);
          const top = win.top + Math.round((win.height - 600) / 2);
          chrome.windows.create({
            url: chrome.extension.getURL('data/window/index.html?mode=window'),
            type: 'panel',
            left,
            top,
            width: Math.max(prefs.width, 200),
            height: Math.max(prefs.height, 200)
          }, win => isFirefox && window.setTimeout(() => chrome.windows.update(win.id, {
            width: win.width + 2
          }), 0));
        });
      }
      else {
        chrome.tabs.executeScript(sender.tab.id, {
          runAt: 'document_start',
          code: `{
            [...document.querySelectorAll('#font-finder-embedded-div')].forEach(d => d.remove());
            const div = document.createElement('div');
            div.id = 'font-finder-embedded-div';
            div.style = 'position: fixed; left: 0; top: 0; width: 100%; height: 100%;' +
              'background-color: rgba(0, 0, 0, 0.3); z-index: 2147483647;' +
              'display: flex; align-items: center; justify-content: center;';

            const iframe = document.createElement('iframe');
            iframe.src = '${chrome.extension.getURL('data/window/index.html?mode=embed')}';
            iframe.style = 'width: 600px; height: 650px; border: none; background-color: #fff;'
            div.appendChild(iframe);

            div.addEventListener('click', () => div.remove());

            document.documentElement.appendChild(div);
            ''
          }`
        });
      }
    });
  }
});

{
  const {onInstalled, setUninstallURL, getManifest} = chrome.runtime;
  const {name, version} = getManifest();
  const page = getManifest().homepage_url;
  onInstalled.addListener(({reason, previousVersion}) => {
    chrome.storage.local.get({
      'faqs': true,
      'last-update': 0
    }, prefs => {
      if (reason === 'install' || (prefs.faqs && reason === 'update')) {
        const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
        if (doUpdate && previousVersion !== version) {
          chrome.tabs.create({
            url: page + '?version=' + version +
              (previousVersion ? '&p=' + previousVersion : '') +
              '&type=' + reason,
            active: reason === 'install'
          });
          chrome.storage.local.set({'last-update': Date.now()});
        }
      }
    });
  });
  setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
}
