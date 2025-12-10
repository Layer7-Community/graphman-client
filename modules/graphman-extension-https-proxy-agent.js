/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const { HttpsProxyAgent } = require("https-proxy-agent");


module.exports = {
    /**
     * Extension to provide HTTPS proxy agent
     * @param input proxy URL (optional, can be passed when creating agent)
     * @param context partial execution context
     * @return HttpsProxyAgent instance or null if package is not installed
     */
    apply: function (input, context) {
        return new HttpsProxyAgent(input);
    }
}

