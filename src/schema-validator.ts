import * as vscode from 'vscode';

export function validate(data: any) {
    var Ajv = require('ajv');
    var ajv = new Ajv({allErrors: true});

    let jsonSchema = vscode.workspace.getConfiguration("json").schemas;
    let schemaFiles: string[] = [];

    for (let i = 0; i < jsonSchema.length; i++) {
        schemaFiles.push(vscode.workspace.rootPath + jsonSchema[i].url);
    }

    if ("$schema" in data) {
        schemaFiles.unshift(vscode.workspace.rootPath + data.$schema.slice(1));
    }

    schemaFiles.forEach(function(schemaFile) {
        var schema = require(schemaFile);
        ajv.addSchema(schema, schemaFile);
    });

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