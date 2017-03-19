var _ = require('src/common');
var VMDB = require('./db');
var sync = require('./sync');
var requests = require('./requests');
var cache = require('./utils/cache');
var scriptUtils = require('./utils/script');
var clipboard = require('./utils/clipboard');
var options = require('./options');

var vmdb = exports.vmdb = new VMDB;
var VM_VER = browser.runtime.getManifest().version;

options.hook(function (changes) {
  if ('isApplied' in changes) {
    setIcon(changes.isApplied);
  }
  browser.runtime.sendMessage({
    cmd: 'UpdateOptions',
    data: changes,
  });
});

function broadcast(data) {
  browser.tabs.sendMessage('EXTENSION', data);
}

function notify(options) {
  browser.notifications.create(options.id || 'Violentmonkey', {
    title: options.title + ' - ' + _.i18n('extName'),
    message: options.body,
    isClickable: options.isClickable,
  });
}

var autoUpdate = function () {
  function check() {
    checking = true;
    return new Promise(function (resolve, reject) {
      if (!options.get('autoUpdate')) return reject();
      if (Date.now() - options.get('lastUpdate') >= 864e5) {
        resolve(commands.CheckUpdateAll());
      }
    }).then(function () {
      setTimeout(check, 36e5);
    }, function () {
      checking = false;
    });
  }
  var checking;
  return function () {
    checking || check();
  };
}();
var commands = {
  NewScript: function (_data, _src) {
    return scriptUtils.newScript();
  },
  RemoveScript: function (id, _src) {
    return vmdb.removeScript(id)
    .then(function () {
      sync.sync();
    });
  },
  GetData: function (_data, _src) {
    return vmdb.getData().then(function (data) {
      data.sync = sync.states();
      data.version = VM_VER;
      return data;
    });
  },
  GetInjected: function (data, src) {
    data = {
      isApplied: options.get('isApplied'),
      version: VM_VER,
    };
    return data.isApplied
      ? vmdb.getScriptsByURL(src.url).then(function (res) {
        return Object.assign(data, res);
      }) : data;
  },
  UpdateScriptInfo: function (data, _src) {
    return vmdb.updateScriptInfo(data.id, data, {
      modified: Date.now(),
    })
    .then(function (script) {
      sync.sync();
      browser.runtime.sendMessage({
        cmd: 'UpdateScript',
        data: script,
      });
    });
  },
  SetValue: function (data, _src) {
    return vmdb.setValue(data.uri, data.values)
    .then(function () {
      broadcast({
        cmd: 'UpdateValues',
        data: {
          uri: data.uri,
          values: data.values,
        },
      });
    });
  },
  ExportZip: function (data, _src) {
    return vmdb.getExportData(data.ids, data.values);
  },
  GetScript: function (id, _src) {
    return vmdb.getScriptData(id);
  },
  GetMetas: function (ids, _src) {
    return vmdb.getScriptInfos(ids);
  },
  Move: function (data, _src) {
    return vmdb.moveScript(data.id, data.offset);
  },
  Vacuum: function (_data, _src) {
    return vmdb.vacuum();
  },
  ParseScript: function (data, _src) {
    return vmdb.parseScript(data).then(function (res) {
      var meta = res.data.meta;
      if (!meta.grant.length && !options.get('ignoreGrant')) {
        notify({
          id: 'VM-NoGrantWarning',
          title: _.i18n('Warning'),
          body: _.i18n('msgWarnGrant', [meta.name || _.i18n('labelNoName')]),
          isClickable: true,
        });
      }
      browser.runtime.sendMessage(res);
      sync.sync();
      return res.data;
    });
  },
  CheckUpdate: function (id, _src) {
    vmdb.getScript(id).then(vmdb.checkUpdate);
  },
  CheckUpdateAll: function (_data, _src) {
    options.set('lastUpdate', Date.now());
    vmdb.getScriptsByIndex('update', 1).then(function (scripts) {
      return Promise.all(scripts.map(vmdb.checkUpdate));
    });
  },
  ParseMeta: function (code, _src) {
    return scriptUtils.parseMeta(code);
  },
  AutoUpdate: autoUpdate,
  GetRequestId: function (_data, _src) {
    return requests.getRequestId();
  },
  HttpRequest: function (details, src) {
    requests.httpRequest(details, function (res) {
      browser.tabs.sendMessage(src.id, {
        cmd: 'HttpRequested',
        data: res,
      });
    });
  },
  AbortRequest: function (id, _src) {
    return requests.abortRequest(id);
  },
  InstallScript: function (data, _src) {
    var params = encodeURIComponent(data.url);
    if (data.from) params += '/' + encodeURIComponent(data.from);
    if (data.text) cache.set(data.url, data.text);
    browser.tabs.create(browser.runtime.getURL(browser.runtime.getManifest().config + '#confirm/' + params));
  },
  SyncAuthorize: function (_data, _src) {
    sync.authorize();
  },
  SyncRevoke: function (_data, _src) {
    sync.revoke();
  },
  SyncStart: function (_data, _src) {
    sync.sync();
  },
  GetFromCache: function (data, _src) {
    return cache.get(data) || null;
  },
  Notification: function (data, _src) {
    return browser.notifications.create({
      title: data.title || _.i18n('extName'),
      message: data.text,
      iconUrl: data.image || _.defaultImage,
    });
  },
  SetClipboard: function (data, _src) {
    clipboard.set(data);
  },
  OpenTab: function (data, _src) {
    browser.tabs.create({
      url: data.url,
      active: data.active,
    });
  },
  GetAllOptions: function (_data, _src) {
    return options.getAll();
  },
  GetOptions: function (data, _src) {
    return data.reduce(function (res, key) {
      res[key] = options.get(key);
      return res;
    }, {});
  },
  SetOptions: function (data, _src) {
    if (!Array.isArray(data)) data = [data];
    data.forEach(function (item) {
      options.set(item.key, item.value);
    });
  },
};

browser.notifications.onClicked.addListener(function (id) {
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

browser.notifications.onClosed.addListener(function (id) {
  broadcast({
    cmd: 'NotificationClose',
    data: id,
  });
});

function reinit() {
  var func = function (func) {
    var count = 0;
    if (!func) func = window.debouncedReload = function () {
      count ++;
      setTimeout(function () {
        if (!--count) location.reload();
      }, 1000);
    };
    func();
  };
  var injectScript = function (script) {
    var el = document.createElement('script');
    el.innerHTML = script;
    document.body.appendChild(el);
    document.body.removeChild(el);
  };
  var str = '!' + func.toString() + '(window.debouncedReload)';
  var wrapped = '!' + injectScript.toString() + '(' + JSON.stringify(str) + ')';
  var reloadHTTPS = options.get('reloadHTTPS');
  var br = window.external.mxGetRuntime().create('mx.browser');
  browser.tabs.query({})
  .then(function (tabs) {
    tabs.forEach(function (tab) {
      var protocol = tab.url.match(/^http(s?):/);
      if (protocol && (!protocol[1] || reloadHTTPS)) {
        br.executeScript(wrapped, tab.id);
      }
    });
  });
}

vmdb.initialized.then(function () {
  browser.runtime.onMessage.addListener(function (req, src) {
    var func = commands[req.cmd];
    if (func) {
      return func(req.data, src);
    }
  });
  setTimeout(autoUpdate, 2e4);
  sync.initialize();
  options.get('startReload') && reinit();
});

function setIcon(isApplied) {
  browser.browserAction.setIcon('icon' + (isApplied ? '' : 'w'));
}
setIcon(options.get('isApplied'));

browser.tabs.onUpdated.addListener(function (tabId, changes) {
  // file:/// URLs will not be injected on Maxthon 5
  if (/^file:\/\/\/.*?\.user\.js$/.test(changes.url)) {
    commands.InstallScript({
      url: changes.url,
    });
    browser.tabs.remove(tabId);
  }
});

!function () {
  function clear(tabId) {
    browser.browserAction.setBadgeText({
      text: '',
      tabId: tabId,
    });
  }
  function getBadge() {
    browser.tabs.query({active: true})
    .then(function (tabs) {
      var currentTab = tabs[0];
      clear(currentTab.id);
      _.injectContent('setBadge(' + JSON.stringify(currentTab.id) + ')');
    });
  }
  function setBadge(data, src) {
    var item = badges[src.id];
    if (!item) item = badges[src.id] = {num: 0};
    item.num += data.number;
    options.get('showBadge') && browser.browserAction.setBadgeText({
      tabId: data.tabId,
      text: item.num || '',
    });
    if (item.timer) clearTimeout(item.timer);
    item.timer = setTimeout(function () {
      delete badges[src.id];
    });
  }
  var badges = {};
  var debouncedGetBadge = _.debounce(getBadge, 100);
  browser.tabs.onActivated.addListener(debouncedGetBadge);
  commands.GetBadge = debouncedGetBadge;
  commands.SetBadge = setBadge;
  commands.BROWSER_SetBadge = browser.browserAction.setBadgeText.initBackground();
}();
