import { sendMessage } from './utils';
import bridge from './content';

const tabs = {};
const tabIdMap = {};

export function tabOpen({ data, key }) {
  sendMessage({ cmd: 'TabOpen', data })
  .then(({ id }) => {
    tabs[key] = { id };
    tabIdMap[id] = key;
  });
}
export function tabClose(key) {
  if (key) {
    const item = tabs[key];
    if (item) {
      sendMessage({ cmd: 'TabClose', data: { id: item.id } });
    }
  } else {
    browser.__ensureTabId().then(() => {
      sendMessage({ cmd: 'TabClose' });
    });
  }
}
export function tabClosed(id) {
  const key = tabIdMap[id];
  if (key) {
    delete tabIdMap[id];
    delete tabs[key];
    bridge.post({ cmd: 'TabClosed', data: key });
  }
}
