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

var key = 'features';
var features;
init();

exports.reset = function (version, data) {
  init(data, version) && _.options.set(key, features);
};

Vue.directive('feature', {
  bind: function (el, binding) {
    function onFeatureClick(_e) {
      features.data[value] = 1;
      _.options.set(key, features);
      el.classList.remove('feature');
      el.removeEventListener('click', onFeatureClick, false);
    }
    var value = binding.value;
    if (features.data[value]) return;
    el.classList.add('feature');
    el.addEventListener('click', onFeatureClick, false);
  },
});
