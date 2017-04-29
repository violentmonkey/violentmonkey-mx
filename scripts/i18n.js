const fs = require('fs');
const path = require('path');
const gutil = require('gulp-util');
const through = require('through2');
const yaml = require('js-yaml');
const promisify = require('es6-promisify');

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);

function parseIni(ini) {
  return ini.split('\n')
  .reduce((data, line) => {
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
    data[key] = {
      message: value,
    };
    return data;
  }, {});
}

function dumpIni(data) {
  return Object.keys(data)
  .reduce((out, key) => {
    let value = data[key].message;
    const json = JSON.stringify(value);
    if (json.slice(1, -1).trim() !== value) value = json;
    out.push(`${key}=${value}`);
    return out;
  }, ['[lang]'])
  .join('\n');
}

const transformers = {
  '.yml': data => yaml.safeLoad(data),
  '.json': data => JSON.parse(data),
  '.ini': parseIni,
};

class Locale {
  constructor(lang, basepath, basedir) {
    this.defaultLocale = 'messages.yml';
    this.lang = lang;
    this.basepath = basepath;
    this.basedir = basedir || '.';
    this.data = {};
    this.loaded = this.load();
  }

  load() {
    const localeDir = `${this.basedir}/${this.basepath}`;
    const data = {};
    return readdir(localeDir)
    .then(files => [this.defaultLocale].concat(files.filter(file => file !== this.defaultLocale)))
    .then(files => files.reduce((promise, file) => promise.then(() => {
      const ext = path.extname(file);
      const transformer = transformers[ext];
      if (transformer) {
        return readFile(`${localeDir}/${file}`, 'utf8')
        .then(res => { Object.assign(data, transformer(res)); }, err => {});
      }
    }), Promise.resolve()))
    .then(() => Object.keys(data).reduce((desc, key) => {
      this.data[key] = data[key].message;
      desc[key] = desc[key] || data[key].description;
      return desc;
    }, {}));
  }

  get(key, def) {
    return this.data[key] || def;
  }

  dump(data, ext, basename) {
    if (ext === '.ini') {
      data = dumpIni(data);
    } else if (ext === '.yml') {
      data = yaml.safeDump(data);
    } else {
      throw 'Unknown extension name!';
    }
    let filepath = this.basepath;
    if (basename) filepath += `/${basename}`;
    filepath += ext;
    return {
      path: filepath,
      data,
    };
  }
}

class Locales {
  constructor(prefix, base) {
    this.defaultLang = 'en';
    this.newLocaleItem = 'NEW_LOCALE_ITEM';
    this.prefix = prefix || '.';
    this.base = base || '.';
    this.langs = [];
    this.data = {};
    this.desc = {};
    this.loaded = this.load();
  }

  load() {
    return readdir(`${this.base}/${this.prefix}`)
    .then(langs => {
      this.langs = langs;
      return Promise.all(langs.map(lang => {
        const locale = this.data[lang] = new Locale(lang, `${this.prefix}/${lang}`, this.base);
        return locale.loaded;
      }));
    })
    .then(data => {
      const desc = data[this.langs.indexOf(this.defaultLang)];
      Object.keys(desc).forEach(key => {
        this.desc[key] = {
          touched: false,
          value: desc[key],
        };
      });
    });
  }

  getData(lang, options) {
    options = options || {};
    const data = {};
    const langData = this.data[lang];
    const defaultData = options.useDefaultLang && lang != this.defaultLang && this.data[this.defaultLang];
    Object.keys(this.desc).forEach(key => {
      if (options.touchedOnly && !this.desc[key].touched) return;
      data[key] = {
        description: this.desc[key].value || this.newLocaleItem,
        message: langData.get(key) || defaultData && defaultData.get(key) || '',
      };
      if (options.markUntouched && !this.desc[key].touched) data[key].touched = false;
    });
    return data;
  }

  dump(options) {
    return this.langs.map(lang => {
      const data = this.getData(lang, options);
      const locale = this.data[lang];
      const out = locale.dump(data, options.extension, options.basename);
      return new gutil.File({
        base: '',
        path: out.path,
        contents: new Buffer(out.data),
      });
    });
  }

  touch(key) {
    let item = this.desc[key];
    if (!item) item = this.desc[key] = {
      value: this.newLocaleItem,
    };
    item.touched = true;
  }
}

function extract(options) {
  const keys = new Set();
  const patterns = {
    default: ['\\bi18n\\(\'(\\w+)\'', 1],
  };
  const types = {
    '.js': 'default',
    '.html': 'default',
    '.vue': 'default',
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
    if (file.isStream()) return this.emit('error', new gutil.PluginError('VM-i18n', 'Stream is not supported.'));
    const extname = path.extname(file.path);
    const type = types[extname];
    type && extract(file.contents, type);
    cb();
  }

  function endStream(cb) {
    locales.loaded.then(() => {
      keys.forEach(key => {
        locales.touch(key);
      });
      return locales.dump({
        touchedOnly: options.touchedOnly,
        useDefaultLang: options.useDefaultLang,
        markUntouched: options.markUntouched,
        extension: options.extension,
        basename: options.basename,
      });
    }).then(files => {
      files.forEach(file => {
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
