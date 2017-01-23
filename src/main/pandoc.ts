import {Readable} from 'stream';
import * as path from 'path';
import * as child_process from 'child_process';

import {getConfig} from './config.js';


const PANDOC_ARGS = [
    '--to=html',
    '--mathjax',
    '--toc',
    '--standalone', `--template=${path.resolve(__dirname, '../../template.html')}`,
    '--output=-',
];

export interface RenderResult {
    result: 'ok' | 'error';
    payload: string;
}

export function render(filename: string): Promise<RenderResult> {
    return new Promise(resolve => {
        const config = getConfig();
        const userArgs = config.extraArgs.split('\n').filter(x => !!x);

        const worker = child_process.spawn(
            config.pandoc, [filename].concat(PANDOC_ARGS).concat(userArgs),
            {cwd: path.dirname(filename)});
        let stdout = '', stderr = '';
        worker.stdout.on('data', data => { stdout += data; });
        worker.stderr.on('data', data => { stderr += data; });
        worker.on('close', code => {
            if (code !== 0)
                resolve({ result: 'error', payload: stderr });
            else
                resolve({ result: 'ok', payload: stdout });
        })
    });
}
