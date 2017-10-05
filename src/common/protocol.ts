// main -> frame
export interface MessagePatch {
    type: 'patch';
    patch: string; // Encoded JSON of the VPatch
}

export interface MessageState {
    type: 'state';
    patch: Object;
}

export interface MessageClear {
    type: 'clear';
}

export type Message = MessagePatch | MessageState | MessageClear;

// main -> renderer
export interface MessageFind {
    type: 'find';
    value: boolean;
}

export type RendererMessage = MessageFind;
