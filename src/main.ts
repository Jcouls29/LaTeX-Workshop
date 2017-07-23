import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import * as opn from 'opn'

import {Logger, LogProvider} from './logger'
import * as comm from './Commands'
import {Manager} from './manager'
import {Builder} from './builder'
import {CodeActions} from './codeactions'
import {Viewer, PDFProvider} from './viewer'
import {Server} from './server'
import {Parser} from './parser'
import {Completer} from './completer'
import {Linter} from './linter'
import {SectionNodeProvider} from './providers/outline'
import { Command } from "./providers/command";

export const EXTENSION_ROOT: string = path.resolve(`${__dirname}/../../`);

function lintRootFileIfEnabled(extension: Extension) {
    const configuration = vscode.workspace.getConfiguration('zed-workshop')
    const linter = configuration.get('chktex.enabled') as boolean
    if (linter) {
        extension.linter.lintRootFile()
    }
}

function lintActiveFileIfEnabled(extension: Extension) {
    const configuration = vscode.workspace.getConfiguration('zed-workshop')
    const linter = configuration.get('chktex.enabled') as boolean
    if (linter) {
        extension.linter.lintActiveFile()
    }
}

function lintActiveFileIfEnabledAfterInterval(extension: Extension) {
    const configuration = vscode.workspace.getConfiguration('zed-workshop')
    const linter = configuration.get('chktex.enabled') as boolean
    if (linter) {
        const interval = configuration.get('chktex.interval') as number
        if (extension.linter.linterTimeout) {
            clearTimeout(extension.linter.linterTimeout)
        }
        extension.linter.linterTimeout = setTimeout(() => extension.linter.lintActiveFile(), interval)
    }
}

function obsoleteConfigCheck() {
    const configuration = vscode.workspace.getConfiguration('zed-workshop')
    function renameConfig(originalConfig: string, newConfig: string) {
        if (!configuration.has(originalConfig)) {
            return
        }
        const originalSetting = configuration.inspect(originalConfig)
        if (originalSetting && originalSetting.globalValue !== undefined) {
            configuration.update(newConfig, originalSetting.globalValue, true)
            configuration.update(originalConfig, undefined, true)
        }
        if (originalSetting && originalSetting.workspaceValue !== undefined) {
            configuration.update(newConfig, originalSetting.workspaceValue, false)
            configuration.update(originalConfig, undefined, false)
        }
    }
    renameConfig('zed.autoBuild.enabled', 'zed.autoBuild.onSave.enabled')
    renameConfig('viewer.zoom', 'view.pdf.zoom')
    renameConfig('viewer.hand', 'view.pdf.hand')
    if (configuration.has('version')) {
        configuration.update('version', undefined, true)
    }
}

function newVersionMessage(extensionPath: string, extension: Extension) {
    fs.readFile(`${extensionPath}${path.sep}package.json`, (err, data) => {
        if (err) {
            extension.logger.addLogMessage(`Cannot read package information.`)
            return
        }
        extension.packageInfo = JSON.parse(data.toString())
        extension.logger.addLogMessage(`Zed Workshop version: ${extension.packageInfo.version}`)
        if (fs.existsSync(`${extensionPath}${path.sep}VERSION`) &&
            fs.readFileSync(`${extensionPath}${path.sep}VERSION`).toString() === extension.packageInfo.version) {
            return
        }
        fs.writeFileSync(`${extensionPath}${path.sep}VERSION`, extension.packageInfo.version)
        vscode.window.showInformationMessage(`Zed Workshop updated to version ${extension.packageInfo.version}.`,
            'Change log', 'Star the project', 'Write review')
        .then(option => {
            switch (option) {
                case 'Change log':
                    opn('https://github.com/James-Yu/LaTeX-Workshop/blob/master/CHANGELOG.md')
                    break
                case 'Write review':
                    opn('https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop#review-details')
                    break
                case 'Star the project':
                    opn('https://github.com/James-Yu/LaTeX-Workshop')
                    break
                default:
                    break
            }
        })
    })
}

    function gotoSection(filePath: string, lineNumber: number) {
        vscode.workspace.openTextDocument(filePath).then((doc) => {
            vscode.window.showTextDocument(doc).then((_) => {
                //editor.selection = new vscode.Selection(new vscode.Position(lineNumber,0), new vscode.Position(lineNumber,0))
                vscode.commands.executeCommand("revealLine", { lineNumber: lineNumber, at: 'top'})
            })
        })

    }

export async function activate(context: vscode.ExtensionContext) {
    const extension = new Extension()

    // Defined available commands here
    // TODO: Move to a DI (IOC) Container
    let commands: comm.ICommand[] = [
        new comm.BuildCommand(extension.logger, extension.manager, extension.builder),
        new comm.ViewCommand(extension.logger, extension.manager, extension.viewer)
    ];

    for (let c of commands){
        vscode.commands.registerCommand(c.name, () => c.command());
    }

    vscode.commands.registerCommand('zed-workshop.goto-section', 
        (filePath, lineNumber) => gotoSection(filePath, lineNumber))

    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => {
        if (extension.manager.isTex(e.fileName)) {
            lintRootFileIfEnabled(extension)
        }
        const configuration = vscode.workspace.getConfiguration('zed-workshop')
        if (!configuration.get('zed.autoBuild.onSave.enabled') || extension.builder.disableBuildAfterSave) {
            return
        }
        if (extension.manager.isTex(e.fileName)) {
            vscode.commands.executeCommand('zed-workshop.build')
        }
    }))

    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((e: vscode.TextDocument) => {
        if (extension.manager.isTex(e.fileName)) {
            obsoleteConfigCheck()
            extension.manager.findRoot()
        }
    }))

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
        if (extension.manager.isTex(e.document.fileName)) {
            lintActiveFileIfEnabledAfterInterval(extension)
        }
    }))

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((e: vscode.TextEditor) => {
        if (!vscode.window.activeTextEditor) {
            extension.logger.status.hide()
        } else if (!vscode.window.activeTextEditor.document.fileName) {
            extension.logger.status.hide()
        } else if (!extension.manager.isTex(vscode.window.activeTextEditor.document.fileName)) {
            extension.logger.status.hide()
        } else {
            extension.logger.status.show()
        }

        if (vscode.window.activeTextEditor) {
            extension.manager.findRoot()
        }

        if (extension.manager.isTex(e.document.fileName)) {
            lintActiveFileIfEnabled(extension)
        }
    }))

    context.subscriptions.push(vscode.workspace.createFileSystemWatcher('**/*.zed', true, false, true).onDidChange((e: vscode.Uri) => {
        if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.fileName === e.fsPath) {
            return
        }
        const configuration = vscode.workspace.getConfiguration('zed-workshop')
        if (!configuration.get('zed.autoBuild.onTexChange.enabled')) {
            return
        }
        extension.logger.addLogMessage(`${e.fsPath} changed. Auto build project.`)
        const rootFile = extension.manager.findRoot()
        if (rootFile !== undefined) {
            extension.logger.addLogMessage(`Building root file: ${rootFile}`)
            extension.builder.build(extension.manager.rootFile)
        } else {
            extension.logger.addLogMessage(`Cannot find LaTeX root file.`)
        }
    }))

    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('zed-workshop-pdf', new PDFProvider(extension)))
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('zed-workshop-log', extension.logProvider))
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('z', extension.completer, '\\', '{', ','))
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider('z', extension.codeActions))
    extension.manager.findRoot()

    const sectionNodeProvider = new SectionNodeProvider(extension)

    vscode.window.registerTreeDataProvider('zed-outline', sectionNodeProvider)

    lintRootFileIfEnabled(extension)
    obsoleteConfigCheck()
    newVersionMessage(context.extensionPath, extension)
}

export class Extension {
    packageInfo
    logger: Logger
    manager: Manager
    builder: Builder
    viewer: Viewer
    server: Server
    parser: Parser
    completer: Completer
    linter: Linter
    codeActions: CodeActions

    logProvider: LogProvider

    constructor() {
        let command = new Command()

        this.logger = new Logger()
        this.manager = new Manager(this.logger, command)
        this.completer = new Completer(this.logger, this.manager, command)
        this.parser = new Parser(this.logger, this.manager)
        this.linter = new Linter(this.logger, this.parser, this.manager)
        this.server = new Server(this.logger)
        this.viewer = new Viewer(this.logger, this.manager, this.server)
        
        this.codeActions = new CodeActions()
        this.logProvider = new LogProvider(this.parser)
        this.builder = new Builder(this.logger, this.parser, this.viewer, this.manager, this.logProvider)
        
        this.logger.addLogMessage(`Zed Workshop initialized.`)
    }
}
