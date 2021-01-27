const { series, parallel, dest, watch } = require('gulp');
const gulp = require('gulp');
const gulpEsbuild = require('gulp-esbuild');
const pug = require('gulp-pug');
const minHtml = require('gulp-htmlmin');
const uglify = require('gulp-uglify-es').default;
const sourcemaps = require('gulp-sourcemaps');
const imagemin = require('gulp-imagemin');
const svgmin = require('gulp-svgmin');
const sass = require('gulp-sass');
const hash = require("gulp-hash-filename");

sass.compiler = require('node-sass');

gulp.task('build', function (done) {
    gulp.src(['src/scripts/*.ts', 'src/scripts/**/*.ts'], { base: 'src/scripts/' })
        .pipe(sourcemaps.init())
        .pipe(uglify())
        .pipe(sourcemaps.write('.'))
        .pipe(gulpEsbuild({}))
        .pipe(hash({ "format": "{name}.{hash}.{ext}" }))
        .pipe(gulp.dest('dist'));

    gulp.src(['src/*.pug', 'src/pages/*.pug', 'src/pages/**/*pug'], { base: 'src/' })
        .pipe(pug({}))
        .pipe(minHtml({ collapseWhitespace: true }))
        .pipe(gulp.dest('dist'));

    gulp.src(['src/assets/images/*.png', 'src/assets/images/favicon/*.png'], { base: 'src/assets/images/' })
        .pipe(imagemin())
        .pipe(hash({ "format": "{name}.{hash}.{ext}" }))
        .pipe(gulp.dest('dist'));

    gulp.src(['src/assets/illustrations/*.svg', 'src/assets/images/*.svg', 'src/assets/images/**/*.svg'], { base: 'src/assets/' })
        .pipe(sourcemaps.init())
        .pipe(svgmin())
        .pipe(sourcemaps.write('.'))
        .pipe(hash({ "format": "{name}.{hash}.{ext}" }))
        .pipe(gulp.dest('dist'));

    gulp.src(['src/styles/*.scss', 'src/styles/**/*.scss', 'src/styles/**/**/*.scss'], { base: 'src/styles/' })
        .pipe(sass().on('error', sass.logError))
        .pipe(hash({ "format": "{name}.{hash}.{ext}" }))
        .pipe(gulp.dest('dist'));
    done();
});