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


const body = document.querySelector('body')!;
const main = document.getElementById('main')!;
const loading = document.getElementById('loading')!;
const error = document.getElementById('error')!;

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

function reloadVisibleImages() {
    const images = document.querySelectorAll('img[src]');
    const vh = window.innerHeight;
    const timestamp = Date.now();
    for (const el of <HTMLImageElement[]><any>images) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= vh && rect.bottom >= 0 && el.src.substr(0, 5) == 'file:') {
            el.src = el.src.split('?')[0] + '?timestamp=' + timestamp;
        }
    }
}

const defaultTitle = document.title;

ipcRenderer.on('main', (event, message: Message) => {
    switch (message.type) {
        case 'patch':
            reconcile(vdomAsJson.fromJson(message.patch));
            reloadVisibleImages();
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
    console.debug(state);
    document.title = state.common.basename || defaultTitle;
    if (state.common.error) {
        error.classList.add('open');
        console.error(state.common.error);
        error.textContent = state.common.error;
    } else {
        error.classList.remove('open');
    }
    if (state.common.rendering)
        loading.classList.add('open');
    else
        loading.classList.remove('open');

    if (state.common.config!.darkMode)
        body.classList.add('dark');
    else
        body.classList.remove('dark');
}
