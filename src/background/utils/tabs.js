var _ = require('../../common');

function update(cb) {
  on('ON_NAVIGATE', function (data) {
    cb({
      id: data.id,
      url: data.url,
    });
  });
  // It seems that ON_NAVIGATE is not triggered for 302
  // PAGE_LOADED is triggered after URL redirected
  on('PAGE_LOADED', function (data) {
    _.tabs.get(data.id).then(function (tab) {
      cb({
        id: tab.id,
        url: tab.url,
      });
    });
  });
}
var on = function () {
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
}();

function broadcast(data) {
  _.mx.rt.post('Broadcast', data);
}

module.exports = Object.assign(_.tabs, {
  update: update,
  on: on,
  broadcast: broadcast,
});
