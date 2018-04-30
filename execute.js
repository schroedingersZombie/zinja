const fs = require('fs')
const basename = require('path').basename
const cache = require('persistent-cache')
const temp = require('temp').track()
const assertError = require('assert').ifError
const childProcess = require('child_process')

const localScripts = require('./local-repository')
const remoteCache = require('./remote-cache')
const api = require('./api')

function getCacheName(fullScriptName) {
    return fullScriptName.replace('/', '_')
}

function isLocalScript(name) {
    return name.indexOf('/') == -1
}

function fetchScript(name, cb) {
    if (isLocalScript(name))
        return localScripts.get(name, onLocalCache)

    return remoteCache.get(getCacheName(name), onRemoteCache)


    function onLocalCache(err, script) {
        if (err != null) {
            console.error(err)

            return cb(err)
        }

        if (script == undefined) {
            console.error('Script ' + name + ' was not found in the local repository')
            process.exit(1)
        }

        return cb(null, script)
    }

    function onRemoteCache(err, script) {
        if (err)
            return cb(err)

        if (script == undefined)
            return api.fetchRemoteScript(name, onRemote)

        return cb(null, script)
    }

    function onRemote(script) {
        return cb(null, script)
    }
}

function execute() {
    const name = process.argv[2]
    const args = process.argv.slice(3)

    fetchScript(name, (err, script) => {
        if (err != null)
            return process.exit(1)

        return executeScript(script, args)
    })
}

function executeScript(script, args) {
    const tempFilePath = temp.path('zinja')
    fs.writeFile(tempFilePath, script, onFileWritten)

    function onFileWritten(err) {
        if (err != null) {
            console.error('Could not write script temp file:')
            console.error(err)
            process.exit(1)
        }

        try {
            var chmodResult = childProcess.execSync('chmod +x ' + tempFilePath)
        } catch (err) {
            console.error('Could not make the script tempfile executable because of:')
            console.error(err)
            process.exit(1)
        }

        /*
        var child = execa(tempFilePath, args);

        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);*/

        var child = childProcess.spawn(tempFilePath, args, { stdio: 'inherit' })

        child.on('exit', exitCode => process.exit(exitCode) )

        child.on('error', error => {
            console.error(error)

            process.exit(1)
        })
    }
}

module.exports = execute
