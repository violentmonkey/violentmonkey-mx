// Maxthon 4: localStorage of background is not reachable from options page
// This module patchs _.options and sync the options data asynchronously.

function reset(data) {
  options = data;
  hooks.forEach(function (cb) {cb();});
}

function get(key, def) {
  return _.object.get(options, key, def);
}

function set(key, val) {
  _.object.set(options, key, val);
  return _.sendMessage({
    cmd: 'SetOption',
    data: {
      key: key,
      value: val,
    },
  })
  .then(function () {
    hooks.forEach(function (cb) {
      cb(val, key);
    });
  });
}

function hook(cb) {
  hooks.push(cb);
  return function () {
    var i = hooks.indexOf(cb);
    ~i && hooks.splice(i, 1);
  };
}

var _ = require('../../common');
var options = {};
var hooks = [];

_.options = {
  reset: reset,
  get: get,
  set: set,
  hook: hook,
};
