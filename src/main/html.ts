import * as path from 'path';
import * as url from 'url';

import * as virtualDom from 'virtual-dom';
import {VNode, VText} from 'virtual-dom';
import * as convertHTMLCtor from 'html-to-vdom';

const convertHTML: (html: string) => VNode = convertHTMLCtor({
    VNode: virtualDom['VNode'],
    VText: virtualDom['VText']
});

function traverse(node: VNode, iteratee: (node: VNode|VText) => VNode|VText) {
    if (node.type === 'VirtualText') {
        return node;
    } else {
        for (let i = 0; i < node.children.length; i++) {
            if (node.type === 'VirtualText' || node.type === 'VirtualNode') {
                node.children[i] = iteratee(<any>node.children[i]);
                traverse(<any>node.children[i], iteratee);
            }
        }
    }
}

export function processHTML(payload: string, filename: string): VNode {
    const tree = convertHTML(payload);

    traverse(tree, obj => {
        if (obj.type === 'VirtualText')
            return obj;

        const node = <VNode>obj;

        // Resolve image file URI if necessary
        if (node.tagName === 'img' && node.properties['src']) {
            const src = node.properties['src'];
            if (!url.parse(src).protocol) {
                node.properties['src'] = url.format({
                    pathname: path.resolve(path.dirname(filename), src),
                    protocol: 'file:',
                    slashes: true
                });
            }
        }

        return node;
    });

    return tree;
}
