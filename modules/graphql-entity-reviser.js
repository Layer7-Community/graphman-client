// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const revisers = [
    policiesReviser11100(),
    servicesReviser11100(),
    federatedIdpsReviser11100(),
    ldapIdpsReviser11100()
];

 module.exports = {
     /**
      * Revises the bundle entities
      * @param bundle input bundle to be revised
      * @param options
      * @returns {*}
      */
    revise: function (bundle, options) {
        for (const reviser of revisers) {
            reviser.revise(bundle, options);
        }
        return bundle;
    }
 }

 function policiesReviser11100() {
    return {
        revise: function (bundle, options) {
            reviseEntities(bundle, "policyFragments", "policies", revisePoliciesAs11100, {policyType: "FRAGMENT"});
            reviseEntities(bundle, "globalPolicies", "policies", revisePoliciesAs11100, {policyType: "GLOBAL"});
            reviseEntities(bundle, "backgroundTaskPolicies", "policies", revisePoliciesAs11100, {policyType: "POLICY_BACKED_BACKGROUND_TASK"});
            return bundle;
        }
    };
 }

function servicesReviser11100() {
    return {
        revise: function (bundle, options) {
            reviseEntities(bundle, "webApiServices", "services", reviseServicesAs11100, {serviceType: "WEB_API"});
            reviseEntities(bundle, "internalWebApiServices", "services", reviseServicesAs11100, {serviceType: "INTERNAL_WEB_API"});
            reviseEntities(bundle, "soapServices", "services", reviseServicesAs11100, {serviceType: "SOAP"});
            reviseEntities(bundle, "internalSoapServices", "services", reviseServicesAs11100, {serviceType: "INTERNAL_SOAP"});
            return bundle;
        }
    };
}

function federatedIdpsReviser11100() {
    return {
        revise: function (bundle, options) {
            reviseEntities(bundle, "fips", "federatedIdps", reviseFederatedIdpsAs11100);
            reviseEntities(bundle, "fipUsers", "federatedUsers");
            reviseEntities(bundle, "fipGroups", "federatedGroups");
            return bundle;
        }
    };
}

function ldapIdpsReviser11100() {
    return {
        revise: function (bundle, options) {
            reviseEntities(bundle, "ldaps", "ldapIdps", reviseLdapIdpsAs11100);
            return bundle;
        }
    };
}

 function revisePoliciesAs11100(entities, policies, options) {
     entities.forEach(item => {
         policies.push({
             goid: item.goid,
             guid: item.guid,
             name: item.name,
             policyType: options.policyType,
             tag: item.tag,
             subTag: item.subTag,
             checksum: item.checksum,
             folderPath: item.folderPath,
             soap: item.soap,
             policy: item.policy
         });
     });
 }

function reviseServicesAs11100(entities, services, options) {
    entities.forEach(item => {
        services.push({
            goid: item.goid,
            guid: item.guid,
            name: item.name,
            resolutionPath: item.resolutionPath,
            resolvers: item.resolvers,
            serviceType: options.serviceType,
            checksum: item.checksum,
            enabled: item.enabled,
            folderPath: item.folderPath,
            soapVersion: item.soapVersion,
            methodsAllowed: item.methodsAllowed,
            tracingEnabled: item.tracingEnabled,
            wssProcessingEnabled: item.wssProcessingEnabled,
            laxResolution: item.laxResolution,
            properties: item.properties,
            wsdlUrl: item.wsdlUrl,
            wsdl: item.wsdl,
            wsdlResources: item.wsdlResources,
            policy: item.policy
        });
    });
}

function reviseFederatedIdpsAs11100(entities, federatedIdps) {
     entities.forEach(item => {
         federatedIdps.push({
             goid: item.goid,
             name: item.name,
             checksum: item.checksum,
             supportsSAML: item.enableCredentialTypeSaml,
             supportsX509: item.enableCredentialTypeX509,
             certValidation: item.certificateValidation,
             trustedCerts: reviseTrustedCertRefs11100(item.certificateReferences||[])
         });
     });
}

function reviseTrustedCertRefs11100(entities) {
     return entities.map(item => {
         return {
            name: item.name,
            subjectDn: item.subjectDn,
            thumbprintSha1: item.thumbprintSha1
         };
     });
}

function reviseLdapIdpsAs11100(entities, ldapIdps) {
     entities.forEach(item => {
         ldapIdps.push({
             goid: item.goid,
             name: item.name,
             ldapType: "GenericLDAP",
             checksum: item.checksum,
             serverUrls: item.ldapUrls,
             useSslClientAuth: item.ldapsClientAuthEnabled,
             sslClientKeyAlias: item.ldapsClientKeystoreId && item.ldapsClientKeyAlias ? item.ldapsClientKeystoreId + ":" + item.ldapsClientKeyAlias : undefined,
             searchBase: item.searchBase,
             bindDn: item.bindDn,
             bindPassword: item.bindPassword,
             writable: item.writable,
             writeBase: item.writeBase,
             specifiedAttributes: item.specifiedAttributes,
             userMappings: item.userMappings,
             groupMappings: item.groupMappings,
             ntlmProperties: item.ntlmProperties,
             properties: item.properties
         });
     });
}

function reviseEntities(bundle, fromPluralName, toPluralName, reviser, options) {
    const fromEntities = bundle[fromPluralName] || [];
    const toEntities = bundle[toPluralName] || [];
    const requiresAssignment = toEntities.length === 0;

    if (fromEntities.length > 0) {
        utils.info(`revising ${fromPluralName} to ${toPluralName}`)
    }

    if (reviser) {
        reviser(fromEntities, toEntities, options);
    } else {
        fromEntities.forEach(item => toEntities.push(item));
    }

    delete bundle[fromPluralName];
    if (toEntities.length > 0 && requiresAssignment) {
        bundle[toPluralName] = toEntities;
    }
}
