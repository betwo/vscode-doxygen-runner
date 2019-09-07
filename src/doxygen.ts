import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as glob from 'fast-glob';
import * as path from 'path';
import * as fs from 'fs';

export class Doxygen {
    public parseOutputTask: vscode.Task | undefined;

    private active_panel = new Map<string, vscode.WebviewPanel>();
    private project_name: string;
    private output_directory: string;
    private view_history: string[] = [];
    private view_future: string[] = [];

    constructor(public context: vscode.ExtensionContext) {
        let kind: vscode.TaskDefinition = {
            'type': 'doxygen_runner'
        };
        this.parseOutputTask = new vscode.Task(
            kind, 'Parse Doxygen documentation', 'extension.doxygen-runner.parse_doxygen_output',
            new vscode.ShellExecution('echo'),
            ['$doxygen-runner',
                '$doxygen-runner-multiline',
                '$doxygen-tag-configuration'
            ]);
    }

    // generate the doxygen documentation for the project containing `filepath`
    public generateDocumentation(filepath: string) {
        if (!this.check()) {
            return;
        }

        let tmp = this.findDoxyFile(filepath);
        if (tmp === undefined) {
            let config = vscode.workspace.getConfiguration('doxygen_runner');
            let configuration_filenames = config['configuration_filenames'];
            vscode.window.showErrorMessage(`No Doxygen configuration found (${configuration_filenames}).`);
            return;
        }
        let doxyfile = tmp[1];
        let basedir = tmp[0].toString();

        Promise.resolve(vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Generating doxygen for ${doxyfile}`,
            cancellable: false,

        }, async (progress, token) => {
            return this.runDoxygen(basedir, doxyfile).then((output: string) => {
                output = output.replace(/`/g, '\\`');
                this.parseOutputTask.execution = new vscode.ShellExecution(`echo "${output}"`);

                vscode.tasks.executeTask(this.parseOutputTask).then(
                    (task: vscode.TaskExecution) => {
                        // display the generated documentation
                        vscode.commands.executeCommand('extension.doxygen-runner.view_doxygen', basedir);
                    },
                    vscode.window.showErrorMessage
                );
            });
        }));
    }

    private runDoxygen(basedir, doxyfile) {
        // spawn a task to analyze the output of doxygen and match problems
        let options: child_process.ExecSyncOptionsWithStringEncoding = {
            'cwd': basedir,
            'encoding': 'utf8'
        };
        // call doxygen in a subprocess
        let config = vscode.workspace.getConfiguration('doxygen_runner');
        let executable = config['doxygen_command'];

        return new Promise(
            (resolve, reject) => {
                child_process.exec(`${executable} ${doxyfile}  2>&1 1>/dev/null`, options,
                    (err, output) => {
                        if (err) {
                            console.log(`error: ${err}`);
                            vscode.window.showErrorMessage(err.message);
                            reject();
                            return;
                        }

                        resolve(output);
                    });
            });
    }

    // display the index of the doxygen documentation for the project containing `filepath`
    public viewIndex(filepath: string) {
        if (!this.check()) {
            return;
        }

        let tmp = this.findDoxyFile(filepath);
        if (tmp === undefined) {
            vscode.window.showErrorMessage("Cannot show Doxygen documentation, no opened files available.");
            return;
        }
        let doc_directory = tmp[0].toString();
        let doxyfile = tmp[1];

        let index_files = glob.sync([`${doc_directory}/${this.output_directory}/**/index.html`]).map((x) => String(x));
        if (index_files.length == 1) {
            this.viewDoxygen(index_files[0]);
        } else if (index_files.length > 1) {
            vscode.window.showQuickPick(index_files).then((file) => this.viewDoxygen(file));
        }
    }

    // check if everything is set up correctly
    public check() {
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
    private parseConfig(doxyfile: string) {
        console.log(`Parsing ${doxyfile}`);
        let lines = fs.readFileSync(doxyfile);
        for (let row of lines.toString().split('\n')) {
            {
                let match = row.match(/^\s*PROJECT_NAME\s*=\s*"?([^"]*)"?\s*$/);
                if (match) {
                    this.project_name = match[1];
                }
            }
            {
                let match = row.match(/^\s*OUTPUT_DIRECTORY\s*=\s*"?([^"]*)"?\s*$/);
                if (match) {
                    let output_directory = match[1];
                    if(output_directory.endsWith(path.sep)) {
                        output_directory = output_directory.substr(0, output_directory.length - 1); 
                    }
                    this.output_directory = output_directory;
                }
            }


        }
    }

    // find a Doxygen configuration file for the project containing `filepath`
    private findDoxyFile(filepath: string) {
        if (filepath === undefined) {
            filepath = this.getCurrentFileDir();
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
            this.parseConfig(config_file);

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

            let output_dirs: string[] = this.output_directory.split(path.sep);
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

    // convert a relative path to a vscode resource for the web view
    private pathToResource(path: string) {
        return vscode.Uri.file(path).with({ scheme: "vscode-resource" }).toString(true);
    }

    // display one file of the documentation in a web view
    private viewDoxygen(uri: string, purge_future_stack: boolean = true) {
        if (uri === undefined) return;

        // split the url into the file and the remaining fragment
        let html_file: string;
        let fragment: string;
        let anchor_idx = uri.indexOf('#');
        if (anchor_idx > 0) {
            html_file = uri.substr(0, anchor_idx);
            fragment = uri.substr(anchor_idx + 1);
        } else {
            html_file = uri;
            fragment = undefined;
        }

        // Find the root of the documentation folder
        let doc_root = path.dirname(html_file);
        let index = undefined;
        while (doc_root !== '/' && fs.existsSync(index)) {
            doc_root = path.dirname(doc_root);
            index = path.join(doc_root, 'index.html');
        }

        // update history
        this.view_history.push(html_file);
        if (purge_future_stack) {
            this.view_future = [];
        }

        // read the file contents, adjust them and display them
        fs.readFile(html_file, (error, content) => {
            if (error) {
                vscode.window.showErrorMessage(error.message);
                return;
            }

            // create a web view if we don't have one
            if (!this.active_panel.has(doc_root)) {
                this.createPanel(doc_root);
            }

            this.active_panel.get(doc_root).webview.html = this.injectHtml(content.toString(), doc_root, fragment);
        });
    }

    // modify the html code of the doxygen documenation to work within a web view
    private injectHtml(html: string, doc_root: string, fragment: string) {

        html = html.replace('<head>', `<head>\n` +
            `<meta http-equiv="Content-Security-Policy" content="` +
            `img-src vscode-resource: https:; ` +
            `script-src vscode-resource: https: 'unsafe-inline'; ` +
            `style-src vscode-resource: 'unsafe-inline';">`)

        html = html.replace(RegExp('(href=.)(.*\.css)([^>]*>)', 'g'),
            (match, pre, path, post) => pre + this.pathToResource(`${doc_root}/${path}`) + post);
        html = html.replace(RegExp('(src=.)([^>]*\.js)([^>]*>)', 'g'),
            (match, pre, path, post) => pre + this.pathToResource(`${doc_root}/${path}`) + post);
        html = html.replace(RegExp('(src=.)(.*\.png)([^>]*>)', 'g'),
            (match, pre, path, post) => pre + this.pathToResource(`${doc_root}/${path}`) + post);

        html = html.replace('</html>',
            `<script>
  (function() {
    const vscode = acquireVsCodeApi();   
  
    $(document).ready(function(){
    if('${fragment}' !== 'undefined') {
      let fragment = $('a[id=${fragment}]');
      console.log(fragment);
      $('html,body').animate({scrollTop: fragment.offset().top},'slow');
    }
    $('a').click(function() {   
      vscode.postMessage({
        command: 'link',
        url: $(this).attr('href')
      });
    });
    $('area').click(function() {   
      vscode.postMessage({
        command: 'link',
        url: $(this).attr('href')
      });
    });
    $(window).bind('keydown', function(e) {
      if(event.getModifierState("Alt")) {
          if(e.key === 'ArrowLeft') {
            vscode.postMessage({
                command: 'history',
                direction: 'back'
            });
        } else if(e.key === 'ArrowRight') {
            vscode.postMessage({
                command: 'history',
                direction: 'forward'
            });
        }
      }
    });
  });
  }())
  </script>
  </html>`);

        return html;
    }

    private historyBack() {
        // with 0 or 1 pages in the history, there is nothing to go back to
        if (this.view_history.length <= 1) {
            return;
        }

        // invariant: view history.length > 1

        // take the current view and push it to the future stack
        let current = this.view_history.pop();
        this.view_future.push(current);

        // invariant: view history.length > 0
        let last = this.view_history.pop();
        this.viewDoxygen(last, false);
    }

    private historyForward() {
        if (this.view_future.length == 0) {
            return;
        }
        let next = this.view_future.pop();
        this.viewDoxygen(next, false);
    }

    // get the currently opened file or undefined
    private getCurrentFileDir() {
        if (vscode.window.activeTextEditor) {
            let opened_file = vscode.window.activeTextEditor.document.fileName;
            return path.dirname(opened_file);
        }

        return undefined;
    }

    // create a new web view panel
    private createPanel(doc_root) {
        // Create and show a new webview
        let panel = vscode.window.createWebviewPanel(
            'doxygen',
            `Doxygen (${this.project_name})`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                enableFindWidget: true,
                localResourceRoots: [
                    vscode.Uri.file(doc_root)
                ],
            }
        );

        panel.webview.onDidReceiveMessage((ev) => {
            switch (ev.command) {
                case "link":
                    this.viewDoxygen(path.join(doc_root, ev.url));
                    break;
                case "history":
                    switch (ev.direction) {
                        case 'back':
                            this.historyBack();
                            break;
                        case 'forward':
                            this.historyForward();
                            break;
                    }
                    break;

            }
        },
            undefined,
            this.context.subscriptions
        );

        panel.onDidDispose(
            () => {
                this.active_panel.delete(doc_root);
            },
            null,
            this.context.subscriptions
        );

        this.active_panel.set(doc_root, panel)
    }
};