var columnify = require('columnify');
var request = require('request');

var onConnectionProblem = require('./connection-problem');

var scriptsEndpoint = 'http://localhost:8080/scripts';

function info(name) {
    request.get({
        uri: scriptsEndpoint + '/' + name + '/info',
        json: true
    }, function(err, response, scriptInfo) {
        if (err != null) {
            onConnectionProblem();
            process.exit(1);
        }

        if(response.statusCode != 200) {
            if(response.statusCode == 404) {
                console.error('Script ' + name + ' was not found in the central zinja repository. Try \'zj search\'');
            } else {
                console.error('Error: ' + response.body);
            }

            process.exit(1);
        }

        var output = {
            'Name:': scriptInfo.name,
            'Author:': scriptInfo.user
        };


        console.log(columnify(output, {
            showHeaders: false,
            config: {
                key: {
                    align: 'right'
                }
            }
        }));

        if (scriptInfo.description) {
            console.log();
            console.log('Descrirption');
            console.log('------------');
            console.log(scriptInfo.description);
        }

        console.log();
        console.log('Source');
        console.log('------');
        console.log(scriptInfo.script);
    });
}

module.exports = info;
