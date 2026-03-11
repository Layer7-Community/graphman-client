// Copyright (c) 2026 Broadcom Inc. and its subsidiaries. All Rights Reserved.
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

        if(input.agentType === "socks") {
           return createSocksProxyAgent(input, context);
       } else {
           return createHttpProxyAgent(input, context);
       }
    }
}

function createSocksProxyAgent(input, context) {
    let agent = null;
    const proxyConfig = createProxyConfig(input);

    try {
        const { SocksProxyAgent } = require("socks-proxy-agent");
        agent = new SocksProxyAgent(proxyConfig.url || new URL(input.address), proxyConfig);
    } catch (e) {
      throw "failed to configure socks proxy agent" + e.message;
    }
    return agent
}

function createHttpProxyAgent(input, context) {
    let agent = null;
    const isHttps = context.gateway["address"].startsWith('https://');
    const proxyConfig = createProxyConfig(input);
    const proxyUrlLower = input.address.toLowerCase();
    const isProxyHttps = proxyUrlLower.startsWith('https://');

    if (isProxyHttps) {
        // If proxy URL uses https://, ensure TLS options are configured if needed
        if (!proxyConfig.tls) {
            proxyConfig.tls = {};
        }
        // If rejectUnauthorized is not explicitly set for proxy TLS, default to false for compatibility
        if (proxyConfig.tls.rejectUnauthorized === undefined) {
            proxyConfig.tls.rejectUnauthorized = false;
        }
    }

    try {
        // Use https-proxy-agent for HTTPS targets, http-proxy-agent for HTTP targets
        // Note: The agent type is based on TARGET protocol, not proxy URL protocol

        if (isHttps) {
            const { HttpsProxyAgent } = require("https-proxy-agent")
            agent = new HttpsProxyAgent(input.address, proxyConfig);
        } else {
            const { HttpProxyAgent } = require("http-proxy-agent")
            agent = new HttpProxyAgent(input.address, proxyConfig);
        }

    } catch (e) {
        throw "failed to configure http proxy agent " + e.message;
    }

    return agent;
}

function createProxyConfig(obj) {
    const proxy = {};
    const cred = obj.credentialRef;
    let auth;

    if (cred) {
        if (obj.agentType === "socks") {
            const url = new URL(obj.address);
            url.username = cred.username;
            url.password = cred.password;

            proxy.url = url;
        } else {
            auth = `Basic ${Buffer.from(`${cred.username}:${cred.password}`).toString('base64')}`;
        }
    }

    Object.keys(obj.options).forEach(key => {
        proxy[key] = obj.options[key];
    });

    if (!proxy.headers) {
        proxy.headers = {};
    }

    if (auth) {
        proxy.headers["Proxy-Authorization"] = auth;
    }

    return proxy;
}