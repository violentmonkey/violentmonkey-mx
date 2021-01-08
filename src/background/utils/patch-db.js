import { parseMeta } from './script';

export default () => new Promise((resolve, reject) => {
  console.info('Upgrade database...');
  init();
  function init() {
    const db = window.openDatabase('Violentmonkey', '0.5', 'Violentmonkey data', 10 * 1024 * 1024);
    db.transaction(transform, dbError);
  }
  function dbError(t, e) {
    reject(e);
  }
  function handleResult(callback) {
    return (_, res) => {
      const data = [];
      for (let i = 0; i < res.rows.length; i += 1) {
        const item = res.rows.item(i);
        data.push(Object.assign({}, item));
      }
      callback(data);
    };
  }
  function transformScript(script) {
    const item = {
      script: {
        meta: parseMeta(script.code),
        custom: Object.assign({
          origInclude: true,
          origExclude: true,
          origMatch: true,
          origExcludeMatch: true,
        }, JSON.parse(script.custom)),
        props: {
          id: script.id,
          uri: script.uri,
          position: script.position,
        },
        config: {
          enabled: script.enabled,
          shouldUpdate: script.update,
        },
      },
      code: script.code,
    };
    return item;
  }
  function transform(tx) {
    const updates = {};
    let processing = 3;
    const onCallback = () => {
      processing -= 1;
      if (!processing) resolve(browser.storage.local.set(updates));
    };
    getAllScripts(tx, items => {
      const uriMap = {};
      items.forEach(({ script, code }) => {
        updates[`scr:${script.props.id}`] = script;
        updates[`code:${script.props.id}`] = code;
        uriMap[script.props.uri] = script.props.id;
      });
      getAllValues(tx, data => {
        data.forEach(({ id, values }) => {
          updates[`val:${id}`] = values;
        });
        onCallback();
      }, uriMap);
    });
    getAllCache(tx, cache => {
      cache.forEach(({ uri, data }) => {
        updates[`cac:${uri}`] = data;
      });
      onCallback();
    });
    getAllRequire(tx, data => {
      data.forEach(({ uri, data: code }) => {
        updates[`req:${uri}`] = code;
      });
      onCallback();
    });
  }
  function getAllScripts(tx, callback) {
    tx.executeSql('SELECT * FROM scripts', [], handleResult(items => {
      callback(items.map(transformScript));
    }), dbError);
  }
  function getAllValues(tx, callback, uriMap) {
    tx.executeSql('SELECT uri,data FROM "values"', [], handleResult(items => {
      const values = items.map(({ uri, data }) => {
        const id = uriMap[uri];
        if (id) return { id, values: JSON.parse(data) };
        return null;
      })
      .filter(Boolean);
      callback(values);
    }), dbError);
  }
  function getAllCache(tx, callback) {
    tx.executeSql('SELECT uri,data FROM cache', [], handleResult(items => {
      callback(items);
    }), dbError);
  }
  function getAllRequire(tx, callback) {
    tx.executeSql('SELECT uri,data FROM require', [], handleResult(items => {
      callback(items);
    }), dbError);
  }
})
// Ignore error
.catch(() => {});
