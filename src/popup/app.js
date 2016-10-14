var Menu = require('./views/menu');
var Commands = require('./views/command');
var Domains = require('./views/domain');
var utils = require('./utils');
var _ = require('../common');

var app = new Vue({
  el: '#app',
  template: '<component :is=type></component>',
  components: {
    Menu: Menu,
    Commands: Commands,
    Domains: Domains,
  },
  data: {
    type: 'Menu',
  },
  methods: {
    navigate: function (type) {
      this.type = type || 'Menu';
    },
  },
});

exports.navigate = app.navigate.bind(app);

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

  var commands = {
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
  };
  _.sendMessage = _.getMessenger({});
  _.mx.rt.listen('Popup', function (req) {
    var func = commands[req.cmd];
    if (func) func(req.data, req.src);
  });

  init();
  _.mx.br.onBrowserEvent = function (data) {
    switch (data.type) {
    case 'TAB_SWITCH':
    case 'ON_NAVIGATE':
      init();
    }
  };
}();
