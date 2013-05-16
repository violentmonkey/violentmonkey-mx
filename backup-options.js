(function(){
	var _loadOptions=loadOptions,d=A.querySelector('div');
	d.insertAdjacentHTML('beforeBegin','<label><input type=checkbox id=cBackup><span>'+_('Automatically backup data to addon config storage')+'</span></label>');
	d=$('cBackup');
	loadOptions=function(o){
		d.checked=o.autoBackup;
		return _loadOptions(o);
	};
	d.onchange=function(){rt.post('SetOption',{wkey:'autoBackup',key:'autoBackup',data:this.checked});};
})();
