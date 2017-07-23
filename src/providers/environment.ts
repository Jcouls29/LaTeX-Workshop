import * as vscode from 'vscode'

import {IProvider} from './provider'
import { Manager } from "../manager";

export class Environment implements IProvider {
    suggestions: vscode.CompletionItem[] = []
    provideRefreshTime: number

    initialize(defaultEnvs: {[key: string]: {text: string}}) {
        Object.keys(defaultEnvs).forEach(key => {
            const item = defaultEnvs[key]
            const environment = new vscode.CompletionItem(item.text, vscode.CompletionItemKind.Module)
            this.suggestions.push(environment)
        })
    }

    provide(manager: Manager) : vscode.CompletionItem[] {
        return this.suggestions
    }
}
