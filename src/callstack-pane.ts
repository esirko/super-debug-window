import * as vscode from 'vscode';
import { getNonce } from './util';
import { threadId } from 'worker_threads';

export class SuperCallStackProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'super-debug-window.callStack';
	private _view?: vscode.WebviewView;
	private _pendingUpdateThreads: any;
	private _pendingUpdateCallStack: any;

	constructor(
		private readonly _extensionUri: vscode.Uri,
	) { }

	private request_seq_0 = 0;
	private cachedResponses: any[] = [];

    public onDebugSessionStarted() {
        this.request_seq_0 = 0;
        this.cachedResponses = [];
    }
    
	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		// https://github.com/microsoft/vscode/issues/146330
		if (this._pendingUpdateThreads) {
			this.updateThreads(this._pendingUpdateThreads.request, this._pendingUpdateThreads.response);
			this._pendingUpdateThreads = undefined;
		}
		if (this._pendingUpdateCallStack) {
			// TODO: this won't work if we have multiple call stack responses in the queue.
			this.updateCallStack(this._pendingUpdateCallStack.request, this._pendingUpdateCallStack.response);
			this._pendingUpdateCallStack = undefined;
		}

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.command) {
				case 'gotoSourceLine':
					{
						//vscode.window.showInformationMessage('Go to source line ' + data.file + ' at line number ' + data.line);
						// Open the file and go to the line number
						vscode.workspace.openTextDocument(data.file).then(document => vscode.window.showTextDocument(document))
						let editor = vscode.window.activeTextEditor;
						if (editor) {
							let range = editor.document.lineAt(data.line-1).range;
							editor.selection =  new vscode.Selection(range.start, range.end);
							editor.revealRange(range);
						}
						break;
					}
				case 'changeThread':
					vscode.debug.activeDebugSession?.customRequest('stackTrace', { threadId: Number(data.threadId), startFrame: 0, levels: 20});
					break;
				default:
					break;
			}
		});
	}

	public updateThreads(request: any, response: any) {
		if (this._view) {
			this._view.webview.postMessage({ type: 'updateThreads', threads: response.body.threads });
		} else {
			this._pendingUpdateThreads = { request: request, response: response };
		}
	}

	public updateCallStack(request: any, response: any) {
		if (this._view) {
			// Here's the strategy to handle out-of-order call stack responses, based on my guesses about how the DAP works:
			// If startFrame == 0, then we are at the top of the call stack, so clear the previous call stack first. 
			// 		Keep track of the request_seq and call it request_seq_0.
			// 		If there are any entries in cachedResponses, take any that have their request_seq greater than request_seq_0 and re-apply them to the new call stack. Clear cachedResponses.
			// If startFrame > 0 and request_seq > request_seq_0, append to the previous call stack. Pay attention to the indices.
			// 		Keep track of the request_seq, and the stackFrames, and append them to an array cachedResponses.
			if (request.arguments.startFrame === 0) {
				this._view.webview.postMessage({ type: 'updateCallStack', clear: true, threadId: request.arguments.threadId, stackFrames: response.body.stackFrames });
				this.request_seq_0 = request.seq;
				for (let i = 0; i < this.cachedResponses.length; i++) {
					if (this.cachedResponses[i].request_seq > this.request_seq_0) {
						this._view.webview.postMessage({ type: 'updateCallStack', clear: false, threadId: request.arguments.threadId, stackFrames: this.cachedResponses[i].stackFrames });
					}
				}
				this.cachedResponses = [];
			} else if (request.seq > this.request_seq_0) {
				this.cachedResponses.push({ request_seq: request.seq, stackFrames: response.body.stackFrames });
				this._view.webview.postMessage({ type: 'updateCallStack', clear: false, threadId: request.arguments.threadId, stackFrames: response.body.stackFrames });
			}
		} else {
			this._pendingUpdateCallStack = { request: request, response: response };
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'callstack-pane.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'main.css'));

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading styles from our extension directory,
					and only allow scripts that have a specific nonce.
					(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>Super call stack</title>
			</head>
			<body>
				<label for="threads">Thread:</label>
				<select id="threads">
				</select>

				<table id="callStackTable" class="table">
					<thead>
						<tr>
							<th>Function</th>
							<th>File</th>
						</tr>
					</thead>
					<tbody>
					</tbody>
				</table>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}
