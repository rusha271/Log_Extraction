let fileContent = null;

async function readFile(fileInput) {
    return new Promise((resolve, reject) => {
        if (fileInput?.files.length > 0) {
            const reader = new FileReader();
            reader.onload = (e) => {
                fileContent = e.target.result;
                resolve();
            };
            reader.onerror = () => reject(new Error("Failed to read the file."));
            reader.readAsText(fileInput.files[0]);
        } else {
            reject(new Error("Please select a file."));
        }
    });
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

document.getElementById("logForm")?.addEventListener("submit", async function (event) {
    event.preventDefault();
    
    // Get form values
    const inputType = document.getElementById('inputTypeSelector').value;
    const formElements = {
        startTime: document.getElementById("starttime").value,
        endTime: document.getElementById("endtime").value,
        logType: document.getElementById("type").value,
        timeIndex: document.getElementById("timeIndex")?.value || '0',
        requestIndex: document.getElementById("requestIndex")?.value || '4',
        sepratorType: document.getElementById("sepratorType").value,
        fileInput: document.getElementById("fileInput"),
        searchText: document.getElementById("searchText").value || " "
    };

    // Validate date range based on input type
    const dateValidation = validateDateRange(formElements.startTime, formElements.endTime, inputType);
    if (!dateValidation.valid) {
        alert(dateValidation.message);
        return;
    }

    // Validate indices
    const indexValidation = validateIndices(formElements.timeIndex, formElements.requestIndex);
    if (!indexValidation.valid) {
        alert(indexValidation.message);
        return;
    }

    // Validate file input
    if (!formElements.fileInput || formElements.fileInput.files.length === 0) {
        alert("Please select a log file.");
        return;
    }

    // Create form data
    const formData = new FormData();
    formData.append("file", formElements.fileInput.files[0]);
    formData.append("startTime", inputType === 'time' ? formElements.startTime.split('T')[1] : formElements.startTime);
    formData.append("endTime", inputType === 'time' ? formElements.endTime.split('T')[1] : formElements.endTime);
    formData.append("logType", formElements.logType);
    formData.append("timeIndex", formElements.timeIndex);
    formData.append("requestIndex", formElements.requestIndex);
    formData.append("sepratorType", formElements.sepratorType);
    formData.append("searchText", formElements.searchText);

    const loadingSpinner = document.getElementById("loadingSpinner");
    
    try {
        loadingSpinner.style.display = "block";

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
            alert(text); // Show the debug info to the user
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
        
        await readFile(formElements.fileInput);
        alert("File processed and downloaded successfully!");
    } catch (error) {
        alert(`Error processing logs: ${error.message}`);
    } finally {
        loadingSpinner.style.display = "none";
    }
});

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