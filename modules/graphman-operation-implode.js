
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");

module.exports = {
    /**
     * Implodes directory of gateway configuration into bundle.
     * It is inverse of Explode operation.
     * @param params
     * @param params.input name of the input file containing the gateway configuration as bundle
     * @param params.output name of the output directory into which the gateway configuration will be exploded
     * @param params.options name-value pairs used to customize explode operation
     */
    run: function (params) {
        if (!params.input) {
            throw "--input parameter is missing";
        }

        const inputDir = params.input;
        const bundle = type1Imploder.implode(inputDir);

        utils.writeResult(params.output, butils.sort(bundle));
    },

    initParams: function (params, config) {
        //do nothing
        return params;
    },

    usage: function () {
        console.log("implode --input <input-dir>");
        console.log("  [--output <output-file>]");
        console.log();
        console.log("Implodes the gateway configuration from directory into a bundle.");
        console.log();
        console.log("  --input <input-dir>");
        console.log("    specify the input directory that contains gateway configuration");
        console.log();
        console.log("  --output <output-file>");
        console.log("    specify the file to capture the imploded gateway configuration as bundle");
        console.log();
    }
}

let type1Imploder = (function () {
    return {
        implode: function (inputDir) {
            const bundle = {};

            utils.listDir(inputDir).forEach(item => {
                let subDir = inputDir + "/" + item;
                if (utils.isDirectory(subDir)) {
                    utils.info("imploding " + item);
                    readEntities(subDir, item, bundle);
                }
            });

            const propertiesFile = utils.path(inputDir, 'bundle-properties.json');
            if (utils.existsFile(propertiesFile)) {
                bundle['properties'] = utils.readFile(propertiesFile);
            }

            return bundle;
        }
    };

    function readEntities(typeDir, type, bundle) {
        if (type === 'tree') {
            readFolderableEntities(typeDir, bundle);
        } else {
            if (!bundle[type]) bundle[type] = [];
            utils.listDir(typeDir).forEach(item => {
                if (item.endsWith(".json")) {
                    utils.info(`  ${item}`);
                    let entity = utils.readFile(`${typeDir}/${item}`);
                    if (type === "keys") {
                        if (entity.p12 && entity.p12.endsWith(".p12}")) {
                            const filename = entity.p12.match(/{(.+)}/)[1];
                            entity.p12 = Buffer.from(utils.readFileBinary(`${typeDir}/${filename}`)).toString('base64');
                        }

                        if (entity.pem && entity.pem.endsWith(".pem}")) {
                            const filename = entity.pem.match(/{(.+)}/)[1];
                            entity.pem = utils.readFile(`${typeDir}/${filename}`);
                        }

                        const certChain = entity.certChain;
                        if (certChain && typeof certChain === 'string' && certChain.endsWith(".certchain.pem}")) {
                            const filename = certChain.match(/{(.+)}/)[1];
                            entity.certChain = readCertFile(`${typeDir}/${filename}`);
                        }
                    }

                    if (type.match(/trustedCerts|fipUsers|internalUsers|federatedUsers/)) {
                        if (entity.certBase64 && entity.certBase64.endsWith(".pem}")) {
                            const filename = entity.certBase64.match(/{(.+)}/)[1];
                            let data = readCertFile(`${typeDir}/${filename}`, false);
                            entity.certBase64 = data[0];
                        }
                    }

                    if (type.match(/fips/)) {
                        if (entity.certificateReferences && Array.isArray(entity.certificateReferences) && entity.certificateReferences.length > 0) {
                            entity.certificateReferences.forEach(function (cert) {
                                if (cert.certBase64 && cert.certBase64.endsWith(".pem}")) {
                                    const filename = cert.certBase64.match(/{(.+)}/)[1];
                                    let data = readCertFile(`${typeDir}/${filename}`, false);
                                    cert.certBase64 = data[0];
                                }
                            });
                        }
                    }

                    bundle[type].push(entity);
                }
            });
        }
    }

    function readFolderableEntities(dir, bundle) {
        utils.listDir(dir).forEach(item => {
            if (utils.isDirectory(dir + "/" + item)) {
                readFolderableEntities(`${dir}/${item}`, bundle);
            } else {
                readFolderableEntity(dir, item, bundle);
            }
        });
    }

    function readFolderableEntity(dir, filename, bundle) {
        const ref = {visited: false};
        Object.entries(butils.ENTITY_TYPE_PLURAL_TAG_FRIENDLY_NAME).forEach(([key, value]) => {
            if (!ref.visited && filename.endsWith(`.${value}.json`)) {
                ref.visited = true;

                let entity = utils.readFile(`${dir}/${filename}`);

                if (value === "policy") {
                    key = entity.policyType ? "policies" : "policyFragments";
                }

                if (!bundle[key]) bundle[key] = [];

                if (entity.policy) {
                    const xml = entity.policy.xml;
                    if (xml && xml.endsWith(".xml}")) {
                        const filename = xml.match(/{(.+)}/)[1];
                        entity.policy.xml = utils.readFile(`${dir}/${filename}`);
                    }

                    const yaml = entity.policy.yaml;
                    if (yaml && yaml.endsWith(".yaml}")) {
                        const filename = yaml.match(/{(.+)}/)[1];
                        entity.policy.yaml = utils.readFile(`${dir}/${filename}`);
                    }
                }
                bundle[key].push(entity);
            }
        });
    }

    function readCertFile(path, includeHeader) {
        const lines = utils.readFile(path).split(/\r?\n/);
        const certs = [];
        let data = null;

        includeHeader = includeHeader !== undefined ? includeHeader : true;

        for (var line of lines) {
            if (data == null) {
                if (line.indexOf("-BEGIN CERTIFICATE-") !== -1) {
                    data = includeHeader ? line : "";
                }
            } else {
                if (line.indexOf("-END CERTIFICATE-") !== -1) {
                    data += "\r\n" + (includeHeader ? line : "");
                    certs.push(data.trim());
                    data = null;
                } else {
                    data += "\r\n" + line;
                }
            }
        }

        return certs;
    }
})();

let type2Imploder = (function () {
    return {
        implode: function (inputDir) {
            const bundle = {};

            utils.listDir(inputDir).forEach(item => {
                if (item.endsWith(".json")) {
                    const key = item.substring(0, item.length - ".json".length);
                    utils.info("imploding " + key);
                    bundle[key] = utils.readFile(utils.path(inputDir, item));
                    readEntities(inputDir, bundle[key], key);
                    if (!bundle[key].length) delete bundle[key];
                }
            });

            return bundle;
        }
    };

    function readEntities(dir, entities, pluralMethod) {
        if (pluralMethod === "policyFragments" || pluralMethod === "backgroundTaskPolicies" || pluralMethod === "globalPolicies") {
            entities.forEach(entity => readPolicy(entity, dir));
        } else if (pluralMethod === "webApiServices") {
            entities.forEach(entity => readPolicy(entity, dir, "service-"));
        } else if (pluralMethod === "soapServices") {
            entities.forEach(entity => {
                readPolicy(entity, dir, "service-");
                readSoapServiceWsdl(entity, dir);
            });
        } else if (pluralMethod === "trustedCerts") {
            entities.forEach(entity => readTrustedCert(entity, dir));
        } else if (pluralMethod === "keys") {
            entities.forEach(entity => readKey(entity, dir));
        }
    }

    function readPolicy(entity, dir) {
        const filepath = decodeFilepath(entity, dir, entity.policy.xml);
        if (filepath) {
            entity.policy.xml = utils.readFile(filepath);
        }
    }

    function readSoapServiceWsdl(entity, dir) {
        const filepath = decodeFilepath(entity, dir, entity.wsdl);
        if (filepath) {
            entity.wsdl = utils.readFile(filepath);
        }
    }

    function readTrustedCert(entity, dir) {
        const filepath = decodeFilepath(entity, dir, entity.certBase64);
        if (filepath) {
            entity.certBase64 = utils.readFile(filepath);
        }
    }

    function readKey(entity, dir) {
        const filepath = decodeFilepath(entity, dir, entity.p12);
        if (filepath) {
            entity.p12 = utils.readFile(filepath);
        }

        if (entity.certChain) {
            entity.certChain.forEach((cert, index) => {
                const filepath2 = decodeFilepath(entity, dir, cert);
                if (filepath2) {
                    entity.certChain[index] = utils.readFile(filepath2);
                }
            });
        }
    }

    function decodeFilepath(entity, dir, text) {
        const filename = decodeFilename(text);
        const filepath = utils.path(dir, filename);

        if (!utils.existsFile(filepath)) {
            utils.warn(`${filepath} file is missing for ` + butils.entityDisplayName(entity));
            return null;
        }

        utils.info("  reading from " + filepath);
        return filepath;
    }

    function decodeFilename(text) {
        if (text && text.startsWith("{{") && text.endsWith("}}")) {
            return text.substring(2, text.length - 2);
        } else {
            return "";
        }
    }
})();
