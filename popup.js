function $(i){return document.getElementById(i);}
var P=$('popup'),C=$('commands'),pR=P.querySelector('.expand'),
	pT=P.querySelector('td'),pB=P.querySelector('.expanda'),
	cT=C.querySelector('td'),cB=C.querySelector('.expanda');
function loadItem(d,c){
	if(c) {
		d.firstChild.innerText=d.symbol;
		d.classList.remove('disabled');
	} else {
		d.firstChild.innerText='';
		d.classList.add('disabled');
	}
}
function addItem(h,t,c){
	var d=document.createElement('div'),s='';
	d.innerHTML='<span></span>'+h;
	if(t) {if(typeof t!='string') t=h;d.title=t;}
	d.className='ellipsis';
	c.holder.appendChild(d);
	if('symbol' in c) d.firstChild.innerText=c.symbol;
	else if('data' in c) c.symbol='✓';
	for(t in c) d[t]=c[t];
	if('data' in c) loadItem(d,c.data);
}
function menuCommand(e){e=e.target;rt.post(e.source,{topic:'Command',data:e.cmd});}
function menuScript(i) {
	var s=getItem('vm:'+i);if(!s) return;
	var n=s.meta.name?s.meta.name.replace(/&/g,'&amp;').replace(/</g,'&lt;'):'<em>'+_('Null name')+'</em>';
	addItem(n,s.meta.name,{holder:pB,data:s.enabled,onclick:function(e){
		loadItem(this,s.enabled=!s.enabled);rt.post('EnableScript',{id:i,data:s.enabled});
	}});
}
function getPopup(){
	getPopup.flag++;	// avoid frequent asking for popup menu
	setTimeout(function(){
		if(!--getPopup.flag) {
			br.executeScript('unsafeExecute(\'window.top.postMessage({topic:"VM_GetPopup"},"*");\');');
		}
	},200);
}
getPopup.flag=0;
function load(o){
	pT.innerHTML=pB.innerHTML=cT.innerHTML=cB.innerHTML='';C.classList.add('hide');P.classList.remove('hide');
	addItem(_('Manage scripts'),true,{holder:pT,symbol:'➤',onclick:function(){
		br.tabs.newTab({url:rt.getPrivateUrl()+'options.html',activate:true});
	}});
	if(o) addItem(_('Find scripts for this site'),true,{holder:pT,symbol:'➤',onclick:function(){
		var q='site:userscripts.org+inurl:show+'+br.tabs.getCurrentTab().url.replace(/^.*?:\/\/([^\/]*?)\.\w+\/.*$/,function(v,g){
			return g.replace(/\.(com|..)$/,'').replace(/\./g,'+');
		});
		br.tabs.newTab({url:format(getString('search'),q),activate:true});
	}});
	var d=o&&o.data;
	if(d&&d[0]&&d[0].length) {
		addItem(_('Back'),true,{holder:cT,symbol:'◄',onclick:function(){
			C.classList.add('hide');P.classList.remove('hide');
		}});
		d[0].forEach(function(i){addItem(i[0],true,{holder:cB,symbol:'➤',onclick:menuCommand,cmd:i[0],source:o.source});});
		addItem(_('Script commands...'),true,{holder:pT,symbol:'➤',onclick:function(){
			P.classList.add('hide');C.classList.remove('hide');
		}});
	}
	var isApplied=getItem('isApplied');
	addItem(_('Scripts enabled'),true,{holder:pT,data:isApplied,onclick:function(e){
		rt.post('EnableScript',{data:isApplied=!isApplied});loadItem(this,isApplied);
	}});
	if(d&&d[1]&&d[1].length) {
		pR.classList.remove('hide');
		d[1].forEach(menuScript);
	} else pR.classList.add('hide');
	if(!o) getPopup();
}
initFont();
load();
rt.listen('GetPopup',getPopup);
rt.listen('SetPopup',load);
br.onBrowserEvent=function(o){
	switch(o.type){
		case 'TAB_SWITCH':
		case 'ON_NAVIGATE':
			load();
	}
};
