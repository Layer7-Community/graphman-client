const util = require("./util");
const {expectArray} = util;
const {graphman} = util;
const {metadata} = util;

const standardBundleFile = "samples/standard-bundle.json";
const standardBundle = util.readFileAsJson(standardBundleFile);

test("export entities with unknown query", () => {
    const output = graphman("export",
        "--using", "unknown-query");

    expect(output.stdout).toEqual(expect.stringContaining("unrecognized query unknown-query"));
});

test("export entities with unknown gateway profile", () => {
    const output = graphman("export",
        "--using", "summary",
        "--gateway", "unknown-gateway");

    expect(output.stdout).toEqual(expect.stringContaining("unknown-gateway gateway details are missing"));
});
