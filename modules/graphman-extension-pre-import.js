/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

module.exports = {
    /**
     * Extension to process the bundle to be imported
     * diff operation uses this extension for capturing the policy code differences.
     * @param input bundle to be imported
     * @param options CLI options
     */
    apply: function (input, options) {
        return input;
    }
}
