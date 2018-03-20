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
export class MwbProvider implements vscode.TreeDataProvider<Column> {
	private _onDidChangeTreeData: vscode.EventEmitter<Column | undefined> = new vscode.EventEmitter<Column | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Column | undefined> = this._onDidChangeTreeData.event;
	data:Map<string,Array<coum>>=new Map();
	filePath:string=null;
	private t_path='';
	private database='';
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

	setDB(db:string){
		this.database=db;
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
		var selectDb=(db)=>{
			var data;
			if (this.database==''){
				return db.value.value.array;
			}else{
				for (const i of db.value.array) {
					var name=findAttr(i.value.array,'key','name').text();
					if (name==this.database){
						return i.value.array;
					}
				}
			}
			return null;
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
				data=selectDb(findAttr(data,'content-struct-name','db.mysql.Schema'))
				if (data===null){
					window.showErrorMessage('404! Selected database not found!');
					return ;
				}
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

	getTreeItem(element: Column): vscode.TreeItem {
		return element;
	}

	getChildren(element?: Column): Thenable<Column[]> {
		if (!this.filePath) {
			vscode.window.showInformationMessage('No dependency in empty workspace');
			return Promise.resolve([]);
		}
		var res=[],i;
		if (!element){
			var keys=this.data.keys();
			for (i of keys) {
				res.push(new Column(i,'',vscode.TreeItemCollapsibleState.Collapsed))
			}
			res.sort((a,b)=>{
				return a.label>b.label?1:-1;
			})
		}else{
			var data=this.data.get(element.label);
			if (data){
				for (const i of data) {
					res.push(new Column(i.name,i.type,vscode.TreeItemCollapsibleState.None))
				}
			}
		}
		return Promise.resolve(res);
	}
}

class Column extends vscode.TreeItem {

	constructor(
		private readonly name: string,
		private readonly type: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super('', collapsibleState);
		if (collapsibleState==vscode.TreeItemCollapsibleState.None){
			this.label=`${name} ${type}`;
			this.command={
				command:'mwbTable.insert',
				title:'',
				arguments:[name+',']
			}
		}else{
			this.label=`${name}`;
			this.contextValue='table';
		}
	}
}