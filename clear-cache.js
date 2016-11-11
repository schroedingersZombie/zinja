const cache = require('persistent-cache');
const assertError = require('assert').ifError;

const remoteCache = cache({ duration: 1000 * 3600 * 24 * 7 });

function clearCache() {
    remoteCache.unlink(function (err) {
        assertError(err);

        console.log('Cache cleared');
    })
}

module.exports = clearCache;
