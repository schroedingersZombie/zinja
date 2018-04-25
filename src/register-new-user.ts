import * as inquirer from 'inquirer'
import { postUser } from './api'

export async function registerNewUser() {
    const answers = await inquirer.prompt([{
            message: 'Username:',
            name: 'user',
            type: 'input',
        }, {
            message: 'Password:',
            name: 'password',
            type: 'password',
            validate: value => {
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
            validate: (value, currentAnswers) =>
                value === currentAnswers.password || 'Password repeat and password do not match',
        }, {
            message: 'E-Mail (used only to recover your account):',
            name: 'email',
            type: 'input',
            validate: value => /^\S+@\S+$/.test(value) || 'Please enter a valid e-mail address',
        }],
    )

    postUser(
        {
            username: answers.user,
            password: answers.password,
            email: answers.email,
        },
        onResponse,
    )

    function onResponse() {
        console.log('User successfully registered. Have fun using zinja!')
    }
}
