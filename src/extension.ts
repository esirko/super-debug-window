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
	const superCallStackProvider = new SuperCallStackProvider(context.extensionUri);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider(SuperCallStackProvider.viewType, superCallStackProvider, { webviewOptions: { retainContextWhenHidden: true } })); // TODO: retainContextWhenHidden isn't recommended because it's expensive. See https://code.visualstudio.com/api/extension-guides/webview#persistence
	context.subscriptions.push(vscode.debug.onDidStartDebugSession(session => {
		vscode.window.showInformationMessage('Super Debug Window - Debug session started: ', session.name);
		superCallStackProvider.onDebugSessionStarted();
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
				onWillReceiveMessage: m => onDAPRequest(superCallStackProvider, m),
				onDidSendMessage: m => onDAPResponse(superCallStackProvider, m)
			};
		}
	});
}

// This method is called when your extension is deactivated
export function deactivate() { }

function onDAPRequest(provider: vscode.WebviewViewProvider, message: any) {
	//console.log("> ", message); //message.type, message.command)
	//console.log(`> ${JSON.stringify(message)}`);
	requestMessages.push(message);
}

function onDAPResponse(provider: vscode.WebviewViewProvider, responseMessage: any) {
	if (responseMessage.type === 'response') {
		// Find the request message corresponding to this response.
		const requestMessage = requestMessages.find(msg => msg.seq === responseMessage.request_seq);
		if (requestMessage) {
			requestMessages.splice(requestMessages.indexOf(requestMessage), 1);
			// switch statement for different types of responses
			switch (responseMessage.command) {
				case 'stackTrace':
					console.log(`>>> Received Stack Trace: {"request":${JSON.stringify(requestMessage)},"response":${JSON.stringify(responseMessage)}}`);
					(provider as SuperCallStackProvider).updateCallStack(requestMessage, responseMessage);
					break;
				case 'threads':
					console.log(`>>> Received Threads: ${JSON.stringify(requestMessage)} : ${JSON.stringify(responseMessage)}`);
					break;
				case 'scopes':
					console.log(`>>> Received Scopes: ${JSON.stringify(requestMessage)} : ${JSON.stringify(responseMessage)}`);
					break;
				case 'variables':
					console.log(`>>> Received Variables: ${JSON.stringify(requestMessage)} : ${JSON.stringify(responseMessage)}`);
					break;
				default:
					console.log(`>>> Received Unhandled: ${responseMessage.command}`);
					break;
			}
		} else {
			console.error(`>>> Received response with unknown request ID: ${responseMessage.request_seq}`);
		}
	}

	/*
	if (responseMessage.type === 'response' && responseMessage.command === 'stackTrace') {
		responseMessage.body.stackFrames.forEach((frame: any) => {
		});

		(provider as SuperCallStackProvider).updateCallStack(responseMessage.body.stackFrames);
	}

	//console.log("< ", message); //.type, message.command, message.body)
	console.log(`< ${JSON.stringify(responseMessage)}`);
	*/
}

// Global array of messages
const requestMessages: any[] = [];

class SuperCallStackProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'super-debug-window.callStack';
	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
	) { }

	private request_seq_0 = 0;
	private cachedResponses: any[] = [];

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

	public onDebugSessionStarted() {
		this.request_seq_0 = 0;
		this.cachedResponses = [];
	}

	public updateCallStack(request: any, response: any) {
		if (this._view) {
			this._view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders

			// Here's the strategy to handle out-of-order call stack responses, based on my guesses about how the DAP works:
			// If startFrame == 0, then we are at the top of the call stack, so clear the previous call stack first. 
			// 		Keep track of the request_seq and call it request_seq_0.
			// 		If there are any entries in cachedResponses, take any that have their request_seq greater than request_seq_0 and re-apply them to the new call stack. Clear cachedResponses.
			// If startFrame > 0 and request_seq > request_seq_0, append to the previous call stack. Pay attention to the indices.
			// 		Keep track of the request_seq, and the stackFrames, and append them to an array cachedResponses.
			if (request.arguments.startFrame === 0) {
				this._view.webview.postMessage({ type: 'updateCallStack', clear: true, stackFrames: response.body.stackFrames });
				this.request_seq_0 = request.seq;
				for (let i = 0; i < this.cachedResponses.length; i++) {
					if (this.cachedResponses[i].request_seq > this.request_seq_0) {
						this._view.webview.postMessage({ type: 'updateCallStack', clear: false, stackFrames: this.cachedResponses[i].stackFrames });
					}
				}
				this.cachedResponses = [];
			} else if (request.seq > this.request_seq_0) {
				this.cachedResponses.push({ request_seq: request.seq, stackFrames: response.body.stackFrames });
				this._view.webview.postMessage({ type: 'updateCallStack', clear: false, stackFrames: response.body.stackFrames });
			}
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
