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
var Promise = require('promise');
var assertError = require('assert').ifError;
var columnify = require('columnify');

var name = basename(process.argv[1], '.js');

var scriptsEndpoint = 'http://localhost:8080/scripts';
var usersEndpoint = 'http://localhost:8080/users';
var loginEndpoint = 'http://localhost:8080/login';

var localScripts = cache({
    name: 'local'
});

var settings = cache({
    name: 'settings'
});
var CREDENDTIALS_KEY = 'credentials';

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
    .option('-s, --string', 'Interpret the file argument as the script in string form instead of a file containing the script')
    .description('Registers a script in the local repository')
    .action(register);

program
    .command('unregister <name>')
    .description('Deletes the given script from the local repository')
    .action(unregister);

program
    .command('publish <file>')
    .option('-s, --string', 'Interpret the file argument as the script in string form instead of a file containing the script')
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

program
    .command('login')
    .description('Log into your zinja account (stoes credentials so oyu do not have to enter them everytime)')
    .action(login);

program
    .command('logout')
    .description('Log out of the currently logged in zinja account')
    .action(logout);

program
    .command('register-new-user')
    .description('Register a new zinja account')
    .action(registerNewUser);



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
            }

            //TODO: So something better with the error
            return cb(response.statusCode);
        }

        remoteCache.put(name, body, function(err) {});

        cb(null, body);
    });
}

function info(name) {
    request.get({
        uri: scriptsEndpoint + '/' + name + '/info',
        json: true
    }, function(err, response, scriptInfo) {
        if(err != null) {
            process.exit(1);
        }

        var output = {
            'Name:': scriptInfo.name,
            'Author:': scriptInfo.user
        };


        console.log(columnify(output, { showHeaders: false, config: { key: { align: 'right' } } }));

        if(scriptInfo.description) {
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

function register(name, fileName, options) {
    if(options.string) {
        onFileRead(null, fileName);
    } else {
        fs.readFile(fileName, 'utf8', onFileRead);
    }

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

function republish(name, fileName) {

}

function publish(fileName, options) {
    inquirer.prompt([{
        message: 'Enter the name the script should be published under:',
        name: 'name',
        type: 'input',
        validate: function(name) {
            if(!name.match(/^[a-z]+(-[a-z0-9]+)*$/))
                return 'Invalid name. Script names can only contain lowercase letters, numbers and dashes and must begin with a letter';

            if(name.length > 60 || name.length < 4)
                return 'Script name must be at lest 4 and at most 60 characters long';

            return true;
        }
    },{
        message: 'Do you want to add a description to explain how to use the script?',
        name: 'addDescription',
        type: 'confirm'
    }, {
        message: 'Enter the description (your default editor is used)',
        name: 'description',
        type: 'editor',
        when: function(answers) { return answers.addDescription; }
    }]).then(function(answers) {
        return getCredentials().then(function (creds) {
            creds.name = answers.name;
            return creds;
        });
    }).then(function(answers) {
        if(options.string) {
            onFileRead(null, fileName);
        } else {
            fs.readFile(fileName, 'utf8', onFileRead);
        }

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

            function onResponse(err, response, body) {
                if(err != null)
                    return onConnectionProblem();

                switch (response.statusCode) {
                    case 201:
                        console.log('Successfully published script ' + answers.name);
                        break;
                    case 401:
                        console.error('Authentication failed');
                        process.exit(1);
                    case 409:
                        if(response.headers['x-conflicting-user'] == answers.user)
                        return askForPatch(answers.name,
                            {
                                script: content
                                //TODO: add description
                            },{
                                user: answers.user,
                                password: answers.password
                            });

                        console.error('A script with that name already exists');
                        process.exit(1);
                        default:
                        console.error('There was some problem with the server. Try again later.');
                }
            }
        }
    });
 }

function askForPatch(name, patch, credentials, cb) {
    cb = cb || function(){};

    inquirer.prompt([{
        message: 'You already have a script with that name published. Do you want to overwrite it?',
        type: 'confirm',
        name: 'patch'
    }]).then(function(answers) {
        if(answers.patch) {
            return request.patch({
                 body: patch,
                 uri: scriptsEndpoint + '/' + name,
                 method: 'PATCH',
                 json: true,
                 auth: credentials
            }, onPatched);
        }

        return cb(null, false);
    });

    function onPatched(err) {
        if(err != null) {
            onConnectionProblem();
            return cb(err);
        }

        console.log('Script has been updated successfully');
    }
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

function getCredentials() {
    return getStoredCredentials().then(function (creds) {
        console.log('Found stored credentials for user ' + creds.user);

        return creds;
    }).catch(askForCredentials);
}

function askForCredentials(saveWithoutAsking) {
    console.log('Enter your credentials (if you do not have an account yet, run zj register-new-user)');

    //TODO: Ask to save credentials

    return inquirer.prompt([
        {
            message: 'Username:',
            name: 'user',
            type: 'input'
        }, {
            message: 'Password:',
            name: 'password',
            type: 'password'
        }, {
            message: 'Should those credentials be stored so you do not have to enter them again?',
            name: 'shouldSave',
            type: 'confirm',
            when: !saveWithoutAsking
        }
    ]).then(function (creds) {
        if(saveWithoutAsking || creds.shouldSave) {
            settings.put(CREDENDTIALS_KEY, creds.user + ':' + creds.password, assertError);
        }

        delete creds.shouldSave;

        return creds;
    });
}

function login() {
    askForCredentials(true).then(function (creds) {
        request({
            uri: loginEndpoint,
            method: 'GET',
            auth: creds
        }, onResponse);
    });

    function onResponse(err, response) {
        if(err)
            return onConnectionProblem();

        switch(response.statusCode) {
            case 204:
                return console.log('Logged in successfully');
            case 401:
                console.error('Authentication failed');
                deleteStoredCredentials();
                process.exit(1);
            default:
                deleteStoredCredentials();
                onConnectionProblem();
        }
    }
}

function logout() {
    getStoredCredentials().then(function() {
        deleteStoredCredentials(onLoggedOut);
    }).catch(function() {
        console.log('You are not logged in');
    });

    function onLoggedOut(err) {
        assertError(err);

        console.log('Logged out successfully');
    }
}

function deleteStoredCredentials(cb) {
    settings.delete(CREDENDTIALS_KEY, cb);
}

function registerNewUser() {
    inquirer.prompt([
        {
            message: 'Username:',
            name: 'user',
            type: 'input'
        }, {
            message: 'Password:',
            name: 'password',
            type: 'password',
            validate: function(value) {
                if(value.length < 8)
                    return 'Password must have at least 8 characters'

                if(value.length > 60)
                    return 'Password can not have more than 60 characters';

                return true;
            }
        }, {
            message: 'Repeat password:',
            name: 'password',
            type: 'password',
            validate: function(value, answers) {
                return value == answers.password || 'Password repeat and password do not match';
            }
        }, {
            message: 'E-Mail (used only to recover your account):',
            name: 'email',
            type: 'input',
            validate: function (value) {
                return /^\S+@\S+$/.test(value) || 'Please enter a valid e-mail address';
            }
        }]).then(function (answers) {
            request({
                body: {
                    username: answers.user,
                    password: answers.password,
                    email: answers.email
                },
                uri: usersEndpoint,
                method: 'POST',
                json: true
            }, onResponse);
        });

    function onResponse(err, response) {
        if(err != null)
            return onConnectionProblem();

        switch(response.statusCode) {
            case 201:
                console.log('User successfully registered. Have fun using zinja!');
                return;
            case 409:
                console.log('A user with that name already exists');
                break;
            default:
                onConnectionProblem();
        }
    }
}

function getStoredCredentials() {
    return new Promise(function(resolve, reject) {
        settings.get(CREDENDTIALS_KEY, function(err, credentials) {
            if(!credentials)
                return reject();

            var split = credentials.split(':');
            var user = split[0];
            var password = split.slice(1).join('');

            resolve({
                user: user,
                password: password
            });
        });
    });
}
