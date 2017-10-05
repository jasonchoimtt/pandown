import * as path from 'path';
import {app, dialog, ipcMain, shell, webContents, BrowserWindow, Menu} from 'electron';
import * as url from 'url';
import * as EventEmitter from 'events';
import * as fs from 'fs';

import {watch, FSWatcher} from 'chokidar';
import * as virtualDom from 'virtual-dom';
import * as vdomAsJson from 'vdom-as-json';
import {create as createJSONDiffPatch} from 'jsondiffpatch';

import {render} from './pandoc.js';
import {createApplicationMenu} from './menu.js';
import {processHTML} from './html.js';
import {MainState, defaultMainState} from './state.js';
import {defaultTree} from './html.js';
import {Message} from '../common/protocol.js';
import {getConfig, setConfig, Config} from './config.js';


const JSONDiffPatch: {
    diff: (src: Object, dest: Object) => Object
} = createJSONDiffPatch();


const windows: {[id: string]: PreviewWindow} = {};
let windowCount = 0;

let prefWindow: Electron.BrowserWindow | null = null;

const mainChannel = new EventEmitter();
ipcMain.on('main', (event, ...args) => {
    mainChannel.emit(String(event.sender.id), ...args);
});

function updateConfig(config: Config) {
    setConfig(config);
    for (const key of Object.keys(windows))
        windows[key].setConfig(config);
}

class PreviewWindow {
    private state: MainState;
    private renderer: Electron.BrowserWindow;
    private rendererContents: Electron.WebContents;
    private frame: Electron.WebContents;
    private id: number;

    private watcher: FSWatcher;
    private connectionReady: Promise<void>;

    constructor() {
        const config = getConfig();
        this.renderer = new BrowserWindow({
            width: 700,
            height: 768,
            minWidth: 300,
            minHeight: 200,
            backgroundColor: config.darkMode ? '#222' : '#fff'
        });
        this.renderer.loadURL(url.format({
            pathname: path.resolve(__dirname, '../renderer/index.html'),
            protocol: 'file:',
            slashes: true,
            query: {
                // Pass darkMode in query so that the background can be set
                // in the renderer before the frame is loaded.
                darkMode: config.darkMode
            }
        }));
        this.rendererContents = this.renderer.webContents;

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

        this.state = defaultMainState;
        // Update the state with the config object
        this.setConfig(config);
    }

    focus() {
        this.renderer.focus();
        this.renderIfChanged();
    }

    getFilename() {
        return this.state.common.filename;
    }

    setConfig(config: Config) {
        this.dispatch(state => ({...state, common: {...state.common, config: config}}));
    }

    private onConnect() {
        mainChannel.on(String(this.frame.id), this.onMessage.bind(this));

        this.frame.on('will-navigate', (event, url) => {
            event.preventDefault();
            shell.openExternal(url);
        })
    }

    private onMessage() {
    }

    private onClosed() {
        // Disable sending new messages
        this.connectionReady = new Promise<void>(() => {});
        if (this.state.common.filename)
            this.unload();

        // Remove reference so that everything will be garbage collected
        delete windows[this.id];
        windowCount -= 1;
    }

    private sendToFrame(message: Message) {
        this.connectionReady.then(() => {
            this.frame.send('main', message);
        });
    }

    private dispatch(fn: (state: MainState) => MainState) {
        const oldState = this.state;
        const newState = fn(this.state);
        this.sendToFrame({
            type: 'state',
            patch: JSONDiffPatch.diff(oldState.common, newState.common)
        });
        this.state = newState;
    }

    ////////////////////////////////////////////////////////
    // Application domain stuff
    ////////////////////////////////////////////////////////

    load(filename: string) {
        if (this.state.common.filename)
            this.unload();

        this.dispatch(state => ({
            ...state,
            common: {...state.common, filename, basename: path.basename(filename)}
        }));

        this.watcher = watch(filename);
        this.watcher.on('change', (path, stats) => {
            if (stats)
                this.dispatch(state => ({...state, common: {...state.common, mtime: stats.mtime}}));
            this.queueRendering();
        });
        this.queueRendering();

        if (process.platform === 'darwin')
            this.renderer.setRepresentedFilename(filename);

        if (['win32', 'linux', 'darwin'].indexOf(process.platform) !== -1)
            app.addRecentDocument(filename);
    }

    private queueRendering() {
        if (!this.state.common.rendering) {
            this.render();
        } else if (!this.state.renderingQueued) {
            console.log('Queued rendering.');
            this.dispatch(state => ({...state, renderingQueued: true}));;
        }
    }

    private renderIfChanged() {
        let stat;
        try {
            stat = fs.statSync(this.state.common.filename!);
        } catch (err) {}
        if (stat) {
            if (stat.mtime > this.state.common.mtime!) {
                this.queueRendering();
                this.dispatch(state => ({...state, common: {...state.common, mtime: stat.mtime}}));
            }
        }
    }

    private async render() {
        this.dispatch(state => ({...state, common: {...state.common, rendering: true}}));
        do {
            this.dispatch(state => ({...state, renderingQueued: false}));

            const filename = this.state.common.filename;
            if (!filename)
                throw new Error('filename is null');
            console.log('Rendering...');
            const start = Date.now();
            const {result, payload} = await render(filename);

            // Make sure the file has not been unloaded
            if (this.state.common.filename !== filename) continue;

            if (result === 'ok') {
                const newTree = processHTML(
                    `<article id="main">${payload}</article>`, filename);
                const patch = virtualDom.diff(this.state.currentTree, newTree);
                this.dispatch(state => ({...state, currentTree: newTree}));

                this.sendToFrame({type: 'patch', patch: vdomAsJson.toJson(patch)});
                this.dispatch(state => ({...state, common: {...state.common, error: null}}));
            } else {
                console.error('Error invoking pandoc:\n' + payload);

                this.dispatch(state => ({...state, common: {...state.common, error: payload}}));
            }
        } while (this.state.renderingQueued);
        this.dispatch(state => ({...state, common: {...state.common, rendering: false}}));
    }

    hardReload() {
        this.queueRendering();
        this.dispatch(state => ({...state, currentTree: defaultTree}));
        this.sendToFrame({type: 'clear'});
    }

    unload() {
        this.dispatch(state => ({
            ...state,
            renderingQueued: false,
            common: {...state.common, filename: null, basename: null, mtime: null}
        }));

        this.watcher.close();
        if (process.platform === 'darwin')
            this.renderer.setRepresentedFilename('');
    }

    toggleDarkMode() {
        const darkMode = this.state.common.config!.darkMode;
        updateConfig({...getConfig(), darkMode: !darkMode});
    }

    find() {
        this.rendererContents.send('main', {type: 'find', value: true});
    }

    onMenuClick(menuItem: Electron.MenuItem, event: Event) {
        switch (menuItem.label) {
            case 'Toggle Developer Tools (Frame)':
                this.connectionReady.then(() => this.frame.toggleDevTools());
                break;
            case 'Toggle Dark Mode':
                this.toggleDarkMode();
                break;
            case 'Reload':
                this.queueRendering();
                break;
            case 'Hard Reload':
                this.hardReload();
                break;
            case 'Find':
                this.find();
                break;
        }
    }
}

function launch(files: string[], workingDirectory: string) {
    for (const rel of files) {
        const filename = path.resolve(workingDirectory, rel);
        let opened = false;
        for (const key of Object.keys(windows)) {
            if (windows[key].getFilename() === filename) {
                windows[key].focus();
                opened = true;
                break;
            }
        }
        if (!opened) {
            const pw = new PreviewWindow();
            pw.load(filename);
        }
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

function showPreferences() {
    if (prefWindow) return;
    prefWindow = new BrowserWindow({width: 400, height: 500});
    prefWindow.loadURL(url.format({
        pathname: path.resolve(__dirname, '../renderer/preferences.html'),
        protocol: 'file:',
        slashes: true
    }));
    prefWindow.webContents.on('did-finish-load', () => {
        prefWindow!.webContents.send('config', getConfig());
    })
    prefWindow.on('closed', () => prefWindow = null);
}

ipcMain.on('config', (event, config) => {
    updateConfig(config);
});

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
        case 'Preferences…':
            showPreferences();
            break;
        default:
            if (win && windows[win.id])
                windows[win.id].onMenuClick(menuItem, event);
            break;
    }
}
