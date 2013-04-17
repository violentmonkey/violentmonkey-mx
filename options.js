function $(i){return document.getElementById(i);}
var N=$('main'),L=$('sList'),O=$('overlay'),ids,map={};
function split(t){return t.replace(/^\s+|\s+$/g,'').split(/\s*\n\s*/).filter(function(e){return e;});}

// Main options
function updateMove(d){
	if(!d) return;
	var b=d.querySelectorAll('.move');
	b[0].disabled=!d.previousSibling;
	b[1].disabled=!d.nextSibling;
}
function allowUpdate(n){return n.update&&(n.custom.updateURL||n.meta.updateURL);}
function getIcon(n){
	var i=cache[n.meta.icon];
	return i?'data:image/x;base64,'+i:'icons/icon_64.png';
}
function modifyItem(d,r){
	if(r) {
		if(r.message) d.querySelector('.message').innerHTML=r.message;
		with(d.querySelector('.update'))
			if(r.hideUpdate) classList.add('hide');
			else classList.remove('hide');
	}
}
function loadItem(d,n,r){
	if(typeof n=='string') return;
	d.innerHTML='<img class=icon src="'+getIcon(n)+'">'
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
	with(d.querySelector('.name')) {
		var name=n.custom.name||n.meta.name;
		title=name||'';
		var h=n.custom.homepage||n.meta.homepage;
		if(h) href=h;
		innerHTML=name?name.replace(/&/g,'&amp;').replace(/</g,'&lt;'):'<em>'+_('Null name')+'</em>';
	}
	if(n.meta.author) d.querySelector('.author').innerText=_('Author: ')+n.meta.author;
	with(d.querySelector('.descrip')) innerText=title=n.meta.description||'';
	modifyItem(d,r);
}
function addItem(n){
	var d=document.createElement('div');
	loadItem(d,n);
	L.appendChild(d);
	return d;
}
function moveUp(i,p){
	var x=ids[i];
	ids[i]=ids[i-1];
	ids[i-1]=x;
	L.insertBefore(p,p.previousSibling);
	rt.post('SetOption',{key:'ids',wkey:'ids',data:ids});
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
			e=map[ids[i]];
			if(e.enabled=!e.enabled) {
				p.classList.remove('disabled');
				o.innerText=_('Disable');
			} else {
				p.classList.add('disabled');
				o.innerText=_('Enable');
			}
			rt.post('SaveScript',e);
			break;
		case 'remove':
			rt.post('RemoveScript',i);
			delete map[ids.splice(i,1)[0]];
			L.removeChild(p);
			if(i==L.childNodes.length) i--;
			updateMove(L.childNodes[i]);
			break;
		case 'update':
			rt.post('CheckUpdate',i);
			break;
		case 'up':
			if(p.previousSibling) moveUp(i,p);
			break;
		case 'down':
			if(p.nextSibling) moveUp(i+1,p.nextSibling);
			break;
	}
};
rt.listen('GotScript',function(o){
	ids.push(o.id);o=addItem(map[o.id]=o);
	updateMove(o);updateMove(o.previousSibling);
});
$('bNew').onclick=function(){rt.post('NewScript');};
$('bUpdate').onclick=function(){rt.post('CheckUpdateAll');};
$('cDetail').onchange=function(){L.classList.toggle('simple');rt.post('SetOption',{key:'showDetails',data:this.checked});};
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
window.addEventListener('DOMContentLoaded',function(){
	var nodes=document.querySelectorAll('.i18n'),i;
	for(i=0;i<nodes.length;i++) nodes[i].innerHTML=_(nodes[i].innerHTML);
},true);

// Advanced
var A=$('advanced');
$('bAdvanced').onclick=function(){showDialog(A);};
$('cInstall').onchange=function(){rt.post('SetOption',{key:'installFile',data:this.checked});};
$('cUpdate').onchange=function(){rt.post('SetOption',{key:'cUpdate',data:this.checked});};
$('bDefSearch').onclick=function(){$('tSearch').value=_('Search$1');};
$('aExport').onclick=function(){showDialog(X);xLoad();};
$('aImport').onchange=function(e){
	var i,f,files=e.target.files;
	for(i=0;f=files[i];i++) {
		var r=new FileReader();
		r.onload=function(e){rt.post('ImportZip',btoa(e.target.result));};
		r.readAsBinaryString(f);
	}
};
rt.listen('ShowMessage',function(o){alert(o);});
$('aVacuum').onclick=function(){rt.post('Vacuum');};
rt.listen('Cleared',function(){window.location.reload();});
$('aClear').onclick=function(){
	if(confirm(_('All data of Violentmonkey will be cleared! Do you want to continue?'))) rt.post('Clear');
};
rt.listen('Vacuumed',function(){var t=$('aVacuum');t.innerHTML=_('Data vacuumed');t.disabled=true;});
A.close=$('aClose').onclick=function(){
	rt.post('SetOption',{key:'search',data:$('tSearch').value});
	rt.post('SetOption',{key:'gExc',wkey:'gExc',data:split($('tExclude').value)});
	closeDialog();
};

// Export
var X=$('export'),xL=$('xList'),xE=$('bExport'),xC=$('cCompress'),xD=$('cWithData');
function xLoad() {
	xL.innerHTML='';xE.disabled=false;xE.innerHTML=_('Export');
	ids.forEach(function(i){
		var d=document.createElement('div');
		d.className='ellipsis';
		d.innerText=d.title=map[i].meta.name;
		xL.appendChild(d);
	});
}
xC.onchange=function(){rt.post('SetOption',{key:'compress',data:this.checked});};
xD.onchange=function(){rt.post('SetOption',{key:'withData',data:this.checked});};
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
X.close=$('bClose').onclick=closeDialog;
xE.onclick=function(){
	this.disabled=true;this.innerHTML=_('Exporting...');
	var i,c=[];
	for(i=0;i<ids.length;i++)
		if(xL.childNodes[i].classList.contains('selected')) c.push(ids[i]);
	rt.post('ExportZip',{deflate:xC.checked,withData:xD.checked,data:c});
};
rt.listen('Exported',function(o){X.close();window.open('data:application/zip;base64,'+o);});

// Script Editor
var E=$('editor'),U=$('eUpdate'),M=$('meta'),
		mN=$('mName'),mH=$('mHomepage'),mR=$('mRunAt'),
		mU=$('mUpdateURL'),mD=$('mDownloadURL'),
    mI=$('mInclude'),mE=$('mExclude'),mM=$('mMatch'),
    cI=$('cInclude'),cE=$('cExclude'),cM=$('cMatch'),
		eS=$('eSave'),eSC=$('eSaveClose'),T;
CodeMirror.keyMap.vm={
	'Esc':'close',
	'Ctrl-S':'save',
	'fallthrough':'default'
};
T=CodeMirror.fromTextArea($('eCode'),{
	lineNumbers:true,
	matchBrackets:true,
	mode:'text/typescript',
	lineWrapping:true,
	indentUnit:4,
	indentWithTabs:true,
	extraKeys:{"Enter":"newlineAndIndentContinueComment"},
	keyMap:'vm'
});
T.on('change',function(){eS.disabled=eSC.disabled=T.isClean();});
function edit(i){
	switchTo(E);E.scr=map[ids[i]];E.cur=L.childNodes[i];U.checked=E.scr.update;
	T.setValue(E.scr.code);T.markClean();T.getDoc().clearHistory();
	eS.disabled=eSC.disabled=true;T.focus();
}
function eSave(){
	E.scr.update=U.checked;
	rt.post('ParseScript',{id:E.scr.id,code:T.getValue(),message:''});
	eS.disabled=eSC.disabled=true;
}
function eClose(){switchTo(N);E.cur=E.scr=null;}
U.onchange=E.markDirty=function(){eS.disabled=eSC.disabled=false;};
function metaChange(){M.dirty=true;}
[mN,mH,mR,mU,mD,mI,mM,mE,cI,cM,cE].forEach(function(i){i.onchange=metaChange;});
$('bcustom').onclick=function(){
	var e=[],c=E.scr.custom;M.dirty=false;
	showDialog(M,10);
	mN.value=c.name||'';
	mH.value=c.homepage||'';
	mU.value=c.updateURL||'';
	mD.value=c.downloadURL||'';
	switch(c['run-at']){
		case 'document-start':mR.value='start';break;
		case 'document-body':mR.value='body';break;
		case 'document-end':mR.value='end';break;
		default:mR.value='default';
	}
	cI.checked=c._include!=false;
	mI.value=(c.include||e).join('\n');
	cM.checked=c._match!=false;
	mM.value=(c.match||e).join('\n');
	cE.checked=c._exclude!=false;
	mE.value=(c.exclude||e).join('\n');
};
M.close=function(){if(confirmCancel(M.dirty)) closeDialog();};
$('mCancel').onclick=closeDialog;
$('mOK').onclick=function(){
	if(M.dirty) {
		var c=E.scr.custom;
		c.name=mN.value;
		c.homepage=mH.value;
		c.updateURL=mU.value;
		c.downloadURL=mD.value;
		switch(mR.value){
			case 'start':c['run-at']='document-start';break;
			case 'body':c['run-at']='document-body';break;
			case 'end':c['run-at']='document-end';break;
			default:delete c['run-at'];
		}
		c._include=cI.checked;
		c.include=split(mI.value);
		c._match=cM.checked;
		c.match=split(mM.value);
		c._exclude=cE.checked;
		c.exclude=split(mE.value);
		loadItem(E.cur,E.scr);
		updateMove(E.cur);
		rt.post('SaveScript',E.scr);
	}
	closeDialog();
};
eS.onclick=eSave;
eSC.onclick=function(){eSave();eClose();};
CodeMirror.commands.save=function(){if(!eS.disabled) setTimeout(eSave,0);};
CodeMirror.commands.close=E.close=$('eClose').onclick=function(){if(confirmCancel(!eS.disabled)) eClose();};

// Load at last
var ids,map,cache;
rt.listen('GotOptions',function(o){
	ids=o.ids;map=o.map;cache=o.cache;L.innerHTML='';
	ids.forEach(function(i){addItem(map[i]);});
	updateMove(L.firstChild);updateMove(L.lastChild);
	$('cInstall').checked=JSON.parse(o.installFile);
	$('cUpdate').checked=JSON.parse(o.autoUpdate);
	$('tSearch').value=o.search;
	$('tExclude').value=o.gExc.join('\n');
	if(!($('cDetail').checked=JSON.parse(o.showDetails))) L.classList.add('simple');
	xC.checked=JSON.parse(o.compress);
	xD.checked=JSON.parse(o.withData);
});
rt.post('GetOptions',{
	installFile:0,
	search:0,
	showDetails:0,
	compress:0,
	withData:0,
	autoUpdate:0
});
rt.listen('UpdateItem',function(r){
	if(r.obj) map[r.obj.id]=r.obj;
	switch(r.status){
		case 1:addItem(r.obj);updateMove(L.childNodes[r.item-1]);break;
		case 2:modifyItem(L.childNodes[r.item],r);break;
		default:loadItem(L.childNodes[r.item],r.obj,r);
	}
	updateMove(L.childNodes[r.item]);
});
