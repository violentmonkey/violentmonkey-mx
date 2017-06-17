// Polyfills are imported in `browser.js`
// import './polyfills';

export function i18n(name, args) {
  return browser.i18n.getMessage(name, args) || name;
}
export const defaultImage = '/icons/icon_48.png';

export function normalizeKeys(key) {
  let keys = key || [];
  if (!Array.isArray(keys)) keys = keys.toString().split('.');
  return keys;
}

export const object = {
  get(obj, rawKey, def) {
    const keys = normalizeKeys(rawKey);
    let res = obj;
    keys.some((key) => {
      if (res && typeof res === 'object' && (key in res)) {
        res = res[key];
      } else {
        res = def;
        return true;
      }
    });
    return res;
  },
  set(obj, rawKey, val) {
    const keys = normalizeKeys(rawKey);
    if (!keys.length) return val;
    const root = obj || {};
    let sub = root;
    const lastKey = keys.pop();
    keys.forEach((key) => {
      let child = sub[key];
      if (!child) {
        child = {};
        sub[key] = child;
      }
      sub = child;
    });
    if (val == null) {
      delete sub[lastKey];
    } else {
      sub[lastKey] = val;
    }
    return obj;
  },
};

export function initHooks() {
  const hooks = [];

  function fire(data) {
    hooks.slice().forEach((cb) => {
      cb(data);
    });
  }

  function hook(callback) {
    hooks.push(callback);
    return () => {
      const i = hooks.indexOf(callback);
      if (i >= 0) hooks.splice(i, 1);
    };
  }

  return { hook, fire };
}

export function sendMessage(payload) {
  const promise = browser.runtime.sendMessage(payload)
  .then(res => {
    const { data, error } = res || {};
    if (error) return Promise.reject(error);
    return data;
  });
  promise.catch((err) => {
    if (process.env.DEBUG) console.warn(err);
  });
  return promise;
}

export function debounce(func, time) {
  let timer;
  function run(thisObj, args) {
    timer = null;
    func.apply(thisObj, args);
  }
  return function debouncedFunction(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, time, this, args);
  };
}

export function noop() {}

export function zfill(input, length) {
  let num = input.toString();
  while (num.length < length) num = `0${num}`;
  return num;
}

export function getUniqId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Get locale attributes such as `@name:zh-CN`
 */
export function getLocaleString(meta, key) {
  const languages = navigator.languages || [navigator.language];
  if (languages.length === 1) {
    const i = languages[0].indexOf('-');
    if (i > 0) languages.push(languages[0].slice(0, i));
  }
  const localeMeta = languages
  .map(lang => meta[`${key}:${lang}`] || meta[`${key}:${lang.toLowerCase()}`])
  .find(Boolean);
  return localeMeta || meta[key] || '';
}

const rt = window.external.mxGetRuntime();
const br = rt && rt.create('mx.browser');
export function injectContent(script, tabId) {
  br.executeScript(`if(window.mx)try{${script}}catch(e){}`, tabId);
}

const binaryTypes = [
  'blob',
  'arraybuffer',
];

/**
 * Make a request.
 * @param {String} url
 * @param {Object} headers
 * @return Promise
 */
export function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const { responseType } = options;
    xhr.open(options.method || 'GET', url, true);
    if (binaryTypes.includes(responseType)) xhr.responseType = responseType;
    const headers = Object.assign({}, options.headers);
    let { body } = options;
    if (body && typeof body === 'object') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    Object.keys(headers).forEach(key => {
      xhr.setRequestHeader(key, headers[key]);
    });
    xhr.onload = () => {
      const res = getResponse(xhr, {
        // status for `file:` protocol will always be `0`
        status: xhr.status || 200,
      });
      if (res.status > 300) reject(res);
      else resolve(res);
    };
    xhr.onerror = () => {
      const res = getResponse(xhr, { status: -1 });
      reject(res);
    };
    xhr.onabort = xhr.onerror;
    xhr.ontimeout = xhr.onerror;
    xhr.send(body);
  });
  function getResponse(xhr, extra) {
    const { responseType } = options;
    let data;
    if (binaryTypes.includes(responseType)) {
      data = xhr.response;
    } else {
      data = xhr.responseText;
    }
    if (responseType === 'json') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        // Ignore invalid JSON
      }
    }
    return Object.assign({
      url,
      data,
    }, extra);
  }
}

export function buffer2string(buffer) {
  const array = new window.Uint8Array(buffer);
  const sliceSize = 8192;
  let str = '';
  for (let i = 0; i < array.length; i += sliceSize) {
    str += String.fromCharCode.apply(null, array.subarray(i, i + sliceSize));
  }
  return str;
}

export function getFullUrl(url, base) { // eslint-disable-line
  // Maxthon sucks
  // Maxthon does not support URL constructor
  // TODO add polyfill for URL constructor
  return url;
}

export function isRemote(url) {
  return url && !(/^(file|data):/.test(url));
}
