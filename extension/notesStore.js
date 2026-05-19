let notes = [];

function addOrUpdateNote(note) {
    if (!note || !note.filePath) return;

    const index = notes.findIndex(n => n.filePath === note.filePath);

    if (index >= 0) {
        notes[index] = note;
    } else {
        notes.push(note);
    }
}

function removeNote(filePath) {
    notes = notes.filter(n => n.filePath !== filePath);
}

function getAllNotes() {
    //sorted list
    return notes.slice().sort((a, b) => a.title.localeCompare(b.title));
}

function getNote(filePath) {
    return notes.find(n => n.filePath === filePath);
}

function getAllPeopleNotes(){
    let result=getAllNotes();
    return result.filter(m => m.filePath.indexOf("/people/")>-1);
}

function getAllActions() {
    const a=getAllNotes()
        .flatMap(n => Array.isArray(n.actions) ? n.actions : [])
        .filter(action => action.status !== 'done')
        .filter(action => action.externalAction !== true);
   return a;
}

function getActionsForFile(filePath) {
    const note = getNote(filePath);
    if (!note || !Array.isArray(note.actions)) return [];
    return note.actions.filter(action => action.status !== 'done');;
}

module.exports = {
    addOrUpdateNote,
    removeNote,
    getAllNotes,
    getNote,
    getAllActions,
    getActionsForFile,
    getAllPeopleNotes
};
