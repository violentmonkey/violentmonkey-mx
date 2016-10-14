var cache = require('../../cache');
var utils = require('../utils');
var data = {
  store: utils.store,
  language: navigator.language,
};

module.exports = {
  template: cache.get('./tab-about.html'),
  data: function () {
    return data;
  },
  computed: {
    version: function () {
      return this.store.app.version;
    },
  },
};
