//GLOBALS
mockActions = [
    { "raw": "[3] speak to Robin about desk moves", "text": "speak to Robin about desk moves", "priority": 3, "status": "active", "line": 101, "charBegin": 0, "charEnd": 40, "headingId": 8, "filePath": "Operations.md" },
    { "raw": "[12] book a meeting to discuss Q3 hiring plans", "text": "book a meeting to discuss Q3 hiring plans", "priority": 12, "status": "active", "line": 102, "charBegin": 0, "charEnd": 51, "headingId": 8, "filePath": "HR.md" },
    { "raw": "[27] follow up with IT about VPN access delays", "text": "follow up with IT about VPN access delays", "priority": 27, "status": "active", "line": 103, "charBegin": 0, "charEnd": 49, "headingId": 9, "filePath": "Infrastructure.md" },
    { "raw": "[45] prepare slides for Monday leadership update", "text": "prepare slides for Monday leadership update", "priority": 45, "status": "active", "line": 104, "charBegin": 0, "charEnd": 50, "headingId": 9, "filePath": "Management.md" },
    { "raw": "[8] review contractor onboarding checklist", "text": "review contractor onboarding checklist", "priority": 8, "status": "active", "line": 105, "charBegin": 0, "charEnd": 43, "headingId": 10, "filePath": "HR.md" },
    { "raw": "[66] organise catering for client workshop", "text": "organise catering for client workshop", "priority": 66, "status": "active", "line": 106, "charBegin": 0, "charEnd": 43, "headingId": 10, "filePath": "Events.md" },
    { "raw": "[91] update project timeline after vendor feedback", "text": "update project timeline after vendor feedback", "priority": 91, "status": "active", "line": 107, "charBegin": 0, "charEnd": 49, "headingId": 11, "filePath": "Projects.md" },
    { "raw": "[34] send budget draft to finance team", "text": "send budget draft to finance team", "priority": 34, "status": "active", "line": 108, "charBegin": 0, "charEnd": 38, "headingId": 11, "filePath": "Finance.md" },
    { "raw": "[19] check meeting room availability for workshop", "text": "check meeting room availability for workshop", "priority": 19, "status": "active", "line": 109, "charBegin": 0, "charEnd": 48, "headingId": 12, "filePath": "Facilities.md" },
    { "raw": "[72] draft announcement for system maintenance window", "text": "draft announcement for system maintenance window", "priority": 72, "status": "active", "line": 110, "charBegin": 0, "charEnd": 54, "headingId": 12, "filePath": "IT.md" },
    { "raw": "[5] confirm travel arrangements for Sydney visit", "text": "confirm travel arrangements for Sydney visit", "priority": 5, "status": "active", "line": 111, "charBegin": 0, "charEnd": 48, "headingId": 13, "filePath": "Travel.md" },
    { "raw": "[58] review supplier contract renewal terms", "text": "review supplier contract renewal terms", "priority": 58, "status": "active", "line": 112, "charBegin": 0, "charEnd": 44, "headingId": 13, "filePath": "Procurement.md" },
    { "raw": "[0] finalise incident response action items", "text": "finalise incident response action items", "priority": 0, "status": "active", "line": 113, "charBegin": 0, "charEnd": 45, "headingId": 14, "filePath": "Security.md" },
    { "raw": "[84] coordinate laptop replacements with support team", "text": "coordinate laptop replacements with support team", "priority": 84, "status": "active", "line": 114, "charBegin": 0, "charEnd": 55, "headingId": 14, "filePath": "IT.md" },
    { "raw": "[39] chase approvals for marketing spend request", "text": "chase approvals for marketing spend request", "priority": 39, "status": "active", "line": 115, "charBegin": 0, "charEnd": 49, "headingId": 15, "filePath": "Marketing.md" },
    { "raw": "[23] update onboarding documentation for new starters", "text": "update onboarding documentation for new starters", "priority": 23, "status": "active", "line": 116, "charBegin": 0, "charEnd": 54, "headingId": 15, "filePath": "HR.md" },
    { "raw": "[97] schedule retrospective for mobile app release", "text": "schedule retrospective for mobile app release", "priority": 97, "status": "active", "line": 117, "charBegin": 0, "charEnd": 50, "headingId": 16, "filePath": "Product.md" },
    { "raw": "[14] review accessibility feedback from QA team", "text": "review accessibility feedback from QA team", "priority": 14, "status": "active", "line": 118, "charBegin": 0, "charEnd": 47, "headingId": 16, "filePath": "Development.md" },
    { "raw": "[63] prepare talking points for stakeholder briefing", "text": "prepare talking points for stakeholder briefing", "priority": 63, "status": "active", "line": 119, "charBegin": 0, "charEnd": 51, "headingId": 17, "filePath": "Communications.md" },
    { "raw": "[50] investigate duplicate invoice issue in finance system", "text": "investigate duplicate invoice issue in finance system", "priority": 50, "status": "active", "line": 120, "charBegin": 0, "charEnd": 58, "headingId": 17, "filePath": "Finance.md" }
];

mockActions.sort((a, b) => a.priority - b.priority);

const sorterDiv = document.getElementById('sorterDiv');
const template = document.getElementById('actionTemplate');

let vscode = null;
let browserDevMode = false;

const ITEM_HEIGHT = 22;

let actions = [...mockActions];
let elements = [];

let didDrag = false;
let draggedElement = null;
let draggedIndex = -1;
let dragOffsetY = 0;

// Detect VSCode environment
document.addEventListener('DOMContentLoaded', () => {
    console.log('The DOM is ready!');

    //do we have a vscode connection?
    if (typeof acquireVsCodeApi !== 'undefined') {
        browserDevMode = false;
        vscode = acquireVsCodeApi();
        vscode.postMessage({ type: 'ready' });
    } else {
        browserDevMode = true;
        vscode = {
            postMessage: (msg) => console.log('Mock message:', msg)
        };
        renderActions();
    }
});


window.addEventListener('message', event => {
    //console.log('>>>>>actionsSorter received:', event.data);
    const message = event.data;
    if (message.type === 'actionsList') {
        actions = message.actions;
        //actions.sort((a, b) => a.priority - b.priority);
        actions.sort((a, b) => {
            // 1. Sort by priority (numerical)
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            // 2. If priorities are equal, sort by path (alphabetical)
            return a.filePath.localeCompare(b.filePath);
        });
        renderActions();
    }
    if (message.type === 'applyActionsSorting') {
        saveChanges();
    }

    if (message.type === 'normaliseActionPriorities') {
        normaliseActionPriorities();
    }

    
});

function normaliseActionPriorities() {
    const count = actions.length;
    console.log("count", count);
    if (count === 1) {
        actions[0].originalPriority=actions[0].priority;
        actions[0].priority = 0;
    } else {
        actions.forEach((action, index) => {
            action.originalPriority=action.priority;
            action.priority = Math.round((index / (count - 1)) * 99);
        });
    }
    renderActions();
}

function applyActionsSorting() {
    const changedActions = actions.filter(a => a.moved);
    changedActions.forEach(action => {
        const index = actions.indexOf(action);
        const prev = actions[index - 1] || null;
        const next = actions[index + 1] || null;
        action.priority = assignPriority(prev, next);
        //action.moved = false;
    });
    renderActions();
}


function assignPriority(prevItem, nextItem) {

    // Only item in list
    if (!prevItem && !nextItem) {
        return 0;
    }

    // Moved to top
    if (!prevItem) {
        return 0;
    }

    // Moved to bottom
    if (!nextItem) {
        return 99;
    }

    const prev = prevItem.priority;
    const next = nextItem.priority;

    // Same priority
    if (prev === next) {
        return prev;
    }

    // Midpoint
    return Math.round((prev + next) / 2);
}


function saveChanges() {
    console.log("let's edit local files programmatically!"); //what could possibly go wrong?
    //pass a message back to VSCode to update files one by one

    vscode.postMessage({
        type: 'updateActionPriorities',  //TODO change this to 'actionClicked'
        actions: actions
    });
}

function renderActions() {
    if (draggedElement) return;
    draggedIndex = -1;

    sorterDiv.innerHTML = '';
    elements = [];
    sorterDiv.style.position = 'relative';
    sorterDiv.style.height = (actions.length * ITEM_HEIGHT) + 'px';
    actions.forEach((action, index) => {
        const div = template.cloneNode(true);
        div.removeAttribute('id');
        div.classList.remove("template");

        //add values
        const path = action.filePath.replace(".md", "");
        //remove leading slashes
        const lastSlashIndex = path.lastIndexOf('/');
        const actionPath = path.substring(lastSlashIndex + 1).replace(".md", "");
        const headings = "heading" + action.headingId;
        const actionHtml = "<span class='actionPath'>" + actionPath + " &gt; </span>" + action.text;

        div.querySelector('.actionText').innerHTML = actionHtml;
        div.querySelector('.actionPriority').textContent = action.priority;

        //action color
        const col = numberToColor(action.priority, 0.5);
        //show external actions with a hollow priority
        if (action.externalAction) {
            div.querySelector('.actionPriority').style.border = '2px solid ' + col;
        } else {
            div.querySelector('.actionPriority').style.backgroundColor = col;
        }

        div.style.top = (index * ITEM_HEIGHT) + 'px';
        div.actionRef = action;
        //event listener for dragging
        div.addEventListener('mousedown', (e) => {
            startDrag(e, div);
        });
        div.title=actionPath + " > " + action.text;
        //add to the container div
        sorterDiv.appendChild(div);
        elements.push(div);
    });
}



function startDrag(e, div) {
    didDrag = false;
    draggedElement = div;
    draggedIndex = elements.indexOf(div);
    const rect = div.getBoundingClientRect();
    dragOffsetY = e.clientY - rect.top;
    div.classList.add('dragging');
    div.style.transition = 'none';
    div.style.zIndex = '1000';
    div.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
}




function onDrag(e) {
    if (!draggedElement) return;
    didDrag = true;
    const sorterDiv = document.getElementById('sorterDiv');
    const rect = sorterDiv.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    draggedElement.style.top = (mouseY - dragOffsetY) + 'px';
    let targetIndex = Math.floor(mouseY / ITEM_HEIGHT);
    targetIndex = Math.max(0, targetIndex);
    targetIndex = Math.min(actions.length - 1, targetIndex);
    if (targetIndex !== draggedIndex) {
        // reorder actions
        const movedAction = actions.splice(draggedIndex, 1)[0];
        movedAction.moved = true;
        movedAction.originalPriority ??= movedAction.priority;
        actions.splice(targetIndex, 0, movedAction);
        // reorder DOM references
        const movedElement = elements.splice(draggedIndex, 1)[0];
        elements.splice(targetIndex, 0, movedElement);
        draggedIndex = targetIndex;
        updatePositions();
    }
}

function updatePositions() {
    elements.forEach((el, index) => {
        if (el === draggedElement) return;

        el.style.top = (index * ITEM_HEIGHT) + 'px';
    });
}

function stopDrag() {
    if (!draggedElement) return;
    draggedElement.style.transition = 'top 0.15s';
    draggedElement.style.zIndex = '1';
    draggedElement.style.cursor = 'grab';
    draggedElement.style.top = (draggedIndex * ITEM_HEIGHT) + 'px';
    draggedElement.classList.remove('dragging');


    //click or reorder?
    if (!didDrag) {
        console.log("clic!", draggedElement.actionRef);
        vscode.postMessage({
            type: 'openAction',  //TODO change this to 'actionClicked'
            action: draggedElement.actionRef
        });
    } else {
        vscode.postMessage({
            type: 'actionMoved',
            actions
        });
        draggedElement.classList.add('actionMoved');

    }

    //tidy up
    draggedElement = null;
    draggedIndex = -1;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);

    applyActionsSorting();
}

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
    if (backgroundNumber > 3) backgroundNumber = 1;
    updateBackground();
}
function updateBackground() {
    document.body.classList = [];
    document.body.classList.add("bg" + backgroundNumber);
}
updateBackground();



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
