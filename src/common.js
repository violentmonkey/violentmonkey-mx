'use strict';

var _ = window._ || {};
_.mx = {
	rt: window.external.mxGetRuntime(),
};
_.mx.br = _.mx.rt.create('mx.browser');

_.i18n = function (key, args) {
	if (!key) return '';
	var data = _.mx.rt.locale.t(key);
	args = args || [];
	args.unshift(key);
	if (/^".*"$/.test(data)) try {
		data = JSON.parse(data);
	} catch (e) {
		data = data.slice(1, -1);
	}
	data = data.replace(/\$(?:\{(\d+)\}|(\d+))/g, function(match, group1, group2) {
		var arg = args[group1 || group2];
		return arg == null ? match : arg;
	});
	return data;
};

_.options = function () {
	var defaults = {
		isApplied: true,
		startReload: true,
		reloadHTTPS: false,
		autoUpdate: true,
		ignoreGrant: false,
		lastUpdate: 0,
		showBadge: true,
		exportValues: true,
		closeAfterInstall: false,
		trackLocalFile: false,
		injectMode: 0,
	};

  function getOption(key, def) {
    var value = localStorage.getItem(key), obj;
    if (value)
      try {
        obj = JSON.parse(value);
      } catch(e) {
        obj = def;
      }
      else obj = def;
      if (obj == null) obj = defaults[key];
      return obj;
  }

  function setOption(key, value) {
    if (key in defaults)
      localStorage.setItem(key, JSON.stringify(value));
  }

  function getAllOptions() {
    var options = {};
    for (var i in defaults) options[i] = getOption(i);
    return options;
  }

	return {
		get: getOption,
		set: setOption,
		getAll: getAllOptions,
	};
}();

_.updateCheckbox = function (e) {
  var target = e.target;
  _.options.set(target.dataset.check, target.checked);
};

_.zfill = function (num, length) {
  num = num.toString();
  while (num.length < length) num = '0' + num;
  return num;
};

_.getUniqId = function () {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
};

/**
 * Get locale attributes such as `@name:zh-CN`
 */
_.getLocaleString = function (meta, key) {
	var languages = [navigator.language];
	var i = languages[0].indexOf('-');
	if (i > 0) languages.push(languages[0].slice(0, i));
  var lang = _.find(languages, function (lang) {
    return (key + ':' + lang) in meta;
  });
  if (lang) key += ':' + lang;
  return meta[key] || '';
};

_.getMessenger = function (commands) {
	var id = _.getUniqId();
	var callbacks = {};
	commands = commands || {};
	commands.Callback = function (ret) {
		var func = callbacks[ret.id];
		if (func) {
			delete callbacks[ret.id];
			func(ret.data);
		}
	};
	_.mx.rt.listen(id, function (ret) {
		var func = commands[ret.cmd];
		func && func(ret.data);
	});
	return function (data) {
		return new Promise(function (resolve, reject) {
			data.src = {id: id};
			callbacks[data.callback = _.getUniqId()] = function (res) {
				res && res.error ? reject(res.error) : resolve(res && res.data);
			};
			_.mx.rt.post('Background', data);
		});
	};
};

_.injectContent = function (s) {
	br.executeScript('if(window.mx)try{' + s + '}catch(e){}');
};
