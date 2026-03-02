// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

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
     * @param params.package name of the package file that specifies which entities to include
     * @param params.sections one or more sections of the bundle for inclusion (used only when package is not specified)
     * @param params.options name-value pairs used to customize explode operation
     */
    run: function (params) {
        if (!params.input) {
            throw "--input parameter is missing";
        }

        const inputDir = params.input;
        const packageFile = params.package;
        const sections = params.package ? undefined : params.sections;
        const bundle = type1Imploder.implode(inputDir, packageFile, sections);

        utils.writeResult(params.output, butils.sort(bundle));
    },

    initParams: function (params, config) {
        params.sections = params.sections || ["*"];
        if (!Array.isArray(params.sections)) {
            params.sections = [params.sections];
        }
        return params;
    },

    usage: function () {
        console.log("implode --input <input-dir>");
        console.log("  [--output <output-file>]");
        console.log("  [--package <package-file>]");
        console.log("  [--sections <section>...]");
        console.log();
        console.log("Implodes the gateway configuration from directory into a bundle.");
        console.log();
        console.log("  --input <input-dir>");
        console.log("    specify the input directory that contains gateway configuration");
        console.log();
        console.log("  --output <output-file>");
        console.log("    specify the file to capture the imploded gateway configuration as bundle");
        console.log();
        console.log("  --package <package-file>");
        console.log("    specify the package file that defines which entities to include");
        console.log("    format: { \"<section>\": [{\"source\": <entity-summary>|<file-name>}] }");
        console.log("    where section is entity type and source is entity summary object or file name string");
        console.log("    file name supports wildcards (* and ?) for pattern matching");
        console.log();
        console.log("  --sections <section> <section> ...");
        console.log("    specify one or more sections of the bundle for inclusion");
        console.log("    section refers to the plural name of the entity type (e.g. services, policies)");
        console.log("    * is a special section name, used to refer all the sections of a bundle");
        console.log("    by default, all the sections of the bundle will be considered.");
        console.log("    this parameter is honored only when --package is not specified.");
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

    function isSectionIncluded(sections, sectionName) {
        return !sections || sections.length === 0 || sections.includes("*") || sections.includes(sectionName);
    }

    return {
        implode: function (inputDir, packageFile, sections) {
            const bundle = {};
            let packageSpec = null;
            let selectedEntities = new Set();
            let entityFileMap = new Map();

            if (!utils.existsFile(inputDir) || !utils.isDirectory(inputDir)) {
                throw utils.newError(`directory does not exist or not a directory, ${inputDir}`);
            }

            // Load package file if specified (sections is ignored when package is specified)
            if (packageFile) {
                if (!utils.existsFile(packageFile)) {
                    throw utils.newError(`package file does not exist: ${packageFile}`);
                }
                packageSpec = JSON.parse(utils.readFile(packageFile));
                utils.info(`using package file: ${packageFile}`);
            }

            // First pass: collect all entities and build file mapping
            utils.listDir(inputDir).forEach(item => {
                const subDir = inputDir + "/" + item;
                if (utils.isDirectory(subDir)) {
                    const typeInfo = graphman.typeInfoByPluralName(item);
                    if (typeInfo) {
                        collectEntities(subDir, item, typeInfo, entityFileMap);
                    } else if (item === "tree") {
                        collectFolderableEntities(subDir, entityFileMap);
                    }
                }
            });

            // Second pass: select entities based on package file
            if (packageSpec) {
                selectEntitiesFromPackage(packageSpec, entityFileMap, selectedEntities, inputDir);
            }

            // Third pass: read selected entities and their dependencies
            utils.listDir(inputDir).forEach(item => {
                const subDir = inputDir + "/" + item;
                if (utils.isDirectory(subDir)) {
                    const typeInfo = graphman.typeInfoByPluralName(item);
                    if (typeInfo) {
                        if (!isSectionIncluded(sections, item)) {
                            utils.info("ignoring " + item);
                            return;
                        }
                        utils.info("imploding " + item);
                        readEntities(subDir, item, typeInfo, bundle, selectedEntities, packageSpec);
                    } else if (item === "tree") {
                        readFolderableEntities(subDir, bundle, selectedEntities, packageSpec, sections);
                    } else {
                        utils.info("unknown entities, " + item);
                    }
                }
            });

            const propertiesFile = utils.path(inputDir, 'bundle-properties.json');
            if (utils.existsFile(propertiesFile)) {
                bundle['properties'] = utils.readFile(propertiesFile);
                
                // Filter mappings to only include selected entities and their dependencies
                if (packageSpec && bundle['properties'].mappings) {
                    filterMappings(bundle['properties'].mappings, selectedEntities, entityFileMap);
                }
            }

            return bundle;
        }
    };

    function collectEntities(inputDir, pluralName, typeInfo, entityFileMap) {
        utils.listDir(inputDir).forEach(item => {
            if (item.endsWith(".json")) {
                const filePath = `${inputDir}/${item}`;
                const entity = utils.readFile(filePath);
                const key = `${pluralName}:${item}`;
                entityFileMap.set(key, { entity, typeInfo, filePath, pluralName });
            }
        });
    }

    function collectFolderableEntities(dir, entityFileMap) {
        utils.listDir(dir).forEach(item => {
            if (utils.isDirectory(dir + "/" + item)) {
                collectFolderableEntities(`${dir}/${item}`, entityFileMap);
            } else {
                const pluralName = butils.entityPluralNameByFile(item);
                let typeInfo = pluralName ? graphman.typeInfoByPluralName(pluralName) : null;
                if (typeInfo) {
                    const filePath = `${dir}/${item}`;
                    const entity = utils.readFile(filePath);
                    const key = `${pluralName}:${item}`;
                    entityFileMap.set(key, { entity, typeInfo, filePath, pluralName });
                }
            }
        });
    }

    function selectEntitiesFromPackage(packageSpec, entityFileMap, selectedEntities, inputDir) {
        Object.keys(packageSpec).forEach(section => {
            const typeInfo = graphman.typeInfoByPluralName(section);
            if (!typeInfo) {
                utils.warn(`unknown entity type in package file: ${section}`);
                return;
            }

            const packageItems = packageSpec[section];
            if (!Array.isArray(packageItems)) {
                utils.warn(`package file section ${section} should be an array`);
                return;
            }

            packageItems.forEach(item => {
                if (typeof item !== 'object' || item.source === undefined) {
                    utils.warn(`invalid package item in ${section}, expected object with 'source' property`);
                    return;
                }

                const source = item.source;
                if (typeof source === 'string') {
                    selectEntitiesByFileName(section, source, entityFileMap, selectedEntities);
                } else if (typeof source === 'object') {
                    const matched = findEntityBySummary(section, source, entityFileMap, typeInfo);
                    if (matched) {
                        selectedEntities.add(matched);
                        utils.info(`selected entity from package: ${section} - ${butils.entityName(entityFileMap.get(matched).entity, typeInfo)}`);
                    } else {
                        utils.warn(`entity not found matching summary in ${section}: ${JSON.stringify(source)}`);
                    }
                }
            });
        });

    }

    function selectEntitiesByFileName(section, fileName, entityFileMap, selectedEntities) {
        if (fileName.includes('*') || fileName.includes('?')) {
            const pattern = new RegExp('^' + fileName.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
            let found = false;
            for (const [key] of entityFileMap.entries()) {
                if (key.startsWith(section + ":")) {
                    const entryFileName = key.substring(section.length + 1);
                    if (pattern.test(entryFileName)) {
                        selectedEntities.add(key);
                        utils.info(`selected entity from package (wildcard): ${section}/${entryFileName}`);
                        found = true;
                    }
                }
            }
            if (!found) {
                utils.warn(`no entity files matched wildcard: ${section}/${fileName}`);
            }
        } else {
            const key = `${section}:${fileName}`;
            if (entityFileMap.has(key)) {
                selectedEntities.add(key);
                utils.info(`selected entity from package: ${section}/${fileName}`);
            } else {
                utils.warn(`entity file not found: ${section}/${fileName}`);
            }
        }
    }

    function findEntityBySummary(section, summary, entityFileMap, typeInfo) {
        for (const [key, value] of entityFileMap.entries()) {
            if (key.startsWith(section + ":")) {
                const entity = value.entity;
                if (matchesSummary(entity, summary, typeInfo)) {
                    return key;
                }
            }
        }
        return null;
    }

    function matchesSummary(entity, summary, typeInfo) {
        // Match based on identity fields
        for (const field of typeInfo.identityFields) {
            if (summary[field] !== undefined && entity[field] !== summary[field]) {
                return false;
            }
        }
        // Also check goid if present in summary
        if (summary.goid !== undefined && entity.goid !== summary.goid) {
            return false;
        }
        return true;
    }

    function readEntities(inputDir, pluralName, typeInfo, bundle, selectedEntities, packageSpec) {
        const entities = butils.withArray(bundle, typeInfo);
        utils.listDir(inputDir).forEach(item => {
            if (item.endsWith(".json")) {
                const key = `${pluralName}:${item}`;
                if (!packageSpec || selectedEntities.has(key)) {
                    utils.info(`  ${item}`);
                    const entity = utils.readFile(`${inputDir}/${item}`);
                    const subImploder = subImploders[typeInfo.pluralName];
                    entities.push(subImploder ? subImploder.apply(entity, inputDir) : entity);
                }
            }
        });
    }

    function readFolderableEntities(dir, bundle, selectedEntities, packageSpec, sections) {
        utils.listDir(dir).forEach(item => {
            if (utils.isDirectory(dir + "/" + item)) {
                readFolderableEntities(`${dir}/${item}`, bundle, selectedEntities, packageSpec, sections);
            } else {
                readFolderableEntity(dir, item, bundle, selectedEntities, packageSpec, sections);
            }
        });
    }

    function readFolderableEntity(path, filename, bundle, selectedEntities, packageSpec, sections) {
        const pluralName = butils.entityPluralNameByFile(filename);
        let typeInfo = pluralName ? graphman.typeInfoByPluralName(pluralName) : null;

        if (typeInfo) {
            if (!isSectionIncluded(sections, pluralName)) {
                return;
            }
            const key = `${pluralName}:${filename}`;
            if (!packageSpec || selectedEntities.has(key)) {
                const entity = utils.readFile(`${path}/${filename}`);

                // for backward compatibility, check whether the entity is of type policy fragment
                if (filename.endsWith(".policy.json") && !entity.policyType) {
                    typeInfo = graphman.typeInfoByPluralName("policyFragments");
                }

                const entities = butils.withArray(bundle, typeInfo);
                entities.push(implodeServiceOrPolicy(entity, path));
            }
        }
    }

    function isValueFileReferenced(data, fileExtension) {
        return data && data.startsWith("{") && data.endsWith("}") &&
            (!fileExtension || (data.endsWith(fileExtension + "}") || data.endsWith(fileExtension + "}}")));
    }

    function implodeFile(data, path) {
        let filename = data.startsWith("{{") && data.endsWith("}}") ?
            data.substring(2, data.length - 2) :
            data.substring(1, data.length - 1);

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

        if (isValueFileReferenced(entity.wsdl)) {
            entity.wsdl = implodeFile(entity.wsdl, inputDir);
        }

        if (Array.isArray(entity.wsdlResources)) {
            entity.wsdlResources.forEach(item => {
                if (isValueFileReferenced(item.content)) {
                    item.content = implodeFile(item.content, inputDir);
                }
            });
        }

        return entity;
    }

    function implodePolicyCode(entity, policy, inputDir) {
        if (isValueFileReferenced(policy.xml)) {
            policy.xml = implodeFile(policy.xml, inputDir);
        } else if (isValueFileReferenced(policy.json, ".cjson")) {
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

    function filterMappings(mappings, selectedEntities, entityFileMap) {
        Object.keys(mappings).forEach(section => {
            const typeInfo = graphman.typeInfoByPluralName(section);
            if (!typeInfo) {
                // Unknown entity type, keep all mappings
                return;
            }

            const entityMappings = mappings[section];
            if (!Array.isArray(entityMappings)) {
                return;
            }

            // Filter mappings to only include those matching selected entities
            const filteredMappings = entityMappings.filter(mapping => {
                // Keep default mappings
                if (mapping.default) {
                    return true;
                }

                // Check if this mapping matches any selected entity
                const source = mapping.source || mapping;
                return isMappingMatchingSelectedEntity(section, source, selectedEntities, entityFileMap, typeInfo);
            });

            if (filteredMappings.length === 0) {
                delete mappings[section];
            } else {
                mappings[section] = filteredMappings;
            }
        });
    }

    function isMappingMatchingSelectedEntity(section, source, selectedEntities, entityFileMap, typeInfo) {
        // Check each selected entity to see if it matches this mapping
        for (const key of selectedEntities) {
            if (!key.startsWith(section + ":")) {
                continue;
            }

            const entry = entityFileMap.get(key);
            if (!entry) {
                continue;
            }

            const entity = entry.entity;
            
            // Match based on identity fields
            // A mapping matches if all identity fields in the source match the entity
            let hasMatchingFields = false;
            let allFieldsMatch = true;
            
            for (const field of typeInfo.identityFields) {
                if (source[field] !== undefined) {
                    hasMatchingFields = true;
                    if (entity[field] !== source[field]) {
                        allFieldsMatch = false;
                        break;
                    }
                }
            }

            // If we have at least one matching field and all match, this mapping belongs to this entity
            if (hasMatchingFields && allFieldsMatch) {
                return true;
            }
        }

        return false;
    }
})();
