const util = require("./util");
const cp = require('child_process');
const {graphman} = util;

test("key explode intangible by openssl due to missing utf8 to binary encoding-DE600179", () => {

    // Cleanup if exists an exported key.json.
    const fs = require('fs');
    fs.existsSync('./key.json', function (exists) {
        if (exists) fs.unlinkSync('./key.json');
    });

    // Export the private key 'ssl' into key.json.
    var output = graphman("export",
        "--using", "keyByAlias",
        "--variables.alias", "ssl",
        "--output", "key.json");

    // Cleanup if exists an exploded key dir.
    fs.existsSync('key', function (exists) {
        if (exists) fs.rmSync(key, { recursive: true, force: true });
    });

    // Explode the key.json bundle.
    output = graphman("explode",
        "--input", "./key.json",
        "--output", "key",
        "--explodeKeys");

    // Test if ssl.p12 exploded is openssl readable.
    cp.exec('openssl pkcs12 -in key/keys/ssl.p12 -nodes -passin pass:7layer', (err, output) => {
        expect(output).toBeTruthy();
        expect(err).toBeFalsy();
    });
});

test("key explode-implode key.json bundle-DE600179", () => {

    // Cleanup if exists an exported key.json.
    const fs = require('fs');
    fs.existsSync('./key.json', function (exists) {
        if (exists) fs.unlinkSync('./key.json');
    });

    // Export the private key 'ssl' into key.json.
    var output = graphman("export",
        "--using", "keyByAlias",
        "--variables.alias", "ssl",
        "--output", "key.json");

    // Cleanup if exists an exploded key dir.
    fs.existsSync('key', function (exists) {
        if (exists) fs.rmSync(key, { recursive: true, force: true });
    });

    // Explode the key.json bundle.
    output = graphman("explode",
        "--input", "./key.json",
        "--output", "key",
        "--explodeKeys");

    // Cleanup if exists an imploded key-imploded.json
    fs.existsSync('./key.json', function (exists) {
        if (exists) fs.unlinkSync('./key.json');
    });

    // Implode the key dir.
    output = graphman("implode",
        "--input", "key",
        "--output", "key-imploded.json");

    // Import the json bundle - Should not fail
    output = graphman("import",
        "--input", "key-imploded.json",
        "--output", "import-log.json");
});