
const graphman = require("./graphman");
const utils = require("./graphman-utils");

module.exports = {
    /**
     * Prints the version details.
     * @param params
     */
    run: function (params) {
        const config = graphman.configuration();
        utils.print("graphman client " + config.version);
        utils.print(`  supported schema(s) [${config.schemaVersion}]`);
        utils.print(`  running from ` + process.env.GRAPHMAN_HOME);
        utils.print();
    },

    initParams: function (params, config) {
        //do nothing
        return params;
    },

    usage: function () {
        // do nothing
    }
}
