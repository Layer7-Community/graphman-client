/*
 * Copyright (c)  2026. Broadcom Inc. and its subsidiaries. All Rights Reserved.
 */

/**
 * Integration tests for pre-renew extension functionality
 * These tests verify the end-to-end flow of the pre-renew extension
 * within the renew operation.
 */

const tUtils = require("./utils");
const workspace = tUtils.config().workspace;
const utils = tUtils.load("graphman-utils");
const fs = require('fs');
const path = require('path');

describe("Pre-Renew Extension Integration Tests", () => {
    const extensionDir = path.join(workspace, "extensions");
    const modulesDir = path.join(workspace, "modules");

    function createPreRenewExtension(extensionCode, location = modulesDir) {
        if (!fs.existsSync(location)) {
            fs.mkdirSync(location, { recursive: true });
        }
        const extFile = path.join(location, "graphman-extension-pre-renew.js");
        fs.writeFileSync(extFile, extensionCode);
        return extFile;
    }

    function cleanupExtension(location = modulesDir) {
        const extFile = path.join(location, "graphman-extension-pre-renew.js");
        if (fs.existsSync(extFile)) {
            fs.unlinkSync(extFile);
        }
        // Clear from cache
        Object.keys(require.cache).forEach(key => {
            if (key.includes('graphman-extension-pre-renew')) {
                delete require.cache[key];
            }
        });
    }

    afterEach(() => {
        cleanupExtension(modulesDir);
        cleanupExtension(extensionDir);
    });

    test("pre-renew extension is registered in supported extensions", () => {
        utils.extensions("pre-renew");
        const extension = utils.extension("pre-renew");
        
        expect(extension).toBeDefined();
        expect(typeof extension.apply).toBe("function");
    });

    test("default pre-renew extension returns input unchanged", () => {
        // Load the actual pre-renew extension from modules
        utils.extensions("pre-renew");
        const extension = utils.extension("pre-renew");

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

    test("pre-renew extension receives correct context structure", () => {
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
        
        const extFile = createPreRenewExtension(extensionCode);
        
        // Clear require cache to force reload
        delete require.cache[require.resolve(extFile)];
        
        // Reload the extension
        utils.extensions("pre-renew");
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
});
