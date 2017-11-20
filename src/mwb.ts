import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as unzip from 'unzip';
import { Uri,window} from 'vscode';
import * as xmlreader from 'xmlreader';
interface coum{
	name:string,
	type:string,
	flag:string
}
export class MwbProvider implements vscode.TreeDataProvider<Dependency> {
	private _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined> = new vscode.EventEmitter<Dependency | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Dependency | undefined> = this._onDidChangeTreeData.event;
	data:Map<string,Array<coum>>=new Map();
	filePath:string=null;
	private t_path='';
	constructor(private root: Uri) {
		this.t_path=os.tmpdir()+'/_.xml';
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	setPath(path:string,absolute:boolean) {
		if (path==''){
			this.filePath=null;
			return;
		}
		if (absolute) this.filePath=path;
		else this.filePath=this.root.fsPath+path;
		this.parse();
	}

	parse(){
		fs.access(this.filePath,(e)=>{
			if (e){
				console.log(e.message);
				window.showErrorMessage(`read file ${this.filePath} fail!`);
				this.filePath=null;
				return;
			}
			this.unzip();
		})
	}
    unzip(){
		fs.createReadStream(this.filePath)
		.pipe(unzip.Parse())
		.on('entry', (entry)=>{
		  var fileName = entry.path;
		  if (fileName === "document.mwb.xml") {
			entry.pipe(fs.createWriteStream(this.t_path));
			this._parse();
		  } else {
			entry.autodrain();
		  }
		})
    }
    _parse(){
		var findAttr = function(obj,key,name) {
			var i,attr;
			for (i of obj) {
				attr=i.attributes();
				if (key in attr && attr[key]==name){
					return i;
				}
			}
			throw "parse error!";
		}
        fs.readFile(this.t_path,{encoding:'utf8'},(err,str)=>{
			if (null !== err) {
				window.showErrorMessage(err.message);
				return;
			}
			xmlreader.read(str, (errors, response)=>{
				if (null !== errors) {
					window.showErrorMessage(errors.message);
					return;
				}
				var data=response.data.value.value.array;
				data=findAttr(data,'content-struct-name','workbench.physical.Model');
				data=data.value.value.array;
				data=findAttr(data,'struct-name','db.mysql.Catalog');
				data=data.value.array;
				data=findAttr(data,'content-struct-name','db.mysql.Schema');
				data=data.value.value.array;
				data=findAttr(data,'content-struct-name','db.mysql.Table');
				data=data.value.array;
				var res=[];
				res=data.map(i => {
					let table={name:'',column:[]}
					var arr=i.value.array;
					table.name=findAttr(arr,'key','name').text();
					var column=findAttr(arr,'content-struct-name','db.mysql.Column').value.array;
					table.column=column.map(i=>{
						let obj:coum={name:'',flag:'',type:''}
						var arr=i.value.array;
						obj.name=findAttr(arr,'key','name').text();
						var flag=findAttr(arr,'key','flags');
						obj.flag='';
						if ('value' in flag){
							if (flag.value.count()==1)
								obj.flag=flag.value.text();
							else obj.flag=flag.value.array.map(i=>i.text()).join(' ');
						}
						var type=findAttr(i.link.array,'key','simpleType').text();
						obj.type=type.split('.').pop();
						return obj;
					})
					return table;
				});
				for (let i of res) {
					this.data.set(i.name,i.column);
				}
				this.refresh();
				fs.unlink(this.t_path,()=>{});
			});
		})
    }

	insert(text) {
		if (typeof text!='string'){
			text=text.label;
		}
		var edit=vscode.window.activeTextEditor;
		var position=edit.selection.start;
		if (edit){
			edit.edit(build=>{
				build.insert(position,text);
			})
		}
	}

	getTreeItem(element: Dependency): vscode.TreeItem {
		return element;
	}

	getChildren(element?: Dependency): Thenable<Dependency[]> {
		if (!this.filePath) {
			vscode.window.showInformationMessage('No dependency in empty workspace');
			return Promise.resolve([]);
		}
		var res=[],i;
		if (!element){
			var keys=this.data.keys();
			for (i of keys) {
				res.push(new Dependency(i,vscode.TreeItemCollapsibleState.Collapsed))
			}
			res.sort((a,b)=>{
				return a.label>b.label?1:-1;
			})
		}else{
			var data=this.data.get(element.label);
			if (data){
				for (const i of data) {
					res.push(new Dependency(`${i.name} ${i.type}`,vscode.TreeItemCollapsibleState.None))
				}
			}
		}
		return Promise.resolve(res);
	}
}

class Dependency extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(label, collapsibleState);
		if (collapsibleState==vscode.TreeItemCollapsibleState.None){
			this.command={
				command:'mwbTable.insert',
				title:'',
				arguments:[label+',']
			}
		}else{
			this.contextValue='table';
		}
	}
}