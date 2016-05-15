define('utils/tabs', function (_require, _exports, module) {
  var tabs = module.exports = _.tabs;
  _.assign(_.tabs, {
    update: function (cb) {
      tabs.on('ON_NAVIGATE', function (data) {
        cb({
          id: data.id,
          url: data.url,
        });
      });
      // It seems that ON_NAVIGATE is not triggered for 302
      // PAGE_LOADED is triggered after URL redirected
      tabs.on('PAGE_LOADED', function (data) {
        tabs.get(data.id).then(function (tab) {
          cb({
            id: tab.id,
            url: tab.url,
          });
        });
      });
    },
    on: function () {
      function register(type, cb) {
        var cbs = events[type];
        if (!cbs) cbs = events[type] = [];
        cbs.push(cb);
      }
      var events = {};
      _.mx.br.onBrowserEvent = function (data) {
        var cbs = events[data.type];
        cbs && cbs.forEach(function (cb) {
          cb(data);
        });
      };
      return register;
    }(),
  });
});
