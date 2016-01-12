var Meta = Backbone.Model.extend({
  parse: function (script) {
    this.meta = script.meta;
    return script.custom;
  },
});

var Script = Backbone.Model.extend({
  getLocaleString: function (key) {
    var _this = this;
    var meta = _this.get('meta') || {};
    return _.getLocaleString(meta, key);
  },
  canUpdate: function () {
    var script = this.toJSON();
    return script.update && (
      script.custom.updateURL ||
      script.meta.updateURL ||
      script.custom.downloadURL ||
      script.meta.downloadURL ||
      script.custom.lastInstallURL
    );
  },
});

var ScriptList = Backbone.Collection.extend({
  model: Script,
  // comparator: 'position',
  initialize: function () {
    this.cache = {};
    this.reload();
  },
  reload: function () {
    var _this = this;
    _this.loading = true;
    _.sendMessage({cmd: 'GetData'}).then(function (data) {
      _this.loading = false;
      _this.version = data.version;
      _.assign(_this.cache, data.cache);
      _this.reset(data.scripts);
      _.options.setAll(data.options);
    });
  },
});

!function () {
  var set = _.options.set;
  _.options.set = function (key, value) {
    set(key, value);
    _.sendMessage({
      cmd: 'SetOption',
      data: {
        key: key,
        value: value,
      },
    });
  };
  _.options.setAll = function (options) {
    for (var k in options) set(k, options[k]);
  };
}();
