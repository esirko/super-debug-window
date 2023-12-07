
(function () {
    //@ts-check
    // <--- not sure what this is but it was originally outside the function. Then sometimes the debugger would refuse to start. For some reason moving it here solves that problem.
    // This script will be run within the webview itself
    // It cannot access the main VS Code APIs directly.
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState() || { colors: [] };

    /** @type {Array<{ value: string }>} */
    let colors = oldState.colors;

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

        createResizableTable(document.getElementById('resizeMe'));
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'updateCallStack':
                {
                    updateTable(message.value);
                    break;
                }

        }
    });

    function updateTable(stack) {
        const tbody = document.querySelector('#resizeMe tbody');
        tbody.textContent = ''; // Remove all previous elements ("simple and effective way to remove all rows from a table in Javascript" - Copilot)
        for (const frame of stack) {
            //const table = document.querySelector('#resizeMe');
            const newrow = document.createElement('tr');
            const newcell = document.createElement('td');
            newcell.textContent = frame.name;
            newrow.appendChild(newcell);
            const newcell2 = document.createElement('td');
            newcell2.textContent = frame.source.path;
            //newcell2.style.backgroundColor = `#${colors[0].value}`;
            newrow.appendChild(newcell2);
            const newcell3 = document.createElement('td');
            newcell3.textContent = frame.line
            newrow.appendChild(newcell3);
            tbody.appendChild(newrow);
        }
    }

}());
