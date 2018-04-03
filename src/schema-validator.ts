var Ajv = require('ajv');
var ajv = new Ajv({allErrors: true});
import * as vscode from 'vscode';

let schemaRead = false;
let schemaFiles = [
    vscode.workspace.rootPath + "/schema/schema-root.json",
    vscode.workspace.rootPath + "/schema/schema-storedProcedure.json",
    vscode.workspace.rootPath + "/schema/schema-table.json",
    vscode.workspace.rootPath + "/schema/schema-sqltype.json"
];

export function validate(data: any) {
    if (!schemaRead) {
        schemaFiles.forEach(function(schemaFile) {
            var schema = require(schemaFile);
            ajv.addSchema(schema, schemaFile);
        });
        schemaRead = true;
    }

    let valid = ajv.validate(schemaFiles[0], data);
    if (valid) {
        console.log('Valid!\n');
    } else {
        console.log('Invalid!\n' + ajv.errorsText().replace(/, /g, "\n"));
    }

    if (ajv.errors !== null) {
        return ajv.errors.map(function(x:any) {
            let path = x.dataPath;
            path = path.replace(/\[/g, ".");
            path = path.replace(/]/g, "");
            return path;
        });
    } else {
        return [];
    }
}