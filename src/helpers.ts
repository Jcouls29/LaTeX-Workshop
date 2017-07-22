import * as path from 'path'

export class Helpers{
    public static isZed(filePath: string) {
        return path.extname(filePath) === '.zed'
    }
}