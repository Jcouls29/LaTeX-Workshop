import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import * as chokidar from 'chokidar'
import { Logger } from "./logger";
import { Command } from "./providers/command";

export class Manager {
    readonly command: Command;
    readonly logger: Logger;
    rootFile: string
    texFileTree: { [id: string]: Set<string> } = {}
    fileWatcher: chokidar.FSWatcher
    bibWatcher: chokidar.FSWatcher
    watched: string[]

    constructor(logger: Logger, command: Command) {
        this.logger = logger;
        this.command = command;
        this.watched = []
    }

    get rootDir() {
        return path.dirname(this.rootFile)
    }

    tex2pdf(texPath: string) {
        const configuration = vscode.workspace.getConfiguration('zed-workshop')
        const outputDir = configuration.get('zed.outputDir') as string
        return path.resolve(path.dirname(texPath), outputDir, path.basename(`${texPath.substr(0, texPath.lastIndexOf('.'))}.pdf`))
    }

    isTex(filePath: string) {
        return path.extname(filePath) === '.zed'
    }

    findRoot() : string | undefined {
        const findMethods = [() => this.findRootMagic(), () => this.findRootSelf(), () => this.findRootSaved(), () => this.findRootDir()]
        for (const method of findMethods) {
            const rootFile = method()
            if (rootFile !== undefined) {
                if (this.rootFile !== rootFile) {
                    this.logger.addLogMessage(`Root file changed from: ${this.rootFile}. Find all dependencies.`)
                    this.rootFile = rootFile
                    this.findAllDependentFiles()
                } else {
                    this.logger.addLogMessage(`Root file remains unchanged from: ${this.rootFile}.`)
                }
                return rootFile
            }
        }
        return undefined
    }

    findRootMagic() : string | undefined {
        if (!vscode.window.activeTextEditor) {
            return undefined
        }
        const regex = /(?:%\s*!\s*T[Ee]X\sroot\s*=\s*([^\s]*\.zed)$)/m
        const content = vscode.window.activeTextEditor.document.getText()

        const result = content.match(regex)
        if (result) {
            const file = path.resolve(path.dirname(vscode.window.activeTextEditor.document.fileName), result[1])
            this.logger.addLogMessage(`Found root file by magic comment: ${file}`)
            return file
        }
        return undefined
    }

    findRootSelf() : string | undefined {
        if (!vscode.window.activeTextEditor) {
            return undefined
        }
        const regex = /\\begin{document}/m
        const content = vscode.window.activeTextEditor.document.getText()
        const result = content.match(regex)
        if (result) {
            const file = vscode.window.activeTextEditor.document.fileName
            this.logger.addLogMessage(`Found root file from active editor: ${file}`)
            return file
        }
        return undefined
    }

    findRootSaved() : string | undefined {
        return this.rootFile
    }

    findRootDir() : string | undefined {
        const regex = /\\begin{document}/m

        if (!vscode.workspace.rootPath) {
            return undefined
        }

        try {
            const files = fs.readdirSync(vscode.workspace.rootPath)
            for (let file of files) {
                if (path.extname(file) !== '.zed') {
                    continue
                }
                file = path.join(vscode.workspace.rootPath, file)
                const content = fs.readFileSync(file)

                const result = content.toString().match(regex)
                if (result) {
                    file = path.resolve(vscode.workspace.rootPath, file)
                    this.logger.addLogMessage(`Found root file in root directory: ${file}`)
                    return file
                }
            }
        } catch (e) {}
        return undefined
    }

    findAllDependentFiles() {
        let prevWatcherClosed = false
        if (this.fileWatcher !== undefined && this.watched.indexOf(this.rootFile) < 0) {
            // We have an instantiated fileWatcher, but the rootFile is not being watched.
            // => the user has changed the root. Clean up the old watcher so we reform it.
            this.logger.addLogMessage(`Root file changed -> cleaning up old file watcher.`)
            this.fileWatcher.close()
            this.watched = []
            prevWatcherClosed = true
        }

        if (prevWatcherClosed || this.fileWatcher === undefined) {
            this.logger.addLogMessage(`Instatiating new file watcher for ${this.rootFile}`)
            this.fileWatcher = chokidar.watch(this.rootFile)
            this.watched.push(this.rootFile)
            this.fileWatcher.on('change', (path: string) => {
                this.logger.addLogMessage(`File watcher: responding to change in ${path}`)
                this.findDependentFiles(path)
            })
            this.fileWatcher.on('unlink', (path: string) => {
                this.logger.addLogMessage(`File watcher: ${path} deleted.`)
                this.fileWatcher.unwatch(path)
                this.watched.splice(this.watched.indexOf(path), 1)
                if (path === this.rootFile) {
                    this.logger.addLogMessage(`Deleted ${path} was root - triggering root search`)
                    this.findRoot()
                }
            })
            this.findDependentFiles(this.rootFile)
        }
    }

    findDependentFiles(filePath: string) {
        this.logger.addLogMessage(`Parsing ${filePath}`)
        const content = fs.readFileSync(filePath, 'utf-8')

        const inputReg = /(?:\\(?:input|include|subfile)(?:\[[^\[\]\{\}]*\])?){([^}]*)}/g
        this.texFileTree[filePath] = new Set()
        while (true) {
            const result = inputReg.exec(content)
            if (!result) {
                break
            }
            const inputFile = result[1]
            let inputFilePath = path.resolve(path.join(this.rootDir, inputFile))
            if (path.extname(inputFilePath) === '') {
                inputFilePath += '.zed'
            }
            if (!fs.existsSync(inputFilePath) && fs.existsSync(inputFilePath + '.zed')) {
                inputFilePath += '.zed'
            }
            if (fs.existsSync(inputFilePath)) {
                this.texFileTree[filePath].add(inputFilePath)
                if (this.watched.indexOf(inputFilePath) < 0) {
                    this.logger.addLogMessage(`Adding ${inputFilePath} to file watcher.`)
                    this.fileWatcher.add(inputFilePath)
                    this.watched.push(inputFilePath)
                    this.findDependentFiles(inputFilePath)
                }
            }
        }

        this.command.getCommandsTeX(filePath)
    }
}
