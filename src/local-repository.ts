import { cache } from './persistent-cache'

export const localRepository = cache({
    name: 'local',
    base: process.env.HOME + '/.zinja',
})
