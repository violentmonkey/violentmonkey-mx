// Maxthon 4: localStorage of background is not reachable from options page
// This module patchs _.options and sync the options data asynchronously.

function reset(data) {
  options = data;
  update();
}

function update(key, val) {
  var keys = key ? [key, ''] : Object.keys(hooks);
  keys.forEach(function (hkey) {
    var list = hooks[hkey];
    list && list.forEach(function (cb) {
      key ? cb(val, key) : hkey ? cb(get(hkey), hkey) : cb();
    });
  });
}

function get(key, def) {
  return _.object.get(options, key, def);
}

function set(key, val) {
  _.object.set(options, key, val);
  update(key, val);
  return _.sendMessage({
    cmd: 'SetOption',
    data: {
      key: key,
      value: val,
    },
  });
}

function parseArgs(args) {
  return args.length === 1 ? {
    key: '',
    cb: args[0],
  } : {
    key: args[0] || '',
    cb: args[1],
  };
}

function hook() {
  var arg = parseArgs(arguments);
  var list = hooks[arg.key];
  if (!list) list = hooks[arg.key] = [];
  list.push(arg.cb);
  return function () {
    unhook(arg.key, arg.cb);
  };
}
function unhook() {
  var arg = parseArgs(arguments);
  var list = hooks[arg.key];
  if (list) {
    var i = list.indexOf(arg.cb);
    ~i && list.splice(i, 1);
  }
}

var _ = require('../../common');
var features = require('./features');
var options = {};
var hooks = {};

_.options = {
  get: get,
  set: set,
  hook: hook,
};

_.sendMessage({cmd: 'GetOptions'})
.then(function (options) {
  reset(options);
  features.reset('sync', options.features);
});
