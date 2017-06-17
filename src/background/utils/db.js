import Promise from 'sync-promise-lite';
import { i18n, request, buffer2string, getFullUrl, isRemote } from 'src/common';
import { getNameURI, getScriptInfo, parseMeta, newScript } from './script';
import { testScript, testBlacklist } from './tester';

let db;

const position = {
  value: 0,
  set(v) {
    position.value = +v || 0;
  },
  get() {
    return position.value + 1;
  },
  update(v) {
    if (position.value < +v) position.set(v);
  },
};

export const initialized = openDatabase().then(initPosition);

function openDatabase() {
  db = window.openDatabase('Violentmonkey', '0.5', 'Violentmonkey data', 10 * 1024 * 1024);
  return getTransaction(true)
  .then(tx => new Promise((resolve, reject) => {
    const sqls = [
      'CREATE TABLE IF NOT EXISTS scripts(id INTEGER PRIMARY KEY,uri VARCHAR,meta TEXT,custom TEXT,enabled INTEGER,"update" INTEGER,position INTEGER,code TEXT)',
      'CREATE TABLE IF NOT EXISTS cache(uri VARCHAR UNIQUE,data TEXT)',
      'CREATE TABLE IF NOT EXISTS require(uri VARCHAR UNIQUE,data TEXT)',
      'CREATE TABLE IF NOT EXISTS "values"(uri VARCHAR UNIQUE,data TEXT)',
    ];
    exec();
    function exec() {
      const sql = sqls.shift();
      if (sql) {
        tx.executeSql(sql, [], () => { exec(); }, dbError(reject));
      } else {
        resolve();
      }
    }
  }));
}

function dbError(reject) {
  return (t, e) => {
    console.error('Database error: ', e);
    if (reject) reject();
  };
}

function getTransaction(readwrite, cTx) {
  return new Promise((resolve, reject) => {
    if (cTx) return resolve(cTx);
    db[readwrite ? 'transaction' : 'readTransaction'](resolve, dbError(reject));
  });
}

function placeholders(n) {
  const arr = [];
  for (let i = 0; i < n; i += 1) arr.push('?');
  return arr.join(',');
}

function transformScript(script) {
  if (script) {
    // Transform object fields
    ['meta', 'custom'].forEach(key => {
      if (typeof script[key] !== 'object') {
        try {
          script[key] = JSON.parse(script[key]);
        } catch (e) {
          script[key] = {};
        }
      }
    });
    // XXX transform custom fields used in v2.6.1-
    const { custom } = script;
    [
      ['origInclude', '_include'],
      ['origMatch', '_match'],
      ['origExclude', '_exclude'],
      ['origExcludeMatch', '_excludeMatch'],
    ].forEach(([key, oldKey]) => {
      if (typeof custom[key] === 'undefined') {
        custom[key] = custom[oldKey] !== false;
        delete custom[oldKey];
      }
    });
  }
  return script;
}

const scriptFieldEncoders = {
  id: id => +id || null,
  meta: meta => JSON.stringify(meta || {}),
  custom: custom => JSON.stringify(custom || {}),
  enabled: enabled => (enabled ? 1 : 0),
  update: update => (update ? 1 : 0),
};
function encodeScript(script) {
  return Object.keys(script).reduce((res, key) => {
    const handler = scriptFieldEncoders[key];
    const val = script[key];
    res[key] = handler ? handler(val) : val;
    return res;
  }, {});
}

function readSQLResult(res) {
  const data = [];
  for (let i = 0; i < res.rows.length; i += 1) {
    const item = res.rows.item(i);
    data.push(Object.assign({}, item));
  }
  return data;
}

export function getScript(id, cTx) {
  return getTransaction(false, cTx)
  .then(tx => new Promise((resolve, reject) => {
    const ids = Array.isArray(id) ? id : [id];
    tx.executeSql(
      `SELECT * FROM scripts WHERE id in (${placeholders(ids.length)})`,
      ids,
      (t, res) => {
        const items = readSQLResult(res).map(transformScript);
        resolve(Array.isArray(id) ? items : items[0]);
      },
      dbError(reject),
    );
  }));
}

export function queryScript(id, meta, cTx) {
  if (id) return getScript(id, cTx);
  return getTransaction(false, cTx)
  .then(tx => new Promise((resolve, reject) => {
    const uri = getNameURI({ meta });
    tx.executeSql(
      'SELECT * FROM scripts WHERE uri=? LIMIT 1',
      [uri],
      (t, res) => { resolve(readSQLResult(res)[0]); },
      dbError(reject),
    );
  }))
  .then(transformScript);
}

export function getScriptData(id) {
  return getScript(id).then(script => {
    if (!script) return Promise.reject();
    const data = getScriptInfo(script);
    data.code = script.code;
    return data;
  });
}

export function getScriptInfos(ids) {
  return getTransaction()
  .then(tx => getScript(ids, tx))
  .then(scripts => scripts.filter(Boolean).map(getScriptInfo));
}

export function getValues(uris, cTx) {
  return getTransaction(false, cTx)
  .then(tx => new Promise((resolve, reject) => {
    tx.executeSql(
      `SELECT uri,data FROM "values" WHERE uri in (${placeholders(uris.length)})`,
      uris,
      (t, res) => {
        const items = readSQLResult(res);
        const result = items.reduce((map, item) => {
          try {
            map[item.uri] = JSON.parse(item.data);
          } catch (e) {
            // ignore invalid JSON
          }
          return map;
        }, {});
        resolve(result);
      },
      dbError(reject),
    );
  }));
}

export function getScriptsByURL(url) {
  return getTransaction()
  .then(tx => (
    loadScripts(tx)
    .then(data => (
      Promise.all([
        loadRequires(tx, data.require),
        getValues(data.uris, tx),
        getCacheB64(data.cache, tx),
      ])
      .then(res => ({
        scripts: data.scripts,
        require: res[0],
        values: res[1],
        cache: res[2],
      }))
    ))
  ));

  function loadScripts(tx) {
    const data = {
      uris: [],
    };
    const require = {};
    const cache = {};
    return (testBlacklist(url)
    ? Promise.resolve([])
    : getScriptsByIndex('position', null, tx, script => {
      if (!testScript(url, script)) return;
      data.uris.push(script.uri);
      script.meta.require.forEach(key => { require[key] = 1; });
      Object.keys(script.meta.resources).forEach(key => {
        cache[script.meta.resources[key]] = 1;
      });
      return script;
    }))
    .then(scripts => {
      data.scripts = scripts.filter(Boolean);
      data.require = Object.keys(require);
      data.cache = Object.keys(cache);
      return data;
    });
  }
  function loadRequires(tx, uris) {
    return new Promise((resolve, reject) => {
      tx.executeSql(
        `SELECT uri,data FROM require WHERE uri in (${placeholders(uris.length)})`,
        uris,
        (t, res) => {
          const items = readSQLResult(res);
          const result = items.reduce((map, item) => {
            map[item.uri] = item.data;
            return map;
          }, {});
          resolve(result);
        },
        dbError(reject),
      );
    });
  }
}

export function getData() {
  return getTransaction()
  .then(tx => loadScripts(tx).then(data => loadCache(tx, data.cache).then(cache => ({
    cache,
    scripts: data.scripts,
  }))));

  function loadScripts(tx) {
    const data = {};
    const cache = {};
    return getScriptsByIndex('position', null, tx, script => {
      const { icon } = script.meta;
      if (isRemote(icon)) cache[icon] = 1;
      return getScriptInfo(script);
    })
    .then(scripts => {
      data.scripts = scripts;
      data.cache = Object.keys(cache);
      return data;
    });
  }
  function loadCache(tx, uris) {
    return getCacheB64(uris, tx)
    .then(cache => {
      Object.keys(cache).forEach(key => {
        cache[key] = `data:image/png;base64,${cache[key]}`;
      });
      return cache;
    });
  }
}

export function removeScript(id) {
  return getTransaction(true)
  .then(tx => new Promise((resolve, reject) => {
    tx.executeSql('DELETE FROM scripts WHERE id=?', [id], () => { resolve(); }, dbError(reject));
  }))
  .then(() => {
    browser.runtime.sendMessage({
      cmd: 'RemoveScript',
      data: id,
    });
  });
}

export function moveScript(id, offset) {
  return getTransaction(true)
  .then(tx => (
    getScript(id, tx)
    .then(script => new Promise((resolve, reject) => {
      const condition = `WHERE position ${offset < 0 ? '<' : '>'} ?`;
      const order = `ORDER BY position ${offset < 0 ? 'DESC' : ''}`;
      const sql = `SELECT id,position FROM scripts ${condition} ${order} LIMIT ?`;
      let number = offset;
      if (number < 0) number = -number;
      const args = [script.position, number];
      tx.executeSql(sql, args, (t, res) => {
        const items = readSQLResult(res);
        const updates = [
          [items[items.length - 1].position, id],
          [script.position, items[0].id],
        ];
        for (let i = 1; i < items.length; i += 1) {
          updates.push([items[i - 1].position, items[i].id]);
        }
        resolve(updates);
      }, dbError(reject));
    }))
    .then(updates => new Promise((resolve, reject) => {
      doUpdate();
      function doUpdate() {
        const item = updates.pop();
        if (item) {
          tx.executeSql(
            'UPDATE scripts SET position=? WHERE id=?',
            item,
            () => { doUpdate(); },
            dbError(reject),
          );
        } else {
          resolve();
        }
      }
    }))
  ));
}

function getCacheB64(urls, cTx) {
  return getTransaction(false, cTx)
  .then(tx => new Promise((resolve, reject) => {
    tx.executeSql(
      `SELECT uri,data FROM cache WHERE uri in (${placeholders(urls.length)})`,
      urls,
      (t, res) => {
        const items = readSQLResult(res);
        const result = items.reduce((map, item) => {
          map[item.uri] = item.data;
          return map;
        }, {});
        resolve(result);
      },
      dbError(reject),
    );
  }));
}

function saveCache(uri, data, cTx) {
  return getTransaction(true, cTx)
  .then(tx => new Promise((resolve, reject) => {
    tx.executeSql(
      'REPLACE INTO cache(uri,data) VALUES(?,?)',
      [uri, data],
      () => { resolve(); },
      dbError(reject),
    );
  }));
}

function saveRequire(uri, code, cTx) {
  return getTransaction(true, cTx)
  .then(tx => new Promise((resolve, reject) => {
    tx.executeSql(
      'REPLACE INTO require(uri,data) VALUES(?,?)',
      [uri, code],
      () => { resolve(); },
      dbError(reject),
    );
  }));
}

export function saveScript(script, cTx) {
  if (!script.position) script.position = position.get();
  position.update(script.position);
  return getTransaction(true, cTx)
  .then(tx => new Promise((resolve, reject) => {
    const encoded = encodeScript(script);
    const fields = [
      'id',
      'uri',
      'meta',
      'custom',
      'enabled',
      'update',
      'position',
      'code',
    ];
    const sql = `REPLACE INTO scripts(${fields.map(field => `"${field}"`).join(',')}) VALUES(${placeholders(fields.length)})`;
    const args = fields.map(key => {
      const value = encoded[key];
      return value == null ? null : value;
    });
    tx.executeSql(sql, args, (t, res) => {
      script.id = script.id || res.insertId;
      resolve(script);
    }, dbError(reject));
  }));
}

const cacheRequests = {};
function fetchCache(url, check) {
  let promise = cacheRequests[url];
  if (!promise) {
    promise = request(url, { responseType: 'arraybuffer' })
    .then(({ data: buffer }) => {
      const data = {
        buffer,
        blob(options) {
          return new Blob([buffer], options);
        },
        string() {
          return buffer2string(buffer);
        },
        base64() {
          return window.btoa(data.string());
        },
      };
      if (check) return Promise.resolve(check(data)).then(() => data);
      return data;
    })
    .then(({ base64 }) => saveCache(url, base64()))
    .then(() => { delete cacheRequests[url]; });
    cacheRequests[url] = promise;
  }
  return promise;
}

const requireRequests = {};
function fetchRequire(url) {
  let promise = requireRequests[url];
  if (!promise) {
    promise = request(url)
    .then(({ data }) => saveRequire(url, data))
    .catch(() => { console.error(`Error fetching required script: ${url}`); })
    .then(() => { delete requireRequests[url]; });
    requireRequests[url] = promise;
  }
  return promise;
}

export function setValue(uri, values) {
  return getTransaction(true)
  .then(tx => new Promise((resolve, reject) => {
    tx.executeSql(
      'REPLACE INTO "values"(uri,data) VALUES(?,?)',
      [uri, JSON.stringify(values)],
      () => { resolve(); },
      dbError(reject),
    );
  }));
}

export function updateScriptInfo(id, data, custom) {
  return getTransaction(true)
  .then(tx => getScript(id, tx).then(script => new Promise((resolve, reject) => {
    if (!script) return reject();
    const update = Object.keys(data).reduce((res, key) => {
      if (key in script) {
        res[key] = data[key];
        script[key] = data[key];
      }
      return res;
    }, {});
    if (custom) update.custom = Object.assign(script.custom, custom);
    const encoded = encodeScript(update);
    const fields = Object.keys(encoded);
    const sql = `UPDATE scripts SET ${fields.map(field => `"${field}"=?`).join(',')} WHERE id=?`;
    const args = fields.map(key => encoded[key]).concat([id]);
    tx.executeSql(sql, args, () => { resolve(getScriptInfo(script)); }, dbError(reject));
  })));
}

export function getExportData(ids, withValues) {
  return getTransaction()
  .then(tx => loadScripts(tx).then(scripts => {
    const res = { scripts };
    if (withValues) {
      return getValues(scripts.map(script => script.uri), tx)
      .then(values => {
        res.values = values;
        return res;
      });
    }
    return res;
  }));
  function loadScripts(tx) {
    return getScript(ids, tx)
    .then(data => data.filter(Boolean));
  }
}

export function vacuum() {
  checkPosition();
  return getTransaction(true)
  .then(tx => loadScripts(tx).then(data => Promise.all([
    vacuumCache(tx, 'require', data.require),
    vacuumCache(tx, 'cache', data.cache),
    vacuumCache(tx, 'values', data.values),
  ]).then(() => ({
    require: data.require,
    cache: data.cache,
  }))))
  .then(data => Promise.all([
    Object.keys(data.require).map(k => data.require[k] === 1 && fetchRequire(k)),
    Object.keys(data.cache).map(k => data.cache[k] === 1 && fetchCache(k)),
  ]));

  function loadScripts(tx) {
    const data = {
      require: {},
      cache: {},
      values: {},
    };
    return getScriptsByIndex('position', null, tx, script => {
      const base = script.custom.lastInstallURL;
      script.meta.require.forEach(url => {
        const fullUrl = getFullUrl(url, base);
        data.require[fullUrl] = 1;
      });
      Object.keys(script.meta.resources).forEach(key => {
        const url = script.meta.resources[key];
        const fullUrl = getFullUrl(url, base);
        data.cache[fullUrl] = 1;
      });
      if (isRemote(script.meta.icon)) data.cache[script.meta.icon] = 1;
      data.values[script.uri] = 1;
    })
    .then(() => data);
  }
  function vacuumCache(tx, dbName, dict) {
    const deleteCache = uri => new Promise((resolve, reject) => {
      if (!dict[uri]) {
        tx.executeSql(
          `DELETE FROM "${dbName}" WHERE uri=?`,
          [uri],
          () => { resolve(); },
          dbError(reject),
        );
      } else {
        dict[uri] += 1;
        resolve();
      }
    });
    return new Promise((resolve, reject) => {
      tx.executeSql(`SELECT uri FROM "${dbName}"`, [], (t, res) => {
        const results = readSQLResult(res);
        resolve(results.reduce(
          (result, item) => result.then(() => deleteCache(item.uri)),
          Promise.resolve(),
        ));
      }, dbError(reject));
    });
  }
}

export function getScriptsByIndex(index, options, cTx, mapEach) {
  return getTransaction(false, cTx)
  .then(tx => new Promise((resolve, reject) => {
    const { condition = '', args = [] } = options || {};
    tx.executeSql(
      `SELECT * FROM scripts ${condition} ORDER BY "${index}"`,
      args,
      (t, res) => {
        let results = readSQLResult(res).map(transformScript);
        if (mapEach) results = results.map(mapEach);
        resolve(results);
      },
      dbError(reject),
    );
  }));
}

function updateProps(target, source) {
  if (source) {
    Object.keys(source).forEach(key => {
      if (key in target) target[key] = source[key];
    });
  }
  return target;
}

export function parseScript(data) {
  const meta = parseMeta(data.code);
  if (!meta.name) return Promise.reject(i18n('msgInvalidScript'));
  const res = {
    cmd: 'UpdateScript',
    data: {
      message: data.message == null ? i18n('msgUpdated') : data.message || '',
    },
  };
  function fetchResources(tx, base) {
    // @require
    meta.require.forEach(url => {
      const fullUrl = getFullUrl(url, base);
      const cache = data.require && data.require[fullUrl];
      if (cache) saveRequire(fullUrl, cache, tx);
      else fetchRequire(fullUrl);
    });
    // @resource
    Object.keys(meta.resources).forEach(k => {
      const url = meta.resources[k];
      const fullUrl = getFullUrl(url, base);
      const cache = data.resources && data.resources[fullUrl];
      if (cache) saveCache(fullUrl, cache, tx);
      else fetchCache(fullUrl);
    });
    // @icon
    if (isRemote(meta.icon)) {
      fetchCache(
        getFullUrl(meta.icon, base),
        ({ blob: getBlob }) => new Promise((resolve, reject) => {
          const blob = getBlob({ type: 'image/png' });
          const url = URL.createObjectURL(blob);
          const image = new Image();
          const free = () => URL.revokeObjectURL(url);
          image.onload = () => {
            free();
            resolve(blob);
          };
          image.onerror = () => {
            free();
            reject();
          };
          image.src = url;
        }),
      );
    }
  }
  return getTransaction(true)
  .then(tx => queryScript(data.id, meta, tx).then(result => {
    let script;
    if (result) {
      if (data.isNew) throw i18n('msgNamespaceConflict');
      script = result;
    } else {
      script = newScript();
      script.position = position.get();
      res.cmd = 'AddScript';
      res.data.message = i18n('msgInstalled');
    }
    updateProps(script, data.more);
    Object.assign(script.custom, data.custom);
    script.meta = meta;
    script.code = data.code;
    script.uri = getNameURI(script);
    // use referer page as default homepage
    if (!meta.homepageURL && !script.custom.homepageURL && isRemote(data.from)) {
      script.custom.homepageURL = data.from;
    }
    if (isRemote(data.url)) script.custom.lastInstallURL = data.url;
    fetchResources(tx, script.custom.lastInstallURL);
    script.custom.modified = data.modified || Date.now();
    return saveScript(script, tx);
  }))
  .then(script => {
    Object.assign(res.data, getScriptInfo(script));
    return res;
  });
}

function initPosition() {
  return getTransaction()
  .then(tx => new Promise((resolve, reject) => {
    tx.executeSql(
      'SELECT position FROM scripts ORDER BY position DESC LIMIT 1',
      [], (t, res) => {
        const result = readSQLResult(res)[0];
        if (result) position.set(result.position);
        resolve();
      }, dbError(reject),
    );
  }));
}

export function checkPosition(start) {
  const nStart = +start || 0;
  let offset = Math.max(1, nStart);
  const updates = [];
  let changed;
  if (!position.checking) {
    position.checking = getTransaction(true)
    .then(tx => (
      getScriptsByIndex('position', {
        condition: 'WHERE position >= ?',
        args: [nStart],
      }, tx, script => {
        if (script.position !== offset) updates.push({ id: script.id, position: offset });
        position.update(offset);
        offset += 1;
      })
      .then(() => {
        changed = updates.length;
        return update();
        function update() {
          const item = updates.shift();
          if (item) {
            return new Promise((resolve, reject) => {
              tx.executeSql(
                'UPDATE scripts SET position=? WHERE id=?',
                [item.position, item.id],
                () => { resolve(); },
                dbError(reject),
              );
            })
            .then(update);
          }
        }
      })
    ))
    .then(() => {
      browser.runtime.sendMessage({
        cmd: 'ScriptsUpdated',
      });
      position.checking = null;
    })
    .then(() => changed);
  }
  return position.checking;
}
