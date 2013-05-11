var rt=window.external.mxGetRuntime(),br=rt.create('mx.browser');

function format(){
	var a=arguments;
	if(a[0]) return a[0].replace(/\$(?:\{(\d+)\}|(\d+))/g,function(v,g1,g2){g1=a[g1||g2];if(g1==undefined) g1=v;return g1;});
}
function _(t){
	var l=t.replace(/[%+=]/g,function(v){return '%'+v.charCodeAt().toString(16);}).replace(/ /g,'+');
	l=rt.locale.t(l);
	return l?JSON.parse(l):t;
};
function initFont(){
	var s=document.createElement('style');
	s.innerHTML=_('__font');
	document.head.appendChild(s);
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
	if(v==null&&def) return setItem(key,def);
	try{return JSON.parse(v);}catch(e){return def;}
}
function setItem(key,val){
	setString(key,JSON.stringify(val));
	return val;
}

function notify(msg){
	window.webkitNotifications.createNotification('',_('Violentmonkey'),msg).show();
}
