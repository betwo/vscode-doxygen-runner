import * as vscode from 'vscode';

import { Doxygen } from './doxygen'

let taskProvider: vscode.Disposable | undefined;
let instance: Doxygen;

export function activate(context: vscode.ExtensionContext) {
  instance = new Doxygen(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.doxygen-runner.generate_doxygen', (filepath) => {
      instance.generateDocumentation(filepath);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.doxygen-runner.view_doxygen', (doc_directory) => {
      instance.viewIndex(doc_directory);
    })
  );

  taskProvider = vscode.tasks.registerTaskProvider('doxygen_runner', {
    provideTasks: () => {
      return [instance.parseOutputTask];
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
