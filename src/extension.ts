'use strict';
import * as vscode from 'vscode';
import {MwbProvider} from './mwb';

export function activate(context: vscode.ExtensionContext) {
	if (!vscode.workspace.workspaceFolders) return
	const rootPath = vscode.workspace.workspaceFolders[0].uri;
	const provide = new MwbProvider(rootPath);
	var file:string=vscode.workspace.getConfiguration().get('MWB.filepath');
	var absolute:boolean=vscode.workspace.getConfiguration().get('MWB.absolute');
	var database:string=vscode.workspace.getConfiguration().get('MWB.database');
	provide.setDB(database)
	provide.setPath(file,absolute);
	vscode.window.registerTreeDataProvider('mwbTable', provide);
	vscode.commands.registerCommand('mwbTable.refreshEntry', () => provide.parse());
	vscode.commands.registerCommand('mwbTable.insert', text => provide.insert(text));
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(_=>{
		var file:string=vscode.workspace.getConfiguration().get('MWB.filepath');
		var absolute:boolean=vscode.workspace.getConfiguration().get('MWB.absolute');
		var database:string=vscode.workspace.getConfiguration().get('MWB.database');
		provide.setDB(database)
		provide.setPath(file,absolute);
	}));
}