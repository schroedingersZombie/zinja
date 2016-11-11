const fs = require('fs');
const basename = require('path').basename;
const request = require('request');
const cache = require('persistent-cache');
const temp = require('temp').track();
const assertError = require('assert').ifError;
const execa = require('execa');

const onConnectionProblem = require('./connection-problem');
const localScripts = cache({ name: 'local' });
const remoteCache = cache({ duration: 1000 * 3600 * 24 * 7 });
const scriptsEndpoint = require('./config').api.scripts;

function getCacheName(fullScriptName) {
    return fullScriptName.replace('/', '_');
}

function isLocalScript(name) {
    return name.indexOf('/') == -1;
}

function fetchScript(name, cb) {
    if(isLocalScript(name)) {
        return localScripts.get(name, onLocalCache);
    } else {
        return remoteCache.get(getCacheName(name), onRemoteCache);
    }

    function onLocalCache(err, script) {
        if(err != null)
            return cb(err);

        if(script === undefined)
            return cb('Script ' + name + ' was not found in the local repository');

        return cb(null, script);
    }

    function onRemoteCache(err, script) {
        if(err)
            return cb(err);

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
            } else {
                console.error('Error: ' + response.body);
            }

            //TODO: So something better with the error
            return cb(response.statusCode);
        }

        remoteCache.put(getCacheName(name), body, assertError);

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
