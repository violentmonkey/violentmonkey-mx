define('views/TabAbout', function (require, _exports, module) {
  var BaseView = require('cache').BaseView;
  var app = require('app');

  module.exports = BaseView.extend({
    el: '#tab',
    name: 'about',
    templateUrl: '/options/templates/tab-about.html',
    initialize: function () {
      var _this = this;
      BaseView.prototype.initialize.call(_this);
      _this.listenTo(app.scriptList, 'reset', _this.render);
    },
    _render: function () {
      this.$el.html(this.templateFn({
        version: app.scriptList.app.version || '...',
      }));
    },
  });
});
