
const Ajv2020 = require("ajv/dist/2020");
const ajv = new Ajv2020();

module.exports = {
    /**
     * Extension to construct the json schema validator
     * @param input json schema
     * @return schema validator
     */
    apply: function (input) {
        return ajv.compile(input);
    }
}
