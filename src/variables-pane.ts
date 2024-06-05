import * as vscode from 'vscode';
import { getNonce } from './util';

export class SuperVariablesProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'super-debug-window.variables';
	private _view?: vscode.WebviewView
	private _pendingUpdateScopes: any;
	private _pendingUpdateVariables: any;	

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

		// https://github.com/microsoft/vscode/issues/146330
		if (this._pendingUpdateScopes) {
			this.updateScopes(this._pendingUpdateScopes.request, this._pendingUpdateScopes.response);
			this._pendingUpdateScopes = undefined;
		}
		if (this._pendingUpdateVariables) {
			this.updateVariables(this._pendingUpdateVariables.request, this._pendingUpdateVariables.response);
			this._pendingUpdateVariables = undefined;
		}

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.command) {
				case 'getMoreInfoAboutVariable?':
					{
						break;
					}
				default:
					break;
			}
		});
	}

	public updateScopes(request: any, response: any) {
		if (this._view) {
			this._view.webview.postMessage({ type: 'updateScopes', scopes: response.body.scopes});
		} else {
			this._pendingUpdateScopes = { request: request, response: response };
		}
	}

	public updateVariables(request: any, response: any) {
		if (this._view) {
			let variables = response.body.variables;
			variables.sort((a: { name: string }, b: { name: string }) => (a.name > b.name) ? 1 : -1);

			this._view.webview.postMessage({ type: 'updateVariables', variablesReferenceId: request.arguments.variablesReference, variables: response.body.variables });
		} else {
			this._pendingUpdateVariables = { request: request, response: response };
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'variables-pane.js'));

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

				<title>Super variables</title>
			</head>
			<body>
				<div id="scopes"></div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}
