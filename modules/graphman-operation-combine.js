
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");

module.exports = {
    /**
     * Combines two or more bundles into one.
     * @param params
     * @param params.input two or more input bundle file(s)
     * @param params.output output bundle
     */
    run: function (params) {
        if (!params.input) {
            throw "--input parameters are missing";
        }

        if (!Array.isArray(params.input) || params.input.length < 2) {
            throw "not enough input bundles, operation requires at least two bundles";
        }

        let bundle = {};
        for (const item of params.input) {
            utils.info("processing " + item);
            bundle = combine(bundle, utils.readFile(item));
        }

        utils.writeResult(params.output, butils.sort(bundle));
    },

    initParams: function (params, config) {
        // do nothing
        return params;
    },

    usage: function () {
        console.log("combine --input <input-file> --input <input-file> [--input <input-file>,...]");
        console.log("  [--output <output-file>]");
        console.log();
        console.log("Combines two or more bundles into one.");
        console.log("When similar entities are encountered, entities from the rightmost bundle takes the precedence.");
        console.log();
        console.log("  --input <input-file>");
        console.log("    specify two or more input bundles file(s)");
        console.log();
        console.log("  --output <output-file>");
        console.log("    specify the file to capture the combined gateway configuration as bundle");
        console.log();

    }
}

/**
 * Combines left and right bundles into result bundle.
 * Right bundled entities take precedence.
 * @param left left bundle
 * @param right right bundle
 * @returns result bundle
 */
function combine(left, right) {
    const result = {};

    // copy entities from right
    butils.forEach(right, (key, entities, typeInfo) => {
        const list = butils.withArray(result, typeInfo);
        entities.forEach(item => list.push(item));
    });

    // copy non-duplicate entities from left
    butils.forEach(left, (key, entities, typeInfo) => {
        const list = butils.withArray(result, typeInfo);
        entities.forEach(item => {
            const found = list.find(x => butils.isEntityMatches(x, item, typeInfo));
            if (!found) {
                list.push(item);
            }
        });
    });

    return result;
}
