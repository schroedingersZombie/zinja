import * as columnify from 'columnify'
import { cache } from './persistent-cache'
import { fetchScriptInfo, Script } from './api'

import { remoteCache } from './remote-cache'
import { localRepository } from './local-repository'

function isLocalScript(name: string) {
    return !name.includes('/')
}

export function info(name) {
    if (isLocalScript(name))
        return localRepository.get(name, onLocalCache)

    return fetchScriptInfo(name, onResponse)

    function onResponse(scriptInfo: Script) {
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

        if (script === undefined) {
            console.error('Script ' + name + ' was not found in the local repository')
            process.exit(1)
        }

        outputScriptInfo(
            {
                'Name:': name,
                'Source:': 'Local Repository',
            },
            { script },
        )
    }
}

function outputScriptInfo(metadata, scriptInfo) {
    const output = {
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
