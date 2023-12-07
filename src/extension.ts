// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { on } from 'events';
import * as vscode from 'vscode';
//import "vscode-webview" // Cannot find name 'acquireVsCodeApi'.ts(2304) - https://stackoverflow.com/questions/56237448/how-to-make-acquirevscodeapi-available-in-vscode-webview-react


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('super-debug-window is now active!');
	vscode.window.showInformationMessage('Super Debug Window is now active!');

	const provider = new SuperCallStackProvider(context.extensionUri);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider(SuperCallStackProvider.viewType, provider));
	context.subscriptions.push(vscode.debug.onDidStartDebugSession(session => {
		vscode.window.showInformationMessage('Super Debug Window - Debug session started: ', session.name);
		console.log('Debug session started: ', session.name);
	}));

	context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(session => {
		vscode.window.showInformationMessage('Super Debug Window - Debug session terminated: ', session.name);
		console.log('Debug session terminated: ', session.name);
	}));

	// https://stackoverflow.com/questions/73264131/i-am-developing-vs-code-extension-and-i-need-to-capture-the-call-stack-records-a
	vscode.debug.registerDebugAdapterTrackerFactory('*', {
		createDebugAdapterTracker(session: vscode.DebugSession) {
			return {
				onWillReceiveMessage: m => onDAPRequest(provider, m),
				onDidSendMessage: m => onDAPResponse(provider, m)
			};
		}
	});
}

// This method is called when your extension is deactivated
export function deactivate() { }

function onDAPRequest(provider: SuperCallStackProvider, message: any) {
	//console.log("> ", message); //message.type, message.command)
	console.log(`> ${JSON.stringify(message)}`);
}

function onDAPResponse(provider: SuperCallStackProvider, message: any) {
	if (message.type === 'response' && message.command === 'stackTrace') {
		message.body.stackFrames.forEach((frame: any) => {
		});

		provider.updateCallStack(message.body.stackFrames);
	}

	//console.log("< ", message); //.type, message.command, message.body)
	console.log(`< ${JSON.stringify(message)}`);
}


class SuperCallStackProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'super-debug-window.callStack';

	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
	) { }

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

		/*
		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'colorSelected':
					{
						vscode.window.showInformationMessage('Hello');
						vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
						break;
					}
				case 'addcolor':
					{
						console.log('add color');
						vscode.window.showInformationMessage('addcolor');
						break;
					}
				default:
					{
						console.log('Hello');
						vscode.window.showInformationMessage('Hello');
						break;
					}
			}
		});
		*/
	}

	public updateCallStack(stackFrames: any) {
		if (this._view) {
			this._view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
			this._view.webview.postMessage({ type: 'updateCallStack', value: stackFrames });
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'main.js'));

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
				<table id="resizeMe" class="table">
					<thead>
						<tr>
							<th>No.</th>
							<th>First name</th>
							<th>Last name</th>
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

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
