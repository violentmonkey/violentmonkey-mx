var $=document.getElementById.bind(document),
		N=$('main'),L=$('sList'),O=$('overlay');
zip.workerScriptsPath='lib/zip.js/';
function split(t){return t.replace(/^\s+|\s+$/g,'').split(/\s*\n\s*/).filter(function(e){return e;});}

// Main options
function allowUpdate(n){return n.update&&(n.custom.updateURL||n.meta.updateURL);}
var icons={};
function getIcon(d,n){
	if(n) {
		var u=icons[n];
		if(u==1) (d.src=n);
		else if(u) u.push(d);
		else {
			icons[n]=u=[d];
			var x=document.createElement('img');
			x.src=n;
			x.onload=function(){
				delete x;icons[n]=1;
				u.forEach(function(i){i.src=n;});
			};
		}
	}
}
function modifyItem(d,r){
	if(r) {
		if(r.message) d.querySelector('.message').innerHTML=r.message;
		with(d.querySelector('.update'))
			if(r.hideUpdate) classList.add('hide');
			else classList.remove('hide');
	}
}
function loadItem(o,r){
	var d=o.div,n=o.obj;
	d.innerHTML='<img class=icon src=icons/icon_64.png>'
	+'<a class="name ellipsis" target=_blank></a>'
	+'<span class=version>'+(n.meta.version?'v'+n.meta.version:'')+'</span>'
	+'<span class=author></span>'
	+'<div class=panelT>'
		+(allowUpdate(n)?'<a data=update class=update href=#>'+_('anchorUpdate')+'</a> ':'')
		+'<span class=move data=move>&equiv;</span>'
	+'</div>'
	+'<div class="descrip ellipsis"></div>'
	+'<span class=message></span>'
	+'<div class=panelB>'
		+'<button data=edit>'+_('buttonEdit')+'</button> '
		+'<button data=enable>'+(n.enabled?_('buttonDisable'):_('buttonEnable'))+'</button> '
		+'<button data=remove>'+_('buttonRemove')+'</button>'
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
	getIcon(d.querySelector('.icon'),n.meta.icon);
}
function addItem(o){
	o.div=document.createElement('div');
	loadItem(o);
	L.appendChild(o.div);
}
(function(){
	function getSource(e){
		var o=e.target,p,i;
		for(p=o;p&&p.parentNode!=L;p=p.parentNode);
		i=Array.prototype.indexOf.call(L.childNodes,p);
		return [i,p,o];
	}
	function moveItem(e){
		var m=getSource(e);if(m[0]<0) return;
		if(m[0]>=0&&m[0]!=t) {
			e=m;m=e[1];if(e[0]>t) m=m.nextSibling;
			L.insertBefore(o[1],m);
			t=e[0];
		}
	}
	function movedItem(e){
		if(!moving) return;moving=false;
		o[1].classList.remove('moving');
		L.onmousemove=L.onmouseup=null;L.onmousedown=startMove;
		if(o[0]!=t) {
			post({cmd:'Move',data:{from:o[0],to:t}});
			var s=t>o[0]?1:-1,i=o[0],x=ids[i];
			for(;i!=t;i+=s) ids[i]=ids[i+s];
			ids[t]=x;
		}
	}
	function startMove(e){
		o=getSource(e);t=o[0];
		if(o[2].getAttribute('data')=='move') {
			if(moving) return;moving=true;
			e.preventDefault();
			o[1].classList.add('moving');
			L.onmousedown=null;
			L.onmousemove=moveItem;
			L.onmouseup=movedItem;
		}
	}
	var maps={
		edit:function(i){
			E.cur=map[ids[i]];
			post({cmd:'GetScript',data:ids[i]},gotScript);
		},
		enable:function(i,p,o){
			var e=map[ids[i]].obj;
			post({cmd:'UpdateMeta',data:{id:e.id,enabled:!e.enabled?1:0}});
		},
		remove:function(i,p){
			post({cmd:'RemoveScript',data:ids[i]});
			delete map[ids.splice(i,1)[0]];
			L.removeChild(p);
		},
		update:function(i){
			post({cmd:'CheckUpdate',data:ids[i]});
		}
	},o,t,moving=false;
	L.onmousedown=startMove;
	L.onclick=function(e){
		var o=getSource(e),d=o[2].getAttribute('data'),f=maps[d];
		if(f) {
			e.preventDefault();
			f.apply(this,o);
		}
	};
})();
$('bNew').onclick=function(){post({cmd:'NewScript'},function(o){
	E.cur=null;gotScript(o);
});};
$('bUpdate').onclick=function(){post({cmd:'CheckUpdateAll'});};
$('cDetail').onchange=function(){L.classList.toggle('simple');post({cmd:'SetOption',data:{key:'showDetails',value:this.checked}});};
var panel=null;
function switchTo(D){
	if(panel) panel.classList.add('hide');
	D.classList.remove('hide');panel=D;
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
initCSS();initI18n(function(){switchTo(N);});

// Advanced
var A=$('advanced'),H=$('iImport');
$('bAdvanced').onclick=function(){showDialog(A);};
$('cUpdate').onchange=function(){post({cmd:'AutoUpdate',data:this.checked});};
$('cBadge').onchange=function(){post({cmd:'ShowBadge',data:this.checked});};
$('tSearch').title=_('hintSearchLink');
$('bDefSearch').onclick=function(){$('tSearch').value=_('defaultSearch');};
$('aExport').onclick=function(){showDialog(X);xLoad();};
H.onchange=function(e){
	zip.createReader(new zip.BlobReader(e.target.files[0]),function(r){
		r.getEntries(function(e){
			function getFiles(){
				var i=e.shift();
				if(i) i.getData(writer,function(t){
					var c={code:t};
					if(vm.scripts&&(v=vm.scripts[i.filename.slice(0,-8)])) {
						c.id=v.id;c.more=v;
					}
					post({cmd:'ParseScript',data:c});
					count++;
					getFiles();
				}); else {
					alert(_('msgImported',[count]));
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
				if(vm.values) for(z in vm.values) post({cmd:'SetValue',data:{uri:z,values:vm.values[z]}});
				if(vm.settings) for(z in vm.settings) post({cmd:'SetOption',data:{key:z,value:vm.settings[z]}});
				getFiles();
			}); else getFiles();
		});
	},function(e){console.log(e);});
}
$('aImport').onclick=function(){
	var e=document.createEvent('MouseEvent');
	e.initMouseEvent('click',true,true,window,0,0,0,0,0,false,false,false,false,0,null);
	H.dispatchEvent(e);
};
$('aVacuum').onclick=function(){
	var t=this;t.disabled=true;t.innerHTML=_('buttonVacuuming');
	post({cmd:'Vacuum'},function(){t.innerHTML=_('buttonVacuumed');});
};
$('aVacuum').title=_('hintVacuumData');
A.close=$('aClose').onclick=function(){
	post({cmd:'SetOption',data:{key:'search',value:$('tSearch').value}});
	closeDialog();
};

// Export
var X=$('export'),xL=$('xList'),xE=$('bExport'),xC=$('cCompress'),xD=$('cWithData');
function xLoad() {
	xL.innerHTML='';xE.disabled=false;xE.innerHTML=_('buttonExport');
	ids.forEach(function(i){
		var d=document.createElement('div');
		d.className='ellipsis';
		d.innerText=d.title=map[i].obj.meta.name;
		xL.appendChild(d);
	});
}
xD.onchange=function(){post({cmd:'SetOption',data:{key:'withData',value:this.checked}});};
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
function exported(o){
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
					X.close();
					URL.revokeObjectURL(u);
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
	o.scripts.forEach(function(c){
		var j=0;
		n=_n=c.custom.name||c.meta.name||'Noname';
		while(names[n]) n=_n+'_'+(++j);names[n]=1;
		addFile({name:n+'.user.js',content:c.code});
		vm.scripts[n]={id:c.id,custom:c.custom,enabled:c.enabled,update:c.update};
		if(xD.checked&&(n=o.values[c.uri])) vm.values[c.uri]=n;
	});
	addFile({name:'ViolentMonkey',content:JSON.stringify(vm)});
	addFile({});	// finish adding files
}
xE.onclick=function(e){
	e.preventDefault();
	this.disabled=true;this.innerHTML=_('buttonExporting');
	var i,c=[];
	for(i=0;i<ids.length;i++)
		if(xL.childNodes[i].classList.contains('selected')) c.push(ids[i]);
	post({cmd:'ExportZip',data:{values:xD.checked,data:c}},exported);
};

// Script Editor
var E=$('editor'),U=$('eUpdate'),M=$('meta'),
		mN=$('mName'),mH=$('mHomepage'),mR=$('mRunAt'),
		mU=$('mUpdateURL'),mD=$('mDownloadURL'),
    mI=$('mInclude'),mE=$('mExclude'),mM=$('mMatch'),
    cI=$('cInclude'),cE=$('cExclude'),cM=$('cMatch'),
		eS=$('eSave'),eSC=$('eSaveClose'),T;
function markClean(){
	T.clearHistory();
	eS.disabled=eSC.disabled=true;
}
function gotScript(o){
	switchTo(E);E.scr=o;U.checked=o.update;
	T.setValueAndFocus(o.code);markClean();
}
function eSave(){
	post({
		cmd:'ParseScript',
		data:{
			id:E.scr.id,
			code:T.getValue(),
			message:'',
			more:{
				custom:E.scr.custom,
				update:E.scr.update=U.checked
			}
		}
	});
	markClean();
}
function eClose(){switchTo(N);}
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
		case 'document-idle':mR.value='idle';break;
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
			case 'idle':c['run-at']='document-idle';break;
			case 'end':c['run-at']='document-end';break;
			default:delete c['run-at'];
		}
		c._include=cI.checked;
		c.include=split(mI.value);
		c._match=cM.checked;
		c.match=split(mM.value);
		c._exclude=cE.checked;
		c.exclude=split(mE.value);
		E.markDirty();
	}
	closeDialog();
};
eS.onclick=eSave;
eSC.onclick=function(){eSave();eClose();};
E.close=$('eClose').onclick=function(){if(confirmCancel(!eS.disabled)) eClose();};
initEditor(function(o){T=o;},{save:eSave,exit:E.close,onchange:E.markDirty});

// Message
var ids,map,cache,post=initMessage({
	Vacuumed: function(){
		for(var i=0;i<ids.length;i++) map[ids[i]].obj.position=i+1;
		$('aVacuum').innerHTML=_('buttonVacuumed');
	},
});
rt.listen('UpdateItem',function(r){
	console.log(r);
	if(!r.id) return;
	var m=map[r.id];
	if(!m) map[r.id]=m={};
	if(r.obj) m.obj=r.obj;
	switch(r.status){
		case 0:loadItem(m,r);break;
		case 1:ids.push(r.id);addItem(m);break;
		default:modifyItem(m.div,r);
	}
});
post({cmd:'GetData'},function(o){
	ids=[];map={};L.innerHTML='';
	cache=o.cache;
	o.scripts.forEach(function(i){
		ids.push(i.id);addItem(map[i.id]={obj:i});
	});
	$('cUpdate').checked=o.settings.autoUpdate;
	$('cBadge').checked=o.settings.showBadge;
	$('tSearch').value=o.settings.search;
	if(!($('cDetail').checked=o.settings.showDetails)) L.classList.add('simple');
	xD.checked=o.settings.withData;
});
