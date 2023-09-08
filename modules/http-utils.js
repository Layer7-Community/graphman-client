const utils = require("./graphman-utils");

module.exports = {
    readParts: function (resp, boundary) {
        return readParts(resp, boundary);
    },

    writeParts: function (req, parts) {
        writeParts(req, parts);
    },

    parseHeaderLine: function (data) {
        return parseHeaderLine(data);
    },

    parseHeader: function (name, value) {
        return this.parseHeaderLine(name + ":" + value);
    }
}

function readParts(data, boundary) {
    const END_OF_LINE_MARKER = "\r\n";
    let index, fromIndex = 0;
    let parts = [];
    let found = false;
    let part = null;
    let partCounter = 0;

    while ((index = data.indexOf(boundary, fromIndex)) !== -1) {
        if (!found) {
            fromIndex = index + boundary.length + 2;
            var endOfLineIndex = data.indexOf(END_OF_LINE_MARKER + END_OF_LINE_MARKER, fromIndex);
            if (endOfLineIndex === -1) {
                break;
            }
            part = parsePartMetadata(data.subarray(fromIndex, endOfLineIndex).toString());
            partCounter++;
            utils.info(`  part (${partCounter})`, part);
            fromIndex = endOfLineIndex + 4;
            found = true;
        } else {
            utils.debug(`  part data starts from = ${fromIndex}, to = ${index - 4}`);
            part.data = data.subarray(fromIndex, index - 4);
            utils.debug(`  part (${partCounter}) data length =`, part.data.length);
            parts.push(part);
            found = false;
            fromIndex = index;
        }
    }

    return parts;
}

function writeParts(req, parts) {
    const endOfLine = "\r\n";
    const boundary = "--" + parts[0].boundary;

    parts.forEach(part => {
        req.write(boundary + endOfLine);
        writePartMetadata(req, part, endOfLine);
        req.write(endOfLine);
        req.write(part.data);
        req.write(endOfLine);
    });

    req.write(boundary + "--");
}

function writePartMetadata(req, part, endOfLine) {
    req.write(`Content-Disposition: form-data; name="${part.name}"`);
    if (part.filename) req.write(`; filename="${part.filename}"`);
    req.write(endOfLine);

    req.write(`Content-Type: ${part.contentType}`);
    req.write(endOfLine);
}

function parsePartMetadata(data) {
    let result = {}, lines = data.split("\r\n");
    lines.forEach(line => parseHeaderLine(line, result));
    return result;
}

function parseHeaderLine(line, result) {
    let tokens = line.split(/[=:;"']/)
        .map(item => item.trim())
        .filter(item => item.length > 0);

    result = result||{};

    for (var index = 0; index < tokens.length - 1; index += 2) {
        result[tokens[index]] = tokens[index + 1];
    }

    return result;
}
