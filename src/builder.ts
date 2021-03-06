import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import * as cp from 'child_process'

import { Parser } from "./parser";
import { Logger, LogProvider } from "./logger";
import { Viewer } from "./viewer";
import { Manager } from "./manager";

export class Builder {
    readonly provider: LogProvider;
    readonly manager: Manager;
    readonly viewer: Viewer;
    readonly parser: Parser;
    readonly logger: Logger;
    currentProcess: cp.ChildProcess | undefined
    disableBuildAfterSave: boolean = false

    constructor(logger: Logger, parser: Parser, 
                viewer: Viewer, manager: Manager,
                provider: LogProvider) {

        this.logger = logger;
        this.parser = parser;
        this.viewer = viewer;
        this.manager = manager;
        this.provider = provider;
    }

    build(rootFile: string) {
        this.logger.addLogMessage(`Build root file ${rootFile}`)
        this.disableBuildAfterSave = true
        vscode.workspace.saveAll()
        this.disableBuildAfterSave = false
        if (this.currentProcess) {
            this.currentProcess.kill()
            this.logger.addLogMessage('Kill previous process')
        }
        const toolchain = this.createToolchain(rootFile)
        if (toolchain === undefined) {
            this.logger.addLogMessage('Invalid toolchain.')
            return
        }
        this.buildStep(rootFile, toolchain, 0)
    }

    buildStep(rootFile: string, toolchain: ToolchainCommand[], index: number) {
        if (toolchain.length === index) {
            this.logger.addLogMessage(`Toolchain of length ${toolchain.length} finished.`)
            this.buildFinished(rootFile)
            return
        }

        this.logger.addLogMessage(`Toolchain step ${index + 1}: ${toolchain[index].command}, ${toolchain[index].args}`)
        this.logger.displayStatus('sync', 'statusBar.foreground', `Zed build toolchain step ${index + 1}.`, 0)
        this.currentProcess = cp.spawn(toolchain[index].command, toolchain[index].args, {cwd: path.dirname(rootFile)})

        let stdout = ''
        this.currentProcess.stdout.on('data', newStdout => {
            stdout += newStdout
        })

        let stderr = ''
        this.currentProcess.stderr.on('data', newStderr => {
            stderr += newStderr
        })

        this.currentProcess.on('error', err => {
            this.logger.addLogMessage(`Zed fatal error: ${err.message}, ${stderr}. Does the executable exist?`)
            this.logger.displayStatus('x', 'errorForeground', `Toolchain terminated with fatal error.`)
            this.currentProcess = undefined
        })

        this.currentProcess.on('exit', (exitCode, signal) => {
            this.parser.parse(stdout)
            const uri = vscode.Uri.file(this.manager.rootFile).with({scheme: 'zed-workshop-log'})
            this.provider.update(uri)
            if (exitCode !== 0) {
                this.logger.addLogMessage(`Toolchain returns with error: ${exitCode}/${signal}.${signal ? '\n' + stdout : ''}`)
                this.logger.displayStatus('x', 'errorForeground', `Zed toolchain terminated with error.`)
            } else {
                this.buildStep(rootFile, toolchain, index + 1)
            }
            this.currentProcess = undefined
        })
    }

    buildFinished(rootFile: string) {
        this.logger.addLogMessage(`Successfully built ${rootFile}`)
        this.logger.displayStatus('check', 'statusBar.foreground', `Zed toolchain succeeded.`)
        this.viewer.refreshExistingViewer(rootFile)
    }

    createToolchain(rootFile: string) : ToolchainCommand[] | undefined  {
        const configuration = vscode.workspace.getConfiguration('zed-workshop')
        // Modify a copy, instead of itself.
        const commands = JSON.parse(JSON.stringify(configuration.get('zed.toolchain'))) as ToolchainCommand[]
        let program = ''
        for (const command of commands) {
            if (!('command' in command)) {
                vscode.window.showErrorMessage('Zed toolchain is invalid. Each tool in the toolchain must have a "command" string.')
                return undefined
            }
            if (!Array.isArray(command.args)) {
                vscode.window.showErrorMessage('Zed toolchain is invalid. "args" must be an array of strings.')
                return undefined
            }
            if (command.args) {
                command.args = command.args.map(arg => arg.replace('%DOC%', rootFile)
                                                          .replace('%DOCFILE%', rootFile)
                                                          .replace('%DIR%', path.dirname(rootFile)))
            }
            if (command.command === '') {
                if (program === '') {
                    program = this.findProgramMagic(rootFile)
                }
                command.command = program
            }
        }
        return commands
    }

    findProgramMagic(rootFile: string) : string {
        const regex = /(?:%\s*!\s*T[Ee]X\s(?:TS-)?program\s*=\s*([^\s]*)$)/m
        const content = fs.readFileSync(rootFile).toString()

        const result = content.match(regex)
        let program = ''
        if (result) {
            program = result[1]
            this.logger.addLogMessage(`Found program by magic comment: ${program}`)
        } else {
            program = 'pdflatex'
        }
        return program
    }
}

interface ToolchainCommand {
    command: string,
    args?: string[]
}
