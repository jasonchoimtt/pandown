'use strict';

import {ipcRenderer} from 'electron';

document.querySelector('article')!.textContent = 'Hello, loading!';

ipcRenderer.send('main');

ipcRenderer.on('main', (event, result: string, payload?: string) => {
    switch (result) {
        case 'ok':
            document.querySelector('article')!.innerHTML = payload!;
            break;
        case 'error':
            console.error(payload!);
            break;
    }
});
