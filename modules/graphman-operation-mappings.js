const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const graphman = require("./graphman");
const POST_BUNDLE_EXTN = utils.extension("graphman-post-bundle");

module.exports = {
    run: function (params) {
        if (!params.input) {
            throw "Missing --input argument";
        }

        const inputBundle = utils.readFile(params.input);
        butils.removeDuplicates(inputBundle);

        const mappings = utils.mappings(params.mappings);

        const data = butils.sanitize(inputBundle, butils.EXPORT_USE, {
            bundleDefaultAction: params.bundleDefaultAction,
            mappings: mappings
        });

        utils.writeResult(params.output, data);
    },

    usage: function () {
        console.log("    mappings --input <input-file> [--output <output-file>] [<options>]");

        console.log("      --bundleDefaultAction <action>");
        console.log("        # default mapping action at the bundle level.");

        console.log("      --mappings.action <action>");
        console.log("        # mapping action for any entity.");

        console.log("      --mappings.<entity-type-plural-tag>.action <action>");
        console.log("        # mapping action for the specified class of entities. This option can be repeatable.");

        console.log("      --mappings.level <0|1|2>");
        console.log("        # mapping level for any entity. Here, 0=no mappings, 1=entity level (excluding dependent entities), 2=all entities");

        console.log("      --mappings.<entity-type-plural-tag>.level <0|1|2>");
        console.log("        # mapping level for the specified  class of entities. Here, 0=no mappings, 1=entity level (excluding dependent entities), 2=all entities");
    }
};
