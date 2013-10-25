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
function initCSS(){
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
function getUniqueId(){return Date.now()+Math.random().toString().slice(1);}
function initMessage(map){
	var id=getUniqueId(),callbacks={};
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
			o.callback=getUniqueId();
			callbacks[o.callback]=callback;
		}
		rt.post('Background',o);
	};
}

function injectContent(s){br.executeScript('if(window.mx){'+s+'}');}
function notify(msg){
	window.webkitNotifications.createNotification('',_('extName'),msg).show();
}
