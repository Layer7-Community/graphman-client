const utils = require("./graphman-utils");

module.exports = {
    /**
     * * Extension to provide HTTP proxy agent
     *      * @param input http proxy configuration
     *      * @param input.address proxy server url
     *      * @param input.credentialRef proxy credential reference
     *      * @param input.options extra proxy agent options
     *      * @param context has the context of current operation details
     *      * @return proxy agent instance
     */
    apply: function (input, context) {

        if(input.agentType === "socksProxy") {
           return createSocksProxyAgent(input, context);
       } else {
           return createHttpProxyAgent(input, context);
       }
    }
}

function createSocksProxyAgent(input, context) {
    let agent = null;
    const proxyOptions = createProxyOptions(input);
    try {
        const { SocksProxyAgent } = require("socks-proxy-agent");
        agent = new SocksProxyAgent(proxyOptions, proxyOptions);
    } catch (e) {
        utils.warn("socsk proxy-agent extension did not return a valid agent, proxy will not be used");
    }
    return agent

}

function createHttpProxyAgent(input, context) {
    let agent = null;
    const isHttps = context.gateway["address"].startsWith('https://');
    const proxyOptions = createProxyOptions(input);
    const proxyUrlLower = input.address.toLowerCase();
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
        } else {
            const { HttpProxyAgent } = require("http-proxy-agent")
            agent = new HttpProxyAgent(proxyOptions, proxyOptions);
        }

        if (!agent && typeof agent === 'string') {
            utils.warn(`${isHttps ? 'https' : 'http'}-proxy-agent extension did not return a valid agent, proxy will not be used`);
        }
    } catch (e) {
        utils.warn(e.message);
    }

    return agent;
}
function createProxyOptions(proxyConfig) {
    const proxyOptions = {};
    Object.keys(proxyConfig.options).forEach(key => {
        proxyOptions[key] = proxyConfig.options[key];
    });

    proxyOptions["port"] = proxyConfig.port;
    const url = new URL(proxyConfig.address);
    proxyOptions["hostname"] = url.hostname;
    const proxyServerUserName = proxyConfig?.credentialRef?.username;
    const proxyServerPassword = proxyConfig?.credentialRef?.password;

    if (proxyServerPassword && proxyServerUserName) {
        proxyOptions["headers"] = {
            "Proxy-Authorization": `Basic ${Buffer.from(`${proxyServerUserName}:${proxyServerPassword}`).toString('base64')}`
        };
    }
    utils.info("proxy Option details", proxyOptions);
    return proxyOptions;
}