
const utils = require("./graphman-utils");
const SCHEMA_METADATA = require("./graphman").schemaMetadata();
const GOID_PLURAL_METHODS = ["fipUsers", "internalUsers", "fipGroups", "internalGroups", "ldaps", "fips", "trustedCerts"];
module.exports = {
    EXPORT_USE: 'export',
    IMPORT_USE: 'import',
    GOID_MAPPING_PLURAL_METHODS: GOID_PLURAL_METHODS,
    ENTITY_TYPE_PLURAL_TAG_FRIENDLY_NAME: {
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
            Object.keys(bundle).forEach(key => {
                bundle[key].sort(comparator);
            });
        }

        return bundle;
    },

    sanitize: function (bundle, use, excludeGoids) {
        use = use || this.EXPORT_USE;

        if (use === this.EXPORT_USE) {
            return exportSanitizer.sanitize(bundle, !excludeGoids);
        } else if (use === this.IMPORT_USE) {
            return importSanitizer.sanitize(bundle, !excludeGoids);
        } else {
            utils.warn("incorrect [use] specified for bundle sanitization: " + use);
        }
    },

    removeDuplicates: function (bundle) {
        Object.keys(bundle).forEach(key => {
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

    filter: function (bundle, filter) {
        if (!filter || !filter.by) return;
        if (!filter.equals && !filter.startsWith && !filter.endsWith && !filter.contains) return;

        Object.keys(bundle).forEach(key => {
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

        return !(idRef !== 'name' && left.name && left.name !== right.name);
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

let exportSanitizer = function () {
    return {
        sanitize: function (bundle, includeGoids) {
            const result = {};
            sanitizeBundle(bundle, result, includeGoids);
            return result;
        },
    };

    function sanitizeKey (key) {
        if (SCHEMA_METADATA.pluralMethods[key]) return key;

        const types = Object.values(SCHEMA_METADATA.types);

        for (var item of types) {
            if (item.prefix && key.startsWith(item.prefix)) {
                return item.pluralMethod;
            }
        }

        return null;
    }

    function sanitizeBundle(obj, result, includeGoids) {
        sanitizeBundleInternal(obj, result, includeGoids);
        Object.keys(obj).forEach(key => {
            if (result[key] && result[key].length === 0) {
                delete result[key];
            }
        });
    }

    function sanitizeBundleInternal(obj, result, includeGoids) {
        Object.keys(obj).forEach(key => {
            const sanitizedKey = sanitizeKey(key);
            const goidRequired = GOID_PLURAL_METHODS.includes(key);

            if (sanitizedKey) {
                if (!result[sanitizedKey]) result[sanitizedKey] = [];

                if (Array.isArray(obj[key])) {
                    if (obj[key].length) utils.info(`sanitizing ${key} to ${sanitizedKey}`);
                    obj[key].forEach(item => result[sanitizedKey].push(sanitizeEntity(item, result, goidRequired || includeGoids)));
                } else {
                    utils.info(`sanitizing ${key} to ${sanitizedKey}`);
                    result[sanitizedKey].push(sanitizeEntity(obj[key], result, goidRequired || includeGoids));
                }
            } else {
                utils.warn(`unrecognized key (${key}) with the bundle`);
            }
        });
    }

    function sanitizeEntity(obj, result, goidRequired) {
        if (obj.policy && obj.policy.allDependencies) {
            utils.info(`expanding ${obj.name} policy (all) dependencies`);
            sanitizeBundleInternal(obj.policy.allDependencies, result, goidRequired);
            delete obj.policy.allDependencies;
        }

        if (obj.policy && obj.policy.directDependencies) {
            utils.info(`expanding ${obj.name} policy (direct) dependencies`);
            sanitizeBundleInternal(obj.policy.directDependencies, result, goidRequired);
            delete obj.policy.directDependencies;
        }

        if (obj.filePartName) delete obj.filePartName;
        if (!goidRequired) delete obj.goid;

        return obj;
    }
}();

let importSanitizer = function () {
    return {
        sanitize: function (bundle, includeGoids) {
            Object.keys(bundle).forEach(key => {
                const goidRequired = GOID_PLURAL_METHODS.includes(key);
                utils.info("inspecting " + key);
                if (Array.isArray(bundle[key])) {
                    bundle[key].forEach(item => sanitizeEntity(item, key, goidRequired || includeGoids));
                    if (bundle[key].length === 0) {
                        delete bundle[key];
                    }
                } else {
                    sanitizeEntity(bundle[key], key, goidRequired || includeGoids);
                }
            });

            return bundle;
        }
    };

    function sanitizeEntity(entity, pluralMethod, goidRequired) {
        if (!goidRequired) delete entity.goid;

        if (pluralMethod === "webApiServices" || pluralMethod === "soapServices" || pluralMethod === "internalWebApiServices" || pluralMethod === "internalSoapServices") {
            if (entity.resolvers && !entity.resolutionPath) entity.resolutionPath = entity.resolvers.resolutionPath;
            if (entity.guid || entity.resolvers) {
                utils.info(`removing guid|resolvers field(s) from service ${entity.name}/${entity.resolutionPath}`);
                delete entity.guid;
                delete entity.resolvers;
            }
        } else if (pluralMethod === "internalGroups" || pluralMethod === "internalUsers") {
            if (entity.members || entity.enabled) {
                utils.info(`removing members|enabled field(s) from internalGroups|internalUsers ${entity.name}`);
                delete entity.members;
                delete entity.enabled;
            }

            if (entity.memberOf) {
                entity.memberOf.forEach(item => {
                    delete item.goid;
                    delete item.description;
                    delete item.checksum;
                });
            }
        } else if (pluralMethod === "serverModuleFiles") {
            if (entity.filePartName||entity.moduleStates||entity.moduleStateSummary) {
                utils.info(`removing filePartName|moduleStates|moduleStateSummary field(s) from server module file ${entity.name}`);
                delete entity.filePartName;
                delete entity.moduleStates;
                delete entity.moduleStateSummary;
            }
        } else if (pluralMethod === "emailListeners" || pluralMethod === "listenPorts" || pluralMethod === "activeConnectors") {
            if (entity.hardwiredService) {
                utils.info(`removing hardwiredService fields from ${entity.name}`);
                delete entity.hardwiredService;
            }
        } else if (pluralMethod === "trustedCerts") {
            if (entity.revocationCheckPolicy) {
                utils.info(`removing revocationCheckPolicy fields from ${entity.name}`);
                entity.revocationCheckPolicyName = entity.revocationCheckPolicy.name;
                delete entity.revocationCheckPolicy;
            }
        } else if (pluralMethod ==="passwordPolicies" || pluralMethod === "serviceResolutionConfigs") {
            if (entity.checksum) {
                utils.info(`removing checksum field`);
                delete entity.checksum;
            }
        }
    }
}();