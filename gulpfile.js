const del = require('del');
const gulp = require('gulp');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const minifyCss = require('gulp-minify-css');
const merge2 = require('merge2');
const through = require('through2');
const gulpFilter = require('gulp-filter');
const bom = require('./scripts/bom');
const i18n = require('./scripts/i18n');
const templateCache = require('./scripts/templateCache');

gulp.task('templates', function () {
  return merge2([
    gulp.src('src/cache.js'),
    gulp.src('src/**/templates/*.html').pipe(templateCache()),
  ]).pipe(concat('cache.js'))
	.pipe(uglify())
  .pipe(gulp.dest('dist'));
});

gulp.task('clean', function () {
  return del(['dist']);
});

gulp.task('copy-files',function(){
	const cssFilter = gulpFilter(['**/*.css'], {restore: true});
	const jsFilter = gulpFilter(['**/*.js'], {restore: true});
	return gulp.src([
		'src/**',
		'!src/cache.js',
		'!src/**/templates/**',
		'!src/**/templates',
		'!src/locale/**',
    '!src/def.json',
	])
	.pipe(cssFilter)
	.pipe(minifyCss())
	.pipe(cssFilter.restore)
	.pipe(jsFilter)
	.pipe(uglify())
	.pipe(jsFilter.restore)
	.pipe(gulp.dest('dist/'));
});

gulp.task('copy-i18n', function () {
  return gulp.src([
    'src/**/*.js',
    'src/**/*.html',
  ])
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
	return gulp.src('src/def.json')
	.pipe(bom.strip())
	.pipe(through.obj(function (file, enc, cb) {
		content = String(file.contents);
		content = JSON.stringify(JSON.parse(content));
		file.contents = new Buffer(content);
		cb(null, file);
	}))
	.pipe(bom.add())
	.pipe(gulp.dest('dist'));
});

gulp.task('default', ['templates', 'copy-files', 'copy-i18n', 'copy-def']);

gulp.task('i18n', function () {
  return gulp.src([
    'src/**/*.js',
    'src/**/*.html',
  ])
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
