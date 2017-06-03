import Vue from 'vue';
import 'src/common/browser';
import 'src/common/sprite';
import options from 'src/common/options';
import { i18n, sendMessage, injectContent, debounce } from 'src/common';
import App from './views/app';
import { store } from './utils';

Vue.prototype.i18n = i18n;

new Vue({
  render: h => h(App),
}).$mount('#app');

const handlers = {
  UpdateOptions(data) {
    options.update(data);
  },
};
browser.runtime.onMessage.addListener((req, src) => {
  const func = handlers[req.cmd];
  if (func) return func(req.data, src);
});

{
  const init = debounce(() => {
    injectContent('setPopup()');
    delayClear();
  }, 100);
  let delayedClear;

  Object.assign(handlers, {
    GetPopup: init,
    SetPopup(data, currentTab) {
      cancelClear();
      store.currentTab = currentTab;
      if (currentTab && /^https?:\/\//i.test(currentTab.url)) {
        const matches = currentTab.url.match(/:\/\/(?:www\.)?([^/]*)/);
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
