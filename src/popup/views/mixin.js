var MenuItem = require('./item');
var cache = require('../../cache');
var utils = require('../utils');

module.exports = {
  template: cache.get('./menu.html'),
  data: function () {
    return {
      store: utils.store,
    };
  },
  components: {
    MenuItem: MenuItem,
  },
  methods: {
    isVisible: function (item) {
      var hide = item.hide;
      if (typeof hide === 'function') hide = hide.call(this);
      return !hide;
    },
  },
};
