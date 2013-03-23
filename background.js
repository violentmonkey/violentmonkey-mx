/* ============== Data format ==============
 * ids	List [id]
 * vm:id	Item	{
 * 		id:	Random
 * 		custom:	List-Dict	// Custom meta data
 * 		values:	Dict
 * 		meta:	List-Dict
 *		enabled:	Boolean
 *		update:	Boolean
 *		code:	String
 *	 	}
 * cache	List [Binary]
 */

function newMeta(){return {name:'New Script',namespace:''};}
function newScript(save){
	var r={
		custom:{},
		meta:newMeta(),
		url:'',
		enabled:1,
		update:1,
		code:'// ==UserScript==\n// @name New Script\n// ==/UserScript==\n'
	};
	r.id=Date.now()+Math.random().toString().substr(1);
	if(save) saveScript(r);
	return r;
}
function saveScript(o){if(!_data.map[o.id]) _data.ids.push(o.id);_data.map[o.id]=o;_data.save();}
function removeScript(i){i=_data.ids.splice(i,1)[0];delete _data.map[i];_data.save();}
function updateItem(t,i,o,m){rt.post('UpdateItem',{cmd:t,data:i,id:o,message:m});}

rt.listen('ParseMeta',function(o){rt.post(o.source,parseMeta(o.code));});
rt.listen('NewScript',function(o){rt.post('GotScript',newScript(true).id);});
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
function fetchURL(url,callback,type){
	var req=new XMLHttpRequest();
	req.open('GET',url,true);
	if(type) req.responseType=type;
	if(callback) req.onload=callback;
	req.send();
}
var cacheCount=0;
function fetchCache(url){
	cacheCount++;
	fetchURL(url,function(){
		var b=new Uint8Array(this.response),c=String.fromCharCode.apply(this,b);
		_data.cache[url]=c;if(!--cacheCount) _data.save();
	},'arraybuffer');
}

function parseScript(o,d){
	if(o&&!d) d=o.data;
	var r={error:0},t='update',i,c;
	if(o.source!='ModifiedScript') r.message=_('Script updated.');
	if(d.status&&d.status!=200) {r.error=-1;r.message=_('Error fetching script!');}
	else {
		i=d.id;
		if(!d.code) {_data.load();d.code=_data.temp[i];delete _data.temp[i];}
		var meta=parseMeta(d.code);
		if(i&&(c=_data.map[i])) i=_data.ids.indexOf(i);
		else {
			if(meta.name) {
				if(!meta.namespace) meta.namespace='';
				for(i=0;i<_data.ids.length;i++) {
					c=_data.map[_data.ids[i]];
					if(c.meta.name==meta.name&&c.meta.namespace==meta.namespace) break;
				}
				if(i==_data.ids.length) i=-1;
			} else i=-1;
			if(i<0) {c=newScript();t='add';r.message=_('Script installed.');i=_data.ids.length;}
			else c=_data.map[_data.ids[i]];
		}
		meta.custom=c.meta.custom;c.meta=meta;c.code=d.code;
		if(o&&!/^(file|data):/.test(o.origin)&&!c.meta.homepage) c.custom.homepage=o.origin;
		saveScript(c);
		meta.require.forEach(fetchCache);	// @require
		for(d in meta.resources) fetchCache(meta.resources[d]);	// @resource
		if(meta.icon) fetchCache(meta.icon);	// @icon
	}
	if(!/^(UpdatedScript|ModifiedScript)/.test(o.source)) rt.post(o.source,{topic:'ShowMessage',data:r.message});
	else if(r.error) rt.post(o.source,r.message);
	if(!r.error) updateItem(t,i,c.id,r.message);
}
rt.listen('Reload',function(){_data.load();});
rt.listen('ParseScript',parseScript);
rt.listen('InstallScript',function(o){
	if(!o.data) {
		if(_data.data.installFile) rt.post(o.source,{topic:'ConfirmInstall',data:_('Do you want to install this UserScript?')});
	} else fetchURL(o.data,function(){parseScript(o,{status:this.status,code:this.responseText});});
});

var optionsURL=new RegExp('^'+(rt.getPrivateUrl()+'options.html').replace(/\./g,'\\.'));
br.onBrowserEvent=function(o){
	switch(o.type){
		case 'TAB_SWITCH': case 'ON_NAVIGATE':
			var tab=br.tabs.getCurrentTab(),i,t;
			if(optionsURL.test(tab.url)) for(i=0;t=br.tabs.getTab(i);i++) if(t.id!=tab.id&&optionsURL.test(t.url)) {
				tab.close();t.activate();
			}
	}
};
