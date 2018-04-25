import * as columns from 'cli-columns'
import { searchScripts } from './api'

export function search(query) {
    searchScripts(query, onResponse)

    function onResponse(scriptNames) {
        if (scriptNames.length > 0)
            console.log(columns(scriptNames))
        else
            console.log(`No scripts with a name containing '${query}' found`)
    }
}
