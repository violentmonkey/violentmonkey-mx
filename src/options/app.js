define('app', function (require, exports, _module) {
  var MainView = require('views/Main');
  var ConfirmView = require('views/Confirm');
  var EditView = require('views/Edit');
  var MessageView = require('views/Message');
  var models = require('models');
  zip.workerScriptsPath = '/lib/zip.js/';

  _.sendMessage = _.getMessenger({});
  _.showMessage = function (options) {
    new MessageView(options);
  };

  var App = Backbone.Router.extend({
    routes: {
      '': 'renderMain',
      'main/:tab': 'renderMain',
      'confirm/:url': 'renderConfirm',
      'confirm/:url/:from': 'renderConfirm',
    },
    renderMain: function (tab) {
      exports.scriptList || initMain();
      this.view = new MainView(tab);
    },
    renderConfirm: function (url, _from) {
      this.view = new ConfirmView(url, _from);
    },
    renderEdit: function (id) {
      this.view = new EditView(id);
    },
  });
  var app = new App();
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
