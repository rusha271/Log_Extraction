let fileContent = null;

let gridApi;  

async function readFileInChunks(fileInput, onChunkRead, chunkSize = 10 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        if (!fileInput?.files?.length) return reject("No file selected");
        const file = fileInput.files[0];
        let offset = 0; // Tracks the byte offset in the file
        let leftover = new Uint8Array(0); // Carries over bytes between chunks
        const reader = new FileReader();
        const decoder = new TextDecoder('utf-8');

        reader.onload = async (e) => {
            try {
                const buffer = new Uint8Array(e.target.result);
                // Combine leftover bytes with the new chunk
                const combined = new Uint8Array(leftover.length + buffer.length);
                combined.set(leftover);
                combined.set(buffer, leftover.length);

                let newlinePos = -1;
                // Find the last newline (0x0A) to split lines correctly
                for (let i = combined.length - 1; i >= 0; i--) {
                    if (combined[i] === 0x0A) { // \n character
                        newlinePos = i;
                        break;
                    }
                }

                let processedBytes, newLeftover;
                if (newlinePos !== -1) {
                    // Check for \r before \n to handle \r\n line endings
                    const lineEnd = (newlinePos > 0 && combined[newlinePos - 1] === 0x0D) ? newlinePos - 1 : newlinePos;
                    processedBytes = combined.subarray(0, newlinePos + 1);
                    newLeftover = combined.subarray(newlinePos + 1);
                } else {
                    processedBytes = new Uint8Array(0);
                    newLeftover = combined;
                }

                // Decode processed bytes including any previous partial characters
                const processedString = decoder.decode(processedBytes, { stream: true });
                if (processedString) {
                    await onChunkRead(processedString, offset, file.size);
                    offset += processedBytes.length; // Update offset by bytes processed
                }

                leftover = newLeftover;

                // Check if all bytes have been read
                if (offset + leftover.length >= file.size) {
                    // Decode any remaining bytes
                    const finalString = decoder.decode(leftover);
                    if (finalString) {
                        await onChunkRead(finalString, offset, file.size);
                    }
                    resolve();
                } else {
                    readNextChunk();
                }
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject("File read error");

        function readNextChunk() {
            const slice = file.slice(offset, offset + chunkSize);
            reader.readAsArrayBuffer(slice);
        }

        readNextChunk();
    });
}


// Helper function to format time
function formatTime(timeString, inputType) {
    if (inputType === 'time') {
        return timeString.split('T')[1].replace(/:/g, '-');
    }
    return timeString.replace(/:/g, '-').replace(/T/g, '_');
}

function validateIndices(timeIndex, requestIndex) {
    if (timeIndex === '' && requestIndex === '') {
        return { valid: true }; // Both empty means use defaults
    }

    const timeIdx = parseInt(timeIndex);
    const reqIdx = parseInt(requestIndex);

    if (timeIndex !== '' && isNaN(timeIdx) || timeIdx < 0) {
        return { valid: false, message: 'Time index must be a non-negative number.' };
    }

    if (requestIndex !== '' && isNaN(reqIdx) || reqIdx < 0) {
        return { valid: false, message: 'Request index must be a non-negative number.' };
    }

    return { valid: true };
}

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


// Handle input type changes
document.getElementById('inputTypeSelector')?.addEventListener('change', function () {
    const inputType = this.value;
    const startTimeInput = document.querySelector('input[name="startTimeInput"]');
    const endTimeInput = document.querySelector('input[name="endTimeInput"]');

    if (!startTimeInput || !endTimeInput) return;

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

$(document).ready(function() {
    $('#type').select2({
        placeholder: 'Select Log Type',
        allowClear: true
    });

    $('#type').on('change', function() {
        const customContainer = $('#customLogTypeContainer');
        if ($(this).val() === 'custom') {
            customContainer.show();
        } else {
            customContainer.hide();
        }
    });
});

document.getElementById('type').addEventListener('change', function() {
    const customLogTypeContainer = document.getElementById('customLogTypeContainer');
    if (this.value === 'custom') {
        customLogTypeContainer.style.display = 'block';
    } else {
        customLogTypeContainer.style.display = 'none';
    }
});


async function handleLogFormSubmit() {
    // Get form values
    const inputType = document.getElementById('inputTypeSelector').value;
    const formElements = {
        startTime: document.getElementById("starttime").value,
        endTime: document.getElementById("endtime").value,
        logType: document.getElementById("type").value,
        startIndex: document.getElementById("startIndex")?.value, 
        requestIndex: document.getElementById("indexRequest")?.value, 
        sepratorType: document.getElementById("sepratorType").value,
        fileInput: document.getElementById("fileInput"),
        searchText: document.getElementById("searchText").value || " "
    };

    if (!formElements.fileInput || formElements.fileInput.files.length === 0) {
        alert("Please select a log file.");
        return;
    }

    const loadingSpinner = document.getElementById("loadingSpinner");
    loadingSpinner.style.display = "block";

    try {
        // Step 1: Send metadata
        const metadata = new FormData();
        metadata.append("startTime", inputType === 'time' ? formElements.startTime.split('T')[1] : formElements.startTime);
        metadata.append("endTime", inputType === 'time' ? formElements.endTime.split('T')[1] : formElements.endTime);
        metadata.append("logType", formElements.logType);
        metadata.append("startIndex", formElements.startIndex);
        metadata.append("indexRequest", formElements.requestIndex);
        metadata.append("separatorType", formElements.sepratorType);
        metadata.append("searchText", formElements.searchText);
        metadata.append("step", "metadata");

        const metadataResponse = await fetch("/fetch_logs", {
            method: "POST",
            body: metadata,
        });

        if (!metadataResponse.ok) {
            throw new Error(`Server error: ${metadataResponse.status}`);
        }

        const sessionID = await metadataResponse.text();

        // Step 2: Send file in chunks
        await readFileInChunks(formElements.fileInput, async (chunk, offset, fileSize) => {
            const formData = new FormData();
            formData.append("fileChunk", new Blob([chunk]), formElements.fileInput.files[0].name);
            formData.append("offset", offset.toString());
            formData.append("fileSize", fileSize.toString());
            formData.append("sessionID", sessionID);
            formData.append("step", "chunk");

            const response = await fetch("/fetch_logs", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
        });

        // Step 3: Finalize processing
        const finalFormData = new FormData();
        finalFormData.append("sessionID", sessionID);
        finalFormData.append("step", "finalize");

        const finalResponse = await fetch("/fetch_logs", {
            method: "POST",
            body: finalFormData,
        });

        if (!finalResponse.ok) {
            throw new Error(`Server error: ${finalResponse.status}`);
        }

        const blob = await finalResponse.blob();
        const text = await blob.text();

        if (text.startsWith("No logs match")) {
            alert(text);
            return;
        }

        // Step 4: Create download link
        const startFormatted = formatTime(formElements.startTime, inputType);
        const endFormatted = formatTime(formElements.endTime, inputType);
        const fileName = `log_${startFormatted}_${endFormatted}_${formElements.logType}.log`;

        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(link.href);

        alert("File processed and downloaded successfully!");
    } catch (error) {
        alert(`Error processing logs: ${error.message}`);
    } finally {
        loadingSpinner.style.display = "none";
    }
}



function LogEntrieparses(logData, timeIndex, requestIndex, separator) {
    const entries = [];
    let currentEntry = null;
    let lineNumber = 0;

    // Enhanced timestamp regex to support both formats
    const timestampRegEx = new RegExp(`^\\d{14}\\${separator}|^\\d{2}:\\d{2}:\\d{2}\\${separator}`);
    
    // Split the log data into lines and process sequentially
    const lines = logData.split('\n').filter(line => line.trim());

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (timestampRegEx.test(line)) {
            // Save previous entry if exists
            if (currentEntry) {
                currentEntry.lineEnd = lineNumber - 1;
                entries.push(currentEntry);
            }

            lineNumber = i + 1;
            const parts = line.split(separator);

            // Process timestamp
            const datetimePart = parts[timeIndex] || '';
            const formattedDateTime = formatDateTime(datetimePart, timeIndex);

            // Process log type with enhanced error detection
            let logType = 'INFO';
            if (parts[requestIndex]) {
                const logTypeValue = parts[requestIndex].trim();
                logType = detectLogType(logTypeValue);
            }

            // Process content while maintaining sequential order
            const contentParts = [];
            for (let j = 0; j < parts.length; j++) {
                if (j !== timeIndex && j !== requestIndex) {
                    contentParts.push(parts[j]);
                }
            }

            currentEntry = {
                lineStart: lineNumber,
                lineEnd: lineNumber,
                datetime: formattedDateTime || 'Invalid DateTime',
                logType: logType,
                content: contentParts.join(separator).trim(),
                sequenceNumber: entries.length + 1
            };
        } else if (currentEntry) {
            // Append continuation lines while maintaining order
            lineNumber = i + 1;
            currentEntry.lineEnd = lineNumber;
            currentEntry.content += `\n${line}`;
            
            // Check for error indicators in continuation lines
            if (isErrorLine(line)) {
                currentEntry.logType = 'ERROR';
            }
        }
    }

    // Don't forget the last entry
    if (currentEntry) {
        currentEntry.lineEnd = lineNumber;
        entries.push(currentEntry);
    }

    return entries;
}

// Helper function to detect log type
function detectLogType(logTypeValue) {
    const errorIndicators = ['[Error', 'ERROR', 'Error:', 'Exception', 'FATAL'];
    const warningIndicators = ['[Warn', 'WARN', 'Warning:', 'CAUTION'];
    
    logTypeValue = logTypeValue.toUpperCase();
    
    if (errorIndicators.some(indicator => logTypeValue.includes(indicator.toUpperCase()))) {
        return 'ERROR';
    }
    if (warningIndicators.some(indicator => logTypeValue.includes(indicator.toUpperCase()))) {
        return 'WARNING';
    }
    return logTypeValue || 'INFO';
}

// Helper function to check for error indicators in continuation lines
function isErrorLine(line) {
    const errorIndicators = ['[Error', 'ERROR', 'Error:', 'Exception', 'FATAL'];
    return errorIndicators.some(indicator => line.includes(indicator));
}



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
                <label style="color: black;">Data Size:</label>
                <select id="pageSize" class="toolbar-select">
                    <option value="10">10 Rows</option>
                    <option value="20" selected>20 Rows</option>
                    <option value="50">50 Rows</option>
                    <option value="100">100 Rows</option>
                </select>
            </div>
            <div class="theme-selector">
                <label style="color: black;">Theme:</label>
                <select id="themeSelector" class="toolbar-select">
                    ${Object.keys(THEMES).map(theme => `
                        <option value="${theme}" ${theme === currentTheme ? 'selected' : ''}>
                            ${THEMES[theme].name}
                        </option>
                    `).join('')}
                </select>
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

async function tableShow(fileInput) {
    if (!fileInput?.files?.length) {
        alert("No file selected");
        return;
    }

    const logForm = document.getElementById("logForm");
    if (!logForm) return;

    // Get form values and validate
    const timeIndex = parseInt(document.getElementById("startIndex")?.value) - 1;
    const requestIndex = parseInt(document.getElementById("indexRequest")?.value) - 1;
    const separator = document.getElementById("sepratorType")?.value || '|';
    const startTimeVal = document.getElementById('starttime').value;
    const endTimeVal = document.getElementById('endtime').value;
    const inputType = document.getElementById('inputTypeSelector').value;

    if (!startTimeVal || !endTimeVal) {
        alert('Please enter both start and end times.');
        return;
    }

    if (isNaN(timeIndex) || isNaN(requestIndex)) {
        alert("Please ensure all index values are filled correctly.");
        return;
    }

    const gridContainer = document.querySelector('#gridContainer');
    const loadingSpinner = document.getElementById("loadingSpinner");
    
    loadingSpinner.style.display = "block";
    gridContainer.innerHTML = '<div class="ag-theme-alpine" style="height: 600px; width: 100%;"></div>';

    let entries = [];
    const currentTheme = localStorage.getItem('gridTheme') || 'alpine';

    try {
        // Parse the user's time inputs
        let userStart, userEnd;
        if (inputType === 'time') {
            // For time-only comparison, use a dummy date
            userStart = new Date(`1970-01-01T${startTimeVal}`);
            userEnd = new Date(`1970-01-01T${endTimeVal}`);
        } else {
            userStart = new Date(startTimeVal);
            userEnd = new Date(endTimeVal);
        }

        // Validate time inputs
        if (isNaN(userStart.getTime()) || isNaN(userEnd.getTime())) {
            throw new Error('Invalid start or end time format');
        }

        if (userEnd < userStart) {
            throw new Error('End time must be after start time');
        }

        // Read and parse file
        await readFileInChunks(fileInput, (chunkData) => {
            const chunkEntries = LogEntrieparses(chunkData, timeIndex, requestIndex, separator);
            entries.push(...chunkEntries);
        }, 10 * 1024 * 1024);

        if (entries.length === 0) {
            throw new Error("No log entries found");
        }

        // Filter entries based on time range
        const filteredEntries = entries.filter(entry => {
            let entryDate;
            if (inputType === 'time') {
                // For time-only comparison, extract time part and use dummy date
                const timePart = entry.datetime.split(' ')[1] || entry.datetime;
                entryDate = new Date(`1970-01-01T${timePart}`);
            } else {
                // For datetime comparison, parse the full datetime
                entryDate = new Date(entry.datetime.replace(' ', 'T'));
            }

            if (isNaN(entryDate.getTime())) {
                console.warn(`Invalid date format found: ${entry.datetime}`);
                return false;
            }

            return entryDate >= userStart && entryDate <= userEnd;
        });

        if (filteredEntries.length === 0) {
            throw new Error("No logs found in the specified time range");
        }

        // Process filtered entries for display
        const rowData = filteredEntries.map((entry, index) => ({
            id: index + 1,
            datetime: entry.datetime,
            logType: entry.logType.toUpperCase(),
            content: entry.content
        }));

        // Extract unique log types from filtered entries
        const logTypes = Array.from(new Set(filteredEntries.map(entry => entry.logType.toUpperCase())));

        // Column definitions
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
                width: 180,
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
                width: 120,
                filter: 'agSetColumnFilter',
                cellStyle: params => logTypeStyler(params, currentTheme),
                filterParams: {
                    values: logTypes
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
                tooltipValueGetter: params => params.value
            }
        ];

        // Grid options
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

        // Initialize grid and toolbar
        const eDiv = gridContainer.querySelector('.ag-theme-alpine');
        createToolbar(eDiv, currentTheme, rowData.length);
        const gridApi = agGrid.createGrid(eDiv, gridOptions);

        // Show grid container
        gridContainer.style.display = 'block';

        // Set up event listeners
        document.getElementById('themeSelector').addEventListener('change', function(e) {
            const newTheme = e.target.value;
            localStorage.setItem('gridTheme', newTheme);
            eDiv.className = THEMES[newTheme].gridClass;
            document.body.style.backgroundColor = THEMES[newTheme].backgroundColor;
            document.body.style.color = THEMES[newTheme].textColor;
            gridApi.refreshCells({ force: true });
        });

        document.getElementById('pageSize').addEventListener('change', function(e) {
            gridApi.paginationSetPageSize(Number(e.target.value));
        });

    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        loadingSpinner.style.display = "none";
    }
}


// Event listener setup
document.addEventListener('DOMContentLoaded', function() {
    // Form submission handler
    document.getElementById("logForm")?.addEventListener("submit", function(event) {
        event.preventDefault();
        const fileInput = document.getElementById("fileInput");
        const clickedButton = event.submitter.id;

        if (!fileInput?.files?.length) {
            alert("Please select a log file.");
            return;
        }

        if (clickedButton === "processLogs") {
            handleLogFormSubmit();
        } else if (clickedButton === "tableLogs") {
            tableShow(fileInput);
        }
    });

    // Initial theme setup
    const currentTheme = localStorage.getItem('gridTheme') || 'alpine';
    document.body.style.backgroundColor = THEMES[currentTheme].backgroundColor;
    document.body.style.color = THEMES[currentTheme].textColor;
});