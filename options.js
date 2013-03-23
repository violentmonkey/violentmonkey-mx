function $(i){return document.getElementById(i);}
var N=$('main'),L=$('sList'),O=$('overlay');
function fillHeight(e,b,p){
	if(p==undefined) p=e.parentNode;
	b=b?b.offsetTop+b.offsetHeight:0;
	e.style.pixelHeight=e.offsetHeight+window.getComputedStyle(p).pixelHeight-b;
}
function fillWidth(e,p){
	if(p==undefined) p=e.parentNode;
	e.style.pixelWidth=e.offsetWidth+window.getComputedStyle(p).pixelWidth-e.offsetLeft-e.offsetWidth;
}
/**
 *  Base64 encode / decode
 *  http://www.webtoolkit.info/
 **/
function base64encode(input) {
	var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
	var output = "";
	var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
	var i = 0;
	while (i < input.length) {
		chr1 = input.charCodeAt(i++);
        	chr2 = input.charCodeAt(i++);
        	chr3 = input.charCodeAt(i++);
		enc1 = chr1 >> 2;
		enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
		enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
		enc4 = chr3 & 63;
		if (isNaN(chr2)) {
			enc3 = enc4 = 64;
		} else if (isNaN(chr3)) {
			enc4 = 64;
		}
		output = output +
		_keyStr.charAt(enc1) + _keyStr.charAt(enc2) +
		_keyStr.charAt(enc3) + _keyStr.charAt(enc4);
	}
	return output;
}

// Main options
function updateMove(d){
	if(!d) return;
	var b=d.querySelectorAll('.move');
	b[0].disabled=!d.previousSibling;
	b[1].disabled=!d.nextSibling;
}
function allowUpdate(n){return n.update&&n.meta.updateURL&&n.meta.downloadURL;}
var icons={};
function getIcon(n){
	if(n.meta.icon) {
		if(n.meta.icon in icons) return icons[n.meta.icon];
		var i=_data.cache[n.meta.icon];
		if(i) return icons[n.meta.icon]='data:image/x;base64,'+base64encode(i);
	}
	return 'icons/icon_64.png';
}
function loadItem(d,n,m){
	if(typeof n=='string') return;
	d.innerHTML='<img class=icon>'
	+'<a class="name ellipsis" target=_blank></a>'
	+'<span class=author></span>'
	+'<span class=version>'+(n.meta.version?'v'+n.meta.version:'')+'</span>'
	+(allowUpdate(n)?'<a data=update class=update href=#>'+_('Check for updates')+'</a> ':'')
	+'<div class="descrip ellipsis"></div>'
	+'<span class=message></span>'
	+'<div class=panel>'
		+'<button data=edit>'+_('Edit')+'</button> '
		+'<button data=enable>'+_(n.enabled?'Disable':'Enable')+'</button> '
		+'<button data=remove>'+_('Remove')+'</button>'
		+'<button data=up class=move>'+_('&uarr;')+'</button>'
		+'<button data=down class=move>'+_('&darr;')+'</button>'
	+'</div>';
	d.className=n.enabled?'':'disabled';
	with(d.querySelector('.icon')) src=getIcon(n);
	with(d.querySelector('.name')) {
		var name=n.custom.name||n.meta.name;
		title=name||'';
		var h=n.custom.homepage||n.meta.homepage;
		if(h) href=h;
		innerHTML=name?name.replace(/&/g,'&amp;').replace(/</g,'&lt;'):'<em>'+_('Null name')+'</em>';
	}
	if(n.meta.author) d.querySelector('.author').innerText=_('Author: ')+n.meta.author;
	with(d.querySelector('.descrip')) innerText=title=n.meta.description||'';
	if(m) d.querySelector('.message').innerHTML=m;
}
function addItem(n){
	var d=document.createElement('div');
	loadItem(d,n);
	L.appendChild(d);
	return d;
}
function moveUp(i,p){
	var x=_data.ids[i];
	_data.ids[i]=_data.ids[i-1];
	_data.ids[i-1]=x;_data.save();
	rt.post('Reload');
	L.insertBefore(p,p.previousSibling);
	updateMove(p);updateMove(p.nextSibling);
}
L.onclick=function(e){
	var o=e.target,d=o.getAttribute('data'),p;
	if(!d) return;
	e.preventDefault();
	for(p=o;p&&p.parentNode!=L;p=p.parentNode);
	var i=Array.prototype.indexOf.call(L.childNodes,p);
	switch(d){
		case 'edit':
			edit(i);
			break;
		case 'enable':
			e=_data.map[_data.ids[i]];
			if(e.enabled=!e.enabled) {
				p.classList.remove('disabled');
				o.innerText=_('Disable');
			} else {
				p.classList.add('disabled');
				o.innerText=_('Enable');
			}
			_data.save();rt.post('Reload');
			break;
		case 'remove':
			delete _data.map[_data.ids.splice(i,1)[0]];
			_data.save();rt.post('Reload');
			L.removeChild(p);
			if(i==L.childNodes.length) i--;
			updateMove(L.childNodes[i]);
			break;
		case 'update':
			check(i);
			break;
		case 'up':
			if(p.previousSibling) moveUp(i,p);
			break;
		case 'down':
			if(p.nextSibling) moveUp(i+1,p.nextSibling);
			break;
	}
};
rt.listen('GotScript',function(i){
	_data.load();i=addItem(_data.map[i]);updateMove(i);updateMove(i.previousSibling);
});
$('bNew').onclick=function(){rt.post('NewScript');};
$('bUpdate').onclick=function(){
	for(var i=0;i<_data.ids.length;i++) if(allowUpdate(_data.map[_data.ids[i]])) check(i);
};
if(!($('cDetail').checked=_data.data.showDetails)) L.classList.add('simple');
$('cDetail').onchange=function(){L.classList.toggle('simple');_data.set('showDetails',this.checked);};
var panel=N;
function switchTo(D){
	panel.classList.add('hide');D.classList.remove('hide');panel=D;
}
var dialogs=[];
function showDialog(D,z){
	if(!dialogs.length) {
		O.classList.remove('hide');
		setTimeout(function(){O.classList.add('overlay');},1);
	}
	if(!z) z=dialogs.length?dialogs[dialogs.length-1].zIndex+1:1;
	dialogs.push(D);
	O.style.zIndex=D.style.zIndex=D.zIndex=z;
	D.classList.remove('hide');
	D.style.top=(window.innerHeight-D.offsetHeight)/2+'px';
	D.style.left=(window.innerWidth-D.offsetWidth)/2+'px';
}
function closeDialog(){
	dialogs.pop().classList.add('hide');
	if(dialogs.length) O.style.zIndex=dialogs.length>1?dialogs[dialogs.length-1]:1;
	else {
		O.classList.remove('overlay');
		setTimeout(function(){O.classList.add('hide');},500);
	}
}
O.onclick=function(){
	if(dialogs.length) (dialogs[dialogs.length-1].close||closeDialog)();
};
function confirmCancel(dirty){
	return !dirty||confirm(_('Modifications are not saved!'));
}
function bindChange(e,d){
	function change(){d.forEach(function(i){i.dirty=true;});}
	e.forEach(function(i){i.onchange=change;});
}
initFont();
window.addEventListener('DOMContentLoaded',function(){
	var nodes=document.querySelectorAll('.i18n'),c,s,i,j;
	for(i=0;i<nodes.length;i++)
		nodes[i].innerHTML=_(nodes[i].innerHTML);
},true);

// Advanced
var A=$('advanced');
$('bAdvanced').onclick=function(){showDialog(A);};
$('cInstall').checked=_data.data.installFile;
$('cInstall').onchange=function(){_data.set('installFile',this.checked);};
$('tSearch').value=_data.data.search;
$('bDefSearch').onclick=function(){$('tSearch').value=_('Search$1');};
$('aExport').onclick=function(){showDialog(X);xLoad();};
$('aVacuum').onclick=function(){
	this.disabled=true;
	var k,s,i,cc={},ids=[],map={};
	_data.ids.forEach(function(i){
		if(map[i]||!(k=_data.map[i])) return;
		ids.push(i);map[i]=k;
		if(k.meta.icon) cc[k.meta.icon]=1;
		if(k.meta.require) k.meta.require.forEach(function(i){cc[i]=1;});
		if(k.meta.resources) for(i in k.meta.resources) cc[i]=1;
	});
	for(i in cc) if(!_data.cache[i]) fetchCache(i);
	for(i in _data.cache) if(!cc[i]) delete _data.cache[i];
	_data.data.temp={};_data.data.map=map;_data.data.ids=ids;_data.save();
	this.innerHTML=_('Data vacuumed');
	rt.post('Reload');
};
A.close=$('aClose').onclick=function(){
	_data.set('search',$('tSearch').value);
	closeDialog();
};

// Export
var X=$('export'),xL=$('xList'),xE=$('bExport');
function xLoad() {
	xL.innerHTML='';xE.disabled=false;xE.innerHTML=_('Export');
	_data.ids.forEach(function(i){
		var d=document.createElement('div');
		d.className='ellipsis';
		d.innerText=d.title=_data.map[i].meta.name;
		xL.appendChild(d);
	});
}
xL.onclick=function(e){
	var t=e.target;
	if(t.parentNode!=this) return;
	t.classList.toggle('selected');
};
$('bSelect').onclick=function(){
	var c=xL.childNodes,v,i;
	for(i=0;i<c.length;i++) if(!c[i].classList.contains('selected')) break;
	v=i<c.length;
	for(i=0;i<c.length;i++) if(v) c[i].classList.add('selected'); else c[i].classList.remove('selected');
};
xE.onclick=function(){
	this.disabled=true;this.innerHTML=_('Exporting...');
	var z=new JSZip(),n,names={},s,i,j;
	for(i=0;i<_data.ids.length;i++) if(xL.childNodes[i].classList.contains('selected')) {
		s=_data.map[_data.ids[i]];
		n=s.custom.name||s.meta.name||'Noname';j=0;
		while(names[n]) n=s.meta.name+(++j);
		names[n]=1;
		z.file(n+'.user.js',s.code);
	}
	n=z.generate({compression:'DEFLATE'});
	window.open('data:application/zip;base64,'+n);
	X.close();
};
X.close=$('bClose').onclick=closeDialog;

// Update checker
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
function check(i){
	var l=L.childNodes[i],s=_data.map[_data.ids[i]],o=l.querySelector('[data=update]'),m=l.querySelector('.message');
	m.innerHTML=_('Checking for updates...');
	o.classList.add('hide');
	function update(){
		m.innerHTML=_('Updating...');
		req=new window.XMLHttpRequest();
		req.open('GET', s.meta.downloadURL, true);
		req.onload=function(){
			rt.listen('UpdatedScript'+s.id,function(r){if(r) m.innerHTML=r;});
			if(req.status==200) {_data.temp[s.id]=req.responseText;_data.save();}
			rt.post('ParseScript',{source:'UpdatedScript'+s.id,data:{status:req.status,id:s.id}});
			o.classList.remove('hide');
		};
		req.send();
	}
	var req=new window.XMLHttpRequest();
	req.open('GET', s.meta.updateURL, true);
	req.onload=function(){
		try {
			rt.listen('ParsedMeta'+s.id,function(r){
				if(canUpdate(s.meta.version,r.version)) return update();
				m.innerHTML=_('No update found!');
				o.classList.remove('hide');
			});
			rt.post('ParseMeta',{source:'ParsedMeta'+s.id,code:req.responseText});
		} catch(e) {
			m.innerHTML=_('Failed fetching update information.');
			console.log(e);
			o.classList.remove('hide');
		}
	};
	req.send();
}

// Script Editor
var E=$('editor'),U=$('eUpdate'),H=$('mURL'),M=$('meta'),I=$('mName'),
    mI=$('mInclude'),mE=$('mExclude'),mM=$('mMatch'),
    cI=$('cInclude'),cE=$('cExclude'),cM=$('cMatch');
var T=CodeMirror.fromTextArea($('eCode'),{
	lineNumbers:true,
	matchBrackets:true,
	mode:'text/typescript',
	lineWrapping:true,
	extraKeys:{"Enter":"newlineAndIndentContinueComment"}
});
T.resize=function(){var w=this.getWrapperElement();fillHeight(w,w.nextElementSibling);};
function edit(i){
	switchTo(E);E.scr=_data.map[_data.ids[i]];E.cur=L.childNodes[i];
	U.checked=E.scr.update;H.value=E.scr.custom.homepage||'';
	T.resize();T.setValue(E.scr.code);T.markClean();T.getDoc().clearHistory();
}
function eSave(){
	if(!T.isClean()){
		E.scr.update=U.checked;E.scr.custom.homepage=H.value;
		_data.temp[E.scr.id]=T.getValue();_data.save();
		rt.post('ParseScript',{source:'ModifiedScript',data:{id:E.scr.id}});
		return true;
	} else return false;
}
function eClose(){switchTo(N);E.cur=E.scr=null;}
function split(t){return t.replace(/^\s+|\s+$/g,'').split(/\s*\n\s*/).filter(function(e){return e;});}
bindChange([U,H],[E]);
$('bcustom').onclick=function(){
	var e=[],c=E.scr.custom;M.dirty=false;
	showDialog(M,10);fillWidth(I);fillWidth(H);
	I.value=c.name||'';
	H.value=c.homepage||'';
	cI.checked=c._include!=false;
	mI.value=(c.include||e).join('\n');
	cM.checked=c._match!=false;
	mM.value=(c.match||e).join('\n');
	cE.checked=c._exclude!=false;
	mE.value=(c.exclude||e).join('\n');
};
bindChange([I,H,mI,mM,mE,cI,cM,cE],[M]);
M.close=function(){if(confirmCancel(M.dirty)) closeDialog();};
$('mCancel').onclick=closeDialog;
$('mOK').onclick=function(){
	if(M.dirty) {
		var c=E.scr.custom;
		c.name=I.value;
		c.homepage=H.value;
		c._include=cI.checked;
		c.include=split(mI.value);
		c._match=cM.checked;
		c.match=split(mM.value);
		c._exclude=cE.checked;
		c.exclude=split(mE.value);
		loadItem(E.cur,E.scr);
		updateMove(E.cur);
		_data.save();
		rt.post('Reload');
	}
	closeDialog();
};
$('eSave').onclick=eSave;
$('eSaveClose').onclick=function(){eSave();eClose();};
E.close=$('eClose').onclick=function(){if(confirmCancel(!T.isClean())) eClose();};

// Load at last
L.innerHTML='';
_data.ids.forEach(function(i){addItem(_data.map[i]);});
updateMove(L.firstChild);updateMove(L.lastChild);
rt.listen('UpdateItem',function(o){
	_data.load();
	var i=o.data,p=L.childNodes[i],n=_data.map[o.id];
	switch(o.cmd){
		case 'add':addItem(n);updateMove(L.childNodes[i-1]);break;
		case 'update':loadItem(p,n,o.message);break;
	}
	updateMove(L.childNodes[i]);
});
fillHeight(L,$('footer'),document.body);
