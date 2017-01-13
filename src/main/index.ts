import * as path from 'path';
import {app, dialog, ipcMain, webContents, BrowserWindow, Menu} from 'electron';
import * as url from 'url';
import * as EventEmitter from 'events';
import * as fs from 'fs';

import {watch, FSWatcher} from 'chokidar';
import * as virtualDom from 'virtual-dom';
import * as convertHTMLCtor from 'html-to-vdom';
import * as vdomAsJson from 'vdom-as-json';

import {render} from './pandoc.js';
import {createApplicationMenu} from './menu.js';
import {Message} from '../common/protocol.js';

const convertHTML: (html: string) => virtualDom.VText = convertHTMLCtor({
    VNode: virtualDom['VNode'],
    VText: virtualDom['VText']
});


const windows: {[id: number]: PreviewWindow} = {};
let windowCount = 0;

const mainChannel = new EventEmitter();
ipcMain.on('main', (event, ...args) => {
    mainChannel.emit(String(event.sender.id), ...args);
});

class PreviewWindow {
    filename: string | null;
    private renderer: Electron.BrowserWindow;
    private frame: Electron.WebContents;
    private id: number;

    private renderedHtml: string | null;

    private watcher: FSWatcher;
    private renderingInProgress = false;
    private renderingQueued = false;
    private connectionReady: Promise<void>;

    private currentTree = convertHTML('<article id="main"></article>');

    constructor() {
        this.renderer = new BrowserWindow({
            width: 700,
            height: 768,
            minWidth: 300,
            minHeight: 200
        });
        this.renderer.loadURL(url.format({
            pathname: path.resolve(__dirname, '../renderer/index.html'),
            protocol: 'file:',
            slashes: true
        }));

        this.id = this.renderer.id;
        windows[this.id] = this;
        windowCount += 1;

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

        if (process.platform === 'win32' || process.platform === 'linux')
            app.addRecentDocument(this.filename);
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

    onMenuClick(menuItem: Electron.MenuItem, event: Event) {
        switch (menuItem.label) {
            case 'Toggle Developer Tools (Frame)':
                this.frame.toggleDevTools();
                break;
        }
    }

    private onClosed() {
        // Disable sending new messages
        this.connectionReady = new Promise<void>(() => {});
        if (this.filename)
            this.unload();

        // Remove reference so that everything will be garbage collected
        delete windows[this.id];
        windowCount -= 1;
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

let readyPromiseResolve: () => void;
const readyPromise = new Promise(r => readyPromiseResolve = r);

app.on('ready', () => {
    Menu.setApplicationMenu(createApplicationMenu(onMenuClickHandler));
    launch(process.argv.slice(2), process.cwd());
    readyPromiseResolve();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        app.quit();
});

app.on('activate', () => {
    if (process.platform === 'darwin' && !windowCount)
        launchWithDialog();
});

app.on('open-file', (event, path) => {
    readyPromise.then(() => launch([path], process.cwd()));
});

function onMenuClickHandler(menuItem: Electron.MenuItem, win: Electron.BrowserWindow,
                            event: any) {
    switch (menuItem.label) {
        case 'Open File…':
            launchWithDialog();
            break;
        default:
            if (win && windows[win.id])
                windows[win.id].onMenuClick(menuItem, event);
            break;
    }
}
