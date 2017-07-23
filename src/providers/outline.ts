import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

import { Extension } from './../main'

export class SectionNodeProvider implements vscode.TreeDataProvider<Section> {
    private _onDidChangeTreeData: vscode.EventEmitter<Section | undefined> = new vscode.EventEmitter<Section | undefined>()
    readonly onDidChangeTreeData: vscode.Event<Section | undefined> = this._onDidChangeTreeData.event

    // our data source is a set multi-rooted set of trees
    private ds: Section[] = []

    constructor(private extension: Extension) {
        // TODO: Should outline have its own file watcher?
        if (extension.manager.fileWatcher !== undefined){
            extension.manager.fileWatcher.on('change', (path: string) => {
                        this.extension.logger.addLogMessage(`[outline]: responding to change in ${path}`)
                        this.refresh()
                    })
        }
    }

    refresh() : Section[] {

        this.ds = this.buildModel(this.extension.manager.rootFile)
        this._onDidChangeTreeData.fire()

        return this.ds
    }

    findLineNumber(content: string, index: number){
        const prevContent = content.substring(0, index);
        return (prevContent.match(/\n/g) || []).length;
    }

    buildModel(filePath: string) : Section[] {
        this.extension.logger.addLogMessage(`Parsing ${filePath}`)
        
        let sections: Section[] = [];

        // Get the contents of the file
        const content = fs.readFileSync(filePath, 'utf-8')

        // Establish patterns for the searches
        const basicPattern = /^[ \t]*\[([\w\d_,\s]+)\][ \t]*$/gm

        while(true){
            const result = basicPattern.exec(content);
            if (!result) break;

            const lineNumber = this.findLineNumber(content, result.index);
            const labels = result[1];
            const splits = labels.split(',');

            // comma-separated array for basic definitions in Z
            for(let s of splits){
                const newSection = new Section(s, vscode.TreeItemCollapsibleState.Collapsed, lineNumber, filePath);
                sections.push(newSection);
            }
        }

        // Get Schema Definitions
        const schemaPattern = /^[ \t]*\\begin\{schema\}\{([\w\d_]+)\}[ \t]*$/gmi
        while(true){
            const result = schemaPattern.exec(content);
            if (!result) break;
            const lineNumber = this.findLineNumber(content, result.index);
            const label = result[1];
            const newSection = new Section(label, vscode.TreeItemCollapsibleState.Collapsed, lineNumber, filePath);
                sections.push(newSection);
        }

        return sections;
    }

    getTreeItem(element: Section) : vscode.TreeItem {
        return element;
    }

    getChildren(element?: Section) : Thenable<Section[]> {

        // if the root doesn't exist, we need
        // to explicitly build the model from disk
        if (!element) {
            return Promise.resolve(this.refresh())
        }

        return Promise.resolve(element.children)
    }
}

class Section extends vscode.TreeItem {

    public children: Section[] = []
    public command: vscode.Command

    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        lineNumber: number,
        fileName: string
    ) {
        super(label, collapsibleState)

        this.command = {
            "command": 'zed-workshop.goto-section',
            "title": '',
            "arguments":[fileName, lineNumber]
        }
    }

    iconPath = {
        light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'Section.svg'),
        dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'Section.svg')
    }

    contextValue = 'Section'
}
