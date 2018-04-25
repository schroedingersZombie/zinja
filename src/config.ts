const HOST = 'https://api.zinja.io'

function getUserHome() {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME']
}

export const config = {
    api: {
        scripts: HOST + '/scripts',
        users: HOST + '/users',
        login: HOST + '/login',
    },
}
