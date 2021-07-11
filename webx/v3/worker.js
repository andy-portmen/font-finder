'use strict';

const analyzed = [];
const isFirefox = /Firefox/.test(navigator.userAgent) || typeof InstallTrigger !== 'undefined';

const translate = async id => {
  const lang = navigator.language.split('-')[0];
  translate.objects = translate.objects || await Promise.all([
    fetch('_locales/' + lang + '/messages.json').then(r => r.json()).catch(() => ({})),
    fetch('_locales/en/messages.json').then(r => r.json())
  ]);
  return translate.objects[0][id]?.message || translate.objects[1][id]?.message || id;
};

const notify = e => chrome.notifications.create({
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  title: chrome.runtime.getManifest().name,
  message: e.message || e
});

const actions = {
  async page(tab, info) {
    try {
      // is select.js already injected?
      const [r] = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        function() {
          return !!window.div;
        }
      });
      // inject select.js
      if (r && r.result === false) {
        // change icon
        chrome.action.setIcon({
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
        const target = {
          tabId: tab.id,
          allFrames: true
        };
        await chrome.scripting.insertCSS({
          target,
          files: ['/data/inject/select.css']
        });
        await chrome.scripting.executeScript({
          target,
          files: ['/data/inject/select.js']
        });
        // on activeFrame show element picker
        await chrome.scripting.executeScript({
          target: {
            tabId: tab.id,
            frameIds: [info.frameId]
          },
          files: ['/data/inject/activate.js']
        });
      }
      // release select.js
      else {
        actions.release(tab);
      }
    }
    catch (e) {
      notify(e);
    }
  },
  selection(tab, info) {
    chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        frameIds: [info.frameId]
      },
      files: ['/data/inject/analyze.js']
    }).catch(notify);
  },
  release(tab) {
    chrome.action.setIcon({
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
    chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        allFrames: true
      },
      files: ['data/inject/release.js']
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
    }, async prefs => {
      if (prefs.selection) {
        chrome.contextMenus.create({
          id: 'selection',
          title: await translate('context_selection'),
          contexts: ['selection'],
          documentUrlPatterns: ['*://*/*']
        });
      }
      if (prefs.copy) {
        chrome.contextMenus.create({
          id: 'copy',
          title: await translate('context_copy'),
          contexts: ['selection'],
          documentUrlPatterns: ['*://*/*']
        });
      }
      if (prefs.replace) {
        chrome.contextMenus.create({
          id: 'replace',
          title: await translate('context_replace'),
          contexts: ['selection'],
          documentUrlPatterns: ['*://*/*']
        });
      }
      if (prefs.page) {
        chrome.contextMenus.create({
          id: 'page',
          title: await translate('context_page'),
          contexts: ['page'],
          documentUrlPatterns: ['*://*/*']
        });
      }
      if (prefs.find) {
        chrome.contextMenus.create({
          id: 'find',
          title: await translate('context_find'),
          contexts: ['page'],
          documentUrlPatterns: ['*://*/*']
        });
      }
      //
      chrome.contextMenus.create({
        id: 'mode:window',
        title: await translate('context_window_mode'),
        contexts: ['action'],
        type: 'radio',
        checked: prefs.mode === 'window'
      });
      chrome.contextMenus.create({
        id: 'mode:embed',
        title: await translate('context_embed_mode'),
        contexts: ['action'],
        type: 'radio',
        checked: prefs.mode !== 'window'
      });
      chrome.contextMenus.create({
        id: 'tutorial',
        title: await translate('context_tutorial'),
        contexts: ['action']
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

chrome.action.onClicked.addListener(tab => actions.page(tab, {
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
    chrome.action.setBadgeText({
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
      left: 0,
      top: 0,
      width: 600,
      height: 700,
      mode: 'window'
    }, prefs => {
      if (prefs.mode === 'window') {
        chrome.windows.getCurrent(win => {
          request.id = win.id;
          const left = prefs.left || (win.left + Math.round((win.width - 500) / 2));
          const top = prefs.top || (win.top + Math.round((win.height - 700) / 2));
          chrome.windows.create({
            url: 'data/window/index.html?mode=window',
            type: 'popup',
            left: Math.max(win.left, left),
            top: Math.max(win.top, top),
            width: Math.max(prefs.width, 200),
            height: Math.max(prefs.height, 200)
          }, win => isFirefox && window.setTimeout(() => chrome.windows.update(win.id, {
            width: win.width + 2
          }), 0));
        });
      }
      else {
        chrome.scripting.executeScript({
          target: {
            tabId: sender.tab.id
          },
          files: ['data/inject/embedded.js']
        });
      }
    });
  }
  else if (request.cmd === 'persist') {
    chrome.storage.local.set(request.object);
  }
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
