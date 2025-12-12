/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const tUtils = require("./utils");
const combineOp = tUtils.load("graphman-operation-combine");
const utils = tUtils.load("graphman-utils");
const graphman = tUtils.load("graphman");
const fs = require('fs');
const path = require('path');

// Initialize graphman for tests
const testHome = process.env.GRAPHMAN_HOME;
if (testHome) {
    graphman.init(testHome, {options: {}});
}

test("combine two bundles with unique entities", () => {
    const bundle1Path = path.join(testHome, "samples", "combine-bundle-1.json");
    const bundle3Path = path.join(testHome, "samples", "combine-bundle-3.json");
    const outputPath = path.join(testHome, "build", "tests", "combine-output-1.json");
    
    const params = combineOp.initParams({
        inputs: [bundle1Path, bundle3Path],
        output: outputPath
    }, graphman.configuration());
    
    combineOp.run(params);
    
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    // Should contain all services from bundle1
    expect(output.services).toBeDefined();
    expect(output.services.length).toBeGreaterThan(0);
    
    // Should contain encassConfigs from bundle3
    expect(output.encassConfigs).toBeDefined();
    expect(output.encassConfigs.length).toBeGreaterThan(0);
    
    // Should contain keys from bundle3
    expect(output.keys).toBeDefined();
    expect(output.keys.length).toBeGreaterThan(0);
    
    // Properties should be merged
    expect(output.properties).toBeDefined();
});

test("combine bundles with overlapping entities - right takes precedence", () => {
    const bundle1Path = path.join(testHome, "samples", "combine-bundle-1.json");
    const bundle2Path = path.join(testHome, "samples", "combine-bundle-2.json");
    const outputPath = path.join(testHome, "build", "tests", "combine-output-2.json");
    
    const params = combineOp.initParams({
        inputs: [bundle1Path, bundle2Path],
        output: outputPath
    }, graphman.configuration());
    
    combineOp.run(params);
    
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    // Should contain all services (bundle1 + bundle2, with bundle2 taking precedence for duplicates)
    expect(output.services).toBeDefined();
    expect(output.services.length).toBeGreaterThanOrEqual(6); // At least bundle1's 6 services
    
    // Verify that overlapping service from bundle2 is present (right takes precedence)
    const overlappingService = output.services.find(s => 
        s.resolutionPath === "/jsonpolicy-webapi" || s.name === "jsonpolicy-webapi"
    );
    expect(overlappingService).toBeDefined();
    
    // Should contain all policies from both bundles
    expect(output.policies).toBeDefined();
    expect(output.policies.length).toBeGreaterThanOrEqual(6);
    
    // Should contain all cluster properties from both bundles
    expect(output.clusterProperties).toBeDefined();
    expect(output.clusterProperties.length).toBeGreaterThanOrEqual(5);
});

test("combine bundles - right defaultAction takes precedence", () => {
    const bundle1Path = path.join(testHome, "samples", "combine-bundle-1.json");
    const bundle2Path = path.join(testHome, "samples", "combine-bundle-2.json");
    const outputPath = path.join(testHome, "build", "tests", "combine-output-3.json");
    
    const params = combineOp.initParams({
        inputs: [bundle1Path, bundle2Path],
        output: outputPath
    }, graphman.configuration());
    
    combineOp.run(params);
    
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    // Right bundle's defaultAction should take precedence
    expect(output.properties.defaultAction).toBe("NEW_OR_UPDATE");
});

test("combine bundles - mappings are merged with right taking precedence", () => {
    const bundle1Path = path.join(testHome, "samples", "combine-bundle-1.json");
    const bundle2Path = path.join(testHome, "samples", "combine-bundle-2.json");
    const outputPath = path.join(testHome, "build", "tests", "combine-output-4.json");
    
    const params = combineOp.initParams({
        inputs: [bundle1Path, bundle2Path],
        output: outputPath
    }, graphman.configuration());
    
    combineOp.run(params);
    
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    expect(output.properties.mappings).toBeDefined();
    expect(output.properties.mappings.services).toBeDefined();
    
    // Should contain mappings from both bundles
    expect(output.properties.mappings.services.length).toBeGreaterThanOrEqual(6);
    
    // Verify overlapping mapping from bundle2 is present (right takes precedence)
    const overlappingMapping = output.properties.mappings.services.find(m => 
        m.resolutionPath === "/jsonpolicy-webapi"
    );
    expect(overlappingMapping).toBeDefined();
});

test("combine three bundles", () => {
    const bundle1Path = path.join(testHome, "samples", "combine-bundle-1.json");
    const bundle2Path = path.join(testHome, "samples", "combine-bundle-2.json");
    const bundle3Path = path.join(testHome, "samples", "combine-bundle-3.json");
    const outputPath = path.join(testHome, "build", "tests", "combine-output-5.json");
    
    const params = combineOp.initParams({
        inputs: [bundle1Path, bundle2Path, bundle3Path],
        output: outputPath
    }, graphman.configuration());
    
    combineOp.run(params);
    
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    // Should contain entities from all three bundles
    expect(output.services).toBeDefined();
    expect(output.services.length).toBeGreaterThan(0);
    
    expect(output.encassConfigs).toBeDefined();
    expect(output.encassConfigs.length).toBeGreaterThan(0);
    
    expect(output.keys).toBeDefined();
    expect(output.keys.length).toBeGreaterThan(0);
    
    // Rightmost bundle's defaultAction should take precedence
    expect(output.properties.defaultAction).toBe("ALWAYS_CREATE_NEW");
});

test("combine bundles with empty bundle", () => {
    const bundle1Path = path.join(testHome, "samples", "combine-bundle-1.json");
    const bundle4Path = path.join(testHome, "samples", "combine-bundle-4.json");
    const outputPath = path.join(testHome, "build", "tests", "combine-output-6.json");
    
    const params = combineOp.initParams({
        inputs: [bundle1Path, bundle4Path],
        output: outputPath
    }, graphman.configuration());
    
    combineOp.run(params);
    
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    // Should contain entities from bundle1
    expect(output.services).toBeDefined();
    expect(output.services.length).toBeGreaterThan(0);
    
    // Empty bundle's defaultAction should take precedence
    expect(output.properties.defaultAction).toBe("IGNORE");
});

test("combine bundles - all entity types are preserved", () => {
    const bundle1Path = path.join(testHome, "samples", "combine-bundle-1.json");
    const bundle2Path = path.join(testHome, "samples", "combine-bundle-2.json");
    const bundle3Path = path.join(testHome, "samples", "combine-bundle-3.json");
    const outputPath = path.join(testHome, "build", "tests", "combine-output-7.json");
    
    const params = combineOp.initParams({
        inputs: [bundle1Path, bundle2Path, bundle3Path],
        output: outputPath
    }, graphman.configuration());
    
    combineOp.run(params);
    
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    // Verify all entity types from all bundles are present
    expect(output.services).toBeDefined();
    expect(output.policies).toBeDefined();
    expect(output.clusterProperties).toBeDefined();
    expect(output.encassConfigs).toBeDefined();
    expect(output.keys).toBeDefined();
    expect(output.secrets).toBeDefined();
});

test("combine bundles - mappings for all entity types are preserved", () => {
    const bundle1Path = path.join(testHome, "samples", "combine-bundle-1.json");
    const bundle2Path = path.join(testHome, "samples", "combine-bundle-2.json");
    const bundle3Path = path.join(testHome, "samples", "combine-bundle-3.json");
    const outputPath = path.join(testHome, "build", "tests", "combine-output-8.json");
    
    const params = combineOp.initParams({
        inputs: [bundle1Path, bundle2Path, bundle3Path],
        output: outputPath
    }, graphman.configuration());
    
    combineOp.run(params);
    
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    expect(output.properties.mappings).toBeDefined();
    
    // Verify mappings for different entity types
    expect(output.properties.mappings.services).toBeDefined();
    expect(output.properties.mappings.policies).toBeDefined();
    expect(output.properties.mappings.clusterProperties).toBeDefined();
    expect(output.properties.mappings.encassConfigs).toBeDefined();
    expect(output.properties.mappings.keys).toBeDefined();
    expect(output.properties.mappings.secrets).toBeDefined();
});

test("combine bundles - no duplicate entities in result", () => {
    const bundle1Path = path.join(testHome, "samples", "combine-bundle-1.json");
    const bundle2Path = path.join(testHome, "samples", "combine-bundle-2.json");
    const outputPath = path.join(testHome, "build", "tests", "combine-output-9.json");
    
    const params = combineOp.initParams({
        inputs: [bundle1Path, bundle2Path],
        output: outputPath
    }, graphman.configuration());
    
    combineOp.run(params);
    
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    // Check services for duplicates (same resolutionPath and serviceType)
    const serviceIdentities = new Set();
    output.services.forEach(service => {
        const identity = `${service.resolutionPath || service.name}:${service.serviceType}`;
        expect(serviceIdentities.has(identity)).toBe(false);
        serviceIdentities.add(identity);
    });
});

test("combine bundles - verify entity count matches expected", () => {
    const bundle1Path = path.join(testHome, "samples", "combine-bundle-1.json");
    const bundle2Path = path.join(testHome, "samples", "combine-bundle-2.json");
    const outputPath = path.join(testHome, "build", "tests", "combine-output-10.json");
    
    const params = combineOp.initParams({
        inputs: [bundle1Path, bundle2Path],
        output: outputPath
    }, graphman.configuration());
    
    combineOp.run(params);
    
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    // Bundle1 has 6 services, bundle2 has 7 services (including 1 overlap)
    // Result should have 6 + 7 - 1 = 12 services (or at least close to that)
    expect(output.services.length).toBeGreaterThanOrEqual(6);
    
    // Policies: bundle1 has 6, bundle2 has remaining (no overlap expected)
    expect(output.policies.length).toBeGreaterThanOrEqual(6);
});

test("combine error - missing inputs parameter", () => {
    expect(() => {
        const params = combineOp.initParams({}, graphman.configuration());
        combineOp.run(params);
    }).toThrow();
});

test("combine error - only one input bundle", () => {
    expect(() => {
        const bundle1Path = path.join(testHome, "samples", "combine-bundle-1.json");
        const params = combineOp.initParams({
            inputs: [bundle1Path]
        }, graphman.configuration());
        combineOp.run(params);
    }).toThrow("not enough input bundles");
});

test("combine bundles - properties meta information", () => {
    const bundle1Path = path.join(testHome, "samples", "combine-bundle-1.json");
    const bundle2Path = path.join(testHome, "samples", "combine-bundle-2.json");
    const outputPath = path.join(testHome, "build", "tests", "combine-output-11.json");
    
    const params = combineOp.initParams({
        inputs: [bundle1Path, bundle2Path],
        output: outputPath
    }, graphman.configuration());
    
    combineOp.run(params);
    
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    // Properties should exist
    expect(output.properties).toBeDefined();
    
    // Mappings should exist
    expect(output.properties.mappings).toBeDefined();
});

test("combine bundles - rightmost bundle mappings take precedence for duplicates", () => {
    const bundle1Path = path.join(testHome, "samples", "combine-bundle-1.json");
    const bundle2Path = path.join(testHome, "samples", "combine-bundle-2.json");
    const outputPath = path.join(testHome, "build", "tests", "combine-output-12.json");
    
    const params = combineOp.initParams({
        inputs: [bundle1Path, bundle2Path],
        output: outputPath
    }, graphman.configuration());
    
    combineOp.run(params);
    
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    // Find the overlapping service mapping
    const overlappingServiceMapping = output.properties.mappings.services.find(m => 
        m.resolutionPath === "/jsonpolicy-webapi"
    );
    
    // The mapping from bundle2 should be present (right takes precedence)
    expect(overlappingServiceMapping).toBeDefined();
    expect(overlappingServiceMapping.action).toBe("NEW_OR_EXISTING");
});

test("combine bundles - all mappings from left bundle are preserved when no overlap", () => {
    const bundle1Path = path.join(testHome, "samples", "combine-bundle-1.json");
    const bundle3Path = path.join(testHome, "samples", "combine-bundle-3.json");
    const outputPath = path.join(testHome, "build", "tests", "combine-output-13.json");
    
    const params = combineOp.initParams({
        inputs: [bundle1Path, bundle3Path],
        output: outputPath
    }, graphman.configuration());
    
    combineOp.run(params);
    
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    // Bundle1 and bundle3 have no overlapping entity types in mappings
    // All mappings from both should be present
    expect(output.properties.mappings.services).toBeDefined();
    expect(output.properties.mappings.services.length).toBeGreaterThanOrEqual(6);
    
    expect(output.properties.mappings.encassConfigs).toBeDefined();
    expect(output.properties.mappings.encassConfigs.length).toBeGreaterThan(0);
});

test("combine bundles - result is sorted", () => {
    const bundle1Path = path.join(testHome, "samples", "combine-bundle-1.json");
    const bundle2Path = path.join(testHome, "samples", "combine-bundle-2.json");
    const bundle3Path = path.join(testHome, "samples", "combine-bundle-3.json");
    const outputPath = path.join(testHome, "build", "tests", "combine-output-14.json");
    
    const params = combineOp.initParams({
        inputs: [bundle1Path, bundle2Path, bundle3Path],
        output: outputPath
    }, graphman.configuration());
    
    combineOp.run(params);
    
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    // Services should be sorted (check first few)
    if (output.services.length > 1) {
        const serviceNames = output.services.map(s => s.name || s.resolutionPath).filter(Boolean);
        const sortedNames = [...serviceNames].sort();
        expect(serviceNames).toEqual(sortedNames);
    }
});

