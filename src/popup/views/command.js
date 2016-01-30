var CommandsView = MenuBaseView.extend({
  initialize: function () {
    MenuBaseView.prototype.initialize.call(this);
    this.listenTo(commandsMenu, 'add', this.onCommandAdd);
  },
  _render: function () {
    if (!commandsMenu.length)
      return app.navigate('', {trigger: true, replace: true});
    var _this = this;
    _this.$el.html(_this.templateFn());
    var top = _this.$el.children().first();
    _this.addMenuItem({
      name: _.i18n('menuBack'),
      symbol: 'fa-arrow-left',
      onClick: function (e) {
        app.navigate('', {trigger: true});
      },
    }, top);
    commandsMenu.each(_this.onCommandAdd.bind(_this));
  },
  onCommandAdd: function (model) {
    var _this = this;
    var bot = _this.$el.children().last();
    _this.addMenuItem(model, bot);
  },
});
