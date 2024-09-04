/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

module.exports = {
    /**
     * Extension to process the bundle to be imported
     * diff operation uses this extension for capturing the policy code differences.
     * @param input bundle to be imported
     * @param context partial execution context
     * @param context.options CLI options
     */
    apply: function (input, context) {
        return input;
    }
}
