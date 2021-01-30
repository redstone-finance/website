const { series, dest, src, task, parallel } = require('gulp');
const gulpEsbuild = require('gulp-esbuild');
const pug = require('gulp-pug');
const rev = require('gulp-rev');
const sourcemaps = require('gulp-sourcemaps');
const imagemin = require('gulp-imagemin');
//const svgmin = require('gulp-svgmin');
const sass = require('gulp-sass');
const nodemon = require('gulp-nodemon');
const revRewrite = require('gulp-rev-rewrite');
const del = require('del');
const revDel = require('rev-del');
const replace = require('gulp-replace');

sass.compiler = require('node-sass');

task('clean', (done) => {
    del.sync(['dist/**', '.rev/**']);
    done();
});

task('html', (done) => {
  src(['src/*.pug'])
    .pipe(pug({
      pretty: true
    }))
    .pipe(dest('dist'));

  done();
});

task('scripts', (done) => {
  src(['src/assets/scripts/{app,claim,communities,create,home,member}.ts', 'src/assets/scripts/opportunity/jobboard.ts'])
    .pipe(gulpEsbuild({
      platform: 'browser',
      bundle: true
    }))
    .pipe(replace('@APP_VERSION', '@' + process.env.npm_package_version))
    .pipe(dest('dist/assets/scripts'));

  done();
});

task('images', (done) => {
  src(['src/**/*.{png,svg,jpg,jpeg,gif}'])
    .pipe(imagemin([
      imagemin.gifsicle({interlaced: true}),
      imagemin.mozjpeg({quality: 75, progressive: true}),
      imagemin.optipng({optimizationLevel: 5}),
      imagemin.svgo({
        plugins: [
          {removeViewBox: false}
        ]
      })
    ]))
    .pipe(dest('dist'));

  done();
});

task('styles', function (done) {
  src(['src/**/*.scss'])
    .pipe(sass().on('error', sass.logError))
    .pipe(dest('dist'));

  done();
});

task('revision', (done) => {
  src('dist/**/*.{css,js,svg,png,gif,jpeg,jpg}')
    .pipe(rev())
    .pipe(src('dist/**/*.html'))
    .pipe(revRewrite())
    .pipe(dest('dist'));

  done();
});

task('build', series('clean', parallel('html', 'scripts', 'images', 'styles')));

task('watch', series('build', (done) => {
    const stream = nodemon({
        script: 'server.js'
        , watch: 'build'
        , tasks: ['build']
        , done
    });

    return stream;
}))