'use strict';

if (typeof importScripts !== 'undefined') {
  self.importScripts('context.js');
}

const analyzed = {};
const tabToId = new Map();

const notify = async e => {
  console.info(e);
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
  async release(tab) {
    chrome.action.setIcon({
      tabId: tab.id,
      path: {
        '16': '/data/icons/16.png',
        '32': '/data/icons/32.png',
        '48': '/data/icons/48.png'
      }
    });
    chrome.tabs.sendMessage(tab.id, 'release', () => chrome.runtime.lastError);
    await chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        allFrames: true
      },
      files: ['/data/inject/release.js']
    });
  }
};

chrome.action.onClicked.addListener(tab => {
  // on Firefox, using hotkey on the inspect interface itself!
  if (tab.url && tab.url.startsWith(chrome.runtime.getURL('/data/window/index.html'))) {
    const args = new URLSearchParams(tab.url);

    chrome.tabs.remove(tab.id, () => actions.page({
      id: Number(args.get('opener'))
    }, {frameId: 0}));
  }
  else {
    actions.page(tab, {
      frameId: 0
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, respond) => {
  console.log(request);
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
  else if (request.cmd === 'bio') {
    // late gains from the analysis background phases; merge and forward to the inspector
    const id = sender.tab && tabToId.get(sender.tab.id);
    const data = analyzed[id];
    if (data) {
      for (const entry of request.entries) {
        const i = data.bio.findIndex(o => o.fontUrl === entry.fontUrl);
        if (i === -1) {
          data.bio.push(entry);
        }
        else {
          data.bio[i] = entry;
        }
      }
      chrome.runtime.sendMessage({
        cmd: 'bio',
        id,
        entries: request.entries
      }, () => chrome.runtime.lastError);
    }
  }
  else if (request.cmd === 'detected') {
    // streamed detection from the analysis; merge and forward to the inspector
    const id = sender.tab && tabToId.get(sender.tab.id);
    const data = analyzed[id];
    if (data) {
      const fonts = data.getComputedStyle['font-family-rendered'];
      if (fonts) {
        for (const {fontname, ...o} of request.entries) {
          fonts[fontname] = o;
        }
        chrome.runtime.sendMessage({
          cmd: 'detected',
          id,
          entries: request.entries,
          done: request.done === true
        }, () => chrome.runtime.lastError);
      }
    }
  }
  else if (request.cmd === 'segments') {
    // streamed per-text-node breakdown of a complex selection; store and
    // forward to the inspector like 'detected' does
    const id = sender.tab && tabToId.get(sender.tab.id);
    const data = analyzed[id];
    if (data) {
      data.segments = (data.segments || []).concat(request.entries);
      chrome.runtime.sendMessage({
        cmd: 'segments',
        id,
        entries: request.entries,
        done: request.done === true
      }, () => chrome.runtime.lastError);
    }
  }
  else if (request.cmd === 'analyzed') {
    const id = Math.random();
    request.url = sender.tab.url;
    analyzed[id] = request;
    tabToId.set(sender.tab.id, id);
    //
    chrome.runtime.sendMessage('close-inspector', () => chrome.runtime.lastError);
    //
    chrome.storage.local.get({
      width: 800,
      height: 750,
      mode: 'window'
    }, async prefs => {
      // releasing the selection UI races the scripting calls that block the
      // heavy pages; the inspector opens first
      if (prefs.mode === 'window') {
        const win = await chrome.windows.getCurrent();
        request.id = win.id;
        const left = (win.left + Math.round((win.width - prefs.width) / 2));
        const top = (win.top + Math.round((win.height - prefs.height) / 2));
        try {
          await chrome.windows.create({
            url: '/data/window/index.html?mode=window&id=' + id + '&opener=' + sender.tab.id,
            type: 'popup',
            left: Math.max(win.left, left),
            top: Math.max(win.top, top),
            width: Math.max(prefs.width, 200),
            height: Math.max(prefs.height, 200)
          });
        }
        catch (e) {
          console.error(e);
        }
        actions.release(sender.tab);
      }
      else {
        // release the picker UI first; release.js removes
        // #font-finder-embedded-div, so running it after the
        // injection would tear the fresh panel down
        await actions.release(sender.tab);
        try {
          await chrome.scripting.executeScript({
            target: {
              tabId: sender.tab.id
            },
            func: (id, opener) => {
              self.id = id;
              self.opener = opener;
            },
            args: [id, sender.tab.id]
          });
          await chrome.scripting.executeScript({
            target: {
              tabId: sender.tab.id
            },
            files: ['/data/inject/embedded.js']
          });
        }
        catch (e) {
          notify(e);
        }
      }
    });
  }
  else if (request.cmd === 'persist') {
    chrome.storage.local.set(request.object);
  }
  else if (request.cmd === 'pick') {
    setTimeout(() => {
      actions.page({id: request.opener}, {frameId: 0});
    }, 100);
  }
  else if (request.cmd === 'close-me') {
    chrome.scripting.executeScript({
      target: {
        tabId: sender.tab.id
      },
      func: () => [...document.querySelectorAll('#font-finder-embedded-div')].forEach(d => d.remove())
    });
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
