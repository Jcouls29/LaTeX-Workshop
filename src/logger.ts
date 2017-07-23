import * as vscode from 'vscode'

import { Parser } from "./parser";
import { Manager } from "./manager";

export class Logger {
    logPanel: vscode.OutputChannel
    status: vscode.StatusBarItem
    statusTimeout: NodeJS.Timer

    constructor() {
        this.logPanel = vscode.window.createOutputChannel('Zed Workshop')
        this.addLogMessage('Initializing Zed Workshop.')
        this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -10000)
        this.status.command = 'zed-workshop.actions'
        this.status.show()
        this.displayStatus('repo', 'statusBar.foreground', 'Zed Workshop')
    }

    addLogMessage(message: string) {
        const configuration = vscode.workspace.getConfiguration('zed-workshop')
        if (configuration.get('debug.showLog')) {
            this.logPanel.append(`[${new Date().toLocaleTimeString('en-US', {hour12: false})}] ${message}\n`)
        }
    }

    displayStatus(icon: string, color: string, message: string, timeout: number = 5000) {
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout)
        }
        this.status.text = `$(${icon}) ${message}`
        this.status.tooltip = message
        this.status.color = new vscode.ThemeColor(color)
        if (timeout > 0) {
            this.statusTimeout = setTimeout(() => this.status.text = `$(${icon})`, timeout)
        }
    }

    displayFullStatus(timeout: number = 5000) {
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout)
        }
        const icon = this.status.text.split(' ')[0]
        const message = this.status.tooltip
        this.status.text = `${icon} Previous message: ${message}`
        if (timeout > 0) {
            this.statusTimeout = setTimeout(() => this.status.text = `${icon}`, timeout)
        }
    }

    showLog(manager: Manager) {
        const uri = vscode.Uri.file(manager.rootFile).with({scheme: 'zed-workshop-log'})
        let column = vscode.ViewColumn.Two
        if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.viewColumn === vscode.ViewColumn.Two) {
            column = vscode.ViewColumn.Three
        }
        vscode.commands.executeCommand("vscode.previewHtml", uri, column, 'Raw Zed Log')
        this.addLogMessage(`Open Log tab`)
    }
}

export class LogProvider implements vscode.TextDocumentContentProvider {
    parser: Parser;
    change = new vscode.EventEmitter<vscode.Uri>()

    constructor(parser: Parser) {
        this.parser = parser;
    }

    public update(uri: vscode.Uri) {
        this.change.fire(uri)
    }

    get onDidChange() : vscode.Event<vscode.Uri> {
        return this.change.event
    }

    public provideTextDocumentContent(_uri: vscode.Uri) : string {
        const dom = this.parser.buildLogRaw.split('\n').map(log => `<span>${log.replace(/&/g, "&amp;")
                                                                                .replace(/</g, "&lt;")
                                                                                .replace(/>/g, "&gt;")
                                                                                .replace(/"/g, "&quot;")
                                                                                .replace(/'/g, "&#039;")}</span><br>`)
        return `
            <!DOCTYPE html style="position:absolute; left: 0; top: 0; width: 100%; height: 100%;"><html><head></head>
            <body style="position:absolute; left: 0; top: 0; width: 100%; height: 100%; white-space: pre;">${dom.join('')}</body></html>
        `
    }
}
