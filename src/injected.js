// make sure this is an HTML page, ignore XML, etc.
if (document.documentElement.tagName.toLowerCase() !== 'html') return;

// avoid running repeatedly due to new document.documentElement
if (window.VM) return;
window.VM = 1;

function getUniqId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function noop() {}
function includes(arr, item) {
  for (var i = arr.length; i --;) {
    if (arr[i] === item) return true;
  }
  return false;
}
function forEach(arr, func) {
  var length = arr && arr.length || 0;
  for (var i = 0; i < length; i ++) func(arr[i], i, arr);
}
function map(arr, func) {
  var comm = this;
  var res = [];
  comm.forEach(arr, function (item, i) {
    res.push(func(item, i, arr));
  });
  return res;
}

/**
* http://www.webtoolkit.info/javascript-utf8.html
*/
function utf8decode(utftext) {
  var string = '';
  var i = 0;
  var c = 0, c2 = 0, c3 = 0;
  while ( i < utftext.length ) {
    c = utftext.charCodeAt(i);
    if (c < 128) {string += String.fromCharCode(c);i++;}
    else if ((c > 191) && (c < 224)) {
      c2 = utftext.charCodeAt(i+1);
      string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
      i += 2;
    } else {
      c2 = utftext.charCodeAt(i+1);
      c3 = utftext.charCodeAt(i+2);
      string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
      i += 3;
    }
  }
  return string;
}

function sendMessage(data) {
  return browser.runtime.sendMessage(data)
  .then(function (res) {
    if (res && res.error) throw res.error;
    return res && res.data;
  });
}
browser.runtime.onMessage.addListener(function (req, src) {
  var handlers = {
    Command: function (data) {
      comm.post({cmd: 'Command', data: data});
    },
    HttpRequested: function (res) {
      comm.post({cmd: 'HttpRequested', data: res});
    },
    UpdateValues: function (data) {
      comm.post({cmd: 'UpdateValues', data: data});
    },
    NotificationClick: onNotificationClick,
    NotificationClose: onNotificationClose,
  }
  var func = handlers[req.cmd];
  if (func) func(req.data, src);
});

/**
 * @desc Wrap methods to prevent unexpected modifications.
 */
function getWrapper() {
  // http://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects
  // http://developer.mozilla.org/docs/Web/API/Window
  var comm = this;
  var wrapper = {};
  // `eval` should be called directly so that it is run in current scope
  wrapper.eval = eval;
  // Wrap methods
  comm.forEach([
    // 'uneval',
    'isFinite',
    'isNaN',
    'parseFloat',
    'parseInt',
    'decodeURI',
    'decodeURIComponent',
    'encodeURI',
    'encodeURIComponent',

    'addEventListener',
    'alert',
    'atob',
    'blur',
    'btoa',
    'clearInterval',
    'clearTimeout',
    'close',
    'confirm',
    'dispatchEvent',
    'find',
    'focus',
    'getComputedStyle',
    'getSelection',
    'matchMedia',
    'moveBy',
    'moveTo',
    'open',
    'openDialog',
    'postMessage',
    'print',
    'prompt',
    'removeEventListener',
    'resizeBy',
    'resizeTo',
    'scroll',
    'scrollBy',
    'scrollByLines',
    'scrollByPages',
    'scrollTo',
    'setInterval',
    'setTimeout',
    'stop',
  ], function (name) {
    var method = window[name];
    wrapper[name] = function () {
      return method.apply(window, arguments);
    };
  });
  // Wrap properties
  comm.forEach(comm.props, function (name) {
    if (wrapper[name]) return;
    var modified = false;
    var value;
    Object.defineProperty(wrapper, name, {
      get: function () {
        if (!modified) value = window[name];
        return value === window ? wrapper : value;
      },
      set: function (val) {
        modified = true;
        value = val;
      },
    });
  });
  return wrapper;
}
// Communicator
var comm = {
  vmid: 'VM_' + getUniqId(),
  state: 0,
  utf8decode: utf8decode,
  getUniqId: getUniqId,

  // Array functions
  // to avoid using prototype functions
  // since they may be changed by page scripts
  includes: includes,
  forEach: forEach,
  map: map,
  props: Object.getOwnPropertyNames(window),

  init: function (srcId, destId) {
    var comm = this;
    comm.sid = comm.vmid + srcId;
    comm.did = comm.vmid + destId;
    document.addEventListener(comm.sid, comm['handle' + srcId].bind(comm), false);
    comm.load = comm.checkLoad = function () {};
    // check whether the page is injectable via <script>, whether limited by CSP
    try {
      comm.injectable = (0, eval)('true');
    } catch (e) {
      comm.injectable = false;
      console.warn('[Violentmonkey] Injection is blocked in this page due to CSP!');
    }
  },
  post: function (data) {
    var e = new CustomEvent(this.did, {detail: data});
    document.dispatchEvent(e);
  },
  handleR: function (e) {
    var obj = e.detail;
    var comm = this;
    var maps = {
      LoadScript: comm.loadScript.bind(comm),
      Command: function (data) {
        var func = comm.command[data];
        if (func) func();
      },
      GotRequestId: function (id) {
        comm.qrequests.shift().start(id);
      },
      HttpRequested: function (r) {
        var req = comm.requests[r.id];
        if (req) req.callback(r);
      },
      UpdateValues: function (data) {
        var values = comm.values;
        if (values && values[data.uri]) values[data.uri] = data.values;
      },
      NotificationClicked: function (id) {
        var options = comm.notif[id];
        if (options) {
          var onclick = options.onclick;
          onclick && onclick();
        }
      },
      NotificationClosed: function (id) {
        var options = comm.notif[id];
        if (options) {
          delete comm.notif[id];
          var ondone = options.ondone;
          ondone && ondone();
        }
      },
    };
    var func = maps[obj.cmd];
    if (func) func(obj.data);
  },
  runCode: function (name, func, args, thisObj) {
    try {
      func.apply(thisObj, args);
    } catch (e) {
      console.error('Error running script: ' + name + '\n' + e.message);
    }
  },
  initRequest: function () {
    // request functions
    function reqAbort() {
      comm.post({cmd: 'AbortRequest', data: this.id});
    }

    // request object functions
    function callback(req) {
      var t = this;
      var cb = t.details['on' + req.type];
      if (cb) {
        if (req.data.response) {
          if (!t.data.length) {
            if (req.resType) { // blob or arraybuffer
              var m = req.data.response.match(/^data:(.*?);base64,(.*)$/);
              if (!m) req.data.response = null;
              else {
                var b = window.atob(m[2]);
                if (t.details.responseType == 'blob')
                  t.data.push(new Blob([b], {type: m[1]}));
                else {  // arraybuffer
                  m = new window.Uint8Array(b.length);
                  for (var i = 0; i < b.length; i ++) m[i] = b.charCodeAt(i);
                  t.data.push(m.buffer);
                }
              }
            } else if (t.details.responseType == 'json') // json
              t.data.push(JSON.parse(req.data.response));
            else  // text
              t.data.push(req.data.response);
          }
          req.data.response = t.data[0];
        }
        // finalUrl not supported
        Object.defineProperty(req.data, 'finalUrl', {
          get: function () {
            console.warn('[Violentmonkey] Warning: finalUrl is not supported!');
          },
        });
        cb(req.data);
      }
      if (req.type == 'loadend') delete comm.requests[t.id];
    }
    function start(id) {
      var t = this;
      var data = {
        id: id,
        method: t.details.method,
        url: t.details.url,
        data: t.details.data,
        //async: !t.details.synchronous,
        user: t.details.user,
        password: t.details.password,
        headers: t.details.headers,
        overrideMimeType: t.details.overrideMimeType,
      };
      t.id = id;
      comm.requests[id] = t;
      if (comm.includes(['arraybuffer', 'blob'], t.details.responseType))
        data.responseType = 'blob';
      comm.post({cmd: 'HttpRequest', data: data});
    }
    function getFullUrl(url) {
      var a = document.createElement('a');
      a.setAttribute('href', url);
      return a.href;
    }

    var comm = this;
    comm.requests = {};
    comm.qrequests = [];
    comm.Request = function (details) {
      var t = {
        details: details,
        callback: callback,
        start: start,
        req: {
          abort: reqAbort,
        },
        data: [],
      };
      details.url = getFullUrl(details.url);
      comm.qrequests.push(t);
      comm.post({cmd:'GetRequestId'});
      return t.req;
    };
  },
  getWrapper: getWrapper,
  wrapGM: function (script, cache) {
    function getValues() {
      return comm.values[script.uri];
    }
    function propertyToString() {
      return '[Violentmonkey property]';
    }
    function addProperty(name, prop, obj) {
      if ('value' in prop) prop.writable = false;
      prop.configurable = false;
      Object.defineProperty(obj, name, prop);
      if (typeof obj[name] == 'function') obj[name].toString = propertyToString;
    }
    function saveValues() {
      comm.post({
        cmd: 'SetValue',
        data: {
          uri: script.uri,
          values: getValues(),
        },
      });
    }
    // Add GM functions
    // Reference: http://wiki.greasespot.net/Greasemonkey_Manual:API
    var comm = this;
    var gm = {};
    var grant = script.meta.grant || [];
    var urls = {};
    if (!grant.length || grant.length == 1 && grant[0] == 'none') {
      // @grant none
      grant.pop();
    } else {
      gm['window'] = comm.getWrapper();
    }
    if (!comm.includes(grant, 'unsafeWindow')) grant.push('unsafeWindow');
    if (!comm.includes(grant, 'GM_info')) grant.push('GM_info');
    var resources = script.meta.resources || {};
    var gm_funcs = {
      unsafeWindow: {value: window},
      GM_info: {
        get: function () {
          var m = script.code.match(/\/\/\s+==UserScript==\s+([\s\S]*?)\/\/\s+==\/UserScript==\s/);
          var data = {
            description: script.meta.description || '',
            excludes: script.meta.exclude.concat(),
            includes: script.meta.include.concat(),
            matches: script.meta.match.concat(),
            name: script.meta.name || '',
            namespace: script.meta.namespace || '',
            resources: {},
            'run-at': script.meta['run-at'] || '',
            unwrap: false,
            version: script.meta.version || '',
          };
          var obj = {};
          addProperty('scriptMetaStr', {value: m ? m[1] : ''}, obj);

          // whether update is allowed
          addProperty('scriptWillUpdate', {value: !!script.update}, obj);

          // Violentmonkey specific data
          addProperty('version', {value: comm.version}, obj);
          addProperty('scriptHandler', {value: 'Violentmonkey'}, obj);

          // script object
          addProperty('script', {value:{}}, obj);
          var i;
          for (i in data) addProperty(i, {value: data[i]}, obj.script);
          for (i in script.meta.resources) {
            addProperty(i, {value: script.meta.resources[i]}, obj.script.resources);
          }
          return obj;
        },
      },
      GM_deleteValue: {
        value: function (key) {
          var values = getValues();
          delete values[key];
          saveValues();
        },
      },
      GM_getValue: {
        value: function (key, val) {
          var values = getValues();
          var v = values[key];
          if (v) {
            var type = v[0];
            v = v.slice(1);
            switch (type) {
            case 'n':
              val = Number(v);
              break;
            case 'b':
              val = v == 'true';
              break;
            case 'o':
              try {
                val = JSON.parse(v);
              } catch (e) {
                console.warn(e);
              }
              break;
            default:
              val = v;
            }
          }
          return val;
        },
      },
      GM_listValues: {
        value: function () {
          return Object.getOwnPropertyNames(getValues());
        },
      },
      GM_setValue: {
        value: function (key, val) {
          var type = (typeof val)[0];
          switch (type) {
          case 'o':
            val = type + JSON.stringify(val);
            break;
          default:
            val = type + val;
          }
          var values = getValues();
          values[key] = val;
          saveValues();
        },
      },
      GM_getResourceText: {
        value: function (name) {
          for (var i in resources) if (name == i) {
            var text = cache[resources[i]];
            if (text) text = comm.utf8decode(window.atob(text));
            return text;
          }
        },
      },
      GM_getResourceURL: {
        value: function (name) {
          for (var k in resources) if (name == k) {
            var key = resources[k];
            var url = urls[key];
            if (!url) {
              var cc = cache[key];
              if (cc) {
                // Binary string is not supported by blob constructor,
                // so we have to transform it into array buffer.
                var bin = window.atob(cc);
                var arr = new window.Uint8Array(bin.length);
                for (var i = 0; i < bin.length; i ++) {
                  arr[i] = bin.charCodeAt(i);
                }
                var b = new Blob([arr]);
                urls[key] = url = URL.createObjectURL(b);
              } else {
                url = key;
              }
            }
            return url;
          }
        }
      },
      GM_addStyle: {
        value: function (css) {
          comm.post({cmd: 'AddStyle', data: css});
        },
      },
      GM_log: {
        value: function (data) {
          /* eslint-disable no-console */
          console.log(data);
          /* eslint-enable no-console */
        },
      },
      GM_openInTab: {
        value: function (url, background) {
          comm.post({cmd: 'OpenTab', data: {url: url, active: !background}});
        },
      },
      GM_registerMenuCommand: {
        value: function (cap, func, acc) {
          comm.command[cap] = func;
          comm.post({cmd: 'RegisterMenu', data: [cap, acc]});
        },
      },
      GM_xmlhttpRequest: {
        value: function (details) {
          if (!comm.Request) comm.initRequest();
          return comm.Request(details);
        },
      },
      GM_notification: {
        value: function (text, title, image, onclick) {
          if (!text) {
            throw 'Invalid parameters.';
          }
          var options = typeof text === 'object' ? text : {
            text: text,
            title: title,
            image: image,
            onclick: onclick,
          };
          var id = comm.notif[''] = (comm.notif[''] || 0) + 1;
          comm.notif[id] = options;
          comm.post({
            cmd: 'Notification',
            data: {
              id: id,
              text: options.text,
              title: options.title,
              image: options.image,
            },
          });
        },
      },
      GM_setClipboard: {
        value: function (text, type) {
          comm.post({
            cmd: 'SetClipboard',
            data: {
              type: type,
              data: text,
            },
          });
        },
      },
    };
    comm.forEach(grant, function (name) {
      var prop = gm_funcs[name];
      prop && addProperty(name, prop, gm);
    });
    return gm;
  },
  loadScript: function (data) {
    function buildCode(script) {
      var require = script.meta.require || [];
      var wrapper = comm.wrapGM(script, data.cache);
      // Must use Object.getOwnPropertyNames to list unenumerable properties
      var wrapperKeys = Object.getOwnPropertyNames(wrapper);
      var code = [
        comm.map(wrapperKeys, function (name) {
          return 'this["' + name + '"]=' + name;
        }).join(';') + ';with(this)!function(){',
      ];
      comm.forEach(require, function (key) {
        var script = data.require[key];
        if (script) {
          code.push(script);
          // Add `;` to a new line in case script ends with comment lines
          code.push(';');
        }
      });
      // wrap code to make 'use strict' work
      code.push('!function(){' + script.code + '\n}.call(this)');
      code.push('}.call(this);');
      code = code.join('\n');
      var name = script.custom.name || script.meta.name || script.id;
      var args = comm.map(wrapperKeys, function (key) {return wrapper[key];});
      var thisObj = wrapper.window || wrapper;
      if (comm.injectable) {
        // normal injection
        try {
          var func = Function.apply(null, wrapperKeys.concat([code]));
        } catch (e) {
          console.error('Syntax error in script: ' + name + '\n' + e.message);
          return;
        }
        comm.runCode(name, func, args, thisObj);
      } else {
        console.warn('[Violentmonkey] Script injection failed due to CSP!');
      }
    }
    function run(list) {
      while (list.length) buildCode(list.shift());
    }
    var comm = this;
    var start = [];
    var idle = [];
    var end = [];
    comm.command = {};
    comm.notif = {};
    comm.version = data.version;
    comm.values = {};
    // reset load and checkLoad
    comm.load = function () {
      run(end);
      setTimeout(run, 0, idle);
    };
    comm.checkLoad = function () {
      if (!comm.state && comm.includes(['interactive', 'complete'], document.readyState))
        comm.state = 1;
      if (comm.state) comm.load();
    };
    var listMap = {
      'document-start': start,
      'document-idle': idle,
      'document-end': end,
    };
    comm.forEach(data.scripts, function (script) {
      comm.values[script.uri] = data.values[script.uri] || {};
      if (script && script.enabled) {
        var list = listMap[script.custom['run-at'] || script.meta['run-at']] || end;
        list.push(script);
      }
    });
    run(start);
    comm.checkLoad();
  },
};

var menus = [];
var ids = [];
function handleC(e) {
  var req = e.detail;
  var maps = {
    GetRequestId: function () {
      sendMessage({cmd: 'GetRequestId'})
      .then(function (id) {
        comm.post({
          cmd: 'GotRequestId',
          data: id,
        });
      });
    },
    HttpRequest: function (data) {
      sendMessage({cmd: 'HttpRequest', data: data});
    },
    AbortRequest: function (id) {
      sendMessage({cmd: 'AbortRequest', data: id});
    },
    OpenTab: function (data) {
      sendMessage({cmd: 'OpenTab', data: data});
    },
    SetValue: function (data) {
      sendMessage({cmd: 'SetValue', data: data});
    },
    RegisterMenu: function (data) {
      if (window.top === window) menus.push(data);
      updatePopup();
    },
    AddStyle: function (css) {
      if (document.head) {
        var style = document.createElement('style');
        style.innerHTML = css;
        document.head.appendChild(style);
      }
    },
    Notification: onNotificationCreate,
    SetClipboard: function (data) {
      sendMessage({cmd: 'SetClipboard', data: data});
    },
  };
  var func = maps[req.cmd];
  if (func) func(req.data);
}

var notifications = {};
function onNotificationCreate(options) {
  sendMessage({cmd: 'Notification', data: options})
  .then(function (nid) {
    notifications[nid] = options.id;
  });
}
function onNotificationClick(nid) {
  var id = notifications[nid];
  id && comm.post({cmd: 'NotificationClicked', data: id});
}
function onNotificationClose(nid) {
  var id = notifications[nid];
  if (id) {
    comm.post({cmd: 'NotificationClosed', data: id});
    delete notifications[nid];
  }
}

function objEncode(obj) {
  var list = [];
  for (var i in obj) {
    if (!obj.hasOwnProperty(i)) continue;
    if (typeof obj[i] == 'function')
      list.push(i + ':' + obj[i].toString());
    else
      list.push(i + ':' + JSON.stringify(obj[i]));
  }
  return '{' + list.join(',') + '}';
}
function inject(code) {
  var script = document.createElement('script');
  var doc = document.body || document.documentElement;
  script.innerHTML = code;
  doc.appendChild(script);
  doc.removeChild(script);
}
function loadScript(data) {
  forEach(data.scripts, function (script) {
    ids.push(script.id);
    if (script.enabled) badge.number ++;
  });
  comm.post({cmd: 'LoadScript', data: data});
  badge.ready = true;
  updateBadge();
}
function initCommunicator() {
  var C = 'C';
  var R = 'R';
  inject(
    '!function(c,R,C){c.init(R,C);document.addEventListener("DOMContentLoaded",function(e){c.state=1;c.load();},false);c.checkLoad();}(' +
    objEncode(comm) + ',"' + R + '","' + C + '")'
  );
  comm.handleC = handleC;
  comm.init(C, R);
  sendMessage({cmd: 'GetInjected'}).then(loadScript);
}
initCommunicator();

var badge = {
  number: 0,
  ready: false,
  willSet: false,
};
function updatePopup() {
  post('Popup', {cmd: 'GetPopup'});
}
function updateBadge() {
  post('Background', {cmd: 'GetBadge'});
}
window.setPopup = function () {
  post('Popup', {
    cmd: 'SetPopup',
    data: {
      ids: ids,
      menus: menus,
    },
  });
};
window.setBadge = function () {
  post('Background', {cmd: 'SetBadge', data: badge.number});
};
document.addEventListener('DOMContentLoaded', updatePopup, false);

// For installation
function checkJS() {
  if (!document.querySelector('title')) {
    // plain text
    post('Background', {
      cmd: 'InstallScript',
      data: {
        url: location.href,
        from: document.referrer,
        text: document.body.textContent,
      },
    }, function () {
      if (history.length > 1) history.go(-1);
      else window.close();
    });
  }
}
if (!(/^file:\/\/\//.test(location.href)) && /\.user\.js$/.test(location.pathname)) {
  if (document.readyState == 'complete') checkJS();
  else window.addEventListener('load', checkJS, false);
}
