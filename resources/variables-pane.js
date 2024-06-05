
(function () {
    //@ts-check
    // <--- not sure what this is but it was originally outside the function. Then sometimes the debugger would refuse to start. For some reason moving it here solves that problem.
    // This script will be run within the webview itself
    // It cannot access the main VS Code APIs directly.
    const vscode = acquireVsCodeApi();

    // Resizable table code from https://www.exeideas.com/2021/11/resizable-columns-of-table-javascript.html
    const createResizableTable = function (table) {
        const cols = table.querySelectorAll('th');
        [].forEach.call(cols, function (col) {
            // Add a resizer element to the column
            const resizer = document.createElement('div');
            resizer.classList.add('resizer');

            // Set the height
            resizer.style.height = `${table.offsetHeight}px`; // If the table hasn't been added to the DOM yet, this will be zero, which will cause headaches

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

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'updateScopes':
                {
                    const sbody = document.querySelector('#scopes');
                    sbody.textContent = '';
                    for (const scope of message.scopes) {
                        const h2 = document.createElement('h2');
                        h2.textContent = scope.name;
                        sbody.appendChild(h2);
                        const table = document.createElement('table');
                        table.id = 'scopes-' + scope.variablesReference;
                        table.className = 'table';
                        table.innerHTML = `<thead><tr><th>Variable</th><th>Value</th><th>Type</th></tr></thead><tbody></tbody>`;
                        sbody.appendChild(table);
                        createResizableTable(table); // must happen after the table is added to the DOM so that the height can be used to set the resizer height
                    }
                    break;
                }
            case 'updateVariables':
                {
                    const tbody = document.querySelector('#scopes-' + message.variablesReferenceId + ' tbody');
                    tbody.textContent = '';
                    for (const variable of message.variables) {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `<td>${variable.name}</td><td>${variable.value}</td><td>${variable.type}</td>`;
                        tbody.appendChild(tr);
                    }
                    break;
                }
        }
    });

}());
