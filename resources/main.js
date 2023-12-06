
(function () {
    //@ts-check
    // <--- not sure what this is but it was originally outside the function. Then sometimes the debugger would refuse to start. For some reason moving it here solves that problem.
    // This script will be run within the webview itself
    // It cannot access the main VS Code APIs directly.
    const vscode = acquireVsCodeApi();
    vscode.postMessage({ type: 'Hello', value: 1 });

    const oldState = vscode.getState() || { colors: [] };

    /** @type {Array<{ value: string }>} */
    let colors = oldState.colors;

    updateColorList(colors);

    document.querySelector('.add-color-button').addEventListener('click', () => {
        addColor();
    });

    document.querySelector('.clear-colors-button').addEventListener('click', () => {
        clearColors();
    });

    // ----------------->

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






    // <----------------

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'addColor':
                {
                    addColor();
                    break;
                }
            case 'clearColors':
                {
                    clearColors();
                    break;
                }

        }
    });

    /**
     * @param {Array<{ value: string }>} colors
     */
    function updateColorList(colors) {
        const ul = document.querySelector('.color-list');
        ul.textContent = '';
        for (const color of colors) {
            const li = document.createElement('li');
            li.className = 'color-entry';

            const colorPreview = document.createElement('div');
            colorPreview.className = 'color-preview';
            colorPreview.style.backgroundColor = `#${color.value}`;
            colorPreview.addEventListener('click', () => {
                onColorClicked(color.value);
            });
            li.appendChild(colorPreview);

            const input = document.createElement('input');
            input.className = 'color-input';
            input.type = 'text';
            input.value = color.value;
            input.addEventListener('change', (e) => {
                const value = e.target.value;
                if (!value) {
                    // Treat empty value as delete
                    colors.splice(colors.indexOf(color), 1);
                } else {
                    color.value = value;
                }
                updateColorList(colors);
            });
            li.appendChild(input);

            ul.appendChild(li);
        }

        // table update
        const table = document.querySelector('#resizeMe');
        const tbody = document.querySelector('#resizeMe tbody');
        const newrow = document.createElement('tr');
        const newcell = document.createElement('td');
        newcell.textContent = 'test';
        newrow.appendChild(newcell);
        const newcell2 = document.createElement('td');
        newcell2.textContent = 'test2';
        newcell2.style.backgroundColor = `#${colors[0].value}`;
        newrow.appendChild(newcell2);
        const newcell3 = document.createElement('td');
        newcell3.textContent = `${colors[0].value}`;
        newrow.appendChild(newcell3);
        tbody.appendChild(newrow);
        table.appendChild(tbody);

        // Update the saved state
        vscode.setState({ colors: colors });
    }

    /** 
     * @param {string} color 
     */
    function onColorClicked(color) {
        vscode.postMessage({ type: 'colorSelected', value: color });
    }

    /**
     * @returns string
     */
    function getNewCalicoColor() {
        const colors = ['020202', 'f1eeee', 'a85b20', 'daab70', 'efcb99'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    function addColor() {
        vscode.postMessage({ type: 'addcolor', value: 1 });
        colors.push({ value: getNewCalicoColor() });
        updateColorList(colors);
    }

    function clearColors() {
        colors = [];
        updateColorList(colors);
    }
}());
