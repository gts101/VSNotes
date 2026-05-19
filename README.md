# VSCode
## What?
A VSCode extension that: 
- parses simple markdown (md) files
- adds custom VSCode panels for:
    - ouline view with datestamps
    - actions view with sortable priority list

## Why?
- A need to be organised.
- A love of structured data, simplicity and connecting data.


## How?
- Simple javascript (no dependencies, no libraries)

### Custom Markdown
VSNotes extends standard markdown to allow:
- **Actions**, with a priority number from 0 (highest) to 99 (loewst) in square brackets, e.g. `[2] do something` is a high priority item.
- **Datestamp headings**, e.g., `### Jan 14 2026`. These are shown as 'date chips' in the custom outline view.


### Text Editor 'Decorations'
VSNotes adds visual cues to VSCode, e.g.:
- **Priority Colours** on actions
- **Simple Linking**, e.g., mentioning another markdown file creates an automatic link


### Data Structures
Markdown files are parsed into a `note` object, e.g.,
```
{
    filePath: "/folder/sentinel.md",
    title: "Sentinel"
    markdown: "# The Sentinel\n##Heading...",
    headings: []
    actions: []
    datestamps: []
    links: []
    formatting: []
    outgoingMentions: [],  // notes that this note references
    incomingMentions: []   // notes that reference this note
}
```

An `action` looks like:
```
{
    raw: "[2] do something!"
    text: "do something!",
    priority: 2,
    status: 'x|done|active',
    line: 112,
    charBegin: 0
    charEnd: 23,
    headingId: 1
    filePath: "/folder/sentinel.md"
}
```

## Who?
This is just a useful personal tool. If you share my requirements, you're welcome to use this (at your peril).

