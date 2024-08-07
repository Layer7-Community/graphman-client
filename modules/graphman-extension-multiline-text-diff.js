/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const diffExtn = require('diff');

module.exports = {
    /**
     * Extension to compute multiline text differences.
     * diff operation uses this extension for capturing the policy code differences.
     * @param input simple difference data
     * @param input.path json path to the field that has difference
     * @param input.source source entity field's value
     * @param input.target target entity field's value
     * @param typePluralName entity-type plural name
     * @param options CLI options
     */
    apply: function (input, typePluralName, options) {
        if (input.path.endsWith(".policy.xml") || input.path.endsWith(".policy.json") || input.path.endsWith(".policy.yaml")) {
            input.diff = diffExtn.createTwoFilesPatch("target", "source", input.target, input.source, undefined, undefined,
                Object.assign({ignoreWhitespace: false, stripTrailingCr: false}, options.extension || {}));
            input.diff = input.diff.split("\n");
        }

        return input;
    }
}
