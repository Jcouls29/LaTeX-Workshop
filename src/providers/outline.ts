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
        const basicPattern = /^[ \t]*\[([\w\d_,\s]+)\]/gm
        const basicTypesSection = new Section('Basic Types');
        while(true){
            const result = basicPattern.exec(content);
            if (!result) break;

            const lineNumber = this.findLineNumber(content, result.index);
            const labels = result[1];
            const splits = labels.split(',');

            // comma-separated array for basic definitions in Z
            for(let s of splits){
                const newSection = new Section(s.trim(), lineNumber, filePath);
                basicTypesSection.children.push(newSection);
            }
        }
        if(basicTypesSection.children.length > 0) {
            basicTypesSection.children.sort((n1, n2) => n1.label.localeCompare(n2.label))
            sections.push(basicTypesSection);
        }

        // Get Schema Definitions
        const schemaPattern = /^[ \t]*\\begin\{schema\}\{([\w\d_ ,\[\]]+)\}/gmi
        const schemaSection = new Section('Schemas')
        while(true){
            const result = schemaPattern.exec(content);
            if (!result) break;
            const lineNumber = this.findLineNumber(content, result.index);
            const label = result[1];
            const newSection = new Section(label, lineNumber, filePath);
            schemaSection.children.push(newSection);
        }
        if (schemaSection.children.length > 0) {
            schemaSection.children.sort((n1, n2) => n1.label.localeCompare(n2.label))
            sections.push(schemaSection);
        }

        const axiomPattern = /^[ \t]*\\begin\{axdef\}([\s\S]+?)(\\end\{axdef\})/gmi
        const axiomSection = new Section('Axioms')
        while(true){
            const result = axiomPattern.exec(content);
            if (!result) break;

            const innerBlock = result[1];
            const innerPattern = /^[ \t]*([\w\d \t_,]+):/gmi
            while(true){
                const innerResult = innerPattern.exec(innerBlock);
                if (!innerResult) break;

                const lineNumber = this.findLineNumber(content, result.index + innerResult.index) + 1
                const labels = innerResult[1];
                const splits = labels.split(',');
                for(let s of splits){
                    const newSection = new Section(s.trim(), lineNumber, filePath)
                    axiomSection.children.push(newSection);
                }
            }
        }
        if (axiomSection.children.length > 0){
            axiomSection.children.sort((n1, n2) => n1.label.localeCompare(n2.label))
            sections.push(axiomSection);
        }

        const genPattern = /^[ \t]*\\begin\{gendef\}\s*?(\[[\w\d ,_]+\])/gmi
        const genSection = new Section('Generics')
        while(true){
            const result = genPattern.exec(content);
            if (!result) break;

            const lineNumber = this.findLineNumber(content, result.index);
            const label = result[1];
            const newSection = new Section(label.trim(), lineNumber, filePath)
            genSection.children.push(newSection);
        }
        if (genSection.children.length > 0){
            genSection.children.sort((n1, n2) => n1.label.localeCompare(n2.label));
            sections.push(genSection);
        }

        const listPattern = /^[ \t]*([\w\d_]+)\s*?::=/gm
        const listSection = new Section('Lists')
        while(true){
            const result = listPattern.exec(content);
            if (!result) break;

            const lineNumber = this.findLineNumber(content, result.index);
            const label = result[1];
            const newSection = new Section(label.trim(), lineNumber, filePath)
            listSection.children.push(newSection);
        }
        if (listSection.children.length > 0){
            listSection.children.sort((n1, n2) => n1.label.localeCompare(n2.label))
            sections.push(listSection);
        }

        const inlineSchemaPattern = /^[ \t]*([\w\d_]+)\s*? ==/gm
        const inlineSchemas = new Section('Schemas (Inline)')
        while(true){
            const result = inlineSchemaPattern.exec(content);
            if (!result) break;

            const lineNumber = this.findLineNumber(content, result.index);
            const label = result[1];
            const newSection = new Section(label.trim(), lineNumber, filePath)
            inlineSchemas.children.push(newSection);
        }
        if (inlineSchemas.children.length > 0){
            inlineSchemas.children.sort((n1, n2) => n1.label.localeCompare(n2.label))
            sections.push(inlineSchemas)
        }

        return sections.sort((n1, n2) => {
            if (n1.label > n2.label) return 1;
            if (n1.label < n2.label) return -1;
            return 0;
        });
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
        lineNumber?: number,
        fileName?: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed)

        if (fileName !== undefined && lineNumber !== undefined){
            this.command = {
                        "command": 'zed-workshop.goto-section',
                        "title": '',
                        "arguments":[fileName, lineNumber]
                    }
        }
        
    }

    iconPath = {
        light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'Section.svg'),
        dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'Section.svg')
    }

    contextValue = 'Section'
}
