define('vmdb', function (require, _exports, module) {
  var scriptUtils = require('utils/script');
  var tester = require('utils/tester');

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

  function dbError(reject) {
    return function (_t, e) {
      console.error('Database error: ' + e.message);
      reject && reject();
    };
  }

  VMDB.prototype.openDB = function () {
    var _this = this;
    _this.db = openDatabase('Violentmonkey', '0.5', 'Violentmonkey data', 10 * 1024 * 1024);
    return _this.getTransaction(true).then(function (tx) {
      return [
        'CREATE TABLE IF NOT EXISTS scripts(id INTEGER PRIMARY KEY,uri VARCHAR,meta TEXT,custom TEXT,enabled INTEGER,"update" INTEGER,position INTEGER,code TEXT)',
        'CREATE TABLE IF NOT EXISTS cache(uri VARCHAR UNIQUE,data TEXT)',
        'CREATE TABLE IF NOT EXISTS require(uri VARCHAR UNIQUE,data TEXT)',
        'CREATE TABLE IF NOT EXISTS "values"(uri VARCHAR UNIQUE,data TEXT)',
      ].reduce(function (result, sql) {
        return result.then(function () {
          return new Promise(function (resolve, reject) {
            tx.executeSql(sql, [], function (_tx, res) {
              resolve(res);
            }, dbError(reject));
          });
        });
      }, Promise.resolve());
    });
  };

  VMDB.prototype.getTransaction = function (readwrite, tx) {
    var _this = this;
    return new Promise(function (resolve, reject) {
      if (tx) return resolve(tx);
      var method = readwrite ? 'transaction': 'readTransaction';
      _this.db[method].call(_this.db, function (tx) {
        resolve(tx);
      }, dbError(reject));
    });
  };

  VMDB.prototype.readSQLResult = function (res) {
    var data = [];
    var length = res.rows.length;
    for (var i = 0; i < length; i ++) {
      // item is read-only, so we clone it
      var item = res.rows.item(i);
      data.push(_.clone(item));
    }
    return data;
  };

  VMDB.prototype.initPosition = function () {
    var _this = this;
    _this.position = 0;
    return new Promise(function (resolve, reject) {
      _this.getTransaction().then(function (tx) {
        tx.executeSql('SELECT position FROM scripts ORDER BY position DESC LIMIT 1', [], function (_tx, res) {
          if (res.rows.length) _this.position = res.rows.item(0).position;
          resolve();
        }, dbError(reject));
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
    return _this.getTransaction(false, tx).then(function (tx) {
      return new Promise(function (resolve, reject) {
        tx.executeSql('SELECT * FROM scripts WHERE id=? LIMIT 1', [id], function (_tx, res) {
          resolve(_this.readScripts(res)[0]);
        }, dbError(reject));
      });
    });
  };

  VMDB.prototype.queryScript = function (id, meta, tx) {
    var _this = this;
    return id
    ? _this.getScript(id, tx)
    : new Promise(function (resolve, reject) {
      var uri = scriptUtils.getNameURI({meta: meta});
      _this.getTransaction(false, tx).then(function (tx) {
        tx.executeSql('SELECT * FROM scripts WHERE uri=? LIMIT 1', [uri], function (_tx, res) {
          resolve(_this.readScripts(res)[0]);
        }, dbError(reject));
      });
    });
  };

  VMDB.prototype.getScriptData = function (id, tx) {
    return this.getScript(id, tx).then(function (script) {
      if (!script) return Promise.reject();
      var data = scriptUtils.getScriptInfo(script);
      data.code = script.code;
      return data;
    });
  };

  VMDB.prototype.getScriptInfos = function (ids) {
    var _this = this;
    return _this.getTransaction().then(function (tx) {
      return Promise.all(ids.map(function (id) {
        return _this.getScript(id, tx);
      }));
    }).then(function (scripts) {
      return scripts.filter(function (x) {return x;})
      .map(scriptUtils.getScriptInfo);
    });
  };

  VMDB.prototype.getValues = function (uris, tx) {
    var _this = this;
    return _this.getTransaction(false, tx).then(function (tx) {
      return uris.reduce(function (result, uri) {
        return result.then(function (data) {
          return new Promise(function (resolve, reject) {
            tx.executeSql('SELECT data FROM "values" WHERE uri=? LIMIT 1', [uri], function (_tx, res) {
              var item = _this.readSQLResult(res)[0];
              try {
                if (item) data[uri] = JSON.parse(item.data);
              } catch (e) {}
              resolve(data);
            }, dbError(reject));
          });
        });
      }, Promise.resolve({}));
    });
  };

  VMDB.prototype.getScriptsByURL = function (url) {
    function getScripts(tx) {
      return _this.getScriptsByIndex('position', null, tx).then(function (scripts) {
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
            tx.executeSql('SELECT data FROM require WHERE uri=? LIMIT 1', [uri], function (_tx, res) {
              var item = _this.readSQLResult(res)[0];
              if (item) data[uri] = item.data;
              resolve(data);
            }, dbError(reject));
          });
        });
      }, Promise.resolve({}));
    }
    var _this = this;
    return _this.getTransaction().then(function (tx) {
      return getScripts(tx).then(function (data) {
        return Promise.all([
          getRequire(data.require, tx),
          _this.getValues(data.uris, tx),
          _this.getCacheB64(data.cache, tx),
        ]).then(function (res) {
          return {
            scripts: data.scripts,
            require: res[0],
            values: res[1],
            cache: res[2],
          };
        });
      });
    });
  };

  VMDB.prototype.getData = function () {
    function getScripts(tx) {
      return _this.getScriptsByIndex('position', null, tx).then(function (scripts) {
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
      return getScripts(tx).then(function (data) {
        return getCache(data.cache, tx).then(function (cache) {
          return {
            scripts: data.scripts,
            cache: cache,
          };
        });
      });
    });
  };

  VMDB.prototype.removeScript = function (id) {
    return this.getTransaction(true).then(function (tx) {
      return new Promise(function (resolve, reject) {
        tx.executeSql('DELETE FROM scripts WHERE id=?', [id], function (_tx, _res) {
          resolve();
        }, dbError(reject));
      });
    });
  };

  VMDB.prototype.moveScript = function (id, offset) {
    var _this = this;
    return _this.getTransaction(true).then(function (tx) {
      return (new Promise(function (resolve, reject) {
        tx.executeSql('SELECT position FROM scripts WHERE id=?', [id], function (_tx, res) {
          resolve(_this.readSQLResult(res)[0].position);
        }, dbError(reject));
      })).then(function (pos) {
        return new Promise(function (resolve, reject) {
          var sql = 'SELECT id,position FROM scripts WHERE position' + (offset < 0 ? '<' : '>') + '? ORDER BY position ' + (offset < 0 ? 'DESC' : '') + ' LIMIT ?';
          if (offset < 0) offset = -offset;
          tx.executeSql(sql, [pos, offset], function (_tx, res) {
            var items = _this.readSQLResult(res);
            resolve([[items[items.length - 1].position, id]].concat(items.map(function (item, i) {
              return [i ? items[i - 1].position : pos, item.id];
            })));
          }, dbError(reject));
        });
      }).then(function (updates) {
        return updates.reduce(function (result, item) {
          return result.then(function () {
            return new Promise(function (resolve, reject) {
              tx.executeSql('UPDATE scripts SET position=? WHERE id=?', item, function (_tx, _res) {
                resolve();
              }, dbError(reject));
            });
          });
        }, Promise.resolve());
      });
    });
  };

  VMDB.prototype.getCacheB64 = function (uris, tx) {
    var _this = this;
    return _this.getTransaction(false, tx).then(function (tx) {
      return uris.reduce(function (result, uri) {
        return result.then(function (data) {
          return new Promise(function (resolve, reject) {
            tx.executeSql('SELECT data FROM cache WHERE uri=? LIMIT 1', [uri], function (_tx, res) {
              var item = _this.readSQLResult(res)[0];
              if (item) data[uri] = item.data;
              resolve(data);
            }, dbError(reject));
          });
        });
      }, Promise.resolve({}));
    });
  };

  VMDB.prototype.saveCache = function (url, data, tx) {
    return this.getTransaction(true, tx).then(function (tx) {
      return new Promise(function (resolve, reject) {
        tx.executeSql('REPLACE INTO cache(uri,data) VALUES(?,?)', [url, data], function (_tx, _res) {
          resolve();
        }, dbError(reject));
      });
    });
  };

  VMDB.prototype.saveRequire = function (url, data, tx) {
    return this.getTransaction(true, tx).then(function (tx) {
      return new Promise(function (resolve, reject) {
        tx.executeSql('REPLACE INTO require(uri,data) VALUES(?,?)', [url, data], function (_tx, _res) {
          resolve();
        }, dbError(reject));
      });
    });
  };

  VMDB.prototype.saveScript = function (script, tx) {
    script.enabled = script.enabled ? 1 : 0;
    script.update = script.update ? 1 : 0;
    if (!script.position) script.position = ++ this.position;
    return this.getTransaction(true, tx).then(function (tx) {
      return new Promise(function (resolve, reject) {
        var data = [
          parseInt(script.id) || null,
          script.uri,
          JSON.stringify(script.meta),
          JSON.stringify(script.custom),
          script.enabled,
          script.update,
          script.position,
          script.code,
        ];
        tx.executeSql('REPLACE INTO scripts(id,uri,meta,custom,enabled,"update",position,code) VALUES(?,?,?,?,?,?,?,?)', data, function (_tx, res) {
          script.id = script.id || res.insertId;
          resolve(script);
        }, dbError(reject));
      });
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
          reader.onload = function (_e) {
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
    return this.getTransaction(true).then(function (tx) {
      return new Promise(function (resolve, reject) {
        tx.executeSql('REPLACE INTO "values"(uri,data) VALUES(?,?)', [uri, JSON.stringify(values)], function (_tx, _res) {
          resolve();
        }, dbError(reject));
      });
    });
  };

  VMDB.prototype.updateScriptInfo = function (id, data) {
    var _this = this;
    return _this.getTransaction(true).then(function (tx) {
      return _this.getScript(id, tx).then(function (script) {
        var updates = [];
        var args = [];
        for (var k in data) {
          var v = data[k];
          if (~['enabled', 'update'].indexOf(k)) {
            v = v ? 1 : 0;
          } else continue;
          updates.push('"' + k + '"=?');
          args.push(v);
          script[k] = v;
        }
        args.push(id);
        return new Promise(function (resolve, reject) {
          tx.executeSql('UPDATE scripts SET ' + updates.join(',') + ' WHERE id=?', args, function (_tx, _res) {
            resolve(scriptUtils.getScriptInfo(script));
          }, dbError(reject));
        });
      });
    });
  };

  VMDB.prototype.getExportData = function (ids, withValues) {
    function getScripts(ids, tx) {
      return Promise.all(ids.map(function (id) {
        return _this.getScriptData(id, tx);
      })).then(function (data) {
        return data.filter(function (x) {return x;});
      });
    }
    var _this = this;
    return _this.getTransaction().then(function (tx) {
      return getScripts(ids, tx).then(function (scripts) {
        var res = {
          scripts: scripts,
        };
        return withValues
        ? _this.getValues(scripts.map(function (script) {
          return script.uri;
        }), tx).then(function (values) {
          res.values = values;
          return res;
        }) : res;
      });
    });
  };

  VMDB.prototype.vacuum = function () {
    function getScripts(tx) {
      return _this.getScriptsByIndex('position', null, tx).then(function (scripts) {
        var data = {
          require: {},
          cache: {},
          values: {},
        };
        data.ids = scripts.map(function (script) {
          script.meta.require.forEach(function (uri) {data.require[uri] = 1;});
          for (var k in script.meta.resources) {
            data.cache[script.meta.resources[k]] = 1;
          }
          if (scriptUtils.isRemote(script.meta.icon)) {
            data.cache[script.meta.icon] = 1;
          }
          data.values[script.uri] = 1;
          return script.id;
        });
        return data;
      });
    }
    function vacuumPosition(ids, tx) {
      return ids.reduce(function (result, id, i) {
        return result.then(function () {
          return new Promise(function (resolve, reject) {
            tx.executeSql('UPDATE scripts SET position=? WHERE id=?', [i + 1, id], function (_tx, _res) {
              resolve();
            }, dbError(reject));
          });
        });
      }, Promise.resolve());
    }
    function vacuumCache(dbName, dict, tx) {
      return new Promise(function (resolve, reject) {
        tx.executeSql('SELECT uri FROM "' + dbName + '"', [], function (tx, res) {
          resolve(_this.readSQLResult(res).reduce(function (result, item) {
            return result.then(function () {
              return new Promise(function (resolve, reject) {
                if (dict[item.uri]) resolve(dict[item.uri] ++);
                else tx.executeSql('DELETE FROM "' + dbName + '" WHERE uri=?', [item.uri], function (_tx, _res) {
                  resolve();
                }, dbError(reject));
              });
            });
          }, Promise.resolve()));
        }, dbError(reject));
      });
    }
    var _this = this;
    return _this.getTransaction(true).then(function (tx) {
      return getScripts(tx).then(function (data) {
        return Promise.all([
          vacuumPosition(data.ids, tx),
          vacuumCache('require', data.require, tx),
          vacuumCache('cache', data.cache, tx),
          vacuumCache('values', data.values, tx),
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
    });
  };

  VMDB.prototype.getScriptsByIndex = function (index, cond, tx) {
    var _this = this;
    return _this.getTransaction(false, tx).then(function (tx) {
      return new Promise(function (resolve, reject) {
        tx.executeSql('SELECT * FROM scripts' + (cond ? ' WHERE ' + cond : '') + ' ORDER BY "' + index + '"', [], function (_tx, res) {
          resolve(_this.readScripts(res));
        }, dbError(reject));
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
    return _this.getTransaction(true).then(function (tx) {
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
      if (scriptUtils.isRemote(meta.icon)) {
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
      }
      return _this.queryScript(data.id, meta, tx).then(function (script) {
        if (script) {
          if (data.isNew) throw _.i18n('msgNamespaceConflict');
        } else {
          script = scriptUtils.newScript();
          res.cmd = 'add';
          res.data.message = _.i18n('msgInstalled');
        }
        if (data.more) for (var k in data.more) {
          if (k in script) script[k] = data.more[k];
        }
        script.meta = meta;
        script.code = data.code;
        script.uri = scriptUtils.getNameURI(script);
        // use referer page as default homepage
        if (!meta.homepageURL && !script.custom.homepageURL && scriptUtils.isRemote(data.from))
        script.custom.homepageURL = data.from;
        if (scriptUtils.isRemote(data.url))
        script.custom.lastInstallURL = data.url;
        script.custom.modified = data.modified || Date.now();
        return _this.saveScript(script, tx);
      });
    }).then(function (script) {
      _.assign(res.data, scriptUtils.getScriptInfo(script));
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
      var errHandler = function (_xhr) {
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
        }, function (_xhr) {
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

  module.exports = VMDB;
});
