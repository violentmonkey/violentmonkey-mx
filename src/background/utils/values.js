import { getValueStoresByIds, dumpValueStores, dumpValueStore } from './db';
import { broadcast } from '.';

// const openers = {}; // scriptId: { openerId: 1, ... }
// const tabScripts = {}; // openerId: { scriptId: 1, ... }
let cache;
let timer;

// // REQUIRE tabId
// browser.tabs.onRemoved.addListener(id => {
//   resetValueOpener(id);
// });

export function updateValueStore(id, update) {
  updateLater();
  const { key, value } = update;
  if (!cache) cache = {};
  let updates = cache[id];
  if (!updates) {
    updates = {};
    cache[id] = updates;
  }
  updates[key] = value || null;
}

export function setValueStore(where, value) {
  return dumpValueStore(where, value)
  .then(broadcastUpdates);
}

export function resetValueOpener() {}
// export function resetValueOpener(openerSrcId) {
//   const scriptMap = tabScripts[openerSrcId];
//   if (scriptMap) {
//     Object.keys(scriptMap).forEach(scriptId => {
//       const map = openers[scriptId];
//       if (map) delete map[openerSrcId];
//     });
//     delete tabScripts[openerSrcId];
//   }
// }

export function addValueOpener() {}
// export function addValueOpener(openerSrcId, scriptIds) {
//   let scriptMap = tabScripts[openerSrcId];
//   if (!scriptMap) {
//     scriptMap = {};
//     tabScripts[openerSrcId] = scriptMap;
//   }
//   scriptIds.forEach(scriptId => {
//     scriptMap[scriptId] = 1;
//     let openerMap = openers[scriptId];
//     if (!openerMap) {
//       openerMap = {};
//       openers[scriptId] = openerMap;
//     }
//     openerMap[openerSrcId] = 1;
//   });
// }

function updateLater() {
  if (!timer) {
    timer = Promise.resolve().then(doUpdate);
    // timer = setTimeout(doUpdate);
  }
}

function doUpdate() {
  const currentCache = cache;
  cache = null;
  const ids = Object.keys(currentCache);
  getValueStoresByIds(ids)
  .then(valueStores => {
    ids.forEach(id => {
      const valueStore = valueStores[id] || {};
      valueStores[id] = valueStore;
      const updates = currentCache[id] || {};
      Object.keys(updates).forEach(key => {
        const value = updates[key];
        if (!value) delete valueStore[key];
        else valueStore[key] = value;
      });
    });
    return dumpValueStores(valueStores);
  })
  .then(broadcastUpdates)
  .then(() => {
    timer = null;
    if (cache) updateLater();
  });
}

function broadcastUpdates(updates) {
  if (updates) {
    broadcast({
      cmd: 'UpdatedValues',
      data: updates,
    });
    // const updatedOpeners = Object.keys(updates)
    // .reduce((map, scriptId) => Object.assign(map, openers[scriptId]), {});
    // Object.keys(updatedOpeners).forEach(openerSrcId => {
    //   browser.__send(openerSrcId, {
    //     cmd: 'UpdatedValues',
    //     data: updates,
    //   });
    // });
  }
}
