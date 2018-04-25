const columns = require('cli-columns')

const api = require('./api')

export function search(query) {
    api.searchScripts(query, onResponse)

    function onResponse(scriptNames) {
        if (scriptNames.length > 0)
            console.log(columns(scriptNames))
        else
            console.log('No scripts with a name containing \'' + query + '\' found')
    }
}
