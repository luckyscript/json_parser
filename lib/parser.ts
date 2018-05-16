import * as sjc from "strip-json-comments";
import parse_value_literal from './parse_value_literal';
import parse_value_string from './parse_value_string';
import skip_whitespace from './skip_whitespace';


interface Tree {
    key: string,
    value: string,
    children: Array<any>,
    type: string,
    comment: string
}

function parse (json:string):any {
    if(!check_valid(json))
        throw new Error("Not valid JSON");
    if(json[0] === '{') {
        return parse_object(json).value;
    } else if(json[0] == '[') {
        // array like json
        return JSON.parse(parse_value_array(json).value);
    } else {
        // if comment is before json, throw error
        throw new Error(`unsupport input: ${json}`)
    }
}

let parse_object = (value:string):Array<Tree>|any => {
    let len:number = value.length;
    let pointer:number = 1;
    let tree:Tree = {
        key: '',
        value: '',
        comment: '',
        children: [],
        type: 'Object'
    }
    let result: Array<Tree>|any = [];
    let inKey:boolean = false, inValue: boolean = false, inComment:boolean = false;
    let nextType = 'key';
    let stack:Array<string> = [];
    let commentFlag = false;
    
    // skip whitespace
    pointer = skip_whitespace(value, pointer);
    if(value[pointer] == '}') {
        result = [];
        return {value: result};
    }
    for(let depth = 1;pointer < len && depth !== 0;pointer++) {
        // key start
        let char:string = value[pointer];
        if(inKey) {
            if(char == '"') {
                // key end
                inKey = false;
                nextType = 'value';
                tree.key = stack.join("");
                stack = [];
                pointer = skip_whitespace(value, pointer);
                commentFlag = true;
            } else {
                stack.push(char);
            }
        }
        if(char == '"' && nextType == 'key') {
            // stack.push(char)
            inKey = true;
            // result.push(JSON.parse(JSON.stringify(tree))
            tree = {
                key: '',
                value: '',
                children: [],
                type: 'Object',
                comment: ''
            };
        }
        if(inValue) {
            let val = parse_value(value.substr(pointer));
            pointer += val.len;
            if(val.type == 'Object') {
                tree.children = val.value
            } else {
                tree.value = val.value;
            }
            tree.type = val.type;
            result.push(JSON.parse(JSON.stringify(tree)));
            inValue = false;
            nextType = 'key';
        }
        if(char == ':' && !inValue && !inComment) {
            pointer = skip_whitespace(value, pointer);
            inValue = true;
        }
        if(char == '/' && value[pointer - 1] == '/' && !inValue && !inKey && commentFlag) {
            // sigle line comment start
            let comment = parse_single_comment(value.substr(pointer));

            pointer += comment.len;
            tree.comment = comment.comment;
            result.pop();
            result.push(JSON.parse(JSON.stringify(tree)));
        }
        if(char == '*' && value[pointer - 1] == '/' && !inValue && !inKey) {
             // sigle line comment start
             let comment = parse_multi_comment(value.substr(pointer));

             pointer += comment.len;
             tree.comment = comment.comment;
             result.pop();
             result.push(JSON.parse(JSON.stringify(tree)));
        }
        if(char == '{') depth++;
        if(char == '}') depth--;
    }
    return {
        value: result,
        len: pointer + 1,
        type: 'Object'
    };

}



let parse_single_comment = function (value: string) {
    let p = 0
    for (;value[p] != '\n'; p++);
    return {
        comment: value.substr(1, p-1),
        len: p+1
    }
}

let parse_multi_comment = function (value: string) {
    let p = 0
    for (;!(value[p] == '/' && value[p-1] == '*'); p++);
    return {
        comment: value.substr(1, p-2),
        len: p+1
    }
}

let parse_value = function (value: string) {
    value = value.trim();
    switch(value[0]) {
        // bool
        case 't': 
            return parse_value_literal(value, 'true')
        case 'f': 
            return parse_value_literal(value, 'false');
        // null
        case 'n': 
            return parse_value_literal(value, 'null');
        // string
        case '"':
            return parse_value_string(value);
        // array
        case '[':
            return parse_value_array(value);
        // object
        case '{':
            return parse_object(value);
        default:
            return parse_number(value);
    }
}

let parse_value_array = (value:string) => {
    let p = 0;
    p++;
    p = skip_whitespace(value, p);
    if(value[p] == ']') {
        return {
            value: '[]',
            type: 'Array',
            len: p+1
        }
    }
    for (let depth = 1;depth !== 0;p++) {
        if(value[p] == '[')
            depth++;
        if(value[p] == ']')
            depth--;
    }
    return {
        value: value.substr(0, p),
        type: 'Array',
        len: p+1
    }

}
let parse_number = (value:string) => {
    let p = 0;
    if(value[p] == '-')
        p++;
    if(value[p] == '0')
        p++;
    else {
        if(!ISDIGIT1TO9(value[p]))
            throw new Error('not a valid number');
        for(p++; ISDIGIT(value[p]); p++);
    }
    if (value[p] == '.') {
        p++;
        if (!ISDIGIT(value[p])) 
            throw new Error('not a valid number');
        for (p++; ISDIGIT(value[p]); p++);
    }
    if (value[p] == 'e' || value[p] == 'E') {
        p++;
        if (value[p] == '+' || value[p] == '-') p++;
        if (!ISDIGIT(value[p])) 
            throw new Error('not a valid number');
        for (p++; ISDIGIT(value[p]); p++);
    }
    return {
        value: value.substr(0, p),
        type: 'Number',
        len: p+1
    }
}

let check_valid = function(json:string):boolean {
    try {
        JSON.parse(sjc(json));
    } catch(e) {
        return false;
    }
    return true;
}

let ISDIGIT = (v:string) => {
    return v <= '9' && v >= '0';
}
let ISDIGIT1TO9 = (v:string) => {
    return v <= '9' && v >= '1';
}
export default parse;
