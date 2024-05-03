const utils = require("./graphman-utils");
const graphman = require("./graphman");
const pcode = require("./policy-code");

module.exports = {
    run: function (params) {
        if (!params.input) {
            throw new utils.newError("Missing --input argument");
        }

        const input = utils.readFile(params.input);
        validateBundle(input);
    },

    usage: function () {
        utils.print("    validate --input <input-file>");
        utils.print("    Validates the bundled entities. Currently, it is limited to validating the policy code in JSON format.");
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
 * @param typeInfo.bundleName name of the entity type in plural form
 */
function validateEntities(entities, typeInfo) {
    utils.info("validating " + typeInfo.bundleName);
    for (const entity of entities) {
        const statusRef = {errors: []};
        pcode.validate(entity, typeInfo, statusInfo => {
            if (statusInfo.error) statusRef.errors.push(`    ${statusInfo.path} - ${statusInfo.name} - ${statusInfo.error}`);
            if (statusInfo.errors) for (const err of statusInfo.errors) {
                statusRef.errors.push(`    ${statusInfo.path} - ${statusInfo.name} - ${err.message}`);
            }
        });

        utils.info("  validating policy of " + entity.name + ": " + (statusRef.errors.length === 0 ? "ok" : "error(s)"));
        for (const error of statusRef.errors) utils.warn(error);
    }
}
