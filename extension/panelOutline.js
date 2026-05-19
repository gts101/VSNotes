//const vscode = acquireVsCodeApi();
let vscode = null;

// Detect VSCode environment
if (typeof acquireVsCodeApi !== 'undefined') {
    vscode = acquireVsCodeApi();
} else {
    // Browser fallback
    vscode = {
        postMessage: (msg) => console.log('Mock message:', msg)
    };
}


// function updateClock() {
//     const now = new Date();
//     document.getElementById('clock').textContent = now.toLocaleTimeString();
// }
// setInterval(updateClock, 1000);
// updateClock();



document.addEventListener('DOMContentLoaded', () => {
    vscode.postMessage({ type: 'webviewReady(outline)' });
    //showNoteOutline(null);
});

window.addEventListener('message', event => {
    //console.log('panel received:', event.data);
    const message = event.data;
    if (message.type === 'structuredOutlineData') {
        //console.log('structuredOutlineData:', message.note);
        //document.getElementById("log").textContent=JSON.stringify(message.note, null, 2);
        showNoteOutline(message.note);
        //console.log('structuredOutlineData:', message.notes);
        showNotesOptions(message.note, message.notes);
    }
});


function showNoteOutline(note) {
    if (!note) {
        note = {
            "filePath": "0.md",
            "title": "0",
            "markdown": "",
            "headings": [],
            "actions": [],
            "datestamps": [],
            "links": [],
            "outgoingMentions": [],
            "incomingMentions": []
        }
    }

    const tree = buildHeadingTree(note.headings);
    const actionsMap = indexByHeadingId(note.actions);
    const datesMap = indexByHeadingId(note.datestamps);

    // aggregate chips
    const { aggActions, aggDates } = buildAggregatedMaps(tree, actionsMap, datesMap);
    renderOutline(
        document.getElementById('outline'),
        tree,
        aggActions,
        aggDates,
        (node) => {
            //console.log('Jump to heading:', node);
            vscode.postMessage({ type: 'openSection', section: node });
        }
    );
}


function indexByHeadingId(items) {
    const map = new Map();
    items.forEach(item => {
        if (!map.has(item.headingId)) {
            map.set(item.headingId, []);
        }
        map.get(item.headingId).push(item);
    });
    return map;
}

function renderOutline(container, tree, actionsMap, datesMap, onHeadingClick) {
    container.innerHTML = '';
    const ul = document.createElement('ul');
    container.appendChild(ul);

    tree.forEach(node => {
        ul.appendChild(renderNode(node, actionsMap, datesMap, onHeadingClick));
    });
}

function renderNode(node, actionsMap, datesMap, onHeadingClick) {
    const li = document.createElement('li');

    const row = document.createElement('div');
    row.classList.add('outlineRow');
    row.classList.add("level" + node.level);
    row.style.display = 'flex';
    row.style.alignItems = 'center';

    // Arrow
    const arrow = document.createElement('span');
    if (!node.children.length) {
        arrow.textContent = '–';
    } else {
        arrow.textContent = node.expanded ? '–' : '+';
    }

    arrow.style.cursor = node.children.length ? 'pointer' : 'default';
    arrow.style.width = '1.2em';

    arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!node.children.length) return;

        node.expanded = !node.expanded;
        arrow.textContent = node.expanded ? '–' : '+';

        if (node.expanded) {
            childContainer.style.display = 'block';
        } else {
            childContainer.style.display = 'none';
        }
    });

    row.appendChild(arrow);

    // Heading text
    const text = document.createElement('span');
    text.classList.add('outlineText');
    text.textContent = node.text;
    text.classList.add("outlineItem");
    text.style.cursor = 'pointer';

    text.addEventListener('click', () => {
        onHeadingClick(node);
    });

    row.appendChild(text);

    // Metadata (actions + datestamps)
    const meta = document.createElement('span');
    meta.classList.add('outlineMeta');
    meta.style.marginLeft = '8px';


    const actions = actionsMap.get(node.id) || [];
    const dates = datesMap.get(node.id) || [];

    // Render each action
    actions.forEach(action => {

        const isLocal = action.headingId === node.id;
        if (action.externalAction) {
            //do not show
        } else {
            const aIcon = document.createElement('span');
            aIcon.innerHTML = "&nbsp;";//action.priority;
            aIcon.title = action.text;
            const col = numberToColor(action.priority);
            const col2 = numberToColor(action.priority, 1);
            aIcon.style.backgroundColor = col;
            aIcon.style.border = "2px solid " + col2;
            aIcon.classList.add("chip");
            aIcon.classList.add("action");

            if (!isLocal) {
                aIcon.classList.add("inherited");
            }


            aIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                //console.log('Jump to action:', action);
                vscode.postMessage({ type: 'openAction', action: action });
            });

            meta.appendChild(aIcon);
        }
    });

    // Render each datestamp
    dates.forEach(date => {
        const dt = new Date(date.value);
        const age = getDayDifference(dt);
        const col = getDatestampColour(dt);
        const col2 = getDatestampColour(dt, "FF");

        const isLocal = date.headingId === node.id;

        //console.log("date", dt, age);
        if (age > 0) {
            //do not show...
        } else {
            const dIcon = document.createElement('span');
            dIcon.classList.add("chip");
            dIcon.innerHTML = "&nbsp;";
            dIcon.style.backgroundColor = col;
            dIcon.style.border = "2px solid " + col2;
            dIcon.title = date.value;

            if (!isLocal) {
                dIcon.classList.add("inherited");
            }

            dIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                //console.log('Jump to datestamp:', date);
                vscode.postMessage({ type: 'openDateStamp', datestamp: date });
            });

            meta.appendChild(dIcon);
        }
    });


    row.appendChild(meta);

    li.appendChild(row);

    // Children container
    const childContainer = document.createElement('ul');
    childContainer.style.display = node.expanded ? 'block' : 'none';
    childContainer.style.marginLeft = '16px';

    node.children.forEach(child => {
        childContainer.appendChild(
            renderNode(child, actionsMap, datesMap, onHeadingClick)
        );
    });

    li.appendChild(childContainer);

    return li;
}


function buildHeadingTree(headings) {
    const root = { children: [] };
    const stack = [{ level: 0, node: root }];

    headings.forEach((h, index) => {
        const node = {
            ...h,
            id: index,
            children: [],
            expanded: h.level === 1,
            level: h.level
        };

        while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
            stack.pop();
        }

        stack[stack.length - 1].node.children.push(node);
        stack.push({ level: h.level, node });
    });

    return root.children;
}





function buildAggregatedMaps(tree, actionsMap, datesMap) {
    const aggActions = new Map();
    const aggDates = new Map();

    function dfs(node) {
        // Start with own items
        let actions = [...(actionsMap.get(node.id) || [])];
        let dates = [...(datesMap.get(node.id) || [])];

        // Add children items
        node.children.forEach(child => {
            const childResult = dfs(child);
            actions = actions.concat(childResult.actions);
            dates = dates.concat(childResult.dates);
        });

        aggActions.set(node.id, actions);
        aggDates.set(node.id, dates);

        return { actions, dates };
    }

    tree.forEach(rootNode => dfs(rootNode));

    return { aggActions, aggDates };
}


///////////////////////////////////////////////
// drop downs

function showNotesOptions(note, notes) {
    let filePath="";
    //console.log("note:",note);
    if(note && note.filePath){
        filePath=note.filePath;
    }
    //console.log("filePath:",filePath);
        
    //initialise some strings...
    topicsOptions='<option>TOPICS</option>';
    peopleOptions='<option>PEOPLE</option>';

    //iterate thru notes, add to strings
    notes.forEach(function(n){
        if(n.filePath.indexOf("/people/")>-1){
             peopleOptions+=getOption(n, filePath); 
        }
        if(n.filePath.indexOf("/topics/")>-1){
            topicsOptions+=getOption(n, filePath);
        } 
    });

    //SET HTML from strings!
    setHTML('topicsList', topicsOptions);
    setHTML('peopleList', peopleOptions);

}
function select(el){
    const path=el.value;
    //console.log('selected note:', path);
    if(path && path.length>0 && el.selectedIndex>0){
        el.selectedIndex = 0;
        vscode.postMessage({ type: 'openNote', path: path });
    }
};


function setHTML(id, val){
    document.getElementById(id).innerHTML=val;
}

function getOption(n, filePath){
    //start option tag with value
    let selected="";
    if(n.filePath==filePath){
        selected=" selected";
    }
    let html='<option value="' + n.filePath + '"' +selected + '>';

    let actionsCount=0;
    let actions=[];
    if(n.actions && n.actions.length>0){
         actions = n.actions.filter(a => a.status !== 'done');
         actions = actions.filter(a => !a.externalAction);
         actionsCount=actions.length;
    }
    actions.sort((a, b) => {return a.priority - b.priority; })

    //pick icon....
    //others  ? ⚫📌📍➡⭐🌟🌀📁📂🗂📅📈
    //actions ? 🔴🟠🟡🟢🔵  
    //people  ? 🟣👤🛑
    //arrows  ? ⬆↗➡↘⬇↙⬅↖↕↔↩↪⤴⤵
    //symbols ? ▶
    //more    ? ⭕✅☑✔❌❎ ✳✴❇©®🫟	🏴󠁧󠁢󠁳󠁣󠁴󠁿

    let icon=" ";
    if(n.filePath.indexOf("/people/")>-1) icon="👤"; 
    if(n.filePath.indexOf("/topics/")>-1) icon="⭐";

    //add title (strip off .md extension)
    html+=icon+" "+n.title.replace(".md","")+" ";
    
    //add acion counter
    if (actionsCount>0){
        let actionIcons="";
        const icons=["🔴","🟠","🟡","🟢","🔵"];
        actions.forEach(function(a){
            let n;
            if(a.priority>=0) n=0;
            if(a.priority>20) n=1;
            if(a.priority>40) n=2;
            if(a.priority>60) n=3;
            if(a.priority>80) n=4;
            if(n>=0 && n<5){
                const icon=icons[n];
                actionIcons+=icon;
            }
        });
        html += actionIcons;
    }
    //close tag
    html+="</option>";
    return html;
}

