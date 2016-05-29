var request = require('request');
var fs = require('fs');
var childProcess = require('child_process');

var cache = require('../cache');

var ninjaUrl = 'http://localhost:1718/api/scripts';

var localScripts = cache({
    infinite: true,
    dir: 'local'
});

var remoteCache = cache();

function onConnectionProblem() {
    console.error('Could not connect to the repository, maybe there is a problem with your internet connection or we are currently under maintenance? Check soke.io for updates or try again later');
    process.exit(1);
}

function execute(args) {
    var name = args[0];
    var args = args.slice(1);

    localScripts.get(name, onLocalCache);

    function onLocalCache(notFound, script) {
        if(notFound) {
            return remoteCache.get(name, onRemoteCache);
        }

        return executeScript(script, args);
    }

    function onRemoteCache(notFound, script) {
        if(notFound) {
            return fetchAndExecuteRemoteScript(name, args);
        }

        return executeScript(script, args);
    }
}

function fetchAndExecuteRemoteScript(name, args) {
    request.get(ninjaUrl + '?name=' + name, function(err, response, body) {
        if(err != null) {
            return onConnectionProblem();
        }

        if(response.statusCode != 200) {
          //TODO: Implement erorr handling (404 and so on)
          return console.error(response.statusCode);
        }

        executeScript(body, args);
    });
}

function executeScript(script, args) {
    fs.writeFile('./temp.ninja', script, onFileWritten);

    function onFileWritten(err) {
        if(err != null) {
            console.error('Could not write script temp file');
            process.exit(1);
        }

        var bashArgs = args.join(' ');
        var command = 'source ./temp.ninja ' + bashArgs;

        childProcess.exec(command, function(err, stdout, stderr) {
            fs.unlink('./temp.ninja');

            if(err !== null) {
              console.error(stderr);
              return;
            }

            console.log(stdout);
        });
    }
}

function register(name, fileName) {
    fs.readFile(fileName, 'utf8', onFileRead);

    function onFileRead(err, content) {
        if(err != null) {
            console.error('Could not read file ' + fileName);
            process.exit(1);
        }

        localScripts.put(name, content, onLocalCacheWritten);
    }

    function onLocalCacheWritten(err) {
        if(err != null) {
            console.error('Could not write to local scripts');
            process.exit(1);
        }

        console.log('Script locally registered as ' + name);
    }
}

exports.execute = execute;
exports.register = register;
