var $=document.getElementById.bind(document),
		N=$('main'),L=$('sList'),O=$('overlay'),ids,map={};
zip.workerScriptsPath='lib/zip.js/';
function split(t){return t.replace(/^\s+|\s+$/g,'').split(/\s*\n\s*/).filter(function(e){return e;});}
rt.listen('ShowMessage',function(o){alert(o);});

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
	d.innerHTML='<img class=icon src="'+getIcon(n)+'">'
	+'<a class="name ellipsis" target=_blank></a>'
	+'<span class=author></span>'
	+'<span class=version>'+(n.meta.version?'v'+n.meta.version:'')+'</span>'
	+(allowUpdate(n)?'<a data=update class=update href=#>'+_('anchorUpdate')+'</a> ':'')
	+'<div class="descrip ellipsis"></div>'
	+'<span class=message></span>'
	+'<div class=panel>'
		+'<button data=edit>'+_('buttonEdit')+'</button> '
		+'<button data=enable>'+_(n.enabled?'buttonDisable':'buttonEnable')+'</button> '
		+'<button data=remove>'+_('buttonRemove')+'</button>'
		+'<button data=up class=move>&uarr;</button>'
		+'<button data=down class=move>&darr;</button>'
	+'</div>';
	d.className=n.enabled?'':'disabled';
	var a=d.querySelector('.name'),b=n.custom.name||n.meta.name;
	a.title=b||'';
	a.innerHTML=b?b.replace(/&/g,'&amp;').replace(/</g,'&lt;'):'<em>'+_('labelNoName')+'</em>';
	if(b=n.custom.homepage||n.meta.homepage) a.href=b;
	if(n.meta.author) d.querySelector('.author').innerText=_('labelAuthor')+n.meta.author;
	a=d.querySelector('.descrip');
	a.innerText=a.title=n.meta.description||'';
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
				o.innerText=_('buttonDisable');
			} else {
				p.classList.add('disabled');
				o.innerText=_('buttonEnable');
			}
			rt.post('EnableScript',{id:e.id,data:e.enabled});
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
rt.listen('AddScript',function(o){
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
	return !dirty||confirm(_('confirmNotSaved'));
}
initFont();initI18n();

// Advanced
var A=$('advanced');
$('bAdvanced').onclick=function(){showDialog(A);};
$('cUpdate').onchange=function(){rt.post('AutoUpdate',this.checked);};
$('bDefSearch').onclick=function(){$('tSearch').value=_('defaultSearch');};
$('aExport').onclick=function(){showDialog(X);xLoad();};
function importFile(e){
	zip.createReader(new zip.BlobReader(e.target.files[0]),function(r){
		r.getEntries(function(e){
			function getFiles(){
				var i=e.shift();
				if(i) i.getData(writer,function(t){
					var c={code:t};
					if(vm.scripts&&(v=vm.scripts[i.filename.slice(0,-8)])) {
						c.id=v.id;c.data=v;
					}
					rt.post('ParseScript',c);
					count++;
					getFiles();
				}); else {
					alert(_('msgImported',count));
					location.reload();
				}
			}
			var i,vm={},writer=new zip.TextWriter(),count=0;
			for(i=0;i<e.length;i++) if(e[i].filename=='ViolentMonkey') break;
			if(i<e.length) e.splice(i,1)[0].getData(writer,function(t){
				try{
					vm=JSON.parse(t);
				}catch(e){
					vm={};
					console.log('Error parsing ViolentMonkey configuration.');
				}
				getFiles();
			}); else getFiles();
		});
	});
}
$('aImport').onclick=function(){
	var e=document.createEvent('MouseEvent'),iH=document.createElement('input');
	iH.setAttribute('type','file');iH.onchange=importFile;
	e.initMouseEvent('click',true,true,window,0,0,0,0,0,false,false,false,false,0,null);
	iH.dispatchEvent(e);
};
$('aVacuum').onclick=function(){rt.post('Vacuum');};
rt.listen('Vacuumed',function(){var t=$('aVacuum');t.innerHTML=_('buttonVacuumed');t.disabled=true;});
A.close=$('aClose').onclick=function(){
	rt.post('SetOption',{key:'search',data:$('tSearch').value});
	rt.post('SetOption',{key:'gExc',wkey:'gExc',data:split($('tExclude').value)});
	closeDialog();
};

// Export
var X=$('export'),xL=$('xList'),xE=$('bExport'),xC=$('cCompress'),xD=$('cWithData');
function xLoad() {
	xL.innerHTML='';xE.disabled=false;xE.innerHTML=_('buttonExport');
	ids.forEach(function(i){
		var d=document.createElement('div');
		d.className='ellipsis';
		d.innerText=d.title=map[i].meta.name;
		xL.appendChild(d);
	});
}
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
xE.onclick=function(e){
	e.preventDefault();
	this.disabled=true;this.innerHTML=_('buttonExporting');
	var i,c=[];
	for(i=0;i<ids.length;i++)
		if(xL.childNodes[i].classList.contains('selected')) c.push(ids[i]);
	rt.post('ExportZip',{data:c});
};
function exportStart(o){
	function addFiles(){
		adding=true;
		if(!writer) {	// create writer
			zip.createWriter(new zip.BlobWriter(),function(w){writer=w;addFiles();});
			return;
		}
		var i=files.shift();
		if(i) {
			if(i.name) {	// add file
				writer.add(i.name,new zip.TextReader(i.content),addFiles);
				return;
			} else	// finished
				writer.close(function(b){
					var u=URL.createObjectURL(b),e=document.createEvent('MouseEvent'),xH=document.createElement('a');
					e.initMouseEvent('click',true,true,window,0,0,0,0,0,false,false,false,false,0,null);
					xH.href=u;
					xH.download='scripts.zip';
					xH.dispatchEvent(e);
					writer=null;
					URL.revokeObjectURL(u);
					X.close();
				});
		}
		adding=false;
	}
	function addFile(o){
		files.push(o);
		if(!adding) addFiles();
	}
	var writer=null,files=[],adding=false,
			n,_n,names={},vm={scripts:{},settings:o.settings};
	if(xD.checked) vm.values={};
	o.data.forEach(function(c){
		var j=0;
		n=_n=c.custom.name||c.meta.name||'Noname';
		while(names[n]) n=_n+'_'+(++j);names[n]=1;
		addFile({name:n+'.user.js',content:c.code});
		vm.scripts[n]={id:c.id,custom:c.custom,enabled:c.enabled,update:c.update};
		n=getNameURI(c);
		if(xD.checked&&(_n=getItem('val:'+n))) vm.values[n]=_n;
	});
	addFile({name:'ViolentMonkey',content:JSON.stringify(vm)});
	addFile({});	// finish adding files
}
rt.listen('ExportStart',exportStart);

// Script Editor
var E=$('editor'),U=$('eUpdate'),C=$('code'),M=$('meta'),bM=$('bmeta'),
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
rt.listen('GotScript',function(o){
	E.scr=o;U.checked=o.update;
	var e=[],c=o.custom;
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
	initMetaButton();switchTo(E);
	T.setValue(o.code);T.markClean();T.getDoc().clearHistory();
	eS.disabled=eSC.disabled=true;T.focus();
});
function edit(i){
	E.cur=L.childNodes[i];rt.post('GetScript',map[ids[i]].id);
}
function eSave(){
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
	E.scr.update=U.checked;
	E.scr.code=T.getValue();
	rt.post('ParseScript',{script:E.scr,message:''});
	T.markClean();eS.disabled=eSC.disabled=true;
	loadItem(E.cur,E.scr);
	updateMove(E.cur);
}
function eClose(){T.setValue('');switchTo(N);}
E.markDirty=function(){eS.disabled=eSC.disabled=false;};
[U,mN,mH,mR,mU,mD,mI,mM,mE,cI,cM,cE].forEach(function(i){i.onchange=E.markDirty;});
function initMetaButton(e){
	if(e){C.classList.toggle('hide');M.classList.toggle('hide');}
	else {C.classList.remove('hide');M.classList.add('hide');}
	bM.innerHTML=C.classList.contains('hide')?_('buttonEditCode'):_('buttonCustomMeta');
}
bM.onclick=initMetaButton;
eS.onclick=eSave;
eSC.onclick=function(){eSave();eClose();};
CodeMirror.commands.save=function(){if(!eS.disabled) setTimeout(eSave,0);};
CodeMirror.commands.close=E.close=$('eClose').onclick=function(){if(confirmCancel(!eS.disabled)) eClose();};

// Theme
var themes={
	"default":['default.css','default'],
	dark:['dark.css','tomorrow-night-eighties'],
},th=$('sTheme');
function loadTheme(o){
	o=themes[o]||themes['default'];
	$('theme').href='themes/'+o[0];
	T.setOption('theme',o[1]);
}
th.onchange=function(e){
	var v=e.target.value;
	loadTheme(v);
	rt.post('SetOption',{key:'theme',data:v});
};

// Load at last
var ids,map,cache;
function loadOptions(o){
	ids=o.ids;map=o.map;cache=o.cache;L.innerHTML='';
	ids.forEach(function(i){addItem(map[i]);});
	updateMove(L.firstChild);updateMove(L.lastChild);
	$('cUpdate').checked=o.autoUpdate;
	$('tSearch').value=o.search;
	$('tExclude').value=o.gExc.join('\n');
	if(!($('cDetail').checked=o.showDetails)) L.classList.add('simple');
	xD.checked=o.withData;
	loadTheme(th.value=o.theme||'default');
}
rt.listen('GotOptions',function(o){loadOptions(o);});		// loadOptions can be rewrited
rt.listen('UpdateItem',function(r){
	if(!('item' in r)||r.item<0) return;
	if(r.obj) map[r.obj.id]=r.obj;
	switch(r.status){
		case 0:loadItem(L.childNodes[r.item],r.obj,r);break;
		case 1:ids.push(r.obj.id);addItem(r.obj);updateMove(L.childNodes[r.item-1]);break;
		default:modifyItem(L.childNodes[r.item],r);
	}
	updateMove(L.childNodes[r.item]);
});
rt.post('GetOptions');
