const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const notesStore = require('./notesStore.js');

let note = null;

class panelOutlineViewProvider {
    constructor(context, refreshOutlinePanel) {
        this.context = context;
        this.refreshOutlinePanel = refreshOutlinePanel;
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

        setInterval(() => this.setOutlinePanelTitle(), 1000);

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.refreshOutlinePanel();
            }
        });

        // Populate immediately when view is ready
        // Use a microtask to ensure everything is wired up first
        Promise.resolve().then(() => {
            if (this.refreshOutlinePanel) {
                this.refreshOutlinePanel();
            }
        });

        // Message handler
        webview.onDidReceiveMessage(async message => {

            if (message.type === 'openAction') {
                await vscode.commands.executeCommand(
                    'extension.openAction',
                    message.action
                );
            }

            if (message.type === 'openDateStamp') {
                await vscode.commands.executeCommand(
                    'extension.openTimestamp',
                    message.datestamp
                );
            }

            if (message.type === 'openSection') {
                await vscode.commands.executeCommand(
                    'extension.jumpToLine',
                    message.section.line
                );
            }

            if (message.type === 'openNote') {
                const fileUri = vscode.Uri.file(message.path);
                vscode.window.showTextDocument(fileUri).then(editor => {
                    const doc = editor.document;

                    let firstH1Line = null;
                    for (let i = 0; i < doc.lineCount; i++) {
                        if (doc.lineAt(i).text.startsWith('# ')) {
                            firstH1Line = i;
                            break;
                        }
                    }
                    if (firstH1Line === null) return;

                    vscode.commands.executeCommand('editor.foldAll')
                        .then(() => {
                            editor.selection = new vscode.Selection(firstH1Line, 0, firstH1Line, 0);
                            return vscode.commands.executeCommand('editor.unfold');
                        });
                });
            }
        });
    }

    setOutlinePanelTitle() {
        const now = new Date();
        const str = now.toLocaleTimeString();
        this.webviewView.description = str;
    }

    getHtml(webview) {
        const htmlPath = path.join(this.context.extensionPath, 'panelOutline.html');
        let html = fs.readFileSync(htmlPath, 'utf8');

        // Replace panel.js src with a webview URI
        html = html.replace(
            /src="panelOutline.js"/g,
            `src="${webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'panelOutline.js')))}"`
        );

        html = html.replace(
            /src="utils.js"/g,
            `src="${webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'utils.js')))}"`
        );
        return html;
    }

    sendOutlineViewData(note) {
        if (!this.webview) {
            //console.log('Webview not ready');
            return;
        }
        const notes = notesStore.getAllNotes();
        this.webview.postMessage({
            type: 'structuredOutlineData',
            note: note,
            notes
        });
    }

}
module.exports = panelOutlineViewProvider;