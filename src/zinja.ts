#! /usr/bin/env node

import { readFile } from 'fs'
import * as program from 'commander'
import * as request from 'request'
import * as inquirer from 'inquirer'
import { ifError as assertError } from 'assert'
import { cache } from './persistent-cache'
import { onConnectionProblem } from './connection-problem'
import { deleteScript, patchScript, postScript, ScriptPatch, Credentials, Script } from './api'
import { config } from './config'
import { remoteCache } from './remote-cache'

const scriptsEndpoint = config.api.scripts
const loginEndpoint = config.api.login

const settings = cache({ name: 'settings' })
const CREDENDTIALS_KEY = 'credentials'
const SCRIPT_NAME_REGEX = /^[a-z]+(-[a-z0-9]+)*$/

program
    .version('0.1.0')
    .arguments('<cmd> [command-arguments...]')
    .usage('<command> [arguments...]')

program
    .command('* [command-arguments...]')
    .description('Execute the zinja script * (for example \'zj hello-world\' will execute the hello-world script)')
    .action(execute)

program
    .command('register <name> <file>')
    .description('Registers a script in the local repository')
    .option('-s, --string', 'Interpret the file argument as the script in string form instead of a file containing the script')
    .action(register)

program
    .command('unregister <name>')
    .description('Deletes the given script from the local repository')
    .action(unregister)

program
    .command('publish <file>')
    .option('-s, --string', 'Interpret the file argument as the script in string form instead of a file containing the script')
    .option('-n, --name <name>', 'Name the script should be published under', /^[a-z]+(-[a-z0-9]+)*$/)
    .option('-d, --desc <desc>', 'Description for the script')
    .option('-D, --no-desc', 'Do not add a description to the script')
    .option('-p, --patch', 'Patches an already published script')
    .description('Publishes the given script to the central zinja repository')
    .action(publish)

program
    .command('unpublish <name>')
    .description('Removes the given script from the central zinja repository')
    .action(unpublish)

program
    .command('search <query>')
    .description('Searches the central zinja repository for scripts matching the query')
    .action(search)

program
    .command('info <name>')
    .description('Shows the source of and other available information on the specified script')
    .action(info)

program
    .command('install <name>')
    .description('Registers the given remote script as local script')
    .action(install)

program
    .command('login')
    .description('Log into your zinja account (stoes credentials so oyu do not have to enter them everytime)')
    .action(login)

program
    .command('logout')
    .description('Log out of the currently logged in zinja account')
    .action(logout)

program
    .command('register-new-user')
    .description('Register a new zinja account')
    .action(registerNewUser)

program
    .command('clear-cache')
    .description('Clears the cache for the central zinja repository')
    .action(clearCache)

program
    .command('list-local')
    .description('Lists all scirpts in the local repository')
    .action(listLocal)

program.parse(process.argv)

function toBeImplemented() {
    console.log('To be implemented')
}

if (!process.argv.slice(2).length)
    program.outputHelp()

function register(name, fileName, options) {
    require('./register')(name, fileName, options)
}

function unregister(name) {
    require('./unregister')(name)
}

function clearCache() {
    require('./clear-cache')()
}

async function publish(fileName, options) {
    // console.dir(fileName);
    // for(var i in options) console.log(i);
    // process.exit(0);

    const creds = await getCredentials()

    const answers = await inquirer.prompt([{
            message: 'Enter the name the script should be published under: ' + creds.user + '/',
            name: 'name',
            type: 'input',
            validate: (name: string) => {
                if (!name.match(SCRIPT_NAME_REGEX))
                    return 'Invalid name. Script names can only contain lowercase letters, numbers and dashes and must begin with a letter'

                if (name.length > 60 || name.length == 0)
                    return 'Name must be between 1 and 60 characters long'

                return true
            },
            when: () => !!options.name,
        }, {
            message: 'Do you want to add a description to explain how to use the script?',
            name: 'addDescription',
            type: 'confirm',
            when: () => options.desc == undefined,
        }, {
            message: 'Enter the description (your default editor is used)',
            name: 'description',
            type: 'editor',
            when: answers => !!answers.addDescription,
        }
    ])

    answers.creds = creds
    answers.name = answers.name || options.name

    if (!answers.description && !!options.desc)
        answers.description = options.desc

    if (options.string)
        onFileRead(null, fileName)
    else
        readFile(fileName, 'utf8', onFileRead)


    function onFileRead(err, content) {
        if (err != null) {
            console.error('Could not read file ' + fileName)
            process.exit(1)
        }

        if (!content.startsWith('#!'))
            askForShebang(addPrefixAndDoRequest)
        else
            addPrefixAndDoRequest(null, '')

        function addPrefixAndDoRequest(err, prefix: string) {
            assertError(err)

            content = prefix + content

            const scriptToPost: Script = {
                name: answers.name,
                script: content,
            }

            if (answers.addDescription)
                scriptToPost.description = answers.description

            postScript(scriptToPost, answers.creds, onResponse)
        }

        function onResponse(canOnlyBePatched: boolean) {
            if (canOnlyBePatched) {
                const patch: ScriptPatch = { script: content }

                if (answers.addDescription)
                    patch.description = answers.description

                return askForPatch(`${answers.creds.user}/${answers.name}`, patch, answers.creds)
            }

            console.log(`Successfully published script ${answers.name}`)
        }
    }
}

async function unpublish(name: string) {
    const creds = await getCredentials()
    const fullScriptName = `${creds.user}/${name}`

    deleteScript(fullScriptName, creds, () => {
        console.log(`Script ${fullScriptName} successfully removed from zinja central`)
    })
}

async function askForShebang(cb) {
    const answers = await inquirer.prompt([{
        message: 'Your script does not have a shebang (#!/some/interpreter). A shebang makes sure that your script is always being run with the same interpreter, to avoid incompatibility issues (e.g. betweegn zsh and bash).\nWhat do you want to do?',
        type: 'list',
        name: 'prefix',
        choices: [ {
            name: 'Add Shebang for sh (default for most shell scripts)',
            short: 'Add Shebang for sh',
            value: '#!/bin/sh\n',
        }, {
            name: 'Add Shebang for bash',
            value: '#!/bin/bash\n',
        }, new inquirer.Separator(), {
            name: 'I am aware of the consequences and want my script to be executed in the users current shell (do not add a shebang)',
            short: 'Do not add a shebang',
            value: '',
        } ],
    }])

    cb(null, answers.prefix)
}

async function askForPatch(name: string, patch: ScriptPatch, credentials: Credentials) {
    const answers = await inquirer.prompt([ {
        message: 'You already have a script with that name published. Do you want to overwrite it?',
        type: 'confirm',
        name: 'patch',
    } ])

    if (answers.patch)
        return patchScript(name, patch, credentials, () => { console.log('Script has been updated successfully') })
}

function execute(args) {
    require('./execute')()
}

function info(name) {
    require('./info')(name)
}

function search(query) {
    require('./search')(query)
}

function install(name) {
    require('./install')(name)
}

async function getCredentials(): Promise<Credentials> {
    let creds: Credentials

    try {
        creds = await getStoredCredentials()

        console.log(`Found stored credentials for user ${creds.user}`)
    } catch (err) {
        creds = await askForCredentials()
    }

    return creds
}

async function askForCredentials(saveWithoutAsking = false): Promise<Credentials> {
    console.log('Enter your credentials (if you do not have an account yet, run zj register-new-user)')

    //TODO: Ask to save credentials

    const creds = await inquirer.prompt([ {
            message: 'Username:',
            name: 'user',
            type: 'input',
        }, {
            message: 'Password:',
            name: 'password',
            type: 'password',
        }, {
            message: 'Should those credentials be stored so you do not have to enter them again?',
            name: 'shouldSave',
            type: 'confirm',
            when: !saveWithoutAsking,
        }
    ])

    if (saveWithoutAsking || creds.shouldSave)
        settings.put(CREDENDTIALS_KEY, creds.user + ':' + creds.password, assertError)

    delete creds.shouldSave

    return creds
}

async function login() {
    const creds = await askForCredentials(true)

    request({
            uri: loginEndpoint,
            method: 'GET',
            auth: creds,
        },
        onResponse
    )

    function onResponse(err, response) {
        if (err)
            return onConnectionProblem()

        switch (response.statusCode) {
            case 204:
                return console.log('Logged in successfully')
            case 401:
                console.error('Authentication failed')
                deleteStoredCredentials()
                process.exit(1)
            default:
                deleteStoredCredentials()
                console.error('Error: ' + response.body)
                process.exit(1)
        }
    }
}

async function logout() {
    try {
        await getStoredCredentials()
        deleteStoredCredentials(onLoggedOut)
    } catch (err) {
        console.log('You are not logged in')
    }

    function onLoggedOut(err) {
        assertError(err)

        console.log('Logged out successfully')
    }
}

function deleteStoredCredentials(cb = assertError) {
    settings.delete(CREDENDTIALS_KEY, cb)
}

function registerNewUser() {
    require('./register-new-user')()
}

function listLocal() {
    require('./list-local')()
}

function getStoredCredentials(): Promise<Credentials> {
    return new Promise(function(resolve, reject) {
        settings.get(CREDENDTIALS_KEY, function(err, credentials) {
            if (!credentials)
                return reject()

            var split = credentials.split(':')
            var user = split[0]
            var password = split.slice(1).join('')

            resolve({
                user: user,
                password: password,
            })
        })
    })
}
