#! /usr/bin/env node

var program = require('commander');

var core = require('./lib/ninja-core');


program
    .version('0.1.0')
    .arguments('[options] <cmd> [command-arguments...]')
    .usage('[options] <command> [arguments...]');

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


program.parse(process.argv);


//core(args);
