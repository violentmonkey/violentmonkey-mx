!function(){
'use strict';

function Menu(data) {
	this.data = data;
	var node = this.node = document.createElement('div');
	if(data.ellipsis) node.classList.add('ellipsis');
	node.innerHTML = '<i></i> ' + safeHTML(data.name);
	if('title' in data)
		node.title = typeof data.title == 'string' ? data.title : data.name;
	this.bindEvents();
	this.update(data.value);
	data.parent.insertBefore(node, data.before);
}
Menu.prototype = {
	update: function(value) {
		var node = this.node;
		var data = this.data;
		if(typeof value != 'undefined') data.value = value;
		if(data.symbols) {
			node.firstChild.className = 'fa ' + data.symbols[data.value ? 1 : 0];
			if(data.symbols.length > 1) {
				if(value) node.classList.remove('disabled');
				else node.classList.add('disabled');
			}
		}
	},
	bindEvents: function() {
		var events = this.data.events;
		for(var i in events)
			this.node.addEventListener(i, events[i].bind(this), false);
	},
};

var Popup = function () {
	var main = $('#main');
	var commands = $('#commands');
	var main_top = main.firstElementChild;
	var main_bot = main.lastElementChild;
	var commands_top = commands.firstElementChild;
	var commands_bot = commands.lastElementChild;
	var nodeIsApplied;
	var scripts, tab, sep;

	function initMenu() {
		scripts = {};
		sep = null;
		main_top.innerHTML = main_bot.innerHTML =
		commands_top.innerHTML = commands_bot.innerHTML = '';
		main.classList.remove('hide');
		commands.classList.add('hide');
		new Menu({
			name: _('menuManageScripts'),
			parent: main_top,
			symbols: ['fa-hand-o-right'],
			events: {
				click: function(e){
					br.tabs.newTab({
						url: rt.getPrivateUrl() + 'options.html',
						activate: true,
					});
				},
			},
		});
		if(/^https?:\/\//i.test(tab.url))
			new Menu({
				name: _('menuFindScripts'),
				parent: main_top,
				symbols: ['fa-hand-o-right'],
				events: {
					click: function(){
						var matches = tab.url.match(/:\/\/(?:www\.)?([^\/]*)/);
						br.tabs.newTab({
							url: 'https://greasyfork.org/scripts/search?q=' + matches[1],
							activate: true,
						});
					},
				},
			});
		nodeIsApplied = new Menu({
			name: _('menuScriptEnabled'),
			parent: main_top,
			symbols: ['fa-times','fa-check'],
			events: {
				click: function(e) {
					var value = !this.data.value;
					setOption('isApplied', value);
					this.update(value);
					rt.icon.setIconImage('icon' + (this.data ? '' : 'w'));
				},
			},
			value: getOption('isApplied'),
		}).node;
	}

	function menuScript(script) {
		if(script && !scripts[script.id]) {
			scripts[script.id] = script;
			var name = script.custom.name || getLocaleString(script.meta, 'name');
			name = name ? safeHTML(name) : '<em>' + _('labelNoName') + '</em>';
			new Menu({
				name: name,
				parent: main_bot,
				symbols: ['fa-times','fa-check'],
				title: script.meta.name,
				events: {
					click: function(e) {
						var value = !this.data.value;
						post({
							cmd: 'UpdateMeta',
							data: {
								id: script.id,
								enabled: value,
							},
						});
						this.update(value);
					},
				},
				value: script.enabled,
			});
		}
	}

	var getPopup = debounce(function () {
		injectContent('setPopup();');
	}, 100);

	function setData(data, src, callback) {
		tab = src || {};
		initMenu();
		if(!data) {
			getPopup();
			return;
		}
		if(data.menus && data.menus.length) {
			new Menu({
				name: _('menuBack'),
				parent: commands_top,
				symbols: ['fa-arrow-left'],
				events: {
					click: function(e) {
						commands.classList.add('hide');
						main.classList.remove('hide');
					},
				},
			});
			commands_top.appendChild(document.createElement('hr'));
			data.menus.forEach(function(menu) {
				new Menu({
					name: menu[0],
					parent: commands_bot,
					symbols: ['fa-hand-o-right'],
					events: {
						click: function(e) {
							rt.post(tab.id, {cmd: 'Command', data: this.data.name});
						},
					},
				});
			});
			new Menu({
				name: _('menuCommands'),
				parent: main_top,
				symbols: ['fa-arrow-right'],
				events: {
					click: function(e) {
						main.classList.add('hide');
						commands.classList.remove('hide');
					},
				},
				before: nodeIsApplied,
			});
		}
		if(data.ids && data.ids.length) {
			var ids = data.ids.filter(function (id) {
				return !scripts[id];
			});
			if(ids.length)
				post({cmd: 'GetMetas', data: ids}, function (scripts) {
					if(!sep)
						main_top.appendChild(sep = document.createElement('hr'));
					scripts.forEach(menuScript);
				});
		}
	}

	return {
		getPopup: getPopup,
		setData: setData,
	};
}();

rt.listen('Popup', function (req) {
	var maps = {
		GetPopup: Popup.getPopup,
		SetPopup: Popup.setData,
	};
	var func = maps[req.cmd];
	if(func) func(req.data, req.src, function (data) {
		rt.post(req.src.id, {
			cmd: 'Callback',
			data: {
				id: req.callback,
				data: data,
			},
		});
	});
});
var post = initMessage({});
Popup.setData();
br.onBrowserEvent=function(o){
	switch(o.type){
		case 'TAB_SWITCH':
		case 'ON_NAVIGATE':
			Popup.setData();
	}
};
}();
