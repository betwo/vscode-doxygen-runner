import * as vscode from 'vscode';

import { Doxygen } from './doxygen';
import { InstanceManager } from './instance_manager';

let instance_manager: InstanceManager;

export function activate(context: vscode.ExtensionContext) {
    instance_manager = new InstanceManager(context);

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'extension.doxygen-runner.generate_doxygen',
            (filepath) => {
                try {
                    let instance: Doxygen =
                        instance_manager.getInstance(filepath);
                    instance.generateDocumentation(filepath);
                } catch (err) {
                    vscode.window.showErrorMessage(
                        `Error while generating Documentation.\n${err.message}`
                    );
                }
            }
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'extension.doxygen-runner.view_doxygen',
            (filepath) => {
                const config =
                    vscode.workspace.getConfiguration('doxygen_runner');
                const use_live_preview =
                    config['view_in_live_preview'] &&
                    vscode.extensions.getExtension('ms-vscode.live-server') !==
                        undefined;
                try {
                    let instance: Doxygen =
                        instance_manager.getInstance(filepath);
                    if (use_live_preview) {
                        const index = instance.getIndexHtmlPath();
                        vscode.commands.executeCommand(
                            'livePreview.start.preview.atFile',
                            index
                        );
                    } else {
                        instance.updateView();
                    }
                } catch (err) {
                    vscode.window.showErrorMessage(
                        `Error while viewing Documentation.\n${err.message}`
                    );
                }
            }
        )
    );
}

export function deactivate() {}
