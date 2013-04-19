/* ============== Data format ==============
 * ids	List [id]
 * vm:id	Item	{
 * 		id:	Random
 * 		custom:	List-Dict	// Custom meta data
 * 		meta:	List-Dict
 *		enabled:	Boolean
 *		update:	Boolean
 *		code:	String
 *	 	}
 * val:nameURI	Dict
 * cache:url	BinaryString
 */
function getNameURI(i){
	var ns=i.meta.namespace||'',n=i.meta.name||'',k=escape(ns)+':'+escape(n)+':';
	if(!ns&&!n) k+=i.id;return k;
}

// Check Maxthon version
(function(v){
	if(getString('warnObsolete')) return;
	setString('warnObsolete','1');
	function older(a,b,c,d){
		a=a.split('.');b=b.split('.');c=d=0;
		while(a.length||b.length){
			c=parseInt(a.shift())||0;
			d=parseInt(b.shift())||0;
			if(c!=d) break;
		}
		return c<d;
	}
	if(older(v,'4.0.3.5000')) {
		mx.locale();
		var v=mx.getSystemLocale(),o=['en','zh-cn'],i=o.indexOf(v);if(i<0) v=o[0];
		br.tabs.newTab({url:rt.getPrivateUrl()+'oldversion/'+v+'.html',activate:true});
	}
})(window.external.mxVersion);

// Initiate settings
(function(){	// Upgrade data from Violentmonkey 1, irreversibly
	var k,v=rt.storage.getConfig('data'),o;
	if(v) try{
		rt.storage.setConfig('data',null);
		v=JSON.parse(v);
		setItem('ids',v.ids);
		for(k in v.map) {
			o=v.map[k];
			if(o.values) {setItem('val:'+getNameURI(o),o.values);delete o.values;}
			setItem('vm:'+k,o);
		}
		for(k in v.cache) setString('cache:'+k,v.cache[k]);
		setItem('installFile',v.installFile);
		setItem('isApplied',v.isApplied);
		setString('search',v.search);
	}catch(e){}
})();

function init(){
	getItem('showDetails',true);
	getItem('installFile',true);
	getItem('compress',true);
	getItem('withData',true);
	getItem('autoUpdate',true);
	isApplied=getItem('isApplied',true);
	getString('search',_('Search$1'));
	ids=[];map={};gExc=getItem('gExc',[]);
	getItem('ids',[]).forEach(function(i){
		var o=getItem('vm:'+i);
		if(o) {ids.push(i);map[i]=o;}
	});
}
var isApplied,ids,map,gExc;
init();

rt.listen('Clear',function(){localStorage.clear();init();rt.post('Cleared');});
rt.listen('Vacuum',function(){
	var k,s,i,cc={},ns={};
	ids.forEach(function(i){
		k=map[i];
		if(k.meta.icon) cc[k.meta.icon]=1;
		if(k.meta.require) k.meta.require.forEach(function(i){cc[i]=1;});
		if(k.meta.resources) for(i in k.meta.resources) cc[i]=1;
		ns[getNameURI(k)]=1;
	});
	for(i in cc) if(localStorage.getItem('cache:'+i)==null) fetchCache(i);
	for(i=0;k=localStorage.key(i);i++) {
		if((s=k.match(/^val:([^:]*:[^:]*:[^:]*)/))&&!ns[s[1]]) localStorage.removeItem(k);
		else if((s=k.match(/^cache:(.*)/))&&!cc[s[1]]) localStorage.removeItem(k);
		else i++;
	}
	rt.post('Vacuumed');
});

function newMeta(){return {name:'New Script',namespace:''};}
function newScript(save){
	var r={
		custom:{},
		meta:newMeta(),
		enabled:1,
		update:1,
		code:'// ==UserScript==\n// @name New Script\n// ==/UserScript==\n'
	};
	r.id=Date.now()+Math.random().toString().substr(1);
	if(save) saveScript(r);
	return r;
}
function saveIDs(){setItem('ids',ids);}
function saveScript(o){
	if(!map[o.id]) {ids.push(o.id);saveIDs();}
	setItem('vm:'+o.id,map[o.id]=o);
}
function removeScript(i){
	i=ids.splice(i,1)[0];saveIDs();
	delete map[i];
	localStorage.removeItem('vm:'+i);
}

function str2RE(s){return s.replace(/(\.|\?|\/)/g,'\\$1').replace(/\*/g,'.*?');}
function autoReg(s,w){	// w: forced wildcard mode
	if(!w&&/^\/.*\/$/.test(s)) return RegExp(s.slice(1,-1));	// Regular-expression
	return RegExp('^'+str2RE(s)+'$');	// String with wildcards
}
var match_reg=/(.*?):\/\/([^\/]*)\/(.*)/;
function matchTest(s,u){
	var m=s.match(match_reg);
	if(m&&u) for(var i=0;i<3;i++) if(!autoReg(m[i],1).test(u[i])) {m=0;break;}
	return u&&!!m;
}
function testURL(url,e){
	var f=true,i,inc=[],exc=[],mat=[],u=url.match(match_reg);
	if(e.custom._match!=false&&e.meta.match) mat=mat.concat(e.meta.match);
	if(e.custom.match) mat=mat.concat(e.custom.match);
	if(e.custom._include!=false&&e.meta.include) inc=inc.concat(e.meta.include);
	if(e.custom.include) inc=inc.concat(e.custom.include);
	if(e.custom._exclude!=false&&e.meta.exclude) exc=exc.concat(e.meta.exclude);
	if(e.custom.exclude) exc=exc.concat(e.custom.exclude);
	if(mat.length) {for(i=0;i<mat.length;i++) if(f=matchTest(mat[i],u)) break;}	// @match
	else for(i=0;i<inc.length;i++) if(f=autoReg(inc[i]).test(url)) break;	// @include
	if(f) for(i=0;i<exc.length;i++) if(!(f=!autoReg(exc[i]).test(url))) break;	// @exclude
	return f;
}
function canUpdate(o,n){
	o=(o||'').split('.');n=(n||'').split('.');
	var r=/(\d*)([a-z]*)(\d*)([a-z]*)/i;
	while(o.length&&n.length) {
		var vo=o.shift().match(r),vn=n.shift().match(r);
		vo.shift();vn.shift();	// origin string
		vo[0]=parseInt(vo[0]||0,10);
		vo[2]=parseInt(vo[2]||0,10);
		vn[0]=parseInt(vn[0]||0,10);
		vn[2]=parseInt(vn[2]||0,10);
		while(vo.length&&vn.length) {
			var eo=vo.shift(),en=vn.shift();
			if(eo!=en) return eo<en;
		}
	}
	return n.length;
}
function checkUpdate(i){
	var o=map[ids[i]],r={item:i,hideUpdate:1,status:2};
	if(!o.update) return;
	function update(){
		var u=o.custom.downloadURL||o.meta.downloadURL;
		if(u) {
			r.message=_('Updating...');
			fetchURL(u,function(){
				parseScript(null,{status:this.status,code:this.responseText},o);
			});
		} else r.message='<span class=new>'+_('New version found.')+'</span>';
		rt.post('UpdateItem',r);
	}
	var u=o.custom.updateURL||o.meta.updateURL;
	if(u) {
		r.message=_('Checking for updates...');rt.post('UpdateItem',r);
		fetchURL(u,function(){
			try{
				var m=parseMeta(this.responseText);
				if(canUpdate(o.meta.version,m.version)) return update();
				r.message=_('No update found.');
			}catch(e){
				r.message=_('Failed fetching update information.');
			}
			delete r.hideUpdate;
			rt.post('UpdateItem',r);
		});
	}
}
function checkUpdateAll(){for(var i=0;i<ids.length;i++) checkUpdate(i);}
rt.listen('CheckUpdate',checkUpdate);
rt.listen('CheckUpdateAll',checkUpdateAll);
rt.listen('NewScript',function(o){rt.post('GotScript',newScript(true));});
rt.listen('SaveScript',saveScript);
rt.listen('EnableScript',function(o,e){
	if(o.id) {
		e=map[o.id];e.enabled=o.data;saveScript(e);
		rt.post('UpdateItem',{item:ids.indexOf(o.id),obj:o,status:0});
	} else setItem('isApplied',isApplied=o.data);
});
rt.listen('SetValue',function(o){setItem('val:'+getNameURI(map[o.data.id]),o.data.data);});
rt.listen('RemoveScript',removeScript);
rt.listen('FindScript',function(o){
	var i,_ids=[],_map={},cache={},values={},url=o.origin;
	function getCache(j){cache[j]=getString('cache:'+j);}
	if(o.data) for(i=0;i<gExc.length;i++) if(autoReg(gExc[i]).test(o.data)) return;
	if(url.substr(0,5)!='data:') ids.forEach(function(i,j){
		if(testURL(url,i=map[i])) {
			_ids.push(i.id);
			if(isApplied&&i.enabled) {
				_map[i.id]=i;
				if(i.meta.require) i.meta.require.forEach(getCache);
				for(j in i.meta.resources) getCache(i.meta.resources[j]);
				values[i.id]=getItem('val:'+getNameURI(i));
			}
		}
	});
	rt.post(o.source,{topic:'FoundScript',ids:_ids,map:_map,cache:cache,values:values});
});
function parseMeta(d,meta){
	var o=-1;
	if(!meta) meta={include:[],exclude:[],match:[],require:[],resources:{}};
	meta.resource=[];
	d.replace(/(?:^|\n)\/\/\s*([@=]\S+)(.*)/g,function(m,k,v){
		if(o<0&&k=='==UserScript==') o=1;
		else if(k=='==/UserScript==') o=0;
		if(o==1&&k[0]=='@') k=k.slice(1); else return;
		v=v.replace(/^\s+|\s+$/g,'');
		if(meta[k]&&meta[k].push) meta[k].push(v);
		else meta[k]=v;
	});
	meta.resource.forEach(function(i){
		o=i.match(/^(\w+)\s+(.*)/);
		if(o) meta.resources[o[1]]=o[2];
	});
	delete meta.resource;
	return meta;
}
function fetchURL(url,cb,type){
	var req=new XMLHttpRequest();
	req.open('GET',url,true);
	if(type) req.responseType=type;
	if(cb) req.onloadend=cb;
	req.send();
}
function fetchCache(url){
	fetchURL(url,function(){
		if(this.status!=200) return;
		var r=new FileReader();
		r.onload=function(e){setString('cache:'+url,e.target.result);};
		r.readAsBinaryString(this.response);
	},'blob');
}

function parseScript(o,d,c){
	if(o&&!d) d=o.data;
	var r={status:0,message:'message' in d?d.message:_('Script updated.')},i;
	if(d.status&&d.status!=200) {r.status=-1;r.message=_('Error fetching script!');}
	else {
		var meta=parseMeta(d.code);
		if(!c&&!d.id) {
			if(meta.name) {
				if(!meta.namespace) meta.namespace='';
				for(i=0;i<ids.length;i++) {
					c=map[ids[i]];
					if(c.meta.name==meta.name&&c.meta.namespace==meta.namespace) break;
				}
				if(i==ids.length) i=-1;
			} else i=-1;
			if(i<0) c=newScript(); else c=map[ids[i]];
		} else {
			if(!c) c=map[d.id];i=ids.indexOf(c.id);
		}
		if(i<0){r.status=1;r.message=_('Script installed.');i=ids.length;}
		c.meta=meta;c.code=d.code;r.item=i;r.obj=c;
		if(o&&!c.meta.homepage&&!c.custom.homepage&&!/^(file|data):/.test(o.origin)) c.custom.homepage=o.origin;
		saveScript(c);
		meta.require.forEach(fetchCache);	// @require
		for(d in meta.resources) fetchCache(meta.resources[d]);	// @resource
		if(meta.icon) fetchCache(meta.icon);	// @icon
	}
	if(o) rt.post(o.source,{topic:'ShowMessage',data:r.message});
	rt.post('UpdateItem',r);
}
rt.listen('ImportZip',function(b){
	var z=new JSZip();
	try{z.load(b,{base64:true});}catch(e){rt.post('ShowMessage',_('Error loading zip file.'));return;}
	var vm=z.file('ViolentMonkey'),count=0;
	if(vm) try{vm=JSON.parse(vm.asText());}catch(e){vm={};console.log('Error parsing ViolentMonkey configuration.');}
	z.file(/\.user\.js$/).forEach(function(o){
		if(o.dir) return;
		var c=null,v,i;
		try{
			if(v=vm[o.name]) {
				c=map[v.id];
				if(c) for(i in v) c[i]=v[i];
				else c=v;
			}
			parseScript(null,{code:o.asText()},c);
			count++;
		}catch(e){console.log('Error importing data: '+o.name+'\n'+e);}
	});
	if(vm.values) for(z in vm.values) setItem('val:'+z,vm.values[z]);
	rt.post('ShowMessage',format(_('$1 item(s) are imported.'),count));
});
rt.listen('ExportZip',function(o){
	var z=new JSZip(),n,_n,names={},values={},vm={};
	o.data.forEach(function(c){
		var j=0;c=map[c];
		n=_n=c.custom.name||c.meta.name||'Noname';
		while(names[n]) n=_n+'_'+(++j);names[n]=1;n+='.user.js';
		z.file(n,c.code);
		vm[n]={id:c.id,custom:c.custom,enabled:c.enabled,update:c.update};
		n=getNameURI(c);
		if(o.withData&&(_n=getItem('val:'+n))) values[n]=_n;
	});
	if(o.withData) vm.values=values;
	z.file('ViolentMonkey',JSON.stringify(vm));
	vm={};if(o.deflate) vm.compression='DEFLATE';
	n=z.generate(vm);
	rt.post('Exported',n);
});

rt.listen('ParseScript',function(o){
	if(o.url) fetchURL(o.url,function(){
		parseScript(null,{status:this.status,id:o.id,code:this.responseText});
	}); else if(o.source) parseScript(o);
	else parseScript(null,o);
});
rt.listen('InstallScript',function(o){
	if(!o.data) {
		if(getItem('installFile')) rt.post(o.source,{topic:'ConfirmInstall',data:_('Do you want to install this UserScript?')});
	} else fetchURL(o.data,function(){parseScript(o,{status:this.status,code:this.responseText});});
});

rt.listen('GetOptions',function(o){
	var i,j,cache={};
	for(i in o) o[i]=getString(i);
	for(i in map) (i=map[i].meta.icon)&&!(i in cache)&&(j=getString('cache:'+i))&&(cache[i]=btoa(j));
	o.ids=ids;o.map=map;o.cache=cache;o.gExc=gExc;
	rt.post('GotOptions',o);
});
rt.listen('SetOption',function(o){
	var v=(typeof o.data=='string'?setString:setItem)(o.key,o.data);
	if(o.wkey) window[o.wkey]=v;
});

var optionsURL=new RegExp('^'+(rt.getPrivateUrl()+'options.html').replace(/\./g,'\\.'));
br.onBrowserEvent=function(o){
	switch(o.type){
		case 'TAB_SWITCH':
		case 'ON_NAVIGATE':
			var tab=br.tabs.getCurrentTab(),i,t;
			if(optionsURL.test(tab.url)) {
				for(i=0;i<br.tabs.length;i++) {
					t=br.tabs.getTab(i);
					if(t.id!=tab.id&&optionsURL.test(t.url)) {
						tab.close();t.activate();
					}
				}
			}
	}
};

function autoCheck(){	// check for updates automatically in 20 seconds
	var n=Date.now(),lastUpdate=getItem('lastUpdate',0);
	if(n-lastUpdate>864e5) {
		setItem('lastUpdate',lastUpdate=n);
		checkUpdateAll();
	}
	setTimeout(autoCheck,36e5);
}
if(getItem('autoUpdate')) setTimeout(autoCheck,20000);
