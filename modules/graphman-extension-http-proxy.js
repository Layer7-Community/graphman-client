const utils = require("./graphman-utils");

module.exports = {
    /**
     * Extension to provide HTTP proxy agent
     * @param input partial execution context containing connection options (e.g., timeout, keepAlive, maxSockets) along with proxy url
     * @param context has the context of current operation details
     * @return HttpProxyAgent instance or null if package is not installed
     */
    apply: function (input, context) {

        // Create proxy agent if configured (HTTP/HTTPS proxy takes precedence over SOCKS)
        let agent = null;

        const isHttps = context.gateway["address"].startsWith('https://');

        if (input && input["proxyType"] && input["url"]) {
            // Handle HTTP/HTTPS proxy - object with url and connection options
            const agentType = input["proxyType"] || "";
            const proxyConfig = {};

            Object.keys(input).forEach(key => {
                if (key !== "proxyType" && input[key] !== undefined) {
                    proxyConfig[key] = input[key];
                }
            });

            if (agentType === "httpProxy") {
                // Extract connection options (exclude url property)
                const proxyOptions = createProxyOptions(proxyConfig);
                const proxyUrlLower = proxyConfig["url"].toLowerCase();
                const isProxyHttps = proxyUrlLower.startsWith('https://');
                if (isProxyHttps) {
                    // If proxy URL uses https://, ensure TLS options are configured if needed
                    if (!proxyOptions.tls) {
                        proxyOptions.tls = {};
                    }
                    // If rejectUnauthorized is not explicitly set for proxy TLS, default to false for compatibility
                    if (proxyOptions.tls.rejectUnauthorized === undefined) {
                        proxyOptions.tls.rejectUnauthorized = false;
                    }
                }

                try {
                    // Use https-proxy-agent for HTTPS targets, http-proxy-agent for HTTP targets
                    // Note: The agent type is based on TARGET protocol, not proxy URL protocol

                    if (isHttps) {
                        const { HttpsProxyAgent } = require("https-proxy-agent")
                        agent = new HttpsProxyAgent(proxyOptions, proxyOptions);
                        utils.info("hello", agent);
                    } else {
                        const { HttpProxyAgent } = require("http-proxy-agent")
                        agent = new HttpProxyAgent(proxyOptions, proxyOptions);
                    }

                    if (!agent && typeof agent === 'string') {
                        utils.warn(`${isHttps ? 'https' : 'http'}-proxy-agent extension did not return a valid agent, proxy will not be used`);
                    }
                } catch (e) {
                    console.error(e);
                    utils.warn(`failed to load ${isHttps ? 'https' : 'http'}-proxy-agent extension, proxy will not be used: ${e.message}`);
                }
            }
            if (agentType === "socksProxy") {
                // Handle SOCKS proxy - object with url and connection options
                const proxyOptions = createProxyOptions(proxyConfig);
                try {
                    const { SocksProxyAgent } = require("socks-proxy-agent");
                    agent =  agent = new SocksProxyAgent(proxyOptions, proxyOptions);
                    if (!agent && typeof agent === 'string') {
                        utils.warn(`socks-proxy-agent extension did not return a valid agent, proxy will not be used`);
                    }
                } catch (e) {
                    utils.warn(`failed to load socks-proxy-agent extension, proxy will not be used: ${e.message}`);
                }

            }
        }

        return agent;
    }
}

function createProxyOptions(proxyConfig) {
    const proxyOptions = {};
    Object.keys(proxyConfig).forEach(key => {
        if (key !== 'url' && key !== "credentialRef" && key !== "credential" && key !== "name") {
            proxyOptions[key] = proxyConfig[key];
        }
    });

    const url = new URL(proxyConfig["url"]);
    proxyOptions["hostname"] = url.hostname;
    const proxyServerUserName = proxyConfig?.credentialRef?.username;
    const proxyServerPassword = proxyConfig?.credentialRef?.password;

    if (proxyServerPassword && proxyServerUserName) {
        proxyOptions["headers"] = {
            "Proxy-Authorization": `Basic ${Buffer.from(`${proxyServerUserName}:${proxyServerPassword}`).toString('base64')}`
        };
    }
    return proxyOptions;
}