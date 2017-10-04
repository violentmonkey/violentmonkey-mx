import { bindEvents, sendMessage, inject, attachFunction } from '../utils';
import bridge from './bridge';
import { tabOpen, tabClose, tabClosed } from './tabs';
import { onNotificationCreate, onNotificationClick, onNotificationClose } from './notifications';
import { getRequestId, httpRequest, abortRequest, httpRequested } from './requests';

const IS_TOP = window.top === window;

const ids = [];
const menus = [];

const badge = {
  number: 0,
  ready: false,
};

function updateBadge() {
  sendMessage({ cmd: 'GetBadge' });
}

function setBadge(tabId) {
  if (badge.ready) {
    // XXX: only scripts run in top level window are counted
    if (IS_TOP) {
      sendMessage({
        cmd: 'SetBadge',
        data: {
          tabId,
          number: badge.number,
        },
      });
    }
  }
}
window.setBadge = setBadge;

const bgHandlers = {
  Command(data) {
    bridge.post({ cmd: 'Command', data });
  },
  GetPopup: getPopup,
  HttpRequested: httpRequested,
  TabClosed: tabClosed,
  UpdatedValues(data) {
    bridge.post({ cmd: 'UpdatedValues', data });
  },
  NotificationClick: onNotificationClick,
  NotificationClose: onNotificationClose,
};

export default function initialize(contentId, webId) {
  bridge.post = bindEvents(contentId, webId, onHandle);
  bridge.destId = webId;

  const handleMessage = (req, src) => {
    const handle = bgHandlers[req.cmd];
    if (handle) handle(req.data, src);
  };
  browser.runtime.onMessage.addListener(handleMessage);
  window.handleTabMessage = ({ source, data }) => handleMessage(data, source);

  sendMessage({ cmd: 'GetInjected', data: window.location.href })
  .then(data => {
    if (data.scripts) {
      data.scripts.forEach(script => {
        ids.push(script.props.id);
        if (script.config.enabled) badge.number += 1;
      });
    }
    bridge.post({ cmd: 'LoadScripts', data });
    badge.ready = true;
    getPopup();
    updateBadge();
  });

  browser.__ensureTabId().then(() => {
    sendMessage({ cmd: 'Navigate' });
  });
  sendMessage({ cmd: 'GetTabId' });
}

const handlers = {
  GetRequestId: getRequestId,
  HttpRequest: httpRequest,
  AbortRequest: abortRequest,
  Inject: injectScript,
  TabOpen: tabOpen,
  TabClose: tabClose,
  UpdateValue(data) {
    sendMessage({ cmd: 'UpdateValue', data });
  },
  RegisterMenu(data) {
    if (IS_TOP) menus.push(data);
    getPopup();
  },
  AddStyle(css) {
    if (document.head) {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    }
  },
  Notification: onNotificationCreate,
  SetClipboard(data) {
    sendMessage({ cmd: 'SetClipboard', data });
  },
  CheckScript({ name, namespace, callback }) {
    sendMessage({ cmd: 'CheckScript', data: { name, namespace } })
    .then(result => {
      bridge.post({ cmd: 'ScriptChecked', data: { callback, result } });
    });
  },
};

function onHandle(req) {
  const handle = handlers[req.cmd];
  if (handle) handle(req.data);
}

function getPopup() {
  sendMessage({ cmd: 'GetPopup' });
}

window.setPopup = () => {
  // XXX: only scripts run in top level window are counted
  if (IS_TOP) {
    sendMessage({
      cmd: 'SetPopup',
      data: { ids, menus },
    });
  }
};
document.addEventListener('DOMContentLoaded', getPopup, false);

function injectScript(data) {
  const [vId, wrapperKeys, code, vCallbackId] = data;
  const func = (attach, id, cb, callbackId) => {
    attach(id, cb);
    const callback = window[callbackId];
    if (callback) callback();
  };
  const args = [
    attachFunction.toString(),
    JSON.stringify(vId),
    `function(${wrapperKeys.join(',')}){${code}}`,
    JSON.stringify(vCallbackId),
  ];
  inject(`!${func.toString()}(${args.join(',')})`);
}
