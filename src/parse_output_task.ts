import * as vscode from 'vscode';

export let parseOutputTask = new vscode.Task(
    { 'type': 'doxygen_runner' },
    'Parse Doxygen documentation',
    'extension.doxygen-runner.parse_doxygen_output',
    new vscode.ShellExecution('echo'),
    ['$doxygen-runner',
        '$doxygen-runner-multiline',
        '$doxygen-tag-configuration'
    ]);