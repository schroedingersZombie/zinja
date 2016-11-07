const request = require('request');
const columns = require('cli-columns');

const scriptsEndpoint = 'http://localhost:8080/scripts';
const onConnectionProblem = require('./connection-problem');

function search(query) {
    request.get({
        uri: scriptsEndpoint,
        method: 'GET',
        qs: {
            q: query
        }
    }, onResponse);

    function onResponse(err, response, body) {
        if (err != null) {
            return onConnectionProblem();
        }

        console.log(columns(JSON.parse(body)));
    }
}

module.exports = search;
