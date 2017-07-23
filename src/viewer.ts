import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import * as opn from 'opn'
import * as WebSocket from 'ws'

import {Extension} from './main'
import { Server } from "./server";
import { Manager } from "./manager";
import { Logger } from "./logger";

interface Position {}

interface Client {
    type: 'viewer' | 'tab'
    prevType?: 'viewer' | 'tab'
    ws?: WebSocket
    position?: Position
}

export class Viewer {
    readonly logger: Logger;
    readonly manager: Manager;
    readonly server: Server;
    clients: { [key: string]: Client | undefined } = {}
    positions = {}

    constructor(logger: Logger, manager: Manager, server: Server) {
        this.logger = logger;
        this.manager = manager;
        this.server = server;

        // This gets rid of the dependency server has on viewer
        this.server.wsServer.on("connection", (ws) => {
            ws.on("message", (msg) => this.handler(ws, msg))
            ws.on("close", () => this.handler(ws, '{"type": "close"}'))
        })
    }

    refreshExistingViewer(sourceFile: string, type?: string) : boolean {
        const pdfFile = this.manager.tex2pdf(sourceFile)
        const client = this.clients[pdfFile]
        if (client !== undefined &&
            (type === undefined || client.type === type) &&
            client.ws !== undefined) {
            this.logger.addLogMessage(`Refresh PDF viewer for ${pdfFile}`)
            client.ws.send(JSON.stringify({type: "refresh"}))
            return true
        }
        this.logger.addLogMessage(`No PDF viewer connected for ${pdfFile}`)
        return false
    }

    checkViewer(sourceFile: string, type: string) : string | undefined {
        if (this.refreshExistingViewer(sourceFile, type)) {
            return
        }
        const pdfFile = this.manager.tex2pdf(sourceFile)
        if (!fs.existsSync(pdfFile)) {
            this.logger.addLogMessage(`Cannot find PDF file ${pdfFile}`)
            return
        }
        if (this.server.address === undefined) {
            this.logger.addLogMessage(`Cannot establish server connection.`)
            return
        }
        const url = `http://${this.server.address}/viewer.html?file=\\pdf:${encodeURIComponent(pdfFile)}`
        this.logger.addLogMessage(`Serving PDF file at ${url}`)
        return url
    }

    openViewer(sourceFile: string) {
        const url = this.checkViewer(sourceFile, 'viewer')
        if (!url) {
            return
        }
        const pdfFile = this.manager.tex2pdf(sourceFile)
        const client = this.clients[pdfFile]
        if (client !== undefined && client.ws !== undefined) {
            client.ws.close()
        }
        this.clients[pdfFile] = {type: 'viewer'}
        opn(url)
        this.logger.addLogMessage(`Open PDF viewer for ${pdfFile}`)
        this.logger.displayStatus('repo', 'statusBar.foreground', `Open PDF viewer for ${path.basename(pdfFile)}.`)
    }

    openTab(sourceFile: string) {
        const url = this.checkViewer(sourceFile, 'tab')
        if (!url) {
            return
        }
        const pdfFile = this.manager.tex2pdf(sourceFile)
        const client = this.clients[pdfFile]
        const uri = vscode.Uri.file(pdfFile).with({scheme: 'zed-workshop-pdf'})
        let column = vscode.ViewColumn.Two
        if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.viewColumn === vscode.ViewColumn.Two) {
            column = vscode.ViewColumn.Three
        }
        if (client !== undefined && client.ws !== undefined) {
            client.ws.close()
        }
        this.clients[pdfFile] = {type: 'tab'}
        vscode.commands.executeCommand("vscode.previewHtml", uri, column, path.basename(pdfFile))
        this.logger.addLogMessage(`Open PDF tab for ${pdfFile}`)
        this.logger.displayStatus('repo', 'statusBar.foreground', `Open PDF tab for ${path.basename(pdfFile)}.`)
    }

    handler(ws: WebSocket, msg: string) {
        const data = JSON.parse(msg)
        let client: Client | undefined
        switch (data.type) {
            case 'open':
                client = this.clients[decodeURIComponent(data.path)]
                if (client !== undefined) {
                    client.ws = ws
                    if (client.type === undefined && client.prevType !== undefined) {
                        client.type = client.prevType
                    }
                }
                break
            case 'close':
                for (const key in this.clients) {
                    client = this.clients[key]
                    if (client !== undefined && client.ws === ws) {
                        client.prevType = client.type
                        delete client.ws
                        delete client.type
                    }
                }
                break
            case 'position':
                for (const key in this.clients) {
                    client = this.clients[key]
                    if (client !== undefined && client.ws === ws) {
                        client.position = data
                    }
                }
                break
            case 'loaded':
                const pdfFile = decodeURIComponent(data.path)
                client = this.clients[pdfFile]
                if (client !== undefined && client.ws !== undefined) {
                    if (client.position !== undefined) {
                        client.ws.send(JSON.stringify(client.position))
                    } else {
                        const configuration = vscode.workspace.getConfiguration('zed-workshop')
                        client.ws.send(JSON.stringify({
                            type: "params",
                            scale: configuration.get('viewer.zoom'),
                            hand: configuration.get('viewer.hand')
                        }))
                    }
                }
                break
            case 'click':
                //this.extension.locator.locate(data, decodeURIComponent(data.path))
                break
            default:
                this.logger.addLogMessage(`Unknown websocket message: ${msg}`)
                break
        }
    }
}

export class PDFProvider implements vscode.TextDocumentContentProvider {
    extension: Extension

    constructor(extension: Extension) {
        this.extension = extension
    }

    public provideTextDocumentContent(uri: vscode.Uri) : string {
        const url = `http://${this.extension.server.address}/viewer.html?file=\\pdf:${encodeURIComponent(uri.fsPath)}`
        return `
            <!DOCTYPE html><html><head></head>
            <body><iframe class="preview-panel" src="${url}" style="position:absolute; border: none; left: 0; top: 0; width: 100%; height: 100%;">
            </iframe></body></html>
        `
    }
}
