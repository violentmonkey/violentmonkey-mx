(function(){
	if(getString('ids')) return;
	// restore data from backup
	if(v=rt.storage.getConfig('backup')) try{
		v=JSON.parse(v);
		if(v) for(k in v) {
			if(/^cache:/.test(k)) v[k]=atob(v[k]);
			localStorage.setItem(k,v[k]);
		} else {	// data is lost and autobackup is disabled
			br.tabs.newTab({url:rt.getPrivateUrl()+'backup.html',activate:true});
		}
	}catch(e){} else rt.storage.setConfig('backup','null');	// first run
})();

// Backup data to rt.storage
function initBackup(){
	function save(){
		if(!--count) {
			var r={},i,k;
			for(i=0;k=localStorage.key(i);i++) {
				r[k]=localStorage.getItem(k);
				if(/^cache:/.test(k)) r[k]=btoa(r[k]);
			}
			rt.storage.setConfig('backup',JSON.stringify(r));
			_changed=false;
		}
	}
	function backup(){count++;setTimeout(save,3e4);}
	var _setString=setString,_changed=false,count=0;
	setString=function(k,v){
		_changed=true;
		if(autoBackup) backup();
		return _setString(k,v);
	};
	autoBackup=getItem('autoBackup',false);
	settings.o.push('autoBackup');
}
var autoBackup=false;
window.addEventListener('DOMContentLoaded',initBackup,false);
