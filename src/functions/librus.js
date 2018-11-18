const fetch = require("node-fetch");
const admin = require("firebase-admin");
const days = require("./days");
const moment = require("moment");
const db = admin.firestore();

module.exports = {
    login: function (classID, username, password) {
        return fetch('https://api.librus.pl/OAuth/Token', {
                method: "POST",
                headers: {
                    Authorization: "Basic Mjg6ODRmZGQzYTg3YjAzZDNlYTZmZmU3NzdiNThiMzMyYjE=",
                    "Cache-Control": "no-cache",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: 'username=' + username + '&password=' + password + '&librus_long_term_token=1&grant_type=password',
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                if (data.access_token) {
                    let authtoken = data.token_type + " " + data.access_token;
                    let passRef = db.collection("logindata").doc(classID);
                    passRef.set({
                            login: username,
                            password: password,
                            authtoken: authtoken
                        })
                        .then(() => {
                            return true;
                        });
                } else {
                    return false;
                }
            })
    },
    timetable: function (authtoken, day) {
        let date = moment(days.convert(day)).format('YYYY-MM-DD');

        return fetch('https://api.librus.pl/2.0/Timetables?day=' + date, {
                method: "GET",
                headers: {
                    'Cache-Control': 'no-cache',
                    'Authorization': authtoken
                }
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                var dataText = `Plan lekcji na ${day} (Librus):\n`;
                var lessonNum = 1;
                for (var key in data.Timetable) {
                    for (i = 1; i < data.Timetable[key].length; i++) {
                        let lesson = data.Timetable[key][lessonNum][0];
                        if (lesson != undefined) {
                            var info = lesson.Subject.Short.toUpperCase();
                            if (lesson.IsCanceled) {
                                info += " [odwołana]";
                            }
                            if (lesson.IsSubstitutionClass) {
                                info += " [zastępstwo]";
                            }
                            dataText += lessonNum + '. ' + info + '\n';
                        }
                        lessonNum++;
                    }
                }

                if (dataText.length > 0) {
                    return dataText;
                } else {
                    return false;
                }
            });
    },
    getPresentAndNextLessonInfo: function (authtoken) {
        return fetch('https://api.librus.pl/2.0/SystemData', {
                method: "GET",
                headers: {
                    'Cache-Control': 'no-cache',
                    'Authorization': authtoken
                }
            })
            .then(function (response) {
                return response.json();
            })
            .then((data) => {
                return [data.Date, data.Time]
            })
            .then((dateAndTime) => {
                const date = dateAndTime[0];
                const time = dateAndTime[1];
                return fetch('https://api.librus.pl/2.0/Timetables?day=' + date, {
                        method: "GET",
                        headers: {
                            'Cache-Control': 'no-cache',
                            'Authorization': authtoken
                        }
                    })
                    .then(function (response) {
                        return response.json();
                    })
                    .then((data) => {
                        let nowTime = moment(`${date} ${time}`).format('X')
                        let lessons = data.Timetable[date];
                        for (i = 0; i < lessons.length; i++) {
                            let lesson = lessons[i][0];
                            if (lesson != undefined) {
                                let nextLesson = lessons[i + 1][0];
                                let lessonStartTime = moment(`${date} ${lesson.HourFrom}`).format('X');
                                let lessonEndTime = moment(`${date} ${lesson.HourTo}`).format('X');

                                if (lessonStartTime < nowTime && nowTime < lessonEndTime) {
                                    if (nextLesson != undefined) {
                                        return [0, lesson, nextLesson, lesson.TimetableEntry.Url, nextLesson.TimetableEntry.Url];
                                    } else {
                                        return [1, lesson, 'https://api.librus.pl/2.0/TimetableEntries/', lesson.TimetableEntry.Url, 'https://api.librus.pl/2.0/TimetableEntries/'];
                                    }
                                }

                                if (nextLesson != undefined) {
                                    let nextLessonStartTime = moment(`${date} ${nextLesson.HourFrom}`).format('X');
                                    if (lessonEndTime < nowTime && nowTime < nextLessonStartTime) {
                                        return [2, 'https://api.librus.pl/2.0/TimetableEntries/', nextLesson, 'https://api.librus.pl/2.0/TimetableEntries/', nextLesson.TimetableEntry.Url]
                                    }
                                }
                            }
                        }

                    })
                    .then((data) => {
                        if (data != undefined) {
                            return fetch(data[3], {
                                    method: "GET",
                                    headers: {
                                        'Cache-Control': 'no-cache',
                                        'Authorization': authtoken
                                    }
                                })
                                .then(function (response) {
                                    return response.json();
                                })
                                .then((teData) => {
                                    if (teData.TimetableEntry != undefined) {
                                        return teData.TimetableEntry.Classroom.Symbol;
                                    } else {
                                        return '';
                                    }
                                })
                                .then((firstClassroom) => {
                                    return fetch(data[4], {
                                            method: "GET",
                                            headers: {
                                                'Cache-Control': 'no-cache',
                                                'Authorization': authtoken
                                            }
                                        })
                                        .then(function (response) {
                                            return response.json();
                                        })
                                        .then((teData) => {
                                            if (teData.TimetableEntry != undefined) {
                                                secondClassroom = teData.TimetableEntry.Classroom.Symbol;
                                            } else {
                                                secondClassroom = '';
                                            }
                                            return [data[0], data[1], data[2], firstClassroom, secondClassroom];
                                        })
                                })
                                .then((result) => {
                                    return result;
                                })
                        } else {
                            return false;
                        }
                    })
                    .then((data) => {
                        if (data != false) {
                            let firstLesson = data[1];
                            let secondLesson = data[2];
                            let firstClassroom = data[3];
                            let secondClassroom = data[4];
                            var infoText = "";

                            if (data[0] == 0 || data[0] == 1) {
                                let firstLessonInfo = `${firstLesson.Subject.Short.toUpperCase()} – ${firstClassroom}`
                                if (firstLesson.IsCanceled) {
                                    firstLessonInfo += " [odwołana]";
                                }
                                if (firstLesson.IsSubstitutionClass) {
                                    firstLessonInfo += " [zastępstwo]";
                                }
                                infoText += `Obecna lekcja:\n${firstLessonInfo}`;
                            }

                            if (infoText.length > 0) {
                                infoText += `\n\n`;
                            }

                            if (data[0] == 0 || data[0] == 2) {
                                let secondLessonInfo = `${secondLesson.Subject.Short.toUpperCase()} – ${secondClassroom}`;
                                if (secondLesson.IsCanceled) {
                                    secondLessonInfo += " [odwołana]";
                                }
                                if (secondLesson.IsSubstitutionClass) {
                                    secondLessonInfo += " [zastępstwo]";
                                }

                                infoText += `Następna lekcja:\n${secondLessonInfo}`;
                            }

                            return infoText;
                        } else {
                            return `🛑 Błąd: Brak danych`;
                        }
                    });
            });
    }
}