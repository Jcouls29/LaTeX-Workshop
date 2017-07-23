import * as vscode from 'vscode'
import { Manager } from "../manager";

export interface IProvider {
    provide(manager: Manager) : vscode.CompletionItem[]
}