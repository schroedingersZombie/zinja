const request = require('request')
const cache = require('persistent-cache')
const assertError = require('assert').ifError

const localScripts = require('./local-repository')
const remoteCache = require('./remote-cache')
const HOST = 'https://api.zinja.io'
const endpoints = {
    scripts: HOST + '/scripts',
    users: HOST + '/users',
    login: HOST + '/login',
}

function onConnectionProblem() {
    console.error('Could not connect to the repository, maybe there is a problem with your internet connection or we are currently under maintenance? Check zinja.io for updates or try again later')
    process.exit(1)
}

function handleResponseError(err) {
    if (err != null)
        return onConnectionProblem()
}

function handlePotentialScriptResponseError(response, name) {
    if (!response.statusCode.toString().startsWith('2')) {
        if (response.statusCode == 404)
            console.error('Script ' + name + ' was not found in the central zinja repository. Try \'zj search\'')
        else
            onOtherError(response)

        process.exit(1)
    }
}

function onOtherError(response) {
    console.error('Th server responded with an error:')
    console.error(response.statusCode)
    console.error(response.body)
    process.exit(1)
}

function getCacheName(fullScriptName) {
    return fullScriptName.replace('/', '_')
}

function fetchRemoteScript(name, cb) {
    request.get(endpoints.scripts + '/' + name, onResponse)

    function onResponse(err, response, body) {
        handleResponseError(err)
        handlePotentialScriptResponseError(response, name)

        remoteCache.put(getCacheName(name), body, assertError)

        cb(body)
    }
}

function fetchScriptInfo(name, cb) {
    return request.get({
        uri: endpoints.scripts + '/' + name + '/info',
        json: true,
    }, onResponse)

    function onResponse(err, response, body) {
        handleResponseError(err)
        handlePotentialScriptResponseError(response, name)

        remoteCache.put(getCacheName(name), body.script, assertError)

        return cb(body)
    }
}

function postUser(user, cb) {
    request({
        body: user,
        uri: endpoints.users,
        method: 'POST',
        json: true,
    }, onResponse)

    function onResponse(err, response) {
        handleResponseError(err)

        switch (response.statusCode) {
            case 201:
                return cb()
            case 409:
                console.log('A user with that name already exists')
                process.exit(1)
            default:
                return onOtherError(response)
        }
    }
}

function searchScripts(query, cb) {
    request.get({
        uri: endpoints.scripts,
        method: 'GET',
        qs: {
            q: query,
        },
        json: true,
    }, onResponse)

    function onResponse(err, response, body) {
        handleResponseError(err)

        if (response.statusCode != 200)
            return onOtherError(response)

        cb(body)
    }
}

//Callback has boolean parameter to indicate if it needs patch
function postScript(script, creds, cb) {
    request({
        body: script,
        uri: endpoints.scripts,
        method: 'POST',
        json: true,
        auth: creds,
    }, onResponse)

    function onResponse(err, response) {
        handleResponseError(err)

        switch (response.statusCode) {
            case 201:
                remoteCache.put(creds.user + '_' + script.name, script.script, assertError)

                return cb(false)
            case 401:
                console.error('Authentication failed')
                process.exit(1)
            case 409:
                if (response.headers['x-conflicting-user'] == creds.user)
                    return cb(true)

                console.error('A script with that name already exists')
                process.exit(1)
            default:
                return onOtherError(response)
        }
    }
}

function patchScript(name, patch, creds, cb) {
    return request.patch({
        body: patch,
        uri: endpoints.scripts + '/' + name,
        method: 'PATCH',
        json: true,
        auth: creds,
    }, onPatched)

    function onPatched(err, response) {
        handleResponseError(err)

        if (response.statusCode != 204)
            return onOtherError(response)

        if (patch.script)
            remoteCache.put(getCacheName(name), patch.script, assertError)

        return cb()
    }
}

function deleteScript(name, creds, cb) {
    return request({
        uri: endpoints.scripts + '/' + name,
        method: 'DELETE',
        auth: creds,
    }, onDeleted)

    function onDeleted(err, response) {
        handleResponseError(err)
        handlePotentialScriptResponseError(response, name)

        if (response.statusCode != 204)
            return onOtherError(response)

        remoteCache.delete(getCacheName(name), assertError)

        return cb()
    }
}

module.exports = {
    fetchRemoteScript,
    fetchScriptInfo,
    postUser,
    searchScripts,
    postScript,
    patchScript,
    deleteScript,
}
