import 'src/common/browser';
import Vue from 'vue';
import { i18n, sendMessage, injectContent, debounce } from 'src/common';
import handlers from 'src/common/handlers';
import * as tld from 'src/common/tld';
import 'src/common/ui/style';
import App from './views/app';
import { store } from './utils';

tld.initTLD();

Vue.prototype.i18n = i18n;

new Vue({
  render: h => h(App),
}).$mount('#app');

const init = debounce(() => {
  injectContent('setPopup()');
  delayClear();
}, 100);
let delayedClear;

Object.assign(handlers, {
  GetPopup: init,
  SetPopup(data, src) {
    cancelClear();
    store.currentSrc = src;
    if (/^https?:\/\//i.test(src.tab.url)) {
      const matches = src.tab.url.match(/:\/\/([^/]*)/);
      const domain = matches[1];
      const topLevelDomain = tld.getDomain(domain) || domain;
      let domains = [topLevelDomain];
      if (domain !== topLevelDomain) {
        domains = domain.slice(0, -topLevelDomain.length - 1).split('.')
        .reduceRight(
          (res, part) => [`${part}.${res[0]}`, ...res],
          domains,
        );
      }
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
browser.tabs.onActivated.addListener(({ tabId }) => {
  store.currentTab = { tabId };
  init();
});
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
