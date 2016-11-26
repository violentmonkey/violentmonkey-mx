const gutil = require('gulp-util');
const through = require('through2');
const yaml = require('js-yaml');

module.exports = function (handle) {
  return through.obj(function (file, enc, cb) {
    if (file.isNull()) return cb();
    if (file.isStream()) return this.emit('error', new gutil.PluginError('VM-json', 'Stream is not supported.'));
    handle = handle || (i => i);
    let contents = String(file.contents);
    if (file.relative.toLowerCase().endsWith('.yml')) {
      contents = yaml.safeLoad(contents);
      file.path = file.path.slice(0, -4) + '.json';
    } else {
      contents = JSON.parse(contents);
    }
    file.contents = new Buffer(JSON.stringify(handle(contents)));
    cb(null, file);
  });
};
