#! /usr/bin/env node

var http = require('http');
var fs = require('fs');
var childProcess = require('child_process');

//Cut off 'node' and 'ninja.js' from the arguments
var args = process.argv.slice(2);

var ninjaUrl = 'http://localhost:2313/api/scripts';

if(args.length == 0) {
  console.log('Usage: ninja [command]');
  process.exit(1);
}

http.get(ninjaUrl + '?name=' + args[0], function(response) {
  if(response.statusCode != 200) {
    console.error('Error:');

    response.on('data', console.error);

    return;
  }

  var tempFile = fs.createWriteStream('./temp.ninja');
  response.pipe(tempFile);

  tempFile.on('finish', executeScript);
});

function executeScript() {
  var bashArgs = args.slice(1).join(' ');
  var command = 'source ./temp.ninja ' + bashArgs;

  childProcess.exec(command, function(err, stdout, stderr) {
    if(err !== null) {
      console.error(stderr);
      return;
    }

    console.log(stdout);

    fs.unlink('./temp.ninja');
  });
}
