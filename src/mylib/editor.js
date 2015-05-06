'use strict';

function initEditor(options) {
	options = options || {};
	CodeMirror.keyMap.vm = {'fallthrough': 'default'};
	if(options.onsave) {
		CodeMirror.keyMap.vm['Ctrl-S'] = 'save';
		CodeMirror.commands.save = options.onsave;
	}
	if(options.onexit) {
		CodeMirror.keyMap.vm['Esc'] = 'exit';
		CodeMirror.commands.exit = options.onexit;
	}
	var editor = CodeMirror(options.container, {
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
	editor.clearHistory = function() {
		this.getDoc().clearHistory();
	};
	editor.setValueAndFocus = function(value) {
		this.setValue(value);
		this.focus();
	};
	if(options.onchange) editor.on('change', options.onchange);
	if(options.readonly) editor.setOption('readOnly', options.readonly);
	if(options.callback) options.callback(editor);
}
