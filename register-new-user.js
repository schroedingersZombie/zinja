const inquirer = require('inquirer')

const api = require('./api')

async function registerNewUser() {
    const answers = await inquirer.prompt([{
            message: 'Username:',
            name: 'user',
            type: 'input',
        }, {
            message: 'Password:',
            name: 'password',
            type: 'password',
            validate: function(value) {
                if (value.length < 8)
                    return 'Password must have at least 8 characters'

                if (value.length > 60)
                    return 'Password can not have more than 60 characters'

                return true
            },
        }, {
            message: 'Repeat password:',
            name: 'password',
            type: 'password',
            validate: function(value, answers) {
                return value == answers.password || 'Password repeat and password do not match'
            },
        }, {
            message: 'E-Mail (used only to recover your account):',
            name: 'email',
            type: 'input',
            validate: function(value) {
                return /^\S+@\S+$/.test(value) || 'Please enter a valid e-mail address'
            },
        }]
    )

    api.postUser({
            username: answers.user,
            password: answers.password,
            email: answers.email,
        },
        onResponse
    )

    function onResponse() {
        console.log('User successfully registered. Have fun using zinja!')
    }
}

module.exports = registerNewUser
