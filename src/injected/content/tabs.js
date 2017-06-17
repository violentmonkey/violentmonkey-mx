import { sendMessage } from '../utils';
import bridge from './bridge';

const tabIds = {};
const tabKeys = {};

export function tabOpen({ key, data }) {
  sendMessage({ cmd: 'TabOpen', data })
  .then(({ id }) => {
    tabIds[key] = id;
    tabKeys[id] = key;
  });
}

export function tabClose(key) {
  if (key) {
    const id = tabIds[key];
    if (id) sendMessage({ cmd: 'TabClose', data: { id } });
  } else {
    browser.__ensureTabId().then(() => {
      sendMessage({ cmd: 'TabClose' });
    });
  }
}

export function tabClosed(id) {
  const key = tabKeys[id];
  delete tabKeys[id];
  delete tabIds[key];
  if (key) {
    bridge.post({ cmd: 'TabClosed', data: key });
  }
}
