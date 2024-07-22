
const VERSION = "v1.3.00 (dev)";
const SCHEMA_VERSION = "v11.1.1";
const SCHEMA_VERSIONS = [SCHEMA_VERSION, "v11.1.00"];

const SUPPORTED_EXTENSIONS = ["multiline-text-diff", "policy-code-validator"];
const SCHEMA_FEATURE_LIST = {
    "v11.1.1": ["mappings", "mappings-source"]
}

const utils = require("./graphman-utils");
const hutils = require("./http-utils");
const gqlschema = require("./graphql-schema");

const http = require("http");
const https = require("https");

/**
 * Responsible to
 * - load configuration and metadata
 * - posts the query/mutation requests to the gateway's graphman service.
 */
module.exports = {
    loadedConfig: null,
    metadata: null,

    init: function (params) {
        const config = JSON.parse(utils.readFile(utils.home() + "/graphman.configuration"));

        // override configured options using params if specified
        config.options = makeOptions(config.options || {});
        Object.assign(config.options, params.options);

        // set the client log level
        utils.logAt(config.options.log);

        config.gateways = makeGateways(config.gateways || {});

        // override configured gateway details using params if specified
        if (params.gateways) Object.keys(params.gateways).forEach(key => {
            const gateway = params.gateways[key];
            config.gateways[key] = config.gateways[key] || {};
            Object.assign(config.gateways[key], gateway);
        });

        config.defaultGateway = config.gateways['default'];

        config.version = VERSION;
        config.defaultSchemaVersion = SCHEMA_VERSION;
        config.supportedSchemaVersions = SCHEMA_VERSIONS;
        config.supportedExtensions = SUPPORTED_EXTENSIONS;
        config.schemaVersion = params.options.schema || config.options.schema || SCHEMA_VERSION;
        config.schemaVersions = gqlschema.availableSchemas();

        this.metadata = gqlschema.build(config.version, config.schemaVersion, false);
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

    queryFieldInfo: function (name) {
        const queryInfo = this.metadata.types["Query"];
        return queryInfo.fields.find(x => x.name === name);
    },

    queryFieldNamesByPattern: function (pattern) {
        const queryInfo = this.metadata.types["Query"];
        const regex = "^" + pattern.replaceAll("*", ".*") + "$";
        return queryInfo.fields.filter(x => x.name.match(regex)).map(x => x.name);
    },

    typeInfoByTypeName: function (name) {
        return this.metadata.types[name];
    },

    typeInfoByPluralName: function (name) {
        return this.metadata.bundleTypes[name];
    },

    isPrimitiveField: function (fieldInfo) {
        return !this.metadata.types[fieldInfo.dataType];
    },

    refreshSchemaMetadata: function () {
        this.metadata = gqlschema.build(this.loadedConfig.version, this.loadedConfig.schemaVersion, true);
    },

    supportsFeature: function (featureName) {
        const list = SCHEMA_FEATURE_LIST[this.loadedConfig.schemaVersion]||[];
        return list.includes(featureName);
    },

    /**
     * Prepares the graphman request
     * @param gateway target gateway
     * @param options query parameters
     * @return http request object
     */
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

        let queryString = "";
        for (const key of ["activate", "comment", "forceAdminPasswordReset", "forceDelete", "replaceAllMatchingCertChain"]) {
            if (options.hasOwnProperty(key) && options[key] !== null) {
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
            throw new Error("gateway credentials are missing, provide either basic authentication (username / password) or mTLS based authentication (keyFilename / certFilename)");
        }

        req.minVersion = req.maxVersion = gateway.tlsProtocol || "TLSv1.2";
        return req;
    },

    /**
     * Makes the http request to the gateway's graphman service
     * @param options
     * @param callback
     */
    invoke: function (options, callback) {
        options = utils.extension("pre-request").apply(options);
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
                    callback(jsonData);
                } else if (respInfo.contentType.startsWith('multipart/')) {
                    utils.debug("graphman http multipart response");
                    let parts = hutils.readParts(data, respInfo.boundary);
                    callback(JSON.parse(parts[0].data), parts);
                } else {
                    utils.info("unexpected graphman http response");
                    utils.info(data);
                    callback({errors: "no valid response from graphman"});
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
        "schema": SCHEMA_VERSION,
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
