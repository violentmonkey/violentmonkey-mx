import 'src/common/browser';
import { i18n, defaultImage, injectContent, debounce } from 'src/common';
import * as sync from './sync';
import {
  cache, vmdb,
  getRequestId, httpRequest, abortRequest, confirmInstall,
  newScript, parseMeta,
  setClipboard, checkUpdate,
  getOption, setOption, hookOptions, getAllOptions,
} from './utils';

const VM_VER = browser.runtime.getManifest().version;

hookOptions(changes => {
  if ('isApplied' in changes) setIcon(changes.isApplied);
  browser.runtime.sendMessage({
    cmd: 'UpdateOptions',
    data: changes,
  });
});

function broadcast(data) {
  browser.tabs.sendMessage('CONTENT', data);
}

function checkUpdateAll() {
  setOption('lastUpdate', Date.now());
  vmdb.getScriptsByIndex('update', 1)
  .then(scripts => Promise.all(scripts.map(checkUpdate)))
  .then(updatedList => {
    if (updatedList.some(Boolean)) sync.sync();
  });
}

let autoUpdating;
function autoUpdate() {
  if (autoUpdating) return;
  autoUpdating = true;
  check();
  function check() {
    new Promise((resolve, reject) => {
      if (!getOption('autoUpdate')) return reject();
      if (Date.now() - getOption('lastUpdate') >= 864e5) resolve(checkUpdateAll());
    })
    .then(() => setTimeout(check, 36e5), () => { autoUpdating = false; });
  }
}

const commands = {
  NewScript() {
    return newScript();
  },
  RemoveScript(id) {
    return vmdb.removeScript(id)
    .then(() => { sync.sync(); });
  },
  GetData() {
    return vmdb.getData().then(data => {
      data.sync = sync.getStates();
      data.version = VM_VER;
      return data;
    });
  },
  GetInjected(url) {
    const data = {
      isApplied: getOption('isApplied'),
      version: VM_VER,
    };
    return data.isApplied
    ? vmdb.getScriptsByURL(url).then(res => Object.assign(data, res))
    : data;
  },
  UpdateScriptInfo(data) {
    return vmdb.updateScriptInfo(data.id, data, {
      modified: Date.now(),
    })
    .then(script => {
      sync.sync();
      browser.runtime.sendMessage({
        cmd: 'UpdateScript',
        data: script,
      });
    });
  },
  SetValue(data) {
    return vmdb.setValue(data.uri, data.values)
    .then(() => {
      broadcast({
        cmd: 'UpdateValues',
        data: {
          uri: data.uri,
          values: data.values,
        },
      });
    });
  },
  ExportZip(data) {
    return vmdb.getExportData(data.ids, data.values);
  },
  GetScript(id) {
    return vmdb.getScriptData(id);
  },
  GetMetas(ids) {
    return vmdb.getScriptInfos(ids);
  },
  Move(data) {
    return vmdb.moveScript(data.id, data.offset)
    .then(() => { sync.sync(); });
  },
  Vacuum: vmdb.vacuum,
  ParseScript(data) {
    return vmdb.parseScript(data).then(res => {
      browser.runtime.sendMessage(res);
      sync.sync();
      return res.data;
    });
  },
  CheckUpdate(id) {
    vmdb.getScript(id).then(checkUpdate)
    .then(updated => {
      if (updated) sync.sync();
    });
  },
  CheckUpdateAll: checkUpdateAll,
  ParseMeta(code) {
    return parseMeta(code);
  },
  AutoUpdate: autoUpdate,
  GetRequestId: getRequestId,
  HttpRequest(details, src) {
    httpRequest(details, res => {
      browser.tabs.sendMessage(src.id, {
        cmd: 'HttpRequested',
        data: res,
      });
    });
  },
  AbortRequest: abortRequest,
  SyncAuthorize: sync.authorize,
  SyncRevoke: sync.revoke,
  SyncStart: sync.sync,
  CacheLoad(data) {
    return cache.get(data) || null;
  },
  CacheHit(data) {
    cache.hit(data.key, data.lifetime);
  },
  Notification(data) {
    return browser.notifications.create({
      title: data.title || i18n('extName'),
      message: data.text,
      iconUrl: data.image || defaultImage,
    });
  },
  SetClipboard: setClipboard,
  TabOpen(data) {
    return browser.tabs.create({
      url: data.url,
      active: data.active,
    })
    // Maxthon sucks
    // Bug: tab.id is a number, but getTabById requires a string
    .then(tab => ({ id: tab.id.toString() }));
  },
  TabClose(data, src) {
    const tabId = (data && data.id) || (src.tab && src.tab.id);
    if (tabId) browser.tabs.remove(tabId);
  },
  GetAllOptions: getAllOptions,
  GetOptions(data) {
    return data.reduce((res, key) => {
      res[key] = getOption(key);
      return res;
    }, {});
  },
  SetOptions(data) {
    const items = Array.isArray(data) ? data : [data];
    items.forEach(item => { setOption(item.key, item.value); });
  },
  CheckPosition: vmdb.checkPosition,
  ConfirmInstall: confirmInstall,
  GetTabId() {
    browser.tabs.query({})
    .then(tabs => {
      tabs.forEach((tab) => {
        const id = tab.id.toString();
        injectContent(`window.setTabId(${JSON.stringify(id)})`, id);
      });
    });
  },
  // XXX Maxthon sucks, patch for ON_NAVIGATE
  // ON_NAVIGATE won't emit for 302
  Navigate(_, src) {
    if (src.tab && src.tab.id) {
      onTabUpdate(src.tab.id, src.tab);
    }
  },
};

function reinit() {
  const inject = () => {
    let count = 0;
    let reload = window.debouncedReload;
    if (!reload) {
      reload = () => {
        count += 1;
        setTimeout(() => {
          count -= 1;
          if (!count) location.reload();
        }, 1000);
      };
      window.debouncedReload = reload;
    }
    reload();
  };
  const injectScript = script => {
    const el = document.createElement('script');
    el.textContent = script;
    document.body.appendChild(el);
    document.body.removeChild(el);
  };
  const str = `(${inject.toString()}())`;
  const wrapped = `!${injectScript.toString()}(${JSON.stringify(str)})`;
  const reloadHTTPS = getOption('reloadHTTPS');
  const br = window.external.mxGetRuntime().create('mx.browser');
  browser.tabs.query({})
  .then(tabs => {
    tabs.forEach(tab => {
      const protocol = tab.url.match(/^http(s?):/);
      if (protocol && (!protocol[1] || reloadHTTPS)) {
        br.executeScript(wrapped, tab.id);
      }
    });
  });
}

vmdb.initialized.then(() => {
  browser.runtime.onMessage.addListener((req, src) => {
    const func = commands[req.cmd];
    let res;
    if (func) {
      res = func(req.data, src);
      if (typeof res !== 'undefined') {
        // If res is not instance of native Promise, browser APIs will not wait for it.
        res = Promise.resolve(res)
        .then(data => ({ data }), error => ({ error }));
      }
    }
    return res;
  });
  setTimeout(autoUpdate, 2e4);
  sync.initialize();
  if (getOption('startReload')) reinit();
  vmdb.checkPosition();
});

{
  const badges = {};
  const debouncedGetBadge = debounce(getBadge, 100);
  browser.tabs.onActivated.addListener(debouncedGetBadge);
  commands.GetBadge = debouncedGetBadge;
  commands.SetBadge = setBadge;
  function clear(tabId) {
    browser.browserAction.setBadgeText({
      text: '',
      tabId,
    });
  }
  function getBadge() {
    browser.tabs.query({ active: true })
    .then(tabs => {
      const currentTab = tabs[0];
      clear(currentTab.id);
      injectContent(`setBadge(${JSON.stringify(currentTab.id)})`);
    });
  }
  function setBadge(data, src) {
    let item = badges[src.id];
    if (!item) {
      item = { num: 0 };
      badges[src.id] = item;
    }
    item.num += data.number;
    if (getOption('showBadge')) {
      browser.browserAction.setBadgeText({
        tabId: data.tabId,
        text: item.num || '',
      });
    }
    if (item.timer) clearTimeout(item.timer);
    item.timer = setTimeout(() => { delete badges[src.id]; });
  }
}

function setIcon(isApplied) {
  browser.browserAction.setIcon(`icon${isApplied ? '' : 'w'}`);
}
setIcon(getOption('isApplied'));

browser.notifications.onClicked.addListener(id => {
  broadcast({
    cmd: 'NotificationClick',
    data: id,
  });
});

browser.notifications.onClosed.addListener(id => {
  broadcast({
    cmd: 'NotificationClose',
    data: id,
  });
});

function onTabUpdate(tabId, changes) {
  // Maxthon sucks
  // When ON_NAVIGATE is fired, the old context is actually alive and the new context
  // is not ready yet, so we cannot do anything with the new context here.
  // file:/// URLs will not be injected on Maxthon 5
  if (/^file:\/\/\/.*?\.user\.js$/.test(changes.url)) {
    commands.InstallScript({
      url: changes.url,
    });
    browser.tabs.remove(tabId);
  }
}

browser.tabs.onUpdated.addListener(onTabUpdate);
