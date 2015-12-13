var MenuView = MenuBaseView.extend({
  initialize: function () {
    MenuBaseView.prototype.initialize.call(this);
    this.listenTo(scriptsMenu, 'reset', this.render);
    this.listenTo(commandsMenu, 'reset', this.render);
  },
  _render: function () {
    var _this = this;
    _this.$el.html(_this.templateFn({
      hasSep: !!scriptsMenu.length
    }));
    var children = _this.$el.children();
    var top = children.first();
    var bot = children.last();
    _this.addMenuItem({
      name: _.i18n('menuManageScripts'),
      symbol: 'fa-hand-o-right',
      onClick: function (e) {
        function startsWith(str1, str2) {
          return str1.slice(0, str2.length) === str2;
        }
        var url = _.mx.rt.getPrivateUrl() + 'options/index.html';
        var confirm = url + '#confirm';
        for (var i = _.mx.br.tabs.length - 1; i --;) {
          var tab = _.mx.br.tabs.getTab(i);
          if (tab && startsWith(tab.url, url) && !startsWith(tab.url, confirm)) {
            tab.activate();
            return;
          }
        }
        _.mx.br.tabs.newTab({
          activate: true,
          url: url,
        });
      },
    }, top);
    var currentTab = _.mx.br.tabs.getCurrentTab();
    if (currentTab && /^https?:\/\//i.test(currentTab.url))
      _this.addMenuItem({
        name: _.i18n('menuFindScripts'),
        symbol: 'fa-hand-o-right',
        onClick: function (e) {
          var matches = currentTab.url.match(/:\/\/(?:www\.)?([^\/]*)/);
          _.mx.br.tabs.newTab({
            activate: true,
            url: 'https://greasyfork.org/scripts/search?q=' + matches[1],
          });
        },
      }, top);
    if (commandsMenu.length) _this.addMenuItem({
      name: _.i18n('menuCommands'),
      symbol: 'fa-arrow-right',
      onClick: function (e) {
        app.navigate('commands', {trigger: true});
      },
    }, top);
    _this.addMenuItem({
      name: _.i18n('menuScriptEnabled'),
      data: _.options.get('isApplied'),
      symbol: function (data) {
        return data ? 'fa-check' : 'fa-times';
      },
      onClick: function (e, model) {
        var isApplied = !model.get('data');
        _.options.set('isApplied', isApplied);
        model.set({data: isApplied});
        _.mx.rt.icon.setIconImage('icon' + (isApplied ? '' : 'w'));
      },
    }, top);
    scriptsMenu.each(function (item) {
      _this.addMenuItem(item, bot);
    });
  },
});
