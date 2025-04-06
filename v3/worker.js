'use strict';

if (typeof importScripts !== 'undefined') {
  self.importScripts('context.js');
}

const analyzed = {};

const notify = async e => {
  try {
    const id = await chrome.notifications.create({
      type: 'basic',
      iconUrl: '/data/icons/48.png',
      title: chrome.runtime.getManifest().name,
      message: e.message || e
    });
    setTimeout(() => chrome.notifications.clear(id), 3000);
  }
  catch (ee) {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    });
    if (tab) {
      chrome.action.setBadgeText({
        tabId: tab.id,
        text: 'E'
      });
      chrome.action.setTitle({
        tabId: tab.id,
        title: e.message || e
      });
      chrome.action.setBadgeBackgroundColor({
        tabId: tab.id,
        color: 'red'
      });
    }
  }
};

const actions = {
  async page(tab, info) {
    try {
      // is select.js already injected?
      const [r] = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        func: () => {
          return !!window.div;
        }
      });
      if (r && r.error) {
        throw Error(r.error);
      }
      // inject select.js
      if (r && r.result === false) {
        // change icon
        chrome.action.setIcon({
          tabId: tab.id,
          path: {
            '16': '/data/icons/inspect/16.png',
            '32': '/data/icons/inspect/32.png',
            '48': '/data/icons/inspect/48.png'
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
        '16': '/data/icons/16.png',
        '32': '/data/icons/32.png',
        '48': '/data/icons/48.png'
      }
    });
    chrome.tabs.sendMessage(tab.id, 'release', () => chrome.runtime.lastError);
    chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        allFrames: true
      },
      files: ['/data/inject/release.js']
    });
  }
};

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
    respond(analyzed[request.id]);
  }
  else if (request.cmd === 'analyzed') {
    const id = Math.random();
    //
    actions.release(sender.tab);
    //
    request.url = sender.tab.url;
    analyzed[id] = request;
    //
    chrome.runtime.sendMessage('close-inspector', () => chrome.runtime.lastError);
    //
    chrome.storage.local.get({
      left: 0,
      top: 0,
      width: 600,
      height: 750,
      mode: 'window'
    }, async prefs => {
      if (prefs.mode === 'window') {
        const win = await chrome.windows.getCurrent();
        request.id = win.id;
        const left = prefs.left || (win.left + Math.round((win.width - 500) / 2));
        const top = prefs.top || (win.top + Math.round((win.height - 700) / 2));
        chrome.windows.create({
          url: '/data/window/index.html?mode=window&id=' + id,
          type: 'popup',
          left: Math.max(win.left, left),
          top: Math.max(win.top, top),
          width: Math.max(prefs.width, 200),
          height: Math.max(prefs.height, 200)
        });
      }
      else {
        chrome.scripting.executeScript({
          target: {
            tabId: sender.tab.id
          },
          func: id => self.id = id,
          args: [id]
        }).then(() => chrome.scripting.executeScript({
          target: {
            tabId: sender.tab.id
          },
          files: ['/data/inject/embedded.js']
        })).catch(notify);
      }
    });
  }
  else if (request.cmd === 'persist') {
    chrome.storage.local.set(request.object);
  }

  return false;
});

/* FAQs & Feedback */
{
  chrome.management = chrome.management || {
    getSelf(c) {
      c({installType: 'normal'});
    }
  };
  if (navigator.webdriver !== true) {
    const {homepage_url: page, name, version} = chrome.runtime.getManifest();
    chrome.runtime.onInstalled.addListener(({reason, previousVersion}) => {
      chrome.management.getSelf(({installType}) => installType === 'normal' && chrome.storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            chrome.tabs.query({active: true, lastFocusedWindow: true}, tbs => chrome.tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            chrome.storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    chrome.runtime.setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
