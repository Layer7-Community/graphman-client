
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
        console.log("      .includePolicyRevisions false|true");
        console.log("        use this option to include policy revisions for the exported service/policy entities.");
        console.log();
    }
}

let type1Exploder = (function () {
	const BEGIN_CERT_HEADER = '-----BEGIN CERTIFICATE-----';
	const END_CERT_HEADER = '-----END CERTIFICATE-----';
    const subExploders = [
        {
            /**
             * Explodes key details
             * @param outputDir output directory
             * @param filename name of the file (without extension)
             * @param entity key entity
             * @param typeInfo type-information
             * @param options explode options
             */
            explode: function (outputDir, filename, entity, typeInfo, options) {
                if (options.level < 1) return;
                if (typeInfo.pluralName !== "keys") return;

                // make sure the key details exploded from one of the available (p12, pem)
                if (entity.p12) {
                    utils.writeFileBinary(`${outputDir}/${filename}.p12`, Buffer.from(entity.p12, 'base64'));
                    entity.p12 = `{${filename}.p12}`;
                    delete entity.pem;
                } else if (entity.pem) {
                    utils.writeFile(`${outputDir}/${filename}.pem`, entity.pem);
                    entity.pem = `{${filename}.pem}`;
                }

                if (entity.certChain) {
                    let data = "";
                    for (let index in entity.certChain) {
                        data += entity.certChain[index].trim();
                        data += "\r\n";
                    }
                    utils.writeFile(`${outputDir}/${filename}.certchain.pem`, data);
                    entity.certChain = `{${filename}.certchain.pem}`;
                }
            }
        },
        {
            /**
             * Explodes trusted cert details
             * @param outputDir output directory
             * @param filename name of the file (without extension)
             * @param entity trusted cert entity
             * @param typeInfo type-information
             * @param options explode options
             */
            explode: function (outputDir, filename, entity, typeInfo, options) {
                if (options.level < 1) return;
                if (typeInfo.pluralName !== "trustedCerts") return;

                if (entity.certBase64) {
                    let pemData = BEGIN_CERT_HEADER;
                    pemData += '\r\n' + entity.certBase64;
                    pemData += '\r\n' + END_CERT_HEADER;
                    utils.writeFile(`${outputDir}/${filename}.pem`, pemData);
                    entity.certBase64 = `{${filename}.pem}`;
                }
            }
        },

        {
            /**
             * Explodes policy details
             * @param outputDir output directory
             * @param filename name of the file (without extension)
             * @param entity any entity containing policy details (services, policies)
             * @param typeInfo type-information
             * @param options explode options
             */
            explode: function (outputDir, filename, entity, typeInfo, options) {
                if (options.level < 2) return;
                if (!entity.policy) return;

                // make sure the policy details exploded from one of the available (xml, json, yaml, code)
                if (entity.policy.xml) {
                    utils.writeFile(`${outputDir}/${filename}.xml`, entity.policy.xml);
                    entity.policy.xml = `{${filename}.xml}`;
                    delete entity.policy.json;
                    delete entity.policy.yaml;
                    delete entity.policy.code;
                } else if (entity.policy.json) {
                    utils.writeFile(`${outputDir}/${filename}.cjson`, JSON.parse(entity.policy.json));
                    entity.policy.json = `{${filename}.cjson}`;
                    delete entity.policy.code;
                    delete entity.policy.yaml;
                } else if (entity.policy.code) {
                    utils.writeFile(`${outputDir}/${filename}.cjson`, entity.policy.code);
                    entity.policy.json = `{${filename}.cjson}`;
                    delete entity.policy.code;
                    delete entity.policy.yaml;
                } else if (entity.policy.yaml) {
                    utils.writeFile(`${outputDir}/${filename}.yaml`, entity.policy.yaml);
                    entity.policy.yaml = `{${filename}.yaml}`;
                    delete entity.policy.code;
                }
            }
        }
    ];
	
    return {
        explode: function (bundle, outputDir, options) {
            butils.forEach(bundle, (key, entities, typeInfo) => {
                utils.info(`exploding ${key}`);
                entities.forEach(item => writeEntity(outputDir, key, item, typeInfo, options));
            });

            if (bundle.properties) {
                utils.info(`capturing properties to bundle-properties.json`);
                utils.writeFile(`${outputDir}/bundle-properties.json`, bundle.properties);
            }
        }
    };

    function writeEntity(dir, key, entity, typeInfo, options) {
        let displayName = butils.entityName(entity, typeInfo);
        if (!displayName) {
            displayName = entity.checksum || Date.now().toString(36) + Math.random().toString(36).substring(2);
            utils.warn("forced to use alternative entity display name for ", entity);
        }

        const fileSuffix = butils.entityFileSuffixByPluralName(key);
        const filename = utils.safeName(displayName) + (fileSuffix ? fileSuffix : "");
        utils.info(`  ${displayName}`);
        const targetDir = entity.folderPath ? utils.safePath(dir, "tree", entity.folderPath) : utils.path(dir, key);

        subExploders.forEach(item => item.explode(targetDir, filename, entity, typeInfo, options));
        utils.writeFile(`${targetDir}/${filename}.json`, entity);
    }
})();
