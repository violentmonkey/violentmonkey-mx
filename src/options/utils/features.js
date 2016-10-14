var _ = require('../../common');

function init(data, version) {
  features = data;
  if (!features || !features.data || features.version !== version) {
    features = {
      version: version,
      data: {},
    };
    return true;
  }
}
function initItem(el, value) {
  function clear() {
    el.classList.remove('feature');
    el.removeEventListener('click', onFeatureClick, false);
  }
  function onFeatureClick(_e) {
    features.data[value] = 1;
    _.options.set(key, features);
    clear();
  }
  function reset() {
    clear();
    if (!features.data[value]) {
      el.classList.add('feature');
      el.addEventListener('click', onFeatureClick, false);
    }
  }
  reset();
  return {
    el: el,
    reset: reset,
  };
}

var key = 'features';
var features;
var items = [];
init();

exports.reset = function (version, data) {
  init(data, version) && _.options.set(key, features);
  items.forEach(function (item) {
    item.reset();
  });
};

Vue.directive('feature', {
  bind: function (el, binding) {
    items.push(initItem(el, binding.value));
  },
  unbind: function (el) {
    var i = items.findIndex(function (item) {
      return item.el === el;
    });
    ~i && items.splice(i, 1);
  },
});
