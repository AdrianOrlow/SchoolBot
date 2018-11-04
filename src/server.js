const fs = require("fs");
const login = require("facebook-chat-api");
const fetch = require("node-fetch");
const convertTime = require('convert-time');
const WolframAlphaAPI = require('wolfram-alpha-api');
const waApi = WolframAlphaAPI('ULEK94-KQ88P7RYQW');
const sApi = require('synergia-api');


login({
    appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8'))
}, (err, api) => {
    if (err) return console.error(err);

    api.setOptions({
        listenEvents: true
    });

    const prefix = "/";

    var stopListening = api.listen((err, event) => {
        if (err) return console.error(err);

        switch (event.type) {
            case "message":
                switch (event.body.replace(/ .*/, '')) {
                    case prefix + 'stop':
                        if (event.senderID === '100003045345838') {
                            api.sendMessage("Wyłączanie...", event.threadID);
                            return stopListening();
                        } else {
                            api.sendMessage("Błąd: Brak uprawnień", event.threadID);
                            api.sendMessage({
                                body: 'Osoby z uprawnieniami: @Administrator',
                                mentions: [{
                                    tag: '@Administrator',
                                    id: '100003045345838',
                                    fromIndex: 9,
                                }],
                            }, event.threadID);
                        }

                        break;


                    case prefix + 'pelnyplan':
                        api.sendMessage({
                            body: "Plan lekcji:",
                            attachment: fs.createReadStream(__dirname + '/media/plan.png')
                        }, event.threadID);
                        break;


                    case prefix + 'email':
                        api.sendMessage("Login: ckziu.1b5t@wp.pl\nHasło: fsdtgtyb", event.threadID);
                        break;


                    case prefix + 'policz':
                        var operation = event.body.replace('/policz ', '');
                        waApi.getSimple(operation)
                            .then(function (data) {
                                var imageData = data.replace(/^data:image\/gif;base64,/, "");
                                require("fs").writeFile("media/wolfram_out.gif", imageData, 'base64', function (err) {
                                    console.log(err);
                                    api.sendMessage({
                                        attachment: fs.createReadStream(__dirname + '/media/wolfram_out.gif')
                                    }, event.threadID);
                                });
                            })
                            .catch(console.error);
                        break;


                    case prefix + 'wiki':
                        var data = event.body.replace('/wiki ', '');
                        data = data.replace(/ /g, "_");

                        api.sendMessage({
                            url: "https://pl.wikipedia.org/wiki/" + data,
                        }, event.threadID);

                        break;

                    case prefix + 'sjp':
                        var data = event.body.replace('/sjp ', '');
                        data = data.replace(/ /g, "_");

                        api.sendMessage({
                            url: "https://sjp.pl/" + data,
                        }, event.threadID);

                        break;


                    case prefix + 'plan':
                        var data = event.body.replace('/plan ', '');

                        function getTimetable(day) {
                            var url = "https://api.librus.pl/2.0/Timetables?day=" + day
                            var dataText = "Plan dla grupy 1:\n";
                            var lessonNum = 1;

                            fetch(url, {
                                    method: "GET",
                                    headers: {
                                        'Cache-Control': 'no-cache',
                                        'Authorization': 'Bearer 3ZHXX1t4jTPi3Nm4049qlWCV85rLvIy5qu7MAJcvlKfOm6/XtP1Fk4aYQodXM/J9WUqikPpGz0s3ztDjFasjNbXgJNF6qeTJySq5Bqx/nwXOMXX7m9jNe6grd6iXUFzJFYK1jb5QfkSTb10gfVHB3ExiFCz6JEQGFNen3ALSu+s4Y5I0V25X2SMYzmJPgKiM=#5BU3yZTb2X0='
                                    }
                                })
                                .then(function (response) {
                                    return response.json();
                                })
                                .then(function (data) {
                                    for (var key in data.Timetable) {
                                        for (i = 1; i < data.Timetable[key].length; i++) {
                                            if (data.Timetable[key][lessonNum][0] != undefined) {
                                                var sub = data.Timetable[key][lessonNum][0].Subject.Short;
                                                dataText += lessonNum + '. ' + sub.toUpperCase() + '\n';
                                            }
                                            lessonNum++;
                                        }
                                    }

                                    if (dataText.length > 20) {
                                        api.sendMessage(dataText, event.threadID);
                                    } else {
                                        api.sendMessage("Błąd: Brak planu na ten dzień", event.threadID);
                                    }
                                });
                        }

                        switch (data) {
                            case 'dziś':
                                getTimetable('today');
                                break;

                            case 'jutro':
                                getTimetable('tomorrow');
                                break;

                            default:
                                getTimetable(data);
                                break;
                        }

                        break;


                    case prefix + 'autobusy':
                        var infoText = "Najbliższe odjazdy autobusów:\n";
                        var requests = [
                            "ChIJlz9QUwPDFkcRtu8peJ4VIW4",
                            "ChIJSXDPlUDDFkcRvaHlaK_OXWM",
                            "ChIJfU2EtgPDFkcRI_vTFz-Vqm0"
                        ]

                        var itemsProcessed = 0;
                        requests.forEach(request => {
                            fetch("https://maps.googleapis.com/maps/api/directions/json?mode=transit&transit_mode=bus&origin=place_id:ChIJ0TD_LYPDFkcRfIM-eNXknE8&destination=place_id:" +
                                    request + "&key=AIzaSyCgwRjyNDF58zDNlekngK_Q32nphxAaYeI")
                                .then(function (response) {
                                    return response.json();
                                })
                                .then(function (data) {
                                    var t = convertTime(JSON.stringify(data.routes[0].legs[0].departure_time.text));
                                    var v = data.routes[0].legs[0].steps[0].transit_details.line.short_name;
                                    infoText += v + ': ' + t + '\n';
                                    itemsProcessed++;
                                    if (itemsProcessed === requests.length) {
                                        api.sendMessage(infoText, event.threadID);
                                    }
                                });
                        });
                        break;


                    case prefix + 'everyone':
                        this.participants = [];
                        api.getThreadInfo(event.threadID, (err, info) => {
                            if (err) return console.error(err);
                            participants = info.participantIDs;
                        });

                        var mentions = [];
                        var mentionsText = "";
                        for (i = 0; i < participants.length; i++) {
                            var x = {
                                tag: '@n' + i,
                                id: participants[i],
                                fromIndex: i,
                            }

                            mentionsText += " @" + i;
                            mentions.push(x);
                        }

                        api.sendMessage({
                            body: mentionsText,
                            mentions: mentions,
                        }, event.threadID);
                        break;


                    case prefix + 'help':
                        api.sendMessage({
                            body: '💡 Komendy:\n\n 💬 /help\n ➡️ Wysyła tę wiadomość na PW\n\n 💬 /stop\n ➡️ Wyłącza bota (dostępne tylko dla administratora)\n\n 💬 /everyone\n ➡️ Oznacza wszystkich uczestników konwersacji\n\n 💬 /pelnyplan\n ➡️ Wysyła zdjęcie planu lekcji\n\n 💬 /email\n ➡️ Wysyła dane logowania do klasowego emaila\n\n 💬 /plan [dziś/jutro/YYYY-MM-DD]\n ➡️ Wysyła plan lekcji na dany dzień dla grupy 1, na dziś, jutro albo wybrany dzień w podanym formacie (YYYY-MM-DD, czyli np. 2018-11-05)\n\n 💬 /autobusy\n ➡️ Wysyła najbliższe odjazdy autobusów z przystanku Elektrownia Zespół Szkół\n\n 💬 /wiki [tekst]\n ➡️ Wysyła link do danego zagadnienia na wikipedii, np. "/wiki Komputer" wyśle link do artykułu na ten temat\n\n 💬 /sjp [tekst]\n ➡️ Wysyła link do definicji podanego wyrazu w Słowniku Języka Polskiego\n\n 💬 /policz [działanie matematyczne]\n ➡️ Wysyła zdjęcie z opisem danego działania matematycznego. Obsługuje zwykłe działania, równania, funkcje itd.\n\n💬 /info\n ➡️ Wysyła informacje o autorze i przeznaczeniu aplikacji'
                        }, event.senderID);
                        break;


                    case prefix + 'info':
                        api.sendMessage("SchoolBot v0.0.1A (dla 1BT5CKZiU Jaworzno)\n© Adrian Orłów 2018", event.threadID);
                        break;
                }
                api.markAsRead(event.threadID, (err) => {
                    if (err) console.log(err);
                });
                break;
            case "event":
                console.log(event);
                break;
        }
    });
})