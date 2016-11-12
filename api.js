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

function handleResponseError(err) {
    if(err != null)
        return onConnectionProble();
}

function handlePotentialScriptResponseError(response) {
    if(response.statusCode != 200) {
        if(response.statusCode == 404) {
            console.error('Script ' + name + ' was not found in the central zinja repository. Try \'zj search\'');
        } else {
            onOtherError(response);
        }

        process.exit(1);
    }
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
    request.get(endpoints.scripts + '/' + name, onResponse);

    function onResponse(err, response, body) {
        handleResponseError(err);
        handlePotentialScriptResponseError(response);

        remoteCache.put(getCacheName(name), body, assertError);

        cb(body);
    }
}

function fetchScriptInfo(name, cb) {
    return request.get({
        uri: endpoints.scripts + '/' + name + '/info',
        json: true
    }, onResponse);

    function onResponse(err, response, body) {
        handleResponseError(err);
        handlePotentialScriptResponseError(response);

        remoteCache.put(getCacheName(name), body.script, assertError);

        return cb(body);
    }
}

function postUser(user, cb) {
    request({
        body: user,
        uri: endpoints.users,
        method: 'POST',
        json: true
    }, onResponse);

    function onResponse(err, response) {
        handleResponseError(err);

        switch (response.statusCode) {
            case 201:
                return cb();
            case 409:
                console.log('A user with that name already exists');
                process.exit(1);
            default:
                return onOtherError(response);
        }
    }
}

function searchScripts(query, cb) {
    request.get({
        uri: endpoints.scripts,
        method: 'GET',
        qs: {
            q: query
        },
        json: true
    }, onResponse);

    function onResponse(err, response, body) {
        handleResponseError(err);

        if(response.statusCode != 200)
            return onOtherError(response);

        cb(body);
    }
}

module.exports = {
    fetchRemoteScript: fetchRemoteScript,
    fetchScriptInfo: fetchScriptInfo,
    postUser: postUser,
    searchScripts: searchScripts
};
