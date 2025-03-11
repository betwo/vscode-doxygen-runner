import * as vscode from 'vscode';

export function analyze(
    log: string[],
    doxyfile: string,
    diagnostics_collection: vscode.DiagnosticCollection
) {
    let diags = new Map<string, vscode.Diagnostic[]>();
    analyzeTag(
        log.filter((x) => x.trim() !== ''),
        doxyfile,
        diags
    );

    for (let it of diags.entries()) {
        let uri = vscode.Uri.file(it[0]);
        diagnostics_collection.set(uri, it[1]);
    }
}

export function analyzeTag(
    log: string[],
    doxyfile: string,
    diagnostics_collection: Map<string, vscode.Diagnostic[]>
) {
    for (let line = 0; line < log.length; ++line) {
        let no_matching_file =
            /^(.*):(\d+):\s+(warning|error):\s+(no .* found for .*)$/.exec(
                log[line]
            );
        if (no_matching_file !== null) {
            let message: string = no_matching_file[4];
            let start = new vscode.Position(
                parseInt(no_matching_file[2]) - 1,
                0
            );
            let end = new vscode.Position(
                parseInt(no_matching_file[2]) - 1,
                1000
            );
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(start, end),
                message,
                stringToSeverity(no_matching_file[3])
            );
            diagnostic.source = no_matching_file[1];

            line += 1;
            diagnostic.message += log[line];

            line = parseContinuedDiagnostic(log, line, diagnostic);
            updateDiagnosticDatabase(diagnostics_collection, diagnostic);
            continue;
        }

        let docu_match = /^(.*):(\d+):\s+(warning|error):\s+(.*)$/.exec(
            log[line]
        );
        if (docu_match !== null) {
            let message: string = docu_match[4];
            let start = new vscode.Position(parseInt(docu_match[2]) - 1, 0);
            let end = new vscode.Position(parseInt(docu_match[2]) - 1, 1000);
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(start, end),
                message,
                stringToSeverity(docu_match[3])
            );
            diagnostic.source = docu_match[1];

            line = parseContinuedDiagnostic(log, line, diagnostic);
            updateDiagnosticDatabase(diagnostics_collection, diagnostic);
            continue;
        }

        let config_line_match =
            /^(warning|error):\s*(.* at line (.*) of file [`'"](.*)[`'"].*)$/.exec(
                log[line]
            );
        if (config_line_match !== null) {
            let message: string = config_line_match[2];
            let start = new vscode.Position(
                parseInt(config_line_match[3]) - 1,
                0
            );
            let end = new vscode.Position(
                parseInt(config_line_match[3]) - 1,
                1000
            );
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(start, end),
                message,
                stringToSeverity(config_line_match[1])
            );
            diagnostic.source = config_line_match[4];

            line = parseContinuedDiagnostic(log, line, diagnostic);
            updateDiagnosticDatabase(diagnostics_collection, diagnostic);
            continue;
        }

        let config_no_line_match = /^(warning|error): (.*)$/.exec(log[line]);
        if (config_no_line_match !== null) {
            let message: string = config_no_line_match[2];
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 0),
                message,
                stringToSeverity(config_no_line_match[1])
            );
            diagnostic.source = doxyfile;

            line = parseContinuedDiagnostic(log, line, diagnostic);
            updateDiagnosticDatabase(diagnostics_collection, diagnostic);
            continue;
        }

        // no match, so threat this as an unknown warning
        let message: string = `Unknown warning/error: ${log[line]}`;
        const diagnostic = new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 0),
            message,
            vscode.DiagnosticSeverity.Information
        );
        diagnostic.source = doxyfile;

        line = parseContinuedDiagnostic(log, line, diagnostic);
        updateDiagnosticDatabase(diagnostics_collection, diagnostic);
    }
}

function updateDiagnosticDatabase(
    diagnostics_collection: Map<string, vscode.Diagnostic[]>,
    diagnostic: vscode.Diagnostic
) {
    let key = diagnostic.source;
    if (!diagnostics_collection.has(key)) {
        diagnostics_collection.set(key, [diagnostic]);
    } else {
        const diagnostics: vscode.Diagnostic[] =
            diagnostics_collection.get(key);
        diagnostics.push(diagnostic);
    }
}

function parseContinuedDiagnostic(
    log: string[],
    line: number,
    diagnostic: vscode.Diagnostic
) {
    while (line + 1 < log.length) {
        let multiline = /^(\s+.*|Possible candidates:.*)$/.exec(log[line + 1]);
        if (multiline === null) {
            break;
        }
        diagnostic.message += '\n' + multiline[1];
        line++;
    }

    return line;
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
