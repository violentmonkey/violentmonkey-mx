var AboutTab = BaseView.extend({
  el: '#tab',
  name: 'about',
  templateUrl: '/options/templates/tab-about.html',
  initialize: function () {
    var _this = this;
    BaseView.prototype.initialize.call(_this);
    _this.listenTo(scriptList, 'reset', _this.render);
  },
  _render: function () {
    this.$el.html(this.templateFn({
      version: scriptList.app.version || '...',
    }));
  },
});
