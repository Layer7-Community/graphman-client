/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const tUtils = require("./utils");
const {graphman} = tUtils;
const {metadata} = tUtils;

const standardBundleFile = "samples/standard-bundle.json";

test("import entities with bundleDefaultAction=IGNORE", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "install-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "IGNORE",
        "--force");

    metadata().typeInfos().forEach(typeInfo => {
        const op = output.data[metadata().mutationMethod(typeInfo.pluralName, "set")];
        if (op) {
            const detailedStatus = op.detailedStatus;
            detailedStatus.forEach(item => expect(item).toMatchObject(
                {action: 'IGNORE', status: 'IGNORED'}));
        } else {
            console.log("no samples for " + typeInfo.pluralName);
        }
    });
});

test("import entities with bundleDefaultAction=DELETE", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "delete-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "DELETE",
        "--force");

    metadata().typeInfos().forEach(typeInfo => {
        const op = output.data[metadata().mutationMethod(typeInfo.pluralName, "set")];
        if (op) {
            const detailedStatus = op.detailedStatus;
            console.log("inspecting " + typeInfo.pluralName);
            if (typeInfo.pluralName === 'fipGroups' || typeInfo.pluralName === 'fipUsers') {
                detailedStatus.forEach(item => expect(item).toMatchObject(
                    {action: 'DELETE', status: 'NONE', description: 'Did not find the entity\'s identity provider, ignoring the mutation'}));
            } else {
                detailedStatus.forEach(item => expect(item).toMatchObject(
                    {action: 'DELETE', status: 'NONE', description: 'Did not find the entity, ignoring the mutation'}));
            }
        } else {
            console.log("no samples for " + typeInfo.pluralName);
        }
    });
});

test("import entities with bundleDefaultAction=NEW_OR_EXISTING", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "install-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "NEW_OR_EXISTING",
        "--force");

    metadata().typeInfos().forEach(typeInfo => {
        const op = output.data[metadata().mutationMethod(typeInfo.pluralName, "set")];
        if (op) {
            const detailedStatus = op.detailedStatus;
            console.log("inspecting " + typeInfo.pluralName);
            detailedStatus.forEach(item => expect(item).toMatchObject(
                {action: 'NEW_OR_EXISTING', status: 'CREATED'}));
        } else {
            console.log("no samples for " + typeInfo.pluralName);
        }
    });
});

test("re-import entities with bundleDefaultAction=NEW_OR_EXISTING", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "install-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "NEW_OR_EXISTING",
        "--force");

    metadata().typeInfos().forEach(typeInfo => {
        const op = output.data[metadata().mutationMethod(typeInfo.pluralName, "set")];
        if (op) {
            const detailedStatus = op.detailedStatus;
            console.log("inspecting " + typeInfo.pluralName);
            detailedStatus.forEach(item => expect(item).toMatchObject(
                {action: 'NEW_OR_EXISTING', status: 'USED_EXISTING'}));
        } else {
            console.log("no samples for " + typeInfo.pluralName);
        }
    });
});

test("re-import entities with bundleDefaultAction=NEW_OR_UPDATE", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "install-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "NEW_OR_UPDATE",
        "--force");

    metadata().typeInfos().forEach(typeInfo => {
        const op = output.data[metadata().mutationMethod(typeInfo.pluralName, "set")];
        if (op) {
            const detailedStatus = op.detailedStatus;
            console.log("inspecting " + typeInfo.pluralName);
            if (typeInfo.pluralName === "serverModuleFiles") {
                detailedStatus.forEach(item => expect(item).toMatchObject(
                    {action: 'NEW_OR_UPDATE', status: 'NONE', description: 'Server module file entity exists and requires no further changes, ignoring the mutation'}));
            } else {
                detailedStatus.forEach(item => expect(item).toMatchObject(
                    {action: 'NEW_OR_UPDATE', status: 'UPDATED'}));
            }
        } else {
            console.log("no samples for " + typeInfo.pluralName);
        }
    });
});

test("re-import entities with bundleDefaultAction=DELETE", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "delete-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "DELETE",
        "--force");

    metadata().typeInfos().forEach(typeInfo => {
        const op = output.data[metadata().mutationMethod(typeInfo.pluralName, "set")];
        if (op) {
            const detailedStatus = op.detailedStatus;
            console.log("inspecting " + typeInfo.pluralName);
            detailedStatus.forEach(item => expect(item).toMatchObject(
                {action: 'DELETE', status: 'DELETED'}));
        } else {
            console.log("no samples for " + typeInfo.pluralName);
        }
    });
});

test("re-import entities with bundleDefaultAction=DELETE", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "delete-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "DELETE",
        "--force");

    metadata().typeInfos().forEach(typeInfo => {
        const op = output.data[metadata().mutationMethod(typeInfo.pluralName, "set")];
        if (op) {
            const detailedStatus = op.detailedStatus;
            console.log("inspecting " + typeInfo.pluralName);
            detailedStatus.forEach(item => expect(item).toMatchObject(
                {action: 'DELETE', status: 'NONE'}));
        } else {
            console.log("no samples for " + typeInfo.pluralName);
        }
    });
});

test("clean entities with bundleDefaultAction=DELETE", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "delete-bundle",
        "--input", standardBundleFile,
        "--options.bundleDefaultAction", "DELETE",
        "--force");

    metadata().typeInfos().forEach(typeInfo => {
        const op = output.data[metadata().mutationMethod(typeInfo.pluralName, "set")];
        if (op) {
            const detailedStatus = op.detailedStatus;
            detailedStatus.forEach(item => {
                const source = JSON.stringify(item.source, null, 2);
                if (item.status === 'DELETED') console.log(`Deleted ${typeInfo.pluralName} ${source}`);
                if (item.status === 'ERROR') console.log(`Error ${typeInfo.pluralName} ${item.description} ${source}`);
            });
        }
    });
});

