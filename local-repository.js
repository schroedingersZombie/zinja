module.exports = require('persistent-cache')({
    name: 'local',
    base: process.env.HOME + '/.zinja',
})
