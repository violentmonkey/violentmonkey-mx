!function (win) {
  function getUniqId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function initMessageListener() {
    if (onMessageListeners) return;
    onMessageListeners = [];
    rt.listen(EXTENSION, function (res) {
      function sendResponse(data) {
        if (!callback) throw 'Already called!';
        rt.post(source.id, {
          callback: callback,
          data: data,
        });
        callback = null;
      }
      var source = res.source;
      var callback = res.callback;
      var data = res.data;
      onMessageListeners.forEach(function (listener) {
        var result = listener(data, source);
        if (result && typeof result.then === 'function') {
          result.then(function (data) {
            sendResponse({data: data});
          }, function (err) {
            sendResponse({error: err});
          });
        } else if (typeof result !== 'undefined') {
          sendResponse({data: result});
        }
      });
    });
  }
  function initSendMessage() {
    if (promises) return;
    promises = {};
    rt.listen(sourceId, function (res) {
      if (!res) return;
      if (res.callback) {
        var promise = promises[res.callback];
        delete promises[res.callback];
        promise && promise.resolve(res.data);
      }
    });
  }
  function initTabsEvents() {
    if (onTabsUpdatedListeners) return;
    onTabsUpdatedListeners = [];
    onTabsActivatedListeners = [];
    br.onBrowserEvent = function (data) {
      if (~[
        'ON_NAVIGATE',
        // It seems that ON_NAVIGATE is not triggered for 302
        // PAGE_LOADED is triggered after URL redirected
        'PAGE_LOADED',
      ].indexOf(data.type)) {
        onTabsUpdatedListeners.forEach(function (listener) {
          listener(data.id, data);
        });
      }
      if (data.type === 'TAB_SWITCH') {
        onTabsActivatedListeners.forEach(function (listener) {
          listener({
            tabId: data.to,
          });
        });
      }
    };
  }
  function updateBadge() {
    var text = badges[currentTabId] || '';
    rt.icon.showBadge(text);
  }
  if (typeof browser === 'undefined') {
    var EXTENSION = 'EXTENSION';
    var rt = window.external.mxGetRuntime();
    var br = rt.create('mx.browser');
    var ui = rt.create('mx.app.ui');
    var sourceId = 'RUNTIME_' + getUniqId();
    var promises;
    var onMessageListeners;
    var onNotificationClickListeners = [];
    var onNotificationCloseListeners = [];
    var onTabsUpdatedListeners, onTabsActivatedListeners;
    var manifest = {/*= manifest */};
    var badges = {};
    var currentTabId;
    win.browser = {
      browserAction: {
        setBadgeText: function (data) {
          badges[data.tabId] = data.text;
          updateBadge();
        },
        setIcon: function (icon) {
          rt.icon.setIconImage(icon);
          var toolbarIcon = ui && ui.getEntryPointByActionName && ui.getEntryPointByActionName('icon', 'toolbar');
          toolbarIcon && toolbarIcon.setIconImage(icon);
        },
      },
      i18n: {
        getMessage: function (name, args) {
          var message = rt.locale.t(name);
          if (/^".*"$/.test(message)) try {
            message = JSON.parse(message);
          } catch (e) {
            message = message.slice(1, -1);
          }
          if (typeof args === 'string') args = [args];
          var data = message.replace(/\$(?:\{(\d+)\}|(\d+))/g, function (match, group1, group2) {
            var arg = args[group1 || group2];
            return arg || '';
          });
          return data;
        },
      },
      notifications: {
        create: function (id, data) {
          function show() {
            var notice = new Notification(data.title, {
              body: data.message,
              icon: data.iconUrl,
            });
            if (data.isClickable) {
              notice.onclick = function () {
                onNotificationClickListeners.forEach(function (listener) {
                  listener(id);
                });
              };
              notice.onclose = function () {
                onNotificationCloseListeners.forEach(function (listener) {
                  listener(id);
                });
              };
            }
          }
          if (typeof id === 'object') {
            data = id;
            id = getUniqId();
          }
          return new Promise(function (resolve, reject) {
            if (Notification.permission == 'granted') {
              show();
              resolve(id);
            } else Notification.requestPermission(function (e) {
              if (e == 'granted') {
                show();
                resolve(id);
              } else {
                console.warn('Notification: ' + data.message);
                reject();
              }
            });
          });
        },
        onClicked: {
          addListener: function (listener) {
            onNotificationClickListeners.push(listener);
          },
        },
        onClosed: {
          addListener: function (listener) {
            onNotificationCloseListeners.push(listener);
          },
        },
      },
      runtime: {
        getManifest: function () {
          return manifest;
        },
        getURL: function (path) {
          var base = rt.getPrivateUrl();
          path = path || '';
          if (path.startsWith('/')) path = path.slice(1);
          return base + path;
        },
        onMessage: {
          addListener: function (listener) {
            initMessageListener();
            onMessageListeners.push(listener);
          },
        },
        sendMessage: function (data) {
          initSendMessage();
          return new Promise(function (resolve, reject) {
            var callback = 'CALLBACK_' + getUniqId();
            promises[callback] = {
              resolve: resolve,
              reject: reject,
            };
            rt.post(EXTENSION, {
              source: {
                id: sourceId,
                url: location.href,
              },
              callback: callback,
              data: data,
            });
          });
        },
      },
      tabs: {
        create: function (data) {
          br.tabs.newTab({
            url: data.url,
            activate: data.active == null ? true : data.active,
          });
        },
        get: function (id) {
          return Promise.resolve(br.tabs.getTabById(id));
        },
        update: function (id, data) {
          var tab;
          if (typeof id === 'object') {
            data = id;
            tab = br.tabs.getCurrentTab();
          } else {
            tab = br.tabs.getTabById(id);
          }
          if (tab) {
            data.active && tab.activate();
            data.url && tab.navigate(data.url);
          }
          return Promise.resolve(tab);
        },
        remove: function (id) {
          var tab = br.tabs.getTabById(id);
          tab && tab.close();
        },
        sendMessage: function (target, data) {
          rt.post(target, data);
        },
        query: function (options) {
          var tabs = [];
          if (options && options.active) {
            tabs.push(br.tabs.getCurrentTab());
          } else {
            for (var i = 0; i < br.tabs.length; i++) {
              tabs.push(br.tabs.getTab(i));
            }
          }
          return Promise.resolve(tabs);
        },
        onActivated: {
          addListener: function (listener) {
            initTabsEvents();
            onTabsActivatedListeners.push(listener);
          },
        },
        onUpdated: {
          addListener: function (listener) {
            initTabsEvents();
            onTabsUpdatedListeners.push(listener);
          },
        },
      },
    };
    win.browser.tabs.onActivated.addListener(function (data) {
      currentTabId = data.tabId;
      updateBadge();
    });
  }
}(this);
