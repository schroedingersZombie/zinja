const fs = require('fs')
const cache = require('persistent-cache')

const localScripts = require('./local-repository')

function register(name, fileName, options) {
    if (name.indexOf('/') != -1) {
        console.error('Local scripts names can not contain \'/\'')
        process.exit(1)
    }

    if (options.string)
        onFileRead(null, fileName)
    else
        fs.readFile(fileName, 'utf8', onFileRead)
    

    function onFileRead(err, content) {
        if (err != null) {
            console.error('Could not read file ' + fileName)
            process.exit(1)
        }

        localScripts.put(name, content, onLocalCacheWritten)
    }

    function onLocalCacheWritten(err) {
        if (err != null) {
            console.error('Could not write to local scripts')
            process.exit(1)
        }

        console.log('Script locally registered as ' + name)
    }
}

module.exports = register
