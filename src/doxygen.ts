import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

import * as utils from './utils';
import * as problem_matcher from './problem_matcher';

export class Doxygen {
    private active_panel: vscode.WebviewPanel;
    private project_name: string;
    private output_directory: string;
    private html_root_directory: string;
    private view_history: string[] = [];
    private view_future: string[] = [];
    private diagnostics: vscode.DiagnosticCollection;
    private navtree_patched_path: string;
    private menu_patched_path: string;
    private storage_path: string;

    constructor(public context: vscode.ExtensionContext,
        public basedir: string,
        public doxyfile: string) {

        let cfg = utils.parseConfig(doxyfile);
        this.project_name = cfg['project_name'];
        this.output_directory = utils.readPath(cfg['output_directory']);
        if (path.isAbsolute(this.output_directory)) {
            this.html_root_directory = path.join(this.output_directory, 'html');
        } else {
            this.html_root_directory = path.join(this.basedir, this.output_directory, 'html');
        }
        this.diagnostics = vscode.languages.createDiagnosticCollection(`doxygen_runner:${this.html_root_directory})`);

        this.storage_path = this.context.storageUri.fsPath;
        fs.mkdir(this.storage_path, { recursive: true }, (err) => {
            if (err !== null) {
                console.error("cannot use vscode extension storage");
                this.storage_path = this.context.extensionPath;
            }
        });
    }

    // generate the doxygen documentation for the project containing `filepath`
    public generateDocumentation(filepath: string) {
        Promise.resolve(vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Doxygen`,
            cancellable: false,

        }, async (progress, token) => {
            return this.runDoxygen(progress, token).then(([stdout, stderr]) => {
                this.diagnostics.clear();
                problem_matcher.analyze(stderr.replace(/\r/gi, '').split('\n'), this.doxyfile, this.diagnostics);
                // display the generated documentation
                let config = vscode.workspace.getConfiguration('doxygen_runner');
                if (config['view_after_generate']) {
                    vscode.commands.executeCommand('extension.doxygen-runner.view_doxygen', this.basedir);
                }
            });
        }));
    }

    private runDoxygen(progress: vscode.Progress<{ message?: string; increment?: number; }>,
        token: vscode.CancellationToken): Promise<string[]> {

        let options: child_process.ExecFileOptionsWithStringEncoding = {
            cwd: this.basedir,
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 1024
        };
        // call doxygen in a subprocess
        let config = vscode.workspace.getConfiguration('doxygen_runner');
        let executable = config['doxygen_command'];
        let args = [this.doxyfile];

        return new Promise(
            (resolve, reject) => {
                console.log(`Running ${executable} in directory ${this.basedir}`);
                let child = child_process.execFile(executable, args, options,
                    (err, std_out, std_err) => {
                        if (err) {
                            console.log(`error: ${err}`);
                            vscode.window.showErrorMessage(err.message);
                            reject();
                            return;
                        }

                        resolve([std_out, std_err]);
                    });
                token.onCancellationRequested(() => {
                    child.kill();
                });

                let buffer = '';
                let last_update = Date.now();
                child.stdout.on('data', (data) => {
                    buffer += data.toString().replace(/\r/gi, '');

                    // split the data into lines
                    let lines = buffer.split('\n');
                    // assume that the last line is incomplete, add it back to the buffer
                    buffer = lines[lines.length - 1];

                    // log the complete lines
                    for (let lineno = 0; lineno < lines.length - 1; ++lineno) {
                        console.log(lines[lineno]);
                    }
                    // if enough time has passed (1 second), update the progress
                    let now = Date.now();
                    if (now - last_update > 1000) {
                        progress.report({ message: lines[lines.length - 2], increment: 0 });
                        last_update = now;
                    }
                });
            });
    }

    // display the doxygen configuration
    public updateView() {
        if (this.active_panel === undefined) {
            this.viewIndex();
        } else {
            this.reloadPage();
            if(this.active_panel.visible !== true) {
                this.active_panel.reveal();
            }
        }
    }

    // display the index of the doxygen documentation for the project containing `filepath`
    public viewIndex() {
        this.viewDoxygen('index.html');
    }

    // get the path to the generated index file
    public getIndexHtmlPath() {
        return vscode.Uri.joinPath(vscode.Uri.file(this.html_root_directory), "index.html");
    }

    // convert a relative path to a vscode resource for the web view
    private pathToResource(path: string) {
        if (path.startsWith('http:') || path.startsWith('https:')) {
            return path;
        }

        if(path === "navtree.js") {
            // special handling for patching navtree resources
            return this.active_panel.webview.asWebviewUri(vscode.Uri.file(this.navtree_patched_path));
        } else if(path === "menu.js") {
            // special handling for patching menu resources
            return this.active_panel.webview.asWebviewUri(vscode.Uri.file(this.menu_patched_path));
        } else {
            const res = this.active_panel.webview.asWebviewUri(vscode.Uri.joinPath(vscode.Uri.file(this.html_root_directory), path));
            console.log(`Mapping path ${path} to resource ${res}`);
            return res;
        }
    }

    // display one file of the documentation in a web view
    private viewDoxygen(uri: string, purge_future_stack: boolean = true) {
        if (uri === undefined) {
            return;
        }

        // split the url into the file and the remaining fragment
        let html_file: string;
        let fragment: string;
        let anchor_idx = uri.indexOf('#');
        if (anchor_idx >= 0) {
            html_file = uri.substr(0, anchor_idx);
            fragment = uri.substr(anchor_idx + 1);
            console.log(`Showing page ${html_file} [${fragment}] extracted from anchor ${uri}`);
        } else {
            html_file = uri;
            fragment = undefined;
            console.log(`Showing page ${html_file} extracted from url ${uri}`);
        }

        if (fragment !== undefined && html_file === "") {
            // in-page anchor link
            html_file = this.view_history.pop();
            console.log(`Showing page ${html_file} [${fragment}] extracted from history`);
        }

        // update history
        this.view_history.push(html_file);
        if (purge_future_stack) {
            this.view_future = [];
        }

        // patch navtree
        this.patchNavtreeFile();
        this.patchMenuFile();

        // read the file contents, adjust them and display them
        let abs_html_file = path.join(this.html_root_directory, html_file);
        fs.readFile(abs_html_file, (error, content) => {
            if (error) {
                throw Error(error.message);
            }

            // create a web view if we don't have one
            if (this.active_panel === undefined) {
                console.log("creating panel");
                this.createPanel();
            }

            console.log("setting html");
            this.active_panel.webview.html = this.injectHtml(content.toString(), fragment, uri);
        });
    }

    private sanitizePath(path: string) {
        if(path.startsWith("/")) {
            // assume unix-like path
            return path;
        } else {
            // assume Windows path
            return "/" + path.replace(/\\/g,'/');
        }
    }

    private patchNavtreeFile() {
        let absfile = path.join(this.html_root_directory, "navtree.js");
        if (fs.existsSync(absfile)) {
            const content = fs.readFileSync(absfile);
            const url_prefix = `https://file+.vscode-resource.vscode-cdn.net${this.sanitizePath(this.html_root_directory)}`;

            let patched_content = content.toString();
            patched_content = patched_content.replace('script.src = scriptName', `script.src = '${url_prefix}/' + scriptName`);
            patched_content = patched_content.replace(`"'+relpath+'sync_off.png`, `"${url_prefix}/sync_off.png`);
            patched_content = patched_content.replace(`"'+relpath+'sync_on.png`, `"${url_prefix}/sync_on.png`);

            this.navtree_patched_path = path.join(this.context.storageUri.fsPath, `navtree-patched.js`);
            fs.writeFileSync(this.navtree_patched_path, patched_content);
        }
    }

    private patchMenuFile() {
        let absfile = path.join(this.html_root_directory, "menu.js");
        if (fs.existsSync(absfile)) {
            const content = fs.readFileSync(absfile);
            const url_prefix = `https://file+.vscode-resource.vscode-cdn.net${this.html_root_directory}`;
            let patched_content = content.toString();
            patched_content = patched_content.replace(`src="'+relPath+`, `src="${url_prefix}/'+`);

            this.menu_patched_path = path.join(this.context.storageUri.path, `menu-patched.js`);
            fs.writeFileSync(this.menu_patched_path, patched_content);
        }
    }

    // modify the html code of the doxygen documenation to work within a web view
    private injectHtml(html: string, fragment: string, uri: string) {

        html = html.replace('<head>', `<head>\n` +
            `<meta http-equiv="Content-Security-Policy" content="` +
            `default-src 'none';` +
            `img-src ${this.active_panel.webview.cspSource} https:; ` +
            `script-src ${this.active_panel.webview.cspSource} http: https: 'unsafe-eval' 'unsafe-inline'; ` +
            `style-src ${this.active_panel.webview.cspSource} 'unsafe-inline';` +
            `">`);

        html = html.replace(RegExp('(href=.)(.*\\.css)([^>]*>)', 'g'),
            (match, pre, path, post) => pre + this.pathToResource(path) + post);
        html = html.replace(RegExp('(src=.)([^>]*\\.js)([^>]*>)', 'g'),
            (match, pre, path, post) => pre + this.pathToResource(path) + post);
        html = html.replace(RegExp('(src=.)(.*\\.(?:png|svg|gif))([^>]*>)', 'g'),
            (match, pre, path, post) => pre + this.pathToResource(path) + post);

        html = html.replace('</html>',
            `<script>
  (function() {
    const vscode = acquireVsCodeApi();
    let injected = false;
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
    $('a:not(.external)').off().click(function() {
      vscode.postMessage({
        command: 'link',
        url: $(this).attr('href')
      });
    });
    $('a.external').off().click(function() {
      vscode.postMessage({
        command: 'external_link',
        url: $(this).attr('href')
      });
    });
    $('area').off().click(function() {
      vscode.postMessage({
        command: 'link',
        url: $(this).attr('href')
      });
    });
    if(!injected){
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
      console.log("observe mutation");
      const observer = new MutationObserver(() => {
        console.log("mutation");
        inject();
      });
      observer.observe(document.getElementById('side-nav'), {
        childList: true,
        subtree: true
      });
    }
    injected = true;
   };
   $(document).ready(inject);
  }())

  </script>
  </html>`);

        html = html.replace('</body>', `<p><small>This page has been modified in order to work inside of Virtual Studio Code.
        <a class="external" href="file://${this.html_root_directory}/${uri}">Click here</a> to see the documentation in the browser.</small></p></body>`);
        return html;
    }

    private reloadPage() {
        let current = this.view_history.pop();
        this.viewDoxygen(current, false);
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
        if (this.view_future.length === 0) {
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
                enableForms: true,
                localResourceRoots: [
                    vscode.Uri.file(this.context.storageUri.fsPath),
                    vscode.Uri.file(this.html_root_directory)
                ],
            }
        );

        panel.webview.onDidReceiveMessage((ev) => {
            switch (ev.command) {
                case "external_link":
                    vscode.env.openExternal(vscode.Uri.parse(ev.url));
                    break;
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
}