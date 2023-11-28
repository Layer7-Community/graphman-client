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

        const mappingActions = utils.mappings(
            params.mappings,
            params.dependencyMappings
        );

        const data = butils.sanitize(inputBundle, butils.EXPORT_USE, {
            bundleDefaultAction: params.bundleDefaultAction,
            mappingActions: mappingActions
        });

        utils.writeResult(params.output, data);
    },

    usage: function () {
        console.log("    mappings --input <input-file> [--output <output-file>] [<options>]");

        console.log("      --bundleDefaultAction <action>");
        console.log("        # default mapping action at the bundle level.");

        console.log("      --mappings.<entity-type-plural-tag> <action>");
        console.log("        # mapping action for the specified class of entities. This option can be repeatable. Use 'default' class to specify for all types of entities.");
        console.log("      --dependencyMappings.<entity-type-plural-tag> <action>");
        console.log("        # dependency mapping action for the specified class of entities. This option can be repeatable.  Use 'default' class to specify for all types of entities. ");
    }
};
