const cache = require('persistent-cache');
const columns = require('cli-columns');

const localScripts =  cache({
    name: 'local'
});

function listLocal() {
    localScripts.keys(function (err, keys) {
        if(keys.length == 0)
            return console.log('You have no scripts in your local respository');

        console.log(columns(keys));
    });
}

module.exports = listLocal;
