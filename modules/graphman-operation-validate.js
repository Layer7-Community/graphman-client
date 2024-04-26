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
        validateEntities(bundle[pluralName], graphman.typeInfoByPluralName(pluralName));
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
        utils.info("  validating policy of " + entity.name);
        pcode.validate(entity, typeInfo, errorInfo => {
            if (errorInfo.error) utils.warn(`    ${errorInfo.path} - ${errorInfo.name} - ${errorInfo.error}`);
            if (errorInfo.errors) utils.warn(`    ${errorInfo.path} - ${errorInfo.name} - ${errorInfo.errors}`);
        });
    }
}
