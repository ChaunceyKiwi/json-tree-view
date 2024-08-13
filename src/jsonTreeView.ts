import * as json from 'jsonc-parser';
import * as path from 'path';
import * as vscode from 'vscode';
import * as pluralize from 'pluralize';

export class JsonTreeViewProvider implements vscode.TreeDataProvider<number> {
  private _onDidChangeTreeData: vscode.EventEmitter<number | undefined> = new vscode.EventEmitter<number | undefined>();
  readonly onDidChangeTreeData: vscode.Event<number | undefined> = this._onDidChangeTreeData.event;

  private tree: json.Node | undefined;
  private text = '';
  private editor: vscode.TextEditor | undefined;
  private error_paths: (string | number)[][] = [];

  constructor(private context: vscode.ExtensionContext) {
    vscode.window.onDidChangeActiveTextEditor(() => this.onActiveEditorChanged());
    vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChanged(e));
    this.onActiveEditorChanged();
  }

  refresh(offset?: number): void {
    this.updateErrorPath();
    this.parseTree();
    if (offset) {
      this._onDidChangeTreeData.fire(offset);
    } else {
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  select(range: vscode.Range) {
    const config = vscode.workspace.getConfiguration().jsonTreeView;
    if (config.revealOnClick && this.editor) {
      this.editor.selection = new vscode.Selection(range.start, range.end);
      this.editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    }
  }

  reveal(offset: number, withKey: boolean): void {
    if (this.tree && this.editor) {
      const path = json.getLocation(this.text, offset).path;
      let propertyNode = json.findNodeAtLocation(this.tree, path);
      if (propertyNode) {
        let startOffset = undefined;
        if (withKey && propertyNode.parent?.type === 'property' && propertyNode.parent.children) {
          startOffset = propertyNode.parent.children[0].offset;
        }
        const range = new vscode.Range(
          this.editor.document.positionAt(startOffset ?? propertyNode.offset),
          this.editor.document.positionAt(propertyNode.offset + propertyNode.length)
        );
        this.editor.selection = new vscode.Selection(range.start, range.end);
        this.editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        vscode.window.showTextDocument(this.editor.document, this.editor.viewColumn, false);
      }
    }
  }

  collapseAll() {
    vscode.commands.executeCommand('workbench.actions.treeView.jsonTreeView.collapseAll');
  }

  revealInTree(treeView: vscode.TreeView<number>): void {
    const selection = vscode.window.activeTextEditor?.selection;
    if (this.tree && this.editor && selection) {
      const path = json.getLocation(this.text, this.editor.document.offsetAt(selection?.start)).path;
      const node = json.findNodeAtLocation(this.tree, path);
      treeView.reveal(node?.offset ?? 0, { select: true, focus: true });
    }
  }

  private onActiveEditorChanged(): void {
    if (vscode.window.activeTextEditor) {
      if (vscode.window.activeTextEditor.document.uri.scheme === 'file') {
        const enabled =
          vscode.window.activeTextEditor.document.languageId === 'json' ||
          vscode.window.activeTextEditor.document.languageId === 'jsonc';
        vscode.commands.executeCommand('setContext', 'jsonTreeViewEnabled', enabled);
        if (enabled) {
          this.refresh();
        }
      }
    } else {
      vscode.commands.executeCommand('setContext', 'jsonTreeViewEnabled', false);
    }
  }

  private onDocumentChanged(changeEvent: vscode.TextDocumentChangeEvent): void {
    if (this.tree && changeEvent.document.uri.toString() === this.editor?.document.uri.toString()) {
      for (const change of changeEvent.contentChanges) {
        const path = json.getLocation(this.text, this.editor.document.offsetAt(change.range.start)).path;
        path.pop();
        const node = path.length ? json.findNodeAtLocation(this.tree, path) : void 0;
        this.parseTree();
        this._onDidChangeTreeData.fire(node ? node.offset : void 0);
      }
    }
  }

  private parseTree(): void {
    this.text = '';
    this.tree = undefined;
    this.editor = vscode.window.activeTextEditor;
    if (this.editor && this.editor.document) {
      this.text = this.editor.document.getText();
      this.tree = json.parseTree(this.text);
    }
  }

  getParent(offset: number): Thenable<number> {
    if (this.tree) {
      const path = json.getLocation(this.text, offset).path;
      const node = json.findNodeAtLocation(this.tree, path);
      if (node) {
        let parentNode = node.parent;
        while (parentNode?.type === 'property') {
          parentNode = parentNode.parent;
        }
        if (parentNode) {
          return Promise.resolve(parentNode.offset);
        }
      }
    }
    return Promise.resolve(0);
  }

  getChildren(offset?: number): Thenable<number[]> {
    if (offset && this.tree) {
      const path = json.getLocation(this.text, offset).path;
      const node = json.findNodeAtLocation(this.tree, path);
      if (node) {
        return Promise.resolve(this.getChildrenOffsets(node));
      }
    }
    return Promise.resolve(this.tree ? this.getChildrenOffsets(this.tree) : []);
  }

  private getChildrenOffsets(node: json.Node): number[] {
    const offsets: number[] = [];
    if (node.children && this.tree) {
      for (const child of node.children) {
        const childPath = json.getLocation(this.text, child.offset).path;
        const childNode = json.findNodeAtLocation(this.tree, childPath);
        if (childNode) {
          offsets.push(childNode.offset);
        }
      }
    }
    return offsets;
  }

  getTreeItem(offset: number): vscode.TreeItem {
    if (!this.tree) {
      throw new Error('Invalid tree');
    }
    if (!this.editor) {
      throw new Error('Invalid editor');
    }

    const path = json.getLocation(this.text, offset).path;
    const valueNode = json.findNodeAtLocation(this.tree, path);
    if (valueNode) {
      let hasChildren = valueNode.type === 'object' || valueNode.type === 'array';
      const treeItem: vscode.TreeItem = new vscode.TreeItem(
        this.getLabel(valueNode),
        hasChildren
          ? valueNode.type === 'object'
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None
      );

      /* If tree item's path is in error paths, assign it an error icon */
      if (ifArrayAInArrayB(path, this.error_paths)) {
        treeItem.iconPath = this.getErrorIcon();
      } else {
        treeItem.iconPath = this.getIcon(valueNode);
      }

      treeItem.command = {
        command: 'extension.openJsonSelection',
        title: 'Open JSON Selection',
        arguments: [
          new vscode.Range(
            this.editor.document.positionAt(valueNode.offset),
            this.editor.document.positionAt(valueNode.offset + valueNode.length)
          ),
        ],
      };

      treeItem.contextValue = valueNode.type;
      return treeItem;
    }
    throw new Error(`Could not find json node at ${path}`);
  }

  private getIcon(node: json.Node): any {
    let nodeType = node.type;
    if (nodeType === 'boolean') {
      return {
        light: this.context.asAbsolutePath(path.join('resources', 'light', 'boolean.svg')),
        dark: this.context.asAbsolutePath(path.join('resources', 'dark', 'boolean.svg')),
      };
    }
    if (nodeType === 'string') {
      return {
        light: this.context.asAbsolutePath(path.join('resources', 'light', 'string.svg')),
        dark: this.context.asAbsolutePath(path.join('resources', 'dark', 'string.svg')),
      };
    }
    if (nodeType === 'number') {
      return {
        light: this.context.asAbsolutePath(path.join('resources', 'light', 'number.svg')),
        dark: this.context.asAbsolutePath(path.join('resources', 'dark', 'number.svg')),
      };
    }

    if (nodeType === 'array' || nodeType === 'object') {
      return {
        light: this.context.asAbsolutePath(path.join('resources', 'light', 'list.svg')),
        dark: this.context.asAbsolutePath(path.join('resources', 'dark', 'list.svg')),
      };
    }
    return null;
  }

  private getErrorIcon(): any {
    return {
      light: this.context.asAbsolutePath(path.join('resources', 'light', 'error.svg')),
      dark: this.context.asAbsolutePath(path.join('resources', 'dark', 'error.svg')),
    };
  }

  /**
   * Key observations:
   *   1. node.type could only be 'object', 'array', 'string', 'number', 'boolean'
   *   2. 'object' node has 0 or many property node as children. Parent node can only be 'array' or 'object
   */
  private getLabel(node: json.Node): string {
    if (node.type === 'object') {
      if (node.parent?.type === 'property') {
        const property = node.parent?.children ? node.parent.children[0].value.toString() : '';
        return property + ' { }';
      } else if (node.parent?.type === 'array') {
        if (node.parent.parent?.type === 'property' && node.parent.parent?.children) {
          /* If parent key is available */
          const parentKey = node.parent.parent.children[0].value.toString();
          const config = vscode.workspace.getConfiguration().jsonTreeView;
          if (
            config.customizedViewMapping &&
            parentKey in config.customizedViewMapping &&
            node.type === 'object' &&
            node.children
          ) {
            /* Object in array is the only case where customized mapping can be applied */
            let key: string = config.customizedViewMapping[parentKey];
            for (let i = 0; i < node.children.length; i++) {
              const childNode = node.children[i];
              if (childNode.children && childNode.children[0].value === key) {
                return childNode.children[1].value.toString();
              }
            }
          }
          const prefix = node.parent.children?.indexOf(node).toString();
          return pluralize.singular(parentKey) + ' ' + prefix + ' { }';
        } else if (node.parent.children) {
          return node.parent.children?.indexOf(node).toString();
        }
      }
    } else if (node.type === 'array') {
      if (node.parent?.type === 'property') {
        const property = node.parent?.children ? node.parent.children[0].value.toString() : '';
        return property + ' [' + node.children!.length + ']';
      } else if (node.parent?.type === 'array') {
        const prefix = node.parent.children?.indexOf(node).toString();
        if (node.parent.parent?.type === 'property' && node.parent.parent?.children) {
          /* If parent key is available */
          const parentKey = node.parent.parent.children[0].value.toString();
          return pluralize.singular(parentKey) + ' ' + prefix + ' [' + node.children!.length + ']';
        } else {
          /* If parent key is not available */
          return prefix + ' [' + node.children!.length + ']';
        }
      }
    } else {
      /* Primitive node type: 'string', 'number', 'boolean' */
      if (node.parent?.type === 'property') {
        const property = node.parent?.children ? node.parent.children[0].value.toString() : '';
        const value = node.parent?.children ? node.parent.children[1].value.toString() : '';
        return `${property}: ${value}`;
      } else if (node.parent?.type === 'array') {
        const prefix = node.parent.children?.indexOf(node).toString();
        if (node.parent.parent?.type === 'property' && node.parent.parent?.children) {
          /* If parent key is available */
          const parentKey = node.parent.parent.children[0].value.toString();
          return pluralize.singular(parentKey) + ' ' + prefix + ': ' + node.value.toString();
        } else {
          /* If parent key is not available */
          return prefix + ': ' + node.value.toString();
        }
      }
    }
    return 'undefined';
  }

  private updateErrorPath() {
    if (this.editor && vscode.window.activeTextEditor) {
      this.error_paths = [];
      let diagnostics = vscode.languages.getDiagnostics();
      for (let i = 0; i < diagnostics.length; i++) {
        if (diagnostics[i][0]['fsPath'] === vscode.window.activeTextEditor.document.fileName) {
          let errors = diagnostics[i][1];
          for (let error of errors) {
            this.error_paths.push(
              json.getLocation(
                vscode.window.activeTextEditor.document.getText(),
                this.editor.document.offsetAt(error['range']['end'])
              ).path
            );
          }
        }
      }
    }
  }
}

function ifArrayAInArrayB(A: (string | number)[], B: (string | number)[][]) {
  let A_flatten = A.map((x) => x.toString()).join();
  let B_flatten = B.map((x) => x.join());
  return withinOf(A_flatten, B_flatten);
}

function withinOf(A: string, B: string[]) {
  for (let i = 0; i < B.length; i++) {
    let A_array = A.split(',');
    let B_sub_array = B[i].split(',');

    /* return true if A_array is a sub array of B_sub_array */
    if (A_array.length <= B_sub_array.length) {
      let j;
      for (j = 0; j < A_array.length; j++) {
        if (A_array[j] !== B_sub_array[j]) {
          break;
        }
      }
      if (j === A_array.length) {
        return true;
      }
    }
  }
  return false;
}
