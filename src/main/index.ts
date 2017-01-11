import * as path from 'path';
import {app, dialog, ipcMain, webContents, BrowserWindow} from 'electron';
import * as url from 'url';
import * as EventEmitter from 'events';
import * as fs from 'fs';

import {watch, FSWatcher} from 'chokidar';
import * as virtualDom from 'virtual-dom';
import * as convertHTMLCtor from 'html-to-vdom';
import * as vdomAsJson from 'vdom-as-json';

import {render} from './pandoc.js';
import {Message} from '../common/protocol.js';

const convertHTML: (html: string) => virtualDom.VText = convertHTMLCtor({
    VNode: virtualDom['VNode'],
    VText: virtualDom['VText']
});


const windows: PreviewWindow[] = []

const mainChannel = new EventEmitter();
ipcMain.on('main', (event, ...args) => {
    mainChannel.emit(String(event.sender.id), ...args);
});

class PreviewWindow {
    filename: string | null;
    private renderer: Electron.BrowserWindow;
    private frame: Electron.WebContents;

    private renderedHtml: string | null;

    private watcher: FSWatcher;
    private renderingInProgress = false;
    private renderingQueued = false;
    private connectionReady: Promise<void>;

    private currentTree = convertHTML('<article id="main"></article>');

    constructor() {
        windows.push(this);

        this.renderer = new BrowserWindow();
        this.renderer.loadURL(url.format({
            pathname: path.join(__dirname, '../../index.html'),
            protocol: 'file:',
            slashes: true
        }));

        let connectionReadyResolve: () => void;
        this.connectionReady = new Promise<void>(r => connectionReadyResolve = r);

        // This loading procedure is convoluted since we want to create a
        // <webview> tag (which is sandboxed) inside the renderer window and
        // establish a direct connection with it.
        ipcMain.once(`webview-handshake:${this.renderer.webContents.id}`, (event, id) => {
            const wc = webContents.fromId(id);
            this.frame = wc;

            // Take a ready message
            mainChannel.once(String(id), connectionReadyResolve);
        });

        this.connectionReady.then(this.onConnect.bind(this));

        this.renderer.on('close', this.onClosed.bind(this));
    }

    load(filename: string) {
        if (this.filename)
            this.unload();
        this.filename = filename;

        this.watcher = watch(filename);
        this.watcher.on('change', this.queueRendering.bind(this));

        this.queueRendering();
        this.sendToFrame({
            type: 'filename',
            filename: this.filename,
            basename: path.basename(this.filename)
        });
        if (process.platform === 'darwin')
            this.renderer.setRepresentedFilename(this.filename);
    }

    private onConnect() {
        mainChannel.on(String(this.frame.id), this.onMessage.bind(this));
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

                const newTree = convertHTML(`<article id="main">${payload}</article>`);
                const patch = virtualDom.diff(this.currentTree, newTree);
                this.currentTree = newTree;

                this.sendToFrame({type: 'patch', patch: vdomAsJson.toJson(patch)});
            } else {
                console.error('Error invoking pandoc:\n' + payload);

                this.sendToFrame({type: 'error', output: payload});
            }
        } while (this.renderingQueued);
        this.renderingInProgress = false;
    }

    private sendToFrame(message: Message) {
        this.connectionReady.then(() => {
            this.frame.send('main', message);
        });
    }

    unload() {
        this.filename = null;
        this.renderingQueued = false;
        this.watcher.close();
        this.sendToFrame({type: 'filename', filename: null, basename: null});
        if (process.platform === 'darwin')
            this.renderer.setRepresentedFilename('');
    }

    private onClosed() {
        // Disable sending new messages
        this.connectionReady = new Promise<void>(() => {});
        if (this.filename)
            this.unload();

        // Remove reference so that everything will be garbage collected
        const index = windows.indexOf(this);
        if (index !== -1)
            windows.splice(index, 1);
    }
}

function launch(files: string[], workingDirectory: string) {
    for (const rel of files) {
        const filename = path.resolve(workingDirectory, rel);
        const pw = new PreviewWindow();
        pw.load(filename);
    }
}

function launchWithDialog() {
    dialog.showOpenDialog({
        title: 'Open Markdown document',
        filters: [{name: 'Markdown document', extensions: ['md']}],
        properties: ['openFile', 'multiSelections']
    }, files => {
        if (!files)
            return;
        // cwd does not actually matter since files are absolute paths
        launch(files, process.cwd());
    });
}

if (app.makeSingleInstance((argv, wd) => launch(argv.slice(2), wd)))
    app.quit();

app.on('ready', () => {
    launch(process.argv.slice(2), process.cwd());
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        app.quit();
});

app.on('activate', event => {
    if (process.platform === 'darwin' && !windows.length)
        launchWithDialog();
});
