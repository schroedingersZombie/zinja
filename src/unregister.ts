import { cache } from './persistent-cache'
import { localRepository } from './local-repository'

export function unregister(name) {
    localRepository.delete(name, err => {
        if (err != null)
            return console.error(`Could not unregister local script '${name}' (maybe it is not registered?)`)

        console.log(`Successfully unregistered script '${name}'`)
    })
}
