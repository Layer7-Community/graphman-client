// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const utils = tUtils.load("graphman-utils");

test("base64:encode/decode text", () => {
    const text = "Hello, World!";
    const encodedText = utils.base64StringEncode(text);
    expect(encodedText).toEqual("SGVsbG8sIFdvcmxkIQ==");
    expect(utils.base64StringDecode(encodedText)).toEqual(text);
});

test("decode secrets", () => {
    const text = "Hello, World!";
    const encodedText = "$b64.SGVsbG8sIFdvcmxkIQ==";
    expect(utils.decodeSecret(text)).toEqual(text);
    expect(utils.decodeSecret(encodedText)).toEqual(text);
});
