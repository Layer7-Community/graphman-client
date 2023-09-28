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

        const defaultAction = params.bundleDefaultAction || 'NEW_OR_UPDATE';
        const mappingActions = utils.mappingActions(
            params.defaultMappingAction,
            params.mappingAction,
            params.dependencyMappingAction,
            defaultAction
        );

        mappingActions['default'] = {action: defaultAction};

        const data = butils.sanitize(inputBundle, butils.EXPORT_USE, {
            bundleDefaultAction: defaultAction,
            mappingActions: mappingActions
        });

        utils.writeResult(params.output, data);
    },

    usage: function () {
        console.log("    mappings --input <input-file> [--output <output-file>] [<options>]");

        console.log("      --bundleDefaultAction <action>");
        console.log("        # default mapping action at the bundle level.");
        console.log("      --mappingAction <entity-type-plural-tag>:<action>");
        console.log("        # mapping action for the specified class of entities. This option can be repeatable.");
        console.log("      --defaultMappingAction <entity-type-plural-tag>:<action>");
        console.log("        # default mapping action for the specified class of entities. This option can be repeatable.");
        console.log("      --dependencyMappingAction <entity-type-plural-tag>:<action>");
        console.log("        # dependency mapping action for the specified class of entities. This option can be repeatable.");
    }
};
