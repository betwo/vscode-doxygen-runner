import * as vscode from 'vscode';
import { print } from 'util';

export function analyze(log: string[],
    doxyfile: string,
    diagnostics_collection: vscode.DiagnosticCollection) {

    let diags = new Map<string, vscode.Diagnostic[]>();
    analyzeTag(log.filter((x) => x.trim() !== ''), doxyfile, diags);

    for (let it of diags.entries()) {
        let uri = vscode.Uri.file(it[0]);
        diagnostics_collection.set(uri, it[1]);
    }
}

export function analyzeTag(log: string[],
    doxyfile: string,
    diagnostics_collection: Map<string, vscode.Diagnostic[]>) {
    for (let line = 0; line < log.length; ++line) {
        let docu_match = /^(.*):(\d+):\s+(warning|error):\s+(.*)$/.exec(log[line]);
        if (docu_match !== null) {
            let message: string = docu_match[4];
            let start = new vscode.Position(parseInt(docu_match[2]) - 1, 0);
            let end = new vscode.Position(parseInt(docu_match[2]) - 1, 1000);
            const diagnostic = new vscode.Diagnostic(new vscode.Range(start, end), message, stringToSeverity(docu_match[3]));
            diagnostic.source = docu_match[1];

            while (line + 1 < log.length) {
                let multiline = /^(\s+.*)$/.exec(log[line + 1]);
                if (multiline === null) {
                    break;
                }
                diagnostic.message += '\n' + multiline[1];
                line++;
            }

            if (!diagnostics_collection.has(diagnostic.source)) {
                diagnostics_collection.set(diagnostic.source, [diagnostic]);

            } else {
                const diagnostics: vscode.Diagnostic[] = diagnostics_collection.get(diagnostic.source);
                diagnostics.push(diagnostic);
            }
            continue;
        }

        let config_line_match = /^(warning|error):\s*(.* at line (.*) of file `(.*)' .*)$/.exec(log[line]);
        if (config_line_match !== null) {
            let message: string = config_line_match[2];
            let start = new vscode.Position(parseInt(config_line_match[3]) - 1, 0);
            let end = new vscode.Position(parseInt(config_line_match[3]) - 1, 1000);
            const diagnostic = new vscode.Diagnostic(new vscode.Range(start, end), message, stringToSeverity(config_line_match[1]));
            diagnostic.source = config_line_match[4];

            while (line + 1 < log.length) {
                let multiline = /^(\s+.*)$/.exec(log[line + 1]);
                if (multiline === null) {
                    break;
                }
                diagnostic.message += '\n' + multiline[1];
                line++;
            }

            if (!diagnostics_collection.has(doxyfile)) {
                diagnostics_collection.set(doxyfile, [diagnostic]);

            } else {
                const diagnostics: vscode.Diagnostic[] = diagnostics_collection.get(doxyfile);
                diagnostics.push(diagnostic);
            }
            continue;
        }

        let config_no_line_match = /^(warning|error): (.*)$/.exec(log[line]);
        if (config_no_line_match !== null) {
            let message: string = config_no_line_match[2];
            const diagnostic = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), message, stringToSeverity(config_no_line_match[1]));
            diagnostic.source = doxyfile;

            while (line + 1 < log.length) {
                let multiline = /^(\s+.*)$/.exec(log[line + 1]);
                if (multiline === null) {
                    break;
                }
                diagnostic.message += '\n' + multiline[1];
                line++;
            }

            if (!diagnostics_collection.has(doxyfile)) {
                diagnostics_collection.set(doxyfile, [diagnostic]);

            } else {
                const diagnostics: vscode.Diagnostic[] = diagnostics_collection.get(doxyfile);
                diagnostics.push(diagnostic);
            }
            continue;
        }
    }
}

function stringToSeverity(str: string): vscode.DiagnosticSeverity {
    switch (str) {
        case 'warning':
            return vscode.DiagnosticSeverity.Warning;
        case 'error':
            return vscode.DiagnosticSeverity.Error;
        default:
            return vscode.DiagnosticSeverity.Information;
    }
}