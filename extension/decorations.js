const vscode = require('vscode');
const { getDatestampColour, numberToColor } = require('./utils');
const notesStore = require('./notesStore');

let linkProviderDisposable;

// -------------------- Decoration types (created once, never disposed) --------------------

function makeActionDecoration(priority) {
    return vscode.window.createTextEditorDecorationType({
        backgroundColor: numberToColor(priority),
        borderRadius: '3px',
        color: 'white'
    });
}

const DECORATIONS = {
    strikeThrough: vscode.window.createTextEditorDecorationType({
        textDecoration: 'line-through solid rgba(120,120,120,0.7)',
        color: 'rgba(120,120,120,0.9)'
    }),
    mention: vscode.window.createTextEditorDecorationType({
        textDecoration: 'underline',
        fontWeight: 'bold',
        color: '#b694b6',
        backgroundColor: '#7E297E55'
    }),
    // Priority decorations 1-99
    ...Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [i, makeActionDecoration(i)])  // 0 to 99
    )
};

// Date decorations cached by colour string - grows slowly, never disposed
const datestampDecorationCache = new Map();

function getDateDecoration(color) {
    if (!datestampDecorationCache.has(color)) {
        datestampDecorationCache.set(color, vscode.window.createTextEditorDecorationType({
            backgroundColor: color,
            borderRadius: '3px'
        }));
    }
    return datestampDecorationCache.get(color);
}

// -------------------- Update all decorations --------------------

function updateEditorDecorations(editor) {
    if (!editor) return;
    const note = notesStore.getNote(editor.document.uri.fsPath);
    if (!note) return;

    // Collect ranges per decoration type
    const actionRanges = {};   // keyed by priority number
    const strikeThroughRanges = [];
    const mentionRanges = [];
    const dateRanges = new Map();  // keyed by decoration object

    // ----- Actions -----
    if (Array.isArray(note.actions)) {
        note.actions
            .filter(a => !a.externalAction)
            .forEach(action => {
                const line = action.line;
                if (action.priority === 'x') {
                    const lineText = editor.document.lineAt(line).text;
                    strikeThroughRanges.push(new vscode.Range(line, 3 + 1, line, lineText.length));
                } else {
                    const bracketLength = `[${action.priority}]`.length;
                    const range = new vscode.Range(line, 0, line, bracketLength);
                    if (!actionRanges[action.priority]) actionRanges[action.priority] = [];
                    actionRanges[action.priority].push(range);
                }
            });
    }

    // ----- Dates -----
    if (Array.isArray(note.datestamps)) {
        note.datestamps.forEach(ds => {
            const range = new vscode.Range(ds.line, ds.charBegin, ds.line, ds.charEnd);
            const deco = getDateDecoration(getDatestampColour(ds.value));
            if (!dateRanges.has(deco)) dateRanges.set(deco, []);
            dateRanges.get(deco).push(range);
        });
    }

    // ----- Mentions -----
    if (Array.isArray(note.outgoingMentions)) {
        note.outgoingMentions.forEach(m =>
            mentionRanges.push(new vscode.Range(m.line, m.charStart, m.line, m.charEnd))
        );
    }

    // ----- Apply decorations -----
    // Clear all priority decorations first, then apply only those with ranges
    for (let p = 0; p <= 99; p++) {
        editor.setDecorations(DECORATIONS[p], actionRanges[p] || []);
    }
    editor.setDecorations(DECORATIONS.strikeThrough, strikeThroughRanges);
    editor.setDecorations(DECORATIONS.mention, mentionRanges);

    // Clear all cached date decorations, then apply those with ranges
    datestampDecorationCache.forEach((deco) => editor.setDecorations(deco, []));
    dateRanges.forEach((ranges, deco) => editor.setDecorations(deco, ranges));
}

// -------------------- Mentions links (Ctrl+Click) --------------------

function activateMentions(context) {
    if (linkProviderDisposable) linkProviderDisposable.dispose();

    context.subscriptions.push(
        vscode.commands.registerCommand('notesExtension.openAtLine', async (filePath, targetLine) => {
            const doc = await vscode.workspace.openTextDocument(filePath);
            const editor = await vscode.window.showTextDocument(doc);
            const pos = new vscode.Position(targetLine, 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.AtTop);
        })
    );

    linkProviderDisposable = vscode.languages.registerDocumentLinkProvider(
        { language: 'markdown' },
        {
            provideDocumentLinks(document) {
                const note = notesStore.getNote(document.uri.fsPath);
                if (!note || !Array.isArray(note.outgoingMentions)) return [];
                return note.outgoingMentions.map(mention => {
                    const start = new vscode.Position(mention.line, mention.charStart);
                    const end = new vscode.Position(mention.line, mention.charEnd);
                    const args = encodeURIComponent(JSON.stringify([mention.filePath, mention.targetLine ?? 0]));
                    const uri = vscode.Uri.parse(`command:notesExtension.openAtLine?${args}`);
                    return new vscode.DocumentLink(new vscode.Range(start, end), uri);
                });
            }
        }
    );

    context.subscriptions.push(linkProviderDisposable);
}
// -------------------- Deactivate mentions --------------------

function deactivateMentions() {
    if (linkProviderDisposable) linkProviderDisposable.dispose();
}

module.exports = {
    updateEditorDecorations,
    activateMentions,
    deactivateMentions
};