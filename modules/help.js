
const GRAPHMAN_OPERATION_MODULE_PREFIX = "./graphman-operation-";
const graphman = require("./graphman");

module.exports = {
    run: function (params, supportedOperations) {
        const config = graphman.configuration();
        console.log("graphman " + config.version + (` [schemaVersion=${config.schemaVersion}]`));
        console.log("usage:");
        if (params.operation && supportedOperations.includes(params.operation)) {
            require(GRAPHMAN_OPERATION_MODULE_PREFIX + params.operation).usage();
            return;
        } else {
            supportedOperations.forEach(item => {
                require(GRAPHMAN_OPERATION_MODULE_PREFIX + item).usage();
                console.log();
            });
            console.log("    help [--operation <operation>]");
        }

        console.log();
        console.log("    NOTE: Most of the following options are applicable to all the supported operations.");
        console.log("      --sourceGateway.*");
        console.log("        # use any of the following sub-option to override the source gateway value specified in the graphman configuration.");
        console.log("        # address - a valid graphman url. Default is https://localhost:8443/graphman");
        console.log("        # username - gateway user for administration.");
        console.log("        # password - gateway user's password for administration.");
        console.log("        # certFilename - user's certificate for authentication.");
        console.log("        # keyFilename - user's private key for authentication.");
        console.log("        # passphrase - encryption passphrase used to encode/decode the secrets in the bundles.");
        console.log("        # rejectUnauthorized - use this boolean flag whether to trust the gateway server certificate without verification.");
        console.log("      --targetGateway.*");
        console.log("        # similar to that of sourceGateway, use any of the above sub-options to override the target gateway value specified in the graphman configuration.");
        console.log("      --log <level>: to set the log level to one of ['warn', 'info', 'fine', 'debug', 'nolog']. Default is info.");
        console.log("      --schemaVersion <schema-version>: to specify the schema version to work with gateway's staged at different schemas.");
        console.log("        # supported schemas:");
        console.log("          v11.0-CR01 (default)");
        console.log("          v10.1-CR03");

        console.log();
        console.log("    NOTE: Often, entity types are referred in their plural form. Choose one from the below table for <entity-type-plural-tag>. And, the list goes as below:");
        const schemaMetadata = graphman.schemaMetadata();
        Object.keys(schemaMetadata.types).sort().forEach(key => {
            let value = schemaMetadata.types[key];
            if (value && value.pluralMethod) console.log(`        # ${key} - ${value.pluralMethod}`);
        });
    }
}
