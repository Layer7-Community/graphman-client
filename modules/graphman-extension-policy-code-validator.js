// AI assistance has been used to generate some or all contents of this file.
// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const Ajv2020 = require("ajv/dist/2020");

module.exports = {
    /**
     * Extension to construct a json schema validator for a per-assertion schema.
     * Each call creates a fresh AJV instance to avoid $id collisions between
     * independently self-contained assertion schema files.
     * @param input json schema (per-assertion, self-contained)
     * @param context CLI operation execution context
     * @param context.operation operation
     * @param context.options CLI options
     * @return schema validator function
     */
    apply: function (input, context) {
        const ajv = new Ajv2020();
        return ajv.compile(input);
    }
}
