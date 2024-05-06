
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");

module.exports = {
    /**
     * Explodes bundle into multiple files.
     * @param params
     * @param params.input name of the input file containing the gateway configuration as bundle
     * @param params.output name of the output directory into which the gateway configuration will be exploded
     * @param params.options name-value pairs used to customize explode operation
     */
    run: function (params) {
        if (!params.input) {
            throw "--input parameter is missing";
        }

        if (!params.output) {
            throw "--output parameter is missing";
        }

        const bundle = utils.readFile(params.input);
        const outputDir = params.output;

        utils.mkDir(outputDir);
        utils.info(`exploding to ${outputDir}`);

        type1Exploder.explode(bundle, outputDir, params.options);
    },

    initParams: function (params, config) {
        params = Object.assign({
            gateway: "default"
        }, params);

        params.options = Object.assign({
            level: 0
        }, config.options, params.options);

        return params;
    },

    usage: function () {
        console.log("explode --input <input-file>");
        console.log("  --output <output-dir>");
        console.log("  [--options.<name> <value>,...]");
        console.log();
        console.log("Explodes bundle into multiple files.");
        console.log();
        console.log("  --input <input-file>");
        console.log("    specify the name of input bundle file that contains gateway configuration");
        console.log();
        console.log("  --output <output-dir>");
        console.log("    specify the name of directory to explode into.");
        console.log();
        console.log("  --options.<name> <value>");
        console.log("    specify options as name-value pair(s) to customize the operation");
        console.log("      .level 0|1|2");
        console.log("        to decide the level of explode operation");
        console.log("          - 0, default level where the individual entities will be exploded into separate files");
        console.log("          - 1, binary data (p12, pem, etc) associated with the entities will be exploded into separate files");
        console.log("          - 2, policy code will be exploded into separate files");
        console.log();
    }
}

let type1Exploder = (function () {
	const BEGIN_CERT_HEADER = '-----BEGIN CERTIFICATE-----';
	const END_CERT_HEADER = '-----END CERTIFICATE-----';
	
    return {
        explode: function (bundle, outputDir, options) {
            Object.entries(bundle).forEach(([key, entities]) => {
                if (Array.isArray(entities) && entities.length) {
                    utils.info(`exploding ${key}`);
                    entities.forEach(item => writeEntity(outputDir, key, item, options));
                } else if (key === "properties") {
                    utils.info(`capturing ${key} to bundle-properties.json`);
                    utils.writeFile(`${outputDir}/bundle-properties.json`, entities);
                }
            });
        }
    };

    function writeEntity(dir, key, entity, options) {
        let displayName = butils.entityDisplayName(entity);
        if (!displayName) {
            displayName = entity.checksum || Date.now().toString(36) + Math.random().toString(36).substring(2);
            utils.warn("forced to use alternative entity display name for ", entity);
        }

        let fileSuffix = butils.ENTITY_TYPE_PLURAL_TAG_FRIENDLY_NAME[key];
        fileSuffix = fileSuffix ? "." + fileSuffix : "";
        const filename = utils.safeName(displayName) + fileSuffix;
        utils.info(`  ${displayName}`);
        const targetDir = entity.folderPath ? utils.safePath(dir, "tree", entity.folderPath) : utils.path(dir, key);

        if (options.level >= 1 && key === "trustedCerts") {
            if (entity.certBase64) {
				let pemData = BEGIN_CERT_HEADER;
				pemData += '\r\n' + entity.certBase64;
				pemData += '\r\n' + END_CERT_HEADER;
                utils.writeFile(`${targetDir}/${filename}.pem`, pemData);
                entity.certBase64 = `{${filename}.pem}`;
            }
        }

        if (options.level >= 1 && key === "keys") {
            if (entity.p12) {
                utils.writeFile(`${targetDir}/${filename}.p12`, atob(entity.p12));
                entity.p12 = `{${filename}.p12}`;
            }

            if (entity.pem) {
                utils.writeFile(`${targetDir}/${filename}.pem`, entity.pem);
                entity.pem = `{${filename}.pem}`;
            }

            if (entity.certChain) {
                let data = "";
                for (var index in entity.certChain) {
                    data += entity.certChain[index].trim();
                    data += "\r\n";
                }
                utils.writeFile(`${targetDir}/${filename}.certchain.pem`, data);
                entity.certChain = `{${filename}.certchain.pem}`;
            }
        }

        if (options.level >= 2 && entity.policy) {
            if (entity.policy.xml) {
                utils.writeFile(`${targetDir}/${filename}.xml`, entity.policy.xml);
                entity.policy.xml = `{${filename}.xml}`;
            }

            if (entity.policy.json && !entity.policy.code) {
                entity.policy.code = JSON.parse(entity.policy.json);
                delete entity.policy.json;
            }

            if (entity.policy.yaml) {
                utils.writeFile(`${targetDir}/${filename}.yaml`, entity.policy.yaml);
                entity.policy.yaml = `{${filename}.yaml}`;
            }
        }

        utils.writeFile(`${targetDir}/${filename}.json`, entity);
    }
})();

let type2Exploder = (function () {
    return {
        explode: function (bundle, dir) {
            Object.entries(bundle).forEach(([key, entities]) => {
                if (entities.length) {
                    utils.info("exploding " + key);
                    writeEntities(entities, key, dir);
                }
            });
        }
    };

    function writeEntities(entities, pluralMethod, dir) {
        if (pluralMethod === "policyFragments" || pluralMethod === "backgroundTaskPolicies" || pluralMethod === "globalPolicies") {
            entities.forEach(entity => writePolicy(entity, dir));
        } else if (pluralMethod === "webApiServices") {
            entities.forEach(entity => writePolicy(entity, dir, "service-"));
        } else if (pluralMethod === "soapServices") {
            entities.forEach(entity => {
                writePolicy(entity, dir, "service-");
                writeSoapServiceWsdl(entity, dir);
            });
        } else if (pluralMethod === "trustedCerts") {
            entities.forEach(entity => writeTrustedCert(entity, dir));
        } else if (pluralMethod === "keys") {
            entities.forEach(entity => writeKey(entity, dir));
        }

        if (entities.length) {
            const filename = utils.path(dir, pluralMethod + ".json");
            const existingEntities = utils.existsFile(filename) ? utils.readFile(filename) : [];

            existingEntities.forEach(item => {
                if (!butils.findMatchingEntity(entities, item)) {
                    entities.push(item);
                } else {
                    utils.info("  overwriting " + butils.entityDisplayName(item));
                }
            });

            utils.writeFile(filename, butils.sort(entities));
        }
    }

    function writePolicy(entity, baseDir, prefix) {
        let resolutionPath = entity.resolutionPath || (entity.resolvers ? entity.resolvers.resolutionPath : null);
        let extraName = resolutionPath ? `-[${resolutionPath}]` : "";
        let filepath = utils.safePath("policies", entity.folderPath);
        let filename = utils.safeName((prefix || "") + entity.name + extraName + ".xml");

        utils.info(`  writing to ${filepath + "/" + filename}`);
        utils.writeFile(utils.path(baseDir, filepath, filename), entity.policy.xml);
        entity.policy.xml = `{{${filepath + "/" + filename}}}`;
    }

    function writeSoapServiceWsdl(entity, baseDir) {
        const filename = entity.policy.xml.substring(2, entity.policy.xml.length - 2 - ".xml".length) + ".wsdl";
        utils.info(`  writing to ${filename}`);
        utils.writeFile(utils.path(baseDir, filename), entity.wsdl);
        entity.wsdl = `{{${filename}}}`;
    }

    function writeTrustedCert(entity, baseDir) {
        let extraName = `-[${entity.thumbprintSha1}]`;
        let filepath = utils.safePath("trustedCerts");
        let filename = utils.safeName(entity.name + extraName + ".cert");

        utils.info(`  writing to ${filepath + "/" + filename}`);
        utils.writeFile(utils.path(baseDir, filepath, filename), entity.certBase64);
        entity.certBase64 = `{{${filepath + "/" + filename}}}`;
    }

    function writeKey(entity, baseDir) {
        let filepath = utils.safePath("keys");
        let filename = utils.safeName(entity.alias + ".pfx");

        utils.info(`  writing to ${filepath + "/" + filename}`);
        utils.writeFile(utils.path(baseDir, filepath, filename), entity.p12);
        entity.p12 = `{{${filepath + "/" + filename}}}`;

        if (entity.certChain) {
            entity.certChain.forEach((cert, index) => {
                let filename2 = utils.safeName(`${entity.alias}-${utils.zeroPad(index + 1, 2)}.cert`);
                utils.info(`  writing to ${filepath + "/" + filename2}`);
                utils.writeFile(utils.path(baseDir, filepath, filename2), cert);
                entity.certChain[index] = `{{${filepath + "/" + filename2}}}`;
            });
        }
    }
})();
