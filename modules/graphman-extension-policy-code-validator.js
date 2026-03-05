// AI assistance has been used to generate some or all contents of this file.
// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const Ajv2020 = require("ajv/dist/2020");

module.exports = {
    /**
     * Extension to construct a json schema validator from raw Gateway configSchemas.
     * Each call creates a fresh AJV instance to avoid $id collisions between
     * independently self-contained assertion schema files.
     *
     * @param input assertion metadata object with configSchemas array
     * @param input.configSchemas array of JSON schemas as returned by Gateway assertionsMetadata
     * @param context CLI operation execution context
     * @return schema validator function, or null if configSchemas is empty
     */
    apply: function (input, context) {
        if (input.configSchemas) {
            const schemas = input.configSchemas;
            if (!Array.isArray(schemas) || schemas.length === 0) {
                return null;
            }

            const ajv = new Ajv2020({ allowUnionTypes: true });
            const mainSchema = schemas[schemas.length - 1];
            for (let i = 0; i < schemas.length - 1; i++) {
                ajv.addSchema(schemas[i]);
            }
            return ajv.compile(mainSchema);
        }

        const ajv = new Ajv2020({ allowUnionTypes: true });
        return ajv.compile(input);
    }
}
