import * as request from 'request'
import * as cache from './persistent-cache'
import { ifError } from 'assert'

import { localRepository } from './local-repository'
import { remoteCache } from './remote-cache'

const HOST = 'https://api.zinja.io'
const endpoints = {
    scripts: HOST + '/scripts',
    users: HOST + '/users',
    login: HOST + '/login',
}

export interface Script {
    name: string
    script: string
    description?: string
    user?: string
}

export interface ScriptPatch {
    name?: string
    script?: string
    description?: string
    user?: string
}

export interface Credentials {
    user: string
    password: string
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
        if (response.statusCode === 404)
            console.error('Script ' + name + ' was not found in the central zinja repository. Try \'zj search\'')
        else
            onOtherError(response)

        process.exit(1)
    }
}

function onOtherError(response) {
    console.error('The server responded with an error:')
    console.error(response.statusCode)
    console.error(response.body)
    process.exit(1)
}

function getCacheName(fullScriptName) {
    return fullScriptName.replace('/', '_')
}

export function fetchRemoteScript(name, cb) {
    request.get(endpoints.scripts + '/' + name, onResponse)

    function onResponse(err, response, body) {
        handleResponseError(err)
        handlePotentialScriptResponseError(response, name)

        remoteCache.put(getCacheName(name), body, ifError)

        cb(body)
    }
}

export function fetchScriptInfo(name, cb) {
    return request.get({
        uri: endpoints.scripts + '/' + name + '/info',
        json: true,
    }, onResponse)

    function onResponse(err, response, body) {
        handleResponseError(err)
        handlePotentialScriptResponseError(response, name)

        remoteCache.put(getCacheName(name), body.script, ifError)

        return cb(body)
    }
}

export function postUser(user, cb) {
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

export function searchScripts(query, cb) {
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

        if (response.statusCode !== 200)
            return onOtherError(response)

        cb(body)
    }
}

// Callback has boolean parameter to indicate if it needs patch
export function postScript(script: Script, creds: Credentials, cb) {
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
                remoteCache.put(creds.user + '_' + script.name, script.script, ifError)

                return cb(false)
            case 401:
                console.error('Authentication failed')
                process.exit(1)
            case 409:
                if (response.headers['x-conflicting-user'] === creds.user)
                    return cb(true)

                console.error('A script with that name already exists')
                process.exit(1)
            default:
                return onOtherError(response)
        }
    }
}

export function patchScript(name: string, patch: ScriptPatch, creds: Credentials, cb) {
    return request.patch({
        body: patch,
        uri: endpoints.scripts + '/' + name,
        method: 'PATCH',
        json: true,
        auth: creds,
    }, onPatched)

    function onPatched(err, response) {
        handleResponseError(err)

        if (response.statusCode !== 204)
            return onOtherError(response)

        if (patch.script)
            remoteCache.put(getCacheName(name), patch.script, ifError)

        return cb()
    }
}

export function deleteScript(name, creds: Credentials, cb) {
    return request({
        uri: endpoints.scripts + '/' + name,
        method: 'DELETE',
        auth: creds,
    }, onDeleted)

    function onDeleted(err, response) {
        handleResponseError(err)
        handlePotentialScriptResponseError(response, name)

        if (response.statusCode !== 204)
            return onOtherError(response)

        remoteCache.delete(getCacheName(name), ifError)

        return cb()
    }
}

export default {
    fetchRemoteScript,
    fetchScriptInfo,
    postUser,
    searchScripts,
    postScript,
    patchScript,
    deleteScript,
}
