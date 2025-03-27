/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const PACKAGE = require("../package.json");
const SCHEMA_VERSION = "v11.1.2";
const SCHEMA_VERSIONS = [SCHEMA_VERSION, "v11.1.1", "v11.1.00", "v11.0.00-CR03"];

const SUPPORTED_OPERATIONS = [
    "version", "describe",
    "export", "import",
    "explode", "implode",
    "combine", "slice", "diff", "renew", "revise",
    "mappings", "schema", "validate",
    "config"
];

const SUPPORTED_EXTENSIONS = ["pre-request", "post-export", "pre-import", "multiline-text-diff", "policy-code-validator"];
const SCHEMA_FEATURE_LIST = {
    "v11.1.2": ["mappings", "mappings-source", "policy-as-code"],
    "v11.1.00": ["mappings", "mappings-source", "policy-as-code"],
    "v11.1.1": ["mappings", "mappings-source", "policy-as-code"],
    "v11.0.00-CR03": ["mappings", "mappings-source"]
}

const SUPPORTED_REQUEST_LEVEL_OPTIONS = [
    "activate", "comment", "forceAdminPasswordReset", "forceDelete", "replaceAllMatchingCertChain",
    "migratePolicyRevisions", "override.replaceRoleAssignees", "override.replaceUserGroupMemberships"
];

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

    init: function (home, params) {
        utils.wrapperHome(home);

        const config = loadConfig(utils.wrapperHome() + "/graphman.configuration");

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

        config.version = "v" + PACKAGE.version;
        config.defaultSchemaVersion = SCHEMA_VERSION;
        config.supportedSchemaVersions = SCHEMA_VERSIONS;
        config.supportedExtensions = SUPPORTED_EXTENSIONS;
        config.schemaVersion = String(params.options.schema || config.options.schema || SCHEMA_VERSION);
        config.schemaVersions = gqlschema.availableSchemas();

        this.metadata = gqlschema.build(config.version, config.schemaVersion, false);
        this.loadedConfig = config;
    },

    defaultConfiguration: function () {
        return {
            gateways: makeGateways({}),
            options: makeOptions({})
        }
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

    queryNamesByPattern: function (pattern) {
        const regex = "^" + pattern.replaceAll("*", ".*") + "$";
        const result = [];

        utils.queryDirs(this.configuration().schemaVersion).forEach(path => {
            if (utils.existsFile(path)) utils.listDir(path).forEach(item => {
                if (utils.isFile(utils.path(path, item)) && item.endsWith(".json")) {
                    const queryName = item.substring(0, item.length - 5);
                    if (queryName.match(regex) && !result.includes(queryName)) {
                        result.push(queryName);
                    }
                }
            });
        });

        this.queryFieldNamesByPattern(pattern).forEach(item => {
            if (!result.includes(item)) {
                result.push(item);
            }
        });

        return result;
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

    supportedOperations: function () {
        return SUPPORTED_OPERATIONS;
    },

    githubLink: function () {
        return PACKAGE.repository;
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
            headers['x-l7-passphrase'] = utils.base64StringEncode(utils.decodeSecret(gateway.passphrase));
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
        for (const rkey of SUPPORTED_REQUEST_LEVEL_OPTIONS) {
            const tokens = rkey.split('.');
            const key = tokens.length <= 1 ? rkey : tokens[0] + tokens.slice(1).map(item => pascalCasing(item)).join();
            if (options.hasOwnProperty(key) && options[key] !== null) {
                queryString += "&" + rkey + "=" + encodeURIComponent(options[key]);
            }
        }

        if (queryString.length > 0) {
            req.path = req.path + "?" + queryString.substring(1);
        }

        if (gateway.keyFilename && gateway.certFilename) {
            // This expects the certificate.pem and certificate.key file(s) to be in the graphman-client directory. 
            req.key = utils.readFileBinary(utils.path(utils.wrapperHome(), gateway.keyFilename));
            req.cert = utils.readFileBinary(utils.path(utils.wrapperHome(), gateway.certFilename));
        } else if (gateway.username && gateway.password) {
            req.auth = gateway.username + ":" + utils.decodeSecret(gateway.password);
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
        options = utils.extension("pre-request").apply(options, {});
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
                    const jsonData = JSON.parse(data.toString('utf-8'));
                    utils.debug("graphman http response", jsonData);
                    callback(jsonData);
                } else if (respInfo.contentType.startsWith('multipart/')) {
                    utils.debug("graphman http multipart response");
                    let parts = hutils.readParts(data, respInfo.boundary);
                    callback(JSON.parse(parts[0].data), parts);
                } else {
                    utils.info("unexpected graphman http response");
                    utils.info(data.toString('utf-8'));
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

function loadConfig(configFile) {
    try {
        return utils.existsFile(configFile) ? JSON.parse(utils.readFile(configFile)) : {};
    } catch (e) {
        utils.warn(`error loading graphman.configuration, cause=${e.message}`);
        throw utils.newError("failed to load configuration");
    }
}

function makeOptions(options) {
    return Object.assign({
        "log": "info",
        "schema": SCHEMA_VERSION,
        "policyCodeFormat": "xml",
        "keyFormat": "p12",
        "extensions": ["pre-request", "post-export", "pre-import"]
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

function pascalCasing(text) {
    if (text.length > 0) {
        text = text.charAt(0).toUpperCase() + (text.length > 1 ? text.substring(1) : "");
    }

    return text;
}
