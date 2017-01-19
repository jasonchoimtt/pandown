import {VNode} from 'virtual-dom';

import {defaultTree} from './html.js';
import {defaultCommonState, CommonAction, CommonState} from '../common/state.js';


export interface MainState {
    common: CommonState;
    renderingQueued: boolean;
    currentTree: VNode;
}

export const defaultMainState: MainState = {
    common: defaultCommonState,
    renderingQueued: false,
    currentTree: defaultTree
};

export type MainAction = CommonAction;
