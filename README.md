# JSON Tree View README

A tool to generate a JSON tree view from a JSON file, integrated with JSON schema validation and customized tree view configuration.

## Features
1. JSON Tree View

2. Validation Error Hightlighting
![Validation Error Highlighting](./images/demo1.png)

3. Customized Tree View Configuration
![Customized Tree View](./images/demo2.png)

## Requirements

* Follow instructions on `https://code.visualstudio.com/docs/languages/json` to set up json schema files.
* JSON schema file should exist on the path: `schema/schema-root.json`. Include required schema files as well if there exist any references in root schema file. E.g.

    ```
    {
        "json.schemas": [
            {
                "fileMatch": ["/*.json"],
                "url": "./schema/schema-root.json"
            },
            {
                "fileMatch": ["/*.json"],
                "url": "./schema/schema-*****.json"
            }
        ]
    }
    ```

## Release Notes

### 1.0.0

Initial release of JSON Tree View

## Others
* For more information, feel free to raise new issues on [Github Repository JSON Tree View](https://github.com/ChaunceyKiwi/json-tree-view)