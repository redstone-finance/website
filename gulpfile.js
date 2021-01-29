const { series, dest, watch, src } = require('gulp');
const gulp = require('gulp');
const gulpEsbuild = require('gulp-esbuild');
const pug = require('gulp-pug');
const minHtml = require('gulp-htmlmin');
const rev = require('gulp-rev');
const sourcemaps = require('gulp-sourcemaps');
const imagemin = require('gulp-imagemin');
const svgmin = require('gulp-svgmin');
const sass = require('gulp-sass');
const nodemon = require('gulp-nodemon');
const revRewrite = require('gulp-rev-rewrite');

sass.compiler = require('node-sass');

gulp.task('build', function (done) {
    gulp.src(['src/**/*.pug'], { base: 'src/' })
        .pipe(pug({}))
        .pipe(minHtml({ collapseWhitespace: true }))
        .pipe(gulp.dest('dist'));

    gulp.src(['src/**/*.ts'], { base: 'src/' })
        .pipe(sourcemaps.init())
        .pipe(gulpEsbuild({}))
        .pipe(sourcemaps.write('.'))
        .pipe(rev())
        .pipe(src('dist/**/*.html'))
        .pipe(revRewrite())
        .pipe(gulp.dest('dist/assets/scripts'));

    gulp.src(['src/**/*.png'], { base: 'src/' })
        .pipe(imagemin())
        .pipe(rev())
        .pipe(src('dist/**/*.html'))
        .pipe(revRewrite())
        .pipe(gulp.dest('dist'));

    gulp.src(['src/**/*.svg'], { base: 'src/' })
        .pipe(sourcemaps.init())
        .pipe(svgmin())
        .pipe(sourcemaps.write('.'))
        .pipe(rev())
        .pipe(src('dist/**/*.html'))
        .pipe(revRewrite())
        .pipe(gulp.dest('dist'));

    gulp.src(['src/**/*.scss'], { base: 'src/' })
        .pipe(sass().on('error', sass.logError))
        .pipe(rev())
        .pipe(src('dist/**/*.html'))
        .pipe(revRewrite())
        .pipe(gulp.dest('dist'));

    done();
});
gulp.task('watch', gulp.series('build', function (done) {
    var stream = nodemon({
        script: 'server.js'
        , watch: 'build'
        , tasks: ['build']
        , done: done
    })

    return stream
}))