import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import * as glob from 'glob'
import { Logger } from "./logger";
import { Manager } from "./manager";

export class Cleaner {
    readonly manager: Manager;
    readonly logger: Logger;

    constructor(logger: Logger, manager: Manager) {
        this.logger = logger;
        this.manager = manager;
    }

    clean() {
        if (this.manager.rootFile !== undefined) {
            this.manager.findRoot()
        }
        const configuration = vscode.workspace.getConfiguration('zed-workshop')
        const globs = configuration.get('zed.clean.fileTypes') as string[]
        let outdir = configuration.get('zed.outputDir') as string
        if (!outdir.endsWith('/') && !outdir.endsWith('\\')) {
            outdir += path.sep
        }
        const globOutDir: string[] = []
        if (outdir !== './') {
            globs.forEach(globType => globOutDir.push(outdir + globType))
        }
        for (const globType of globs.concat(globOutDir)) {
            glob(globType, {cwd: this.manager.rootDir}, (err, files) => {
                if (err) {
                    this.logger.addLogMessage(`Error identifying files with glob ${globType}: ${files}.`)
                    return
                }
                for (const file of files) {
                    const fullPath = path.resolve(this.manager.rootDir, file)
                    fs.unlink(fullPath, unlinkErr => {
                        if (unlinkErr) {
                            this.logger.addLogMessage(`Error removing file: ${fullPath}`)
                            return
                        }
                        this.logger.addLogMessage(`File cleaned: ${fullPath}`)
                    })
                }
            })
        }
    }
}
