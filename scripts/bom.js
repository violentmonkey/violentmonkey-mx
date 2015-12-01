const gutil = require('gulp-util');
const through = require('through2');

const BOM = new Buffer([0xef, 0xbb, 0xbf]);

function dealWithBOM(ensure) {
  return through.obj(function (file, enc, cb) {
    if (file.isNull()) {
      this.push(file);
      return cb();
    }
    if(file.isStream()) {
			this.emit('error', new gutil.PluginError('VM-AddBOM', 'Stream not supported'));
			return cb();
		}
    if (file.contents.slice(0, 3).compare(BOM)) {
      if (ensure)
        file.contents = Buffer.concat([BOM, file.contents]);
    } else {
      if (!ensure)
        file.contents = file.contents.slice(3);
    }
		this.push(file);
		cb();
  });
}

module.exports = {
  add: function () {
    return dealWithBOM(true);
  },
  strip: function () {
    return dealWithBOM();
  },
};
