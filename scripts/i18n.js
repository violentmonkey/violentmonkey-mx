'use strict';

const gutil = require('gulp-util');
const through = require('through2');
const fs = require('fs');

function Locale(lang, path, base) {
  this.lang = lang;
  this.path = path;
  this.base = base || '.';
  this.data = {};
  this.loaded = this.read();
}
Locale.prototype.read = function () {
  return new Promise((resolve, reject) => {
    const file = this.base + '/' + this.path;
    fs.readFile(file, 'utf8', (err, data) => err ? reject(err) : resolve(data));
  }).then((data) => {
    const keys = new Set();
    data.split(/\n/g).forEach((line) => {
      line = line.trim();
      const i = line.indexOf('=');
      if (i < 0) return;
      const key = line.slice(0, i);
      let value = line.slice(i + 1);
      if (/^".*?"$/.test(value)) try {
        value = JSON.parse(value);
      } catch (e) {
        value = value.slice(1, -1);
      }
      this.data[key] = value;
      keys.add(key);
    });
    return keys;
  });
};
Locale.prototype.get = function (key, def) {
  return this.data[key] || def;
};

function Locales(prefix, base) {
  this.prefix = prefix || '.';
  this.base = base || '.';
  this.langs = [];
  this.data = {};
  this.keys = {};
  this.loaded = this.load();
}
Locales.prototype.defaultLang = 'en';
Locales.prototype.getLanguages = function () {
  const localeDir = this.base + '/' + this.prefix;
  return new Promise((resolve, reject) => {
    fs.readdir(localeDir, (err, files) =>
      err ? reject(err) : resolve(files.map((file) => file.replace(/\.ini$/, '')))
    );
  });
};
Locales.prototype.load = function () {
  return this.getLanguages().then((langs) => {
    this.langs = langs;
    return Promise.all(langs.map((lang) => {
      const locale = this.data[lang] = new Locale(lang, `${this.prefix}/${lang}.ini`, this.base);
      return locale.loaded;
    }));
  }).then((data) => {
    const keys = data[this.langs.indexOf(this.defaultLang)];
    keys.forEach((key) => {
      this.keys[key] = false;
    });
  });
};
Locales.prototype.extraneousMark = '[EXTRANEOUS] ';
Locales.prototype.getData = function (lang, options) {
  options = options || {};
  const data = {};
  const langData = this.data[lang];
  const defaultData = options.useDefaultLang && lang != this.defaultLang && this.data[this.defaultLang];
  for (let key in this.keys) {
    if (options.touchedOnly && !this.keys[key]) continue;
    data[key] = langData.get(key) || defaultData && defaultData.get(key) || '';
    if (options.markUntouched && !this.keys[key] && !data[key].startsWith(this.extraneousMark))
      data[key] = this.extraneousMark + data[key];
  }
  return data;
};
Locales.prototype.dump = function (options) {
  return this.langs.map((lang) => {
    const data = this.getData(lang, options);
    const string = '[lang]\n' + Object.keys(data).map(function (key) {
      let value = data[key];
      const json = JSON.stringify(value);
      if (json.slice(1, -1).trim() != value) value = json;
      return key + '=' + value;
    }).join('\n');
    return new gutil.File({
      base: '',
      path: this.data[lang].path,
      contents: new Buffer(string),
    });
  });
};
Locales.prototype.touch = function (key) {
  this.keys[key] = true;
};

function extract(options) {
  const keys = new Set();
  const patterns = {
    js: ['_.i18n\\(([\'"])(\\w+)\\1', 2],
    html: ['data-i18n=([\'"]?)(\\w+)\\1', 2],
  };

  const locales = new Locales(options.prefix, options.base);

  function extract(data, types) {
    if (!Array.isArray(types)) types = [types];
    data = String(data);
    types.forEach(function (type) {
      const patternData = patterns[type];
      const pattern = new RegExp(patternData[0], 'g');
      const groupId = patternData[1];
      let groups;
      while (groups = pattern.exec(data)) {
        keys.add(groups[groupId]);
      }
    });
  }

  function bufferContents(file, enc, cb) {
    if (file.isNull()) return cb();
    if (file.isStream())
      return this.emit('error', new gutil.PluginError('VM-i18n', 'Stream is not supported.'));
    if (file.path.endsWith('.js'))
      extract(file.contents, 'js');
    else if (file.path.endsWith('.html'))
      extract(file.contents, ['html', 'js']);
    cb();
  }

  function endStream(cb) {
    locales.loaded.then(() => {
      keys.forEach((key) => {
        locales.touch(key);
      });
      return locales.dump({
        touchedOnly: options.touchedOnly,
        useDefaultLang: options.useDefaultLang,
      });
    }).then((files) => {
      files.forEach((file) => {
        this.push(file);
      });
      cb();
    });
  }

  return through.obj(bufferContents, endStream);
}

module.exports = {
  extract,
};
