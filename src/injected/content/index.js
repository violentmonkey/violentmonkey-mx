import { getUniqId } from 'src/common';
import { bindEvents, sendMessage, inject, attachFunction } from '../utils';
import bridge from './bridge';
import { tabOpen, tabClose, tabClosed } from './tabs';
import { onNotificationCreate, onNotificationClick, onNotificationClose } from './notifications';
import { getRequestId, httpRequest, abortRequest, httpRequested } from './requests';

const IS_TOP = window.top === window;

const ids = [];
const enabledIds = [];
const menus = {};

function setBadge() {
  // delay setBadge in frames so that they can be added to the initial count
  browser.__ensureTabId()
  .then(() => new Promise(resolve => setTimeout(resolve, IS_TOP ? 0 : 300)))
  .then(() => sendMessage({
    cmd: 'SetBadge',
    data: {
      ids: enabledIds,
      reset: IS_TOP,
    },
  }));
}

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

  browser.__ensureTabId().then(() => sendMessage({ cmd: 'Navigate' }));

  return sendMessage({
    cmd: 'GetInjected',
    data: {
      url: window.location.href,
      reset: IS_TOP,
    },
  })
  .then(data => {
    if (data.scripts) {
      data.scripts = data.scripts.filter(script => {
        ids.push(script.props.id);
        if ((IS_TOP || !script.meta.noframes) && script.config.enabled) {
          enabledIds.push(script.props.id);
          return true;
        }
        return false;
      });
    }
    getPopup();
    setBadge();
    const needInject = data.scripts && data.scripts.length;
    if (needInject) {
      bridge.ready.then(() => {
        bridge.post({ cmd: 'LoadScripts', data });
      });
    }
    return needInject;
  });
}

const handlers = {
  GetRequestId: getRequestId,
  HttpRequest: httpRequest,
  AbortRequest: abortRequest,
  Inject: injectScript,
  TabOpen: tabOpen,
  TabClose: tabClose,
  Ready() {
    bridge.ready = Promise.resolve();
  },
  UpdateValue(data) {
    sendMessage({ cmd: 'UpdateValue', data });
  },
  RegisterMenu(data) {
    if (IS_TOP) {
      const [key] = data;
      menus[key] = data;
    }
    getPopup();
  },
  UnregisterMenu(data) {
    if (IS_TOP) {
      const [key] = data;
      delete menus[key];
    }
    getPopup();
  },
  AddStyle({ css, callbackId }) {
    let styleId = null;
    if (document.head) {
      styleId = getUniqId('VMst');
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = css;
      document.head.appendChild(style);
    }
    bridge.post({ cmd: 'Callback', data: { callbackId, payload: styleId } });
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

bridge.ready = new Promise(resolve => {
  handlers.Ready = resolve;
});

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
      data: { ids, menus: Object.values(menus) },
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
  const injectedCode = `!${func.toString()}(${args.join(',')})`;
  inject(injectedCode);
}
