
const tUtils = require("./utils");
const parser = tUtils.load("args-parser");

test("test simple arguments", () => {
    const params = parser.parse([
        "--using", "serviceByResolutionPath",
        "--gateway", "ssg-source",
        "--includePolicyRevisions", "false",
        "--revision", "111"
    ]);

    expect(params).toMatchObject({
        "using": "serviceByResolutionPath",
        "gateway": "ssg-source",
        "includePolicyRevisions": false,
        "revision": 111
    });
});

test("test complex arguments", () => {
    const params = parser.parse([
        "--using", "serviceByResolutionPath",
        "--gateway=ssg-source", // argument with implicit value
        "--includePolicyRevisions", // argument with no explicit value
        "--variables.resolutionPath", "/hello-world",
        "--variables.baseUris", "http://example.com", "http://example2.com", // arrays
        "--variables.revision", "123", // number
        "--using", "serviceByResolvers", //overwrite the argument
        "--variables.revision", "456", //overwrite the complex argument
        "--includeRoles" // last argument with no explicit value
    ]);

    expect(params).toMatchObject({
        "using": "serviceByResolvers",
        "gateway": "ssg-source",
        "includePolicyRevisions": true,
        "variables": {
            "resolutionPath": "/hello-world",
            "baseUris": ["http://example.com", "http://example2.com"],
            "revision": 456
        },
        "includeRoles": true
    });
});
