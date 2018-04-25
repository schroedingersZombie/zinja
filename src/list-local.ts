import { cache } from './persistent-cache'
import * as columns from 'cli-columns'

import { localRepository } from './local-repository'

export function listLocal() {
    localRepository.keys((err, keys) => {
        if (keys.length === 0)
            return console.log('You have no scripts in your local respository')

        console.log(columns(keys))
    })
}
