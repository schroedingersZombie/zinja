const request = require('request');
const cache = require('persistent-cache');
const assertError = require('assert').ifError;

const remoteCache = cache({ duration: 1000 * 3600 * 24 * 7 });
const HOST = 'https://api.zinja.io';
const endpoints = {
    scripts: HOST + '/scripts',
    users: HOST + '/users',
    login: HOST + '/login'
};

function onConnectionProblem() {
    console.error('Could not connect to the repository, maybe there is a problem with your internet connection or we are currently under maintenance? Check zinja.io for updates or try again later');
    process.exit(1);
}

function onOtherError(response) {
    console.error('Th server responded with an error:');
    console.error(response.statusCode);
    console.error(response.body);
    process.exit(1);
}

function getCacheName(fullScriptName) {
    return fullScriptName.replace('/', '_');
}

function fetchRemoteScript(name, cb) {
    request.get(endpoints.scripts + '/' + name, function(err, response, body) {
        if(err != null) {
            return onConnectionProblem();
        }

        if(response.statusCode != 200) {
            if(response.statusCode == 404) {
                console.error('Script ' + name + ' was not found in the central zinja repository. Try \'zj search\'');
                process.exit(1);
            } else {
                onOtherError();
            }
        }

        remoteCache.put(getCacheName(name), body, assertError);

        cb(body);
    });
}

module.exports = {
    fetchRemoteScript: fetchRemoteScript
};
