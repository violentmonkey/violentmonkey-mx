function reset(data) {
  options = data;
}

function get(key, def) {
  return _.object.get(options, key, def);
}

function set(key, val) {
  _.sendMessage({
    cmd: 'SetOption',
    data: {
      key: key,
      value: val,
    },
  });
  _.object.set(options, key, val);
  hooks.forEach(function (cb) {
    cb(val, key);
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

module.exports = {
  reset: reset,
  get: get,
  set: set,
  hook: hook,
};
