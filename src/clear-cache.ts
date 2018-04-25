const cache = require('persistent-cache')
const assertError = require('assert').ifError

const remoteCache = require('./remote-cache')

export function clearCache() {
    remoteCache.unlink(err => {
        assertError(err)

        console.log('Cache cleared')
    })
}
