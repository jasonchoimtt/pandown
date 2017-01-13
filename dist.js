'use strict';

const packager = require('electron-packager');
const path = require('path');

const FILES = [
    'lib',
    'node_modules',
    'package.json',
    'LICENSE.md',
];

packager({
    dir: __dirname,
    out: path.join(__dirname, 'dist'),
	platform: ['darwin'],
    overwrite: true,
    ignore: path => FILES.indexOf(path.split('/')[0]) !== -1,
}, (err, appPaths) => {
    if (err)
        throw err;
});
