import {app, ipcMain, webContents, BrowserWindow} from 'electron';
import * as path from 'path';
import * as url from 'url';


const windows: {[id: string]: PreviewWindow} = {};

class PreviewWindow {
    private frame: Electron.BrowserWindow;
    private index: Electron.WebContents;

    constructor(private id: string) {
        this.frame = new BrowserWindow();
        this.frame.loadURL(url.format({
            pathname: path.join(__dirname, '../../index.html'),
            protocol: 'file:',
            slashes: true
        }));

        // This loading procedure is convoluted since we want to create a
        // <webview> tag (which is sandboxed) inside the renderer window and
        // establish a direct connection with it.
        //
        // The good news is once this is done, the renderer window has nothing
        // else to do.
        ipcMain.once(`webview-handshake:${this.frame.webContents.id}`, (event, id) => {
            const wc = webContents.fromId(id);
            this.index = wc;
            this.onConnect();
        });

        this.frame.on('closed', this.onClosed.bind(this));
    }

    onConnect() {
        console.log('connected');
        this.index.send('main', 'Are you ready, comrade?');
    }

    onClosed() {
        delete windows[this.id];
    }
}

app.on('ready', () => {
    new PreviewWindow('default');
});
