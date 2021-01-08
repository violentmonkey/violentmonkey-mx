import 'src/common/polyfills';
import { injectContent } from 'src/common';

if (typeof browser === 'undefined') {
  const EXTENSION = 'EXTENSION';
  const CONTENT = 'CONTENT';
  const rt = global.external.mxGetRuntime();
  const br = rt && rt.create('mx.browser');
  const ui = rt && rt.create('mx.app.ui');
  const sourceId = `RUNTIME_${getUniqId()}`;
  const onNotificationClickListeners = [];
  const onNotificationCloseListeners = [];
  const manifest = process.env.manifest;

  // Maxthon sucks
  // Bug: tab.id is a number, but getTabById requires a string
  const getTabById = id => br.tabs.getTabById(id.toString());

  const badges = {
    init() {
      const data = {};
      let currentTabId;
      const update = () => {
        const text = data[currentTabId] || '';
        rt.icon.showBadge(text);
      };
      badges.set = ({ tabId, text }) => {
        data[tabId] = text;
        update();
      };
      // global.browser.browserAction.setBadgeText = setBadgeText;
      global.browser.tabs.onActivated.addListener(({ tabId }) => {
        currentTabId = tabId;
        update();
      });
      global.browser.tabs.onRemoved.addListener(tabId => {
        delete data[tabId];
      });
    },
    set(data) {
      badges.init();
      return badges.set(data);
    },
  };

  const tabEvents = {};
  const updatedListeners = [];
  const activatedListeners = [];
  const removedListeners = [];
  tabEvents.update = listener => { updatedListeners.push(listener); };
  tabEvents.activate = listener => { activatedListeners.push(listener); };
  tabEvents.remove = listener => { removedListeners.push(listener); };
  br.onBrowserEvent = data => {
    const { type } = data;
    if (type === 'ON_NAVIGATE') {
      // ON_NAVIGATE is not triggered for 302
      updatedListeners.forEach(listener => {
        listener(data.id, data);
      });
    } else if (type === 'PAGE_LOADED') {
      // PAGE_LOADED is triggered after URL redirected
      const tab = getTabById(data.id);
      updatedListeners.forEach(listener => {
        listener(data.id, tab);
      });
    } else if (type === 'TAB_SWITCH') {
      activatedListeners.forEach(listener => {
        listener({ tabId: data.to });
      });
    } else if (type === 'PAGE_CLOSED') {
      removedListeners.forEach(listener => {
        listener(data.id);
      });
    }
  };

  const messenger = {
    data: {},
    initTabId() {
      messenger.tabIdPromise = new Promise(resolve => {
        window.setTabId = tabId => {
          messenger.data.tabId = tabId;
          resolve();
        };
      });
    },
    ensureTabId() {
      messenger.ensureTabId = () => messenger.tabIdPromise;
      // if (!messenger.data.tabId) global.browser.runtime.sendMessage({ cmd: 'GetTabId' });
      return messenger.tabIdPromise;
    },
    init() {
      const onMessageListeners = [];
      const promises = {};
      messenger.listen = listener => { onMessageListeners.push(listener); };
      messenger.send = (target, data, isTab) => {
        const promise = new Promise((resolve, reject) => {
          const callback = `CALLBACK_${getUniqId()}`;
          promises[callback] = { resolve, reject };
          const payload = {
            source: {
              id: sourceId,
              callback,
              tab: {
                id: messenger.data.tabId,
                url: window.location.href,
              },
            },
            data,
          };
          if (isTab) {
            injectContent(`handleTabMessage(${JSON.stringify(payload)})`, target);
            resolve();
          } else {
            rt.post(target, payload);
          }
        })
        .then(res => {
          if (res && res.error) throw res.error;
          return res && res.data;
        });
        promise.catch(err => {
          if (process.env.DEBUG) console.warn(err);
        });
        return promise;
      };
      const onMessage = res => {
        if (process.env.DEBUG) {
          console.info('receive', res);
        }
        const { source } = res;
        if (source.id === sourceId) return; // ignore message from self
        let { callback } = source;
        const sendResponse = data => {
          if (!callback) throw new Error('Already called!');
          if (process.env.DEBUG) {
            console.info('send', data);
          }
          rt.post(source.id, { callback, data });
          callback = null;
        };
        onMessageListeners.forEach(listener => {
          const result = listener(res.data, source);
          if (result && typeof result.then === 'function') {
            result.then(data => {
              sendResponse({ data });
            }, error => {
              console.error(error);
              sendResponse({ error });
            });
          } else if (typeof result !== 'undefined') {
            sendResponse({ data: result });
          }
        });
      };
      rt.listen(global.browser.__isContent ? CONTENT : EXTENSION, onMessage);
      rt.listen(sourceId, res => {
        if (res && res.callback) {
          const promise = promises[res.callback];
          delete promises[res.callback];
          if (promise) promise.resolve(res.data);
        } else onMessage(res);
      });
    },
    listen(...args) {
      messenger.init();
      return messenger.listen(...args);
    },
    send(...args) {
      messenger.init();
      return messenger.send(...args);
    },
  };
  messenger.initTabId();

  const storage = {
    local: {},
  };
  {
    const STORE_NAME = 'data';
    const READWRITE = 'readwrite';
    const getErrorHandler = reject => e => reject(e.target.error.message);
    const ready = new Promise((resolve, reject) => {
      const req = indexedDB.open('Violentmonkey', 1);
      req.onsuccess = e => {
        resolve(e.target.result);
      };
      req.onerror = getErrorHandler(reject);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      };
    });
    storage.local.get = arg => ready.then(db => new Promise((resolve, reject) => {
      const objectStore = db.transaction(STORE_NAME).objectStore(STORE_NAME);
      const results = {};
      if (!arg) {
        // get all values
        const req = objectStore.openCursor();
        req.onsuccess = e => {
          const cursor = e.target.result;
          if (cursor) {
            const { key, value } = cursor.value;
            results[key] = value;
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        req.onerror = getErrorHandler(reject);
      } else {
        let keys;
        let defaults = {};
        if (Array.isArray(arg)) keys = arg;
        else if (typeof arg === 'string') keys = [arg];
        else {
          keys = Object.keys(arg);
          defaults = arg;
        }
        let progress = 0;
        let onReject = getErrorHandler(reject);
        const onError = e => {
          if (onReject) {
            onReject(e);
            onReject = null;
          }
        };
        const checkResolve = () => {
          if (!progress) resolve(results);
        };
        keys.forEach(key => {
          progress += 1;
          const req = objectStore.get(key);
          req.onsuccess = e => {
            const { result } = e.target;
            results[key] = result ? result.value : defaults[key];
            progress -= 1;
            checkResolve();
          };
          req.onerror = onError;
        });
        checkResolve();
      }
    }));
    storage.local.set = data => ready.then(db => new Promise((resolve, reject) => {
      const objectStore = db.transaction(STORE_NAME, READWRITE).objectStore(STORE_NAME);
      const updates = Object.keys(data).map(key => ({ key, value: data[key] }));
      const onError = getErrorHandler(reject);
      const doUpdate = () => {
        const item = updates.shift();
        if (item) {
          const req = objectStore.put(item);
          req.onsuccess = doUpdate;
          req.onerror = onError;
        } else {
          resolve();
        }
      };
      doUpdate();
    }));
    storage.local.remove = arg => ready.then(db => new Promise((resolve, reject) => {
      const keys = Array.isArray(arg) ? arg : [arg];
      const objectStore = db.transaction(STORE_NAME, READWRITE).objectStore(STORE_NAME);
      const onError = getErrorHandler(reject);
      const doRemove = () => {
        const key = keys.shift();
        if (key) {
          const req = objectStore.delete(key);
          req.onsuccess = doRemove;
          req.onerror = onError;
        } else {
          resolve();
        }
      };
      doRemove();
    }));
    storage.local.clear = () => ready.then(db => new Promise((resolve, reject) => {
      const objectStore = db.transaction(STORE_NAME, READWRITE).objectStore(STORE_NAME);
      const req = objectStore.clear();
      req.onsuccess = resolve;
      req.onerror = getErrorHandler(reject);
    }));
  }

  const browser = {
    browserAction: {
      setBadgeText(data) {
        badges.set(data);
      },
      setIcon(icon) {
        rt.icon.setIconImage(icon);
        const toolbarIcon = ui && ui.getEntryPointByActionName && ui.getEntryPointByActionName('icon', 'toolbar');
        if (toolbarIcon) toolbarIcon.setIconImage(icon);
      },
    },
    i18n: {
      getMessage(name, arg) {
        let message = rt.locale.t(name);
        if (/^".*"$/.test(message)) {
          try {
            message = JSON.parse(message);
          } catch (e) {
            message = message.slice(1, -1);
          }
        }
        const args = Array.isArray(arg) ? arg : [arg || ''];
        const data = message.replace(/\$(?:\{(\d+)\}|(\d+))/g, (_match, group1, group2) => {
          const index = (group1 || group2) - 1;
          const value = args[index];
          return value == null ? '' : value;
        });
        return data;
      },
    },
    notifications: {
      create(...args) {
        let [id, data] = args;
        if (typeof id === 'object') {
          data = id;
          id = getUniqId();
        }
        return new Promise((resolve, reject) => {
          if (Notification.permission === 'granted') {
            show();
            resolve(id);
          } else {
            Notification.requestPermission(e => {
              if (e === 'granted') {
                show();
                resolve(id);
              } else {
                console.warn(`Notification: ${data.message}`);
                reject();
              }
            });
          }
        });
        function show() {
          const notice = new Notification(data.title, {
            body: data.message,
            icon: data.iconUrl,
          });
          const revoker = setTimeout(() => {
            // Auto close should not emit close events
            notice.onclose = null;
            notice.close();
          }, 10000);
          notice.onclick = () => {
            onNotificationClickListeners.forEach(listener => { listener(id); });
            setTimeout(() => { notice.close(); });
          };
          notice.onclose = () => {
            clearTimeout(revoker);
            onNotificationCloseListeners.forEach(listener => { listener(id); });
          };
        }
      },
      onClicked: {
        addListener(listener) {
          onNotificationClickListeners.push(listener);
        },
      },
      onClosed: {
        addListener(listener) {
          onNotificationCloseListeners.push(listener);
        },
      },
    },
    runtime: {
      getManifest() { return manifest; },
      getURL(path) {
        const base = rt.getPrivateUrl();
        let relpath = path || '';
        if (relpath.startsWith('/')) relpath = relpath.slice(1);
        return base + relpath;
      },
      openOptionsPage() {
        const url = browser.runtime.getURL(browser.runtime.getManifest().config);
        return browser.tabs.query({
          url,
          currentWindow: true,
        })
        .then(([optionsTab]) => {
          if (optionsTab) browser.tabs.update(optionsTab.id, { active: true });
          else browser.tabs.create({ url });
        });
      },
      onMessage: {
        addListener(listener) {
          return messenger.listen(listener);
        },
      },
      sendMessage(data) {
        return messenger.send(EXTENSION, data);
      },
    },
    storage,
    tabs: {
      create(data) {
        return new Promise((resolve, reject) => {
          br.tabs.newTab({
            url: data.url,
            activate: data.active == null ? true : data.active,
          }, tab => {
            if (tab) resolve(tab);
            else reject();
          });
        });
      },
      get(id) {
        return Promise.resolve(getTabById(id));
      },
      update(...args) {
        let [id, data] = args;
        let tab;
        if (typeof id === 'object') {
          data = id;
          id = null;
          tab = br.tabs.getCurrentTab();
        } else {
          tab = getTabById(id);
        }
        if (tab) {
          if (data.active) tab.activate();
          if (data.url) tab.navigate(data.url);
        }
        return Promise.resolve(tab);
      },
      reload(id) {
        const tab = getTabById(id);
        if (tab) tab.refresh();
      },
      remove(id) {
        const tab = getTabById(id);
        if (tab) tab.close();
      },
      sendMessage(tabId, data) {
        messenger.send(tabId, data, true);
      },
      query(options) {
        const tabs = [];
        if (options && options.active) {
          tabs.push(br.tabs.getCurrentTab());
        } else {
          for (let i = 0; i < br.tabs.length; i += 1) {
            const tab = br.tabs.getTab(i);
            if (!options.url || options.url === tab.url.split('#')[0]) tabs.push(tab);
          }
        }
        return Promise.resolve(tabs);
      },
      onActivated: {
        addListener(listener) {
          tabEvents.activate(listener);
        },
      },
      onUpdated: {
        addListener(listener) {
          tabEvents.update(listener);
        },
      },
      onRemoved: {
        addListener(listener) {
          tabEvents.remove(listener);
        },
      },
    },
  };
  browser.__patched = true;
  browser.__ensureTabId = () => messenger.tabIdPromise;
  browser.__send = (target, data) => messenger.send(target, data);
  global.browser = browser;
}

function getUniqId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
