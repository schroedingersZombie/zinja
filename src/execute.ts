import { writeFile } from 'fs'
import { cache } from './persistent-cache'
import { execSync, spawn } from 'child_process'
import { localRepository } from './local-repository'
import { remoteCache } from './remote-cache'
import { fetchRemoteScript } from './api'

import * as temp from 'temp'
temp.track()

function getCacheName(fullScriptName: string): string {
    return fullScriptName.replace('/', '_')
}

function isLocalScript(name: string): boolean {
    return !name.includes('/')
}

function fetchScript(name: string, cb) {
    if (isLocalScript(name))
        return localRepository.get(name, onLocalCache)

    return remoteCache.get(getCacheName(name), onRemoteCache)

    function onLocalCache(err, script) {
        if (err != null) {
            console.error(err)

            return cb(err)
        }

        if (script === undefined) {
            console.error('Script ' + name + ' was not found in the local repository')
            process.exit(1)
        }

        return cb(null, script)
    }

    function onRemoteCache(err, script) {
        if (err)
            return cb(err)

        if (script === undefined)
            return fetchRemoteScript(name, onRemote)

        return cb(null, script)
    }

    function onRemote(script) {
        return cb(null, script)
    }
}

export function execute() {
    const name = process.argv[2]
    const args = process.argv.slice(3)

    fetchScript(name, (err, script) => {
        if (err != null)
            return process.exit(1)

        return executeScript(script, args)
    })
}

function executeScript(script, args) {
    let tempFilePath = ''

    temp.open('zinja', function tempFileCreated(err, tmpFile) {
        tempFilePath = tmpFile.path
        writeFile(tempFilePath, script, onFileWritten)
    })

    function onFileWritten(err) {
        if (err != null) {
            console.error('Could not write script temp file:')
            console.error(err)
            process.exit(1)
        }

        try {
            execSync('chmod +x ' + tempFilePath)
        } catch (err) {
            console.error('Could not make the script tempfile executable because of:')
            console.error(err)
            process.exit(1)
        }

        /*
        var child = execa(tempFilePath, args);

        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);*/

        const child = spawn(tempFilePath, args, { stdio: 'inherit' })

        child.on('exit', exitCode => process.exit(exitCode) )

        child.on('error', error => {
            console.error(error)

            process.exit(1)
        })
    }
}
