(function(){
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
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Base64_encoding_and_decoding
function b64ToArr(sBase64, nBlocksSize) {
	function b64ToUint6 (nChr) {
		return nChr > 64 && nChr < 91 ?
				nChr - 65
			: nChr > 96 && nChr < 123 ?
				nChr - 71
			: nChr > 47 && nChr < 58 ?
				nChr + 4
			: nChr === 43 ?
				62
			: nChr === 47 ?
				63
			:
				0;
	}
  var
    sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length,
    nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2, taBytes = new Uint8Array(nOutLen);
  for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
    nMod4 = nInIdx & 3;
    nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
    if (nMod4 === 3 || nInLen - nInIdx === 1) {
      for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
        taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
      }
      nUint24 = 0;
    }
  }
  return taBytes;		// taBytes.buffer is ArrayBuffer
}


// Messages
var rt=window.external.mxGetRuntime(),id=Date.now()+Math.random().toString().slice(1),
		callbacks={};
function post(d,o,callback){
	o.src={id:id,url:window.location.href};
	if(callback) {
		o.callback=Math.random().toString();
		callbacks[o.callback]=callback;
	}
	rt.post(d,o);
}
rt.listen(id,function(o){
	var maps={
		Command:command,
		Callback:function(o){
			var f=callbacks[o.id];
			if(f) f(o.data);
			delete callbacks[o.id];
		},
	},f=maps[o.cmd];
	if(f) f(o.data);
});

// Communicator
var comm={
	vmid:'VM'+Math.random(),
	sid:null,
	did:null,
	elements:null,
	state:0,
	load:function(){},
	utf8decode:utf8decode,
	b64ToArr:b64ToArr,
	prop1:Object.getOwnPropertyNames(window),
	prop2:(function(n,p){
		while(n=Object.getPrototypeOf(n)) p=p.concat(Object.getOwnPropertyNames(n));
		return p;
	})(window,[]),
	init:function(s,d){
		this.sid=this.vmid+s;
		this.did=this.vmid+d;
		document.addEventListener(this.sid,this['handle'+s].bind(this),false);
	},
	post:function(d){
		var e=document.createEvent("MutationEvent");
		e.initMutationEvent(this.did,false,false,null,null,null,JSON.stringify(d),e.ADDITION);
		document.dispatchEvent(e);
	},
	handleR:function(e){
		var o=JSON.parse(e.attrName),comm=this,maps={
			LoadScript:comm.loadScript.bind(comm),
			Command:function(o){
				var f=comm.command[o];
				if(f) f();
			},
			GotRequestId:function(o){comm.qrequests.shift().start(o);},
			HttpRequested:function(o){
				var c=comm.requests[o.id];
				if(c) c.callback(o);
			},
		},f=maps[o.cmd];
		if(f) f(o.data);
	},
	loadScript:function(o){
		var start=[],idle=[],end=[],cache,urls={},require,values,comm=this;
		comm.command={};comm.requests={};comm.qrequests=[];
		function wrapper(c){
			var t=this,value=values[c.uri];if(!value) value={};

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
				try{	// avoid reading protected data
					if(typeof window[i]=='function') {
						if(itemWrapper) t[i]=itemWrapper(window,i,wrapWindow);
						else t[i]=window[i];
					} else Object.defineProperty(t,i,{
						get:function(){return wrapWindow(window[i]);},
						set:function(v){window[i]=v;},
					});
				}catch(e){}
			}
			var itemWrapper=null;comm.prop1.forEach(wrapItem);
			itemWrapper=wrapFunction;comm.prop2.forEach(wrapItem);

			function getCache(name){for(var i in resources) if(name==i) return cache[resources[i]];}
			function propertyToString(){return 'Property for Violentmonkey: designed by Gerald';}
			function addProperty(name,prop,obj){
				if('value' in prop) prop.writable=false;
				prop.configurable=false;
				if(!obj) {obj=t;ele.push(name);}
				Object.defineProperty(obj,name,prop);
				if(typeof obj[name]=='function') obj[name].toString=propertyToString;
			}
			var resources=c.meta.resources||{},ele=[];
			addProperty('unsafeWindow',{value:window});

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
			addProperty('GM_deleteValue',{value:function(key){delete value[key];comm.post({cmd:'SetValue',data:{uri:c.uri,values:value}});}});
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
				value[key]=val;comm.post({cmd:'SetValue',data:{uri:c.uri,values:value}});
			}});
			addProperty('GM_getResourceText',{value:function(name){
				var b=getCache(name);
				if(b) b=comm.utf8decode(b);
				return b;
			}});
			addProperty('GM_getResourceURL',{value:function(name){
				var i,u=null,b;
				for(i in resources) if(name==i) {
					i=resources[i];u=urls[i];
					if(!u&&(b=cache[i])) {
						b=new Blob([comm.b64ToArr(b)]);
						urls[i]=u=URL.createObjectURL(b);
					}
					break;
				}
				return u;
			}});
			addProperty('GM_addStyle',{value:function(css){
				if(!document.head) return;
				var v=document.createElement('style');
				v.innerHTML=css;
				document.head.appendChild(v);
				return v;
			}});
			addProperty('GM_log',{value:function(d){console.log(d);}});
			addProperty('GM_openInTab',{value:function(url){window.open(url);}});
			addProperty('GM_registerMenuCommand',{value:function(cap,func,acc){
				comm.command[cap]=func;comm.post({cmd:'RegisterMenu',data:[cap,acc]});
			}});
			function Request(details){
				this.callback=function(d){
					var c=details['on'+d.type];
					if(c) c(d.data);
					if(!this.id) for(var i in d.data) this.req[i]=d.data[i];
					if(d.type=='load') delete comm.requests[this.id];
				};
				this.start=function(id){
					this.id=id;
					comm.requests[id]=this;
					comm.post({cmd:'HttpRequest',data:{
						id:id,
						method:details.method,
						url:details.url,
						data:details.data,
						async:!details.synchronous,
						user:details.user,
						password:details.password,
						headers:details.headers,
						overrideMimeType:details.overrideMimeType,
					}});
				};
				this.req={
					abort:function(){comm.post({cmd:'AbortRequest',data:this.id});}
				};
				comm.qrequests.push(this);
				comm.post({cmd:'GetRequestId'});
			};
			addProperty('GM_xmlhttpRequest',{value:function(details){
				var r=new Request(details);
				return r.req;
			}});
			if(!comm.elements) comm.elements=ele;
		}
		function run(l){while(l.length) runCode(l.shift());}
		function runCode(c){
			var req=c.meta.require||[],r=[],code=[],w=new wrapper(c);
			comm.elements.forEach(function(i){r.push(i+'=window.'+i);});
			code=['(function(){'];
			if(r.length) code.push('var '+r.join(',')+';');
			req.forEach(function(i){r=require[i];if(r) code.push(r);});
			code.push(c.code);code.push('}).call(window);');
			code=code.join('\n');
			try{
				(new Function('w','with(w) '+code)).call(this,w);
			}catch(e){
				console.log('Error running script: '+(c.custom.name||c.meta.name||c.id)+'\n'+e);
			}
		}
		comm.load=function(){
			if(comm.state>0) run(idle);
			if(comm.state>1) run(end);
		};

		var l;
		o.scripts.forEach(function(i){
			if(i&&i.enabled) {
				switch(i.custom['run-at']||i.meta['run-at']){
					case 'document-start': l=start;break;
					case 'document-idle': l=idle;break;
					default: l=end;
				}
				l.push(i);
			}
		});
		require=o.require;
		cache=o.cache;
		values=o.values;
		run(start);comm.load();
	},
},menu=[],ids=[],count=0;
function handleC(e){
	var o=JSON.parse(e.attrName),maps={
		SetValue:function(o){post('Background',{cmd:'SetValue',data:o});},
		RegisterMenu:function(o){menu.push(o);updatePopup();},
		GetRequestId:getRequestId,
		HttpRequest:httpRequest,
		AbortRequest:abortRequest,
	},f=maps[o.cmd];
	if(f) f(o.data);
}
function command(o){
	comm.post({cmd:'Command',data:o});
}

// Requests
var requests={};
function getRequestId() {
  var id=Date.now()+Math.random().toString().slice(1);
  requests[id]=new XMLHttpRequest();
	comm.post({cmd:'GotRequestId',data:id});
}
function httpRequest(details) {
  function callback(evt) {
    comm.post({
      cmd: 'HttpRequested',
      data: {
        id: details.id,
        type: evt.type,
        data: {
          readyState: req.readyState,
          responseHeaders: req.getAllResponseHeaders(),
          responseText: req.responseText,
          status: req.status,
          statusText: req.statusText
        }
      }
    });
  }
  var i,req;
  if(details.id) req=requests[details.id]; else req=new XMLHttpRequest();
  try {
    req.open(details.method,details.url,details.async,details.user,details.password);
    if(details.headers) for(i in details.headers) req.setRequestHeader(i,details.headers[i]);
    if(details.overrideMimeType) req.overrideMimeType(details.overrideMimeType);
    ['abort','error','load','progress','readystatechange','timeout'].forEach(function(i) {
      req['on'+i]=callback;
    });
    req.send(details.data);
    if(!details.id) callback({type:'load'});
  } catch (e) {
		console.log(e);
  }
}
function abortRequest(id) {
  var req=requests[id];
  if(req) req.abort();
  delete requests[id];
}

// For injected scripts
function objEncode(o){
	var t=[],i;
	for(i in o) {
		if(!o.hasOwnProperty(i)) continue;
		if(typeof o[i]=='function') t.push(i+':'+o[i].toString());
		else t.push(i+':'+JSON.stringify(o[i]));
	}
	return '{'+t.join(',')+'}';
}
function initCommunicator(){
	var s=document.createElement('script'),d=document.documentElement,C='C',R='R';
	s.innerHTML='(function(){var c='+objEncode(comm)+';c.init("'+R+'","'+C+'");\
document.addEventListener("readystatechange",function(){c.state=["loading","interactive","complete"].indexOf(document.readyState);c.load();},false);\
document.addEventListener("DOMContentLoaded",function(){c.state=2;c.load();},false);})();';
	d.appendChild(s);d.removeChild(s);
	comm.handleC=handleC;comm.init(C,R);
	post('Background',{cmd:'GetInjected'},loadScript);
}
function loadScript(o){
	o.scripts.forEach(function(i){
		ids.push(i.id);
		if(i.enabled) count+=1;
	});
	comm.post({cmd:'LoadScript',data:o});
}
initCommunicator();

var popup=0;
function updatePopup(){
	popup++;
	setTimeout(function(){
		if(!--popup) post('Popup',{cmd:'GetPopup'});
	},100);
}
function updateBadge(){post('Background',{cmd:'GetBadge'});}
window.setPopup=function(){post('Popup',{cmd:'SetPopup',data:[menu,ids]});};
window.setBadge=function(){post('Background',{cmd:'SetBadge',data:count});};
document.addEventListener("DOMContentLoaded",updatePopup,false);
document.addEventListener("DOMContentLoaded",updateBadge,false);
})();
