import * as vscode from 'vscode';

import { Doxygen } from './doxygen'
import { InstanceManager } from './instance_manager'
import { parseOutputTask } from './parse_output_task' 

let taskProvider: vscode.Disposable | undefined;
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

  taskProvider = vscode.tasks.registerTaskProvider('doxygen_runner', {
    provideTasks: () => {
      return [parseOutputTask];
    },
    resolveTask(_task: vscode.Task): vscode.Task |
      undefined {
      return undefined;
    }
  });
}

export function deactivate() {
  if (taskProvider) {
    taskProvider.dispose();
  }
}
