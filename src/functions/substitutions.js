const rp = require("request-promise");
const cheerio = require('cheerio');

module.exports = {
    get: function (className) {
        var options = {
            method: 'POST',
            uri: 'https://www.ckziu.jaworzno.pl/zastepstwa/',
            form: {
                pass: 'Cek@ziutek#',
            },
            transform: function (body) {
                return cheerio.load(body);
            }
        };

        return rp(options)
            .then(function ($) {
                var infoText = "";
                var tableColumnNames = [
                    "",
                    "Lekcja: ",
                    "Nauczyciel: ",
                    "Przedmiot: ",
                    "Zastępuje nauczyciel: "
                ];

                var rows = $("td.table_row2, td.table_row1");
                let title = $("p strong").eq(0).text().trim();
                infoText += title + '\n';

                var num = 0;

                for (i = 0; i < rows.length; i++) {
                    var row = rows.eq(i);
                    if (row.text().trim() == className) {
                        num++;
                        for (j = 0; j < row.parent().children().length; j++) {
                            var rowChild = row
                                .parent()
                                .children()
                                .eq(j);
                            if (rowChild.text().trim() != className) {
                                infoText +=
                                    tableColumnNames[j] + rowChild.text().trim() + "\n";
                                if (j + 1 == row.parent().children().length) {
                                    infoText += "\n\n";
                                }
                            }
                        }

                        for (j = 0; j < row.attr("rowspan"); j++) {
                            var nextRowChild = row
                                .parent()
                                .nextAll()
                                .eq(j);
                            if (nextRowChild.children().length == 4) {
                                for (
                                    k = 1; k < nextRowChild.children().length + 1; k++
                                ) {
                                    var rowChild = nextRowChild.children().eq(k - 1);
                                    if (rowChild.text().trim() != className) {
                                        infoText +=
                                            tableColumnNames[k] +
                                            rowChild.text().trim() +
                                            "\n";
                                        if (k == nextRowChild.children().length) {
                                            infoText += "\n\n";
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                var data;
                if (num == 0) {
                    data = [true, `Brak zastępstw dla klasy ${className.toUpperCase()}`];
                } else {
                    data = [false, infoText];
                }
                return data;
            })
            .catch(function (err) {
                console.log(err);
            });
    }
}