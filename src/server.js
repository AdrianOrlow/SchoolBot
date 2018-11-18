const fs = require("fs");
const facebook = require("./login/facebook.js");
const chat = require("./chat.js");

const fbCredentials = fs.readFileSync("./login/credentials.txt").toString().split("\n");
const fbLogin = fbCredentials[0];
const fbPassword = fbCredentials[1];

facebook.login(fbLogin, fbPassword);
chat.start();