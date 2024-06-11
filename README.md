# super-debug-window README

This makes the call stack and variables window (when used for debugging) ... super.

## Features

- Using a WebView for the information in the call stack and variables window to allow for more robust visual customizations than the native TreeViews.


## Development

Open this repo in VS Code, and hit F5. It will launch a new instance of VS Code with the extension enabled.

To debug the UI, cmd-shift-P, then "Open Webview Developer Tools" ([Source](https://dzhavat.github.io/2020/11/12/easy-way-to-debug-a-webview-in-a-vscode-extension.html)). My code is in `<guid> / active-frame (index.html) / file+vscode-resource.vscode-cdn.net / <path>...`

To [publish](https://code.visualstudio.com/api/working-with-extensions/publishing-extension): increment version, then `vsce package && vsce publish`.

My [manage publisher page](https://marketplace.visualstudio.com/manage/publishers/esirko).

## Requirements


## Extension Settings


## Known Issues


## Release Notes

### 1.0.0


