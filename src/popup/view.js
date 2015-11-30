var MenuItemView = BaseView.extend({
  className: 'menu-item',
  templateUrl: '/popup/templates/menuitem.html',
  events: {
    'click': 'onClick',
  },
  initialize: function () {
    BaseView.prototype.initialize.call(this);
    this.listenTo(this.model, 'change', this.render);
  },
  render: function () {
    var it = this.model.toJSON();
    if (typeof it.symbol === 'function')
      it.symbol = it.symbol(it.data);
    this.$el.html(this.templateFn(it))
    .attr('title', it.title === true ? it.name : it.title);
    if (it.data === false) this.$el.addClass('disabled');
    else this.$el.removeClass('disabled');
  },
  onClick: function (e) {
    var onClick = this.model.get('onClick');
    onClick && onClick(e, this.model);
  },
})

var MenuBaseView = BaseView.extend({
  el: '#popup',
  templateUrl: '/popup/templates/menu.html',
  addMenuItem: function (obj, parent) {
    if (!(obj instanceof MenuItem)) obj = new MenuItem(obj);
    var item = new MenuItemView({model: obj});
    parent.append(item.$el);
  },
});

var MenuView = MenuBaseView.extend({
  initialize: function () {
    MenuBaseView.prototype.initialize.call(this);
    this.listenTo(scriptsMenu, 'reset', this.render);
    this.listenTo(commandsMenu, 'reset', this.render);
  },
  render: function () {
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

var CommandsView = MenuBaseView.extend({
  initialize: function () {
    MenuBaseView.prototype.initialize.call(this);
    this.listenTo(commandsMenu, 'reset', this.render);
  },
  render: function () {
    if (!commandsMenu.length)
      return app.navigate('', {trigger: true, replace: true});
    var _this = this;
    _this.$el.html(_this.templateFn({
      hasSep: true
    }));
    var children = _this.$el.children();
    var top = children.first();
    var bot = children.last();
    _this.addMenuItem({
      name: _.i18n('menuBack'),
      symbol: 'fa-arrow-left',
      onClick: function (e) {
        app.navigate('', {trigger: true});
      },
    }, top);
    commandsMenu.each(function (item) {
      _this.addMenuItem(item, bot);
    });
  },
});
