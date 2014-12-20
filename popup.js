(function(){
var P=$('#main'),C=$('#commands'),pR=P.querySelector('.expand'),
	pT=P.querySelector('.top'),pB=P.querySelector('.bot'),
	cT=C.querySelector('.top'),cB=C.querySelector('.bot');
function loadItem(d,c){
	d.data=c;
	if(d.symbols) {
		d.firstChild.className='fa '+d.symbols[c?1:0];
		if(d.symbols.length>1) {
			if(c) d.classList.remove('disabled');
			else d.classList.add('disabled');
		}
	}
}
function addItem(h,c){
	var d=document.createElement('div');
	d.innerHTML='<i></i> '+h;
	if('title' in c) {
		d.title=typeof c.title=='string'?c.title:h;
		delete c.title;
	}
	c.holder.appendChild(d);
	for(h in c) d[h]=c[h];
	if(d.symbols) loadItem(d,d.data);
	return d;
}
function menuCommand(e){e=e.target;rt.post(e.source,{cmd:'Command',data:e.cmd});}
function menuScript(s) {
	if(s) {
		var n=s.custom.name||getLocaleString(s.meta,'name');
		n=n?n.replace(/&/g,'&amp;').replace(/</g,'&lt;'):'<em>'+_('labelNoName')+'</em>';
		addItem(n,{
			holder:pB,
			symbols: ['fa-times','fa-check'],
			className: 'ellipsis',
			title:s.meta.name,
			onclick:function(e){
				var t=this;s.enabled=s.enabled?0:1;
				post({cmd:'UpdateMeta',data:{id:s.id,enabled:s.enabled}},function(){loadItem(t,s.enabled);});
			},
			data:s.enabled,
		});
	}
}
function getPopup(){
	count++;	// avoid frequent asking for popup menu
	setTimeout(function(){
		if(!--count) injectContent('setPopup();');
	},100);
}
var count=0;
function load(o,src,callback){
	pT.innerHTML=pB.innerHTML=cT.innerHTML=cB.innerHTML='';C.classList.add('hide');P.classList.remove('hide');
	addItem(_('menuManageScripts'),{
		holder:pT,
    symbols: ['fa-hand-o-right'],
		//title:true,
		onclick:function(){
		br.tabs.newTab({url:rt.getPrivateUrl()+'options.html',activate:true});
		},
	});
	if(o) addItem(_('menuFindScripts'),{
		holder:pT,
		symbols: ['fa-hand-o-right'],
		//title:true,
		onclick:function(){
			var h=br.tabs.getCurrentTab().url.match(/:\/\/(?:www\.)?([^\/]*)/);
			post({cmd:'GetOption',data:'search'},function(o){
				br.tabs.newTab({url:'https://greasyfork.org/scripts/search?q='+h[1],activate:true});
			});
		},
	});
	if(o&&o[0]&&o[0].length) {
		addItem(_('menuBack'),{
			holder:cT,
      symbols: ['fa-arrow-left'],
      //title: true,
			onclick:function(){
				C.classList.add('hide');P.classList.remove('hide');
			},
		});
		o[0].forEach(function(i){addItem(i[0],{
			holder:cB,
			className: 'ellipsis',
			symbols: ['fa-hand-o-right'],
			//title: true,
			onclick:menuCommand,
			cmd:i[0],
			source:src.id,
		});});
		addItem(_('menuCommands'),{
			holder:pT,
      symbols: ['fa-arrow-right'],
      //title: true,
			onclick:function(){
				P.classList.add('hide');
				C.classList.remove('hide');
			},
		});
	}
	var a=addItem(_('menuScriptEnabled'),{
		holder:pT,
		symbols: ['fa-times','fa-check'],
		//title:true,
		onclick:function(e){
			post({cmd:'SetOption',data:{key:'isApplied',value:this.data=!this.data}});
			loadItem(this,this.data);rt.icon.setIconImage('icon'+(this.data?'':'w'));
		},
	});
	post({cmd:'GetOption',data:'isApplied'},function(o){loadItem(a,o);});
	if(o&&o[1]&&o[1].length) {
		pR.classList.remove('hide');
		post({cmd:'GetMetas',data:o[1]},function(o){
			o.forEach(menuScript);
		});
	} else pR.classList.add('hide');
	if(!o) getPopup();
}
rt.listen('Popup',function(o){
	var maps={
		GetPopup:getPopup,
		SetPopup:load,
	},f=maps[o.cmd];
	function callback(d){
		rt.post(o.src.id,{cmd:'Callback',data:{id:o.callback,data:d}});
	}
	if(f) f(o.data,o.src,callback);
});
var post=initMessage({});load();
br.onBrowserEvent=function(o){
	switch(o.type){
		case 'TAB_SWITCH':
		case 'ON_NAVIGATE':
			load();
	}
};
})();
