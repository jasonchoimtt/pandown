SystemJS.set('electron', SystemJS.newModule(window['electron']));
SystemJS.set('virtual-dom', SystemJS.newModule(window['virtualDom']));
SystemJS.set('vdom-as-json', SystemJS.newModule(window['vdomAsJson']));
SystemJS.set('jsondiffpatch', SystemJS.newModule(window['jsondiffpatch']));
SystemJS.import('./index.js');
