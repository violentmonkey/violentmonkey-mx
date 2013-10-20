/*function initAce(callback,data){
	data=data||{};
	addScript({src:'lib/ace-min-noconflict/ace.js'},function(){
		var T=ace.edit('mCode'),s=T.getSession();
		T.setValueAndFocus=function(v){
			T.setValue(v);T.focus();T.gotoLine(0,0);
		};
		s.setMode('ace/mode/css');
		s.setUseSoftTabs(false);
		s.setUseWrapMode(true);
		s.setUseWorker(true);
		T.clearHistory=s.getUndoManager().reset;
		if(data.onchange) s.on('change',data.onchange);
		if(data.readonly) T.setReadOnly(data.readonly);
		callback(T);
	});
}*/

function initCodeMirror(callback,data){
	data=data||{};
	addCSS({href:'lib/CodeMirror.css'});
	addScript({src:'lib/CodeMirror.js'},function(){
		var T=CodeMirror($('mCode'),{
			continueComments:true,
			matchBrackets:true,
			autoCloseBrackets:true,
			highlightSelectionMatches:true,
			lineNumbers:true,
			mode:'text/css',
			lineWrapping:true,
			indentUnit:4,
			indentWithTabs:true,
			styleActiveLine:true,
			foldGutter:true,
			gutters:['CodeMirror-linenumbers','CodeMirror-foldgutter'],
		});
		T.clearHistory=function(){T.getDoc().clearHistory();};
		T.setValue(' ');	// fix CodeMirror for setting null string as value
		T.setValueAndFocus=function(v){T.setValue(v);T.focus();};
		T.getWrapperElement().setAttribute('style','position:absolute;height:100%;width:100%;');
		if(data.onchange) T.on('change',data.onchange);
		if(data.readonly) T.setOption('readOnly',data.readonly);
		callback(T);
	});
}

var initEditor=initCodeMirror;
