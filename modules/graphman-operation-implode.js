
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");

module.exports = {
    run: function (params) {
        if (!params.input) {
            throw "Missing --input parameter";
        }

        const inputDir = params.input;
        let bundle;
        if (params.type === "type2") {
            bundle = type2Imploder.implode(inputDir);
        } else {
            if (params.type && params.type !== "type1") utils.info("unrecognised exploded format " + params.type + ", fall backing to default format");
            bundle = type1Imploder.implode(inputDir);
        }

        utils.writeResult(params.output, butils.sort(bundle));
    },

    usage: function () {
        console.log("    implode --input <input-directory> [--output <output-file>] [<options>]");
        console.log("      --type <exploded-format>");
        console.log("        # <exploded-format> can be either type1 or type2. Default option is type1.");
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
                    bundle[type].push(utils.readFile(`${typeDir}/${item}`));
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
        Object.entries(butils.ENTITY_TYPE_PLURAL_TAG_FRIENDLY_NAME).forEach(([key, value]) => {
            if (filename.endsWith(`.${value}.json`)) {
                if (!bundle[key]) bundle[key] = [];
                bundle[key].push(utils.readFile(`${dir}/${filename}`));
            }
        });
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
