import {app, Menu} from 'electron';

export type OnMenuClickHandler =
    (menuItem: Electron.MenuItem, win: Electron.BrowserWindow, event: any) => void;

export function createApplicationMenu(onClick: OnMenuClickHandler): Electron.Menu {
    const template: any[] = [
        ...(process.platform === 'darwin' ? [
            {
                label: app.getName(),
                submenu: [
                    { role: 'about' },
                    { type: 'separator' },
                    {
                        label: 'Preferences…',
                        accelerator: 'CmdOrCtrl+,',
                        click: onClick
                    },
                    { type: 'separator' },
                    { role: 'services', submenu: [] },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideothers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: 'quit' }
                ]
            }
        ] : []),
        {
            label: 'File',
            submenu: [
                { label: 'Open File…', accelerator: 'Cmd+O', click: onClick },
                { type: 'separator' },
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'pasteandmatchstyle' },
                { role: 'delete' },
                { role: 'selectall' },
                { type: 'separator' },
                ...(process.platform === 'darwin' ? [
                    {
                        label: 'Speech',
                        submenu: [
                            { role: 'startspeaking' },
                            { role: 'stopspeaking' }
                        ]
                    }
                ] : [
                    {
                        label: 'Preferences…',
                        click: onClick
                    }
                ])
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Developer Tools (Frame)',
                    accelerator: 'CmdOrCtrl+Alt+I',
                    click: onClick
                },
                {
                    label: 'Toggle Developer Tools (Renderer)',
                    accelerator: 'CmdOrCtrl+Alt+J',
                    role: 'toggledevtools'
                },
                { type: 'separator' },
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click: onClick
                },
                { type: 'separator' },
                { role: 'resetzoom' },
                { role: 'zoomin' },
                { role: 'zoomout' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            role: 'window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        }
    ];

    return Menu.buildFromTemplate(template);
}
