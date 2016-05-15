define('views/Base', function (require, _exports, module) {
  var BaseView = require('cache').BaseView;
  var MenuItemView = require('views/MenuItem');
  var models = require('models');
  var MenuItem = models.MenuItem;

  module.exports = BaseView.extend({
    el: '#popup',
    templateUrl: '/popup/templates/menu.html',
    addMenuItem: function (obj, parent, nextSibling) {
      if (!(obj instanceof MenuItem)) obj = new MenuItem(obj);
      var view = new MenuItemView({model: obj});
      if (nextSibling) view.$el.insertBefore(nextSibling);
      else parent.append(view.$el);
      return view;
    },
  });
});
