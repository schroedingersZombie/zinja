#! /usr/bin/env node

var program = require('commander');
var request = require('request');
var fs = require('fs');
var childProcess = require('child_process');
var inquirer = require('inquirer');
var cache = require('persistent-cache');
var basename = require('path').basename;

var name = basename(process.argv[1], '.js');

var scriptsEndpoint = 'http://localhost:1718/api/scripts';
var searchEndpoint = 'http://localhost:1718/api/search';

var localScripts = cache({
    dir: 'local'
});

var remoteCache = cache({
    duration: 1000 * 3600 * 24 * 7
});

program
    .version('0.1.0')
    .arguments('<cmd> [command-arguments...]')
    .usage('<command> [arguments...]');

program
    .command('* [command-arguments...]')
    .description('Execute the soke script * (for example \'' + name + ' hello-world\' will execute the hello-world script)')
    .action(execute);

program
    .command('register <name> <file>')
    .description('Registers a script in the local repository')
    .action(register);

program
    .command('unregister <name>')
    .description('Deletes the given script from the local repository')
    .action(unregister);

program
    .command('publish <name> <file>')
    .description('Publishes the given script to the central soke repository')
    .action(publish);

program
    .command('republish <name> <file>')
    .description('Republishes (updates) the given script to the central soke repository')
    .action(toBeImplemented);

program
    .command('search <query>')
    .description('Searches the central soke repository for scripts matching the query')
    .action(search);

program.parse(process.argv);

function toBeImplemented() {
    console.log('To be implemented');
}

if(!process.argv.slice(2).length) {
    program.outputHelp();
}

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
                return console.error('Script ' + name + ' was not found in the central soke repository. Try ' + name + ' search ' + name);
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

        var child = childProcess.exec(command);

        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);

        child.on('close', function(exitCode) {
            fs.unlink('./temp.ninja');
            process.exit(exitCode);
        });

        child.on('error', function() {
            fs.unlink('./temp.ninja');
            process.exit(1);
        })
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

    var email = '';

    inquirer.prompt([{
        message: 'Please enter an email address to be used to maintain this script in the future',
        name: 'email',
        validate: function(input) {
            return input.indexOf('@') != -1;
        }
    }, {
        type: 'confirm',
        message: 'Are you sure this email address is correct? It is the only way to maintain the script',
        name: 'confirmation'
    }]).then(function(answers) {
        if(answers.confirmation)
            fs.readFile(fileName, 'utf8', onFileRead);
    });

    function onFileRead(err, content) {
        if(err != null) {
            console.error('Could not read file ' + fileName);
            process.exit(1);
        }

        request({
            body: {
                name: name,
                script: content,
                email: email
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
            console.error('Could not publish, maybe that name is already taken? Try ' + name + ' search ' + name);
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

        console.log(JSON.parse(body).join('\n'));
    }
}
