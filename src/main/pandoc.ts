import {Readable} from 'stream';
import * as path from 'path';
import * as child_process from 'child_process';


const PANDOC_BIN = 'pandoc';
const PANDOC_ARGS = [
    '--from=markdown+pipe_tables',
    '--latex-engine=xelatex',
    '--filter=/Users/jason/local/bin/mark_filter',  // FIXME
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
        const worker = child_process.spawn(PANDOC_BIN, [filename].concat(PANDOC_ARGS));
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
