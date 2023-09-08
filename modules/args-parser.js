module.exports = {
    parse: function (args) {
        const params = {__unknowns:[]};
        const argsWatcher = [];

        args.forEach(arg => {
            if (arg.startsWith("--")) {
                arg = arg.substring(2);
                var tokens = arg.split(".");
                obj = params[tokens[0]];
                if (!obj) obj = params[tokens[0]] = {};
                argsWatcher.push([obj, tokens.length >= 2 ? tokens[1] : '__value', tokens]);
            } else {
                const argObj = argsWatcher.pop();
                if (argObj) {
                    if (argObj[2].length > 2) {
                        buildArg(argObj, arg);
                    } else {
                        var prop = argObj[0][argObj[1]];
                        if (!prop) argObj[0][argObj[1]] = arg;
                        else if (!Array.isArray(prop)) argObj[0][argObj[1]] = [prop, arg];
                        else argObj[0][argObj[1]].push(arg);
                    }
                } else params.__unknowns.push(arg);
            }
        });

        return normalize(params);
    }
}

function buildArg(argObj, value) {
    var index = 1;
    var obj = argObj[0];

    while (index < argObj[2].length - 1) {
        var tobj = obj[argObj[2][index]];
        if (!tobj) tobj = obj[argObj[2][index]] = {};
        obj = tobj;
        index++;
    }

    var prop = obj[argObj[2][index]];
    if (!prop) obj[argObj[2][index]] = value;
    else if (!Array.isArray(prop)) obj[argObj[2][index]] = [prop, value];
    else obj[argObj[2][index]].push(value);
}

function normalize(obj) {
    if (typeof obj !== 'object') {
        return obj;
    }

    Object.entries(obj).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item, index) => value[index] = normalize(item));
        } else if (typeof value === 'object') {
            if (Object.keys(value).length === 1 && value["__value"]) {
                obj[key] = value["__value"];
            } else {
                obj[key] = normalize(value);
            }
        }
    });

    return obj;
}
