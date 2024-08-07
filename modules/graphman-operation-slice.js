/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const graphman = require("./graphman");

module.exports = {
    /**
     * Slices a bundle as per the choice.
     * @param params
     * @param params.input input bundle file
     * @param params.sections one or more sections of bundle
     * @param params.output output bundle
     */
    run: function (params) {
        if (!params.input) {
            throw "--input parameters are missing";
        }

        const bundle = utils.readFile(params.input);
        const result = {};

        if (Array.isArray(params.sections)) for (let section of params.sections) {
            if (section === "*") {
                Object.assign(result, bundle);
            } else if (section.startsWith("-")) {
                section = section.substring(1);

                const typeInfo = graphman.typeInfoByPluralName(section);
                if (typeInfo) {
                    utils.info("removing " + section);
                    delete result[section];
                } else {
                    utils.warn("unknown section " + section);
                }
            } else {
                if (section.startsWith("+")) {
                    section = section.substring(1);
                }

                const typeInfo = graphman.typeInfoByPluralName(section);
                if (typeInfo) {
                    utils.info("adding " + section);
                    if (bundle.hasOwnProperty(section)) {
                        result[section] = bundle[section];
                    }
                } else {
                    utils.warn("unknown section " + section);
                }
            }
        }

        utils.writeResult(params.output, butils.sort(result));
    },

    initParams: function (params, config) {
        if (params.sections && !Array.isArray(params.sections)) {
            params.sections = [params.sections];
        }

        return params;
    },

    usage: function () {
        console.log("slice --input <input-file> [--sections <section> <section>...]");
        console.log("  [--output <output-file>]");
        console.log();
        console.log("Slices the bundle as per the choice.");
        console.log("When similar entities are encountered, entities from the rightmost bundle takes the precedence.");
        console.log();
        console.log("  --input <input-file>");
        console.log("    specify two or more input bundles file(s)");
        console.log();
        console.log("  --sections <section> <section> ...");
        console.log("    specify one or more sections of the bundle for inclusion");
        console.log("    section refers to the plural name of the entity type");
        console.log("    * is a special section name, used to refer all the sections of a bundle");
        console.log("    use '-' prefix to exclude the section");
        console.log();
        console.log("  --output <output-file>");
        console.log("    specify the file to capture the combined gateway configuration as bundle");
        console.log();
    }
}
