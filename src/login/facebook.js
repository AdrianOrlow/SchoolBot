const fs = require("fs");
const login = require("facebook-chat-api");

module.exports = {
    login: function (email, password) {
        var credentials = {
            email: email,
            password: password
        };

        login(credentials, (err, api) => {
            if (err) return console.error(err);

            fs.writeFileSync('appstate.json', JSON.stringify(api.getAppState()));
        });
    }
}