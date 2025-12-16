/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

module.exports = {
    /**
     * Extension to enhance http request options
     * @param input http request options
     * @param context CLI operation execution context
     * @param context.operation operation
     * @param context.gateway gateway object
     * @param context.options CLI options
     */
    apply: function (input, context) {
        return input;
    }
}
