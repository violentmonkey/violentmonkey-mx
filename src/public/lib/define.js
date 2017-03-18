!function (root) {
  function define(name, factory) {
    var module = modules[name];
    if (module) {
      throw 'Module is already defined: ' + name;
    }
    module = modules[name] = {
      name: name,
      factory: factory,
      data: {
        exports: {},
      },
      initialized: false,
    };
  }

  function require(name) {
    var module = modules[name];
    if (!module) {
      throw 'Module not found: ' + name;
    }
    if (!module.initialized) {
      module.initialized = true;
      module.factory(require, module.data.exports, module.data);
    }
    return module.data.exports;
  }

  function use() {
    var items = [];
    var len = arguments.length;
    for (var i = 0; i < len; i ++) items = items.concat(arguments[i]);
    items.forEach(function (item) {
      typeof item === 'function' ? item(require) : require(item);
    });
  }

  var modules = {};
  define.use = use;

  root.define = define;
}(this);
