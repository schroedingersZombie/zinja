#! /usr/bin/env node

var fs = require('fs');
var childProcess = require('child_process');
var basename = require('path').basename;

var program = require('commander');
var request = require('request');
var inquirer = require('inquirer');
var cache = require('persistent-cache');
var temp = require('temp').track();
var columns = require('cli-columns');

var name = basename(process.argv[1], '.js');

var scriptsEndpoint = 'http://localhost:8080/scripts';

var localScripts = cache({
    name: 'local'
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
    .description('Execute the zinja script * (for example \'' + name + ' hello-world\' will execute the hello-world script)')
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
    .command('publish <file>')
    .description('Publishes the given script to the central zinja repository')
    .action(publish);

program
    .command('republish <name> <file>')
    .description('Republishes (updates) the given script to the central zinja repository')
    .action(toBeImplemented);

program
    .command('search <query>')
    .description('Searches the central zinja repository for scripts matching the query')
    .action(search);

program
    .command('info <name>')
    .description('Shows the source of and other available information on the specified script')
    .action(info);

program.parse(process.argv);

function toBeImplemented() {
    console.log('To be implemented');
}

if(!process.argv.slice(2).length) {
    program.outputHelp();
}

function onConnectionProblem() {
    console.error('Could not connect to the repository, maybe there is a problem with your internet connection or we are currently under maintenance? Check zinja.io for updates or try again later');
    process.exit(1);
}

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
                console.error('Script ' + name + ' was not found in the central zinja repository. Try ' + name + ' search ' + name);
                cb(404);
            }

            //TODO: So something better with the error
            return cb(response.statusCode);
        }

        remoteCache.put(name, body, function(err) {});

        cb(null, body);
    });
}

function info(name) {
    fetchScript(name, function(err, script) {
        if(err != null) {
            process.exit(1);
        }

        console.log('Script ' + name + ' source:');
        console.log('----------');
        console.log(script);
        console.log('----------');
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

        var bashArgs = args.join(' ');
        var command = 'source ' + tempFilePath + ' ' + bashArgs;

        var child = childProcess.exec(command);

        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);

        child.on('close', function(exitCode) {
            process.exit(exitCode);
        });

        child.on('error', function() {
            process.exit(1);
        });
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

function publish(fileName) {
    inquirer.prompt([{
        message: 'Enter the name the script should be published under:',
        name: 'name',
        type: 'input',
        validate: function(name) {
            if(!name.match(/^[a-z]+(-[a-z0-9]+)*$/))
                return 'Invalid name. Script names can only contain lowercase letters, numbers and dashes and must begin with a letter';

            return true;
        }
    }, {
        message: 'Enter your username (if you haven\'t one yet, run zj register-new-user):',
        name: 'user',
        type: 'input'
    }, {
        message: 'Enter your password:',
        name: 'password',
        type: 'password'
    }]).then(function(answers) {
        fs.readFile(fileName, 'utf8', onFileRead);

        function onFileRead(err, content) {
            if(err != null) {
                console.error('Could not read file ' + fileName);
                process.exit(1);
            }

            request({
                body: {
                    name: answers.name,
                    script: content
                },
                uri: scriptsEndpoint,
                method: 'POST',
                json: true,
                auth: {
                    user: answers.user,
                    password: answers.password
                }
            }, onResponse);
        }

        function onResponse(err, response, body) {
            if(err != null) {
                return onConnectionProblem();
            }

            switch (response.statusCode) {
                case 201:
                    console.log('Successfully published script ' + answers.name);
                    break;
                case 401:
                    console.error('Authentication failed');
                    process.exit(1);
                case 409:
                    console.error('A script with that name already exists');
                    process.exit(1);
                default:
                    console.error('There was some problem with the server. Try again later.');
            }
        }
    });
 }

function search(query) {
    request.get({
        uri: scriptsEndpoint,
        method: 'GET',
        qs: {
            q: query
        }
    }, onResponse);

    function onResponse(err, response, body) {
        if(err != null) {
            return onConnectionProblem();
        }

        console.log(columns(JSON.parse(body)));
    }
}
