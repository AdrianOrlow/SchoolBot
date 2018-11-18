const fetch = require("node-fetch");
const convertTime = require("convert-time");

module.exports = {
    get: async function () {
        var infoText = "🚌 Najbliższe odjazdy autobusów:\n";
        var requests = [
            "ChIJlz9QUwPDFkcRtu8peJ4VIW4",
            "ChIJSXDPlUDDFkcRvaHlaK_OXWM",
            "ChIJbVW8Q_DCFkcR5BnaWHY70yw"
        ];

        var itemsProcessed = 0;
        for (let request of requests) {
            await fetch(
                    "https://maps.googleapis.com/maps/api/directions/json?mode=transit&transit_mode=bus&origin=place_id:ChIJ0TD_LYPDFkcRfIM-eNXknE8&destination=place_id:" +
                    request +
                    "&key=XXX" //Replace with your own API Key
                )
                .then(function (response) {
                    return response.json();
                })
                .then(function (data) {
                    var t = convertTime(
                        JSON.stringify(data.routes[0].legs[0].departure_time.text)
                    );
                    var v =
                        data.routes[0].legs[0].steps[0].transit_details.line
                        .short_name;
                    infoText += v + ": " + t + "\n";
                    itemsProcessed++;
                    console.log(infoText)
                    if (itemsProcessed === requests.length) {
                        return;
                    }
                });
        }

        return infoText;
    }
}