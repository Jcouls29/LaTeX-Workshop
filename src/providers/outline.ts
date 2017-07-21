import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

import { Extension } from './../main'


export class SectionNodeProvider implements vscode.TreeDataProvider<Section> {

    private _onDidChangeTreeData: vscode.EventEmitter<Section | undefined> = new vscode.EventEmitter<Section | undefined>()
    readonly onDidChangeTreeData: vscode.Event<Section | undefined> = this._onDidChangeTreeData.event
    private hierarchy: string[]
    private sectionDepths: {string?: number} = {}

    // our data source is a set multi-rooted set of trees
    private ds: Section[] = []

    constructor(private extension: Extension) {
        const configuration = vscode.workspace.getConfiguration('zed-workshop')
        this.hierarchy = configuration.get('view.outline.sections') as string[]
        this.hierarchy.forEach((section, index) => {
            section.split('|').forEach(sec => {
                this.sectionDepths[sec] = index
            })
        })

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

    buildModel(filePath: string, parentStack?: Section[], parentChildren?: Section[]) : Section[] {

        let rootStack: Section[] = []
        if (parentStack) {
            rootStack = parentStack
        }

        let children: Section[] = []
        if (parentChildren) {
            children = parentChildren
        }

        const currentRoot = () => {
            return rootStack[rootStack.length - 1]
        }
        const noRoot = () => {
            return rootStack.length === 0
        }

        this.extension.logger.addLogMessage(`Parsing ${filePath}`)
        //console.log(`Parsing ${filePath}`)
        const content = fs.readFileSync(filePath, 'utf-8')

        let pattern = "^((?:\\\\(?:input|include|subfile)(?:\\[[^\\[\\]\\{\\}]*\\])?){([^}]*)})|^((?:\\\\("
        this.hierarchy.forEach((section, index) => {
            pattern += section
            if (index < this.hierarchy.length - 1) {
                pattern += '|'
            }
        })
        pattern += ")(?:\\*)?(?:\\[[^\\[\\]\\{\\}]*\\])?){([^}]*)})"

        // const inputReg = /^((?:\\(?:input|include|subfile)(?:\[[^\[\]\{\}]*\])?){([^}]*)})|^((?:\\((sub)?section)(?:\[[^\[\]\{\}]*\])?){([^}]*)})/gm
        const inputReg = RegExp(pattern, 'gm')

        // if it's a section elements 4 = section
        // element 6 = title.

        // if it's a subsection:
        // element X = title

        // if it's an input, include, or subfile:
        // element 2 is the file (need to resolve the path)
        // element 0 starts with \input, include, or subfile

        while (true) {
            const result = inputReg.exec(content)
            if (!result) {
                break
            }

            if (result[4] in this.sectionDepths) {
                // is it a section, a subsection, etc?
                const heading = result[4]
                const title = result[5]
                const depth = this.sectionDepths[heading]

                const prevContent = content.substring(0, content.substring(0, result.index).lastIndexOf('\n') - 1)

                // get a  line number
                const lineNumber = (prevContent.match(/\n/g) || []).length

                const newSection = new Section(title, vscode.TreeItemCollapsibleState.Expanded, depth, lineNumber, filePath)

                // console.log("Created New Section: " + title)
                if (noRoot()) {
                    children.push(newSection)
                    rootStack.push(newSection)
                    continue
                }

                // Find the proper root section
                while (!noRoot() && currentRoot().depth >= depth) {
                    rootStack.pop()
                }
                if (noRoot()) {
                    children.push(newSection)
                } else {
                    currentRoot().children.push(newSection)
                }
                rootStack.push(newSection)

                // if this is the same depth as the current root, append to the children array
                // i.e., at this level
                // if (depth === currentRoot().depth) {
                //     rootStack.push(newSection)
                // }

                // if (depth === 0) {
                //     children.push(newSection)
                // } else if (depth < currentRoot().depth) { // it's one level UP
                //     rootStack.pop()
                //     currentRoot().children.push(newSection)
                // } else { // it's one level DOWN (add it to the children of the current node)
                //     currentRoot().children.push(newSection)
                // }
            } else if (result[0].startsWith("\\input") || result[0].startsWith("\\include") || result[0].startsWith("\\subfile")) {
                // zoom into this file
                // resolve the path
                let inputFilePath = path.resolve(path.join(this.extension.manager.rootDir, result[2]))

                if (path.extname(inputFilePath) === '') {
                    inputFilePath += '.zed'
                }
                if (!fs.existsSync(inputFilePath) && fs.existsSync(inputFilePath + '.zed')) {
                    inputFilePath += '.zed'
                }
                if (fs.existsSync(inputFilePath) === false) {
                    this.extension.logger.addLogMessage(`Could not resolve included file ${inputFilePath}`)
                    //console.log(`Could not resolve included file ${inputFilePath}`)
                    continue
                }

                this.buildModel(inputFilePath, rootStack, children)
            }
        }
        return children
    }

    getTreeItem(element: Section) : vscode.TreeItem {

        const hasChildren = element.children.length > 0
        const treeItem: vscode.TreeItem = new vscode.TreeItem(element.label, hasChildren ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None)

        treeItem.command = {
            command: 'zed-workshop.goto-section',
            title: '',
            arguments: [element.fileName, element.lineNumber]
        }

        return treeItem
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

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly depth: number,
        public readonly lineNumber: number,
        public readonly fileName: string,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState)

    }

    iconPath = {
        light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'Section.svg'),
        dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'Section.svg')
    }

    contextValue = 'Section'

}
