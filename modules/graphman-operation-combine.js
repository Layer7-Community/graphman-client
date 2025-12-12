/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const metadata = require("./graphman").schemaMetadata();

module.exports = {
    /**
     * Combines two or more bundles into one.
     * @param params
     * @param params.inputs two or more input bundle file(s)
     * @param params.output output bundle
     */
    run: function (params) {
        if (!params.inputs) {
            throw "--inputs parameters are missing";
        }

        if (!Array.isArray(params.inputs) || params.inputs.length < 2) {
            throw "not enough input bundles, operation requires at least two bundles";
        }

        let bundle = {};
        for (const item of params.inputs) {
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
        console.log("combine --inputs <input-file> <input-file> ...");
        console.log("  [--output <output-file>]");
        console.log();
        console.log("Combines two or more bundles into one.");
        console.log("When similar entities are encountered, entities from the rightmost bundle takes the precedence.");
        console.log();
        console.log("  --inputs <input-file> <input-file> ...");
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

    // combine properties and mappings
    combineProperties(result, left, right);

    return result;
}

/**
 * Combines properties and mappings from left and right bundles.
 * Right bundle properties and mappings take precedence.
 * @param result result bundle
 * @param left left bundle
 * @param right right bundle
 */
function combineProperties(result, left, right) {
    const leftProperties = left.properties || {};
    const rightProperties = right.properties || {};

    // Initialize result properties with left bundle properties
    result.properties = Object.assign({}, leftProperties);

    // Right bundle defaultAction takes precedence
    if (rightProperties.defaultAction) {
        result.properties.defaultAction = rightProperties.defaultAction;
    }

    // Combine mappings using overrideMappings pattern
    // Start with left bundle mappings, then merge right bundle mappings
    combineMappings(result, leftProperties.mappings, rightProperties.mappings);
}

/**
 * Combines entity mappings from left and right bundles.
 * Preserves mapping information from each source bundle, allowing entity-level
 * control through different entity type mappings (level 2) in source bundles.
 * For duplicate entity mappings (same identity), right bundle mappings take precedence.
 * Reuses the structure and logic pattern from overrideMappings in graphman-bundle.js
 * 
 * This implementation addresses the requirement from PR #91 to keep mappings
 * from each single source bundle when combining bundles.
 * 
 * @param resultBundle result bundle (will be modified)
 * @param leftMappings left bundle mappings
 * @param rightMappings right bundle mappings
 */
function combineMappings(resultBundle, leftMappings, rightMappings) {
    leftMappings = leftMappings || {};
    rightMappings = rightMappings || {};

    // Initialize result bundle properties and mappings (following overrideMappings pattern)
    const properties = resultBundle.properties = resultBundle.properties || {};
    const mappings = properties.mappings = properties.mappings || {};

    // Copy all mappings from left bundle first
    Object.keys(leftMappings).forEach(key => {
        const leftEntityMappings = leftMappings[key];
        if (Array.isArray(leftEntityMappings) && leftEntityMappings.length > 0) {
            mappings[key] = leftEntityMappings.map(item => Object.assign({}, item));
        }
    });

    // Now merge right bundle mappings on top (right takes precedence)
    // Following overrideMappings pattern: iterate through right mappings
    Object.keys(rightMappings).forEach(key => {
        const rightEntityMappings = rightMappings[key];
        if (!Array.isArray(rightEntityMappings) || rightEntityMappings.length === 0) {
            return;
        }

        const typeInfo = metadata.bundleTypes[key];
        if (!typeInfo) {
            utils.warn(`unknown entity type for mappings: ${key}`);
            return;
        }

        // Ensure mappings array exists (following overrideMappings pattern)
        if (!mappings[key]) {
            mappings[key] = [];
        }

        // Merge right bundle mappings, avoiding duplicates (similar to overrideMappings logic)
        rightEntityMappings.forEach(rightItem => {
            const found = isDuplicateMatchingInstruction(mappings[key], rightItem, typeInfo);
            if (!found) {
                // Add new mapping from right
                mappings[key].push(Object.assign({}, rightItem));
            } else {
                // Right takes precedence: replace existing mapping with right bundle mapping
                const index = mappings[key].findIndex(item => {
                    const itemSource = item.source ? item.source : item;
                    const rightSource = rightItem.source ? rightItem.source : rightItem;
                    return typeInfo.identityFields.every(field => 
                        itemSource[field] === rightSource[field]
                    );
                });
                if (index !== -1) {
                    mappings[key][index] = Object.assign({}, rightItem);
                }
            }
        });
    });

    // Add mappings from right bundle that don't exist in left (following overrideMappings pattern)
    Object.keys(rightMappings).forEach(key => {
        const rightEntityMappings = rightMappings[key];
        if (!Array.isArray(rightEntityMappings) || rightEntityMappings.length === 0) {
            return;
        }

        if (!mappings[key]) {
            // New entity type from right bundle - add all mappings
            mappings[key] = rightEntityMappings.map(item => Object.assign({}, item));
        }
    });

    // Clean up empty mappings (following overrideMappings cleanup pattern)
    Object.keys(mappings).forEach(key => {
        if (mappings[key].length === 0) {
            delete mappings[key];
        }
    });

    if (Object.keys(mappings).length === 0) {
        delete properties.mappings;
    }
}

/**
 * Checks if a mapping instruction is a duplicate of an existing one.
 * Reuses logic from graphman-bundle.js isDuplicateMatchingInstruction
 * @param list existing list of mapping instructions
 * @param ele element to check
 * @param typeInfo type information for the entity
 * @returns true if duplicate, false otherwise
 */
function isDuplicateMatchingInstruction(list, ele, typeInfo) {
    if (!typeInfo || !typeInfo.identityFields) {
        return false;
    }

    for (const item of list) {
        let match = true;
        const eleSource = ele.source ? ele.source : ele;
        const itemSource = item.source ? item.source : item;

        for (const field of typeInfo.identityFields) {
            if (eleSource[field] !== itemSource[field]) {
                match = false;
                break;
            }
        }

        if (match) return true;
    }

    return false;
}
