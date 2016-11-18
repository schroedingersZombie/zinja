const cache = require('persistent-cache');
const assertError = require('assert').ifError;

const remoteCache = require('./remote-cache');

function clearCache() {
    remoteCache.unlink(function (err) {
        assertError(err);

        console.log('Cache cleared');
    });
}

module.exports = clearCache;
