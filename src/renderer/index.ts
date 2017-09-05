import {ipcRenderer, remote} from 'electron';


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
