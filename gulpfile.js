const { series, dest, src, task, parallel, watch } = require('gulp');
const gulpEsbuild = require('gulp-esbuild');
const pug = require('gulp-pug');
const rev = require('gulp-rev');
const sourcemaps = require('gulp-sourcemaps');
const imagemin = require('gulp-imagemin');
const sass = require('gulp-sass');
const revRewrite = require('gulp-rev-rewrite');
const del = require('del');
const replace = require('gulp-replace');
const postcss = require('gulp-postcss');
const purgeCSS = require('gulp-purgecss');
const cleanCSS = require('gulp-clean-css');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');

sass.compiler = require('node-sass');

const sources = {
  html: 'src/*.pug',
  scripts: ['src/assets/scripts/{app,claim,communities,create,home,member}.ts', 'src/assets/scripts/opportunity/jobboard.ts'],
  images: 'src/**/*.{png,svg,jpg,jpeg,gif}',
  styles: 'src/**/*.scss',
  revision: 'dist/**/*.{css,js,svg,png,gif,jpeg,jpg}'
}

task('clean', (done) => {
    del.sync(['dist/**']);
    done();
});

task('html', (done) => {
  src(sources.html)
    .pipe(pug())
    .pipe(dest('dist'));

  done();
});

task('scripts', (done) => {
  src(sources.scripts)
    .pipe(sourcemaps.init())
    .pipe(gulpEsbuild({
      platform: 'browser',
      bundle: true
    }))
    .pipe(replace('@APP_VERSION', '@' + process.env.npm_package_version))
    .pipe(sourcemaps.write('.'))
    .pipe(dest('dist/assets/scripts'));

  done();
});

task('images', (done) => {
  src(sources.images)
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
  src(sources.styles)
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(postcss([autoprefixer(), cssnano()]))
    .pipe(sourcemaps.write('.'))
    .pipe(dest('dist'));

  done();
});

task('revision', (done) => {

  src('dist/**/*.css')
    .pipe(purgeCSS({
      content: ['dist/**/*.{html,js}'],
      defaultExtractor: content => {
        const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || []
        const innerMatches = content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || []
        return broadMatches.concat(innerMatches)
      }
    }))
    .pipe(cleanCSS({compatibility: 'ie8'}))
    .pipe(dest('dist'));

  src(sources.revision)
  .pipe(rev())
  .pipe(src('dist/**/*.html'))
  .pipe(revRewrite())
  .pipe(dest('dist'));

  done();
});

// Build
task('build', series('clean', parallel('html', 'scripts', 'images', 'styles'), 'revision'));

// Dev
task('watch', series('build', (done) => {
  watch(sources.html, series('html', 'revision'));
  watch(sources.scripts, series('scripts', 'revision'));
  watch(sources.images, series('images', 'revision'));
  watch(sources.styles, series('styles', 'revision'));

  done();
}));