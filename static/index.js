let fileContent = null;

async function readFileInChunks(fileInput, onChunkRead, chunkSize = 10 * 1024 * 1024) { // 10 MB chunks
    return new Promise((resolve, reject) => {
        if (fileInput?.files.length > 0) {
            const file = fileInput.files[0];
            const fileSize = file.size;
            let offset = 0;

            const reader = new FileReader();

            reader.onload = (e) => {
                const chunk = e.target.result;
                onChunkRead(chunk, offset, fileSize);
                offset += chunk.byteLength;

                if (offset < fileSize) {
                    readNextChunk();
                } else {
                    resolve();
                }
            };

            reader.onerror = () => reject(new Error("Failed to read the file."));

            function readNextChunk() {
                const slice = file.slice(offset, offset + chunkSize);
                reader.readAsArrayBuffer(slice);
            }

            readNextChunk();
        } else {
            reject(new Error("Please select a file."));
        }
    });
}

function debounce(func, delay = 300) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}

document.getElementById("logForm")?.addEventListener("submit", async function (event) {
    event.preventDefault();

    // Get form values
    const inputType = document.getElementById('inputTypeSelector').value;
    const formElements = {
        startTime: document.getElementById("starttime").value,
        endTime: document.getElementById("endtime").value,
        logType: document.getElementById("type").value,
        startIndex: document.getElementById("startIndex")?.value, // Default to 1
        requestIndex: document.getElementById("indexRequest")?.value, // Default to 4
        sepratorType: document.getElementById("sepratorType").value,
        fileInput: document.getElementById("fileInput"),
        searchText: document.getElementById("searchText").value || " "
    };

    // Validate file input
    if (!formElements.fileInput || formElements.fileInput.files.length === 0) {
        alert("Please select a log file.");
        return;
    }

    const loadingSpinner = document.getElementById("loadingSpinner");

    try {
        loadingSpinner.style.display = "block";

        // Create a FormData object to send metadata
        const metadata = new FormData();
        metadata.append("startTime", inputType === 'time' ? formElements.startTime.split('T')[1] : formElements.startTime);
        metadata.append("endTime", inputType === 'time' ? formElements.endTime.split('T')[1] : formElements.endTime);
        metadata.append("logType", formElements.logType);
        metadata.append("startIndex", formElements.startIndex); // Updated key to match server
        metadata.append("indexRequest", formElements.requestIndex); // Updated key to match server
        metadata.append("separatorType", formElements.sepratorType); // Corrected typo
        metadata.append("searchText", formElements.searchText);
        metadata.append("step", "metadata"); // Add step parameter

        // Send metadata first
        const metadataResponse = await fetch("/fetch_logs", {
            method: "POST",
            body: metadata,
        });

        if (!metadataResponse.ok) {
            throw new Error(`Server error: ${metadataResponse.status}`);
        }

        // Get session ID from metadata response
        const sessionID = await metadataResponse.text();

        // Send file in chunks
        await readFileInChunks(formElements.fileInput, async (chunk, offset, fileSize) => {
            const formData = new FormData();
            formData.append("fileChunk", new Blob([chunk]), formElements.fileInput.files[0].name);
            formData.append("offset", offset.toString());
            formData.append("fileSize", fileSize.toString());
            formData.append("sessionID", sessionID); // Include session ID
            formData.append("step", "chunk"); // Add step parameter

            const response = await fetch("/fetch_logs", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
        });

        // Finalize processing
        const finalFormData = new FormData();
        finalFormData.append("sessionID", sessionID); // Include session ID
        finalFormData.append("step", "finalize"); // Add step parameter

        const finalResponse = await fetch("/fetch_logs", {
            method: "POST",
            body: finalFormData,
        });

        if (!finalResponse.ok) {
            throw new Error(`Server error: ${finalResponse.status}`);
        }

        const blob = await finalResponse.blob();
        const text = await blob.text();

        // Check if the response contains an error message
        if (text.startsWith("No logs match")) {
            alert(text);
            return;
        }

        // Create download link
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
});

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