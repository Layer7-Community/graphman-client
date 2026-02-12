/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const tUtils = require("./utils");
const utils = tUtils.load("graphman-utils");
const graphman = tUtils.load("graphman");
const fs = require('fs');
const path = require('path');

// Initialize graphman for tests
const testHome = process.env.GRAPHMAN_HOME;
if (testHome) {
    graphman.init(testHome, {options: {}});
}

describe("Extension Context", () => {
    let mockExtensionDir;

    function clearCapturedContexts() {
        const contextFile = path.join(mockExtensionDir, `test-captured-contexts.json`);
        if (fs.existsSync(contextFile)) {
            fs.unlinkSync(contextFile);
        }
    }
    
    function getCapturedContext(extensionName) {
        const contextFile = path.join(mockExtensionDir, `test-captured-contexts.json`);
        if (fs.existsSync(contextFile)) {
            try {
                const contexts = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
                return contexts[extensionName];
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    function createMockExtension(extensionName) {
        const extFile = path.join(mockExtensionDir, `graphman-extension-${extensionName}.js`);
        const contextFile = path.join(mockExtensionDir, `test-captured-contexts.json`);
        const contextFileEscaped = contextFile.replace(/\\/g, '\\\\');
        const mockCode = `
const fs = require('fs');
const path = require('path');
const contextFile = '${contextFileEscaped}';

module.exports = {
    apply: function (input, context) {
        // Capture context for verification (extract only serializable properties)
        let contexts = {};
        if (fs.existsSync(contextFile)) {
            try {
                contexts = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
            } catch (e) {
                contexts = {};
            }
        }
        // Extract key properties from context
        const capturedContext = {
            operation: context.operation,
            options: context.options,
            gateway: context.gateway,
            config: context.config ? { version: context.config.version, schemaVersion: context.config.schemaVersion } : null
        };
        // Add any additional properties
        Object.keys(context).forEach(key => {
            if (!['operation', 'options', 'gateway', 'config'].includes(key)) {
                try {
                    capturedContext[key] = JSON.parse(JSON.stringify(context[key]));
                } catch (e) {
                    // Skip non-serializable properties
                }
            }
        });
        contexts['${extensionName}'] = capturedContext;
        fs.writeFileSync(contextFile, JSON.stringify(contexts, null, 2));
        return input;
    }
};
`;
        fs.writeFileSync(extFile, mockCode);
    }

    beforeEach(() => {
        // Create a temporary directory for mock extensions
        mockExtensionDir = path.join(testHome, "modules");
        
        // Clear any previous mock extensions and captured contexts
        ['pre-import', 'post-export', 'pre-renew', 'pre-request', 'policy-code-validator', 'multiline-text-diff'].forEach(extName => {
            const extFile = path.join(mockExtensionDir, `graphman-extension-${extName}.js`);
            if (fs.existsSync(extFile)) {
                fs.unlinkSync(extFile);
            }
        });
        clearCapturedContexts();
        
        // Clear extension cache by deleting from require.cache
        Object.keys(require.cache).forEach(key => {
            if (key.includes('graphman-extension-')) {
                delete require.cache[key];
            }
        });
    });

    afterEach(() => {
        // Clean up mock extensions
        ['pre-import', 'post-export', 'pre-renew', 'pre-request', 'policy-code-validator', 'multiline-text-diff'].forEach(extName => {
            const extFile = path.join(mockExtensionDir, `graphman-extension-${extName}.js`);
            if (fs.existsSync(extFile)) {
                fs.unlinkSync(extFile);
            }
        });
        clearCapturedContexts();
        
        // Clear extension cache
        Object.keys(require.cache).forEach(key => {
            if (key.includes('graphman-extension-')) {
                delete require.cache[key];
            }
        });
    });

    test("buildOperationContext creates context with operation name", () => {
        const context = utils.buildOperationContext("import", {}, null);
        
        expect(context).toHaveProperty("operation", "import");
        expect(context).toHaveProperty("options", {});
        expect(context).toHaveProperty("config");
    });

    test("buildOperationContext includes options in context", () => {
        const options = { excludeGoids: true, comment: "test" };
        const context = utils.buildOperationContext("export", options, null);
        
        expect(context.options).toEqual(options);
        expect(context.options.excludeGoids).toBe(true);
        expect(context.options.comment).toBe("test");
    });

    test("buildOperationContext includes gateway in context when provided", () => {
        const gateway = {
            name: "test-gateway",
            address: "https://test.example.com"
        };
        const context = utils.buildOperationContext("import", {}, gateway);
        
        expect(context.gateway).toEqual(gateway);
        expect(context.gateway.name).toBe("test-gateway");
    });

    test("buildOperationContext includes config in context", () => {
        const context = utils.buildOperationContext("renew", {}, null);
        
        expect(context.config).toBeDefined();
        expect(context.config).not.toBeNull();
    });

    test("buildOperationContext includes additional context properties", () => {
        const additionalContext = {
            typeInfo: { pluralName: "policies" },
            customProperty: "customValue"
        };
        const context = utils.buildOperationContext("diff", {}, null, additionalContext);
        
        expect(context.typeInfo).toEqual(additionalContext.typeInfo);
        expect(context.customProperty).toBe("customValue");
    });

    test("pre-import extension receives context with operation details", () => {
        // Create mock extension
        createMockExtension("pre-import");
        
        // Register and use extension
        utils.extensions("pre-import");
        const extension = utils.extension("pre-import");
        
        const testBundle = { policies: [] };
        const context = utils.buildOperationContext("import", { excludeGoids: true }, { name: "test-gateway" });
        
        extension.apply(testBundle, context);
        
        // Verify context was captured
        const capturedContext = getCapturedContext("pre-import");
        expect(capturedContext).toBeDefined();
        expect(capturedContext.operation).toBe("import");
        expect(capturedContext.options.excludeGoids).toBe(true);
        expect(capturedContext.gateway.name).toBe("test-gateway");
        expect(capturedContext.config).toBeDefined();
    });

    test("post-export extension receives context with operation details", () => {
        createMockExtension("post-export");
        utils.extensions("post-export");
        const extension = utils.extension("post-export");
        
        const testData = { services: [] };
        const context = utils.buildOperationContext("export", { includePolicyRevisions: true }, { name: "export-gateway" });
        
        extension.apply(testData, context);
        
        const capturedContext = getCapturedContext("post-export");
        expect(capturedContext).toBeDefined();
        expect(capturedContext.operation).toBe("export");
        expect(capturedContext.options.includePolicyRevisions).toBe(true);
        expect(capturedContext.gateway.name).toBe("export-gateway");
    });

    test("pre-renew extension receives context with operation details", () => {
        createMockExtension("pre-renew");
        utils.extensions("pre-renew");
        const extension = utils.extension("pre-renew");
        
        const testBundle = { policies: [] };
        const context = utils.buildOperationContext("renew", { useGoids: true }, { name: "renew-gateway" });
        
        extension.apply(testBundle, context);
        
        const capturedContext = getCapturedContext("pre-renew");
        expect(capturedContext).toBeDefined();
        expect(capturedContext.operation).toBe("renew");
        expect(capturedContext.options.useGoids).toBe(true);
        expect(capturedContext.gateway.name).toBe("renew-gateway");
    });

    test("pre-request extension receives context with operation details", () => {
        createMockExtension("pre-request");
        utils.extensions("pre-request");
        const extension = utils.extension("pre-request");
        
        const requestOptions = {
            host: "test.example.com",
            port: 443,
            path: "/graphman",
            protocol: "https:",
            body: {
                query: "mutation { installBundleEntities }"
            }
        };
        
        // Simulate what graphman.invoke does
        let operation = "request";
        if (requestOptions.body && requestOptions.body.query) {
            if (requestOptions.body.query.startsWith("mutation")) {
                operation = "import";
            } else if (requestOptions.body.query.startsWith("query")) {
                operation = "export";
            }
        }
        
        let gateway = null;
        if (requestOptions.host) {
            const protocol = requestOptions.protocol || 'https:';
            const port = requestOptions.port ? ':' + requestOptions.port : '';
            const path = requestOptions.path || '';
            gateway = {
                address: protocol + '//' + requestOptions.host + port + path,
                name: requestOptions.host
            };
        }
        
        const context = utils.buildOperationContext(operation, {}, gateway);
        extension.apply(requestOptions, context);
        
        const capturedContext = getCapturedContext("pre-request");
        expect(capturedContext).toBeDefined();
        expect(capturedContext.operation).toBe("import");
        expect(capturedContext.gateway).toBeDefined();
        expect(capturedContext.gateway.name).toBe("test.example.com");
    });

    test("pre-request extension detects export operation from query", () => {
        createMockExtension("pre-request");
        utils.extensions("pre-request");
        const extension = utils.extension("pre-request");
        
        const requestOptions = {
            host: "test.example.com",
            body: {
                query: "query { allServices { name } }"
            }
        };
        
        let operation = "request";
        if (requestOptions.body && requestOptions.body.query) {
            if (requestOptions.body.query.startsWith("mutation")) {
                operation = "import";
            } else if (requestOptions.body.query.startsWith("query")) {
                operation = "export";
            }
        }
        
        const context = utils.buildOperationContext(operation, {}, null);
        extension.apply(requestOptions, context);
        
        const capturedContext = getCapturedContext("pre-request");
        expect(capturedContext.operation).toBe("export");
    });

    test("policy-code-validator extension receives context with operation details", () => {
        createMockExtension("policy-code-validator");
        utils.extensions("policy-code-validator");
        const extension = utils.extension("policy-code-validator");
        
        const testSchema = { type: "object" };
        const context = utils.buildOperationContext("validate", {}, null);
        
        extension.apply(testSchema, context);
        
        const capturedContext = getCapturedContext("policy-code-validator");
        expect(capturedContext).toBeDefined();
        expect(capturedContext.operation).toBe("validate");
        expect(capturedContext.config).toBeDefined();
    });

    test("multiline-text-diff extension receives context with operation and typeInfo", () => {
        createMockExtension("multiline-text-diff");
        utils.extensions("multiline-text-diff");
        const extension = utils.extension("multiline-text-diff");
        
        const diffInput = {
            path: "$.policy.code",
            source: "source code",
            target: "target code"
        };
        
        const context = utils.buildOperationContext("diff", { includeInserts: true }, null, {
            typeInfo: { pluralName: "policies" }
        });
        
        extension.apply(diffInput, context);
        
        const capturedContext = getCapturedContext("multiline-text-diff");
        expect(capturedContext).toBeDefined();
        expect(capturedContext.operation).toBe("diff");
        expect(capturedContext.options.includeInserts).toBe(true);
        expect(capturedContext.typeInfo.pluralName).toBe("policies");
    });

    test("context includes all required properties for extension", () => {
        const options = { testOption: "testValue" };
        const gateway = { name: "test-gateway", address: "https://test.com" };
        const additionalContext = { customProp: "customValue" };
        
        const context = utils.buildOperationContext("import", options, gateway, additionalContext);
        
        // Verify all properties are present
        expect(context).toHaveProperty("operation");
        expect(context).toHaveProperty("options");
        expect(context).toHaveProperty("config");
        expect(context).toHaveProperty("gateway");
        expect(context).toHaveProperty("customProp");
        
        // Verify values
        expect(context.operation).toBe("import");
        expect(context.options).toEqual(options);
        expect(context.gateway).toEqual(gateway);
        expect(context.customProp).toBe("customValue");
        expect(context.config).toBeDefined();
    });

    test("context works with null gateway", () => {
        const context = utils.buildOperationContext("export", {}, null);
        
        expect(context.operation).toBe("export");
        expect(context.gateway).toBeUndefined();
        expect(context.config).toBeDefined();
    });

    test("context works with undefined additional context", () => {
        const context = utils.buildOperationContext("renew", {}, null);
        
        expect(context.operation).toBe("renew");
        expect(context.config).toBeDefined();
        // Should not have additional properties
        expect(context.typeInfo).toBeUndefined();
    });
});

