const columnify = require('columnify')
const assertError = require('assert').ifError
const cache = require('persistent-cache')

const api = require('./api')
const remoteCache = require('./remote-cache')
const localScripts = require('./local-repository')

function isLocalScript(name) {
    return name.indexOf('/') == -1
}

function info(name) {
    if (isLocalScript(name))
        return localScripts.get(name, onLocalCache)

    return api.fetchScriptInfo(name, onResponse)

    function onResponse(scriptInfo) {
        outputScriptInfo({
            'Name:': scriptInfo.name,
            'Author:': scriptInfo.user,
            'Source:': 'Zinja Central',
        }, {
            script: scriptInfo.script,
            description: scriptInfo.description,
        })
    }

    function onLocalCache(err, script) {
        if (err != null) {
            console.error(err)
            process.exit(1)
        }

        if (script == undefined) {
            console.error('Script ' + name + ' was not found in the local repository')
            process.exit(1)
        }

        outputScriptInfo({
            'Name:': name,
            'Source:': 'Local Repository',
        }, {
            script: script,
        })
    }
}

function outputScriptInfo(metadata, scriptInfo) {
    var output = {
        'Name:': scriptInfo.name,
        'Author:': scriptInfo.user,
    }

    console.log(columnify(metadata, { showHeaders: false }))

    if (scriptInfo.description) {
        console.log()
        console.log('Description')
        console.log('------------')
        console.log(scriptInfo.description)
    }

    console.log()
    console.log('Source')
    console.log('------------')
    console.log(scriptInfo.script)
}

module.exports = info
