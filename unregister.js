const cache = require('persistent-cache');

const localScripts = require('./local-repository');

function unregister(name) {
    localScripts.delete(name, function(err) {
        if (err != null) {
            return console.error('Could not unregister local script \'' + name + '\' (maybe it is not registered?)');
        }

        console.log('Successfully unregistered script \'' + name + '\'');
    })
}

module.exports = unregister;
