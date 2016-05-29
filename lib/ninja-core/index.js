var request = require('request');
var fs = require('fs');
var childProcess = require('child_process');

var cache = require('../cache');

var scriptsEndpoint = 'http://localhost:1718/api/scripts';
var searchEndpoint = 'http://localhost:1718/api/search';

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
    request.get(scriptsEndpoint + '?name=' + name, function(err, response, body) {
        if(err != null)
            return onConnectionProblem();

        if(response.statusCode != 200) {
            if(response.statusCode == 404) {
                return console.error('Script ' + name + ' was not found in the central soke repository. Try soke search ' + name);
            }

            return console.error(response.statusCode);
        }

        remoteCache.put(name, body, function(err) {});

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

function unregister(name) {
    localScripts.delete(name, function(err) {
        if(err != null) {
            return console.error('Could not unregister local script \'' + name + '\' (maybe it is not registered?)');
        }

        console.log('Successfully unregistered script \'' + name + '\'');
    })
}

function publish(name, fileName) {
    if(!name.match(/^[a-z]+(-[a-z0-9]+)*$/)) {
        console.error('Invalid name. Script names can only contain lowercase letters, numbers and dashes and must begin with a letter');
        console.error('Examples: some-script a43-reset foo bar-6');

        process.exit(1);
    }

    fs.readFile(fileName, 'utf8', onFileRead);

    function onFileRead(err, content) {
        if(err != null) {
            console.error('Could not read file ' + fileName);
            process.exit(1);
        }

        request({
            body: {
                name: name,
                script: content
            },
            uri: scriptsEndpoint,
            method: 'POST',
            json: true
        }, onResponse);
    }

    function onResponse(err, response, body) {
        if(err != null) {
            return onConnectionProblem();
        }

        if(response.statusCode != 201) {
            console.error('Could not publish, maybe that name is already taken? Try soke search ' + name);
            process.exit(1);
        }

        console.log('Successfully published script ' + name);
    }
 }

function search(query) {
    request.get({
        uri: searchEndpoint,
        method: 'GET',
        qs: {
            q: query
        }
    }, onResponse);

    function onResponse(err, response, body) {
        if(err != null) {
            return onConnectionProblem();
        }

        console.log(body);
    }
}

exports.search = search;
exports.execute = execute;
exports.register = register;
exports.unregister = unregister;
exports.publish = publish;
