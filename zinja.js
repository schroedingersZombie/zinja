#! /usr/bin/env node

const fs = require('fs');
const program = require('commander');
const request = require('request');
const inquirer = require('inquirer');
const cache = require('persistent-cache');
const Promise = require('promise');
const assertError = require('assert').ifError;

const onConnectionProblem = require('./connection-problem');
const api = require('./api');
const scriptsEndpoint = require('./config').api.scripts;
const loginEndpoint = require('./config').api.login;
const settings = cache({ name: 'settings' });
const remoteCache = require('./remote-cache');
var CREDENDTIALS_KEY = 'credentials';

program
    .version('0.1.0')
    .arguments('<cmd> [command-arguments...]')
    .usage('<command> [arguments...]');

program
    .command('* [command-arguments...]')
    .description('Execute the zinja script * (for example \'zj hello-world\' will execute the hello-world script)')
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
    .command('search <query>')
    .description('Searches the central zinja repository for scripts matching the query')
    .action(search);

program
    .command('info <name>')
    .description('Shows the source of and other available information on the specified script')
    .action(info);

program
    .command('install <name>')
    .description('Registers the given remote script as local script')
    .action(install);

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

program
    .command('clear-cache')
    .description('Clears the cache for the central zinja repository')
    .action(clearCache);

program
    .command('list-local')
    .description('Lists all scirpts in the local repository')
    .action(listLocal);

program.parse(process.argv);

function toBeImplemented() {
    console.log('To be implemented');
}

if (!process.argv.slice(2).length) {
    program.outputHelp();
}

function register(name, fileName, options) {
    require('./register')(name, fileName, options);
}

function unregister(name) {
    require('./unregister')(name);
}

function clearCache() {
    require('./clear-cache')();
}

function publish(fileName, options) {
    getCredentials().then(function(creds) {
        return inquirer.prompt([{
            message: 'Enter the name the script should be published under: ' + creds.user + '/',
            name: 'name',
            type: 'input',
            validate: function(name) {
                if (!name.match(/^[a-z]+(-[a-z0-9]+)*$/))
                return 'Invalid name. Script names can only contain lowercase letters, numbers and dashes and must begin with a letter';

                if (name.length > 60 || name.length < 4)
                return 'Script name must be at lest 4 and at most 60 characters long';

                return true;
            }
        }, {
            message: 'Do you want to add a description to explain how to use the script?',
            name: 'addDescription',
            type: 'confirm'
        }, {
            message: 'Enter the description (your default editor is used)',
            name: 'description',
            type: 'editor',
            when: function(answers) {
                return answers.addDescription;
            }
        }]).then(function(answers) {
            answers.creds = creds;
            return answers;
        });
    }).then(function(answers) {
        if (options.string) {
            onFileRead(null, fileName);
        } else {
            fs.readFile(fileName, 'utf8', onFileRead);
        }

        function onFileRead(err, content) {
            if (err != null) {
                console.error('Could not read file ' + fileName);
                process.exit(1);
            }

            if (!content.startsWith('#!'))
                askForShebang(addPrefixAndDoRequest);
            else
                addPrefixAndDoRequest(null, '');

            function addPrefixAndDoRequest(err, prefix) {
                assertError(err);

                content = prefix + content;

                var payload = {
                    name: answers.name,
                    script: content
                };

                if(answers.addDescription)
                    payload.description = answers.description;

                api.postScript(payload, answers.creds, onResponse);
            }

            function onResponse(canOnlyBePatched) {
                if (canOnlyBePatched) {
                    var patch = { script: content };

                    if(answers.addDescription)
                        patch.description = answers.description;

                    return askForPatch(answers.creds.user + '/' + answers.name, patch, answers.creds);
                } else {
                    console.log('Successfully published script ' + answers.name);
                }
            }
        }
    });
}

function askForShebang(cb) {
    inquirer.prompt([{
        message: 'Your script does not have a shebang (#!/some/interpreter). A shebang makes sure that your script is always being run with the same interpreter, to avoid incompatibility issues (e.g. betweegn zsh and bash).\nWhat do you want to do?',
        type: 'list',
        name: 'prefix',
        choices: [{
            name: 'Add Shebang for sh (default for most shell scripts)',
            short: 'Add Shebang for sh',
            value: '#!/bin/sh\n'
        }, {
            name: 'Add Shebang for bash',
            value: '#!/bin/bash\n'
        }, new inquirer.Separator(), {
            name: 'I am aware of the consequences and want my script to be executed in the users current shell (do not add a shebang)',
            short: 'Do not add a shebang',
            value: ''
        }]
    }]).then(function(answers) {
        cb(null, answers.prefix);
    });
}

function askForPatch(name, patch, credentials) {
    inquirer.prompt([{
        message: 'You already have a script with that name published. Do you want to overwrite it?',
        type: 'confirm',
        name: 'patch'
    }]).then(function(answers) {
        if (answers.patch)
            return api.patchScript(name, patch, credentials, onPatched);
    });

    function onPatched() {
        console.log('Script has been updated successfully');
    }
}

function execute(args) {
    require('./execute')(args);
}

function info(name) {
    require('./info')(name);
}

function search(query) {
    require('./search')(query);
}

function install(name) {
    require('./install')(name);
}

function getCredentials() {
    return getStoredCredentials().then(function(creds) {
        console.log('Found stored credentials for user ' + creds.user);

        return creds;
    }).catch(askForCredentials);
}

function askForCredentials(saveWithoutAsking) {
    console.log('Enter your credentials (if you do not have an account yet, run zj register-new-user)');

    //TODO: Ask to save credentials

    return inquirer.prompt([{
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
    }]).then(function(creds) {
        if (saveWithoutAsking || creds.shouldSave) {
            settings.put(CREDENDTIALS_KEY, creds.user + ':' + creds.password, assertError);
        }

        delete creds.shouldSave;

        return creds;
    });
}

function login() {
    askForCredentials(true).then(function(creds) {
        request({
            uri: loginEndpoint,
            method: 'GET',
            auth: creds
        }, onResponse);
    });

    function onResponse(err, response) {
        if (err)
            return onConnectionProblem();

        switch (response.statusCode) {
            case 204:
                return console.log('Logged in successfully');
            case 401:
                console.error('Authentication failed');
                deleteStoredCredentials();
                process.exit(1);
            default:
                deleteStoredCredentials();
                console.error('Error: ' + response.body);
                process.exit(1);
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
    require('./register-new-user')();
}

function listLocal() {
    require('./list-local')();
}

function getStoredCredentials() {
    return new Promise(function(resolve, reject) {
        settings.get(CREDENDTIALS_KEY, function(err, credentials) {
            if (!credentials)
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
