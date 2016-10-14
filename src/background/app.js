var VMDB = require('./db');
var sync = require('./sync');
var requests = require('./requests');
var badges = require('./badges');
var cache = require('./utils/cache');
var tabsUtils = require('./utils/tabs');
var scriptUtils = require('./utils/script');
var _ = require('../common');

var vmdb = exports.vmdb = new VMDB;
var APP = {};
scriptUtils.fetch(_.mx.rt.getPrivateUrl() + 'def.json')
.then(function (xhr) {
  APP = JSON.parse(xhr.responseText)[0];
});

function notify(data) {
  function show() {
    var n = new Notification(data.title + ' - ' + _.i18n('extName'), {
      body: data.body,
    });
    n.onclick = data.onClicked;
  }
  if (Notification.permission == 'granted') show();
  else Notification.requestPermission(function (e) {
    if (e == 'granted') show();
    else console.warn('Notification: ' + data.body);
  });
}

var autoUpdate = function () {
  function check() {
    checking = true;
    return new Promise(function (resolve, reject) {
      if (!_.options.get('autoUpdate')) return reject();
      if (Date.now() - _.options.get('lastUpdate') >= 864e5) {
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
      _.messenger.post({
        cmd: 'del',
        data: id,
      });
    });
  },
  GetData: function (_data, _src) {
    return vmdb.getData().then(function (data) {
      data.sync = sync.states();
      data.app = ['version', 'config'].reduce(function (app, key) {
        app[key] = APP[key];
        return app;
      }, {});
      return data;
    });
  },
  GetInjected: function (data, src) {
    data = {
      isApplied: _.options.get('isApplied'),
      injectMode: _.options.get('injectMode'),
      version: APP.version,
    };
    return data.isApplied
      ? vmdb.getScriptsByURL(src.url).then(function (res) {
        return Object.assign(data, res);
      }) : data;
  },
  UpdateScriptInfo: function (data, _src) {
    return vmdb.updateScriptInfo(data.id, data)
    .then(function (script) {
      _.messenger.post({
        cmd: 'update',
        data: script,
      });
    });
  },
  SetValue: function (data, _src) {
    return vmdb.setValue(data.uri, data.values);
  },
  GetOptions: function (_data, _src) {
    return _.options.getAll();
  },
  GetOption: function (data, _src) {
    return _.options.get(data.key, data.def);
  },
  SetOption: function (data, _src) {
    _.options.set(data.key, data.value);
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
      if (!meta.grant.length && !_.options.get('ignoreGrant'))
        notify({
          id: 'VM-NoGrantWarning',
          title: _.i18n('Warning'),
          body: _.i18n('msgWarnGrant', [meta.name||_.i18n('labelNoName')]),
          onClicked: function () {
            tabsUtils.create('http://wiki.greasespot.net/@grant');
            this.close();
          },
        });
      _.messenger.post(res);
      sync.sync();
      return res.data;
    });
  },
  CheckUpdate: function (id, _src) {
    vmdb.getScript(id).then(vmdb.checkUpdate);
  },
  CheckUpdateAll: function (_data, _src) {
    _.options.set('lastUpdate', Date.now());
    vmdb.getScriptsByIndex('update', '"update"=1').then(function (scripts) {
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
      _.messenger.send(src.id, {
        cmd: 'HttpRequested',
        data: res,
      });
    });
    return false;
  },
  AbortRequest: function (id, _src) {
    return requests.abortRequest(id);
  },
  GetBadge: badges.get,
  SetBadge: badges.set,
  InstallScript: function (data, _src) {
    var params = encodeURIComponent(data.url);
    if (data.from) params += '/' + encodeURIComponent(data.from);
    if (data.text) cache.set(data.url, data.text);
    tabsUtils.create(_.mx.rt.getPrivateUrl() + APP.config + '#confirm/' + params);
  },
  Authenticate: function (data, _src) {
    var service = sync.service(data);
    service && service.authenticate && service.authenticate();
    return false;
  },
  SyncStart: function (data, _src) {
    sync.sync(data && sync.service(data));
    return false;
  },
  GetFromCache: function (data, _src) {
    return cache.get(data) || null;
  },
};

function reinit() {
  var func = function (f) {
    var c = 0;
    if (!f) f = window.delayedReload = function () {
      c ++;
      setTimeout(function () {
        if (!-- c) location.reload();
      }, 1000);
    };
    f();
  };
  var injectScript = function (script) {
    var el = document.createElement('script');
    el.innerHTML = script;
    document.body.appendChild(el);
    document.body.removeChild(el);
  };
  var str = '!' + func.toString() + '(window.delayedReload)';
  var wrapped = '!' + injectScript.toString() + '(' + JSON.stringify(str) + ')';
  var reloadHTTPS = _.options.get('reloadHTTPS');
  for (var length = _.mx.br.tabs.length; length --;) {
    var tab = _.mx.br.tabs.getTab(length);
    var protocol = tab.url.match(/^http(s?):/);
    if (protocol && (!protocol[1] || reloadHTTPS))
      _.mx.br.executeScript(wrapped, tab.id);
  }
}

_.messenger = function () {
  function send(id, data) {
    _.mx.rt.post(id, data);
  }
  function post(data) {
    send('UpdateItem', data);
  }
  return {
    send: send,
    post: post,
  };
}();

vmdb.initialized.then(function () {
  _.mx.rt.listen('Background', function (req) {
    /*
     * o={
     * 	cmd: String,
     * 	src: {
     * 		id: String,
     * 		url: String,
     * 	},
     * 	callback: String,
     * 	data: Object
     * }
     */
    function finish(res) {
      _.messenger.send(req.src.id, {
        cmd: 'Callback',
        data: {
          id: req.callback,
          data: res,
        },
      });
    }
    var func = commands[req.cmd];
    if (func) {
      var res = func(req.data, req.src);
      if (res === false) return;
      return Promise.resolve(res).then(function (data) {
        finish({
          data: data,
          error: null,
        });
      }, function (err) {
        if (err && err.stack) console.error(err.message, err.stack);
        finish({
          error: err || 'Unknown error!',
        });
      });
    }
    finish();
  });
  setTimeout(autoUpdate, 2e4);
  _.options.get('startReload') && reinit();
  sync.init();
});

_.mx.rt.icon.setIconImage('icon' + (_.options.get('isApplied') ? '' : 'w'));

tabsUtils.on('TAB_SWITCH', badges.get);
