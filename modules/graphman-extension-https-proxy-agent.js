/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const { HttpsProxyAgent } = require("https-proxy-agent");


module.exports = {
    /**
     * Extension to provide HTTPS proxy agent
     * @param input proxy URL (optional, can be passed when creating agent)
     * @param context partial execution context containing connection options (e.g., timeout, keepAlive, maxSockets, tls)
     * @return HttpsProxyAgent instance or null if package is not installed
     */
    apply: function (input, context) {
        // If context contains connection options, pass them as second parameter
        if (context && typeof context === 'object' && Object.keys(context).length > 0) {
            if (typeof input === 'string') {
                // Pass URL string and options separately
                return new HttpsProxyAgent(input, context);
            } else {
                // Input is already an options object, merge with context
                return new HttpsProxyAgent({...input, ...context});
            }
        }
        return new HttpsProxyAgent(input);
    }
}

