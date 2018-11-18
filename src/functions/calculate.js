const WolframAlphaAPI = require("wolfram-alpha-api");
const waApi = WolframAlphaAPI("XXX"); //Replace with your own API Key

module.exports = {
    task: function (operation) {
        return waApi
            .getSimple(operation)
            .then(function (data) {
                var imageData = data.replace(/^data:image\/gif;base64,/, "");
                require("fs").writeFile(
                    "media/wolfram_out.gif",
                    imageData,
                    "base64",
                    function (err) {
                        console.log(err);
                    }
                );
            })
            .catch(console.error);
    }
}