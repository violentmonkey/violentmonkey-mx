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
var id=Date.now()+Math.random().toString().substr(1);
function post(topic,data){rt.post(topic,{source:id,origin:window.location.href,data:data});}
rt.listen(id,function(o,c){
	if(o.topic=='Command') {c=command[o.data];if(c) c();}
	else if(o.topic=='ConfirmInstall') confirmInstall(o.data);
	else if(o.topic=='ShowMessage') showMessage(o.data);
});
function setPopup(){post('SetPopup',[menu,scr]);}
function showMessage(data){
	var d=document.createElement('div');
	d.setAttribute('style','position:fixed;top:40%;left:40%;right:40%;border-radius:5px;background:orange;padding:20px;z-index:9999;box-shadow:5px 10px 15px rgba(0,0,0,0.4);transition:opacity 1s linear;opacity:0;text-align:left;');
	d.innerHTML=data;
	document.body.appendChild(d);
	function close(){document.body.removeChild(d);delete d;}
	d.onclick=close;	// close immediately
	setTimeout(function(){d.style.opacity=1;},1);	// fade in
	setTimeout(function(){d.style.opacity=0;setTimeout(close,1000);},3000);	// fade out
}
function confirmInstall(data){
	if(!data||!confirm(data)) return;
	if(installCallback) installCallback(); else {
		var id=Date.now()+Math.random().toString().substr(1);
		_data.temp[id]=document.body.innerText;_data.save();
		post('ParseScript',{id:id});
	}
}

// For UserScripts installation
var installCallback=null;
if(/\.user\.js$/.test(window.location.href)) (function(){
	function install(){
		if(document&&document.body&&!document.querySelector('title')) post('InstallScript');
	}
	if(document.readyState!='complete') window.addEventListener('load',install,false);
	else install();
})(); else if(window.location.host=='userscripts.org') window.addEventListener('click',function(e){
	if(/\.user\.js$/.test(e.target.href)) {
		e.preventDefault();
		installCallback=function(){post('InstallScript',e.target.href);};
		post('InstallScript');
	}
},false);

// For injected scripts
var p=document.createElement('p');
p.setAttribute('onclick','return window;');
var unsafeWindow=p.onclick();
delete p;
unsafeWindow[guid+'GetPopup']=setPopup;
var start=[],body=[],end=[],cache={},scr=[],menu=[],command={},elements;
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
	try{with(w) eval(this.code);}catch(e){console.log(e+'\n'+e.stack);}
}
function runStart(){while(start.length) new run_code(start.shift());}
function runBody(){
	if(document.body) {
		window.removeEventListener('DOMNodeInserted',runBody,true);
		while(body.length) new run_code(body.shift());
	}
}
function runEnd(){while(end.length) new run_code(end.shift());}
function loadScript(){
	var l;
	scr.forEach(function(i){
		if((i=_data.map[i])&&i.enabled) {
			switch(i.meta['run-at']){
				case 'document-start': l=start;break;
				case 'document-body': l=body;break;
				default: l=end;
			}
			l.push(i);
			if(i.meta.require) i.meta.require.forEach(function(i){var r=_data.cache[i];if(r) cache[i]=r;});
		}
	});
	runStart();
	window.addEventListener('DOMNodeInserted',runBody,true);
	window.addEventListener('DOMContentLoaded',runEnd,false);
	runBody();
	if(document.readyState=='complete') runEnd();
	rt.post('GetPopup');
}
function propertyToString(){return 'Property for Violentmonkey: designed by Gerald';}
function wrapper(c){
	var t=this,values=c.values;if(!values) c.values=values={};elements=[];
	function addProperty(name,prop){t[name]=prop;t[name].toString=propertyToString;elements.push(name);}
	var resources=c.meta.resources||{};
	addProperty('unsafeWindow',unsafeWindow);
	// GM functions
	// Reference: http://wiki.greasespot.net/Greasemonkey_Manual:API
	addProperty('GM_deleteValue',function(key){delete values[key];_data.save();});
	addProperty('GM_getValue',function(key,def){
		var v=values[key];
		if(v==null) return def;
		def=v.substr(1);
		switch(v[0]){
			case 'n': return parseInt(def,10);
			case 'b': return !!JSON.parse(def);
			default: return def;
		}
	});
	addProperty('GM_listValues',function(){
		var v=[],i;
		for(i in values) v.push(i);
		return v;
	});
	addProperty('GM_setValue',function(key,val){
		switch(typeof val){
			case 'number':val='n'+val;break;
			case 'boolean':val='b'+val;break;
			default:val='s'+val;
		}
		values[key]=val;_data.save();
	});
	function getCache(name){for(var i in resources) if(name==i) return _data.cache[resources[i]];}
	addProperty('GM_getResourceText',function(name){
		var b=getCache(name);
		if(b) b=utf8decode(b);
		return b;
	});
	addProperty('GM_getResourceURL',function(name){
		var b=getCache(name);
		if(b) b='data:;base64,'+btoa(b);
		return b;
	});
	addProperty('GM_addStyle',function(css){
		var v=document.createElement('style');
		v.innerHTML=css;
		(document.head||document.documentElement).appendChild(v);
		return v;
	});
	addProperty('GM_log',console.log);
	addProperty('GM_openInTab',function(url){window.open(url);});
	addProperty('GM_registerMenuCommand',function(cap,func,acc){menu.push([cap,acc]);command[cap]=func;});
	addProperty('GM_xmlhttpRequest',function(details){
		function callback(e){var c=details['on'+e.type];if(c) c(req);}
		var req=new XMLHttpRequest();
		req.open(details.method,details.url,!details.synchronous,details.user,details.password);
		if(details.headers) for(var i in details.headers) req.setRequestHeader(i,details.headers[i]);
		if(details.overrideMimeType) req.overrideMimeType(details.overrideMimeType);
		req.onload=req.onreadystatechange=callback;
		req.send(details.data||'');
		return req;
	});
	addProperty('VM_info',{version:0.1});
	// functions and properties
	function wrapFunction(o,i,c){
		var f=function(){var r=o[i].apply(o,arguments);if(c) r=c(r);return r;};
		return f;
	}
	function wrapWindow(w){return w==window?t:w;}
	function wrapItem(i,nowrap){
	       	try{	// avoid reading protected data*/
			if(typeof window[i]=='function') {
				if(nowrap) t[i]=window[i];
				else t[i]=wrapFunction(window,i,wrapWindow);
			}
			else {
				t.__defineGetter__(i,function(){return wrapWindow(window[i]);});
				t.__defineSetter__(i,function(v){window[i]=v;});
			}
		}catch(e){}
	}
	Object.getOwnPropertyNames(window).forEach(wrapItem);
	for(n in window.Window.prototype) wrapItem(n);
}
function testURL(url,e){
	function str2RE(s){return s.replace(/(\.|\?|\/)/g,'\\$1').replace(/\*/g,'.*?');}
	function reg(s,w){	// w: forced wildcard mode
		if(!w&&/^\/.*\/$/.test(s)) return RegExp(s.slice(1,-1));	// Regular-expression
		return RegExp('^'+str2RE(s)+'$');	// String with wildcards
	}
	function match_test(s){
		var m=s.match(r);
		if(m&&u) for(var i=0;i<3;i++) if(!reg(m[i],1).test(u[i])) {m=0;break;}
		return !!m;
	}
	var f=true,i,inc=[],exc=[],mat=[],r=/(.*?):\/\/([^\/]*)\/(.*)/,u=url.match(r);
	if(e.custom._include!=false&&e.meta.include) inc=inc.concat(e.meta.include);
	if(e.custom.include) inc=inc.concat(e.custom.include);
	if(e.custom._match!=false&&e.meta.match) mat=mat.concat(e.meta.match);
	if(e.custom.match) mat=mat.concat(e.custom.match);
	if(e.custom._exclude!=false&&e.meta.exclude) exc=exc.concat(e.meta.exclude);
	if(e.custom.exclude) exc=exc.concat(e.custom.exclude);
	if(mat.length) {for(i=0;i<mat.length;i++) if(f=match_test(mat[i])) break;}	// @match
	else for(i=0;i<inc.length;i++) if(f=reg(inc[i]).test(url)) break;	// @include
	if(f) for(i=0;i<exc.length;i++) if(!(f=!reg(exc[i]).test(url))) break;	// @exclude
	return f;
}
(function(url){
	scr=[];
	if(url.substr(0,5)!='data:') _data.ids.forEach(function(i){
		if(testURL(url,_data.map[i])) scr.push(i);
	});
	if(_data.data.isApplied) loadScript();
})(window.location.href);
