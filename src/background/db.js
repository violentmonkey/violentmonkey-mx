function VMDB() {
  var _this = this;
  _this.initialized = _this.openDB().then(_this.initPosition.bind(_this));
  _this.checkUpdate = _this.checkUpdate.bind(_this);
}

/* ===============Data format 0.5==================
 * Database: Violentmonkey
 * scripts {
 * 		id: Auto
 * 		uri: String
 * 		custom: List-Dict	// Custom meta data
 * 		meta: List-Dict
 * 		enabled: 0|1
 * 		update: 0|1
 * 		position: Integer
 * 		code: String
 * }
 * require {
 * 		uri: String
 * 		data: TEXT
 * }
 * cache {
 * 		uri: String
 * 		data: Base64 encoded TEXT
 * }
 * values {
 * 		uri: String
 * 		values: TEXT
 * }
 */

VMDB.prototype.openDB = function () {
  var _this = this;
  return new Promise(function (resolve, reject) {
    _this.db = openDatabase('Violentmonkey', '0.5', 'Violentmonkey data', 10 * 1024 * 1024);
    _this.getTransaction().then(function (tx) {
      resolve([
  			'CREATE TABLE IF NOT EXISTS scripts(id INTEGER PRIMARY KEY,uri VARCHAR,meta TEXT,custom TEXT,enabled INTEGER,"update" INTEGER,position INTEGER,code TEXT)',
  			'CREATE TABLE IF NOT EXISTS cache(uri VARCHAR UNIQUE,data TEXT)',
  			'CREATE TABLE IF NOT EXISTS require(uri VARCHAR UNIQUE,data TEXT)',
  			'CREATE TABLE IF NOT EXISTS "values"(uri VARCHAR UNIQUE,data TEXT)',
  		].reduce(function (result, sql) {
        return result.then(function () {
          return new Promise(function (resolve, reject) {
            tx.executeSql(sql, [], resolve, reject);
          });
        });
      }, Promise.resolve()));
    });
  });
};

VMDB.prototype.getTransaction = function (readwrite, tx) {
  var _this = this;
  return new Promise(function (resolve, reject) {
    if (tx) return resolve(tx);
    var method = readwrite ? 'transaction': 'readTransaction';
    _this.db[method].call(_this.db, function (tx) {
      resolve(tx);
    });
  });
};

VMDB.prototype.readSQLResult = function (res) {
  var data = [];
  var length = res.rows.length;
  for (var i = 0; i < length; i ++) {
    // item is read-only, so we clone it
    var item = res.rows.item(i);
    var obj = {};
    Object.getOwnPropertyNames(item).forEach(function (k) {
      obj[k] = item[k];
    });
    data.push(obj);
  }
  return data;
};

VMDB.prototype.initPosition = function () {
  var _this = this;
  _this.position = 0;
  return new Promise(function (resolve, reject) {
    _this.getTransaction().then(function (tx) {
      tx.executeSql('SELECT position FROM scripts ORDER BY position DESC LIMIT 1', [], function (tx, res) {
        _this.position = _this.readSQLResult(res)[0] || 0;
        resolve();
      })
    });
  });
};

VMDB.prototype.readScripts = function (res) {
  var scripts = this.readSQLResult(res);
  scripts.forEach(function (script) {
    if (typeof script.meta !== 'object') script.meta = JSON.parse(script.meta);
    if (typeof script.custom !== 'object') script.custom = JSON.parse(script.custom);
  });
  return scripts;
};

VMDB.prototype.getScript = function (id, tx) {
  var _this = this;
  _this.getTransaction(false, tx).then(function (tx) {
    return new Promise(function (resolve, reject) {
      tx.executeSql('SELECT * FROM scripts WHERE id=? LIMIT 1', [id], function (tx, res) {
        resolve(_this.readScripts(res)[0]);
      });
    });
  });
};

VMDB.prototype.queryScript = function (id, meta, tx) {
  var _this = this;
  return (
    id ? _this.getScript(id, tx)
    : new Promise(function (resolve, reject) {
      var uri = scriptUtils.getNameURI({meta: meta});
      if (uri !== '::')
        _this.getTransaction(false, tx).then(function (tx) {
          tx.executeSql('SELECT * FROM scripts WHERE uri=? LIMIT 1', [uri], function (tx, res) {
            resolve(_this.readScripts(res)[0]);
          });
        });
      else resolve();
    })
  ).then(function (script) {
    return script || scriptUtils.newScript();
  });
};

VMDB.prototype.getScriptData = function (id) {
  return this.getScript(id).then(function (script) {
    if (!script) return Promise.reject();
    var data = scriptUtils.getScriptInfo(script);
    data.code = script.code;
    return data;
  });
};

VMDB.prototype.getScriptInfos = function (ids) {
  var _this = this;
  _this.getTransaction().then(function (tx) {
    return ids.reduce(function (result, id) {
      return result.then(function (list) {
        return _this.getScript(id, tx).then(function (script) {
          script && list.push(scriptUtils.getScriptInfo(script));
          return list;
        });
      });
    }, Promise.resolve([]));
  });
};

VMDB.prototype.getScriptsByURL = function (url) {
  function getScripts(tx) {
    return _this.getScriptsByIndex('position', tx).then(function (scripts) {
      var data = {
        uris: [],
      };
      var require = {};
      var cache = {};
      data.scripts = scripts.filter(function (script) {
        if (tester.testURL(url, script)) {
          data.uris.push(script.uri);
          script.meta.require.forEach(function (key) {
            require[key] = 1;
          });
          for (var k in script.meta.resources)
            cache[script.meta.resources[k]] = 1;
          return true;
        }
      });
      data.require = Object.keys(require);
      data.cache = Object.keys(cache);
      return data;
    });
  }
  function getRequire(uris, tx) {
    return uris.reduce(function (result, uri) {
      return result.then(function (data) {
        return new Promise(function (resolve, reject) {
          tx.executeSql('SELECT data FROM require WHERE uri=? LIMIT 1', [uri], function (tx, res) {
            var item = _this.readSQLResult(res)[0];
            if (item) data[uri] = item.data;
            resolve(data);
          });
        });
      });
    }, Promise.resolve({}));
  }
  function getValues(uris, tx) {
    return uris.reduce(function (result, uri) {
      return result.then(function (data) {
        return new Promise(function (resolve, reject) {
          tx.executeSql('SELECT data FROM cache WHERE uri=? LIMIT 1', [uri], function (tx, res) {
            var item = _this.readSQLResult(res)[0];
            if (item) data[url] = item.data;
            resolve(data);
          });
        });
      });
    }, Promise.resolve({}));
  }
  var _this = this;
  _this.getTransaction().then(function (tx) {
    var res = {};
    return getScripts(tx).then(function (data) {
      res.scripts = data.scripts;
      return getRequire(data.require, tx).then(function (require) {
        res.require = require;
        return getValues(data.uris, tx);
      }).then(function (values) {
        res.values = values;
        return _this.getCacheB64(data.cache, tx);
      }).then(function (cache) {
        res.cache = cache;
        return res;
      })
    })
  });
};

VMDB.prototype.getData = function () {
  function getScripts(tx) {
    return _this.getScriptsByIndex('position', tx).then(function (scripts) {
      var data = {};
      var cache = {};
      data.scripts = scripts.map(function (script) {
        var icon = script.meta.icon;
        if (scriptUtils.isRemote(icon)) cache[icon] = 1;
        return scriptUtils.getScriptInfo(script);
      });
      data.cache = Object.keys(cache);
      return data;
    });
  }
  function getCache(uris, tx) {
    return _this.getCacheB64(uris, tx).then(function (cache) {
      for (var k in cache)
        cache[k] = 'data:image/png;base64,' + cache[k];
      return cache;
    });
  }
  var _this = this;
  return _this.getTransaction().then(function (tx) {
    var res = {};
    return getScripts(tx).then(function (data) {
      res.scripts = data.scripts;
      return getCache(data.cache, tx);
    }).then(function (cache) {
      res.cache = cache;
      return res;
    })
  });
};

VMDB.prototype.removeScript = function (id) {
  return this.getTransaction(true).then(function (tx) {
    return new Promise(function (resolve, reject) {
      tx.executeSql('DELETE FROM scripts WHERE id=?', [id], function (tx, res) {
        resolve();
      });
    });
  });
};

VMDB.prototype.moveScript = function (id, offset) {
  var tx = this.db.transaction('scripts', 'readwrite');
  var o = tx.objectStore('scripts');
  return this.getScript(id, tx).then(function (script) {
    var pos = script.position;
    var range, order;
    if (offset < 0) {
      range = IDBKeyRange.upperBound(pos, true);
      order = 'prev';
      offset = -offset;
    } else {
      range = IDBKeyRange.lowerBound(pos, true);
      order = 'next';
    }
    return new Promise(function (resolve, reject) {
      o.index('position').openCursor(range, order).onsuccess = function (e) {
        var result = e.target.result;
        if (result) {
          offset --;
          var value = result.value;
          value.position = pos;
          pos = result.key;
          result.update(value);
          if (offset) result.continue();
          else {
            script.position = pos;
            o.put(script).onsuccess = function () {
              resolve();
            };
          }
        }
      };
    });
  });
};

VMDB.prototype.getCacheB64 = function (uris, tx) {
  var _this = this;
  return _this.getTransaction(false, tx).then(function (tx) {
    return uris.reduce(function (result, uri) {
      return result.then(function (data) {
        return new Promise(function (resolve, reject) {
          tx.executeSql('SELECT data FROM cache WHERE uri=? LIMIT 1', [uri], function (tx, res) {
            var item = _this.readSQLResult(res)[0];
            if (item) data[uri] = item.data;
            resolve(data);
          });
        });
      });
    }, Promise.resolve({}));
  });
};

VMDB.prototype.saveCache = function (url, data, tx) {
  tx = tx || this.db.transaction('cache', 'readwrite');
  var o = tx.objectStore('cache');
  return new Promise(function (resolve, reject) {
    o.put({uri: url, data: data}).onsuccess = function () {
      resolve();
    };
  });
};

VMDB.prototype.saveRequire = function (url, data, tx) {
  tx = tx || this.db.transaction('require', 'readwrite');
  var o = tx.objectStore('require');
  return new Promise(function (resolve, reject) {
    o.put({uri: url, code: data}).onsuccess = function () {
      resolve();
    };
  });
};

VMDB.prototype.saveScript = function (script, tx) {
  script.enabled = script.enabled ? 1 : 0;
  script.update = script.update ? 1 : 0;
  if (!script.position) script.position = ++ this.position;
  tx = tx || this.db.transaction('scripts', 'readwrite');
  var o = tx.objectStore('scripts');
  return new Promise(function (resolve, reject) {
    o.put(script).onsuccess = function (e) {
      script.id = e.target.result;
      resolve(script);
    };
  });
};

VMDB.prototype.fetchCache = function () {
  var requests = {};
  return function (url, check) {
    var _this = this;
    return requests[url]
    || (requests[url] = scriptUtils.fetch(url, 'blob').then(function (res) {
      return (check ? check(res.response) : Promise.resolve()).then(function () {
        return res.response;
      });
    }).then(function (data) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader;
        reader.onload = function (e) {
          _this.saveCache(url, window.btoa(this.result)).then(function () {
            delete requests[url];
            resolve();
          });
        };
        reader.onerror = function (e) {
          reject(e);
        };
        reader.readAsBinaryString(data);
      });
    }));
  };
}();

VMDB.prototype.fetchRequire = function () {
  var requests = {};
  return function (url) {
    var _this = this;
    return requests[url]
    || (requests[url] = scriptUtils.fetch(url).then(function (res) {
      return _this.saveRequire(url, res.responseText);
    }).then(function () {
      delete requests[url];
    }));
  };
}();

VMDB.prototype.setValue = function (uri, values) {
  var o = this.db.transaction('values', 'readwrite').objectStore('values');
  return new Promise(function (resolve, reject) {
    o.put({uri: uri, values: values}).onsuccess = function () {
      resolve();
    };
  });
};

VMDB.prototype.updateScriptInfo = function (id, data) {
  var o = this.db.transaction('scripts', 'readwrite').objectStore('scripts');
  return new Promise(function (resolve, reject) {
    o.get(id).onsuccess = function (e) {
      var script = e.target.result;
      if (!script) return reject();
      for (var k in data)
        if (k in script) script[k] = data[k];
      o.put(script).onsuccess = function (e) {
        resolve(scriptUtils.getScriptInfo(script));
      };
    };
  });
};

VMDB.prototype.getExportData = function (ids, withValues) {
  function getScripts(ids) {
    var o = tx.objectStore('scripts');
    return Promise.all(ids.map(function (id) {
      return new Promise(function (resolve, reject) {
        o.get(id).onsuccess = function (e) {
          resolve(e.target.result);
        };
      });
    })).then(function (data) {
      return data.filter(function (x) {return x;});
    });
  }
  function getValues(uris) {
    var o = tx.objectStore('values');
    return Promise.all(uris.map(function (uri) {
      return new Promise(function (resolve, reject) {
        o.get(uri).onsuccess = function (e) {
          resolve(e.target.result);
        };
      });
    })).then(function (data) {
      return data.reduce(function (result, value, i) {
        if (value) result[uris[i]] = value.values;
        return result;
      }, {});
    });
  }
  var tx = this.db.transaction(['scripts', 'values']);
  return getScripts(ids).then(function (scripts) {
    var res = {
      scripts: scripts,
    };
    return withValues
    ? getValues(scripts.map(function (script) {return script.uri;})).then(function (values) {
      res.values = values;
      return res;
    }) : res;
  });
};

VMDB.prototype.vacuum = function () {
  function getScripts() {
    return _this.getScriptsByIndex('position', null, tx).then(function (scripts) {
      var data = {
        require: {},
        cache: {},
        values: {},
      };
      data.ids = scripts.map(function (script) {
        script.meta.require.forEach(function (uri) {data.require[uri] = 1;});
        for (var k in script.meta.resources)
          data.cache[script.meta.resources[k]] = 1;
        if (scriptUtils.isRemote(script.meta.icon))
          data.cache[script.meta.icon] = 1;
        data.values[script.uri] = 1;
        return script.id;
      });
      return data;
    });
  }
  function vacuumPosition(ids) {
    var o = tx.objectStore('scripts');
    return ids.reduce(function (res, id, i) {
      return res.then(function () {
        return new Promise(function (resolve, reject) {
          o.get(id).onsuccess = function (e) {
            var result = e.target.result;
            result.position = i + 1;
            o.put(result).onsuccess = function () {
              resolve();
            };
          };
        });
      });
    }, Promise.resolve());
  }
  function vacuumCache(dbName, dict) {
    return new Promise(function (resolve, reject) {
      var o = tx.objectStore(dbName);
      o.openCursor().onsuccess = function (e) {
        var result = e.target.result;
        if (result) {
          var value = result.value;
          (new Promise(function (resolve, reject) {
            if (!dict[value.uri])
              o.delete(value.uri).onsuccess = function () {
                resolve();
              };
            else {
              dict[value.uri] ++;
              resolve();
            }
          })).then(function () {
            result.continue();
          });
        } else resolve();
      };
    });
  }
  var _this = this;
  var tx = _this.db.transaction(['scripts', 'require', 'cache', 'values'], 'readwrite');
  return getScripts().then(function (data) {
    return Promise.all([
      vacuumPosition(data.ids),
      vacuumCache('require', data.require),
      vacuumCache('cache', data.cache),
      vacuumCache('values', data.values),
    ]).then(function () {
      return {
        require: data.require,
        cache: data.cache,
      };
    });
  }).then(function (data) {
    return Promise.all([
      Object.keys(data.require).map(function (k) {
        return data.require[k] === 1 && _this.fetchRequire(k);
      }),
      Object.keys(data.cache).map(function (k) {
        return data.cache[k] === 1 && _this.fetchCache(k);
      }),
    ]);
  });
};

VMDB.prototype.getScriptsByIndex = function (index, tx) {
  var _this = this;
  return _this.getTransaction(false, tx).then(function (tx) {
    return new Promise(function (resolve, reject) {
      tx.executeSql('SELECT * FROM scripts ORDER BY ?', [index], function (tx, res) {
        resolve(_this.readScripts(res));
      });
    });
  });
};

VMDB.prototype.parseScript = function (data) {
  var res = {
    cmd: 'update',
    data: {
      message: data.message == null ? _.i18n('msgUpdated') : data.message || '',
    },
  };
  var meta = scriptUtils.parseMeta(data.code);
  var _this = this;
  var tx = _this.db.transaction(['scripts', 'require'], 'readwrite');
  // @require
  meta.require.forEach(function (url) {
    var cache = data.require && data.require[url];
    cache ? _this.saveRequire(url, cache, tx) : _this.fetchRequire(url);
  });
  // @resource
  Object.keys(meta.resources).forEach(function (k) {
    var url = meta.resources[k];
    var cache = data.resources && data.resources[url];
    cache ? _this.saveCache(url, cache, tx) : _this.fetchCache(url);
  });
  // @icon
  if (scriptUtils.isRemote(meta.icon))
    _this.fetchCache(meta.icon, function (blob) {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(blob);
        var image = new Image;
        var free = function () {
          URL.revokeObjectURL(url);
        };
        image.onload = function () {
          free();
          resolve(blob);
        };
        image.onerror = function () {
          free();
          reject();
        };
        image.src = url;
      });
    });
  return _this.queryScript(data.id, meta, tx).then(function (script) {
    if (!script.id) {
      res.cmd = 'add';
      res.data.message = _.i18n('msgInstalled');
    }
    if (data.more) for (var k in data.more)
      if (k in script) script[k] = data.more[k];
    script.meta = meta;
    script.code = data.code;
    script.uri = scriptUtils.getNameURI(script);
    // use referer page as default homepage
    if (!meta.homepageURL && !script.custom.homepageURL && scriptUtils.isRemote(data.from))
      script.custom.homepageURL = data.from;
    if (scriptUtils.isRemote(data.url))
      script.custom.lastInstallURL = data.url;
    return _this.saveScript(script, tx);
  }).then(function (script) {
    Object.assign(res.data, scriptUtils.getScriptInfo(script));
    return res;
  });
};

VMDB.prototype.checkUpdate = function () {
  function check(script) {
    var res = {
      cmd: 'update',
      data: {
        id: script.id,
        checking: true,
      },
    };
    var downloadURL = script.custom.downloadURL || script.meta.downloadURL || script.custom.lastInstallURL;
    var updateURL = script.custom.updateURL || script.meta.updateURL || downloadURL;
    var okHandler = function (xhr) {
      var meta = scriptUtils.parseMeta(xhr.responseText);
      if (scriptUtils.compareVersion(script.meta.version, meta.version) < 0)
        return Promise.resolve();
      res.data.checking = false;
      res.data.message = _.i18n('msgNoUpdate');
      _.messenger.post(res);
      return Promise.reject();
    };
    var errHandler = function (xhr) {
      res.data.checking = false;
      res.data.message = _.i18n('msgErrorFetchingUpdateInfo');
      _.messenger.post(res);
      return Promise.reject();
    };
    var update = function () {
      if (!downloadURL) {
        res.data.message = '<span class="new">' + _.i18n('msgNewVersion') + '</span>';
        _.messenger.post(res);
        return Promise.reject();
      }
      res.data.message = _.i18n('msgUpdating');
      _.messenger.post(res);
      return scriptUtils.fetch(downloadURL).then(function (xhr) {
        return xhr.responseText;
      }, function (xhr) {
        res.data.checking = false;
        res.data.message = _.i18n('msgErrorFetchingScript');
        _.messenger.post(res);
        return Promise.reject();
      });
    };
    if (!updateURL) return Promise.reject();
    res.data.message = _.i18n('msgCheckingForUpdate');
    _.messenger.post(res);
    return scriptUtils.fetch(updateURL, null, {
      Accept: 'text/x-userscript-meta',
    }).then(okHandler, errHandler).then(update);
  }

  var processes = {};
  return function (script) {
    var _this = this;
    var promise = processes[script.id];
    if (!promise)
      promise = processes[script.id] = check(script).then(function (code) {
        delete processes[script.id];
        return _this.parseScript({
          id: script.id,
          code: code,
        }).then(function (res) {
          res.data.checking = false;
          _.messenger.post(res);
        });
      }, function () {
        delete processes[script.id];
        //return Promise.reject();
      });
    return promise;
  };
}();
