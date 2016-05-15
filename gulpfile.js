const gulp = require('gulp');
const concat = require('gulp-concat');
const replace = require('gulp-replace');
const footer = require('gulp-footer');
const uglify = require('gulp-uglify');
const cssnano = require('gulp-cssnano');
const merge2 = require('merge2');
const through = require('through2');
const gulpFilter = require('gulp-filter');
const eslint = require('gulp-eslint');
const svgSprite = require('gulp-svg-sprite');
const bom = require('./scripts/bom');
const i18n = require('./scripts/i18n');
const templateCache = require('./scripts/templateCache');
const pkg = require('./package.json');
const isProd = process.env.NODE_ENV === 'production';

const paths = {
  cache: 'src/cache.js',
  def: 'src/def.json',
  templates: 'src/**/templates/*.html',
  jsBg: 'src/background/**/*.js',
  jsOptions: 'src/options/**/*.js',
  jsPopup: 'src/popup/**/*.js',
  locales: [
    'src/**/*.js',
    'src/**/*.html',
  ],
  copy: [
    'src/*.js',
    '!src/cache.js',
    'src/public/**',
    'src/*/*.html',
    'src/*/*.css',
  ],
};

gulp.task('watch', () => {
  gulp.watch([].concat(paths.cache, paths.templates), ['templates']);
  gulp.watch(paths.jsBg, ['js-bg']);
  gulp.watch(paths.jsOptions, ['js-options']);
  gulp.watch(paths.jsPopup, ['js-popup']);
  gulp.watch(paths.copy, ['copy-files']);
  gulp.watch(paths.locales, ['copy-i18n']);
  gulp.watch(paths.def, ['copy-def']);
});

gulp.task('eslint', () => (
  gulp.src([
    'src/**/*.js',
    '!src/public/**',
  ])
  .pipe(eslint())
  .pipe(eslint.format())
));

gulp.task('templates', () => {
  var stream = merge2([
    gulp.src(paths.cache),
    gulp.src(paths.templates).pipe(templateCache()),
  ]).pipe(concat('cache.js'));
  if (isProd) stream = stream.pipe(uglify());
	return stream.pipe(gulp.dest('dist'));
});

gulp.task('js-bg', () => {
  var stream = gulp.src(paths.jsBg)
  .pipe(concat('background/app.js'))
  .pipe(footer(';define.use("app");'));
  if (isProd) stream = stream.pipe(uglify());
  return stream.pipe(gulp.dest('dist'));
});

gulp.task('js-options', () => {
  var stream = gulp.src(paths.jsOptions)
  .pipe(concat('options/app.js'))
  .pipe(footer(';define.use("app");'));
  if (isProd) stream = stream.pipe(uglify());
	return stream.pipe(gulp.dest('dist'));
});

gulp.task('js-popup', () => {
  var stream = gulp.src(paths.jsPopup)
  .pipe(concat('popup/app.js'))
  .pipe(footer(';define.use("app");'));
  if (isProd) stream = stream.pipe(uglify());
	return stream.pipe(gulp.dest('dist'));
})

gulp.task('copy-files', () => {
	const cssFilter = gulpFilter(['**/*.css'], {restore: true});
	const jsFilter = gulpFilter(['**/*.js'], {restore: true});
	var stream = gulp.src(paths.copy);
  if (isProd) stream = stream
  .pipe(jsFilter)
  .pipe(uglify())
  .pipe(jsFilter.restore);
  stream = stream
	.pipe(cssFilter)
	.pipe(cssnano({
    zindex: false,
  }))
  // Fix: Maxthon does not support internal links with query string
  // Fixed in v4.9.3.200
  .pipe(replace(/url\(([^)]*)\?[^)]*\)/g, 'url($1)'))
	.pipe(cssFilter.restore)
	.pipe(gulp.dest('dist/'));
});

gulp.task('copy-i18n', () => (
  gulp.src(paths.locales)
	.pipe(bom.strip())
	.pipe(i18n.extract({
    base: 'src',
    prefix: 'locale',
    touchedOnly: true,
    useDefaultLang: true,
    markUntouched: false,
    extension: '.ini',
  }))
	.pipe(bom.add())
  .pipe(gulp.dest('dist'))
));

gulp.task('copy-def', () => (
	gulp.src(paths.def)
	.pipe(bom.strip())
	.pipe(through.obj(function (file, enc, cb) {
		content = String(file.contents).replace('__VERSION__', pkg.version);
		content = JSON.stringify(JSON.parse(content));
		file.contents = new Buffer(content);
		cb(null, file);
	}))
	.pipe(bom.add())
	.pipe(gulp.dest('dist'))
));

gulp.task('svg', () => (
  gulp.src('icons/*.svg')
  .pipe(svgSprite({
    mode: {
      symbol: {
        dest: '',
        sprite: 'sprite.svg',
      },
    },
  }))
  .pipe(gulp.dest('dist/icons'))
));

gulp.task('build', [
  'templates',
  'js-bg',
  'js-options',
  'js-popup',
  'copy-files',
  'copy-i18n',
  'copy-def',
  'svg',
]);

gulp.task('i18n', () => (
  gulp.src(paths.locales)
	.pipe(bom.strip())
	.pipe(i18n.extract({
    base: 'src',
    prefix: 'locale',
    touchedOnly: false,
    useDefaultLang: false,
    markUntouched: true,
    extension: '.yml',
  }))
	.pipe(bom.add())
  .pipe(gulp.dest('src'))
));
