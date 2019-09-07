import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as glob from 'fast-glob';
import * as path from 'path';
import * as fs from 'fs';

export class Doxygen {
    public parseOutputTask: vscode.Task | undefined;

    private active_panel: vscode.WebviewPanel | undefined;
    private project_name: string;

    constructor(public context: vscode.ExtensionContext) {
        let kind: vscode.TaskDefinition = {
            'type': 'doxygen_runner'
        };
        this.parseOutputTask = new vscode.Task(
            kind, 'Parse Doxygen documentation', 'extension.doxygen-runner.parse_doxygen_output',
            new vscode.ShellExecution('echo'),
            ['$doxygen-runner', '$doxygen-runner-multiline']);
    }

    // generate the doxygen documentation for the project containing `filepath`
    public generateDocumentation(filepath: string) {
        let tmp = this.findDoxyFile(filepath);
        if (tmp === undefined) {
            vscode.window.showErrorMessage("Cannot generate Doxygen documentation, no opened files available.");
            return;
        }
        let doxyfile = tmp[1];
        let basedir = tmp[0].toString();

        this.parseConfig(doxyfile);

        try {
            let options: child_process.ExecSyncOptionsWithStringEncoding = {
                'cwd': basedir,
                'encoding': 'utf8'
            };

            // call doxygen in a subprocess
            let stdout = child_process.execSync(`doxygen ${doxyfile}  2>&1 1>/dev/null`, options);

            // spawn a task to analyze the output of doxygen and match problems
            this.parseOutputTask.execution = new vscode.ShellExecution(`echo "${stdout}"`);
            vscode.tasks.executeTask(this.parseOutputTask).then(
                (task: vscode.TaskExecution) => {
                    vscode.commands.executeCommand('extension.doxygen-runner.parse_doxygen_output');
                },
                vscode.window.showErrorMessage
            );

            // display the generated documentation
            vscode.commands.executeCommand('extension.doxygen-runner.view_doxygen', basedir);
        } catch (err) {
            console.log(`error: ${err}`);
            vscode.window.showErrorMessage(err);
        }
    }

    // display the index of the doxygen documentation for the project containing `filepath`
    public viewIndex(filepath: string) {
        let tmp = this.findDoxyFile(filepath);
        if (tmp === undefined) {
            vscode.window.showErrorMessage("Cannot show Doxygen documentation, no opened files available.");
            return;
        }
        let doc_directory = tmp[0].toString();
        let doxyfile = tmp[1];

        this.parseConfig(doxyfile);

        let index_files = glob.sync([`${doc_directory}/**/index.html`]).map((x) => String(x));
        console.log(index_files);
        if (index_files.length == 1) {
            this.viewDoxygen(index_files[0]);
        } else if (index_files.length > 1) {
            vscode.window.showQuickPick(index_files).then((file) => this.viewDoxygen(file));
        }
    }

    // parse a Doxygen configuration file
    private parseConfig(doxyfile: string) {
        let lines = fs.readFileSync(doxyfile);
        for (let row of lines.toString().split('\n')) {
            let match = row.match(/^\s*PROJECT_NAME\s*=\s*"(.*)"\s*$/);
            if(match) {
                this.project_name = match[1];
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

        // go up until we find a unique Doxygen config
        let basedir = filepath;
        while (basedir != vscode.workspace.rootPath) {
            let doxyfiles = glob.sync([`${basedir}/**/Doxyfile`, `${basedir}/**/doxygen.conf`]);
            if (doxyfiles.length == 1) {
                return [basedir, doxyfiles[0].toString()];
            } else if (doxyfiles.length > 1) {
                vscode.window.showWarningMessage(`Cannot determine unambiguous Doxyfile / doxygen.conf: ${doxyfiles}`);
                return undefined;
            }
            basedir = path.dirname(basedir);
        }
        return undefined;
    }

    // convert a relative path to a vscode resource for the web view
    private pathToResource(path: string) {
        return vscode.Uri.file(path).with({ scheme: "vscode-resource" }).toString(true);
    }

    // display one file of the documentation in a web view
    private viewDoxygen(uri: string) {
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

        // read the file contents, adjust them and display them
        fs.readFile(html_file, (error, content) => {
            if (error) {
                vscode.window.showErrorMessage(error.message);
                return;
            }

            // create a web view if we don't have one
            if (this.active_panel === undefined) {
                this.createPanel(doc_root);
            }

            this.active_panel.webview.html = this.injectHtml(content.toString(), doc_root, fragment);
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
      text: $(this).attr('href')
      });
    });
    $('area').click(function() {   
      vscode.postMessage({
      command: 'link',
      text: $(this).attr('href')
      });
    });
  });
  }())
  </script>
  </html>`);

        return html;
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
        this.active_panel = vscode.window.createWebviewPanel(
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

        this.active_panel.webview.onDidReceiveMessage((ev) => {
            if (ev.command === "link") {
                this.viewDoxygen(path.join(doc_root, ev.text));
            }
        },
            undefined,
            this.context.subscriptions
        );

        this.active_panel.onDidDispose(
            () => {
                this.active_panel = undefined;
            },
            null,
            this.context.subscriptions
        );
    }
};