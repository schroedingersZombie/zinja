import { cache } from './persistent-cache'

export const remoteCache = cache({
    duration: 1000 * 3600 * 24 * 7,
    base: process.env.HOME + '/.zinja',
})
