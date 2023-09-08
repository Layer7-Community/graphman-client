
const utils = require("./graphman-utils");
const graphman = require("./graphman");

module.exports = {
    run: function (params) {
        if (params.refresh) {
            graphman.refreshSchemaMetadata();
            utils.info("pre-compiled schema is refreshed");
        }
    },

    usage: function () {
        console.log("    schema --refresh");
        console.log("        # pre-compiled schema is serialized to schema/metadata.json file");
        console.log("      --refresh");
        console.log("        # to refresh the pre-compiled schema");
    }
}
