import { cache } from './persistent-cache'
import { readFile } from 'fs'
import { localRepository } from './local-repository'

export function register(name: string, fileName: string, options: RegisterOptions) {
    if (name.includes('/')) {
        console.error('Local scripts names can not contain \'/\'')
        process.exit(1)
    }

    if (options.string)
        onFileRead(null, fileName)
    else
        readFile(fileName, 'utf8', onFileRead)

    function onFileRead(err, content) {
        if (err != null) {
            console.error('Could not read file ' + fileName)
            process.exit(1)
        }

        localRepository.put(name, content, onLocalCacheWritten)
    }

    function onLocalCacheWritten(err) {
        if (err != null) {
            console.error('Could not write to local scripts')
            process.exit(1)
        }

        console.log('Script locally registered as ' + name)
    }
}

export interface RegisterOptions {
    string?: boolean
}
