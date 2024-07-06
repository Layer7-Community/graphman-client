
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const graphman = require("./graphman");

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
    const subImploders = {
        "keys": {
            apply: function (entity, typeDir) {
                return implodeKey(entity, typeDir);
            }
        },

        "trustedCerts": {
            apply: function (entity, typeDir) {
                return implodeTrustedCert(entity, typeDir);
            }
        }
    };

    return {
        implode: function (inputDir) {
            const bundle = {};

            if (!utils.existsFile(inputDir) || !utils.isDirectory(inputDir)) {
                throw utils.newError(`directory does not exist or not a directory, ${inputDir}`);
            }

            utils.listDir(inputDir).forEach(item => {
                const subDir = inputDir + "/" + item;
                if (utils.isDirectory(subDir)) {
                    const typeInfo = graphman.typeInfoByPluralName(item);
                    if (typeInfo) {
                        utils.info("imploding " + item);
                        readEntities(subDir, item, typeInfo, bundle);
                    } else if (item === "tree") {
                        readFolderableEntities(subDir, bundle);
                    } else {
                        utils.info("unknown entities, " + item);
                    }
                }
            });

            const propertiesFile = utils.path(inputDir, 'bundle-properties.json');
            if (utils.existsFile(propertiesFile)) {
                bundle['properties'] = utils.readFile(propertiesFile);
            }

            return bundle;
        }
    };

    function readEntities(typeDir, pluralName, typeInfo, bundle) {
        const entities = butils.withArray(bundle, typeInfo);
        utils.listDir(typeDir).forEach(item => {
            if (item.endsWith(".json")) {
                utils.info(`  ${item}`);
                const entity = utils.readFile(`${typeDir}/${item}`);
                const subImploder = subImploders[typeInfo.pluralName];
                entities.push(subImploder ? subImploder.apply(entity, typeDir) : entity);
            }
        });
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

    function readFolderableEntity(path, filename, bundle) {
        const pluralName = butils.entityPluralNameByFile(filename);
        let typeInfo = pluralName ? graphman.typeInfoByPluralName(pluralName) : null;

        if (typeInfo) {
            const entity = utils.readFile(`${path}/${filename}`);

            // for backward compatibility, check whether the entity is of type policy fragment
            if (filename.endsWith(".policy.json") && !entity.policyType) {
                typeInfo = graphman.typeInfoByPluralName("policyFragments");
            }

            const entities = butils.withArray(bundle, typeInfo);
            entities.push(implodePolicyCode(entity, path));
        } else {
            utils.warn("unknown file, " + utils.path(path, filename));
        }
    }

    function implodePolicyCode(entity, typeDir) {
        if (entity.policy) {
            const xml = entity.policy.xml;
            const json = entity.policy.json;
            const yaml = entity.policy.yaml;

            if (xml && xml.endsWith(".xml}")) {
                const filename = xml.match(/{(.+)}/)[1];
                entity.policy.xml = utils.readFile(`${typeDir}/${filename}`);
            } else if (json && json.endsWith(".cjson}")) {
                const filename = json.match(/{(.+)}/)[1];
                entity.policy.json = JSON.stringify(JSON.parse(utils.readFile(`${typeDir}/${filename}`)), null, 0);
            } else if (yaml && yaml.endsWith(".yaml}")) {
                const filename = yaml.match(/{(.+)}/)[1];
                entity.policy.yaml = utils.readFile(`${typeDir}/${filename}`);
            }
        }

        return entity;
    }

    function implodeKey(entity, typeDir) {
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

        return entity;
    }

    function implodeTrustedCert(entity, typeDir) {
        if (entity.certBase64 && entity.certBase64.endsWith(".pem}")) {
            const filename = entity.certBase64.match(/{(.+)}/)[1];
            let data = readCertFile(`${typeDir}/${filename}`, false);
            entity.certBase64 = data[0];
        }

        return entity;
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
