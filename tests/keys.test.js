// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const cp = require('child_process');
const {graphman} = tUtils;

test("import keys - both p12 and pem format", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--input", "samples/keys.sample.json");
    expect(output.data.setKeys.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'CREATED',
            source: expect.arrayContaining([{name: 'alias', value: 'alice'}]),
            target: expect.arrayContaining([{name: 'goid', value: '00000000000000000000000000000002:alice'}])
        }),
        expect.objectContaining({
            status: 'CREATED',
            source: expect.arrayContaining([{name: 'alias', value: 'bob'}]),
            target: expect.arrayContaining([{name: 'goid', value: '00000000000000000000000000000002:bob'}])
        }),
        expect.objectContaining({
            status: 'CREATED',
            source: expect.arrayContaining([{name: 'alias', value: 'signer'}]),
            target: expect.arrayContaining([{name: 'goid', value: '00000000000000000000000000000002:signer'}])
        })
    ]));
});

test("export and explode keys - p12 format", () => {

});

test("implode and import keys - p12 format", () => {

});

test("export and explode keys - pem format", () => {

});

test("implode and import keys - pem format", () => {

});

test("delete keys", () => {
    const output = graphman("import",
        "--gateway", "target-gateway",
        "--using", "delete-bundle",
        "--input", "samples/keys.sample.json");
    expect(output.data.setKeys.detailedStatus).toEqual(expect.arrayContaining([
        expect.objectContaining({
            status: 'DELETED',
            source: expect.arrayContaining([{name: 'alias', value: 'alice'}]),
            target: expect.arrayContaining([{name: 'goid', value: '00000000000000000000000000000002:alice'}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            source: expect.arrayContaining([{name: 'alias', value: 'bob'}]),
            target: expect.arrayContaining([{name: 'goid', value: '00000000000000000000000000000002:bob'}])
        }),
        expect.objectContaining({
            status: 'DELETED',
            source: expect.arrayContaining([{name: 'alias', value: 'signer'}]),
            target: expect.arrayContaining([{name: 'goid', value: '00000000000000000000000000000002:signer'}])
        })
    ]));
});
/*
test("key explode intangible by openssl due to missing utf8 to binary encoding-DE600179", () => {
    // Export the private key 'ssl' into key.json.
    graphman("export",
        "--using", "keyByAlias",
        "--variables.alias", "ssl",
        "--output", tUtils.config().workspace + "/key.json");

    // Explode the key.json bundle.
    output = graphman("explode",
        "--input", tUtils.config().workspace + "/key.json",
        "--output", tUtils.config().workspace + "/key-exploded",
        "--options.level", "1");

    // Test if ssl.p12 exploded is openssl readable.
    cp.exec(`openssl pkcs12 -in ${tUtils.config().workspace}/key-exploded/keys/ssl.p12 -nodes -passin pass:7layer`, (err, output) => {
        expect(output).toBeTruthy();
        expect(err).toBeFalsy();
    });
});
*/
