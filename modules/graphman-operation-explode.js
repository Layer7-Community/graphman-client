
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");

module.exports = {
    run: function (params) {
        if (!params.input) {
            throw "Missing --input parameter";
        }

        if (!params.output) {
            throw "Missing --output parameter";
        }

        const bundle = utils.readFile(params.input);
        const outputDir = params.output;

        utils.mkDir(outputDir);
        utils.info(`exploding to ${outputDir}`);

        if (params.type === "type2") {
            type2Exploder.explode(bundle, outputDir);
        } else {
            if (params.type && params.type !== "type1") utils.info("unrecognised explode format " + params.type + ", fall backing to default format");
            type1Exploder.explode(bundle, outputDir);
        }
    },

    usage: function () {
        console.log("    explode --input <input-file> [--output <output-directory>] [<options>]");
        console.log("      --type <explode-format>");
        console.log("        # <explode-format> can be either type1 or type2. Default option is type1.");
    }
}

let type1Exploder = (function () {
    return {
        explode: function (bundle, outputDir) {
            Object.entries(bundle).forEach(([key, entities]) => {
                if (entities.length) {
                    utils.info(`exploding ${key}`);
                    entities.forEach(item => writeEntity(outputDir, key, item));
                }
            });
        }
    };

    function writeEntity(dir, key, entity) {
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
