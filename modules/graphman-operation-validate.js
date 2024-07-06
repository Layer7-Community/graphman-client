const utils = require("./graphman-utils");
const graphman = require("./graphman");
const pcode = require("./policy-code");

module.exports = {
    /**
     * Validates the bundle. Precisely, it validates the policy code as per the available policy code schema.
     * @param params
     * @param params.input input bundle file
     */
    run: function (params) {
        if (!params.input) {
            throw new utils.newError("--input parameter is missing");
        }

        const input = utils.readFile(params.input);
        pcode.init();
        validateBundle(input);
    },

    initParams: function (params, config) {
        // do nothing
        return params;
    },

    usage: function () {
        console.log("validate --input <input-file>");
        console.log();
        console.log("Validates the bundled entities.");
        console.log("Currently, it is limited to validating the policy code in JSON format.");
        console.log();
    }
}

function validateBundle(bundle) {
    Array.of("policies", "services").forEach(pluralName => {
        if (bundle[pluralName]) validateEntities(bundle[pluralName], graphman.typeInfoByPluralName(pluralName));
    });
}

/**
 *
 * @param entities bundled entities
 * @param typeInfo entity type info
 * @param typeInfo.pluralName name of the entity type in plural form
 */
function validateEntities(entities, typeInfo) {
    utils.info("validating " + typeInfo.pluralName);
    for (const entity of entities) {
        const statusRef = {errors: []};
        pcode.validate(entity, typeInfo, statusInfo => {
            if (statusInfo.error) statusRef.errors.push(`    ${statusInfo.path} - ${statusInfo.name} - ${statusInfo.error}`);
            if (statusInfo.errors) for (const err of statusInfo.errors) {
                statusRef.errors.push(`    ${statusInfo.path} - ${statusInfo.name} - ${err.message}`);
            }
        });

        utils.info("  validating " + entity.name + ": " + (statusRef.errors.length === 0 ? "ok" : "error(s)"));
        for (const error of statusRef.errors) utils.warn(error);
    }
}
