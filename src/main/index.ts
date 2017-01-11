import * as path from 'path';
import {app, ipcMain, webContents, BrowserWindow} from 'electron';
import * as url from 'url';
import * as EventEmitter from 'events';

import {watch, FSWatcher} from 'chokidar';
import {render} from './pandoc.js';


const windows: {[id: string]: PreviewWindow} = {};

const mainChannel = new EventEmitter();
ipcMain.on('main', (event, ...args) => {
    mainChannel.emit(String(event.sender.id), ...args);
});

class PreviewWindow {
    filename: string | null;
    private frame: Electron.BrowserWindow;
    private index: Electron.WebContents;

    private renderedHtml: string | null;

    private watcher: FSWatcher;
    private renderingInProgress = false;
    private renderingQueued = false;
    private connectionReady: Promise<void>;

    constructor(private id: string) {
        this.frame = new BrowserWindow();
        this.frame.loadURL(url.format({
            pathname: path.join(__dirname, '../../index.html'),
            protocol: 'file:',
            slashes: true
        }));

        let connectionReadyResolve: () => void;
        this.connectionReady = new Promise<void>(r => connectionReadyResolve = r);

        // This loading procedure is convoluted since we want to create a
        // <webview> tag (which is sandboxed) inside the renderer window and
        // establish a direct connection with it.
        ipcMain.once(`webview-handshake:${this.frame.webContents.id}`, (event, id) => {
            const wc = webContents.fromId(id);
            this.index = wc;

            // Take a ready message
            mainChannel.once(String(id), connectionReadyResolve);
        });

        this.connectionReady.then(this.onConnect.bind(this));

        this.frame.on('closed', this.onClosed.bind(this));
    }

    load(filename: string) {
        if (this.filename)
            this.unload();
        this.filename = filename;

        this.watcher = watch(filename);
        this.watcher.on('change', this.queueRendering.bind(this));

        this.queueRendering();
    }

    private onConnect() {
        mainChannel.on(String(this.index.id), this.onMessage.bind(this));
    }

    private onMessage() {
    }

    private queueRendering() {
        if (!this.renderingInProgress) {
            this.render();
        } else if (!this.renderingQueued) {
            console.log('Queued rendering.');
            this.renderingQueued = true;
        }
    }

    private async render() {
        this.renderingInProgress = true;
        do {
            this.renderingQueued = false;

            const filename = this.filename!;
            console.log('Rendering...');
            const start = Date.now();
            const {result, payload} = await render(filename);

            // Make sure the file has not been unloaded
            if (this.filename !== filename) continue;

            if (result === 'ok') {
                console.log(`Rendering completed in ${Date.now() - start}ms`);

                this.connectionReady.then(() => {
                    this.index.send('main', result, payload);
                });
            } else {
                console.error('Error invoking pandoc:\n' + payload);

                this.connectionReady.then(() => {
                    this.index.send('main', result, payload);
                });
            }
        } while (this.renderingQueued);
        this.renderingInProgress = false;
    }

    unload() {
        this.filename = null;
        this.renderingQueued = false;
        this.watcher.close();
    }

    private onClosed() {
        if (this.filename)
            this.unload();

        // Remove reference so that everything will be garbage collected
        delete windows[this.id];
    }
}

app.on('ready', () => {
    const pw = new PreviewWindow('default');
    pw.load(path.resolve('demo.md'));
});
