var fs = require('fs');
var basename = require('path').basename;
var request = require('request');
var cache = require('persistent-cache');
var temp = require('temp').track();
var assertError = require('assert').ifError;
var execa = require('execa');

var localScripts = cache({
    name: 'local'
});

var remoteCache = cache({
    duration: 1000 * 3600 * 24 * 7
});

const scriptsEndpoint = 'https://api.zinja.io/scripts';

function fetchScript(name, cb) {
    localScripts.get(name, onLocalCache);

    function onLocalCache(err, script) {
        if(err != null) {
            return cb(err);
        }

        if(script === undefined)
            return remoteCache.get(name, onRemoteCache);

        return cb(null, script);
    }

    function onRemoteCache(err, script) {
        if(err) {
            return cb(err);
        }

        if(script === undefined)
            return fetchRemoteScript(name, onRemote);

        return cb(null, script);
    }

    function onRemote(err, script) {
        if(err != null) {
            return cb(err);
        }

        return cb(null, script);
    }
}

function execute(args) {
    var name = args[0];
    var args = args.slice(1);

    fetchScript(name, function(err, script) {
        if(err != null) {
            return process.exit(1);
        }

        return executeScript(script, args);
    });
}

function fetchRemoteScript(name, cb) {
    request.get(scriptsEndpoint + '/' + name, function(err, response, body) {
        if(err != null)
            return onConnectionProblem();

        if(response.statusCode != 200) {
            if(response.statusCode == 404) {
                console.error('Script ' + name + ' was not found in the central zinja repository. Try \'zj search\'');
            }

            //TODO: So something better with the error
            return cb(response.statusCode);
        }

        remoteCache.put(name, body, function(err) {});

        cb(null, body);
    });
}

function executeScript(script, args) {
    var tempFilePath = '';

    temp.open('zinja', function tempFileCreated(err, tmpFile) {
        tempFilePath = tmpFile.path;
        fs.write(tmpFile.fd, script, onFileWritten);
    });

    function onFileWritten(err) {
        if(err != null) {
            console.error('Could not write script temp file:');
            console.error(err);
            process.exit(1);
        }

        /*var bashArgs = args.join(' ');
        var command = 'source ' + tempFilePath + ' ' + bashArgs;*/

        var chmodResult = execa.shellSync('chmod +x ' + tempFilePath);

        if(chmodResult.error) {
            console.error(chmodResult.stderr);
            console.error('Could not make the script tempfile executable because of:');
            console.error(chmodResult.error);
            process.exit(1);
        }

        var child = execa(tempFilePath, args);//childProcess.exec(command);

        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);


        child.on('exit', function(exitCode) {
            process.exit(exitCode);
        });

        child.on('error', function(error) {
            console.error(error);
            process.exit(1);
        });
    }
}

module.exports = execute;
