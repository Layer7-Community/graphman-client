
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");

module.exports = {
    run: function (params) {
        if (!params.input) {
            throw "Missing --input parameter";
        }

        const inputDir = params.input;
        let bundle;
        if (params.type === "type2") {
            bundle = type2Imploder.implode(inputDir);
        } else {
            if (params.type && params.type !== "type1") utils.info("unrecognised exploded format " + params.type + ", fall backing to default format");
            bundle = type1Imploder.implode(inputDir);
        }

        utils.writeResult(params.output, butils.sort(bundle));
    },

    usage: function () {
        console.log("    implode --input <input-directory> [--output <output-file>] [<options>]");
        console.log("      --type <exploded-format>");
        console.log("        # <exploded-format> can be either type1 or type2. Default option is type1.");
    }
}

let type1Imploder = (function () {
    return {
        implode: function (inputDir) {
            const bundle = {};

            const updatesDir = utils.path(inputDir, 'updates');
            if (utils.existsFile(updatesDir)) {
                loopdir(updatesDir,bundle,"updates");
            }

            const insertsDir = utils.path(inputDir, 'inserts');
            if (utils.existsFile(insertsDir)) {
                loopdir(insertsDir,bundle,"inserts");
            }

            const deletesDir = utils.path(inputDir, 'deletes');
            if (utils.existsFile(deletesDir)) {
                loopdir(deletesDir,bundle,"deletes");
            }
            
            utils.listDir(inputDir).forEach(item => {
                let subDir = inputDir + "/" + item;
                if (utils.isDirectory(subDir)) {
                    utils.info("imploding " + item);
                    readEntities(subDir, item, bundle);
                }
            });

            const propertiesFile = utils.path(inputDir, 'bundle-properties.json');
            if (utils.existsFile(propertiesFile)) {
                bundle['properties'] = utils.readFile(propertiesFile);
            }

            return bundle;
        }
    };

    function loopdir (inputDir,bundle,property) {
        utils.listDir(inputDir).forEach(item => {
            let subDir = inputDir + "/" + item;
            if (utils.isDirectory(subDir)) {
                utils.info("imploding " + item);
                if(!bundle[property]) bundle[property] = {};
                readEntities(subDir, item, bundle[property]);
            }
        });
    }
    
    function readEntities(typeDir, type, bundle) {
        if (type === 'tree') {
            readFolderableEntities(typeDir, bundle);
        } else {
            if (!bundle[type]) bundle[type] = [];
            utils.listDir(typeDir).forEach(item => {
                if (item.endsWith(".json")) {
                    utils.info(`  ${item}`);
                    let entity = utils.readFile(`${typeDir}/${item}`);
                    if (type === "keys") {
                        if (entity.p12 && entity.p12.endsWith(".p12}")) {
                            const filename = entity.p12.match(/{(.+)}/)[1];
                            // entity.p12 = btoa(utils.readFile(`${typeDir}/${filename}`));
                            entity.p12 = Buffer.from(utils.readFileBinary(`${typeDir}/${filename}`)).toString('base64');
                        }

                        if (entity.pem && entity.pem.endsWith(".pem}")) {
                            const filename = entity.pem.match(/{(.+)}/)[1];
                            entity.pem = utils.readFile(`${typeDir}/${filename}`);
                        }

                        const certChain = entity.certChain;
                        if (certChain && typeof certChain === 'string' && certChain.endsWith(".certchain.pem}")) {
                            const filename = certChain.match(/{(.+)}/)[1];
                            const lines = utils.readFile(`${typeDir}/${filename}`).split(/\r?\n/);
                            let data = "";

                            entity.certChain = [];
                            for (var line of lines) {
                                data += line + "\r\n";
                                if (line.indexOf("-END CERTIFICATE-") !== -1) {
                                    entity.certChain.push(data);
                                    data = "";
                                }
                            }
                        }
                    }

                    if (type === "trustedCerts") {
                        if (entity.certBase64 && entity.certBase64.endsWith(".cert}")) {
                            const filename = entity.certBase64.match(/{(.+)}/)[1];
                            entity.certBase64 = btoa(utils.readFile(`${typeDir}/${filename}`));
                        }
                    }

                    bundle[type].push(entity);
                }
            });
        }
    }

    function readFolderableEntities(dir, bundle) {
        utils.listDir(dir).forEach(item => {
            if (utils.isDirectory(dir + "/" + item)) {
                readFolderableEntities(`${dir}/${item}`, bundle);
            } else {
                readFolderableEntity(dir, item, bundle);
            }
        });
    }

    function readFolderableEntity(dir, filename, bundle) {
        Object.entries(butils.ENTITY_TYPE_PLURAL_TAG_FRIENDLY_NAME).forEach(([key, value]) => {
            if (filename.endsWith(`.${value}.json`)) {
                if (!bundle[key]) bundle[key] = [];
                let entity = utils.readFile(`${dir}/${filename}`);
                if (entity.policy) {
                    const xml = entity.policy.xml;
                    if (xml && xml.endsWith(".xml}")) {
                        const filename = xml.match(/{(.+)}/)[1];
                        entity.policy.xml = encodeBase64(utils.readFile(`${dir}/${filename}`));
                    }

                    const yaml = entity.policy.yaml;
                    if (yaml && yaml.endsWith(".yaml}")) {
                        const filename = yaml.match(/{(.+)}/)[1];
                        entity.policy.yaml = utils.readFile(`${dir}/${filename}`);
                    }
                }
                bundle[key].push(entity);
            }
        });
    }

    function encodeBase64(decodedXml) {
            // handle Base64 encoded code, loop through all tags starting with Base64
            tagStart=-1;
            tagStart=decodedXml.indexOf('<L7p:DecodedBase64', 0);
            while (tagStart != -1) {
                // b64start:  index of start og decoded b64 text
                // 13: length of text : stringValue="
                b64start=decodedXml.indexOf('stringValue=\"', tagStart)+13;
                

                // b64end : index of end of decoded b64 text
                b64end=decodedXml.indexOf('\"/>',b64start);
                
                decodedStr=decodedXml.substring(b64start,b64end);

                // 18: textlength of : <L7p:DecodedBase64 --> Zero starts at 18 (relative to tagStart)
                if (decodedStr == "0" && decodedXml.indexOf("Zero",tagStart)-tagStart == 18) { 
                    // handle very special case where original tag was looking like: <L7p:Base64Expression stringValue="0"/> // stringValue obviously not encoded ???
                    // here the value was exploded as <L7p:DecodedBase64ZeroExpression stringValue="0"/>
                    // assure, to revert it to the original value.
                    // hardcode encoded string to original value.
                    encodedStr="0";
                    // 22: textlength of : <L7p:DecodedBase64Zero , offset for original tagname
                    orgTagStart = 22;
                }
                else {
                    // encode string to base64
                    encodedStr = Buffer.from(undoEscapeEoc(decodedStr)).toString('base64');
                    // 18: textlength of : <L7p:DecodedBase64 , offset for original tagname
                    orgTagStart = 18;
                }

                // starting part + '<L7p:Base64' + <trailing part of Base64 tag> + encoded-string + rest of decodedXml
                decodedXml=`${decodedXml.substr(0,tagStart)}<L7p:Base64${decodedXml.substring(tagStart+orgTagStart,b64start)}${encodedStr}${decodedXml.substr(b64end)}`;
                // find next
                tagStart=decodedXml.indexOf('<L7p:DecodedBase64', b64end);
            }	
            return(decodedXml);
    }

    function undoEscapeEoc(escaped) {
        //substitute all '&quoted_end_of_tag;' by "/>
        return( escaped.replace(/&quoted_end_of_tag;/g, "\"/>"));
    }

})();

let type2Imploder = (function () {
    return {
        implode: function (inputDir) {
            const bundle = {};

            utils.listDir(inputDir).forEach(item => {
                if (item.endsWith(".json")) {
                    const key = item.substring(0, item.length - ".json".length);
                    utils.info("imploding " + key);
                    bundle[key] = utils.readFile(utils.path(inputDir, item));
                    readEntities(inputDir, bundle[key], key);
                    if (!bundle[key].length) delete bundle[key];
                }
            });

            return bundle;
        }
    };

    function readEntities(dir, entities, pluralMethod) {
        if (pluralMethod === "policyFragments" || pluralMethod === "backgroundTaskPolicies" || pluralMethod === "globalPolicies") {
            entities.forEach(entity => readPolicy(entity, dir));
        } else if (pluralMethod === "webApiServices") {
            entities.forEach(entity => readPolicy(entity, dir, "service-"));
        } else if (pluralMethod === "soapServices") {
            entities.forEach(entity => {
                readPolicy(entity, dir, "service-");
                readSoapServiceWsdl(entity, dir);
            });
        } else if (pluralMethod === "trustedCerts") {
            entities.forEach(entity => readTrustedCert(entity, dir));
        } else if (pluralMethod === "keys") {
            entities.forEach(entity => readKey(entity, dir));
        }
    }

    function readPolicy(entity, dir) {
        const filepath = decodeFilepath(entity, dir, entity.policy.xml);
        if (filepath) {
            entity.policy.xml = utils.readFile(filepath);
        }
    }

    function readSoapServiceWsdl(entity, dir) {
        const filepath = decodeFilepath(entity, dir, entity.wsdl);
        if (filepath) {
            entity.wsdl = utils.readFile(filepath);
        }
    }

    function readTrustedCert(entity, dir) {
        const filepath = decodeFilepath(entity, dir, entity.certBase64);
        if (filepath) {
            entity.certBase64 = utils.readFile(filepath);
        }
    }

    function readKey(entity, dir) {
        const filepath = decodeFilepath(entity, dir, entity.p12);
        if (filepath) {
            entity.p12 = utils.readFile(filepath);
        }

        if (entity.certChain) {
            entity.certChain.forEach((cert, index) => {
                const filepath2 = decodeFilepath(entity, dir, cert);
                if (filepath2) {
                    entity.certChain[index] = utils.readFile(filepath2);
                }
            });
        }
    }

    function decodeFilepath(entity, dir, text) {
        const filename = decodeFilename(text);
        const filepath = utils.path(dir, filename);

        if (!utils.existsFile(filepath)) {
            utils.warn(`${filepath} file is missing for ` + butils.entityDisplayName(entity));
            return null;
        }

        utils.info("  reading from " + filepath);
        return filepath;
    }

    function decodeFilename(text) {
        if (text && text.startsWith("{{") && text.endsWith("}}")) {
            return text.substring(2, text.length - 2);
        } else {
            return "";
        }
    }
})();
