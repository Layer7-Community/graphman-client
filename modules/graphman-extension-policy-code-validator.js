// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const Ajv2020 = require("ajv/dist/2020");
const ajv = new Ajv2020();

module.exports = {
    /**
     * Extension to construct the json schema validator
     * @param input json schema
     * @param context CLI operation execution context
     * @param context.operation operation
     * @param context.options CLI options
     * @return schema validator
     */
    apply: function (input, context) {
        return ajv.compile(input);
    }
}
