import {ipcRenderer, remote} from 'electron';
import {RendererMessage} from '../common/protocol';


const currentId = remote.getCurrentWebContents().id;
const webview = <Electron.WebviewTag>document.querySelector('webview')!;

webview.addEventListener('dom-ready', firstLoadHandler);
function firstLoadHandler() {
    webview.removeEventListener('dom-ready', firstLoadHandler);

    // Extract and send the webview id to the main process
    const webviewId = webview.getWebContents().id;
    ipcRenderer.send(`webview-handshake:${currentId}`, webviewId);
}

webview.addEventListener('page-title-updated', (event) => {
    if (event.explicitSet)
        document.title = event.title;
});


// Finding
let finding = false;
let findValue: string | null = null;
const findBox = document.getElementById('find-box')!;
const findInput = <HTMLInputElement>document.getElementById('find')!;

document.getElementById('find-next')!.onclick = () => find(true);
document.getElementById('find-prev')!.onclick = () => find(false);
document.getElementById('find-close')!.onclick = () => updateFinding(false);

findInput.onkeyup = (event) => {
    if (event.keyCode == 13) { // Enter
        event.preventDefault();
        find(!event.shiftKey);
    } else if (event.keyCode == 27) {
        event.preventDefault();
        updateFinding(false);
    }
};

function updateFinding(value: boolean) {
    findBox.style.display = value ? 'block' : 'none';
    if (finding && !value)
        findValue = null;
        webview.stopFindInPage('clearSelection');
    if (value) {
        findInput.focus();
        findInput.select();
    }
    finding = value;
}

function find(forward: boolean) {
    const findNext = findInput.value === findValue;

    findValue = findInput.value;
    const hasCaps = new Array(findValue).some(c => 'A' <= c && c <= 'Z');
    const wordStart = findValue[0] == '"';
    const query = findValue[0] == '"' ? findValue.substr(1) : findValue;

    webview.findInPage(query, {
        forward: forward,
        findNext: findNext,
        matchCase: hasCaps // Any caps to match case
    });
}


ipcRenderer.on('main', (event, message: RendererMessage) => {
    console.log(message);
    switch (message.type) {
        case 'find':
            updateFinding(message.value);
            break;
    }
});
