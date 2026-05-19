const vscode = require('vscode');
const path = require('path');

function registerCanvasMessageHandler(panel, context) {
    panel.webview.onDidReceiveMessage(async message => {
        //console.log("canvasMessageHandler received: ", message);

        switch (message.type) {

            case 'ready':
                panel.webview.postMessage({
                    type: 'init',
                    files: []
                });
                break;

            case 'dragEnd':
                //console.log('Dropped:', message.filePath, message.position);
                const existingPositions =
                    context.workspaceState.get('notePositions', {});

                existingPositions[message.filePath] = message.position;

                await context.workspaceState.update(
                    'notePositions',
                    existingPositions
                );
                //console.log('stored positions:\n',JSON.stringify(existingPositions,null,2));
                break;

            case 'openFile':
                const fileUri = vscode.Uri.file(message.filePath);
                vscode.window.showTextDocument(fileUri).then(editor => {
                    const doc = editor.document;
                    // Find first level 1 heading
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
                break;
        }

    });
}

module.exports = {
    registerCanvasMessageHandler
};