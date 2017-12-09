const del = require('del');
const gulp = require('gulp');
const gutil = require('gulp-util');
const gulpFilter = require('gulp-filter');
const uglify = require('gulp-uglify');
const plumber = require('gulp-plumber');
const yaml = require('js-yaml');
const webpack = require('webpack');
const webpackConfig = require('./scripts/webpack.conf');
const i18n = require('./scripts/i18n');
const string = require('./scripts/string');
const bom = require('./scripts/bom');
const { IS_DEV, definitions } = require('./scripts/utils');
const pkg = require('./package.json');

const paths = {
  def: 'src/def.yml',
  copy: [
    'src/public/lib/**',
    'src/icons/**',
  ],
  locales: [
    'src/_locales/**',
  ],
  templates: [
    'src/**/*.@(js|html|json|yml|vue)',
  ],
};

function webpackCallback(err, stats) {
  if (err) {
    gutil.log('[FATAL]', err);
    return;
  }
  if (stats.hasErrors()) {
    gutil.log('[ERROR] webpack compilation failed\n', stats.toJson().errors.join('\n'));
    return;
  }
  if (stats.hasWarnings()) {
    gutil.log('[WARNING] webpack compilation has warnings\n', stats.toJson().warnings.join('\n'));
  }
  (Array.isArray(stats.stats) ? stats.stats : [stats])
  .forEach(stat => {
    const timeCost = (stat.endTime - stat.startTime) / 1000;
    const chunks = Object.keys(stat.compilation.namedChunks).join(' ');
    gutil.log(`Webpack built: [${timeCost.toFixed(3)}s] ${chunks}`);
  });
}

gulp.task('clean', () => del(['dist']));

gulp.task('pack', ['manifest', 'copy-files', 'copy-i18n']);

gulp.task('watch', ['pack', 'js-dev'], () => {
  gulp.watch(paths.def, ['manifest']);
  gulp.watch(paths.copy, ['copy-files']);
  gulp.watch(paths.locales.concat(paths.templates), ['copy-i18n']);
});

gulp.task('build', ['pack', 'js-prd']);

gulp.task('js-dev', () => webpack(webpackConfig).watch({}, webpackCallback));
gulp.task('js-prd', () => webpack(webpackConfig, webpackCallback));

gulp.task('manifest', () => (
  gulp.src(paths.def)
  .pipe(bom.strip())
  .pipe(string((input, file) => {
    const data = yaml.safeLoad(input);
    data[0].version = pkg.version;
    data[0].service.debug = IS_DEV;
    definitions['process.env'].manifest = JSON.stringify(data[0]);
    file.path = file.path.replace(/\.yml$/, '.json');
    return JSON.stringify(data);
  }))
  .pipe(bom.add())
  .pipe(gulp.dest('dist'))
));

gulp.task('copy-files', ['manifest'], () => {
  const jsFilter = gulpFilter(['**/*.js'], { restore: true });
  let stream = gulp.src(paths.copy, { base: 'src' });
  if (!IS_DEV) stream = stream
  .pipe(jsFilter)
  .pipe(uglify())
  .pipe(jsFilter.restore);
  return stream
  .pipe(gulp.dest('dist/'));
});

gulp.task('copy-i18n', () => (
  gulp.src(paths.templates)
  .pipe(bom.strip())
  .pipe(plumber(logError))
  .pipe(i18n.extract({
    base: 'src/_locales',
    touchedOnly: true,
    useDefaultLang: true,
    markUntouched: false,
    extension: '.ini',
  }))
  .pipe(bom.add())
  .pipe(gulp.dest('dist/locale'))
));

gulp.task('i18n', () => (
  gulp.src(paths.templates)
  .pipe(bom.strip())
  .pipe(plumber(logError))
  .pipe(i18n.extract({
    base: 'src/_locales',
    touchedOnly: false,
    useDefaultLang: false,
    markUntouched: true,
    extension: '.yml',
  }))
  .pipe(bom.add())
  .pipe(gulp.dest('src/_locales'))
));

function logError(err) {
  gutil.log(err.toString());
  return this.emit('end');
}
