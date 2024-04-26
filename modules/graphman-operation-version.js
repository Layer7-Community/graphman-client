
const graphman = require("./graphman");
const utils = require("./graphman-utils");

module.exports = {
    run: function (params) {
        const config = graphman.configuration();
        utils.print("graphman " + config.version + (` [schemaVersion=${config.schemaVersion}]`));
        utils.print();
    },

    usage: function () {
        // do nothing
    }
}
