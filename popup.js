function $(i){return document.getElementById(i);}
var P=$('popup'),C=$('commands'),tab,
	pT=P.querySelector('.top'),pB=P.querySelector('.bot'),
	cT=C.querySelector('.top'),cB=C.querySelector('.bot');
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
	var d=document.createElement('label'),s='';
	d.innerHTML='<span></span>'+h;
	if(t) {if(typeof t!='string') t=h;d.title=t;}
	d.className='ellipsis';
	c.holder.appendChild(d);
	if('symbol' in c) d.firstChild.innerText=c.symbol;
	else if('data' in c) c.symbol='✓';
	for(t in c) d[t]=c[t];
	if('data' in c) loadItem(d,c.data);
}
function menuCommand(e){e=e.target;rt.post(tab,{topic:'Command',data:e.cmd});}
function menuScript(i) {
	var s=_data.map[i];if(!s) return;
	var n=s.meta.name?s.meta.name.replace(/&/g,'&amp;').replace(/</g,'&lt;'):'<em>'+_('Null name')+'</em>';
	addItem(n,s.meta.name,{holder:pB,data:s.enabled,onclick:function(e){
		loadItem(this,s.enabled=!s.enabled);_data.save();
		rt.post('UpdateItem',{cmd:'update',data:_data.ids.indexOf(i),id:i});
	}});
}
function load(o){
	tab=o?o.source:null;
	pT.innerHTML=pB.innerHTML=cT.innerHTML=cB.innerHTML='';
	if(window.external.mxVersion>'4') addItem(_('Manage scripts'),true,{holder:pT,symbol:'➤',onclick:function(){
		br.tabs.newTab({url:rt.getPrivateUrl()+'options.html',activate:true});
	}});
	addItem(_('Find scripts for this site'),true,{holder:pT,symbol:'➤',onclick:function(){
		var q='site:userscripts.org+inurl:show+'+br.tabs.getCurrentTab().url.replace(/^.*?:\/\/([^\/]*?)\.\w+\/.*$/,function(v,g){
			return g.replace(/\.(com|..)$/,'').replace(/\./g,'+');
		});
		br.tabs.newTab({url:format(_data.data.search,q),activate:true});
	}});
	var d=o&&o.data;
	if(d&&d[0]&&d[0].length) {
		addItem(_('Back'),true,{holder:cT,symbol:'◄',onclick:function(){
			C.classList.add('hide');P.classList.remove('hide');
		}});
		cT.appendChild(document.createElement('hr'));
		d[0].forEach(function(i){addItem(i[0],true,{holder:cB,symbol:'➤',onclick:menuCommand,cmd:i[0],source:o.source});});
		addItem(_('Script commands...'),true,{holder:pT,symbol:'➤',onclick:function(){
			P.classList.add('hide');C.classList.remove('hide');
			setTimeout(function(){cB.style.pixelHeight=innerHeight-cB.offsetTop;},0);
		}});
	}
	addItem(_('Scripts enabled'),true,{holder:pT,data:_data.data.isApplied,onclick:function(e){
		_data.set('isApplied',!_data.data.isApplied);loadItem(this,_data.data.isApplied);
	}});
	if(d&&d[1]&&d[1].length) {
		_data.load();
		pT.appendChild(document.createElement('hr'));
		d[1].forEach(menuScript);
	}
}
function getPopup(){unsafeExecute(null,'GetPopup');}
rt.listen('GetPopup',getPopup);
rt.listen('SetPopup',load);
br.onBrowserEvent=function(o){
	switch(o.type){
		case 'TAB_SWITCH': getPopup();
	}
};
initFont();load();getPopup();
