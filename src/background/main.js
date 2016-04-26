var vmdb = new VMDB;
var app = {};
setTimeout(function () {
  scriptUtils.fetch(_.mx.rt.getPrivateUrl() + 'def.json')
  .then(function (xhr) {
    app = JSON.parse(xhr.responseText)[0];
  });
});

function notify(options) {
  function show() {
		var n = new Notification(options.title + ' - ' + _.i18n('extName'), {
			body: options.body,
		});
		n.onclick = options.onClicked;
	}
	if (Notification.permission == 'granted') show();
	else Notification.requestPermission(function (e) {
		if (e == 'granted') show();
		else console.warn('Notification: ' + options.body);
	});
}

var badges = function () {
  function clear() {
    _.mx.rt.icon.hideBadge('');
    delayedClear = null;
  }
  function cancelClear() {
    delayedClear && clearTimeout(delayedClear);
  }
  function delayClear() {
    cancelClear();
    delayedClear = setTimeout(clear, 200);
  }
  function getBadges() {
    _.injectContent('setBadge()');
    delayClear();
  }
  function debounce(func, delay) {
    var timer;
    return function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        func.apply(null, arguments);
        timer = null;
      }, delay);
    };
  }
  function setBadges(num, src) {
    cancelClear();
    var item = badges[src.id];
    if (!item) item = badges[src.id] = {num: 0};
    item.num += num;
    if (_.options.get('showBadge'))
      _.mx.rt.icon.showBadge(item.num || '');
    if (item.timer) clearTimeout(item.timer);
    item.timer = setTimeout(function () {
      delete badges[src.id];
    });
  }
  var badges = {};
  var delayedClear;
  return {
    get: debounce(getBadges, 100),
    set: setBadges,
  };
}();

var autoUpdate = function () {
  function check() {
    checking = true;
    return new Promise(function (resolve, reject) {
      if (!_.options.get('autoUpdate')) return reject();
      if (Date.now() - _.options.get('lastUpdate') >= 864e5)
        return commands.CheckUpdateAll();
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
  return {
    post: function (data) {
      _.mx.rt.post('UpdateItem', data);
    },
  };
}();

var commands = {
  NewScript: function (data, src) {
    return Promise.resolve(scriptUtils.newScript());
  },
  RemoveScript: function (id, src) {
    return vmdb.removeScript(id);
  },
  GetData: function (data, src) {
    return vmdb.getData().then(function (data) {
      data.options = _.options.getAll();
      data.sync = sync.states();
      data.app = app;
      return data;
    });
  },
  GetInjected: function (data, src) {
    data = {
      isApplied: _.options.get('isApplied'),
      injectMode: _.options.get('injectMode'),
      version: app.version,
    };
    return data.isApplied
    ? vmdb.getScriptsByURL(src.url).then(function (res) {
      return _.assign(data, res);
    }) : Promise.resolve(data);
  },
  UpdateScriptInfo: function (data, src) {
    return vmdb.updateScriptInfo(data.id, data).then(function (script) {
      _.messenger.post({
        cmd: 'update',
        data: script,
      });
    });
  },
  SetValue: function (data, src) {
    return vmdb.setValue(data.uri, data.values);
  },
  SetOption: function (data, src) {
    _.options.set(data.key, data.value);
  },
  ExportZip: function (data, src) {
    return vmdb.getExportData(data.ids, data.values);
  },
  GetScript: function (id, src) {
    return vmdb.getScriptData(id);
  },
  GetMetas: function (ids, src) {
    return vmdb.getScriptInfos(ids);
  },
  Move: function (data, src) {
    return vmdb.moveScript(data.id, data.offset);
  },
  Vacuum: function (data, src) {
    return vmdb.vacuum();
  },
  ParseScript: function (data, src) {
    return vmdb.parseScript(data).then(function (res) {
      var meta = res.data.meta;
      if (!meta.grant.length && !_.options.get('ignoreGrant'))
        notify({
          id: 'VM-NoGrantWarning',
          title: _.i18n('Warning'),
          body: _.i18n('msgWarnGrant', [meta.name||_.i18n('labelNoName')]),
          onClicked: function () {
            _.tabs.create('http://wiki.greasespot.net/@grant');
            this.close();
          },
        });
      _.messenger.post(res);
      return res.data;
    });
  },
  CheckUpdate: function (id, src) {
    vmdb.getScript(id).then(vmdb.checkUpdate);
  },
  CheckUpdateAll: function (data, src) {
    _.options.set('lastUpdate', Date.now());
    vmdb.getScriptsByIndex('update', '"update"=1').then(function (scripts) {
      return Promise.all(scripts.map(vmdb.checkUpdate));
    });
  },
  ParseMeta: function (code, src) {
    return Promise.resolve(scriptUtils.parseMeta(code));
  },
  AutoUpdate: autoUpdate,
  GetBadge: badges.get,
  SetBadge: badges.set,
  InstallScript: function (url, src) {
    _.tabs.create(_.mx.rt.getPrivateUrl() + app.config + '#confirm/' + encodeURIComponent(url));
  },
  Authenticate: function (data, src) {
    var service = sync.service(data);
    service && service.authenticate && service.authenticate();
    return false;
  },
  SyncStart: function (data, src) {
    sync.sync(data && sync.service(data));
    return false;
  },
};

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
      _.mx.rt.post(req.src.id, {
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
      if (res) return res.then(function (data) {
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

setTimeout(function () {
  _.tabs.on('TAB_SWITCH', badges.get);
});
