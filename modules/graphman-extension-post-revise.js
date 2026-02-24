// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

module.exports = {
    /**
     * Extension to revise bundles
     * @param input revised bundle
     * @param context CLI operation execution context
     * @param context.operation operation
     * @param context.schemaVersion schema version
     * @param context.options CLI options
     */
    apply: function (input, context) {
        return input;
    }
}
