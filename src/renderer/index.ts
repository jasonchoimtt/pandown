import {ipcRenderer, remote} from 'electron';


const currentId = remote.getCurrentWebContents().id;
const webview = <Electron.WebViewElement>document.querySelector('webview')!;

webview.addEventListener('dom-ready', firstLoadHandler);
function firstLoadHandler() {
    webview.removeEventListener('dom-ready', firstLoadHandler);

    // Extract and send the webview id to the main process
    const webviewId = webview.getWebContents().id;
    ipcRenderer.send(`webview-handshake:${currentId}`, webviewId);

    webview.openDevTools();
}
