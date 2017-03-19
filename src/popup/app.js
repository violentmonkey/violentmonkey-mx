var _ = require('src/common');
_.initOptions();
var App = require('./views/app');
var utils = require('./utils');

new Vue({
  el: '#app',
  render: function (h) {
    return h(App);
  },
});

var handlers = {
  UpdateOptions: function (data) {
    _.options.update(data);
  },
};
browser.runtime.onMessage.addListener(function (req, src) {
  var func = handlers[req.cmd];
  if (func) return func(req.data, src);
});

!function () {
  function clear() {
    utils.store.scripts = [];
    utils.store.commands = [];
    utils.store.domains = [];
    delayedClear = null;
  }
  function cancelClear() {
    delayedClear && clearTimeout(delayedClear);
  }
  function delayClear() {
    cancelClear();
    delayedClear = setTimeout(clear, 200);
  }
  var init = _.debounce(function () {
    _.injectContent('setPopup()');
    delayClear();
  }, 100);
  var delayedClear;

  Object.assign(handlers, {
    GetPopup: init,
    SetPopup: function (data, currentTab) {
      cancelClear();
      utils.store.currentTab = currentTab;
      if (currentTab && /^https?:\/\//i.test(currentTab.url)) {
        var matches = currentTab.url.match(/:\/\/(?:www\.)?([^\/]*)/);
        var domain = matches[1];
        var domains = domain.split('.').reduceRight(function (res, part) {
          var last = res[0];
          if (last) part += '.' + last;
          res.unshift(part);
          return res;
        }, []);
        domains.length > 1 && domains.pop();
        utils.store.domains = domains;
      }
      utils.store.commands = data.menus;
      _.sendMessage({
        cmd: 'GetMetas',
        data: data.ids,
      }).then(function (scripts) {
        utils.store.scripts = scripts;
      });
    },
  });
  browser.tabs.onActivated.addListener(init);
  browser.tabs.onUpdated.addListener(init);
  init();
}();
