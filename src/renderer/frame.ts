'use strict';

import {ipcRenderer} from 'electron';

document.querySelector('article')!.textContent = 'Hello, loading!';

ipcRenderer.on('main', (event, message) => {
    document.querySelector('article')!.textContent = message;
});
