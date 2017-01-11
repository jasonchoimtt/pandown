const cachedElectron = {
    ipcRenderer: require('electron').ipcRenderer
};

(<any>window).require = function require(mod) {
    if (mod === 'electron')
        return cachedElectron;
    else
        throw new Error(`Cannot really find module '${mod}'`);
};
