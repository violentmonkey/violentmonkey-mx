import 'src/common/polyfills';
import 'src/common/browser';
import 'src/common/sprite';
import Vue from 'vue';
import { i18n, sendMessage, injectContent, debounce } from 'src/common';
import handlers from 'src/common/handlers';
import 'src/common/ui/style';
import App from './views/app';
import { store } from './utils';

Vue.prototype.i18n = i18n;

new Vue({
  render: h => h(App),
}).$mount('#app');

{
  const init = debounce(() => {
    injectContent('setPopup()');
    delayClear();
  }, 100);
  let delayedClear;

  Object.assign(handlers, {
    GetPopup: init,
    SetPopup(data, src) {
      cancelClear();
      const tab = (src && src.tab) || {};
      store.currentTab = tab;
      if (/^https?:\/\//i.test(tab.url)) {
        const matches = tab.url.match(/:\/\/(?:www\.)?([^/]*)/);
        const domain = matches[1];
        const domains = domain.split('.').reduceRight((res, part) => {
          const last = res[0];
          const subdomain = last ? `${part}.${last}` : part;
          res.unshift(subdomain);
          return res;
        }, []);
        if (domains.length > 1) domains.pop();
        store.domains = domains;
      }
      store.commands = data.menus;
      sendMessage({
        cmd: 'GetMetas',
        data: data.ids,
      })
      .then(scripts => { store.scripts = scripts; });
    },
  });
  browser.tabs.onActivated.addListener(init);
  browser.tabs.onUpdated.addListener(init);
  init();

  function clear() {
    store.scripts = [];
    store.commands = [];
    store.domains = [];
    delayedClear = null;
  }
  function cancelClear() {
    if (delayedClear) clearTimeout(delayedClear);
  }
  function delayClear() {
    cancelClear();
    delayedClear = setTimeout(clear, 200);
  }
}
