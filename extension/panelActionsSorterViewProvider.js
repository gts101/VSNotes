const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const notesStore = require('./notesStore.js');

let note = null;

class panelActionsSorterViewProvider {
    constructor(context, refreshActionsSorterPanel, initialise) {
        this.context = context;
        this.refreshActionsSorterPanel = refreshActionsSorterPanel;
        this.initialise = initialise;
    }

    resolveWebviewView(webviewView) {
        this.webviewView = webviewView;

        const webview = webviewView.webview;
        this.webview = webview;

        // Enable scripts
        webview.options = {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.file(this.context.extensionPath)]
        };

        // Load HTML
        webview.html = this.getHtml(webview);

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.refreshOutlinePanel();
            }
        });

        // Populate immediately when view is ready
        // Use a microtask to ensure everything is wired up first
        Promise.resolve().then(() => {
            if (this.refreshActionsSorterPanel) {
                this.refreshActionsSorterPanel();
            }
        });

        // Message handler
        webview.onDidReceiveMessage(async message => {
            console.log("message", message);

            if (message.type === 'openAction') {
                await vscode.commands.executeCommand(
                    'extension.openAction',
                    message.action
                );
            }


            if (message.type === 'updateActionPriorities') {
                //just iterate over changed items
                const changedActions = message.actions.filter(
                    action =>
                        action.originalPriority != null &&
                        action.priority !== action.originalPriority
                );
                console.log("changedActions", changedActions)


                const actions = changedActions;

                if (actions.length == 0) {
                    vscode.window.showInformationMessage('no changes to save...');
                } else {
                    vscode.window.showInformationMessage('saving '+actions.length+" change(s)");
                    for (let i = 0; i < actions.length; i++) {
                        const action = actions[i];
                        //console.log("ACTION>>> ", action)
                        // Open the markdown document
                        const uri = vscode.Uri.file(action.filePath);
                        const document = await vscode.workspace.openTextDocument(uri);
                        // Get the current line text
                        const line = document.lineAt(action.line);
                        const text = line.text;
                        // Replace leading [number]
                        const updatedText = text.replace(/^\[\d+\]/, `[${action.priority}]`);
                        // Create edit
                        const edit = new vscode.WorkspaceEdit();
                        edit.replace(uri, line.range, updatedText);
                        // Apply edit
                        await vscode.workspace.applyEdit(edit);
                        // Save file
                        await document.save();
                    }
                    this.initialise();
                    this.refreshActionsSorterPanel();
                    vscode.window.showInformationMessage('done...');
                }
            }
        });
    }

    getHtml(webview) {
        const htmlPath = path.join(this.context.extensionPath, 'panelActionsSorter.html');
        let html = fs.readFileSync(htmlPath, 'utf8');

        // Replace panel.js src with a webview URI
        html = html.replace(
            /src="panelActionsSorter.js"/g,
            `src="${webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'panelActionsSorter.js')))}"`
        );

        return html;
    }

    sendActionsList(actions) {
        if (!this.webview) {
            //console.log('Webview not ready');
            return;
        }

        this.webview.postMessage({
            type: 'actionsList',
            actions
        });
    }

    applyActionsSorting() {
        //vscode.window.showInformationMessage('posting......');
        this.webview.postMessage({
            type: 'applyActionsSorting'
        });
    }

    normaliseActionPriorities() {
        this.webview.postMessage({
            type: 'normaliseActionPriorities'
        });
    }



}
module.exports = panelActionsSorterViewProvider;