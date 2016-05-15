define('badges', function (_require, _exports, module) {
  function clear() {
    _.mx.rt.icon.hideBadge('');
    delayedClear = null;
  }
  function cancelClear() {
    delayedClear && clearTimeout(delayedClear);
  }
  function delayClear() {
    cancelClear();
    delayedClear = setTimeout(clear, 200);
  }
  function getBadges() {
    _.injectContent('setBadge()');
    delayClear();
  }
  function setBadges(num, src) {
    cancelClear();
    var item = badges[src.id];
    if (!item) item = badges[src.id] = {num: 0};
    item.num += num;
    _.options.get('showBadge') && _.mx.rt.icon.showBadge(item.num || '');
    if (item.timer) clearTimeout(item.timer);
    item.timer = setTimeout(function () {
      delete badges[src.id];
    });
  }
  var badges = {};
  var delayedClear;
  module.exports = {
    get: _.debounce(getBadges, 100),
    set: setBadges,
  };
});
