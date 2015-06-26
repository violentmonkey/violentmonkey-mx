'use strict';

var rt = window.external.mxGetRuntime();
var br = rt.create('mx.browser');
var $ = document.querySelector.bind(document);
var $$ = document.querySelectorAll.bind(document);
var stopPropagation = function(e) {e.stopPropagation();};
var defaults = {
	isApplied: true,
	startReload: true,
	reloadHTTPS: false,
	autoUpdate: true,
	//ignoreGrant: false,
	lastUpdate: 0,
	showBadge: true,
	exportValues: true,
	closeAfterInstall: false,
	trackLocalFile: false,
	//injectMode: 0,
};

function getOption(key, def) {
	var value = localStorage.getItem(key), obj;
	if(value) try {
		obj = JSON.parse(value);
	} catch(e) {
		obj = def;
	} else obj = def;
	if(typeof obj === 'undefined')
		obj = defaults[key];
	return obj;
}

function setOption(key, value) {
	if(key in defaults)
		localStorage.setItem(key, JSON.stringify(value));
}

function getAllOptions() {
	var options = {};
	for(var i in defaults) options[i] = getOption(i);
	return options;
}

// Debug
/*var bugs={};
window.addEventListener('error',function(e){
	console.log(e);
	if(!bugs[e.lineno]) {
		bugs[e.lineno]=e.message;
		var n=window.webkitNotifications.createNotification('','Error - Violentmonkey','Line '+e.lineno+' >>> '+e.message);
		n.show();
	}
});*/

function _(key, args) {
	var data = '';
	if(key) {
		data = rt.locale.t(key);
		args = args || [];
		args.unshift(key);
		if(/^".*"$/.test(data)) try {
			data = JSON.parse(data);
		} catch(e) {
			data = data.slice(1, -1);
		}
		data = data.replace(/\$(?:\{(\d+)\}|(\d+))/g, function(value, group1, group2) {
			var index = typeof group1 != 'undefined' ? group1 : group2;
			var arg = args[index];
			return typeof arg == 'undefined' ? value : arg;
		});
	}
	//return data || args[0] || '';
	return data;
}

function safeHTML(html) {
	return html.replace(/[&<]/g, function(m) {
		return {
			'&': '&amp;',
			'<': '&lt;',
		}[m];
	});
}

function initI18n(callback) {
	window.addEventListener('DOMContentLoaded', function() {
		Array.prototype.forEach.call($$('[data-i18n]'), function(node) {
			node.innerHTML = _(node.dataset.i18n);
		});
		if(callback) callback();
	}, false);
}

// Get locale attributes such as @name:zh-CN
function getLocaleString(dict, key) {
	var lang = [navigator.language];
	var i = lang[0].indexOf('-');
	if(i>0) lang.push(lang[0].slice(0, i));
	for(i = 0; i < lang.length; i ++) {
		var lkey = key + ':' + lang[i];
		if(lkey in dict) {
			key = lkey;
			break;
		}
	}
	return dict[key] || '';
}

function getUniqId() {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function initMessage(map) {
	var id = getUniqId();
	var callbacks = {};
	map = map || {};
	map.Callback = function (ret) {
		var func = callbacks[ret.id];
		if (func) {
			func(ret.data);
			delete callbacks[ret.id];
		}
	};
	rt.listen(id, function(ret) {
		var func = map[ret.cmd];
		if (func) func(ret.data);
	});
	return function (data, callback) {
		data.src = {id: id};
		if (callback) {
			data.callback = getUniqId();
			callbacks[data.callback] = callback;
		}
		rt.post('Background', data);
	};
}

function injectContent(s) {
	br.executeScript('if(window.mx)try{' + s + '}catch(e){}');
}

function debounce(cb, delay) {
	var timer = null;
	function call() {
		cb();
		timer = null;
	}
	return function () {
		if (timer) clearTimeout(timer);
		timer = setTimeout(call, delay);
	};
}
