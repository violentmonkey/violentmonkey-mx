import { i18n, defaultImage, injectContent, debounce } from 'src/common';
import * as sync from './sync';
import { getRequestId, httpRequest, abortRequest, confirmInstall } from './utils/requests';
import cache from './utils/cache';
import { newScript, parseMeta } from './utils/script';
import { setClipboard } from './utils/clipboard';
import { getOption, setOption, hookOptions, getAllOptions } from './utils/options';
import * as vmdb from './utils/db';
import checkUpdate from './utils/update';

const VM_VER = browser.runtime.getManifest().version;

hookOptions(changes => {
  if ('isApplied' in changes) setIcon(changes.isApplied);
  browser.runtime.sendMessage({
    cmd: 'UpdateOptions',
    data: changes,
  });
});

function broadcast(data) {
  browser.tabs.sendMessage('EXTENSION', data);
}

function checkUpdateAll() {
  setOption('lastUpdate', Date.now());
  vmdb.getScriptsByIndex('update', 1)
  .then(scripts => Promise.all(scripts.map(checkUpdate)));
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
      const { meta } = res.data;
      if (!meta.grant.length && !getOption('ignoreGrant')) {
        notify({
          id: 'VM-NoGrantWarning',
          title: i18n('Warning'),
          body: i18n('msgWarnGrant', [meta.name || i18n('labelNoName')]),
          isClickable: true,
        });
      }
      browser.runtime.sendMessage(res);
      sync.sync();
      return res.data;
    });
  },
  CheckUpdate(id) {
    vmdb.getScript(id).then(checkUpdate);
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
    .then(tab => ({ id: tab.id }));
  },
  TabClose(data, src) {
    const tabId = data && (data.id || (src.tab && src.tab.id));
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
});

function notify(options) {
  browser.notifications.create(options.id || 'Violentmonkey', {
    title: `${options.title} - ${i18n('extName')}`,
    message: options.body,
    isClickable: options.isClickable,
  });
}

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
  if (id === 'VM-NoGrantWarning') {
    browser.tabs.create({
      url: 'http://wiki.greasespot.net/@grant',
    });
  } else {
    broadcast({
      cmd: 'NotificationClick',
      data: id,
    });
  }
});

browser.notifications.onClosed.addListener(id => {
  broadcast({
    cmd: 'NotificationClose',
    data: id,
  });
});

browser.tabs.onUpdated.addListener((tabId, changes) => {
  // file:/// URLs will not be injected on Maxthon 5
  if (/^file:\/\/\/.*?\.user\.js$/.test(changes.url)) {
    commands.InstallScript({
      url: changes.url,
    });
    browser.tabs.remove(tabId);
  }
});
