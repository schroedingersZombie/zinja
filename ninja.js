var http = require('http');
var childProcess = require('child_process');

var args = process.argv.slice(2);

var ninjaUrl = 'http://localhost:2313/api/scripts';

function executeScript(script) {
  childProcess.exec(script, function(err, stdout, stderr) {
    if(err !== null) {
      console.error(stderr);
      return;
    }

    console.log(stdout);
  });
}

http.get(ninjaUrl + '?name=' + args[0], function(response) {
  if(response.statusCode != 200) {
    console.error('Error:');

    response.on('data', console.error);
  }

  var script = '';

  response.setEncoding('utf-8');

  response.on('data', function(data) {
    script += data;
  });

  response.on('end', function() {
    executeScript(script);
  })
})
