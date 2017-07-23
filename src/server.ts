import * as http from 'http'
import * as ws from 'ws'
import * as fs from 'fs'
import * as path from 'path'

import { Logger } from "./logger";
import {EXTENSION_ROOT} from "./main"

export class Server {
    readonly logger: Logger;
    readonly httpServer: http.Server
    public wsServer: ws.Server
    address: string
    root: string

    constructor(logger: Logger) {
        this.logger = logger;

        this.httpServer = http.createServer((request, response) => this.handler(request, response))
        this.httpServer.listen(0, "localhost", undefined, (err: Error) => {
            if (err) {
                this.logger.addLogMessage(`Error creating LaTeX Workshop http server: ${err}.`)
            } else {
                const {address, port} = this.httpServer.address()
                this.address = `${address}:${port}`
                this.root = path.resolve(`${EXTENSION_ROOT}/viewer`)
                this.logger.addLogMessage(`Server created on ${this.address}`)
            }
        })
        this.wsServer = ws.createServer({server: this.httpServer})
        this.logger.addLogMessage(`Creating Zed Workshop http and websocket server.`)
    }

    handler(request: http.IncomingMessage, response: http.ServerResponse) {
        if (!request.url) {
            return
        }
        if (request.url.indexOf('pdf:') >= 0 && request.url.indexOf('viewer.html') < 0) {
            const fileName = decodeURIComponent(request.url).replace('/pdf:', '')
            try {
                const pdfSize = fs.statSync(fileName).size
                response.writeHead(200, {'Content-Type': 'application/pdf', 'Content-Length': pdfSize})
                fs.createReadStream(fileName).pipe(response)
                this.logger.addLogMessage(`Preview PDF file: ${fileName}`)
            } catch (e) {
                response.writeHead(404)
                response.end()
                this.logger.addLogMessage(`Error reading PDF file: ${fileName}`)
            }
            return
        }
        const fileName = path.join(this.root, request.url.split('?')[0])
        let contentType = 'text/html'
        switch (path.extname(fileName)) {
            case '.js':
                contentType = 'text/javascript'
                break
            case '.css':
                contentType = 'text/css'
                break
            case '.json':
                contentType = 'application/json'
                break
            case '.png':
                contentType = 'image/png'
                break
            case '.jpg':
                contentType = 'image/jpg'
                break
            default:
                break
        }
        fs.readFile(fileName, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    response.writeHead(404)
                } else {
                    response.writeHead(500)
                }
                response.end()
            } else {
                response.writeHead(200, {'Content-Type': contentType})
                response.end(content, 'utf-8')
            }
        })
    }
}
