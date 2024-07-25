/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

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
            apply: function (entity, inputDir) {
                return implodeKey(entity, inputDir);
            }
        },

        "trustedCerts": {
            apply: function (entity, inputDir) {
                return implodeEntityCert(entity, inputDir);
            }
        },

        "internalUsers": {
            apply: function (entity, inputDir) {
                if (isValueFileReferenced(entity.sshPublicKey)) {
                    entity.sshPublicKey = implodeFile(entity.sshPublicKey, inputDir);
                }

                return implodeEntityCert(entity, inputDir);
            }
        },

        "federatedUsers": {
            apply: function (entity, inputDir) {
                return implodeEntityCert(entity, inputDir);
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

    function readEntities(inputDir, pluralName, typeInfo, bundle) {
        const entities = butils.withArray(bundle, typeInfo);
        utils.listDir(inputDir).forEach(item => {
            if (item.endsWith(".json")) {
                utils.info(`  ${item}`);
                const entity = utils.readFile(`${inputDir}/${item}`);
                const subImploder = subImploders[typeInfo.pluralName];
                entities.push(subImploder ? subImploder.apply(entity, inputDir) : entity);
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
            entities.push(implodeServiceOrPolicy(entity, path));
        }
    }

    function isValueFileReferenced(data) {
        return data && data.startsWith("{") && data.endsWith("}");
    }

    function implodeFile(data, path) {
        const filename = data.match(/{([^{}]+)}/)[1];
        return utils.readFile(`${path}/${filename}`);
    }

    function implodeFileBinary(data, path) {
        const filename = data.match(/{([^{}]+)}/)[1];
        return utils.readFileBinary(`${path}/${filename}`);
    }

    function implodeServiceOrPolicy(entity, inputDir) {
        if (entity.policy) {
            implodePolicyCode(entity, entity.policy, inputDir);
        }

        if (Array.isArray(entity.policyRevisions)) {
            entity.policyRevisions.forEach(item => implodePolicyCode(entity, item, inputDir));
        }

        return entity;
    }

    function implodePolicyCode(entity, policy, inputDir) {
        if (isValueFileReferenced(policy.xml)) {
            policy.xml = implodeFile(policy.xml, inputDir);
        } else if (isValueFileReferenced(policy.json)) {
            policy.json = JSON.stringify(JSON.parse(implodeFile(policy.json, inputDir)), null, 0);
        } else if (isValueFileReferenced(policy.yaml)) {
            policy.yaml = implodeFile(policy.yaml, inputDir);
        }

        return entity;
    }

    function implodeKey(entity, inputDir) {
        if (isValueFileReferenced(entity.p12)) {
            entity.p12 = Buffer.from(implodeFileBinary(entity.p12, inputDir)).toString('base64');
        }

        if (isValueFileReferenced(entity.pem)) {
            entity.pem = implodeFile(entity.pem, inputDir);
        }

        const certChain = entity.certChain;
        if (certChain && typeof certChain === 'string' && isValueFileReferenced(certChain)) {
            entity.certChain = readCertFile(implodeFile(certChain, inputDir), true);
        }

        return entity;
    }

    function implodeEntityCert(entity, inputDir) {
        if (isValueFileReferenced(entity.certBase64)) {
            let data = readCertFile(implodeFile(entity.certBase64, inputDir), false);
            entity.certBase64 = data[0];
        }

        return entity;
    }

    function readCertFile(content, includeHeader) {
        const lines = content.split(/\r?\n/);
        const certs = [];
        let data = null;

        for (const line of lines) {
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
