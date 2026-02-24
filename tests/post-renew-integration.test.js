/*
 * Copyright (c)  2026. Broadcom Inc. and its subsidiaries. All Rights Reserved.
 */

/**
 * Integration tests for post-renew extension functionality
 * These tests verify the end-to-end flow of the post-renew extension
 * within the renew operation.
 */

const tUtils = require("./utils");
const {graphman} = tUtils;
const workspace = tUtils.config().workspace;
const utils = tUtils.load("graphman-utils");
const fs = require('fs');
const path = require('path');

describe("Post-Renew Extension Integration Tests", () => {
    const extensionDir = path.join(workspace, "extensions");
    const modulesDir = path.join(workspace, "modules");

    function createPostRenewExtension(extensionCode, location = modulesDir) {
        if (!fs.existsSync(location)) {
            fs.mkdirSync(location, { recursive: true });
        }
        const extFile = path.join(location, "graphman-extension-post-renew.js");
        fs.writeFileSync(extFile, extensionCode);
        return extFile;
    }

    function cleanupExtension(location = modulesDir) {
        const extFile = path.join(location, "graphman-extension-post-renew.js");
        if (fs.existsSync(extFile)) {
            fs.unlinkSync(extFile);
        }
        // Clear from require cache
        Object.keys(require.cache).forEach(key => {
            if (key.includes('graphman-extension-post-renew')) {
                delete require.cache[key];
            }
        });
    }

    afterEach(() => {
        cleanupExtension(modulesDir);
        cleanupExtension(extensionDir);
    });

    test("post-renew extension is registered in supported extensions", () => {
        utils.extensions("post-renew");
        const extension = utils.extension("post-renew");
        
        expect(extension).toBeDefined();
        expect(typeof extension.apply).toBe("function");
    });

    test("default post-renew extension returns input unchanged", () => {
        // Load the actual post-renew extension from modules
        utils.extensions("post-renew");
        const extension = utils.extension("post-renew");

        const testBundle = {
            keys: [{ name: "key1", id: "id1" }],
            trustedCerts: [{ name: "cert1", id: "id2" }]
        };
        const context = utils.buildOperationContext("renew", null, {});

        const result = extension.apply(testBundle, context);

        // Default extension should return input unchanged
        expect(result).toEqual(testBundle);
        expect(result.keys).toHaveLength(1);
        expect(result.trustedCerts).toHaveLength(1);
    });

    test("post-renew extension receives correct context structure", () => {
        const extensionCode = `
const fs = require('fs');
const path = require('path');

module.exports = {
    apply: function (input, context) {
        // Validate context structure
        if (!context) {
            throw new Error("Context is missing");
        }
        if (!context.operation) {
            throw new Error("Context.operation is missing");
        }
        if (context.options === undefined) {
            throw new Error("Context.options is missing");
        }
        
        // Mark bundle as validated
        input.contextValidated = true;
        input.receivedOperation = context.operation;
        input.hasGateway = context.gateway !== undefined;
        input.hasOptions = context.options !== undefined;
        
        return input;
    }
};`;
        
        const extFile = createPostRenewExtension(extensionCode);
        const extension = require(extFile);
        const testBundle = { keys: [] };
        const gateway = { name: "test-gw", address: "https://test.com" };
        const options = { useGoids: true };
        const context = utils.buildOperationContext("renew", gateway, options);
        
        const result = extension.apply(testBundle, context);
        
        expect(result.contextValidated).toBe(true);
        expect(result.receivedOperation).toBe("renew");
        expect(result.hasGateway).toBe(true);
        expect(result.hasOptions).toBe(true);
    });

    test("post-renew extension can filter renewed entities", () => {
        const extensionCode = `
module.exports = {
    apply: function (input, context) {
        // Filter out test entities
        if (input.keys) {
            input.keys = input.keys.filter(key => !key.name.includes("test"));
        }
        
        if (input.trustedCerts) {
            input.trustedCerts = input.trustedCerts.filter(cert => !cert.name.includes("test"));
        }
        
        return input;
    }
};`;

        const extFile = createPostRenewExtension(extensionCode);
        const extension = require(extFile);
        const bundle1Path = path.join("samples", "renew-bundle.json");
        graphman("renew", "--inputs", bundle1Path, "--gateway", "default");

        expect(result.keys.some(k => k.name === "test-key")).toBe(false);
        expect(result.keys.some(k => k.name === "production-key")).toBe(true);
        expect(result.keys.some(k => k.name === "staging-key")).toBe(true);

        expect(result.trustedCerts.some(c => c.name === "test-cert")).toBe(false);
        expect(result.trustedCerts.some(c => c.name === "prod-cert")).toBe(true);
    });

});
