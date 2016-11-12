const api = require('./api');

function install(name) {
    api.fetchRemoteScript(name, onFetched);

    function onFetched(script) {
        require('./register')(
            name.split('/')[1],
            script,
            { string: true }
        );
    }
}

module.exports = install;
