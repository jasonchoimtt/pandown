import {Config} from '../main/config.js';


// Main -> Frame states
export interface CommonState {
    filename: string | null;
    basename: string | null;
    rendering: boolean;
    error: string | null;
    mtime: Date | null;
    config: Config | null;
    title: string | null;
}

export const defaultCommonState: CommonState = {
    filename: null,
    basename: null,
    rendering: false,
    error: null,
    mtime: null,
    config: null,
    title: null
};

// Frame -> Main actions
export type CommonAction = never;
