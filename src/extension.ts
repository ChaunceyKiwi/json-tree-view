'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { JsonOutlineProvider } from './jsonOutline';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const jsonOutlineProvider = new JsonOutlineProvider(context);

    vscode.window.registerTreeDataProvider('jsonOutline', jsonOutlineProvider);
	vscode.commands.registerCommand('jsonOutline.refresh', () => jsonOutlineProvider.refresh());
	vscode.commands.registerCommand('jsonOutline.refreshNode', offset => jsonOutlineProvider.refresh(offset));
	vscode.commands.registerCommand('jsonOutline.renameNode', offset => jsonOutlineProvider.rename(offset));
	vscode.commands.registerCommand('jsonOutline.revealNode', offset => jsonOutlineProvider.reveal(offset));
	vscode.commands.registerCommand('extension.openJsonSelection', range => jsonOutlineProvider.select(range));
}

// this method is called when your extension is deactivated
export function deactivate() {
}