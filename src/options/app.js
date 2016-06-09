define('app', function (require, exports, _module) {
  var MainView = require('views/Main');
  var ConfirmView = require('views/Confirm');
  var MessageView = require('views/Message');
  var models = require('models');
  var cache = require('cache');
  zip.workerScriptsPath = '/lib/zip.js/';

  _.sendMessage = _.getMessenger({});
  _.showMessage = function (options) {
    new MessageView(options);
  };

  var App = cache.BaseRouter.extend({
    routes: {
      '': 'renderMain',
      'main/:tab': 'renderMain',
      'confirm/:url': 'renderConfirm',
      'confirm/:url/:from': 'renderConfirm',
    },
    renderMain: function (tab) {
      this.loadView('main', function () {
        initMain();
        return new MainView;
      }).loadTab(tab);
    },
    renderConfirm: function (url, referer) {
      this.loadView('confirm', function () {
        return new ConfirmView;
      }).initData(url, referer);
    },
  });
  var app = new App('#app');
  Backbone.history.start() || app.navigate('', {trigger: true, replace: true});

  $(document).on('click', '[data-feature]', function (e) {
    var target = e.currentTarget;
    _.features.hit(target.dataset.feature);
    target.classList.remove('feature');
  });

  function initMain() {
    var scriptList = exports.scriptList = new models.ScriptList;
    var syncData = exports.syncData = new models.SyncList;
    _.mx.rt.listen('UpdateItem', function (res) {
      switch (res.cmd) {
      case 'sync':
        syncData.set(res.data);
        break;
      case 'add':
        res.data.message = '';
        scriptList.push(res.data);
        break;
      case 'update':
        if (res.data) {
          var model = scriptList.get(res.data.id);
          if (model) model.set(res.data);
        }
        break;
      case 'del':
        scriptList.remove(res.data);
      }
    });
  }
});
