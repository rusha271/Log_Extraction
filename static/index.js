/* TODO : 1. Chunking Method Implementation 
	    a.) Here DO Take the Last Chunk Value if the Data is stop in the middle and data is loss is not Last Feed Line then 
            take the pervious one {Extended the chunk size}
	    b.) For the edge cases for 	Errro with Multiline and Encrpted Data with large paragrapgh 

	  2. Add the functionality for the table that can handle the edge cases for file and the table 
         [ENCRPTED DATA -> Tooo Large Text and Another is ERROR with to handle the multi line]
	
	  3. Make changes in the Table Improvision Needed 
          	

*/


/* ======================================================================================================== 
	Here the Functionality is to create the table from AG GRID API using Diffrent parmetrs in take 
	parameters : Page Size , Theme , Search Text From the Filiterd Data 
                 timeIndex & requestIndex -> Where is the indices of of Time and Log Type is presnted in the File 
                 Separtor -> Which type of seprartor does file contain
   ======================================================================================================== */




// Initial Declaration 
let fileContent = null;
let gridApi;  

// 🤝Theme definitions
const THEMES = {
    alpine: {
        name: 'Alpine',
        gridClass: 'ag-theme-alpine',
        backgroundColor: '#FFFFFF',
        textColor: '#000000'
    },
    quartz: {
        name: 'Quartz',
        gridClass: 'ag-theme-alpine-dark',
        backgroundColor: '#1a1b1e',
        textColor: '#FFFFFF'
    },
    material: {
        name: 'Material',
        gridClass: 'ag-theme-material',
        backgroundColor: '#FAFAFA',
        textColor: '#333333'
    }
};


// 🤝 This function is For Logs Colors When it Display 
function logTypeStyler(params, theme) {
    const colors = {
        alpine: {
            Error: '#FF0000',
            INFO: '#FFFF00',
            default: '#ADD8E6'
        },
        quartz: {
            ERROR: '#FF0000',
            INFO: '#FFFF00',
            default: '#ADD8E6'
        },
        material: {
            ERROR: '#FF0000',
            INFO: '#FFFF00',
            default: '#ADD8E6'
        }
    };
    
    const themeColors = colors[theme] || colors.alpine;
    return { 
        backgroundColor: themeColors[params.value.toLowerCase()] || '#FFFFFF',
        color: theme === 'quartz' ? '#FFFFFF' : '#000000'
    };
}



// 🤝 This is Function which Return's the The Format For my Date and Time Column in The Table 
function formatDateTime(datetimePart) {
    // Previous formatDateTime implementation remains the same
    if (/^\d{14}$/.test(datetimePart)) {
        const year = datetimePart.substring(0, 4);
        const month = datetimePart.substring(4, 6);
        const day = datetimePart.substring(6, 8);
        const hour = datetimePart.substring(8, 10);
        const minute = datetimePart.substring(10, 12);
        const second = datetimePart.substring(12, 14);
        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }

    if (/^\d{6}$/.test(datetimePart)) {
        const hour = datetimePart.substring(0, 2);
        const minute = datetimePart.substring(2, 4);
        const second = datetimePart.substring(4, 6);
        return `${hour}:${minute}:${second}`;
    }

    console.warn(`Invalid datetime or time format: ${datetimePart}`);
    return 'Invalid DateTime';
}


// 🤝 Create toolbar HTML
function createToolbar(container, currentTheme, rowCount) {
    const toolbarHtml = `
        <div class="toolbar" style="margin-bottom: 15px; display: flex; gap: 10px; align-items: center;">
            <div class="data-size">
                <label>Data Size:</label>
                <select id="pageSize" class="toolbar-select">
                    <option value="10">10 Rows</option>
                    <option value="20" selected>20 Rows</option>
                    <option value="50">50 Rows</option>
                    <option value="100">100 Rows</option>
                </select>
            </div>
            <div class="theme-selector">
                <label>Theme:</label>
                <select id="themeSelector" class="toolbar-select">
                    ${Object.keys(THEMES).map(theme => `
                        <option value="${theme}" ${theme === currentTheme ? 'selected' : ''}>
                            ${THEMES[theme].name}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="search-box" style="flex-grow: 1;">
                <input type="text" id="searchBox" 
                       placeholder="Search across all columns..." 
                       style="width: 100%; padding: 5px;">
            </div>
            <div class="row-count">
                Total Rows: ${rowCount}
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforebegin', toolbarHtml);
}



// 🤝 This function is used to hide extra details if i want the detail which is hidden we can hover over it and can see the full detail

function contentRenderer(params) {
    const maxLength = 100;
    const content = params.value || '';
    const theme = localStorage.getItem('gridTheme') || 'alpine';
    const ellipsisColor = theme === 'quartz' ? '#888' : '#666';
    
    return content.length > maxLength 
        ? `${content.substring(0, maxLength)}<span style="color: ${ellipsisColor};">...</span>` 
        : content;
}


// 🤝 This is helper function which is used in cells to take up to that value 

function dateComparator(filterLocalDateAtMidnight, cellValue) {
    const cellDate = new Date(cellValue);
    if (cellDate < filterLocalDateAtMidnight) return -1;
    if (cellDate > filterLocalDateAtMidnight) return 1;
    return 0;
}

function formatDateTime(datetimePart, timeIndex) {
    if (!datetimePart) return '';

    if (timeIndex === 0) {
        // If it's a date-time format
        const year = datetimePart.slice(0, 4);
        const month = datetimePart.slice(4, 6);
        const day = datetimePart.slice(6, 8);
        const hour = datetimePart.slice(8, 10);
        const minute = datetimePart.slice(10, 12);
        const second = datetimePart.slice(12, 14);

        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    } else {
        // If it's a time format (HH:MM:SS)
        const hour = datetimePart.slice(0, 2);
        const minute = datetimePart.slice(2, 4);
        const second = datetimePart.slice(4, 6);

        return `${hour}:${minute}:${second}`;
    }
}

// 💻 The main backbone of table to show all the details using the file  

function parseLogEntries(logData, timeIndex, requestIndex) {
    const entries = [];
    let currentEntry = null;

    const timestampRegEx = /^(\d{4}\d{2}\d{2}\d{2}\d{2}\d{2})\|/;  // Regex for timestamp format
    const lines = logData.split('\n');

    for (const line of lines) {
        if (timestampRegEx.test(line)) {
            if (currentEntry) entries.push(currentEntry);

            const parts = line.split(separator="|"); // Use dynamic separator
            const datetimePart = parts[timeIndex] || '';
            const formattedDateTime = formatDateTime(datetimePart, timeIndex);

            // Determine the logType dynamically from the requestIndex
            let logType = 'INFO'; // Default log type
            if (parts[requestIndex]) {
                const logTypeValue = parts[requestIndex].trim();
                if (logTypeValue.includes('[Error')) {
                    logType = 'ERROR';
                } else {
                    logType = logTypeValue || 'INFO';
                }
            }

            const contentParts = parts.filter((_, idx) => 
                idx !== timeIndex && idx !== requestIndex
            );

            currentEntry = {
                datetime: formattedDateTime || 'Invalid DateTime',
                logType: logType,
                content: contentParts.join(separator).trim()
            };
        } else if (currentEntry) {
            currentEntry.content += `\n${line.trim()}`;
            if (line.includes('[Error')) {
                currentEntry.logType = 'ERROR';
            }
        }
    }

    if (currentEntry) entries.push(currentEntry);
    return entries;
}



// ⭐ The async Function make promise that it will return the value here it is chunked File

async function readFile(fileInput) {
    return new Promise((resolve, reject) => {
        if (fileInput?.files.length > 0) {
            const reader = new FileReader();
            reader.onload = (e) => {
                fileContent = e.target.result;
                resolve(fileContent);
            };
            reader.onerror = () => reject(new Error("Failed to read the file."));
            reader.readAsText(fileInput.files[0]);
        } else {
            reject(new Error("Please select a file."));
        }
    });
}





//🤖 In this function this wait until my other function doesn't response it for Viewing Log Table in the HTML Page
// This will trigger until i click the button for showing the logs 

async function tableShow(logData) {
    const logForm = document.getElementById("logForm");
    if (!logForm) return;

    const startIndexElem = document.getElementById("startIndex");
    const indexRequestElem = document.getElementById("indexRequest");
    
    const timeIndex = startIndexElem ? parseInt(startIndexElem.value) - 1 : 0;
    const requestIndex = indexRequestElem ? parseInt(indexRequestElem.value) - 1 : 3;

    // Hide form and clear previous grid
    logForm.style.display;
    const gridContainer = document.querySelector('#gridContainer');
    gridContainer.innerHTML = '<div class="ag-theme-alpine" style="height: 600px; width: 100%;"></div>';


    // 1.) From Here we are define The Rows Value How we Will Insert what is the functionality using file values
    // Parse log entries
    const entries = parseLogEntries(logData, timeIndex, requestIndex);

    // Extract unique log types from the entries
    const logTypes = Array.from(new Set(entries.map(entry => entry.logType.toUpperCase()))); // Unique log types

    // Slice the logTypes array based on requestIndex
    const selectedLogTypes = logTypes.slice(0, requestIndex + 1);

    const rowData = entries.map((entry, index) => ({
        id: index + 1,
        datetime: entry.datetime,
        logType: entry.logType,
        content: entry.content
    }));

    let currentTheme = localStorage.getItem('gridTheme') || 'alpine';


    // 2.) Defining the Columns :  Column definitions with enhanced filtering
    const columnDefs = [
        { 
            headerName: "Log Line", 
            field: "id", 
            sortable: true, 
            width: 120,
            filter: 'agNumberColumnFilter'
        },
        { 
            headerName: "Date & Time", 
            field: "datetime", 
            sortable: true, 
            width: 100,
            filter: 'agDateColumnFilter',
            filterParams: {
                comparator: dateComparator,
                browserDatePicker: true
            }
        },
        { 
            headerName: "Log Type", 
            field: "logType", 
            sortable: true, 
            width: 100,
            filter: 'agSetColumnFilter',
            cellStyle: params => logTypeStyler(params, currentTheme, selectedLogTypes),
            filterParams: {
                values: selectedLogTypes  // Use selectedLogTypes in the filter
            }
        },
        { 
            headerName: "Content", 
            field: "content", 
            wrapText: true, 
            autoHeight: true, 
            flex: 1,
            filter: 'agTextColumnFilter',
            floatingFilter: true,
            cellRenderer: contentRenderer,
            tooltipValueGetter: params => params.value,
            filterParams: {
                filterOptions: ['contains', 'startsWith', 'endsWith'],
                defaultOption: 'contains'
            }
        }
    ];

    // 3.) grid options => Here i have Defined my grid 
    const gridOptions = {
        columnDefs: columnDefs,
        rowData: rowData,
        pagination: true,
        paginationPageSize: 20,
        defaultColDef: {
            resizable: true,
            filter: true,
            floatingFilter: true,
            sortable: true,
            minWidth: 100
        },
        enableCellTextSelection: true,
        copyHeadersToClipboard: true,
        rowSelection: 'multiple',
        suppressRowClickSelection: true,
        onGridReady: params => {
            window.gridApi = params.api;
            window.columnApi = params.columnApi;
            params.api.sizeColumnsToFit();
        },
        getRowStyle: params => ({
            backgroundColor: params.node.rowIndex % 2 === 0 ? 
                (currentTheme === 'quartz' ? '#2d2d2d' : '#f5f5f5') : 
                (currentTheme === 'quartz' ? '#1a1b1e' : '#ffffff')
        })
    };


    // Create grid and toolbar
    const eDiv = document.querySelector('.ag-theme-alpine');
    createToolbar(eDiv, currentTheme, rowData.length);
    const gridApi = agGrid.createGrid(eDiv, gridOptions);

    // Theme change handler
    document.getElementById('themeSelector').addEventListener('change', function(e) {
        const newTheme = e.target.value;
        currentTheme = newTheme;
        localStorage.setItem('gridTheme', newTheme);
        
        eDiv.className = THEMES[newTheme].gridClass;
        document.body.style.backgroundColor = THEMES[newTheme].backgroundColor;
        document.body.style.color = THEMES[newTheme].textColor;
        
        gridApi.refreshCells({ force: true });
    });

    // Page size handler
    document.getElementById('pageSize').addEventListener('change', function(e) {
        gridApi.paginationSetPageSize(Number(e.target.value));
    });

    // Search handler
    document.getElementById('searchBox').addEventListener('input', function(e) {
        gridApi.setQuickFilter(e.target.value);
    });
}




/* ======================================================================================================== 
	From Here the Another Functionality to sending the data of the form to the 
	frontend to backend in the python and send the filtered data as Log file 
	parameters : inputTypeSelector -> for Date and Time Format
		     starttime & endtime -> start time and end time in the file to select the log 
		     type -> is the type of log from the data 
		     timeIndex & requestIndex -> This are indices where my time and log will be presented 
		     sepratorType -> The separator are used to separate data | , 
		     fileInput -> Get the file from the user using fileReader API 
		     searchText -> TO find the particular text from the file in the filtered one 
   ======================================================================================================== */



// This will send the data from Frontend to backend using POST method 
// 🤖💻 Backbone of sending data 
async function handleLogFormSubmit(event) {
    event.preventDefault();

    const loadingSpinner = document.getElementById("loadingSpinner");
    loadingSpinner.style.display = "block"; // Show spinner at the beginning

    // Determine which button was clicked
    const submitButton = event.submitter?.name;
    if (!submitButton) {
        loadingSpinner.style.display = "none"; // Hide spinner if no button detected
        alert("Unknown submit button.");
        return;
    }

    // Get form elements
    const formElements = {
        inputTypeSelector: document.getElementById('inputTypeSelector'),
        starttime: document.getElementById("starttime"),
        endtime: document.getElementById("endtime"),
        type: document.getElementById("type"),
        timeIndex: document.getElementById("timeIndex"),
        requestIndex: document.getElementById("requestIndex"),
        sepratorType: document.getElementById("sepratorType"),
        fileInput: document.getElementById("fileInput"),
        searchText: document.getElementById("searchText")
    };

    // Get form values
    const inputType = formElements.inputTypeSelector.value;
    const formDataValues = {
        startTime: formElements.starttime.value,
        endTime: formElements.endtime.value,
        logType: formElements.type.value,
        timeIndex: formElements.timeIndex?.value || '0',
        requestIndex: formElements.requestIndex?.value || '4',
        sepratorType: formElements.sepratorType.value,
        fileInput: formElements.fileInput,
        searchText: formElements.searchText.value || " "
    };

    // Validate date range
    const dateValidation = validateDateRange(formDataValues.startTime, formDataValues.endTime, inputType);
    if (!dateValidation.valid) {
        loadingSpinner.style.display = "none"; // Hide spinner after validation error
        alert(dateValidation.message);
        return;
    }

    // Validate indices
    const indexValidation = validateIndices(formDataValues.timeIndex, formDataValues.requestIndex);
    if (!indexValidation.valid) {
        loadingSpinner.style.display = "none"; // Hide spinner after validation error
        alert(indexValidation.message);
        return;
    }

    // Validate file input
    if (!formDataValues.fileInput || formDataValues.fileInput.files.length === 0) {
        loadingSpinner.style.display = "none"; // Hide spinner after validation error
        alert("Please select a log file.");
        return;
    }

    // Create form data
    const formData = new FormData();
    formData.append("file", formDataValues.fileInput.files[0]);
    formData.append("startTime", inputType === 'time' ? formDataValues.startTime.split('T')[1] : formDataValues.startTime);
    formData.append("endTime", inputType === 'time' ? formDataValues.endTime.split('T')[1] : formDataValues.endTime);
    formData.append("logType", formDataValues.logType);
    formData.append("timeIndex", formDataValues.timeIndex);
    formData.append("requestIndex", formDataValues.requestIndex);
    formData.append("sepratorType", formDataValues.sepratorType);
    formData.append("searchText", formDataValues.searchText);

    try {
        const response = await fetch("/fetch_logs", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const blob = await response.blob();
        const text = await blob.text();

        // Check if the response contains an error message
        if (text.startsWith("No logs match")) {
            loadingSpinner.style.display = "none"; // Hide spinner after error
            alert(text);
            return;
        }

        // Determine which button was clicked
        if (submitButton === 'processLogs') {
            // Download logs as a file
            const startFormatted = formatTime(formDataValues.startTime, inputType);
            const endFormatted = formatTime(formDataValues.endTime, inputType);
            const fileName = `log_${startFormatted}_${endFormatted}_${formDataValues.logType}.log`;

            const link = document.createElement("a");
            link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(link.href);

            await readFile(formDataValues.fileInput);
            alert("File processed and downloaded successfully!");
        } else if (submitButton === 'tableLogs') {
            // Show logs in a table
            tableShow(text);
        }
    } catch (error) {
        loadingSpinner.style.display = "none"; // Hide spinner after error
        alert(`Error processing logs: ${error.message}`);
    } finally {
        loadingSpinner.style.display = "none"; // Hide spinner after completion
    }
}




// 🤝 This is helper function which is used to validate the date it should exceed the time limit or any other wrong time range

function validateDateRange(startTime, endTime, inputType) {
    if (!startTime || !endTime) {
        return { valid: false, message: 'Please enter both start and end times.' };
    }

    if (inputType === 'time') {
        // For time-only inputs, no need to validate dates
        return { valid: true };
    }

    // For datetime inputs, validate the full date and time
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { valid: false, message: 'Please enter valid dates.' };
    }

    if (end < start) {
        return { valid: false, message: 'End time must be after start time.' };
    }

    return { valid: true };
}



// 🤝 This is helper function to validate the indexing of form means if user inputs -1 then it should be accept that  

function validateIndices(timeIndex, requestIndex) {
    if (timeIndex === '' && requestIndex === '') {
        return { valid: true }; // Both empty means use defaults
    }

    const timeIdx = parseInt(timeIndex);
    const reqIdx = parseInt(requestIndex);

    if (timeIndex !== '' && (isNaN(timeIdx) || timeIdx < 0)) {
        return { valid: false, message: 'Time index must be a non-negative number.' };
    }

    if (requestIndex !== '' && (isNaN(reqIdx) || reqIdx < 0)) {
        return { valid: false, message: 'Request index must be a non-negative number.' };
    }

    return { valid: true };
}


// 🤝 This helper function  which extract the particular "date data" from the form and send it 

function formatTime(dateString, inputType) {
    const date = new Date(dateString);
    if (inputType === 'time') {
        // Extract only the time portion
        return `${String(date.getHours()).padStart(2, '0')}_${String(date.getMinutes()).padStart(2, '0')}_${String(date.getSeconds()).padStart(2, '0')}`;
    } else {
        // Include both date and time
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}_${String(date.getMinutes()).padStart(2, '0')}_${String(date.getSeconds()).padStart(2, '0')}`;
    }
}





// 🤝 This is helper function if user inputs the datetime or time then it will change in the display of input of start and end time but it changes HTML DOM 

document.getElementById('inputTypeSelector')?.addEventListener('change', function () {
    const inputType = this.value;
    const startTimeInput = document.getElementById('starttime');
    const endTimeInput = document.getElementById('endtime');

    if (inputType === 'time') {
        startTimeInput.type = 'time';
        endTimeInput.type = 'time';
    } else {
        startTimeInput.type = 'datetime-local';
        endTimeInput.type = 'datetime-local';
    }

    startTimeInput.step = '1';
    endTimeInput.step = '1';
});
   


// 🤝 This is also change the DOM Objects 

document.getElementById('type').addEventListener('change', function() {
    const customLogTypeContainer = document.getElementById('customLogTypeContainer');
    if (this.value === 'custom') {
        customLogTypeContainer.style.display = 'block';
    } else {
        customLogTypeContainer.style.display = 'none';
    }
});
	

// This is event handler whenever the submit button is clicked the data is taken from html
document.getElementById("logForm")?.addEventListener("submit", handleLogFormSubmit);