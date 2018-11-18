const moment = require("moment");

module.exports = {
    convert: function (day) {
        day = day.normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\u0142/g, "l")
            .replace(/\u0141/g, "l")
            .replace(/ .*/, "")
            .toLowerCase();

        function getDay(dayNum) {
            let today = moment().isoWeekday();

            if (today <= dayNum) {
                return moment().isoWeekday(dayNum);
            } else {
                return moment().add(1, 'weeks').isoWeekday(dayNum);
            }
        }

        switch (day) {
            case "dzisiaj":
            case "dzis":
                return moment.utc().startOf('day').toDate();
                break;
            case "jutro":
                return moment.utc().startOf('day').add(1, "days").toDate();
                break;
            case "pojutrze":
                return moment.utc().startOf('day').add(2, "days").toDate();
                break;
            case "poniedzialek":
                return getDay(1).startOf('day').toDate();
                break;
            case "wtorek":
                return getDay(2).startOf('day').toDate();
                break;
            case "sroda":
                return getDay(3).startOf('day').toDate();
                break;
            case "czwartek":
                return getDay(4).startOf('day').toDate();
                break;
            case "piatek":
                return getDay(5).startOf('day').toDate();
                break;
            default:
                if (day == null || !moment.utc(day).isValid()) {
                    return false;
                } else {
                    return moment.utc(day).startOf('day').toDate();
                }
        }
    }
}