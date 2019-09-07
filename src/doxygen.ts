import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

import { parseOutputTask } from './parse_output_task'
import * as utils from './utils'

export class Doxygen {
    private active_panel: vscode.WebviewPanel;
    private project_name: string;
    private output_directory: string;
    private html_root_directory: string;
    private view_history: string[] = [];
    private view_future: string[] = [];

    constructor(public context: vscode.ExtensionContext,
        public basedir: string,
        public doxyfile: string) {

        let cfg = utils.parseConfig(doxyfile);
        this.project_name = cfg['project_name'];
        this.output_directory = cfg['output_directory'];
        this.html_root_directory = `${this.basedir}/${this.output_directory}/html`
    }

    // generate the doxygen documentation for the project containing `filepath`
    public generateDocumentation(filepath: string) {
        Promise.resolve(vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Generating doxygen for ${this.doxyfile}`,
            cancellable: false,

        }, async (progress, token) => {
            return this.runDoxygen().then((output: string) => {
                output = output.replace(/`/g, '\\`');
                if (output.length > 0) {
                    parseOutputTask.execution = new vscode.ShellExecution(`echo "${output}"`);

                    vscode.tasks.executeTask(parseOutputTask).then(
                        (task: vscode.TaskExecution) => {},
                        vscode.window.showErrorMessage
                    );
                }
                // display the generated documentation
                vscode.commands.executeCommand('extension.doxygen-runner.view_doxygen', this.basedir);
            });
        }));
    }

    private runDoxygen() {
        // spawn a task to analyze the output of doxygen and match problems
        let options: child_process.ExecSyncOptionsWithStringEncoding = {
            'cwd': this.basedir,
            'encoding': 'utf8'
        };
        // call doxygen in a subprocess
        let config = vscode.workspace.getConfiguration('doxygen_runner');
        let executable = config['doxygen_command'];

        return new Promise(
            (resolve, reject) => {
                child_process.exec(`${executable} ${this.doxyfile}  2>&1 1>/dev/null`, options,
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
    public viewIndex() {
        this.viewDoxygen('index.html');
    }


    // convert a relative path to a vscode resource for the web view
    private pathToResource(path: string) {
        if (path.startsWith('http:') || path.startsWith('https:')) {
            return path;
        }
        return vscode.Uri.file(`${this.html_root_directory}/${path}`).with({ scheme: "vscode-resource" }).toString(true);
    }

    // display one file of the documentation in a web view
    private viewDoxygen(uri: string, purge_future_stack: boolean = true) {
        if (uri === undefined) return;

        // split the url into the file and the remaining fragment
        let html_file: string;
        let fragment: string;
        let anchor_idx = uri.indexOf('#');
        if (anchor_idx >= 0) {
            html_file = uri.substr(0, anchor_idx);
            fragment = uri.substr(anchor_idx + 1);
        } else {
            html_file = uri;
            fragment = undefined;
        }

        if (fragment !== undefined && html_file === "") {
            // in-page anchor link
            html_file = this.view_history.pop();
        }

        // update history
        this.view_history.push(html_file);
        if (purge_future_stack) {
            this.view_future = [];
        }

        // read the file contents, adjust them and display them
        let abs_html_file = path.join(this.html_root_directory, html_file);
        fs.readFile(abs_html_file, (error, content) => {
            if (error) {
                vscode.window.showErrorMessage(error.message);
                return;
            }

            // create a web view if we don't have one
            if (this.active_panel === undefined) {
                this.createPanel();
            }

            this.active_panel.webview.html = this.injectHtml(content.toString(), fragment);
        });
    }

    // modify the html code of the doxygen documenation to work within a web view
    private injectHtml(html: string, fragment: string) {

        html = html.replace('<head>', `<head>\n` +
            `<meta http-equiv="Content-Security-Policy" content="` +
            `img-src vscode-resource: https:; ` +
            `script-src vscode-resource: http: https: 'unsafe-eval' 'unsafe-inline'; ` +
            `style-src vscode-resource: 'unsafe-inline';">`)

        html = html.replace(RegExp('(href=.)(.*\.css)([^>]*>)', 'g'),
            (match, pre, path, post) => pre + this.pathToResource(path) + post);
        html = html.replace(RegExp('(src=.)([^>]*\.js)([^>]*>)', 'g'),
            (match, pre, path, post) => pre + this.pathToResource(path) + post);
        html = html.replace(RegExp('(src=.)(.*\.png)([^>]*>)', 'g'),
            (match, pre, path, post) => pre + this.pathToResource(path) + post);

        html = html.replace('</html>',
            `<script>
  (function() {
    const vscode = acquireVsCodeApi();   
  
    let inject = function(){
    if('${fragment}' !== 'undefined') {
        console.log('fragment: ${fragment}');
      let id = $('a[id=${fragment}]');
      if(id.offset() != null) {
          console.log('id', id);
        $('html,body').animate({scrollTop: id.offset().top},'slow');
      } else {
        let name = $('a[name=${fragment}]');
        console.log('name', name);
        if(name.offset() != null) {
            $('html,body').animate({scrollTop: name.offset().top},'slow');
        }
      }
    }
    $('a').click(function() {   
        console.log($(this));
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
   };
   inject();
   $(document).ready(inject);
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


    // create a new web view panel
    private createPanel() {
        // Create and show a new webview
        let panel = vscode.window.createWebviewPanel(
            'doxygen',
            `Doxygen (${this.project_name})`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                enableFindWidget: true,
                localResourceRoots: [
                    vscode.Uri.file(this.html_root_directory)
                ],
            }
        );

        panel.webview.onDidReceiveMessage((ev) => {
            switch (ev.command) {
                case "link":
                    this.viewDoxygen(ev.url);
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
                this.active_panel = undefined;
            },
            null,
            this.context.subscriptions
        );

        this.active_panel = panel;
    }
};