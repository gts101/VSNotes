const path = require('path');

function parseNote(filePath, markdown) {
    const note = {
        filePath,
        title: path.basename(filePath),
        markdown,
        headings: [],
        actions: [],
        datestamps: [],
        links: [],
        outgoingMentions: [],  // notes this note references
        incomingMentions: []   // notes that reference this note
    };

    const lines = markdown.split(/\r?\n/);
    let headingStack = [];
    let offset = 0;

    lines.forEach((line, lineNumber) => {
        const lineStart = offset;
        const lineEnd = offset + line.length;

        // ----- Headings -----
        const headingMatch = /^(#{1,6})\s+(.*)/.exec(line);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const text = headingMatch[2].trim();
            const charBegin = line.indexOf(text);
            const charEnd = charBegin + text.length;

            // Close previous headings if needed
            while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
                const h = headingStack.pop();
                h.contentEnd = lineStart - 1;
                h.headingContent = markdown.slice(h.contentBegin, h.contentEnd);
            }

            const heading = {
                level,
                text,
                line: lineNumber,
                charBegin,
                charEnd,
                contentBegin: lineEnd + 1,
                contentEnd: null,
                headingContent: null
            };

            headingStack.push(heading);
            note.headings.push(heading);
        }

        // ----- Actions [0-99 or x] -----
        const actionMatch = /^\[(\d{1,2}|x)\]\s*(.*)/.exec(line.trim());
        if (actionMatch) {
            note.actions.push({
                raw: line.trim(),
                text: actionMatch[2].trim(),
                priority: actionMatch[1] === 'x' ? 'x' : parseInt(actionMatch[1], 10),
                status: actionMatch[1] === 'x' ? 'done' : 'active',
                line: lineNumber,
                charBegin: line.indexOf(actionMatch[0]),
                charEnd: line.indexOf(actionMatch[0]) + actionMatch[0].length,
                headingId: headingStack.length ? note.headings.indexOf(headingStack[headingStack.length - 1]) : null,
                filePath
            });
        }
//const dateRegex = /\b(?:Next|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2} \d{4})\b/g;
        
        // ----- Dates (human-readable) -----
        //capture dates like `Jan 2 2026`, or `Mar 19 2024`, or `Next`
        //only at the start of a line...
        //const dateRegex = /^(?:Next|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2} \d{4})/gm;

       // const dateRegex = /^(#{1,4})\s+(Next|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{4})\b/gm;

        const dateRegex = /^(?:#{1,4}\s+)?(Next|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{4})\b/gm;

        let dateMatch;
        while ((dateMatch = dateRegex.exec(line)) !== null) {

            const isoDate=getISODateFromMarkdown(dateMatch[0]);
            note.datestamps.push({
                value: dateMatch[0],
                isoDate,
                line: lineNumber,
                charBegin: dateMatch.index,
                charEnd: dateMatch.index + dateMatch[0].length,
                headingId: headingStack.length ? note.headings.indexOf(headingStack[headingStack.length - 1]) : null,
                filePath
            });

            if(dateMatch[0]=='Next'){
            }
        }

        // ----- External Links -----
        const linkRegex = /(https?:\/\/[^\s]+)/g;
        let linkMatch;
        while ((linkMatch = linkRegex.exec(line)) !== null) {
            note.links.push({
                url: linkMatch[0],
                line: lineNumber,
                charBegin: linkMatch.index,
                charEnd: linkMatch.index + linkMatch[0].length,
                headingId: headingStack.length ? note.headings.indexOf(headingStack[headingStack.length - 1]) : null
            });
        }
        offset += line.length + 1; // account for newline
    });

    // Close any remaining headings
    const fileLength = markdown.length;
    while (headingStack.length) {
        const h = headingStack.pop();
        h.contentEnd = fileLength;
        h.headingContent = markdown.slice(h.contentBegin, h.contentEnd);
    }
    return note;
}


function getISODateFromMarkdown(str){
  let d;
  if (str === "Next") {
    d = new Date();
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d = new Date(str);
  }
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
}

module.exports = {
    parseNote
};