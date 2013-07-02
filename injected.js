/**
* http://www.webtoolkit.info/javascript-utf8.html
*/
function utf8decode (utftext) {
	var string = "";
	var i = 0;
	var c = 0, c1 = 0, c2 = 0, c3 = 0;
	while ( i < utftext.length ) {
		c = utftext.charCodeAt(i);
		if (c < 128) {string += String.fromCharCode(c);i++;}
		else if((c > 191) && (c < 224)) {
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

// Messages
var rt=window.external.mxGetRuntime(),id=Date.now()+Math.random().toString().slice(1);
function post(topic,data,o){
	if(!o) o={};
	if(!o.source) o.source=id;
	if(!o.origin) o.origin=window.location.href;
	o.data=data;
	rt.post(topic,o);
}
function setPopup(){post('SetPopup',[menu,ids]);}
rt.listen(id,function(o,c){
	if(o.topic=='FoundScript') loadScript(o);
	else if(o.topic=='Command') {c=command[o.data];if(c) c();}
	else if(o.topic=='ConfirmInstall') confirmInstall(o.data);
	else if(o.topic=='ShowMessage') showMessage(o.data);
});
function showMessage(data){
	var d=document.createElement('div');
	d.setAttribute('style','position:fixed;border-radius:5px;background:orange;padding:20px;z-index:9999;box-shadow:5px 10px 15px rgba(0,0,0,0.4);transition:opacity 1s linear;opacity:0;text-align:left;');
	document.body.appendChild(d);d.innerHTML=data;
	d.style.top=(window.innerHeight-d.offsetHeight)/2+'px';
	d.style.left=(window.innerWidth-d.offsetWidth)/2+'px';
	function close(){document.body.removeChild(d);delete d;}
	d.onclick=close;	// close immediately
	setTimeout(function(){d.style.opacity=1;},1);	// fade in
	setTimeout(function(){d.style.opacity=0;setTimeout(close,1000);},3000);	// fade out
}
function confirmInstall(data){
	if(!data||!confirm(data)) return;
	if(installCallback) installCallback(); else post('ParseScript',{code:document.body.innerText});
}

// For UserScripts installation
var installCallback=null;
if(/\.user\.js$/.test(window.location.href)) (function(){
	function install(){
		if(document&&document.body&&!document.querySelector('title')) post('InstallScript');
	}
	if(document.readyState!='complete') window.addEventListener('load',install,false);
	else install();
})(); else if(['userscripts.org','j.mozest.com'].indexOf(window.location.host)>=0) window.addEventListener('click',function(e){
	var o=e.target;while(o&&o.tagName!='A') o=o.parentNode;
	if(o&&/\.user\.js$/.test(o.href)) {
		e.preventDefault();
		installCallback=function(){post('InstallScript',o.href);};
		post('InstallScript');
	}
},false);

// For injected scripts
var p=document.createElement('p');
p.setAttribute('onclick','return window;');
var unsafeWindow=p.onclick();
delete p;
var start=[],body=[],end=[],cache,values,ids=[],menu=[],command={},elements;
function run_code(c){
	var w=new wrapper(c),require=c.meta.require||[],i,r,code=[];
	elements.forEach(function(i){code.push(i+'=window.'+i);});
	code=['(function(){var '+code.join(',')+';'];
	for(i=0;i<require.length;i++) try{
		r=cache[require[i]];if(!r) continue;
		code.push(utf8decode(r));
	}catch(e){console.log(e+'\n'+e.stack);}
	code.push(c.code);
	code.push('})();');
	this.code=code.join('\n');
	try{with(w) eval(this.code);}catch(e){
		i=e.stack.lastIndexOf('\n    at run_code.eval');
		if(i>0) e.stack=e.stack.slice(0,i).replace(/eval at run_code \(mxaddon-pkg:[^\)]*\), /g,'');
		e.message='Error running script: '+(c.custom.name||c.meta.name||c.id);
		console.log(e+'\n'+e.stack);
	}
}
function runStart(){while(start.length) new run_code(start.shift());}
function runBody(){
	if(document.body) {
		window.removeEventListener('DOMNodeInserted',runBody,true);
		while(body.length) new run_code(body.shift());
	}
}
function runEnd(){while(end.length) new run_code(end.shift());}
function loadScript(o){
	var l;
	(ids=o.ids).forEach(function(i){
		i=o.map[i];
		if(i&&i.enabled) {
			switch(i.custom['run-at']||i.meta['run-at']){
				case 'document-start': l=start;break;
				case 'document-body': l=body;break;
				default: l=end;
			}
			l.push(i);
		}
	});
	cache=o.cache;
	values=o.values;
	// TODO: post scripts to top
	runStart();
	window.addEventListener('DOMNodeInserted',runBody,true);
	window.addEventListener('DOMContentLoaded',runEnd,false);
	runBody();
	if(document.readyState=='complete') runEnd();
	post('GetPopup');
}
function propertyToString(){return 'Property for Violentmonkey: designed by Gerald';}
function wrapper(c){
	var t=this,value=values[c.id];if(!value) value={};

	// functions and properties
	function wrapFunction(o,i,c){
		var f=function(){
			var r;
			try{r=Function.apply.apply(o[i],[o,arguments]);}
			catch(e){console.log('Error calling '+i+': \n'+e.stack);}
			if(c) r=c(r);return r;
		};
		f.__proto__=o[i];f.prototype=o[i].prototype;
		return f;
	}
	function wrapWindow(w){return w==window?t:w;}
	function wrapItem(i){
		try{	// avoid reading protected data*/
			if(typeof window[i]=='function') {
				if(itemWrapper) t[i]=itemWrapper(window,i,wrapWindow);
				else t[i]=window[i];
			} else Object.defineProperty(t,i,{
				get:function(){return wrapWindow(window[i]);},
				set:function(v){window[i]=v;},
			});
		}catch(e){}
	}
	var itemWrapper=null;
	Object.getOwnPropertyNames(window).forEach(wrapItem);
	itemWrapper=wrapFunction;
	n=window;while(n=Object.getPrototypeOf(n)) Object.getOwnPropertyNames(n).forEach(wrapItem);

	function getCache(name){for(var i in resources) if(name==i) return cache[resources[i]];}
	function addProperty(name,prop,obj){
		if('value' in prop) prop.writable=false;
		prop.configurable=false;
		if(!obj) {obj=t;elements.push(name);}
		Object.defineProperty(obj,name,prop);
		if(typeof obj[name]=='function') obj[name].toString=propertyToString;
	}
	var resources=c.meta.resources||{};elements=[];
	addProperty('XMLHttpRequest',{value:unsafeWindow.XMLHttpRequest});
	// GM functions
	// Reference: http://wiki.greasespot.net/Greasemonkey_Manual:API
	addProperty('GM_info',{get:function(){
		var m=c.code.match(/\/\/\s+==UserScript==\s+([\s\S]*?)\/\/\s+==\/UserScript==\s/),
				script={
					description:c.meta.description||'',
					excludes:c.meta.exclude.concat(),
					includes:c.meta.include.concat(),
					matches:c.meta.match.concat(),
					name:c.meta.name||'',
					namespace:c.meta.namespace||'',
					resources:{},
					'run-at':c.meta['run-at']||'document-end',
					unwrap:false,
					version:c.meta.version||'',
				},
				o={};
		addProperty('script',{value:{}},o);
		addProperty('scriptMetaStr',{value:m?m[1]:''},o);
		addProperty('scriptWillUpdate',{value:c.update},o);
		addProperty('version',{value:undefined},o);
		for(m in script) addProperty(m,{value:script[m]},o.script);
		for(m in c.meta.resources) addProperty(m,{value:c.meta.resources[m]},o.script.resources);
		return o;
	}});
	addProperty('GM_deleteValue',{value:function(key){delete value[key];post('SetValue',{id:c.id,data:value});}});
	addProperty('GM_getValue',{value:function(k,d){
		var v=value[k];
		if(v) {
			k=v[0];
			v=v.slice(1);
			switch(k){
				case 'n': d=Number(v);break;
				case 'b': d=v=='true';break;
				case 'o': try{d=JSON.parse(v);}catch(e){console.log(e);}break;
				default: d=v;
			}
		}
		return d;
	}});
	addProperty('GM_listValues',{value:function(){return Object.getOwnPropertyNames(value);}});
	addProperty('GM_setValue',{value:function(key,val){
		var t=(typeof val)[0];
		switch(t){
			case 'o':val=t+JSON.stringify(val);break;
			default:val=t+val;
		}
		value[key]=val;post('SetValue',{id:c.id,data:value});
	}});
	addProperty('GM_getResourceText',{value:function(name){
		var b=getCache(name);
		if(b) b=utf8decode(b);
		return b;
	}});
	addProperty('GM_getResourceURL',{value:function(name){
		var b=getCache(name);
		if(b) b='data:;base64,'+window.btoa(b);
		return b;
	}});
	addProperty('GM_addStyle',{value:function(css){
		if(!document.head) return;
		var v=document.createElement('style');
		v.innerHTML=css;
		document.head.appendChild(v);
		return v;
	}});
	addProperty('GM_log',{value:console.log});
	addProperty('GM_openInTab',{value:function(url){window.open(url);}});
	addProperty('GM_registerMenuCommand',{value:function(cap,func,acc){
		menu.push([cap,acc]);command[cap]=func;post('GetPopup');
	}});
	addProperty('GM_xmlhttpRequest',{value:function(details){
		function callback(e){var c=details['on'+e.type];if(c) c(req);}
		var req=new XMLHttpRequest();
		req.open(details.method,details.url,!details.synchronous,details.user,details.password);
		if(details.headers) for(var i in details.headers) req.setRequestHeader(i,details.headers[i]);
		if(details.overrideMimeType) req.overrideMimeType(details.overrideMimeType);
		['abort','error','load','progress','readystatechange','timeout'].forEach(function(i){req['on'+i]=callback;});
		req.send(details.data||'');
		return req;
	}});
}
post('FindScript',window.location.href);
