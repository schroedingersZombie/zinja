var request = require('request');
const inquirer = require('inquirer');

const onConnectionProblem = require('./connection-problem');

var usersEndpoint = 'http://localhost:8080/users';

function registerNewUser() {
    inquirer.prompt([{
        message: 'Username:',
        name: 'user',
        type: 'input'
    }, {
        message: 'Password:',
        name: 'password',
        type: 'password',
        validate: function(value) {
            if (value.length < 8)
                return 'Password must have at least 8 characters'

            if (value.length > 60)
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
        validate: function(value) {
            return /^\S+@\S+$/.test(value) || 'Please enter a valid e-mail address';
        }
    }]).then(function(answers) {
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
        if (err != null)
            return onConnectionProblem();

        switch (response.statusCode) {
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

module.exports = registerNewUser;
