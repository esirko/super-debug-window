// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { on } from 'events';
import * as vscode from 'vscode';
import { SuperCallStackProvider } from './callstack-pane';
import { SuperVariablesProvider } from './variables-pane';
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
		//vscode.window.showInformationMessage('Super Debug Window - Debug session started: ', session.name);
		superCallStackProvider.onDebugSessionStarted();
		console.log('Debug session started: ', session.name);
	}));
	const superVariablesProvider = new SuperVariablesProvider(context.extensionUri);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider(SuperVariablesProvider.viewType, superVariablesProvider, { webviewOptions: { retainContextWhenHidden: true } }));

	context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(session => {
		//vscode.window.showInformationMessage('Super Debug Window - Debug session terminated: ', session.name);
		console.log('Debug session terminated: ', session.name);
	}));

	// https://stackoverflow.com/questions/73264131/i-am-developing-vs-code-extension-and-i-need-to-capture-the-call-stack-records-a
	vscode.debug.registerDebugAdapterTrackerFactory('*', {
		createDebugAdapterTracker(session: vscode.DebugSession) {
			// Note: session can be accessed via vscode.debug.activeDebugSession later
			return {
				onWillReceiveMessage: m => onDAPRequest(m),
				onDidSendMessage: m => onDAPResponse(superCallStackProvider, superVariablesProvider, m)
			};
		}
	});

}

// This method is called when your extension is deactivated
export function deactivate() { }

function onDAPRequest(message: any) {
	console.log(`-> Request  [${message.seq}] ${isRequestUnhandled(message.command) ? "" : "[unhandled] "}${message.command}`, message); //message.type, message.command)
	//console.log(`> ${JSON.stringify(message)}`);
	requestMessages.push(message);
}

function isRequestUnhandled(message: string) {
	const handledRequests = [
		'stackTrace',
		'threads',
		'scopes',
		'variables'
	];
	return handledRequests.includes(message);
}

function onDAPResponse(superCallStackProvider: SuperCallStackProvider, superVariablesProvider: SuperVariablesProvider, responseMessage: any) {
	if (responseMessage.type === 'response') {
		// Find the request message corresponding to this response.
		const requestMessage = requestMessages.find(msg => msg.seq === responseMessage.request_seq);
		if (requestMessage) {
			requestMessages.splice(requestMessages.indexOf(requestMessage), 1);
			// switch statement for different types of responses
			console.log(`<- Response [${responseMessage.request_seq}] ${isRequestUnhandled(responseMessage.command) ? "" : "[unhandled] "}${responseMessage.command}`, responseMessage);
			switch (responseMessage.command) {
				case 'stackTrace':
					//console.log(`>>> ${responseMessage.request_seq} Received Stack Trace: {"request":${JSON.stringify(requestMessage)},"response":${JSON.stringify(responseMessage)}}`);
					superCallStackProvider.updateCallStack(requestMessage, responseMessage);
					break;
				case 'threads':
					//console.log(`>>> ${responseMessage.request_seq} Received Threads: ${JSON.stringify(requestMessage)} : ${JSON.stringify(responseMessage)}`);
					superCallStackProvider.updateThreads(requestMessage, responseMessage);
					break;
				case 'scopes':
					//console.log(`>>> ${responseMessage.request_seq} Received Scopes: ${JSON.stringify(requestMessage)} : ${JSON.stringify(responseMessage)}`);
					superVariablesProvider.updateScopes(requestMessage, responseMessage);
					break;
				case 'variables':
					//console.log(`>>> ${responseMessage.request_seq} Received Variables: ${JSON.stringify(requestMessage)} : ${JSON.stringify(responseMessage)}`);
					//console.log(`>>> ${responseMessage.request_seq} Received Variables: ${JSON.stringify(requestMessage)} : ${JSON.stringify(responseMessage)}`);
					superVariablesProvider.updateVariables(requestMessage, responseMessage);
					break;
				default:
					//console.log(`        Unhandled: ${responseMessage.seq}, ${responseMessage.request_seq}: ${responseMessage.command} `, responseMessage);
					//console.log(`        Unhandled: ${JSON.stringify(requestMessage)} : ${JSON.stringify(responseMessage)}`);
					break;
			}
		} else {
			console.error(`>>> Received response with unknown request ID: ${responseMessage.request_seq}`);
		}
	}
}

// Global array of messages
const requestMessages: any[] = [];

