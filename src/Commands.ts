import * as vscode from 'vscode'

import { Logger } from "./logger";
import { Manager } from "./manager";
import { Builder } from "./builder";
import { Viewer } from "./viewer";
import { Cleaner } from "./cleaner";
import { Helpers } from "./helpers";

export interface ICommand {
    readonly name: string;
    readonly label: string;
    command();
}

export abstract class BaseCommand implements ICommand {
    protected logger: Logger;

    abstract readonly name: string;
    abstract readonly label: string;

    protected constructor(logger: Logger){
        this.logger = logger;
    }

    command() {
        this.logger.addLogMessage(this.label + `command invoked.`);
        try{
            this.commandAction();
        } catch(e){
            this.logger.addLogMessage(this.label + ` [ERR]: ` + e.Message);
        }
    }

    protected abstract commandAction();

    protected isActiveZDocument(): boolean{
        return (vscode.window.activeTextEditor !== undefined &&
            Helpers.isZed(vscode.window.activeTextEditor.document.fileName));
    }
}

export class BuildCommand extends BaseCommand {
    readonly builder: Builder;
    readonly manager: Manager;
    readonly name: string = 'zed-workshop.build';
    readonly label: string = 'BUILD';

    public constructor(logger: Logger, manager: Manager, builder: Builder){
        super(logger);

        if (manager === undefined) throw new ReferenceError('manager not defined.');
        if (builder === undefined) throw new ReferenceError('builder not defined.');

        this.manager = manager;
        this.builder = builder;
    }

    protected commandAction() {
        if (!this.isActiveZDocument()) return;

        const rootFile = this.manager.findRoot()
        if (rootFile !== undefined) {
            this.logger.addLogMessage(`Building root file: ${rootFile}`)
            this.builder.build(this.manager.rootFile)
        } else {
            this.logger.addLogMessage(`Cannot find Zed root file.`)
        }
    }
}

export class ViewCommand extends BaseCommand {
    readonly manager: Manager;
    readonly viewer: Viewer;
    readonly name: string = 'zed-workshop.view';
    readonly label: string = 'VIEW';

    public constructor(logger: Logger, manager: Manager, viewer: Viewer){
        super(logger);

        if (manager === undefined) throw new ReferenceError('manager not defined.');
        if (viewer === undefined) throw new ReferenceError('viewer not defined.');

        this.manager = manager;
        this.viewer = viewer;
    }

    protected commandAction() {
        if (!this.isActiveZDocument()) return;

        const rootFile = this.manager.findRoot()
        if (rootFile !== undefined) {
            this.viewer.openTab(rootFile)
        } else {
            this.logger.addLogMessage(`Cannot find Zed root PDF to view.`)
        }
    }
}

export class CleanCommand extends BaseCommand {
    readonly cleaner: Cleaner;
    readonly manager: Manager;
    readonly name: string = 'zed-workshop.clean';
    readonly label: string = 'CLEAN';

    public constructor(logger: Logger, manager: Manager, cleaner: Cleaner){
        super(logger);

        if (manager === undefined) throw new ReferenceError('manager not defined.');
        if (cleaner === undefined) throw new ReferenceError('cleaner not defined.');

        this.manager = manager;
        this.cleaner = cleaner;
    }

    protected commandAction() {
        this.manager.findRoot()
        this.cleaner.clean()
    }
}
