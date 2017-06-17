import './polyfills';

const global = window;

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
    },
    set(data) {
      badges.init();
      return badges.set(data);
    },
  };

  const tabEvents = {
    init() {
      const updatedListeners = [];
      const activatedListeners = [];
      tabEvents.update = listener => { updatedListeners.push(listener); };
      tabEvents.activate = listener => { activatedListeners.push(listener); };
      br.onBrowserEvent = data => {
        if ([
          'ON_NAVIGATE',
          // It seems that ON_NAVIGATE is not triggered for 302
          // PAGE_LOADED is triggered after URL redirected
          'PAGE_LOADED',
        ].indexOf(data.type) >= 0) {
          updatedListeners.forEach(listener => {
            listener(data.id, data);
          });
        }
        if (data.type === 'TAB_SWITCH') {
          activatedListeners.forEach(listener => {
            listener({ tabId: data.to });
          });
        }
      };
    },
    update(listener) {
      tabEvents.init();
      return tabEvents.update(listener);
    },
    activate(listener) {
      tabEvents.init();
      return tabEvents.activate(listener);
    },
  };

  const messenger = {
    data: {},
    ensureTabId() {
      const tabIdPromise = new Promise(resolve => {
        window.setTabId = tabId => {
          messenger.data.tabId = tabId;
          resolve();
        };
      });
      messenger.ensureTabId = () => tabIdPromise;
    },
    init() {
      const onMessageListeners = [];
      const promises = {};
      messenger.listen = listener => { onMessageListeners.push(listener); };
      messenger.send = (target, data) => {
        const promise = new Promise((resolve, reject) => {
          const callback = `CALLBACK_${getUniqId()}`;
          promises[callback] = { resolve, reject };
          rt.post(target, {
            source: {
              id: sourceId,
              callback,
              tab: {
                id: messenger.data.tabId,
                url: location.href,
              },
            },
            data,
          });
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
        const { source } = res;
        if (source.id === sourceId) return; // ignore message from self
        let { callback } = source;
        const sendResponse = data => {
          if (!callback) throw new Error('Already called!');
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
  messenger.ensureTabId();

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
        const args = typeof arg === 'string' ? [arg] : arg;
        const data = message.replace(/\$(?:\{(\d+)\}|(\d+))/g, (_match, group1, group2) => {
          const index = (group1 || group2) - 1;
          const value = args[index];
          return value || '';
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
      onMessage: {
        addListener(listener) {
          return messenger.listen(listener);
        },
      },
      sendMessage(data) {
        return messenger.send(EXTENSION, data);
      },
    },
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
        return Promise.resolve(br.tabs.getTabById(id));
      },
      update(...args) {
        let [id, data] = args;
        let tab;
        if (typeof id === 'object') {
          data = id;
          id = null;
          tab = br.tabs.getCurrentTab();
        } else {
          tab = br.tabs.getTabById(id);
        }
        if (tab) {
          if (data.active) tab.activate();
          if (data.url) tab.navigate(data.url);
        }
        return Promise.resolve(tab);
      },
      remove(id) {
        const tab = br.tabs.getTabById(id);
        if (tab) tab.close();
      },
      sendMessage(target, data) {
        messenger.send(target, data);
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
    },
  };
  browser.__patched = true;
  browser.__ensureTabId = () => messenger.ensureTabId();
  global.browser = browser;
}

function getUniqId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
