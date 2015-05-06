'use strict';

var rt = window.external.mxGetRuntime();
var br = rt.create('mx.browser');
var $ = document.querySelector.bind(document);
var $$ = document.querySelectorAll.bind(document);
var stopPropagation = function(e) {e.stopPropagation();};

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

function _() {
	var args = arguments, data = '';
	if(args[0]) {
		data = rt.locale.t(args[0]);
		if(/^".*"$/.test(data)) try {
			data = JSON.parse(data);
		} catch(e) {
			data = data.slice(1,-1);
		}
		data = data.replace(/\$(?:\{(\d+)\}|(\d+))/g, function(value, group1, group2) {
			var index = typeof group1 != 'undefined' ? group1 : group2;
			return index >= args.length ? value : (args[index] || '');
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

function initI18n(callback){
	window.addEventListener('DOMContentLoaded', function() {
		Array.prototype.forEach.call($$('[data-i18n]'), function(node) {
			node.innerHTML = _(node.getAttribute('data-i18n'));
		});
		if(callback) callback();
	}, false);
}

// Get locale attributes such as @name:zh-CN
function getLocaleString(dict,key){
	var lang=[navigator.language],i,lkey;
	i=lang[0].indexOf('-');
	if(i>0) lang.push(lang[0].substr(0,i));
	for(i=0;i<lang.length;i++) {
		lkey=key+':'+lang[i];
		if(lkey in dict) {
			key=lkey;break;
		}
	}
	return dict[key]||'';
}

function getUniqId() {
	return Date.now().toString(36)+Math.random().toString(36).slice(2,6);
}

function initMessage(map){
	var id=getUniqId(),callbacks={};
	if(!map) map={};
	map.Callback=function(o){
		var f=callbacks[o.id];
		if(f) {
			f(o.data);
			delete callbacks[o.id];
		}
	};
	rt.listen(id,function(o){
		var f=map[o.cmd];
		if(f) f(o.data);
	});
	return function(o,callback){
		o.src={id:id};
		if(callback) {
			o.callback=getUniqId();
			callbacks[o.callback]=callback;
		}
		rt.post('Background',o);
	};
}

function injectContent(s){br.executeScript('if(window.mx)try{'+s+'}catch(e){}');}
