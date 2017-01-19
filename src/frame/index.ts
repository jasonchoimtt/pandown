'use strict';

import {ipcRenderer} from 'electron';
import {create, patch, VPatch, VText} from 'virtual-dom';
import * as vdomAsJson from 'vdom-as-json';
import {create as createJSONDiffPatch} from 'jsondiffpatch';

import {Message} from '../common/protocol.js';
import {defaultFrameState, FrameState} from './state.js';

const JSONDiffPatch: {
    patch: (src: Object, diff: Object) => void
} = createJSONDiffPatch();

// Tells the main process we are ready
ipcRenderer.send('main');


const state: FrameState = defaultFrameState;


// Set up table of contents toggle
const tocToggle = document.getElementById('toc-toggle')!;
tocToggle.addEventListener('click', () => {
    const toc = document.getElementById('TOC');
    if (toc) {
        if (toc.style.display !== 'block') {
            tocToggle.classList.add('open');
            toc.style.display = 'block';
        } else {
            tocToggle.classList.remove('open');
            toc.style.display = 'none';
        }
    }
});


const main = document.getElementById('main')!;

// We need to chime in when the text of a <. class="math"> tag is changed; so
// here's an easy hack for that.
const toCheck: Text[] = [];
function renderWithSpy(vnode, opts) {
    const ret = create(vnode, opts);
    if (vnode.type == 'VirtualText') {
        toCheck.push(ret);
    }
    return ret;
}

function reconcile(p: VPatch[]) {
    window['p'] = p;
    patch(main, p, { render: renderWithSpy });

    let node: Text;
    while (node = toCheck.pop()!) {
        if (node.parentNode && (<any>node.parentNode).classList &&
                (<any>node.parentNode).classList.contains('math')) {
            node.parentNode.textContent = node.textContent;
        }
    }

    MathJax.Hub!.Queue(['Typeset', MathJax.Hub, () => {
        console.log('Updated.');
    }]);
}

const defaultTitle = document.title;

ipcRenderer.on('main', (event, message: Message) => {
    switch (message.type) {
        case 'patch':
            reconcile(vdomAsJson.fromJson(message.patch));
            break;
        case 'state':
            JSONDiffPatch.patch(state.common, message.patch);
            runStateHooks();
            break;
        case 'clear':
            main.innerHTML = '';
    }
});

function runStateHooks() {
    document.title = state.common.basename || defaultTitle;
    if (state.common.error)
        console.error(state.common.error);
}
