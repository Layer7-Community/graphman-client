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
     * @param params.package name of the package file that specifies which entities to include
     * @param params.options name-value pairs used to customize explode operation
     */
    run: function (params) {
        if (!params.input) {
            throw "--input parameter is missing";
        }

        const inputDir = params.input;
        const packageFile = params.package;
        const bundle = type1Imploder.implode(inputDir, packageFile);

        utils.writeResult(params.output, butils.sort(bundle));
    },

    initParams: function (params, config) {
        //do nothing
        return params;
    },

    usage: function () {
        console.log("implode --input <input-dir>");
        console.log("  [--output <output-file>]");
        console.log("  [--package <package-file>]");
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
        console.log("    format: { \"<section>\": [<summary> | <file-name>] }");
        console.log("    where section is entity type and value is array of entity summary or file name");
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
        implode: function (inputDir, packageFile) {
            const bundle = {};
            let packageSpec = null;
            let selectedEntities = new Set();
            let entityFileMap = new Map();

            if (!utils.existsFile(inputDir) || !utils.isDirectory(inputDir)) {
                throw utils.newError(`directory does not exist or not a directory, ${inputDir}`);
            }

            // Load package file if specified
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
                        utils.info("imploding " + item);
                        readEntities(subDir, item, typeInfo, bundle, selectedEntities, packageSpec);
                    } else if (item === "tree") {
                        readFolderableEntities(subDir, bundle, selectedEntities, packageSpec);
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
                if (typeof item === 'string') {
                    // Item is a file name
                    const key = `${section}:${item}`;
                    if (entityFileMap.has(key)) {
                        selectedEntities.add(key);
                        utils.info(`selected entity from package: ${section}/${item}`);
                    } else {
                        utils.warn(`entity file not found: ${section}/${item}`);
                    }
                } else if (typeof item === 'object') {
                    // Item is an entity summary object
                    const matched = findEntityBySummary(section, item, entityFileMap, typeInfo);
                    if (matched) {
                        selectedEntities.add(matched);
                        utils.info(`selected entity from package: ${section} - ${butils.entityName(entityFileMap.get(matched).entity, typeInfo)}`);
                    } else {
                        utils.warn(`entity not found matching summary in ${section}: ${JSON.stringify(item)}`);
                    }
                }
            });
        });

        // Resolve dependencies for selected entities
        resolveDependencies(selectedEntities, entityFileMap, inputDir);
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

    function resolveDependencies(selectedEntities, entityFileMap, inputDir) {
        const processed = new Set();
        const toProcess = Array.from(selectedEntities);

        while (toProcess.length > 0) {
            const key = toProcess.shift();
            if (processed.has(key)) continue;
            processed.add(key);

            const entry = entityFileMap.get(key);
            if (!entry) continue;

            const { entity, typeInfo } = entry;

            // Find dependencies in the entity
            const dependencies = findDependencies(entity, typeInfo, entityFileMap, inputDir);
            dependencies.forEach(depKey => {
                if (!selectedEntities.has(depKey)) {
                    selectedEntities.add(depKey);
                    toProcess.push(depKey);
                    const depEntry = entityFileMap.get(depKey);
                    if (depEntry) {
                        utils.info(`  including dependency: ${depKey} - ${butils.entityName(depEntry.entity, depEntry.typeInfo)}`);
                    }
                }
            });
        }
    }

    function findDependencies(entity, typeInfo, entityFileMap, inputDir) {
        const dependencies = [];

        // Check for policy dependencies (these might exist if the directory was created from an export with dependencies)
        if (entity.policy) {
            if (entity.policy.allDependencies) {
                addDependenciesFromBundle(entity.policy.allDependencies, entityFileMap, dependencies);
            }
            if (entity.policy.directDependencies) {
                addDependenciesFromBundle(entity.policy.directDependencies, entityFileMap, dependencies);
            }
        }

        // For services, check for referenced policies
        if (typeInfo.pluralName === "services" && entity.policy) {
            // Service references a policy - try to find it
            if (entity.policy.goid) {
                findEntityByGoid("policies", entity.policy.goid, entityFileMap, dependencies);
            }
        }

        // Check for key references
        if (entity.keyRef) {
            findEntityByGoid("keys", entity.keyRef.goid || entity.keyRef, entityFileMap, dependencies);
        }

        // Check for trusted cert references
        if (entity.trustedCertRefs && Array.isArray(entity.trustedCertRefs)) {
            entity.trustedCertRefs.forEach(ref => {
                findEntityByGoid("trustedCerts", ref.goid || ref, entityFileMap, dependencies);
            });
        }

        return dependencies;
    }

    function findEntityByGoid(section, goid, entityFileMap, dependencies) {
        if (!goid) return;

        for (const [key, value] of entityFileMap.entries()) {
            if (key.startsWith(section + ":")) {
                const entity = value.entity;
                if (entity.goid === goid) {
                    dependencies.push(key);
                    return;
                }
            }
        }
    }

    function addDependenciesFromBundle(dependencyBundle, entityFileMap, dependencies) {
        Object.keys(dependencyBundle).forEach(section => {
            const typeInfo = graphman.typeInfoByPluralName(section);
            if (!typeInfo) return;

            const depEntities = Array.isArray(dependencyBundle[section]) ? dependencyBundle[section] : [dependencyBundle[section]];
            depEntities.forEach(depEntity => {
                const key = findEntityBySummary(section, depEntity, entityFileMap, typeInfo);
                if (key) {
                    dependencies.push(key);
                }
            });
        });
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

    function readFolderableEntities(dir, bundle, selectedEntities, packageSpec) {
        utils.listDir(dir).forEach(item => {
            if (utils.isDirectory(dir + "/" + item)) {
                readFolderableEntities(`${dir}/${item}`, bundle, selectedEntities, packageSpec);
            } else {
                readFolderableEntity(dir, item, bundle, selectedEntities, packageSpec);
            }
        });
    }

    function readFolderableEntity(path, filename, bundle, selectedEntities, packageSpec) {
        const pluralName = butils.entityPluralNameByFile(filename);
        let typeInfo = pluralName ? graphman.typeInfoByPluralName(pluralName) : null;

        if (typeInfo) {
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
