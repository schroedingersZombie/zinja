import { fetchRemoteScript } from './api'

export function install(name) {
    fetchRemoteScript(name, onFetched)

    function onFetched(script) {
        require('./register')(
            name.split('/')[1],
            script,
            { string: true }
        )
    }
}
