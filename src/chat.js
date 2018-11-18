const fs = require("fs");
const login = require("facebook-chat-api");
const admin = require("firebase-admin");
const request = require("request");

let serviceAccount = require("./login/serviceAccountKey.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://XXX.firebaseio.com",
    storageBucket: "XXX.appspot.com"
});

const db = admin.firestore();
const bucket = admin.storage().bucket();
const events = require("./functions/events");
const librus = require("./functions/librus");

module.exports = {
    start: function () {
        login({
                appState: JSON.parse(fs.readFileSync("appstate.json", "utf8"))
            },
            (err, api) => {
                if (err) return console.error(err);

                api.setOptions({
                    listenEvents: true
                });

                var stopListening = api.listen((err, event) => {
                    if (err) return console.error(err);

                    switch (event.type) {
                        case "message":
                            function sendError(err) {
                                api.sendMessage(`🛑 Błąd: ${err}`, event.threadID);
                            }

                            function normalizeMessage(message) {
                                return message
                                    .normalize("NFD")
                                    .replace(/[\u0300-\u036f]/g, "")
                                    .replace(/\u0142/g, "l")
                                    .replace(/\u0141/g, "l")
                                    .replace(/ .*/, "")
                                    .toLowerCase();
                            }

                            function getClassID(threadID) {
                                let classesRef = db.collection("classes");
                                var query = classesRef
                                    .where("groupid", "==", threadID)
                                    .get()
                                    .then(snapshot => {
                                        snapshot.forEach(doc => {
                                            sendAnswer(doc.data().prefix, doc.id);
                                        });

                                        if (!snapshot[0] && event.senderID == event.threadID) {
                                            sendPrivateAnswer();
                                        }
                                    })
                                    .catch(err => {
                                        console.log("Error getting documents", err);
                                    });
                            }

                            let messageData = event.body.replace(normalizeMessage(event.body) + " ", "");
                            getClassID(event.threadID);

                            function sendPrivateAnswer() {
                                let pp = normalizeMessage(event.body).charAt(0); //Private prefix
                                switch (normalizeMessage(event.body).substr(1)) {
                                    case "librus":
                                        const lArgs = messageData.split(" ");
                                        if (lArgs[0] && lArgs[1] && lArgs[2]) {
                                            librus
                                                .login(lArgs[0], lArgs[1], lArgs[2])
                                                .then((data) => {
                                                    if (data == false) {
                                                        api.sendMessage(`🛑 Błąd: Błędne dane logowania`, event.senderID);
                                                    } else {
                                                        api.sendMessage(`✅ Poprawnie zalogowano`, event.senderID);
                                                    }
                                                })
                                        }
                                        break;

                                    case "autobus":
                                    case "autobusy":
                                    case "numerek":
                                    case "oblicz":
                                    case "help":
                                    case "info":
                                        sendAnswer(pp, ' ');
                                        break;

                                    default:
                                        api.sendMessage("🛑 Błąd: Komenda dostępna tylko dla klas lub nie istnieje", event.senderID);
                                }
                            }

                            function sendAnswer(prefix, classID) {
                                if (classID.length > 0) {
                                    switch (normalizeMessage(event.body)) {
                                        case prefix + "stop":
                                            if (event.senderID === "100003045345838") {
                                                api.sendMessage("Wyłączanie...", event.threadID);
                                                return stopListening();
                                            } else {
                                                sendError("Brak uprawnień");
                                                api.sendMessage({
                                                        body: "👔 Osoby z uprawnieniami: @Administrator",
                                                        mentions: [{
                                                            tag: "@Administrator",
                                                            id: "100003045345838",
                                                            fromIndex: 9
                                                        }]
                                                    },
                                                    event.threadID
                                                );
                                            }

                                            break;

                                        case prefix + "start":
                                            let classRef = db.collection("classes").doc(classID);
                                            classRef
                                                .get()
                                                .then(doc => {
                                                    if (!doc.exists) {
                                                        sendError("Brak klasy w bazie danych");
                                                        console.log("No such document!");
                                                    } else {
                                                        if (event.senderID == doc.data().creatorid) {
                                                            start();
                                                        } else {
                                                            sendError("Korzystać z tej komendy może jedynie osoba, która dodała bota na konwersację")
                                                        }
                                                    }
                                                })
                                                .catch(err => {
                                                    console.log("Error getting document", err);
                                                });

                                            function start() {
                                                const sArgs = messageData.split(" ");
                                                const sCommand = sArgs[0];
                                                switch (sCommand) {
                                                    case 'nazwa':
                                                        classRef.update({
                                                                name: `${sArgs[1]} ${sArgs[2]}`
                                                            })
                                                            .then(() => {
                                                                api.sendMessage(`✅ Pomyślnie ustawiono nazwę na ${sArgs[1]} ${sArgs[2]}`, event.threadID);
                                                                api.sendMessage(`Pełna lista komend znajduje się pod ${prefix}help`, event.threadID);
                                                            });
                                                        break;

                                                    case 'email':
                                                        classRef.update({
                                                                emailLogin: sArgs[1],
                                                                emailPassword: sArgs[2]
                                                            })
                                                            .then(() => {
                                                                api.sendMessage(`✅ Pomyślnie ustawiono dane emaila klasowego na ${sArgs[1]} / ${sArgs[2]}`, event.threadID);
                                                            });
                                                        break;

                                                    case 'librus':
                                                        if (!sArgs[1]) {
                                                            api.sendMessage(`🔑 Aby móc korzystać z funkcji Librusa, podaj swoje dane logowania do Librus Synergia:\nNp. ${prefix}librus kod_klasy nazwauzytkownika jakieshaslo`, event.senderID);
                                                            api.sendMessage(`🔴 Dane logowania są wykorzystywane przez bota do pobierania planu lekcji czy powiadamiania o lekcjach, nie są przekazywane osobom trzecim.`, event.senderID);
                                                            api.sendMessage(`Kod Twojej klasy to: ${classID}`, event.senderID);
                                                        }
                                                        break;
                                                    default:
                                                        api.sendMessage({
                                                                body: `⚠️ Te komendy działają tylko dla @Autor ⚠️\n\n 💬 ${prefix}start nazwa [nazwa]\n ➡️ Inicjalizuje funkcję /zastępstwa, w polu [nazwa] trzeba wpisać nazwę klasy z https://www.ckziu.jaworzno.pl/zastepstwa/, bez nawiasów. Np. ${prefix}start nazwa 1b T5\n\n 💬 ${prefix}start email [login] [hasło]\n ➡️ Inicjalizuje funkcję /email, w polach [login] i [hasło] należy wpisać odpowiednie dane z klasowego emaila. Np. ${prefix}start email 1bt5@mail.com testhaslo\n\n 💬 ${prefix}start librus\n ➡️ Inicjalizuje funkcje związane z Librusem. Wysyła instrukcję na PW.\n\n`,
                                                                mentions: [{
                                                                    tag: "@Autor",
                                                                    id: event.senderID,
                                                                    fromIndex: 0
                                                                }]
                                                            },
                                                            event.threadID
                                                        );
                                                }
                                            }
                                            break;

                                        case prefix + "lekcje":
                                        case prefix + "lekcja":
                                            let lessonAuthRef = db.collection("logindata").doc(classID);
                                            lessonAuthRef
                                                .get()
                                                .then(doc => {
                                                    if (!doc.exists) {
                                                        sendError(`Brak danych logowania, więcej infomacji pod ${prefix}start librus`);
                                                        console.log("No such document!");
                                                    } else {
                                                        librus.getPresentAndNextLessonInfo(doc.data().authtoken)
                                                            .then((data) => {
                                                                if (!data) {
                                                                    sendError('Brak danych');
                                                                } else {
                                                                    api.sendMessage(data, event.threadID);
                                                                }
                                                            })
                                                    }
                                                })
                                                .catch(err => {
                                                    console.log("Error getting document", err);
                                                });
                                            break;

                                        case prefix + "plan":
                                            let timetableAuthRef = db.collection("logindata").doc(classID);
                                            timetableAuthRef
                                                .get()
                                                .then(doc => {
                                                    if (!doc.exists) {
                                                        sendError(`Brak danych logowania, więcej infomacji pod ${prefix}start librus`);
                                                        console.log("No such document!");
                                                    } else {
                                                        librus.timetable(doc.data().authtoken, messageData)
                                                            .then((data) => {
                                                                if (!data) {
                                                                    sendError('Błędny dzień');
                                                                } else {
                                                                    api.sendMessage(data, event.threadID);
                                                                }
                                                            })
                                                    }
                                                })
                                                .catch(err => {
                                                    console.log("Error getting document", err);
                                                });

                                            break;

                                        case prefix + "pelnyplan":
                                            bucket
                                                .file(`timetables/${classID}/timetable.png`)
                                                .download({
                                                    destination: "./media/last-timetable.png"
                                                })
                                                .then(() => {
                                                    api.sendMessage({
                                                            body: "📄 Plan lekcji:",
                                                            attachment: fs.createReadStream(
                                                                __dirname + `/media/last-timetable.png`
                                                            )
                                                        },
                                                        event.threadID
                                                    );
                                                })
                                                .catch(err => {
                                                    console.error("ERROR:", err);
                                                });
                                            break;

                                        case prefix + "mail":
                                        case prefix + "email":
                                            let emailRef = db.collection("classes").doc(classID);
                                            var getDoc = emailRef
                                                .get()
                                                .then(doc => {
                                                    if (!doc.exists) {
                                                        sendError("Brak dokumentu");
                                                        console.log("No such document!");
                                                    } else {
                                                        api.sendMessage(
                                                            `✅ Login: ${doc.data().emailLogin}\n✅ Hasło: ${doc.data().emailPassword}`,
                                                            event.threadID
                                                        );
                                                    }
                                                })
                                                .catch(err => {
                                                    console.log("Error getting document", err);
                                                });

                                            break;

                                        case prefix + "numerek":
                                            request("https://www.ckziu.jaworzno.pl/", function (
                                                err,
                                                resp,
                                                body
                                            ) {
                                                var cheerio = require("cheerio");
                                                var $ = cheerio.load(body);
                                                var numEl = $("a.btn.hidden-xs").eq(3);
                                                if (numEl.text().trim().length > 0) {
                                                    api.sendMessage(
                                                        `🔢 Szczęśliwy numerek na dziś to: ${numEl.text().trim()}`,
                                                        event.threadID
                                                    );
                                                } else {
                                                    sendError("Brak danych o szczęśliwym numerku");
                                                }
                                            });
                                            break;

                                        case prefix + "zastepstwa":
                                            let substitionsRef = db
                                                .collection("classes")
                                                .doc(classID);
                                            var getDoc = substitionsRef
                                                .get()
                                                .then(doc => {
                                                    if (!doc.exists) {
                                                        sendError("Brak danych");
                                                        console.log("No such document!");
                                                    } else {
                                                        const substitions = require("./functions/substitutions");

                                                        substitions.get(doc.data().name).then(data => {
                                                            if (!data[0]) {
                                                                api.sendMessage(data[1], event.threadID);
                                                            } else {
                                                                sendError(data[1]);
                                                            }
                                                        });
                                                    }
                                                })
                                                .catch(err => {
                                                    console.log("Error getting document", err);
                                                });
                                            break;

                                        case prefix + "oblicz":
                                            const calculate = require("./functions/calculate");

                                            let op = messageData;
                                            calculate.task(op).then(() => {
                                                setTimeout(() => {
                                                    api.sendMessage({
                                                            attachment: fs.createReadStream(
                                                                __dirname + "/media/wolfram_out.gif"
                                                            )
                                                        },
                                                        event.threadID
                                                    );
                                                }, 100);
                                            });
                                            break;

                                        case prefix + "wiki":
                                            let wiki = event.body
                                                .replace(normalizeMessage(event.body) + " ", "")
                                                .replace(/ /g, "_");

                                            api.sendMessage({
                                                    url: "https://pl.wikipedia.org/wiki/" + wiki
                                                },
                                                event.threadID
                                            );
                                            break;

                                        case prefix + "sjp":
                                            let sjp = event.body
                                                .replace(normalizeMessage(event.body) + " ", "")
                                                .replace(/ /g, "+");

                                            api.sendMessage({
                                                    url: "https://sjp.pl/" + sjp
                                                },
                                                event.threadID
                                            );
                                            break;

                                        case prefix + "dodaj":
                                            const data = messageData.split(" ");

                                            const addDay = data[0];
                                            const subject = data[1];
                                            const content = function () {
                                                var text = "";
                                                for (i = 2; i < data.length; i++) {
                                                    text += data[i] + " ";
                                                }
                                                return text;
                                            };

                                            events
                                                .add(addDay, subject, content(), event.senderID, classID)
                                                .then((data) => {
                                                    api.sendMessage(data, event.threadID);
                                                });
                                            break;

                                        case prefix + "usun":
                                            const docID = messageData
                                            const doc = db.collection("classes").doc(classID).collection('events').doc(docID);

                                            doc
                                                .get()
                                                .then(snapshot => {
                                                    if (snapshot.exists) {
                                                        events.delete(docID, classID)
                                                            .then(() => {
                                                                api.sendMessage('✅ Pomyślnie usunięto wydarzenie', event.threadID);
                                                            })
                                                    } else {
                                                        sendError(`Nie znaleziono wydarzenia o ID "${docID}"`)
                                                    }
                                                })

                                            break;

                                        case prefix + "wydarzenia":
                                            const getDay = messageData

                                            events
                                                .get(getDay, classID)
                                                .then((data) => {
                                                    api.sendMessage(data, event.threadID);
                                                });
                                            break;

                                        case prefix + "autobus":
                                        case prefix + "autobusy":
                                            const buses = require("./functions/buses");

                                            buses.get().then(data => {
                                                api.sendMessage(data, event.threadID);
                                            });
                                            break;

                                        case prefix + "everyone":
                                            api.getThreadInfo(event.threadID, (err, info) => {
                                                if (err) return console.error(err);
                                                let participants = info.participantIDs;

                                                var mentions = [];
                                                var mentionsText = "";
                                                for (i = 0; i < participants.length; i++) {
                                                    var x = {
                                                        tag: ' @u' + i,
                                                        id: participants[i],
                                                        fromIndex: i
                                                    };

                                                    mentionsText += ' @u' + i;
                                                    mentions.push(x);
                                                }

                                                api.sendMessage({
                                                        body: mentionsText,
                                                        mentions: mentions
                                                    },
                                                    event.threadID
                                                );
                                            });
                                            break;

                                        case prefix + "zmienprefix":
                                            let newprefix = messageData.charAt(0);
                                            console.log(newprefix.length)
                                            if (newprefix.length == 1) {
                                                api.getThreadInfo(event.threadID, (err, info) => {
                                                    console.log(info);
                                                    if (err) console.log(err);
                                                    if (info.adminIDs.filter(e => e.id === event.senderID).length > 0) {
                                                        let classRef = db.collection("classes").doc(classID);

                                                        classRef.update({
                                                                prefix: newprefix
                                                            })
                                                            .then(() => {
                                                                api.sendMessage(`✅ Pomyślnie zmieniono prefix na ${newprefix}`, event.threadID);
                                                            });
                                                    } else {
                                                        sendError('Brak uprawnień administratora grupy.');
                                                    }
                                                });
                                            } else {
                                                sendError('Prefix może składać się tylko z jednego znaku');
                                            }
                                            break;

                                        case prefix + "pomoc":
                                        case prefix + "help":
                                            let p = prefix;
                                            api.sendMessage({
                                                    body: `💡 Komendy:\n\n 💬 ${p}help\n ➡️ Wysyła tę wiadomość na PW\n\n 💬 ${p}stop\n ➡️ Wyłącza bota (dostępne tylko dla głównego administratora)\n\n 💬 ${p}start\n ➡️ Komendy wprowadzające. Dostępne tylko dla osoby, która dodała bota na konwersację\n\n 💬 ${p}everyone\n ➡️ Oznacza wszystkich uczestników konwersacji\n ⚠️ Uwaga! Może powodować chwilowe problemy w dostępie do konwersacji!⚠️\n\n 💬 ${p}pelnyplan\n ➡️ Wysyła zdjęcie planu lekcji (jeśli został dodany)\n\n 💬 ${p}email\n ➡️ Wysyła dane logowania do klasowego emaila (jeśli został dodany)\n\n 💬 ${p}lekcja\n ➡️ Wysyła obecną i następną lekcję. [wymagane połączenie z Librusem]\n\n 💬 ${p}plan [dzień]\n ➡️ Wysyła plan lekcji na dany dzień. [wymagane połączenie z Librusem]\n\n 💬 ${p}autobusy\n ➡️ Wysyła najbliższe odjazdy autobusów z przystanku Elektrownia Zespół Szkół\n\n 💬 ${p}numerek\n ➡️ Wysyła szczęśliwy numerek na dany dzień (pobierane ze strony szkoły)\n\n 💬 ${p}zastepstwa\n ➡️ Wysyła zastepstwa na dany dzień (pobierane ze strony szkoły)\n\n 💬 ${p}dodaj [dzień] [nazwa_przedmiotu] [treść]\n ➡️ Dodaje wydarzenie na dany dzień (dziś/jutro/nazwa dnia tygodnia/data w dowolnym formacie) dla danego przedmiotu (PODŁOGA zamiast spacji, np. język_polski) o danej treści. Np. ${p}dodaj jutro Język_polski Sprawdzian z lektury\n\n 💬 ${p}wydarzenia [dzień]\n ➡️ Pokazuje wydarzenia na dany dzień (dziś/jutro/nazwa dnia tygodnia/data w dowolnym formacie) np. ${p}wydarzenia poniedziałek.\n\n 💬 ${p}usun [ID]\n ➡️ Usuwa wydarzenie o danym ID\n\n 💬 ${p}zmienprefix [p]\n ➡️ Zmienia znak przed komendami, np. ${p}zmienprefix !\n\n 💬 ${p}wiki [tekst]\n ➡️ Wysyła link do danego zagadnienia na wikipedii, np. "/wiki Komputer" wyśle link do artykułu na ten temat\n\n 💬 ${p}sjp [tekst]\n ➡️ Wysyła link do definicji podanego wyrazu w Słowniku Języka Polskiego\n\n 💬 ${p}oblicz [działanie matematyczne]\n ➡️ Wysyła zdjęcie z opisem danego działania matematycznego. Obsługuje zwykłe działania, równania, funkcje itd.\n\n 💬 ${p}info\n ➡️ Wysyła informacje o autorze i przeznaczeniu aplikacji`
                                                },
                                                event.senderID
                                            );
                                            break;

                                        case prefix + "info":
                                            api.sendMessage(
                                                "ℹ️ SchoolBot v0.1.0A (dla CKZiU Jaworzno)\n© Adrian Orłów 2018\n\nKod i dokumentacja: https://github.com/TheAdrik/SchoolBot",
                                                event.threadID
                                            );
                                            break;
                                        default:
                                            if (normalizeMessage(event.body).charAt(0) == prefix) {
                                                sendError("Brak komendy");
                                            }
                                            break;
                                    }
                                }
                            }
                            api.markAsRead(event.threadID, err => {
                                if (err) console.log(err);
                            });
                            break;
                        case "event":
                            if (event.logMessageType == "log:subscribe") {
                                db.collection('classes').add({
                                    creatorid: event.author,
                                    groupid: event.threadID,
                                    prefix: '/',
                                    notify: true
                                }).then(() => {
                                    api.sendMessage({
                                            body: 'ℹ️ @Autor, wpisz komendę \"/start\", aby rozpocząć.',
                                            mentions: [{
                                                tag: "@Autor",
                                                id: event.author,
                                                fromIndex: 0
                                            }]
                                        },
                                        event.threadID
                                    );
                                });
                            }
                            break;
                    }
                });
            }
        );
    }
};