'use strict';
import * as vscode from 'vscode';
import {MwbProvider} from './mwb';

export function activate(context: vscode.ExtensionContext) {
	const rootPath = vscode.workspace.workspaceFolders[0].uri;
	var file:string=vscode.workspace.getConfiguration().get('MWB.filepath');
	var absolute:boolean=vscode.workspace.getConfiguration().get('MWB.absolute');
	const provide = new MwbProvider(rootPath);
	provide.setPath(file,absolute);
	vscode.window.registerTreeDataProvider('mwbTable', provide);
	vscode.commands.registerCommand('mwbTable.refreshEntry', () => provide.parse());
	vscode.commands.registerCommand('mwbTable.insert', text => provide.insert(text));
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(_=>{
		var file:string=vscode.workspace.getConfiguration().get('MWB.filepath');
		var absolute:boolean=vscode.workspace.getConfiguration().get('MWB.absolute');
		provide.setPath(file,absolute);
	}));
}
