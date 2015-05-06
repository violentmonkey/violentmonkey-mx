#!node
var gulp = require('gulp');
var concat = require('gulp-concat');
var order = require('gulp-order');
var inject = require('gulp-inject');
var uglify = require('gulp-uglify');
var less = require('gulp-less');
var minifyCss = require('gulp-minify-css');
var minifyHtml = require('gulp-minify-html');
var merge2 = require('merge2');
var through = require('through2');
var gutil = require('gulp-util');
var wrap = require('gulp-wrap');

function addBOM() {
	return through.obj(function(file, enc, cb) {
		if(file.isNull()) {
			this.push(file);
			return cb();
		}
		if(file.isStream()) {
			this.emit('error', new gutil.PluginError(PLUGIN_NAME, 'Stream not supported'));
			return cb();
		}
		var BOM = new Buffer([0xef,0xbb,0xbf]);
		var content = new Buffer(file.contents.toString());
		file.contents = Buffer.concat([BOM, content]);
		this.push(file);
		cb();
	});
}

function injectStream(name, streams) {
	if(Array.isArray(streams))
		streams = merge2.apply(this, streams);
	return inject(streams, {
		name: name,
		ignorePath: '/dist/',
		addRootSlash: false,
	});
}

gulp.task('inject-html', function() {
	return gulp.src('src/*.html')
		.pipe(injectStream('background',
			gulp.src('src/background.js')
				.pipe(uglify())
				.pipe(gulp.dest('dist/'))
		)).pipe(injectStream('common', [
			gulp.src('src/common.js')
				.pipe(uglify())
				.pipe(gulp.dest('dist/')),
			gulp.src('src/style.less')
				.pipe(less())
				.pipe(minifyCss())
				.pipe(gulp.dest('dist/')),
		])).pipe(injectStream('confirm',
			gulp.src('src/confirm.js')
				.pipe(uglify())
				.pipe(gulp.dest('dist/'))
		)).pipe(injectStream('options',
			gulp.src('src/options.js')
				.pipe(uglify())
				.pipe(gulp.dest('dist/'))
		)).pipe(injectStream('popup',
			gulp.src('src/popup.js')
				.pipe(uglify())
				.pipe(gulp.dest('dist/'))
		)).pipe(injectStream('codemirror',[
			gulp.src([
				'src/lib/CodeMirror/**/*.css',
				'src/mylib/CodeMirror/**/*.css',
			]).pipe(concat('CodeMirror.css'))
				.pipe(minifyCss())
				.pipe(gulp.dest('dist/lib')),
			gulp.src([
				'src/lib/CodeMirror/**/*.js',
				'src/mylib/CodeMirror/**/*.js',
				'src/mylib/editor.js',
			]).pipe(order([
				'lib/codemirror.js',
			])).pipe(concat('CodeMirror.js'))
				.pipe(uglify())
				.pipe(gulp.dest('dist/lib')),
		])).pipe(minifyHtml({empty:true}))
			.pipe(gulp.dest('dist/'));
});

gulp.task('build-files', function() {
	return gulp.src([
		'src/injected.js',
		'src/lib/zip.js/*',
	], {base:'src'})
		.pipe(uglify())
		.pipe(gulp.dest('dist'));
});

gulp.task('copy-files',function(){
	return gulp.src([
		'src/icons/*',
		'src/lib/**/*.*',
		'!src/lib/*',
		'!src/lib/CodeMirror/**/*',
		'!src/lib/zip.js/*',
	], {base:'src'})
		.pipe(gulp.dest('dist/'));
});

gulp.task('copy-utf8bom-files',function(){
	return gulp.src([
		'src/def.json',
		'src/locale/*',
	], {base:'src'})
		.pipe(addBOM())
		.pipe(gulp.dest('dist/'));
});

gulp.task('default', ['inject-html', 'build-files', 'copy-files', 'copy-utf8bom-files']);
