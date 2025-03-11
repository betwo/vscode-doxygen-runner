import * as vscode from 'vscode';
import { Doxygen } from './doxygen';
import * as utils from './utils';

export class InstanceManager {
    private instances = new Map<string, Doxygen>();

    private diagnostics: vscode.DiagnosticCollection;

    constructor(public context: vscode.ExtensionContext) {}

    public getInstance(filepath: string): Doxygen {
        if (filepath === undefined) {
            filepath = utils.getCurrentFileDir();

            if (filepath === undefined) {
                throw Error(
                    `Running doxygen generation without a focused editor windows does not work. Have a look at the \`configuration_file_override\` setting if you want to be able to run generation this way.\n`
                );
            }
        }

        let tmp = utils.findDoxyFile(filepath);
        if (tmp === undefined) {
            throw Error(`Cannot find Doxyfile for ${filepath}.`);
        }

        let [basedir, doxyfile] = tmp;
        console.log(
            `Found doxygen config file '${doxyfile}' in path ${basedir}`
        );

        if (this.instances.has(basedir)) {
            let instance = this.instances.get(basedir);
            if (instance.doxyfile === doxyfile) {
                return instance;
            } else {
                console.log(
                    `Doxyfile in ${basedir} was changed from ${instance.doxyfile} to ${doxyfile}`
                );
                return this.makeInstance(basedir, doxyfile);
            }
        } else {
            return this.makeInstance(basedir, doxyfile);
        }
    }

    private makeInstance(basedir: string, doxyfile: string) {
        if (!utils.check()) {
            return;
        }

        let instance = new Doxygen(this.context, basedir, doxyfile);
        this.instances.set(basedir, instance);
        return instance;
    }
}
