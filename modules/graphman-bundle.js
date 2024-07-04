
const utils = require("./graphman-utils");
const graphman = require("./graphman");
const metadata = require("./graphman").schemaMetadata();
const fileSuffixes = {
    policies: '.policy',
    services: '.service',
    policyFragments: '.policy',
    webApiServices: '.webapi',
    soapServices: '.soap',
    internalWebApiServices: '.internal-webapi',
    internalSoapServices: '.internal-soap',
    globalPolicies: '.global',
    backgroundTaskPolicies: '.bgpolicy'
};

module.exports = {
    EXPORT_USE: 'export',
    IMPORT_USE: 'import',
    ENTITY_TYPE_PLURAL_TAG_FRIENDLY_NAME: {
        policies: 'policy',
        services: 'service',
        policyFragments: 'policy',
        webApiServices: 'webapi',
        soapServices: 'soap',
        internalWebApiServices: 'internal-webapi',
        internalSoapServices: 'internal-soap',
        globalPolicies: 'global',
        backgroundTaskPolicies: 'bgpolicy'
    },

    /**
     * Recommended way to iterate through the bundled entities.
     * Callback will be invoked for every class of entities in the bundle. They will be invoked with the key, entities and type-info as arguments
     * @param bundle input bundle
     * @param knownEntitiesCallback callback function for the known entities
     * @param unknownEntitiesCallback callback function for the unknown entities
     */
    forEach: function (bundle, knownEntitiesCallback, unknownEntitiesCallback) {
        Object.entries(bundle).forEach(([key, entities]) => {
            const typeInfo = graphman.typeInfoByPluralName(key);
            if (typeInfo) {
                if (entities.length) knownEntitiesCallback(key, entities, typeInfo);
            } else if (unknownEntitiesCallback) {
                unknownEntitiesCallback(key, entities);
            } else {
                utils.warn("unknown entities, " + key);
            }
        });
    },

    /**
     * Sorts the bundle entities
     * @param bundle bundle
     * @returns sorted bundle
     */
    sort: function (bundle) {
        const sorted = {};

        Object.keys(bundle)
            .sort()
            .filter(key => Array.isArray(bundle[key]))
            .forEach(key => {
                const typeInfo = graphman.typeInfoByPluralName(key);
                sorted[key] = bundle[key].sort((left, right) => {
                    const lname = this.entityName(left, typeInfo);
                    const rname = this.entityName(right, typeInfo);

                    if (lname < rname) return -1;
                    else if (lname > rname) return 1;
                    else return 0;
                })
            });

        sorted.properties = bundle.properties;
        return sorted;
    },

    sanitize: function (bundle, use, options) {
        use = use || this.EXPORT_USE;

        if (use === this.EXPORT_USE) {
            return exportSanitizer.sanitize(bundle, options);
        } else if (use === this.IMPORT_USE) {
            return importSanitizer.sanitize(bundle, options);
        } else {
            utils.warn("incorrect [use] specified for bundle sanitization: " + use);
        }
    },

    removeDuplicates: function (bundle) {
        const result = {};

        this.forEach(bundle, (key, entities, typeInfo) => {
            const list = this.withArray(result, typeInfo);
            entities.forEach(item => {
                const found = list.find(x => this.isEntityMatches(x, item, typeInfo));
                if (!found) {
                    list.push(item);
                } else {
                    utils.info("found duplicate entity, " + key + "." + this.entityName(item, typeInfo));
                }
            });
        }, (key, value) => {
            result[key] = value;
        });

        return result;
    },

    mappingInstruction: function (action, entity, typeInfo) {
        return {
            action: action,
            source: this.toPartialEntity(entity, typeInfo)
        };
    },

    overrideMappings: function (bundle, options) {
        const properties = bundle.properties = bundle.properties || {};
        const mappings = properties.mappings = properties.mappings || {};

        if (options.bundleDefaultAction) {
            properties.defaultAction = options.bundleDefaultAction;
            utils.info(`overriding bundle default action to ${options.bundleDefaultAction}`);
        }

        if (!options.mappings) {
            return;
        }

        Object.keys(mappings).forEach(key => {
            const overrideMapping = options.mappings[key] || options.mappings['default'];
            const status = {mapping: false, foundDefault: false};

            if (overrideMapping.action) {
                mappings[key].forEach(item => {
                    status.mapping = true;
                    item.action = overrideMapping.action;
                    status.foundDefault = status.foundDefault || item.default;
                });

                if (!status.foundDefault && overrideMapping.action !== properties.defaultAction) {
                    utils.info(`populating default mapping action for ${key} to ${overrideMapping.action}`);
                    mappings[key].unshift({'default': true, action: overrideMapping.action});
                }
            }

            if (status.mapping) {
                utils.info(`overriding mapping action for ${key} to ${overrideMapping.action}`);
            }
        });

        Object.keys(options.mappings).forEach(key => {
            const overrideMapping = options.mappings[key] || options.mappings['default'];
            if (key !== 'default' && !mappings[key] && overrideMapping.action) {
                utils.info(`populating default mapping action for ${key} to ${overrideMapping.action}`);
                mappings[key] = [{action: overrideMapping.action, 'default': true}];
            }
        });
    },

    filter: function (bundle, filter) {
        if (!filter || !filter.by) return;
        if (!filter.equals && !filter.startsWith && !filter.endsWith && !filter.contains) return;

        Object.keys(bundle).filter(key => Array.isArray(bundle[key])).forEach(key => {
            const list = [];
            bundle[key].forEach(item => {
                let match = item.hasOwnProperty(filter.by);

                if (filter.equals) match &= (item[filter.by].toString() === filter.equals);

                if (typeof item[filter.by] === 'string') {
                    if (filter.startsWith) match &= item[filter.by].startsWith(filter.startsWith);
                    if (filter.endsWith) match &= item[filter.by].endsWith(filter.endsWith);
                    if (filter.contains) match &= item[filter.by].includes(filter.contains);
                }

                if (match) list.push(item);
            });
            bundle[key] = list;
            if (bundle[key].length === 0) {
                delete bundle[key];
            }
        });
    },

    withArray: function (bundle, typeInfo) {
        const entities = bundle[typeInfo.pluralName] || [];

        if (entities.length === 0) {
            bundle[typeInfo.pluralName] = entities;
        }

        return entities;
    },

    toPartialEntity: function (entity, typeInfo) {
        const obj = {};
        typeInfo.identityFields.forEach(field => obj[field] = entity[field]);
        return obj;
    },

    isEntityMatches: function (left, right, typeInfo) {
        if (typeInfo.identityFields.length === 1) {
            const fieldName = typeInfo.identityFields[0];
            return left[fieldName] === right[fieldName];
        } else {
            let looped = false;

            for (const fieldName of typeInfo.identityFields) {
                if (left[fieldName] !== undefined && right[fieldName] !== undefined) {
                    looped = true;
                    if (typeof left[fieldName] !== 'object') {
                        if (left[fieldName] !== right[fieldName]) {
                            return false;
                        }
                    } else if (!this.isObjectEquals(left[fieldName], right[fieldName])) {
                        return false;
                    }
                }
            }

            return looped;
        }
    },

    isArrayEquals: function (left, right, fieldPath, callback) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
            if (callback) {
                callback({
                    path: fieldPath,
                    left: left,
                    right: right
                });
            }
            return false;
        }

        let equals = true;
        for (let index = 0; index < left.length; index++) {
            const leftItem = left[index];
            if (typeof leftItem !== 'object') {
                if (leftItem !== right[index]) {
                    if (callback) {
                        callback({
                            path: fieldPath + "[" + index + "]",
                            left: leftItem,
                            right: right[index]
                        });
                        equals = false;
                    } else {
                        return false;
                    }
                }
            } else {
                if (!this.isObjectEquals(leftItem, right[index], fieldPath + "[" + index + "]", callback)) {
                    if (callback) {
                        equals = false;
                    } else {
                        return false;
                    }
                }
            }
        }

        return equals;
    },

    isObjectEquals: function (left, right, fieldPath, callback) {
        if (Array.isArray(left)) {
            return this.isArrayEquals(left, right, fieldPath, callback);
        }

        let equals = true;
        for (const key of Object.keys(left)) {
            const data = {
                path: fieldPath + "." + key,
                left: left[key],
                right: right[key]
            };

            if (!right.hasOwnProperty(key)) { // is field itself missing?
                if (callback) {
                    data.right = null;
                    callback(data);
                    equals = false;
                } else {
                    return false;
                }
            } else if (left[key] == null && right[key] != null) { // special case: are they both nulls?
                if (callback) {
                    callback(data);
                    equals = false;
                } else {
                    return false;
                }
            } else if (typeof left[key] !== typeof right[key]) { // are they differ by type?
                if (callback) {
                    callback(data);
                    equals = false;
                } else {
                    return false;
                }
            } else if (typeof left[key] !== 'object') { // finally, are they differ by value?
                if (left[key] !== right[key]) {
                    if (callback) {
                        callback(data);
                        equals = false;
                    } else {
                        return false;
                    }
                }
            } else {
                if (!this.isObjectEquals(left[key], right[key], fieldPath + "." + key, callback)) {
                    if (callback) {
                        equals = false;
                    } else {
                        return false;
                    }
                }
            }
        }

        // how about new fields from the right?
        for (const key of Object.keys(right)) {
            if (!left.hasOwnProperty(key)) {
                if (callback) {
                    callback({
                        path: fieldPath ? fieldPath + "." + key : key,
                        left: null,
                        right: right[key]
                    });
                    equals = false;
                } else {
                    return false;
                }
            }
        }

        return equals;
    },

    entityName: function (entity, typeInfo) {
        if (typeInfo.identityFields.length === 1 && typeInfo.identityFields[0] === "name") {
            return entity.name;
        }

        return entity.name ?
            entity.name + "-[" + this.entityId(entity, typeInfo) + "]" :
            this.entityId(entity, typeInfo);
    },

    entityId: function (entity, typeInfo) {
        let eid = "";

        for (const fieldName of typeInfo.identityFields) {
            const separator = eid.length > 0 ? "-" : "";
            const fieldValue = entity[fieldName];

            if (typeof fieldValue !== 'object') {
                eid += separator + fieldValue;
            } else if (fieldName === 'resolvers') { // special case
                if (fieldValue["baseUri"]) {
                    eid += separator + fieldValue["baseUri"];
                }

                const soapActions = fieldValue["soapActions"];
                if (Array.isArray(soapActions) && soapActions.length) {
                    eid += separator + soapActions.sort()[0];
                }
            }
        }

        return eid;
    },

    entityFileSuffixByPluralName: function (pluralName) {
        return fileSuffixes[pluralName];
    }
}

let exportSanitizer = function () {
    return {
        sanitize: function (bundle, options) {
            const result = {mappings: {}, dependencyMappings: {}};
            sanitizeBundle(bundle, result, options);

            const mappings = result.mappings;
            const dependencyMappings = result.dependencyMappings;
            delete result.mappings;
            delete result.dependencyMappings;

            if (!result.properties) result.properties = {defaultAction: "NEW_OR_UPDATE"};

            result.properties.defaultAction = options.bundleDefaultAction || result.properties.defaultAction;
            result.properties.mappings = normalizedMappings(mappings, dependencyMappings, options, result.properties.defaultAction);

            if (result.properties.mappings && Object.keys(result.properties.mappings).length === 0) {
                delete result.properties.mappings;
            }

            return result;
        },
    };

    function typeInfoFromVariableBundleName (key) {
        let typeInfo = metadata.bundleTypes[key];
        if (typeInfo) return typeInfo;

        const types = Object.values(metadata.types);

        for (const item of types) {
            if (item.isL7Entity && (key.startsWith(item.singularName) || key.startsWith(item.pluralName))) {
                return item;
            }
        }

        return null;
    }

    function sanitizeBundle(obj, result, options) {
        sanitizeBundleInternal(obj, result, options, false);
        Object.keys(result).filter(key => Array.isArray(result[key])).forEach(key => {
            if (result[key] && result[key].length === 0) {
                delete result[key];
            }
        });
    }

    function sanitizeBundleInternal(obj, result, options, dependencies) {
        Object.keys(obj).forEach(key => {
            const typeInfo = typeInfoFromVariableBundleName(key);
            const sanitizedKey = typeInfo ? typeInfo.pluralName : null;

            if (sanitizedKey) {
                const goidRequired = typeInfo.goidRefEnabled || !options.excludeGoids;

                if (!result[sanitizedKey]) result[sanitizedKey] = [];
                if (!result.mappings[sanitizedKey]) result.mappings[sanitizedKey] = [];
                if (!result.dependencyMappings[sanitizedKey]) result.dependencyMappings[sanitizedKey] = [];

                if (typeInfo.deprecated) {
                    utils.warn("found deprecated entity type: " + sanitizedKey + ", revise the query");
                }

                if (Array.isArray(obj[key])) {
                    if (obj[key].length) utils.info(`sanitizing ${key} to ${sanitizedKey}`);
                    obj[key].forEach(item => {
                        const entity = sanitizeEntity(item, result, typeInfo, options, dependencies, goidRequired);
                        addEntity(entity, result, typeInfo, options, dependencies, sanitizedKey);
                    });
                } else {
                    utils.info(`sanitizing ${key} to ${sanitizedKey}`);
                    const entity = sanitizeEntity(obj[key], result, typeInfo, options, dependencies, goidRequired);
                    addEntity(entity, result, typeInfo, options, dependencies, sanitizedKey);
                }
            } else if (key === 'properties') {
                result[key] = obj[key];
            } else {
                utils.warn(`unrecognized key (${key}) with the bundle`);
            }
        });
    }

    function addEntity(entity, result, typeInfo, options, dependencies, sanitizedKey) {
        if (dependencies && options.excludeDependencies) {
            utils.info(`excluding the dependency ${sanitizedKey} - ${entity[typeInfo.idField]}`);
            if (entity.mappingInstruction) result.dependencyMappings[sanitizedKey].push(entity.mappingInstruction);
        } else {
            result[sanitizedKey].push(entity);
            if (entity.mappingInstruction) result.mappings[sanitizedKey].push(entity.mappingInstruction);
        }

        delete entity.mappingInstruction;
    }

    function sanitizeEntity(obj, result, typeInfo, options, dependencies, goidRequired) {
        obj.mappingInstruction = createMappingInstruction(obj, typeInfo, options, dependencies);

        if (obj.policy && obj.policy.allDependencies) {
            utils.info(`expanding ${obj.name} policy (all) dependencies`);
            sanitizeBundleInternal(obj.policy.allDependencies, result, options, true);
            delete obj.policy.allDependencies;
        }

        if (obj.policy && obj.policy.directDependencies) {
            utils.info(`expanding ${obj.name} policy (direct) dependencies`);
            sanitizeBundleInternal(obj.policy.directDependencies, result, options, true);
            delete obj.policy.directDependencies;
        }

        if (obj.filePartName) delete obj.filePartName;
        if (!goidRequired) delete obj.goid;

        return obj;
    }

    function createMappingInstruction(obj, typeInfo, options, dependencies) {
        const actions = options.mappings[typeInfo.pluralName] || options.mappings['default'];
        const instruction = {action: actions.action, level: actions.level};

        if (!instruction.action || !instruction.level || instruction.level === '0') return null;

        typeInfo.identityFields.forEach(field => instruction[field] = obj[field]);

        if (dependencies) {
            if (options.excludeDependencies) {
                instruction['action'] = 'NEW_OR_EXISTING';
                instruction['nodef'] = true;
                instruction['failOnNew'] = true;
            }

            instruction['dep'] = true;
        }

        delete instruction.level;
        return instruction;
    }

    function normalizedMappings(mappings, dependencyMappings, options, bundleDefaultAction) {
        removeDuplicateInstructions(mappings);

        Object.keys(mappings).forEach(key => {
            let entityMappings = mappings[key];
            let dependencyEntityMappings = dependencyMappings[key];

            if (dependencyEntityMappings) {
                dependencyEntityMappings.forEach(item => {
                    if (!isDuplicateMatchingInstruction(entityMappings, item, metadata.bundleTypes[key])) {
                        entityMappings.push(item);
                    }
                });
            }

            const mapping = options.mappings[key] || options.mappings['default'];
            if (mapping && mapping.action && mapping.level === '0' && mapping.action !== bundleDefaultAction) {
                entityMappings.unshift({action: mapping.action, 'default': true});
            }

            if (entityMappings.length === 0) {
                delete mappings[key];
            }
        });


        return mappings;
    }

    function removeDuplicateInstructions(mappings) {
        Object.keys(mappings).forEach(key => {
            let entityMappings = mappings[key];
            const list = [];
            entityMappings.forEach(item => {
                if (!isDuplicateMatchingInstruction(list, item, metadata.bundleTypes[key])) list.push(item);
            });
            mappings[key] = list;
        });
    }

    function isDuplicateMatchingInstruction(list, ele, typeInfo) {
        for (const item of list) {
            let match = true;

            for (const field of typeInfo.identityFields) {
                if (ele[field] !== item[field]) {
                    match = false;
                    break;
                }
            }

            if (match) return true;
        }

        return false;
    }


}();

let importSanitizer = function () {
    return {
        sanitize: function (bundle, options) {
            Object.keys(bundle).forEach(key => {
                const typeInfo = metadata.bundleTypes[key];

                utils.info("inspecting " + key);

                if (!typeInfo) {
                    utils.warn("found unknown entity type: " + key);
                } else if (typeInfo.deprecated) {
                    utils.warn("found deprecated entity type: " + key + ", revise the bundle");
                }

                const goidRequired = typeInfo ? typeInfo.goidRefEnabled : false;
                const includeGoids = !options.excludeGoids;

                if (Array.isArray(bundle[key])) {
                    bundle[key].forEach(item => sanitizeEntity(item, key, goidRequired || includeGoids));
                    if (bundle[key].length === 0) {
                        delete bundle[key];
                    }
                } else if (key !== "properties") {
                    sanitizeEntity(bundle[key], key, goidRequired || includeGoids);
                }
            });

            return bundle;
        }
    };

    function sanitizeEntity(entity, pluralMethod, goidRequired) {
        if (!goidRequired) delete entity.goid;

        if (pluralMethod === "internalGroups") {
            if (entity.members) {
                utils.info(`removing members field(s) from internalGroups ${entity.name}`);
                delete entity.members;
            }
        } else if (pluralMethod === "fipGroups") {
            if (entity.members) {
                utils.info(`removing members field(s) from fipGroups ${entity.name}`);
                delete entity.members;
            }
        } else if (pluralMethod === "serverModuleFiles") {
            if (entity.filePartName||entity.moduleStates||entity.moduleStateSummary) {
                utils.info(`removing filePartName|moduleStates|moduleStateSummary field(s) from serverModuleFiles ${entity.name}`);
                delete entity.filePartName;
                delete entity.moduleStates;
                delete entity.moduleStateSummary;
            }
        } else if (pluralMethod === "trustedCerts") {
            if (entity.revocationCheckPolicy) {
                utils.info(`removing revocationCheckPolicy field(s) from trustedCerts ${entity.name}`);
                delete entity.revocationCheckPolicy;
            }
        } else if (entity.hardwiredService) {
            utils.info(`removing hardwiredService field from ${pluralMethod} ${entity.name}`);
            delete entity.hardwiredService;
        }
    }
}();