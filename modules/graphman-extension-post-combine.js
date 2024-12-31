/*
 * Copyright ©  2024. HCLtech and/or its subsidiaries. All Rights Reserved.
 */
const utils = require("./graphman-utils");

module.exports = {
    /**
     * Extension to handle mappings in inputs files when "combine"ing them
     * intended for accurate properties.mappings
     * @param bundle      : the ootb combine result bundle
     * @param inputs      : the list of input files
     * @param cli_options : the command line options
     */
    apply: function (bundle, inputs , cli_options) {
        // act from right to left, to assure precedence
        inputs.slice().reverse().forEach( filename => {
            data=utils.readFile(filename);
            if( data.properties ) {
                if( !bundle.properties) bundle.properties={};
                // handle defaultAction
                if( data.properties.defaultAction && !bundle.properties.defaultAction ) bundle.properties.defaultAction=data.properties.defaultAction;
                // handle entity specifc mappings
                if( data.properties.mappings ) {
                    if( !bundle.properties.mappings ) {
                        utils.info(`Assign complete mappings from file ${filename} to bundle mappings`);
                        bundle.properties.mappings = Object.assign({}, data.properties.mappings);
                    }
                    else {
                        Object.keys(data.properties.mappings).forEach( entityType => {
                            attrName=Object.keys(data.properties.mappings[entityType][0])[1];
                            data.properties.mappings[entityType].forEach(entity => {
                                if(bundle.properties.mappings[entityType]) {
                                    //check entity does not exists already
                                    if(!(found=bundle.properties.mappings[entityType].find( elem => (elem[attrName]==entity[attrName])))) {
                                        utils.info(`add not existing ${entityType} for ${attrName} = "${entity[attrName]}" as ${entity.action}`);
                                        bundle.properties.mappings[entityType].push(entity);
                                    }
                                    else {
                                        utils.warn(`skip existing ${entityType} from ${filename} for ${attrName} = "${entity[attrName]}" with action = ${entity.action} -- existing action ${found.action}`);
                                    }
                                }
                                else {
                                    utils.info(`Assign complete mappings[${entityType}] to bundle mappings`);
                                    bundle.properties.mappings[entityType]=data.properties.mappings[entityType];
                                }
                            });
                        });
                    }
                }
            }
        });

        return bundle;
    }
}
