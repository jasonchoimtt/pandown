SystemJS.set('electron', SystemJS.newModule(window['electron']));
SystemJS.import('./dist/frame/index.js');
