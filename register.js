const fs = require('fs');
const cache = require('cache');

const localScripts =  cache({
    name: 'local'
});

function register(name, fileName, options) {
    if (options.string) {
        onFileRead(null, fileName);
    } else {
        fs.readFile(fileName, 'utf8', onFileRead);
    }

    function onFileRead(err, content) {
        if (err != null) {
            console.error('Could not read file ' + fileName);
            process.exit(1);
        }

        localScripts.put(name, content, onLocalCacheWritten);
    }

    function onLocalCacheWritten(err) {
        if (err != null) {
            console.error('Could not write to local scripts');
            process.exit(1);
        }

        console.log('Script locally registered as ' + name);
    }
}

module.exports = register;
