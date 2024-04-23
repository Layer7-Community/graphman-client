
const utils = require("./graphman-utils");
const Ajv2020 = require("ajv/dist/2020");

module.exports = {
    build: function () {
        const ajv = new Ajv2020()
        const policySchemaFile = utils.policySchemaFile();
        const policySchema = utils.readFile(policySchemaFile);
        const validate = ajv.compile(policySchema)
        return validate;
    },
};


