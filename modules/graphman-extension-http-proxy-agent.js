//Copyright (c) 2026 Broadcom Inc. and/or its subsidiaries. All Rights Reserved.

const { HttpProxyAgent } = require("http-proxy-agent");
const utils = require("./graphman-utils");

module.exports = {
    /**
     * Extension to provide HTTP proxy agent
     * @param input partial execution context containing connection options (e.g., timeout, keepAlive, maxSockets) along with proxy url
     * @param context has the context of current operation details
     * @return HttpProxyAgent instance or null if package is not installed
     */
    apply: function (input, context) {

        utils.debug("currently executing for operation:" , context.operation);
        if (input && typeof input === 'object' && Object.keys(input).length > 0) {
            return new HttpProxyAgent(input, input);
        }
        return new HttpProxyAgent(input);
    }
}
