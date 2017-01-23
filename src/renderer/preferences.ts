import {ipcRenderer} from 'electron';
import {Config} from '../main/config.js';

const elements: {
    pandoc: HTMLInputElement,
    extraArgs: HTMLTextAreaElement
} = <any>{};
for (const key of ['pandoc', 'extraArgs']) {
    elements[key] = document.getElementById(key);
}

ipcRenderer.on('config', (event, config) => {
    console.log('got it');
    elements.pandoc.value = config.pandoc;
    elements.extraArgs.value = config.extraArgs;
});


const form = <HTMLFormElement>document.getElementById('form');

form.addEventListener('submit', e => {
    e.preventDefault();
    ipcRenderer.send('config', {
        pandoc: elements.pandoc.value.trim(),
        extraArgs: elements.extraArgs.value.trim()
    });
    window.close();
});
