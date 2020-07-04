import * as vscode from 'vscode';
import * as path from 'path';
import * as glob from 'fast-glob';
import * as child_process from 'child_process';
import * as fs from 'fs';

// get the currently opened file or undefined
export function getCurrentFileDir() {
    if (vscode.window.activeTextEditor) {
        let opened_file = vscode.window.activeTextEditor.document.fileName;
        return path.dirname(opened_file);
    }

    return undefined;
}

// check if everything is set up correctly
export function check() {
    let config = vscode.workspace.getConfiguration('doxygen_runner');
    let executable = config['doxygen_command'];
    let args = ['-v'];
    try {
        let output = child_process.execFileSync(executable, args);
        console.log(`Doxygen version: ${output}`);
        return true;
    } catch (err) {
        throw Error(`Doxygen is not installed or not correcly configured.\Command '${executable} ${args.join(' ')}' failed with '${err.message}'.`);
    }
}

// parse a Doxygen configuration file
export function parseConfig(doxyfile) {
    console.log(`Parsing ${doxyfile}`);

    let cfg = {};
    let lines = fs.readFileSync(doxyfile);
    for (let row of lines.toString().split('\n')) {
        {
            let match = row.match(/^\s*PROJECT_NAME\s*=\s*"?([^"]*)"?\s*$/);
            if (match) {
                cfg['project_name'] = match[1];
            }
        }
        {
            let match = row.match(/^\s*OUTPUT_DIRECTORY\s*=\s*"?([^"]*)"?\s*$/);
            if (match) {
                let output_directory = match[1];
                if (output_directory.endsWith(path.sep)) {
                    output_directory = output_directory.substr(0, output_directory.length - 1);
                }
                cfg['output_directory'] = output_directory;
            }
        }
    }
    return cfg;
}

export function readPath(raw: string): string {
    return path.normalize(raw.replace(/[\/\\\s]+$/gi, ""));
}

// find a Doxygen configuration file for the project containing `filepath`
export function findDoxyFile(filepath: string) {
    if (filepath === undefined) {
        filepath = getCurrentFileDir();
        if (filepath === undefined) {
            return undefined;
        }
    }

    let config = vscode.workspace.getConfiguration('doxygen_runner');
    let config_file: string;
    let config_file_dir: string;
    if (config['configuration_file_override'] !== "") {
        // use the override
        config_file = config['configuration_file_override'];
        if (config_file.indexOf('${workspaceFolder}') >= 0) {
            let matching_folders = vscode.workspace.workspaceFolders.filter((folder) => { return fs.existsSync(config_file.replace("${workspaceFolder}", folder.uri.fsPath)); });
            switch (matching_folders.length) {
                case 0:
                    throw Error("Cannot resolve '${workspaceFolder}' in overwritten configuration path, no file found.");
                case 1:
                    let folder = matching_folders[0].uri.fsPath;
                    config_file = config_file.replace("${workspaceFolder}", folder);
                    break;
                default:
                    throw Error("Cannot resolve '${workspaceFolder}' unambiguosly in overwritten configuration path.");
            }
        }
        config_file_dir = path.dirname(config_file);

    } else {
        // load config file names
        let configuration_filenames = config['configuration_filenames'];

        // go up until we find a unique Doxygen config
        let config_file_dir = filepath;
        let config_file = undefined;
        let workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filepath));
        while (config_file_dir !== workspace.uri.fsPath) {
            let globs = configuration_filenames.map((name) => `${config_file_dir}/**/${name}`);
            let doxyfiles = glob.sync(globs);
            if (doxyfiles.length === 1) {
                config_file = path.normalize(doxyfiles[0].toString());
                break;
            } else if (doxyfiles.length > 1) {
                vscode.window.showWarningMessage(`Cannot determine unambiguous Doxyfile / doxygen.conf: ${doxyfiles}`);
                return undefined;
            }
            config_file_dir = path.dirname(config_file_dir);
        }
    }

    if (config_file !== undefined) {
        // we found a config file, no we need to determine the base path, relative to which the output will be generated
        let cfg = parseConfig(config_file);

        /*
        Check if the configuration file is kept inside the output directory.
        
        Example 1:
        doc/nested/Doxyfile 
        and
        OUTPUT_DIRECTORY = doc/nested
        Then, we need to go up into the folder containing `doc/nested`
        
        Example 2:
        doc/Doxyfile 
        and
        OUTPUT_DIRECTORY = doc/nested
        Then, we need to go up into the folder containing `doc`
        */

        let output_dirs: string[] = readPath(cfg['output_directory']).split(path.sep);
        let base_dirs: string[] = config_file_dir.split(path.sep);
        for (let subdir of output_dirs.reverse()) {
            let last_dir = base_dirs[base_dirs.length - 1];
            if (last_dir === subdir) {
                base_dirs.pop();
            }
        }

        let base_dir: string;
        if (config_file_dir.startsWith('/')) {
            // Absolute unix path, this means the result should also be absolute
            base_dir = path.normalize(path.join(path.sep, ...base_dirs));
        } else {
            base_dir = path.normalize(path.join(...base_dirs));
        }
        return [base_dir, config_file];
    }

    return undefined;
}
