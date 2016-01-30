const del = require('del');
const gulp = require('gulp');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const minifyCss = require('gulp-minify-css');
const merge2 = require('merge2');
const through = require('through2');
const gulpFilter = require('gulp-filter');
const order = require('gulp-order');
const bom = require('./scripts/bom');
const i18n = require('./scripts/i18n');
const templateCache = require('./scripts/templateCache');
const pkg = require('./package.json');
const isProd = process.env.NODE_ENV === 'production';

const paths = {
  cache: 'src/cache.js',
  templates: 'src/**/templates/*.html',
  jsOptions: 'src/options/**/*.js',
  jsPopup: 'src/popup/**/*.js',
  locales: [
    'src/**/*.js',
    'src/**/*.html',
  ],
  copy: [
    'src/**',
    '!src/cache.js',
    '!src/**/templates/**',
    '!src/**/templates',
    '!src/**/views',
    '!src/options/**/*.js',
    '!src/popup/**/*.js',
    '!src/locale/**',
    '!src/def.json',
  ],
  def: 'src/def.json',
};

gulp.task('watch', function () {
  gulp.watch([].concat(paths.cache, paths.templates), ['templates']);
  gulp.watch(paths.jsOptions, ['js-options']);
  gulp.watch(paths.jsPopup, ['js-popup']);
  gulp.watch(paths.copy, ['copy-files']);
  gulp.watch(paths.locales, ['copy-i18n']);
  gulp.watch(paths.def, ['copy-def']);
});

gulp.task('clean', function () {
  return del(['dist']);
});

gulp.task('templates', function () {
  var stream = merge2([
    gulp.src(paths.cache),
    gulp.src(paths.templates).pipe(templateCache()),
  ]).pipe(concat('cache.js'));
  if (isProd) stream = stream.pipe(uglify());
	return stream.pipe(gulp.dest('dist'));
});

gulp.task('js-options', function () {
  var stream = gulp.src(paths.jsOptions)
  .pipe(order([
    '**/tab-*.js',
    '!**/app.js',
  ]))
  .pipe(concat('options/app.js'));
  if (isProd) stream = stream.pipe(uglify());
	return stream.pipe(gulp.dest('dist'));
});

gulp.task('js-popup', function () {
  var stream = gulp.src(paths.jsPopup)
  .pipe(order([
    '**/base.js',
    '!**/app.js',
  ]))
  .pipe(concat('popup/app.js'));
  if (isProd) stream = stream.pipe(uglify());
	return stream.pipe(gulp.dest('dist'));
})

gulp.task('copy-files',function(){
	const cssFilter = gulpFilter(['**/*.css'], {restore: true});
	const jsFilter = gulpFilter(['**/*.js'], {restore: true});
	var stream = gulp.src(paths.copy)
	.pipe(cssFilter)
	.pipe(minifyCss())
	.pipe(cssFilter.restore)
	.pipe(jsFilter);
  if (isProd) stream = stream.pipe(uglify());
  return stream
	.pipe(jsFilter.restore)
	.pipe(gulp.dest('dist/'));
});

gulp.task('copy-i18n', function () {
  return gulp.src(paths.locales)
	.pipe(bom.strip())
	.pipe(i18n.extract({
    base: 'src',
    prefix: 'locale',
    touchedOnly: true,
    useDefaultLang: true,
    markUntouched: false,
  }))
	.pipe(bom.add())
  .pipe(gulp.dest('dist'));
});

gulp.task('copy-def', function () {
	return gulp.src(paths.def)
	.pipe(bom.strip())
	.pipe(through.obj(function (file, enc, cb) {
		content = String(file.contents).replace('__VERSION__', pkg.version);
		content = JSON.stringify(JSON.parse(content));
		file.contents = new Buffer(content);
		cb(null, file);
	}))
	.pipe(bom.add())
	.pipe(gulp.dest('dist'));
});

gulp.task('default', ['templates', 'js-options', 'js-popup', 'copy-files', 'copy-i18n', 'copy-def']);

gulp.task('i18n', function () {
  return gulp.src(paths.locales)
	.pipe(bom.strip())
	.pipe(i18n.extract({
    base: 'src',
    prefix: 'locale',
    touchedOnly: false,
    useDefaultLang: false,
    markUntouched: true,
  }))
	.pipe(bom.add())
  .pipe(gulp.dest('src'));
});
