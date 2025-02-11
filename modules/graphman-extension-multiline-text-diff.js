/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const diffExtn = require('diff');
const policyCodePathRegex = new RegExp("[.]policy[.](xml|json|yaml|code)$");

module.exports = {
    /**
     * Extension to compute multiline text differences.
     * diff operation uses this extension for capturing the policy code differences.
     * @param input simple difference data
     * @param input.path json path to the field that has difference
     * @param input.source source entity field's value
     * @param input.target target entity field's value
     * @param context partial execution context
     * @param context.options CLI options
     * @param context.typeInfo.pluralName input type information
     */
    apply: function (input, context) {
        if (policyCodePathRegex.test(input.path)) {
            input.diff = diffExtn.createTwoFilesPatch(
                "target", "source",
                input.target, input.source,
                undefined, undefined,
                Object.assign({ignoreWhitespace: false, stripTrailingCr: false}, context.options.extension || {}));
            input.diff = input.diff.split("\n");
        }

        return input;
    }
}
