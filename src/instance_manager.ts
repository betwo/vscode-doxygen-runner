import * as vscode from 'vscode';
import { Doxygen } from './doxygen'
import * as utils from './utils'

export class InstanceManager {
    private instances = new Map<string, Doxygen>();

    constructor(public context: vscode.ExtensionContext) { }

    public getInstance(filepath: string): Doxygen {
        if (!utils.check()) {
            return;
        }

        if (filepath === undefined) {
            filepath = utils.getCurrentFileDir();
        }

        let tmp = utils.findDoxyFile(filepath);
        if (tmp === undefined) {
            vscode.window.showErrorMessage("Cannot show Doxygen documentation, no opened files available.");
            return;
        }

        let basedir = tmp[0];
        let doxyfile = tmp[1];

        if (this.instances.has(basedir)) {
            return this.instances.get(basedir);
        } else {
            let instance = new Doxygen(this.context, basedir, doxyfile);
            this.instances.set(basedir, instance);
            return instance;
        }
    }
};