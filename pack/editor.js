function initEditor(callback,data){
	data=data||{};
	addCSS({href:'lib/CodeMirror.css'});
	addScript({src:'lib/CodeMirror.js'},function(){
		CodeMirror.keyMap.vm={'fallthrough':'default'};
		if(data.save) {
			CodeMirror.keyMap.vm['Ctrl-S']='save';
			CodeMirror.commands.save=data.save;
		}
		if(data.exit) {
			CodeMirror.keyMap.vm['Esc']='exit';
			CodeMirror.commands.exit=data.exit;
		}
		var T=CodeMirror(document.getElementById('eCode'),{
			continueComments:true,
			matchBrackets:true,
			autoCloseBrackets:true,
			highlightSelectionMatches:true,
			lineNumbers:true,
			mode:'javascript',
			lineWrapping:true,
			indentUnit:4,
			indentWithTabs:true,
			keyMap:'vm',
			styleActiveLine:true,
			foldGutter:true,
			gutters:['CodeMirror-linenumbers','CodeMirror-foldgutter'],
		});
		T.clearHistory=function(){T.getDoc().clearHistory();};
		T.setValueAndFocus=function(v){T.setValue(v);T.focus();};
		if(data.onchange) T.on('change',data.onchange);
		if(data.readonly) T.setOption('readOnly',data.readonly);
		callback(T);
	});
}
