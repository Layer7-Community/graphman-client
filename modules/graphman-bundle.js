
const utils = require("./graphman-utils");
const SCHEMA_METADATA = require("./graphman").schemaMetadata();
const GOID_PLURAL_METHODS = ["fipUsers", "federatedUsers", "internalUsers", "fipGroups", "federatedGroups", "internalGroups", "ldaps", "ldapIdps", "fips", "federatedIdps", "trustedCerts"];
const DEPRECATED_TYPES = [
    "webApiServices", "soapServices", "internalWebApiServices", "internalSoapServices",
    "policyFragments", "globalPolicies", "backgroundTaskPolicies",
    "fips", "ldaps", "fipUsers", "fipGroups"
];

module.exports = {
    EXPORT_USE: 'export',
    IMPORT_USE: 'import',
    GOID_MAPPING_PLURAL_METHODS: GOID_PLURAL_METHODS,
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

    sort: function (bundle) {
        const comparator = (left, right) => {
            const lname = this.entityName(left);
            const rname = this.entityName(right);

            if (lname < rname) return -1;
            else if (lname > rname) return 1;
            else return 0;
        };

        if (Array.isArray(bundle)) {
            bundle.sort(comparator);
        } else {
            Object.keys(bundle).filter(key => Array.isArray(bundle[key])).forEach(key => {
                bundle[key].sort(comparator);
            });
        }

        return bundle;
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
        Object.keys(bundle).filter(key => Array.isArray(bundle[key])).forEach(key => {
            const list = [];
            bundle[key].forEach(item => {
                if (!this.findMatchingEntity(list, item)) list.push(item);
            });
            bundle[key] = list;
            if (bundle[key].length === 0) {
                delete bundle[key];
            }
        });
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
        if (!filter.equals && !filter.startsWith && !filter.endsWith && !filter.contains && !filter.greaterThan && !filter.lessThan) return;


        Object.keys(bundle).filter(key => Array.isArray(bundle[key])).forEach(key => {
            const list = [];
            bundle[key].forEach(item => {
                let match = item.hasOwnProperty(filter.by);

                if (filter.equals) match &= (item[filter.by].toString() === filter.equals);

                if (typeof item[filter.by] === 'string') {
                    if (filter.startsWith) match &= item[filter.by].startsWith(filter.startsWith);
                    if (filter.endsWith) match &= item[filter.by].endsWith(filter.endsWith);

                    // use match instead of includes -support of regex for filter.contains
                    if (filter.contains) {
                        result=item[filter.by].match(new RegExp(filter.contains,"g"));
                        match &= (result && result !== 'null' && result !== 'undefined');
                    }

                    // Do Date comparison for currently known DateTime fields (notAfter|notBefore|executionDate). Otherwise do string comparison.
                    if (filter.by == "notAfter" || filter.by == "notBefore" || filter.by == "executionDate" ) {
                        if (filter.greaterThan) match &= (new Date(item[filter.by]) > new Date(filter.greaterThan));
                        if (filter.lessThan) match &= (new Date(item[filter.by]) < new Date(filter.lessThan));
                    }
                    else {
                        if (filter.greaterThan) match &= (item[filter.by] > filter.greaterThan);
                        if (filter.lessThan) match &= (item[filter.by] < filter.lessThan);
                    }
                }

                // filter.not support
                if (filter.not) match = !match;

                if (match) list.push(item);
            });
            bundle[key] = list;
            if (bundle[key].length === 0) {
                delete bundle[key];
            }
        });
    },

    findMatchingEntity: function (list, entity) {
        for (var item of list) {
            if (this.matchEntity(entity, item)) {
                return item;
            }
        }

        return null;
    },

    matchEntity: function (left, right) {
        const idRef = this.entityIdRef(left);

        if (!idRef) return false;
        else if (idRef === 'resolvers') {
            if (!matchSoapResolvers(left, right)) return false;
        }
        else if (left[idRef] !== right[idRef]) return false;

        if (left.name && left.direction && left.providerType &&
            (left.name !== right.name || left.direction !== right.direction || left.providerType !== right.providerType)) return false;

        if (idRef !== 'name' && left.name && right.name && left.name !== right.name) return false;

        return true;
    },

    entityIdRef: function (entity) {
        if (entity.systemId) return 'systemId';
        if (entity.thumbprintSha1) return 'thumbprintSha1';
        if (entity.resolvers) return 'resolvers';
        if (entity.resolutionPath) return 'resolutionPath';
        if (entity.alias) return 'alias';
        if (entity.tag) return 'tag';
        if (entity.providerName) return 'providerName';
        if (entity.login) return 'login';
        if (entity.name) return 'name';

        return null;
    },

    entityName: function (entity, attr) {
        const idRef = this.entityIdRef(entity);
        if (attr) attr.ref = idRef;

        if (entity.providerType && entity.direction && entity.name) {
            return entity.direction + "-" + entity.providerType + "-" + entity.name;
        } else if (entity.providerName) {
            return entity.providerName + "-" + entity.name;
        } else if (entity.resolvers) {
            const baseUri = entity.resolvers.baseUri ? "-" + entity.resolvers.baseUri : "";
            const soapAction = Array.isArray(entity.resolvers.soapActions) && entity.resolvers.soapActions.length > 0 ? "-" + entity.resolvers.soapActions.sort()[0] : "";
            return entity.resolvers.resolutionPath + baseUri + soapAction;
        } else {
            return idRef ? entity[idRef] :null;
        }
    },

    entityDisplayName: function (entity) {
        const attr = {};
        const entityName = this.entityName(entity, attr);

        if (entity.name) {
            return attr.ref !== 'name' ? entity.name + "-" + entityName : entityName;
        } else {
            return entityName;
        }
    }
}

function matchSoapResolvers(left, right) {
    if (left.resolvers && right.resolvers) {
        if (left.resolvers.baseUri && left.resolvers.baseUri !== right.resolvers.baseUri) {
            return false;
        }

        if (Array.isArray(left.resolvers.soapActions) && Array.isArray(right.resolvers.soapActions)) {
            if (left.resolvers.soapActions.length !== right.resolvers.soapActions.length) {
                return false;
            }

            for (var item of left.resolvers.soapActions) {
                if (!right.resolvers.soapActions.includes(item)) {
                    return false;
                }
            }
        }

        return left.resolvers.resolutionPath === right.resolvers.resolutionPath;
    }
    return false;
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
        let typeName = SCHEMA_METADATA.pluralMethods[key];
        if (typeName) return SCHEMA_METADATA.types[typeName];

        const types = Object.values(SCHEMA_METADATA.types);

        for (var item of types) {
            if (item.prefix && key.startsWith(item.prefix)) {
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
            const sanitizedKey = typeInfo ? typeInfo.pluralMethod : null;
            const goidRequired = GOID_PLURAL_METHODS.includes(key) || (!options.excludeGoids);

            if (sanitizedKey) {
                if (!result[sanitizedKey]) result[sanitizedKey] = [];
                if (!result.mappings[sanitizedKey]) result.mappings[sanitizedKey] = [];
                if (!result.dependencyMappings[sanitizedKey]) result.dependencyMappings[sanitizedKey] = [];

                if (DEPRECATED_TYPES.includes(sanitizedKey)) {
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
        typeInfo = SCHEMA_METADATA.bundleTypes[typeInfo.pluralMethod];
        const actions = options.mappings[typeInfo.bundleName] || options.mappings['default'];
        const instruction = {action: actions.action, level: actions.level};

        if (!instruction.action || !instruction.level || instruction.level === '0') return null;

        instruction[typeInfo.identityField] = obj[typeInfo.identityField];
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
                    if (!isDuplicateMatchingInstruction(entityMappings, item, SCHEMA_METADATA.bundleTypes[key])) {
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
                if (!isDuplicateMatchingInstruction(list, item, SCHEMA_METADATA.bundleTypes[key])) list.push(item);
            });
            mappings[key] = list;
        });
    }

    function isDuplicateMatchingInstruction(list, ele, typeInfo) {
        for (var item of list) {
            if (ele[typeInfo.identityField] === item[typeInfo.identityField]) {
                if (typeInfo.identityFields.length === 0) return true;

                for (var field of typeInfo.identityFields) {
                    if (ele[field] !== item[field]) return false;
                }
                return true;
            }
        }

        return false;
    }


}();

let importSanitizer = function () {
    return {
        sanitize: function (bundle, options) {
            Object.keys(bundle).forEach(key => {
                const goidRequired = GOID_PLURAL_METHODS.includes(key);
                const includeGoids = !options.excludeGoids;
                utils.info("inspecting " + key);

                if (DEPRECATED_TYPES.includes(key)) {
                    utils.warn("found deprecated entity type: " + key + ", revise the bundle");
                }

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