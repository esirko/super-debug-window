
(function () {
    //@ts-check
    // <--- not sure what this is but it was originally outside the function. Then sometimes the debugger would refuse to start. For some reason moving it here solves that problem.
    // This script will be run within the webview itself
    // It cannot access the main VS Code APIs directly.
    const vscode = acquireVsCodeApi();

    // Resizable table code from https://www.exeideas.com/2021/11/resizable-columns-of-table-javascript.html
    document.addEventListener('DOMContentLoaded', function () {
        const createResizableTable = function (table) {
            const cols = table.querySelectorAll('th');
            [].forEach.call(cols, function (col) {
                // Add a resizer element to the column
                const resizer = document.createElement('div');
                resizer.classList.add('resizer');

                // Set the height
                resizer.style.height = `${table.offsetHeight}px`;

                col.appendChild(resizer);

                createResizableColumn(col, resizer);
            });
        };

        const createResizableColumn = function (col, resizer) {
            let x = 0;
            let w = 0;

            const mouseDownHandler = function (e) {
                x = e.clientX;

                const styles = window.getComputedStyle(col);
                w = parseInt(styles.width, 10);

                document.addEventListener('mousemove', mouseMoveHandler);
                document.addEventListener('mouseup', mouseUpHandler);

                resizer.classList.add('resizing');
            };

            const mouseMoveHandler = function (e) {
                const dx = e.clientX - x;
                col.style.width = `${w + dx}px`;
            };

            const mouseUpHandler = function () {
                resizer.classList.remove('resizing');
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            };

            resizer.addEventListener('mousedown', mouseDownHandler);
        };

        createResizableTable(document.getElementById('callStackTable'));
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'updateCallStack':
                {
                    updateTable(message.clear, message.stackFrames);
                    const threadSelect = document.querySelector('#threads'); 
                    threadSelect.value = message.threadId;
                    break;
                }
            case 'updateThreads':
                {
                    const threads = message.threads;
                    const threadSelect = document.querySelector('#threads');
                    threadSelect.textContent = ''; // Remove all previous elements ("simple and effective way to remove all rows from a table in Javascript" - Copilot)
                    for (const thread of threads) {
                        const newoption = document.createElement('option');
                        newoption.textContent = thread.name;
                        newoption.value = thread.id;
                        threadSelect.appendChild(newoption);
                    }
                    break;
                }

        }
    });

    const threadSelect = document.querySelector('#threads');
    threadSelect.addEventListener('change', () => {
        vscode.postMessage({
            command: 'changeThread',
            threadId: threadSelect.value,
        });
    });

    function updateTable(clear, frames) {
        const tbody = document.querySelector('#callStackTable tbody');
        if (clear) {
            tbody.textContent = ''; // Remove all previous elements ("simple and effective way to remove all rows from a table in Javascript" - Copilot)
        }
        for (const frame of frames) {
            // Create a table row that you can double-click on to jump to the source code
            const newrow = document.createElement('tr');
            newrow.addEventListener('dblclick', () => {
                vscode.postMessage({
                    command: 'gotoSourceLine',
                    file: frame.source.path,
                    line: frame.line,
                });
            });
            const newcell1 = document.createElement('td');
            newcell1.textContent = frame.name;
            const newcell2 = document.createElement('td');
            newcell2.textContent = frame.source.name + ':' + frame.line;
            newcell2.title = frame.source.path + ':' + frame.line;
            if (frame.presentationHint === 'subtle') {
                newcell1.classList.add("subtle-callstack-frame")
                newcell2.classList.add("subtle-callstack-frame")
            }
            newrow.appendChild(newcell1);
            newrow.appendChild(newcell2);
            tbody.appendChild(newrow);
        }
    }
}());
