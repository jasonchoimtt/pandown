// main -> frame
export interface MessagePatch {
    type: 'patch';
    patch: string; // Encoded JSON of the VPatch
}

export interface MessageError {
    type: 'error';
    output: string; // Error output
}

export interface MessageFilename {
    type: 'filename';
    filename: string | null;
    basename: string | null;
}

export type Message = MessagePatch | MessageError | MessageFilename;
