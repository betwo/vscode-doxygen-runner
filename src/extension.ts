import * as vscode from 'vscode';

let taskProvider: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {

  taskProvider = vscode.tasks.registerTaskProvider('doxygen_runner', {
    provideTasks: () => {

      let result: vscode.Task[] = [];
      {
        let kind: vscode.TaskDefinition = {
          'type': 'doxygen_runner'
        };
        let find_doxyfile = 'basedir=${fileDirname} && ' +
          'while [[ "${basedir}" != "/" ]] && [[ "${basedir}" != "/" ]]; do ' +
          '  basedir=$(dirname $basedir); ' +
          '  cfg=$(find ${basedir} -name Doxyfile | head -n 1); ' +
          '  if [[ "$cfg" != "" ]]; then ' +
          '    echo "$basedir: $cfg"; ' +
          '    cd "$basedir"; ' +
          '    doxygen $cfg 1>/dev/null; ' +
          '    break; ' +
          '  fi; ' +
          'done'

        let task = new vscode.Task(
          kind, 'Generate Doxygen documentation', 'doxygen_generate',
          new vscode.ShellExecution('cd "${fileDirname}" && ' + find_doxyfile),
          ['$doxygen-runner', '$doxygen-runner-multiline']);
        result.push(task);
      }
      return result;
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
