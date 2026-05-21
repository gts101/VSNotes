const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const { parseNote } = require('./parser');
const notesStore = require('./notesStore');
const { updateEditorDecorations, activateMentions, deactivateMentions } = require('./decorations');
const { numberToColor } = require('./utils');
const { registerCanvasMessageHandler } = require('./canvasMessageHandler');

const panelOutlineViewProvider = require('./panelOutlineViewProvider');
const panelActionsSorterViewProvider = require('./panelActionsSorterViewProvider');

let showAllActions = false;
let canSortActions = true;
let canvasPanel = null;
let currentMode = null;


// -------------------- Helpers --------------------
function debounce(fn, delay) {
    let timer;
    return (...args) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

function updateMentionsForNote(note) {
    const allNotes = notesStore.getAllNotes();
    const titleMap = new Map();
    allNotes.forEach(n => titleMap.set(n.title.replace(/\.md$/, ''), n));

    note.outgoingMentions = [];

    allNotes.forEach(n => {
        if (n.incomingMentions) {
            n.incomingMentions = n.incomingMentions.filter(m => m.filePath !== note.filePath);
        }
    });

    const text = note.markdown;
    for (const [otherTitle, otherNote] of titleMap.entries()) {
        if (otherNote.filePath === note.filePath) continue;

        // Match "DocName" or "DocName>Heading>SubHeading"
        const regex = new RegExp(`\\b${otherTitle}(?:>[A-Za-z0-9_ -]+)*\\b`, 'g');
        let match;
        while ((match = regex.exec(text)) !== null) {
            const fullMatch = match[0];
            const [, ...headingPath] = fullMatch.split('>');

            const startIndex = match.index;
            const endIndex = startIndex + fullMatch.length;
            const linesUntilMatch = text.slice(0, startIndex).split(/\r?\n/);
            const line = linesUntilMatch.length - 1;
            const charStart = linesUntilMatch[linesUntilMatch.length - 1].length;
            const charEnd = charStart + fullMatch.length;

            // Resolve target line if a heading path was specified
            let targetLine = null;
            if (headingPath.length > 0) {
                targetLine = resolveHeadingPath(otherNote.headings, headingPath);
            }

            note.outgoingMentions.push({
                title: otherTitle,
                filePath: otherNote.filePath,
                line,
                charStart,
                charEnd,
                targetLine  // null for simple mentions, line number for deep links
            });

            if (!otherNote.incomingMentions) otherNote.incomingMentions = [];
            otherNote.incomingMentions.push({
                title: note.title.replace(/\.md$/, ''),
                filePath: note.filePath,
                line,
                charStart,
                charEnd
            });
        }
    }
}
// Walks the heading path sequentially — finds each segment after the previous one
function resolveHeadingPath(headings, headingPath) {
    let searchFromLine = 0;
    let resolvedLine = null;

    for (const segment of headingPath) {
        const match = headings.find(h =>
            h.line >= searchFromLine &&
            h.text.toLowerCase() === segment.toLowerCase()
        );
        if (!match) return null; // segment not found, bail out
        searchFromLine = match.line;
        resolvedLine = match.line;
    }

    return resolvedLine;
}

async function getAllMarkdownFiles() {
    const files = [];
    const folders = vscode.workspace.workspaceFolders || [];
    for (const folder of folders) {
        const folderFiles = await vscode.workspace.findFiles(
            new vscode.RelativePattern(folder, '**/*.md'),
            '**/node_modules/**'
        );
        files.push(...folderFiles);
    }
    return files.map(f => f.fsPath);
}

async function loadAllNotes() {
    try {
        const mdFiles = await getAllMarkdownFiles();

        // Read all files in parallel
        const readPromises = mdFiles.map(async filePath => {
            try {
                const content = await fs.promises.readFile(filePath, 'utf-8');
                const note = parseNote(filePath, content);
                notesStore.addOrUpdateNote(note);
            } catch (err) {
                console.error("Error parsing file:", filePath, err);
            }
        });

        await Promise.all(readPromises);
    } catch (err) {
        console.error("Error loading markdown files:", err);
    }

    const notes = notesStore.getAllNotes();
    computeMentions(notes);
}

function processExternalActions(notes, note) {
    if (!note) return;
    // Remove external actions
    note.actions = note.actions.filter(a => !a.externalAction).filter(a => a.status !== 'done');
    if (showAllActions) return;

    const baseTitle = note.title.replace(/\.md$/, '');
    notes.forEach(otherNote => {
        if (otherNote.filePath === note.filePath) return;
        if (!Array.isArray(otherNote.actions)) return;
        const actions = otherNote.actions.filter(a => a.status !== 'done');
        actions.forEach(action => {
            const regex = new RegExp(`\\b${baseTitle}\\b`);
            if (regex.test(action.text)) {
                //avoid adding actions for self references
                if (action.filePath == note.filePath) return;
                note.actions.push({
                    ...action,
                    externalAction: true
                });
            }
        });
    });
}

function computeMentions(notes, updatedNote) {
    // If updatedNote is provided, only update mentions for it and notes referencing it
    const titleMap = new Map();
    notes.forEach(n => {
        titleMap.set(n.title.replace(/\.md$/, ''), n);
        if (!updatedNote || n === updatedNote) {
            n.outgoingMentions = [];
        }
        // Only clear incoming mentions pointing to updatedNote
        if (updatedNote && n.incomingMentions) {
            n.incomingMentions = n.incomingMentions.filter(m => m.title !== updatedNote.title.replace(/\.md$/, ''));
        }
    });

    const targets = updatedNote ? [updatedNote] : notes;

    targets.forEach(n => {
        const text = n.markdown;
        for (const [otherTitle, otherNote] of titleMap.entries()) {
            if (otherTitle === n.title.replace(/\.md$/, '')) continue;

            const regex = new RegExp(`\\b${otherTitle}\\b`, 'g');
            let match;
            while ((match = regex.exec(text)) !== null) {
                const startIndex = match.index;
                const linesUntilMatch = text.slice(0, startIndex).split(/\r?\n/);
                const line = linesUntilMatch.length - 1;
                const charStart = linesUntilMatch[linesUntilMatch.length - 1].length;
                const charEnd = charStart + otherTitle.length;

                n.outgoingMentions.push({
                    title: otherTitle,
                    filePath: otherNote.filePath,
                    line,
                    charStart,
                    charEnd
                });

                if (!otherNote.incomingMentions) otherNote.incomingMentions = [];
                otherNote.incomingMentions.push({
                    title: n.title.replace(/\.md$/, ''),
                    filePath: n.filePath,
                    line,
                    charStart,
                    charEnd
                });
            }
        }
    });
}

// -------------------- Editor Update Helper --------------------
function updateCurrentEditor() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    updateEditorDecorations(editor);
}

async function openAction(action) {
    if (!action || !action.filePath) return;

    try {
        //console.log(JSON.stringify(action,2,null));
        const fileUri = vscode.Uri.file(action.filePath);
        // Open the document
        const doc = await vscode.workspace.openTextDocument(fileUri);
        // Show it in the editor
        const editor = await vscode.window.showTextDocument(doc);
        const lineNumber = action.line;
        // Calculate the priority range (assumes raw begins with: [priority])
        const priorityStart = action.charBegin + 1; // skip '['
        const priorityLength = String(action.priority).length;
        const priorityEnd = priorityStart + priorityLength;
        const start = new vscode.Position(lineNumber, priorityStart);
        const end = new vscode.Position(lineNumber, priorityEnd);
        // Select just the priority value
        editor.selection = new vscode.Selection(start, end);
        // Reveal centered
        editor.revealRange(
            new vscode.Range(start, end),
            vscode.TextEditorRevealType.InCenter
        );
        // Apply any decorations
        updateEditorDecorations(editor);
    } catch (err) {
        console.error('Failed to open action:', err);
    }
}

async function jumpToLine(lineNumber) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const pos = new vscode.Position(lineNumber, 0);
    // Ensure editor is active (this matters more than it should)
    await vscode.window.showTextDocument(editor.document);
    // Fold everything first
    await vscode.commands.executeCommand('editor.foldAll');
    // Move cursor
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(
        new vscode.Range(pos, pos),
        vscode.TextEditorRevealType.AtTop
    );
    // Force unfold using explicit line targeting
    await vscode.commands.executeCommand('editor.unfold', {
        selectionLines: [lineNumber]
    });
}

function openTimestamp(datestamp) {
    if (!datestamp || !datestamp.filePath) return;
    const fileUri = vscode.Uri.file(datestamp.filePath);
    vscode.workspace.openTextDocument(fileUri).then(doc => {
        vscode.window.showTextDocument(doc).then(editor => {
            jumpToLine(datestamp.line);
        });
    });
}

function getShortDateString() {
    const today = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[today.getMonth()];
    const day = today.getDate();
    const year = today.getFullYear();
    return `${month} ${day} ${year}`;
}

function dedupeActions(note) {
    if (!note.actions) return;
    const seen = new Set();
    note.actions = note.actions.filter(action => {
        // Create a unique key for each action
        const key = `${action.text}|${action.line}|${action.charBegin}|${action.charEnd}|${action.externalAction ? 1 : 0}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function rebuildActiveNote() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') return;

    const filePath = editor.document.uri.fsPath;
    const text = editor.document.getText();

    try {
        // Parse fresh
        const note = parseNote(filePath, text);
        notesStore.addOrUpdateNote(note);

        // Update mentions for this note
        updateMentionsForNote(note);

        // Recompute external actions cleanly
        const notes = notesStore.getAllNotes();
        processExternalActions(notes, note);

        if (note) dedupeActions(note);

        // Update decorations
        updateEditorDecorations(editor);

    } catch (err) {
        console.error("Error rebuilding active note:", err);
    }
}


// -------------------- Activate --------------------
function activate(context) {

    const panelOutlineViewProviderInstance =
        new panelOutlineViewProvider(context, refreshOutlinePanel);


    const debouncedUpdate = debounce(async () => {
        await rebuildActiveNote();
        refreshActions();
        refreshOutlinePanel();
    }, 200);

    async function initialise() {
        await loadAllNotes();
        await debouncedUpdate();
    }

    const panelActionsSorterViewProviderInstance =
        new panelActionsSorterViewProvider(context, refreshActionsSorterPanel, initialise);

    //is there a md file open?
    showAllActions = false;

    async function refreshActions() {
        let actions = [];
        const editor = vscode.window.activeTextEditor;
        const editorIsMarkdown = editor && editor.document.languageId === "markdown";

        if (showAllActions || !editorIsMarkdown) {
            canSortActions = true;
            actions = notesStore.getAllActions();
            // provider.setActions(actions, true);
        } else {
            canSortActions = false;
            const filePath = editor.document.uri.fsPath;
            actions = notesStore.getActionsForFile(filePath);
            // provider.setActions(actions, false);
            updateCurrentEditor();
        }

        //update actions panel content
        if (panelActionsSorterViewProviderInstance) {
            //add actions counter to panel title...
            setActionsTitle(actions.length);
            panelActionsSorterViewProviderInstance.sendActionsList(actions);
        }
    }

    function applyActionsSorting() {
        if (canSortActions) {
            if (panelActionsSorterViewProviderInstance) {
                //add actions counter to panel title...
                panelActionsSorterViewProviderInstance.applyActionsSorting();
            }
        } else {
            vscode.window.showInformationMessage('cannot apply sort when list is filtered');
        }
    }

    function normaliseActionPriorities() {
        if (canSortActions) {
            if (panelActionsSorterViewProviderInstance) {
                //add actions counter to panel title...
                panelActionsSorterViewProviderInstance.normaliseActionPriorities();
            }
        } else {
            vscode.window.showInformationMessage('cannot normalise when list is filtered');
        }
    }

    

    function setActionsTitle(count) {
        //const now = new Date();
        const str = "ACTIONS (" + count + ")" //  "+now.toLocaleTimeString();
        //provider.treeView.title = str;
        panelActionsSorterViewProviderInstance.webviewView.title = str;
    }

    async function refreshActionsSorterPanel() {
        console.log("ffff");
    }

    async function refreshOutlinePanel() {
        //console.log("refresh outline...");
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'markdown') {
            panelOutlineViewProviderInstance.sendOutlineViewData(null);
            return;
        }
        const filePath = editor.document.uri.fsPath;
        const note = notesStore.getNote(filePath);
        if (!note || !Array.isArray(note.datestamps)) {
            panelOutlineViewProviderInstance.sendOutlineViewData(null);
            return;
        }
        panelOutlineViewProviderInstance.sendOutlineViewData(note);

    }





    initialise();
    activateMentions(context);

    vscode.window.onDidChangeVisibleTextEditors((editors) => {
        //console.log("++ChangeVisibleTextEditors");
        if (editors.length === 0) {
            console.log('All editors closed!');
        }
        debouncedUpdate();
    });

    vscode.window.onDidChangeActiveTextEditor(() => {
        debouncedUpdate();
    });

    vscode.workspace.onDidChangeTextDocument(event => {
        //console.log("++ChangeTextDocument");
        const editor = vscode.window.activeTextEditor;
        const doc = event.document;
        const editingMD = doc.languageId == "markdown";

        if (!editor || event.document !== editor.document) return;

        //detect typing...
        const change = event.contentChanges[0];

        // Handle 'dd' → date shortcut immediately
        if (change && change.text === 'd' && editingMD) {
            const position = change.range.end;
            const line = editor.document.lineAt(position.line);
            const text = line.text;
            if (text.startsWith('dd')) {
                const formatted = "### " + getShortDateString();
                const range = new vscode.Range(position.line, 0, position.line, 2);
                editor.edit(editBuilder => editBuilder.replace(range, formatted));
            }
        }

        // Handle 'nn' → date shortcut immediately
        if (change && change.text === 'n' && editingMD) {
            const position = change.range.end;
            const line = editor.document.lineAt(position.line);
            const text = line.text;
            if (text.startsWith('nn')) {
                const formatted = "### Next";
                const range = new vscode.Range(position.line, 0, position.line, 2);
                editor.edit(editBuilder => editBuilder.replace(range, formatted));
            }
        }
        //this only works if auto close brackets is disabled!
        //allow auto action insert by typing line initial `[`
        //need to disable 'autoClosingBrackets' for this to work...
        if (change && change.text === '[' && editingMD) {
            const position = change.range.end;
            const line = editor.document.lineAt(position.line);
            const text = line.text;
            //if we are at the start of a line and a [ is typed...
            if (text.startsWith('[') && position._character == 0) {
                const formatted = "[0] ";
                const range = new vscode.Range(position.line, 0, position.line, 2);
                editor.edit(editBuilder => editBuilder.replace(range, formatted));
            }
        }
        // Debounced update for all decorations
        debouncedUpdate();
    }, null, context.subscriptions);

    vscode.workspace.onDidSaveTextDocument(async doc => {
        //console.log("++SaveTextDocument");

        if (doc.languageId === "markdown") {
            debouncedUpdate();
        }
    });

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'panelOutlineView',
            panelOutlineViewProviderInstance
        ));

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'panelActionsSorterView',
            panelActionsSorterViewProviderInstance
        )
    );

    const openCanvasCommand = vscode.commands.registerCommand(
        'notesCanvas.open',
        function () { setCanvasContent(context, 'people'); }
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.toggleShowAllActions', async () => {
            showAllActions = !showAllActions;
            // Update context key for UI state
            await vscode.commands.executeCommand(
                'setContext',
                'mdActionParser.showAllActions',
                showAllActions
            );
            debouncedUpdate();

        }),
    );

    // -------------------- Other Commands --------------------
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.refreshActions', refreshActions),
        vscode.commands.registerCommand('extension.openAction', openAction),
        vscode.commands.registerCommand('extension.openTimestamp', openTimestamp),
        vscode.commands.registerCommand('extension.jumpToLine', jumpToLine),
        vscode.commands.registerCommand('extension.applySorting', applyActionsSorting),
        vscode.commands.registerCommand('extension.normaliseActionPriorities', normaliseActionPriorities),
    );
}

function refreshActions(panel, context) {
    panel.webview.postMessage({
        type: 'meh'
    });

    if (!panel._messageHandlerRegistered) {
        registerCanvasMessageHandler(panel, context);
        panel._messageHandlerRegistered = true;
    }
}

function refreshPeople(panel, context) {
    const canvasNotes = notesStore.getAllPeopleNotes();
    const allNotes = notesStore.getAllNotes();

    canvasNotes.forEach(note =>
        processExternalActions(allNotes, note)
    );

    const existingPositions = context.workspaceState.get('notePositions', {});
    panel.webview.postMessage({
        type: 'showNotes',
        canvasNotes,
        existingPositions
    });

    if (!panel._messageHandlerRegistered) {
        registerCanvasMessageHandler(panel, context);
        panel._messageHandlerRegistered = true;
    }
}

function refreshCanvas(panel, context, mode) {
    switch (mode) {
        case 'people':
            refreshPeople(panel, context);
            break;
        case 'actions':
            refreshActions(panel, context);
            break;
    }
}

function setCanvasContent(context, mode) {
    if (!canvasPanel) {
        canvasPanel = vscode.window.createWebviewPanel(
            'notesCanvas',
            'Notes Canvas',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'webview')
                ]
            }
        );

        canvasPanel.onDidDispose(() => {
            canvasPanel = null;
            currentMode = null;
        });
    }

    canvasPanel.reveal(vscode.ViewColumn.One);
    // Only reload HTML if mode changed
    if (currentMode !== mode) {
        canvasPanel.webview.html = getHtml(
            canvasPanel.webview,
            context.extensionUri,
            mode
        );
        currentMode = mode;
    }
    refreshCanvas(canvasPanel, context, mode);
}

function getHtml(webview, extensionUri, name) {
    const folder = "webview";
    const html = name + ".html";
    const js = name + ".js";
    const css = name + ".css";

    const htmlPath = vscode.Uri.joinPath(extensionUri, folder, html);
    let htmlString = fs.readFileSync(htmlPath.fsPath, 'utf8');
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, folder, js));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, folder, css));
    htmlString = htmlString.replace(js, scriptUri.toString()).replace(css, styleUri.toString());
    return htmlString;
}

// -------------------- Deactivate --------------------
function deactivate() {
    deactivateMentions();
}

module.exports = {
    activate,
    deactivate
};
