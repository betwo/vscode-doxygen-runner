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
    try {
        let config = vscode.workspace.getConfiguration('doxygen_runner');
        let executable = config['doxygen_command'];
        let output = child_process.execSync(`${executable} -v`);
        console.log(output);
        return true;
    } catch (err) {
        vscode.window.showErrorMessage("Doxygen is not installed or not correcly configured.");
        return false;
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

// find a Doxygen configuration file for the project containing `filepath`
export function findDoxyFile(filepath: string) {
    if (filepath === undefined) {
        filepath = getCurrentFileDir();
        if (filepath === undefined) {
            return undefined;
        }
    }

    // load config file names
    let config = vscode.workspace.getConfiguration('doxygen_runner');
    let configuration_filenames = config['configuration_filenames'];

    // go up until we find a unique Doxygen config
    let config_file_dir = filepath;
    let config_file = undefined;
    while (config_file_dir != vscode.workspace.rootPath) {
        let globs = configuration_filenames.map((name) => `${config_file_dir}/**/${name}`);
        let doxyfiles = glob.sync(globs);
        if (doxyfiles.length == 1) {
            config_file = doxyfiles[0].toString();
            break;
        } else if (doxyfiles.length > 1) {
            vscode.window.showWarningMessage(`Cannot determine unambiguous Doxyfile / doxygen.conf: ${doxyfiles}`);
            return undefined;
        }
        config_file_dir = path.dirname(config_file_dir);
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

        let output_dirs: string[] = cfg['output_directory'].split(path.sep);
        let base_dirs: string[] = config_file_dir.split(path.sep);
        for (let subdir of output_dirs.reverse()) {
            let last_dir = base_dirs[base_dirs.length - 1];
            if (last_dir === subdir) {
                base_dirs.pop();
            }
        }
        let base_dir = path.join(path.sep, ...base_dirs);
        return [base_dir, config_file];
    }

    return undefined;
}
