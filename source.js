const columnify = require('columnify')
const assertError = require('assert').ifError
const cache = require('persistent-cache')

const api = require('./api')
const remoteCache = require('./remote-cache')
const localScripts = require('./local-repository')

function isLocalScript(name) {
    return name.indexOf('/') == -1
}

function source(name) {
    if (isLocalScript(name))
        return localScripts.get(name, onLocalCache)

    return api.fetchScriptInfo(name, onResponse)

    function onResponse(scriptInfo) {
        outputScriptSource(scriptInfo.script)
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

        outputScriptSource(script)
    }
}

function outputScriptSource(scriptSource) {
    console.log(scriptSource)
}

module.exports = source
