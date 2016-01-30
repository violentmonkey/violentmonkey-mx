var MenuBaseView = BaseView.extend({
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
