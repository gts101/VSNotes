let vscode = null;
let n = 0;

// Detect VSCode environment
if (typeof acquireVsCodeApi !== 'undefined') {
    vscode = acquireVsCodeApi();
} else {
    // Browser fallback
    vscode = {
        postMessage: (msg) => console.log('Mock message:', msg)
    };
}

// Notify extension frontend is ready
vscode.postMessage({ type: 'ready' });

window.addEventListener('message', event => {
    const message = event.data;
    if (message.type === 'showNotes') {
        //console.log('canvasNotes:', message.canvasNotes);
        renderNotes(message.canvasNotes, message.existingPositions);
    }
});

//backgrounds....
let backgroundNumber = 1;
window.onkeyup = function (evt) {
    //console.log("keyup", evt)
    if (evt.key == 'b') {
        nextBackground();
    }
}
function nextBackground() {
    backgroundNumber++;
    if (backgroundNumber > 4) backgroundNumber = 1;
    updateBackground();
}
function updateBackground() {
    document.body.classList = [];
    document.body.classList.add("bg" + backgroundNumber);
}
updateBackground();

// Browser fallback
if (typeof acquireVsCodeApi === 'undefined') {
    //Mock data...
    const mockNotes = [
        {
            title: "Rod.md",
            filePath: "/test/Rod.md",
            hasPlan: true,
            headings: [{ "headingContent": "ACME, 5 days, WFH Wed + Fri" }]
        },
        {
            title: "Jane.md",
            filePath: "/test/Jane.md",
            hasPlan: true,
            headings: [{ "headingContent": "EMCA, 5 days, WFH Wed + Fri" }]
        },
        {
            title: "Freddy.md",
            filePath: "/test/Freddy.md",
            hasPlan: false,
            headings: [{ "headingContent": "ACCA, 5 days, WFH Wed + Fri" }]
        },
        //      { title: "LongerName.md", filePath: "/test/LongerName.md", hasPlan: true },
    ];
    const mockStoredPositions = {
        "/test/Rod.md": { "x": 101, "y": 209 },
        "/test/Jane.md": { "x": 151, "y": 259 },
        "/test/Freddy.md": { "x": 201, "y": 209 }
        //no entry for the 4th mock note to test spawning
    };
    renderNotes(mockNotes, mockStoredPositions);
}

function renderNotes(canvasNotes, existingPositions) {
    //TODO... process all external actions.
    const canvas = document.getElementById('canvas');
    const swList = [];

    canvas.innerHTML = '';
    canvasNotes.forEach((note, index) => {
        //make a div...
        const div = document.createElement('div');
        div.className = 'note';
        const fp = note.filePath;
        let shortName = note.title.replaceAll(".md", "");
        div.textContent = shortName;
        setFontByLength(div);

        //add colours for software people
        if (hasPlan(note)) {
            swList.push(note);
            //look for person metadata e.g. `EMCA. 5 days, WFH Wed + Fri`
            const lines = note.headings[0].headingContent.split("\n");
            div.title = lines[0];
            let team = "";
            if (lines[0].indexOf(",") > -1) {
                team = lines[0].split(",")[0];
                div.classList.add(team);
            }
        }
        
        //add border and outline for any internal/external actions
        addActions(div, note.actions);

        //set position...
        let x = (20 + index * 3);
        let y = (20 + index * 6);
        //if there is a stored position, use it
        if (existingPositions && existingPositions[fp]) {
            x = existingPositions[fp].x;
            y = existingPositions[fp].y;
        }
        div.style.left = x + 'px';
        div.style.top = y + 'px';

        let isDragging = false;
        let didMove = false;
        let startX = 0;
        let startY = 0;
        let offsetX = 0;
        let offsetY = 0;

        div.addEventListener('mousedown', (e) => {
            isDragging = true;
            didMove = false;

            startX = e.clientX;
            startY = e.clientY;
            offsetX = parseInt(div.style.left);
            offsetY = parseInt(div.style.top);

            div.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                didMove = true;
            }

            div.style.left = offsetX + dx + 'px';
            div.style.top = offsetY + dy + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;

            isDragging = false;
            div.style.cursor = 'grab';

            if (didMove) {
                vscode.postMessage({
                    type: 'dragEnd',
                    filePath: note.filePath,
                    position: {
                        x: parseInt(div.style.left),
                        y: parseInt(div.style.top)
                    }
                });
            } else {
                vscode.postMessage({
                    type: 'openFile',
                    filePath: note.filePath,
                    line: 0 //action.line
                });
            }
        });
        canvas.appendChild(div);
    });

    //add list of SW people
    if (swList && swList.length > 0) {
        const ol = document.createElement('ol');
        ol.classList.add("swList");
        swList.forEach((item) => {
            const li = document.createElement('li');
            li.innerText = item.title.replace(/\.md$/, '');
            li.addEventListener("click", () => {
                vscode.postMessage({
                    type: 'openFile',
                    filePath: item.filePath,
                    line: 0
                });
            });
            ol.appendChild(li);
        });
        canvas.appendChild(ol);
    }
}

function addActions(div, actions) {

    let internalActions = [];
    let externalActions = [];

    if (actions && actions.length > 0) {
        internalActions = structuredClone(actions);
        internalActions = internalActions.filter(a => a.status !== 'done');
        internalActions = internalActions.filter(a => !a.externalAction);
        externalActions = structuredClone(actions);
        externalActions = externalActions.filter(a => a.status !== 'done');
        externalActions = externalActions.filter(a => a.externalAction);
    }

    if (internalActions.length > 0) {
        div.classList.add("hasAction");
        const lowestNum = getTopPriorityAction(internalActions);
        const color = numberToColor(lowestNum, 1);
        div.style.borderColor = color;
        div.style.zIndex++;
    }

    if (externalActions.length > 0) {
        div.classList.add("hasExternalAction");
        const lowestNum = getTopPriorityAction(externalActions);
        const color = numberToColor(lowestNum, 1);
        div.style.outlineColor = color;
        div.style.zIndex++;
    }

}

function getTopPriorityAction(actionsArray) {
    if (!actionsArray || actionsArray.length === 0) {
        return null;
    }
    return actionsArray.reduce((lowest, action) => {
        return action.priority < lowest ? action.priority : lowest;
    }, actionsArray[0].priority);
}

function hasPlan(note) {
    if (note.hasPlan) return true;
    const hasPlan =
        note.headings &&
        note.headings[0] &&
        note.headings[0].text == "Plan" &&
        note.headings[0].line == 0;
    if (hasPlan) //console.log(note.headings[0]);
    return hasPlan;
}

function setFontByLength(el) {
    const len = el.textContent.length;
    let size = "14px";
    if (len > 4) size = "13px";
    if (len > 5) size = "12px";
    if (len > 6) size = "11px";
    if (len > 7) size = "10px";
    el.style.fontSize = size;
}

function numberToColor(num, alpha = 0.5) {
    if (num === 'x') return `rgba(180,180,180,0.3)`; // grey for done
    let normalized = num / 99;
    if (num < 0 || num > 99) return `rgba(60,60,60,0.3)`;

    let red = 0, green = 0, blue = 0;
    if (normalized < 0.25) {
        red = 255; green = Math.round(normalized * 4 * 150); blue = 0;
    } else if (normalized >= 0.25 && normalized < 0.5) {
        red = 255 - Math.round((normalized - 0.25) * 4 * 255);
        green = 150; blue = 0;
    } else if (normalized > 0.5 && normalized < 0.75) {
        red = 0; green = 150; blue = Math.round((normalized - 0.5) * 4 * 255);
    } else if (normalized > 0.75) {
        red = 0; green = 150 - Math.round((normalized - 0.75) * 4 * 150); blue = 255;
    }
    return `rgba(${red},${green},${blue},${alpha})`;
}
