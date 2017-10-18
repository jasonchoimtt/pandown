import {readFileSync} from 'fs';

import {safeLoad} from 'js-yaml';


// Stolen from npm yaml-front-matter
const METADATA_REGEXP = /^(-{3}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3})?([\w\W]*)*/;

export class MarkdownParser {
    private metadata: any;
    private parsingPromise: Promise<void> | null;
    private parsingQueued: {promise: Promise<void>, resolve: () => void} | null;

    constructor(public filename: string, public onComplete: () => void) {
    }

    async queueParsing(): Promise<void> {
        if (!this.parsingPromise) {
            return this.parse();
        } else if (!this.parsingQueued) {
            let resolve: () => void;
            const promise: Promise<void> = new Promise(r => { resolve = r; });
            this.parsingQueued = {promise, resolve: resolve!};
            return promise;
        } else {
            return this.parsingQueued.promise;
        }
    }

    async parse() {
        do {
            let resolve: () => void = this.parsingQueued ? this.parsingQueued.resolve : null!;
            this.parsingPromise = this.parsingQueued ? this.parsingQueued.promise
                : new Promise(r => { resolve = r; });
            this.parsingQueued = null;

            try {
                const contents = readFileSync(this.filename).toString();

                // Regexp to extract YAML metadata
                const [, , yaml, markdown] = METADATA_REGEXP.exec(contents)!;

                this.metadata = safeLoad(yaml);
            } catch (e) {
                console.error('Error parsing markdown', e);
                this.metadata = null;
            }
            resolve!();
            Promise.resolve().then(this.onComplete);
        } while (this.parsingQueued);

        this.parsingPromise = null;
    }

    getTitle(): string {
        return this.metadata && this.metadata.title || '';
    }
}
