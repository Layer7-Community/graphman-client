/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const {SocksProxyAgent} = require("socks-proxy-agent");

module.exports = {
    /**
     * Extension to provide SOCKS proxy agent
     * @param input proxy URL (optional, can be passed when creating agent)
     * @param context partial execution context containing connection options (e.g., timeout, type, tls)
     * @return SocksProxyAgent instance or null if package is not installed
     */
    apply: function (input, context) {
        // If context contains connection options, pass them as second parameter
        if (context && typeof context === 'object' && Object.keys(context).length > 0) {
            if (typeof input === 'string') {
                // Pass URL string and options separately
                return new SocksProxyAgent(input, context);
            } else {
                // Input is already an options object, merge with context
                return new SocksProxyAgent({...input, ...context});
            }
        }
        return new SocksProxyAgent(input);
    }
}

