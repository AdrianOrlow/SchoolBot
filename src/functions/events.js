const admin = require("firebase-admin");
const days = require("./days");
const db = admin.firestore();


module.exports = {
    get: function (day, classID) {
        const eventsRef = db.collection("classes").doc(classID).collection('events');
        date = days.convert(day);
        return eventsRef
            .where("date", "==", date)
            .get()
            .then(snapshot => {
                let eventsText = `📅 Wydarzenia na dzień ${day}:\n\n`;
                let count = 0;
                snapshot.forEach(doc => {
                    let event = `${doc.data().subject}\n${doc.data().content}\nID: ${doc.id}\n\n`;
                    eventsText += event;
                    count++;
                });
                if (count == 0) {
                    return `🛑 Nie znaleziono wydarzeń na dzień ${day}`;
                }
                return eventsText;
            })
            .catch(err => {
                console.log("Error getting documents", err);
            });
    },
    add: function (day, subject, content, author, classID) {
        const eventsRef = db.collection("classes").doc(classID).collection('events');
        date = days.convert(day);

        if (!date) {
            return `🛑 Błędna data (${day})`
        }

        return eventsRef
            .add({
                subject: subject,
                content: content,
                date: date,
                author: author
            })
            .then(ref => {
                return `✅ Pomyślnie dodano wydarzenie:\n${subject} | ${day}\nTreść: ${content}\n[ID: ${ref.id}]`
            })
            .catch(err => {
                console.log("Error adding document", err);
            });
    },
    delete: function (ID, classID) {
        const eventsRef = db.collection("classes").doc(classID).collection('events');
        return eventsRef.doc(ID).delete();
    }
}