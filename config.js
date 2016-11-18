const HOST = 'https://api.zinja.io';

function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

var config = {
    api: {
        scripts: HOST + '/scripts',
        users: HOST + '/users',
        login: HOST + '/login'
    }
}

module.exports = config;
