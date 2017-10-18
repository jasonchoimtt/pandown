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
    extendInfo: {
        'CFBundleDocumentTypes': [
            {
                'CFBundleTypeName': 'Markdown',
                'CFBundleTypeExtensions': ['md', 'markdown'],
                'CFBundleTypeMIMETypes': ['text/x-markdown'],
                'LSItemContentTypes': ['net.daringfireball.markdown'],
                'LSTypeIsPackage': 0,
                'NSDocumentClass': 'MPDocument',
            }
        ]
    }
}, (err, appPaths) => {
    if (err)
        throw err;
});
