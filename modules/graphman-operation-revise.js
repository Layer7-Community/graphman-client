
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");

module.exports = {
    run: function (params) {
        if (!params.input) {
            throw "--input parameter is missing";
        }

        let bundle = utils.readFile(params.input);

        if (params.normalize) {
            bundle = butils.sanitize(bundle, butils.IMPORT_USE, params.excludeGoids);
            butils.removeDuplicates(bundle);
        }

        this.revise(bundle);
        utils.writeResult(params.output, butils.sort(bundle));
    },

    revise: function (bundle) {
        const goidMappings = bundle.goidMappings || [];
        const guidMappings = bundle.guidMappings || [];
        delete bundle.goidMappings;
        delete bundle.guidMappings;

        Object.keys(bundle).forEach(key => {
            utils.info("inspecting " + key);
            if (goidMappings.length) reviseEntities(bundle[key], goidMappings);
            if (guidMappings.length) reviseEntities(bundle[key], guidMappings);
        });

        return bundle;
    },

    usage: function () {
        console.log("    revise --input <input-file> [--output <output-file>]");
        console.log("        # to revise the input bundle as per the GOID and/or GUID mappings");
        console.log("      --normalize");
        console.log("        # use this option to normalize/sanitize the bundle for import ready.");
        console.log("      --excludeGoids");
        console.log("        # use this option to exclude Goids from the bundled entities. This option is applicable only when normalize option is selected.");
    }
}

function reviseEntities(entities, mappings) {
    entities.forEach(entity => {
        if (entity.policy && entity.policy.xml) {
            reviseEntity(entity, mappings);
        }
    });
}

function reviseEntity(entity, mappings) {
    mappings.forEach(mapping => {
        entity.policy.xml = entity.policy.xml.replaceAll(mapping.source, function (match) {
            const name = butils.entityDisplayName(entity);
            utils.info(`  revising ${name}, replacing ${mapping.source} with ${mapping.target}`);
            return mapping.target;
        });
    });
}
