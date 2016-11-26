var app = require('../app');
var MixIn = require('./mixin');
var _ = require('../../common');

module.exports = {
  mixins: [MixIn],
  data: function () {
    var _this = this;
    return {
      top: [{
        name: _.i18n('menuManageScripts'),
        symbol: 'cog',
        onClick: function () {
          var url = _.mx.rt.getPrivateUrl() + 'options/index.html';
          var confirm = url + '#confirm';
          for (var i = _.mx.br.tabs.length - 1; i --;) {
            var tab = _.mx.br.tabs.getTab(i);
            if (tab && tab.url.startsWith(url) && !tab.url.startsWith(confirm)) {
              tab.activate();
              return;
            }
          }
          _.tabs.create(url);
        },
      }, {
        name: _.i18n('menuFindScripts'),
        symbol: 'search',
        hide: function () {
          var domains = this.store.domains;
          return !domains || !domains.length;
        },
        onClick: function () {
          var matches = _this.store.currentTab.url.match(/:\/\/(?:www\.)?([^\/]*)/);
          _.tabs.create('https://greasyfork.org/scripts/search?q=' + matches[1]);
        },
        detailClick: function () {
          app.navigate('Domains');
        },
      }, {
        name: _.i18n('menuCommands'),
        symbol: 'arrow-right',
        hide: function () {
          var commands = _this.store.commands;
          return !commands || !commands.length;
        },
        onClick: function () {
          app.navigate('Commands');
        },
      }, {
        name: null,
        symbol: null,
        disabled: null,
        init: function (options) {
          options.disabled = !_.options.get('isApplied');
          options.name = options.disabled ? _.i18n('menuScriptDisabled') : _.i18n('menuScriptEnabled');
          options.symbol = options.disabled ? 'remove' : 'check';
        },
        onClick: function (options) {
          _.options.set('isApplied', options.disabled);
          options.init.call(this, options);
          _.setIcon('icon' + (options.disabled ? 'w' : ''));
          _.options.get('autoReload') && _.mx.br.tabs.getCurrentTab().refresh();
        },
      }],
    };
  },
  computed: {
    bot: function () {
      var _this = this;
      return _this.store.scripts.map(function (script) {
        return {
          name: script.custom.name || _.getLocaleString(script.meta, 'name'),
          className: 'ellipsis',
          symbol: null,
          disabled: null,
          init: function (options) {
            options.disabled = !script.enabled;
            options.symbol = options.disabled ? 'remove' : 'check';
          },
          onClick: function (options) {
            var vm = this;
            _.sendMessage({
              cmd: 'UpdateScriptInfo',
              data: {
                id: script.id,
                enabled: !script.enabled,
              },
            }).then(function () {
              script.enabled = !script.enabled;
              options.init.call(vm, options);
              _.options.get('autoReload') && _.mx.br.tabs.getCurrentTab().refresh();
            });
          },
        };
      });
    },
  },
};
