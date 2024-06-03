
const VERSION = "v1.3.00 (dev)";
const SCHEMA_VERSION = "v11.1.00";

const utils = require("./graphman-utils");
const hutils = require("./http-utils");
const gqlschema = require("./graphql-schema");

const PRE_REQUEST_EXTN = utils.extension("graphman-pre-request");
const PRE_RESPONSE_EXTN = utils.extension("graphman-pre-response");
const http = require("http");
const https = require("https");

module.exports = {
    loadedConfig: null,
    metadata: null,

    init: function (params) {
        const config = JSON.parse(utils.readFile(utils.home() + "/graphman.configuration"));
        config.options = makeOptions(config.options || {});
        if (params.options && params.options.log)
             utils.logAt(params.options.log);
        else utils.logAt(config.options.log);

        config.gateways = makeGateways(config.gateways || {});
        config.defaultGateway = config.gateways['default'];

        config.version = VERSION;
        config.defaultSchemaVersion = SCHEMA_VERSION;
        config.schemaVersion = params.schemaVersion || config.schemaVersion || SCHEMA_VERSION;
        if (config.schemaVersion !== SCHEMA_VERSION && utils.schemaDir(config.schemaVersion) === utils.schemaDir()) {
            utils.warn(`specified schema (${config.schemaVersion}) is missing, falling back to the default`);
        }

        this.metadata = gqlschema.build(config.schemaVersion, false);
        this.loadedConfig = config;
    },

    configuration: function () {
        return this.loadedConfig;
    },

    gatewayConfiguration: function (name) {
        return name ? Object.assign({name: name}, this.configuration().gateways[name]) : null;
    },

    schemaMetadata: function () {
        return this.metadata;
    },

    typeInfoByPluralName: function (name) {
        const typeName = this.metadata.pluralMethods[name];
        return typeName ? this.metadata.types[typeName] : null;
    },

    refreshSchemaMetadata: function () {
        this.metadata = gqlschema.build(this.loadedConfig.schemaVersion, true);
    },

    request: function (gateway, options) {
        const url = new URL(gateway.address);
        const headers = {
            'content-type': 'application/json; charset=utf-8'
        };

        if (gateway.passphrase) {
            headers['x-l7-passphrase'] = Buffer.from(gateway.passphrase).toString('base64');
        }

        if (gateway.rejectUnauthorized === undefined) {
            gateway.rejectUnauthorized = true;
        }

        const req = {
            host: url.hostname,
            port: url.port || 443,
            path: url.pathname || '/graphman',
            protocol: url.protocol,
            method: 'POST',
            rejectUnauthorized: gateway.rejectUnauthorized.toString() === 'true',
            headers: headers,
            body: {}
        };

        // add proxy support
        if (gateway.proxy) {
            req.proxyInfo = gateway.proxy;
        }

        // ability to overwrite the port by parameter --sourceGateway.port nnnn
        if (options.hasOwnProperty('port')) {
            req.port = parseInt(options.port);
        }

        let queryString = "";
        for (const key of ["activate", "comment", "forceAdminPasswordReset", "forceDelete", "replaceAllMatchingCertChain"]) {
            if (options.hasOwnProperty(key)) {
                queryString += "&" + key + "=" + encodeURIComponent(options[key]);
            }
        }

        if (queryString.length > 0) {
            req.path = req.path + "?" + queryString.substring(1);
        }

        if (gateway.keyFilename && gateway.certFilename) {
            // This expects the certificate.pem and certificate.key file(s) to be in the graphman-client directory. 
            req.key = utils.readFileBinary(utils.path(utils.home(), gateway.keyFilename));
            req.cert = utils.readFileBinary(utils.path(utils.home(), gateway.certFilename));
        } else if (gateway.username && gateway.password) {
            req.auth = gateway.username + ":" + gateway.password;
        } else {
            throw new Error("Authentication details are missing. Please provide either basic authentication (username/password) or mTLS based authentication (keyFilename/certFilename)");
        }

        req.minVersion = req.maxVersion = gateway.tlsProtocol || "TLSv1.2";
        return req;
    },

    invoke: function (options, callback) {
        PRE_REQUEST_EXTN.call(options);
        if (options.proxyInfo) {
            // do proxy stuff
            let proxyurl = new URL(options.proxyInfo);

            // setup proxy request
            var proxyreq_opt={
                host    : proxyurl.host.replace(/:.*/,''),  // The proxy to use
                port    : proxyurl.port,        // proxy port
                protocol: proxyurl.protocol,
                method  : 'CONNECT',
                path    : options.protocol+"//"+options.host+((options.port==443) ? '': ':'+options.port)+options.path,
                headers : {
                    'Proxy-Connection': 'keep-alive'
                }
            }

            // do proxy request
            const proxyreq = ((!proxyreq_opt.protocol||proxyreq_opt.protocol === 'https'||proxyreq_opt.protocol === 'https:') ? https : http).request(proxyreq_opt, function(proxy_response) {
                if(proxy_response.statusCode===301||proxy_response.statusCode===302) {
                    var raw_headers=proxy_response.rawHeaders;
                    console.log('Please redirect '+raw_headers[raw_headers.indexOf('Location')+1]);
                    process.exit(1);
                }
                
                let body='';
                proxy_response.on('data',function(d){
                    body += d
                })
                proxy_response.on('end', function(){});
            }).on('connect',(response,socket,head)=>{
                // the trick is to define and use an agent( here https), which re-uses the socket of the proxy connection.
                const agent=new https.Agent({
                    socket: socket // re-use the socket of the proxy connection
                    //rejectUnauthorized: false //sometime when the CA was not qualified you could use this option 
                })
                
                // now add agent to original options.
                options.agent=agent;


                const req = ((!options.protocol||options.protocol === 'https'||options.protocol === 'https:') ? https : http).request(options, function(response) {
                    let respInfo = {initialized: false, chunks: []};

                    response.on('data', function (chunk) {
                        if (!respInfo.initialized) {
                            utils.debug("graphman http response headers", response.headers);
                            respInfo = Object.assign(respInfo, hutils.parseHeader('contentType', response.headers['content-type']));
                            respInfo.isMultipart = respInfo.contentType.startsWith("multipart/");
                            respInfo.initialized = true;
                            if (respInfo.isMultipart) utils.info("http multipart response is detected, boundary=" + respInfo.boundary);
                        }

                        respInfo.chunks.push(chunk);
                    });

                    response.on('end', function () {
                        let data = Buffer.concat(respInfo.chunks);

                        if (respInfo.contentType.startsWith('application/json')) {
                            const jsonData = JSON.parse(data);
                            utils.debug("graphman http response", jsonData);
                            PRE_RESPONSE_EXTN.call(jsonData);
                            callback(jsonData);
                        } else if (respInfo.contentType.startsWith('multipart/')) {
                            utils.debug("graphman http multipart response");
                            let parts = hutils.readParts(data, respInfo.boundary);
                            callback(JSON.parse(parts[0].data), parts);
                        } else {
                            utils.info("unexpected graphman http response");
                            utils.info("Response Status Code: "+response.statusCode);
                            utils.info(data);
                            callback({errors: data, data: {}});
                        }
                    });
                });
                req.on('error', (err) => {
                    utils.warn(`error encountered while processing the graphman request: ${err.message}`);
                });

                utils.debug("graphman http request", maskedHttpRequest(options));

                if (isMultipart(options)) {
                    hutils.writeParts(req, getPartsFromRawRequest(options));
                } else {
                    req.write(JSON.stringify(options.body));
                }

                req.end();
            }).on('error', function(e) {
                console.log("Got error: " + e.message+ " - exiting with 1");
                process.exit(1);
            }).setTimeout(3000)

            proxyreq.end();

        }
        else {
            // standard stuff
            const req = ((!options.protocol||options.protocol === 'https'||options.protocol === 'https:') ? https : http).request(options, function(response) {
                let respInfo = {initialized: false, chunks: []};

                response.on('data', function (chunk) {
                    if (!respInfo.initialized) {
                        utils.debug("graphman http response headers", response.headers);
                        respInfo = Object.assign(respInfo, hutils.parseHeader('contentType', response.headers['content-type']));
                        respInfo.isMultipart = respInfo.contentType.startsWith("multipart/");
                        respInfo.initialized = true;
                        if (respInfo.isMultipart) utils.info("http multipart response is detected, boundary=" + respInfo.boundary);
                    }

                    respInfo.chunks.push(chunk);
                });

                response.on('end', function () {
                    let data = Buffer.concat(respInfo.chunks);

                    if (respInfo.contentType.startsWith('application/json')) {
                        const jsonData = JSON.parse(data);
                        utils.debug("graphman http response", jsonData);
                        PRE_RESPONSE_EXTN.call(jsonData);
                        callback(jsonData);
                    } else if (respInfo.contentType.startsWith('multipart/')) {
                        utils.debug("graphman http multipart response");
                        let parts = hutils.readParts(data, respInfo.boundary);
                        callback(JSON.parse(parts[0].data), parts);
                    } else {
                        utils.info("unexpected graphman http response");
                        utils.info("Response Status Code: "+response.statusCode);
                        utils.info(data);
                        callback({errors: data, data: {}});
                    }
                });
            });
            req.on('error', (err) => {
                utils.warn(`error encountered while processing the graphman request: ${err.message}`);
            });

            utils.debug("graphman http request", maskedHttpRequest(options));

            if (isMultipart(options)) {
                hutils.writeParts(req, getPartsFromRawRequest(options));
            } else {
                req.write(JSON.stringify(options.body));
            }

            req.end();
        }
    }
}

function maskedHttpRequest(options) {
    if (options.auth) options.auth = "***";
    if (options.headers['x-l7-passphrase']) options.headers['x-l7-passphrase'] = "***";
    if (options.headers['l7-passphrase']) options.headers['l7-passphrase'] = "***";
    if (options.headers.encpass) options.headers.encpass = "***";
    return options;
}

function isMultipart(options) {
    return Array.isArray(options.parts);
}

function getPartsFromRawRequest(options) {
    const mainPart = options.parts[0];

    //first part should contain main request data
    if (!mainPart.data) {
        mainPart.name = "operations";
        mainPart.contentType = "application/json; charset=utf-8";
        mainPart.data = JSON.stringify(options.body);
    }

    return options.parts;
}

function makeOptions(options) {
    return Object.assign({
        "log": "info",
        "policyCodeFormat": "xml",
        "keyFormat": "p12"
    }, options);
}

function makeGateways(gateways) {
    // populate default gateway if no gateway profiles are defined
    if (!Object.keys(gateways).length) {
        gateways['default'] = {
            "address": "https://localhost:8443/graphman",
            "username": "admin",
            "password": "7layer",
            "rejectUnauthorized": false,
            "keyFilename": null,
            "certFilename": null,
            "passphrase": "7layer",
            "allowMutations": false
        };
    }

    // define entry for default gateway for error reporting
    if (!gateways['default']) {
        gateways['default'] = {};
    }

    Object.entries(gateways).forEach(([key, item]) => item['name'] = key);
    return gateways;
}
