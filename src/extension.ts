'use strict';
import * as vscode from 'vscode';
import { JsonTreeViewProvider } from './jsonTreeView';

export function activate(context: vscode.ExtensionContext) {
  const jsonTreeViewProvider = new JsonTreeViewProvider(context);
  const treeView = vscode.window.createTreeView('jsonTreeView', { treeDataProvider: jsonTreeViewProvider });
  vscode.commands.registerCommand('jsonTreeView.refresh', () => jsonTreeViewProvider.refresh());
  vscode.commands.registerCommand('jsonTreeView.collapseAll', () => jsonTreeViewProvider.collapseAll());
  vscode.commands.registerCommand('jsonTreeView.reveal', (offset) => jsonTreeViewProvider.reveal(offset, false));
  vscode.commands.registerCommand('jsonTreeView.revealWithKey', (offset) => jsonTreeViewProvider.reveal(offset, true));
  vscode.commands.registerCommand('jsonTreeView.revealInTree', () => jsonTreeViewProvider.revealInTree(treeView));
  vscode.languages.onDidChangeDiagnostics(() => jsonTreeViewProvider.refresh());
}

// this method is called when your extension is deactivated
export function deactivate() {}
