import {app} from 'electron';
import * as fs from 'fs';
import * as path from 'path';


export interface Config {
    pandoc: string;
    extraArgs: string;
    darkMode: boolean;
}

export const defaultConfig: Config = {
    pandoc: 'pandoc',
    extraArgs: '',
    darkMode: false
};

let config: Config | null = null;

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

export function getConfig(): Config {
    if (config == null) {
        try {
            const json = fs.readFileSync(CONFIG_PATH);
            config = JSON.parse(json.toString());
        } catch (err) {
            setConfig(defaultConfig);
        }
    }
    return config!;
}

export function setConfig(conf: Config) {
    config = conf;
    const json = JSON.stringify(config, null, 4);
    fs.writeFileSync(CONFIG_PATH, json);
}
