const api = require('./api')

export function install(name) {
    api.fetchRemoteScript(name, onFetched)

    function onFetched(script) {
        require('./register')(
            name.split('/')[1],
            script,
            { string: true }
        )
    }
}
