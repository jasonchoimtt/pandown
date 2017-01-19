import {defaultCommonState, CommonState} from '../common/state.js';


export class FrameState {
    common: CommonState;
    tocOpen: boolean;
}

export const defaultFrameState: FrameState = {
    common: defaultCommonState,
    tocOpen: false
}

export interface ToggleTocAction {
    type: 'toggleToc';
    open?: boolean;
}

export type FrameAction = ToggleTocAction;
