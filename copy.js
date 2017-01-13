'use strict';

const gulp = require('gulp');

const ASSETS = [
    './src/**/*.html',
    './src/**/*.css'
];

function run(update) {
    gulp.src(ASSETS, {base: './src'})
        .pipe(gulp.dest('./lib'))
        .on('end', () => {
            if (update) console.log('Copied assets.');
        });
}

if (process.argv[2] === '--watch') {
    gulp.watch(ASSETS, () => run(true));
}

run();
