import * as vscode from 'vscode'
import * as fs from 'fs'

import {EXTENSION_ROOT} from './main'
import {Command} from './providers/command'
import {Environment} from './providers/environment'
import { Logger } from "./logger";
import { Manager } from "./manager";
import { IProvider } from "./providers/provider";

export class Completer implements vscode.CompletionItemProvider {
    manager: Manager;
    readonly logger: Logger;
    command: Command
    environment: Environment

    constructor(logger: Logger, manager: Manager, command: Command) {
        if (logger === undefined) throw new ReferenceError('logger not defined.');
        if (manager === undefined) throw new ReferenceError('manager not defined.');
        if (command == undefined) throw new ReferenceError('command not defined.');

        this.logger = logger;
        this.manager = manager;
        
        this.command = command
        this.environment = new Environment()
        fs.readFile(`${EXTENSION_ROOT}/data/environments.json`, (err1, defaultEnvs) => {
            if (err1) {
                this.logger.addLogMessage(`Error reading default environments: ${err1.message}`)
                return
            }
            this.logger.addLogMessage(`Default environments loaded`)
            fs.readFile(`${EXTENSION_ROOT}/data/commands.json`, (err2, defaultCommands) => {
                if (err2) {
                    this.logger.addLogMessage(`Error reading default commands: ${err2.message}`)
                    return
                }
                this.logger.addLogMessage(`Default commands loaded`)
                fs.readFile(`${EXTENSION_ROOT}/data/unimathsymbols.json`, (err3, defaultSymbols) => {
                    if (err2) {
                        this.logger.addLogMessage(`Error reading default unimathsymbols: ${err3.message}`)
                        return
                    }
                    this.logger.addLogMessage(`Default unimathsymbols loaded`)
                    const env = JSON.parse(defaultEnvs.toString())
                    this.command.initialize(JSON.parse(defaultCommands.toString()), JSON.parse(defaultSymbols.toString()), env)
                    this.environment.initialize(env)
                })
            })
        })
    }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken) : Promise<vscode.CompletionItem[]> {
        return new Promise((resolve, _reject) => {
            const line = document.lineAt(position.line).text.substr(0, position.character)
            for (const type of ['citation', 'reference', 'environment', 'command']) {
                const suggestions = this.completion(type, line)
                if (suggestions.length > 0) {
                    if (type === 'citation') {
                        const configuration = vscode.workspace.getConfiguration('zed-workshop')
                        if (configuration.get('intellisense.citation.type') as string === 'browser') {
                            resolve([])
                            //this.extension.completer.citation.browser()
                            return
                        }
                    }
                    resolve(suggestions)
                    return
                }
            }
            resolve([])
        })
    }

    completion(type: string, line: string) : vscode.CompletionItem[] {
        let reg
        let provider : IProvider
        
        switch (type) {
            case 'environment':
                reg = /(?:\\(?:begin|end)(?:\[[^\[\]]*\])?){([^}]*)$/
                provider = this.environment
                break
            case 'command':
                reg = /\\([a-zA-Z]*)$/
                provider = this.command
                break
            default:
                // This shouldn't be possible, so mark as error case in log.
                this.logger.addLogMessage(`Error - trying to complete unknown type ${type}`)
                return []
        }
        const result = line.match(reg)
        let suggestions: vscode.CompletionItem[] = []
        if (result) {
            suggestions = provider.provide(this.manager)
        }
        return suggestions
    }
}
