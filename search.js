const request = require('request');
const columns = require('cli-columns');

const scriptsEndpoint = require('./config').api.scripts;
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

        if(response.statusCode != 200) {
            console.error('Error: ' + response.body);
            process.exit(1);
        }

        var scriptNames = JSON.parse(body);

        if(scriptNames.length > 0)
            console.log(columns(scriptNames));
        else
            console.log('No scripts with a name containing \'' + query + '\' found');
    }
}

module.exports = search;
