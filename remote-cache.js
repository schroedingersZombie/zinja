module.exports = require('persistent-cache')({
    duration: 1000 * 3600 * 24 * 7,
    base: process.env.HOME + '/.zinja',
})
