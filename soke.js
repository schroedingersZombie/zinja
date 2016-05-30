#! /usr/bin/env node

var program = require('commander');

var core = require('./lib/ninja-core');


program
    .version('0.1.0')
    .arguments('<cmd> [command-arguments...]')
    .usage('<command> [arguments...]');

program
    .command('* [command-arguments...]')
    .description('Execute the soke script * (for example \'soke hello-world\' will execute the hello-world script)')
    .action(core.execute);

program
    .command('register <name> <file>')
    .description('Registers a script in the local repository')
    .action(core.register);

program
    .command('unregister <name>')
    .description('Deletes the given script from the local repository')
    .action(core.unregister);

program
    .command('publish <name> <file>')
    .description('Publishes the given script to the central soke repository')
    .action(core.publish);

program
    .command('republish <name> <file>')
    .description('Republishes (updates) the given script to the central soke repository')
    .action(toBeImplemented);

program
    .command('search <query>')
    .description('Searches the central soke repository for scripts matching the query')
    .action(core.search);

program.parse(process.argv);

function toBeImplemented() {
    console.log('To be implemented');
}

if(!process.argv.slice(2).length) {
    program.outputHelp();
}
