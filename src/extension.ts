import * as vscode from 'vscode';

import { Doxygen } from './doxygen';
import { InstanceManager } from './instance_manager';

let instance_manager: InstanceManager;

export function activate(context: vscode.ExtensionContext) {
  instance_manager = new InstanceManager(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.doxygen-runner.generate_doxygen', (filepath) => {
      let instance: Doxygen = instance_manager.getInstance(filepath);
      instance.generateDocumentation(filepath);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.doxygen-runner.view_doxygen', (filepath) => {
      let instance: Doxygen = instance_manager.getInstance(filepath);
      instance.viewIndex();
    })
  );
}

export function deactivate() { }
