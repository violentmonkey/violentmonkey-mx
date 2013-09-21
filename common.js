var rt=window.external.mxGetRuntime(),br=rt.create('mx.browser');

function _(k,a){
	var v=rt.locale.t(k);
	try{
		v=JSON.parse(v).replace(/\$(?:\{(\d+)\}|(\d+))/g,function(v,g1,g2){v=g1||g2;return a[v-1]||'';});
	}catch(e){
		v='';
	}
	return v;
};
function initFont(){
	var s=document.createElement('style');
	s.innerHTML=_('css');
	document.head.appendChild(s);
}
function initI18n(callback){
	window.addEventListener('DOMContentLoaded',function(){
		var nodes=document.querySelectorAll('.i18n'),i;
		for(i=0;i<nodes.length;i++) nodes[i].innerHTML=_(nodes[i].innerHTML);
		if(callback) callback();
	},true);
}

function getString(key,def){
	var v=localStorage.getItem(key);
	if(v==null) (v=def)&&localStorage.setItem(key,v);
	return v;
}
function setString(key,val){
	localStorage.setItem(key,val=val||'');
	return val;
}
function getItem(key,def){
	var v=localStorage.getItem(key);
	if(!v&&def!=undefined) return setItem(key,def);
	try{return JSON.parse(v);}catch(e){return def;}
}
function setItem(key,val){
	setString(key,JSON.stringify(val));
	return val;
}

function getNameURI(i){
	var ns=i.meta.namespace||'',n=i.meta.name||'',k=escape(ns)+':'+escape(n)+':';
	if(!ns&&!n) k+=i.id;return k;
}

function notify(msg){
	window.webkitNotifications.createNotification('',_('extName'),msg).show();
}
