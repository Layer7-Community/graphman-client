/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const tUtils = require("./utils");
const bUtils = tUtils.load("graphman-bundle");

test("sanitize bundle for import", () => {
    const bundle = tUtils.readFileAsJson("samples/bundle.import-sanitizer.sample.json");

    expect(bundle.fipGroups[0].members).toBeDefined();
    expect(bundle.federatedGroups[0].members).toBeDefined();
    expect(bundle.internalGroups[0].members).toBeDefined();
    expect(bundle.serverModuleFiles[0].filePartName).toBeDefined();
    expect(bundle.serverModuleFiles[0].moduleStates).toBeDefined();
    expect(bundle.serverModuleFiles[0].moduleStateSummary).toBeDefined();
    expect(bundle.trustedCerts[0].revocationCheckPolicy).toBeDefined();

    expect(bundle.activeConnectors[0].hardwiredService).toBeDefined();
    expect(bundle.emailListeners[0].hardwiredService).toBeDefined();
    expect(bundle.listenPorts[0].hardwiredService).toBeDefined();
    expect(bundle.fips[0].certificateReferences[0].revocationCheckPolicy).toBeDefined();

    bUtils.sanitize(bundle, bUtils.IMPORT_USE, {});

    expect(bundle.fipGroups[0].members).not.toBeDefined();
    expect(bundle.federatedGroups[0].members).not.toBeDefined();
    expect(bundle.internalGroups[0].members).not.toBeDefined();
    expect(bundle.serverModuleFiles[0].filePartName).not.toBeDefined();
    expect(bundle.serverModuleFiles[0].moduleStates).not.toBeDefined();
    expect(bundle.serverModuleFiles[0].moduleStateSummary).not.toBeDefined();
    expect(bundle.trustedCerts[0].revocationCheckPolicy).not.toBeDefined();

    expect(bundle.activeConnectors[0].hardwiredService).not.toBeDefined();
    expect(bundle.emailListeners[0].hardwiredService).not.toBeDefined();
    expect(bundle.listenPorts[0].hardwiredService).not.toBeDefined();
    expect(bundle.fips[0].certificateReferences[0].revocationCheckPolicy).not.toBeDefined();
});
