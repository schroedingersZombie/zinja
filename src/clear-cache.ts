import { cache } from './persistent-cache'
import { ifError } from 'assert'

import { remoteCache } from './remote-cache'

export function clearCache() {
    remoteCache.unlink((err) => {
        ifError(err)

        console.log('Cache cleared')
    })
}
