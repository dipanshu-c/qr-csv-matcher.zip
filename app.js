class QRCSVMatcher {
    constructor() {
        this.csvData = [];
        this.csvHeaders = [];
        this.scanHistory = [];
        this.html5QrCode = null;
        this.isScanning = false;
        this.stats = {
            totalScans: 0,
            matches: 0,
            duplicates: 0
        };
        
        // Sample data from application requirements
        this.sampleData = {
            students: {
                headers: ["name", "student_id", "email", "phone", "department"],
                data: [
                    ["John Smith", "STU001", "john.smith@email.com", "9876543210", "Computer Science"],
                    ["Sarah Johnson", "STU002", "sarah.j@email.com", "9876543211", "Electrical Engineering"],
                    ["Mike Brown", "STU003", "mike.brown@email.com", "9876543212", "Mechanical Engineering"],
                    ["Anna Davis", "STU004", "anna.davis@email.com", "9876543213", "Civil Engineering"],
                    ["Tom Wilson", "STU005", "tom.wilson@email.com", "9876543214", "Information Technology"]
                ]
            },
            events: {
                headers: ["name", "ticket_id", "email", "phone", "status"],
                data: [
                    ["Alice Cooper", "TK001", "alice@email.com", "9876543215", "confirmed"],
                    ["Bob Martin", "TK002", "bob@email.com", "9876543216", "pending"],
                    ["Carol White", "TK003", "carol@email.com", "9876543217", "confirmed"],
                    ["David Lee", "TK004", "david@email.com", "9876543218", "cancelled"],
                    ["Eva Green", "TK005", "eva@email.com", "9876543219", "confirmed"]
                ]
            }
        };
        
        this.initializeApp();
    }

    initializeApp() {
        this.bindEvents();
        this.updateAppStatus('Ready to upload CSV file or load sample data');
        this.updateStats();
    }

    bindEvents() {
        // CSV upload
        document.getElementById('csvFile').addEventListener('change', (e) => this.handleCSVUpload(e));
        
        // Sample data buttons
        document.getElementById('loadStudentsBtn').addEventListener('click', () => this.loadSampleData('students'));
        document.getElementById('loadEventsBtn').addEventListener('click', () => this.loadSampleData('events'));
        
        // Scanner controls
        document.getElementById('startScannerBtn').addEventListener('click', () => this.startScanner());
        document.getElementById('stopScannerBtn').addEventListener('click', () => this.stopScanner());
        
        // Control buttons
        document.getElementById('resetBtn').addEventListener('click', () => this.resetAll());
        document.getElementById('clearHistoryBtn').addEventListener('click', () => this.clearHistory());
        document.getElementById('downloadHistoryBtn').addEventListener('click', () => this.downloadHistory());
        
        // Modal controls
        document.getElementById('closeErrorBtn').addEventListener('click', () => this.hideModal('errorModal'));
        document.getElementById('closeMatchBtn').addEventListener('click', () => this.hideModal('matchModal'));
    }

    loadSampleData(type) {
        const sample = this.sampleData[type];
        this.csvHeaders = sample.headers;
        this.csvData = sample.data;
        
        this.displayCSVData();
        this.updateCSVStatus(`Sample ${type} data loaded: ${this.csvData.length} records`, 'success');
        this.updateAppStatus(`Sample ${type} data loaded - Ready to scan QR codes`);
        
        // Clear file input
        document.getElementById('csvFile').value = '';
    }

    async handleCSVUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            this.showError('Please select a valid CSV file');
            return;
        }

        this.showLoading(true);
        
        try {
            const text = await this.readFileAsText(file);
            const result = Papa.parse(text, {
                header: false,
                skipEmptyLines: true,
                dynamicTyping: false
            });

            if (result.errors.length > 0) {
                throw new Error('CSV parsing error: ' + result.errors[0].message);
            }

            if (result.data.length < 2) {
                throw new Error('CSV file must contain at least a header row and one data row');
            }

            this.csvHeaders = result.data[0];
            this.csvData = result.data.slice(1);
            
            this.displayCSVData();
            this.updateCSVStatus(`Successfully loaded: ${this.csvData.length} records`, 'success');
            this.updateAppStatus(`Custom CSV loaded with ${this.csvData.length} records - Ready to scan`);
            
        } catch (error) {
            this.updateCSVStatus(`Error: ${error.message}`, 'error');
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('File reading error'));
            reader.readAsText(file);
        });
    }

    displayCSVData() {
        const preview = document.getElementById('csvPreview');
        
        if (this.csvData.length === 0) {
            preview.classList.add('hidden');
            return;
        }

        const table = document.createElement('table');
        table.className = 'csv-table';
        
        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        this.csvHeaders.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create body with limited rows for preview
        const tbody = document.createElement('tbody');
        const displayRows = Math.min(this.csvData.length, 10);
        
        for (let i = 0; i < displayRows; i++) {
            const row = document.createElement('tr');
            this.csvData[i].forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell || '';
                row.appendChild(td);
            });
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        
        preview.innerHTML = '';
        preview.appendChild(table);
        
        if (this.csvData.length > 10) {
            const moreInfo = document.createElement('p');
            moreInfo.className = 'text-secondary text-center';
            moreInfo.textContent = `... and ${this.csvData.length - 10} more records`;
            preview.appendChild(moreInfo);
        }
        
        preview.classList.remove('hidden');
    }

    async startScanner() {
        if (this.csvData.length === 0) {
            this.showError('Please upload a CSV file or load sample data first');
            return;
        }

        try {
            this.showLoading(true);
            this.updateScannerStatus('Starting camera...', 'info');
            
            this.html5QrCode = new Html5Qrcode("qr-reader");
            
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };

            await this.html5QrCode.start(
                { facingMode: "environment" },
                config,
                (qrCodeMessage) => this.onScanSuccess(qrCodeMessage),
                (errorMessage) => {
                    // Silent error handling for continuous scanning
                }
            );

            this.isScanning = true;
            document.getElementById('startScannerBtn').classList.add('hidden');
            document.getElementById('stopScannerBtn').classList.remove('hidden');
            this.updateScannerStatus('Scanner active - Point camera at QR code', 'success');
            this.updateAppStatus('Scanner active - Ready to scan QR codes');
            
        } catch (error) {
            this.updateScannerStatus('Camera access failed', 'error');
            this.showError('Camera access denied or not available. Please check permissions.');
        } finally {
            this.showLoading(false);
        }
    }

    async stopScanner() {
        if (this.html5QrCode && this.isScanning) {
            try {
                await this.html5QrCode.stop();
                this.html5QrCode.clear();
                this.html5QrCode = null;
                this.isScanning = false;
                
                document.getElementById('startScannerBtn').classList.remove('hidden');
                document.getElementById('stopScannerBtn').classList.add('hidden');
                this.updateScannerStatus('Scanner stopped', 'info');
                this.updateAppStatus('Scanner stopped - Ready to restart');
            } catch (error) {
                console.error('Error stopping scanner:', error);
            }
        }
    }

    onScanSuccess(qrCodeMessage) {
        const validationResult = this.validateQRCode(qrCodeMessage);
        this.displayValidationResult(validationResult);
        this.addToHistory(validationResult);
        this.updateStats();
        
        // Brief pause before next scan
        if (this.html5QrCode && this.isScanning) {
            setTimeout(() => {
                this.updateScannerStatus('Scanner active - Point camera at QR code', 'success');
            }, 1500);
        }
    }

    validateQRCode(qrData) {
        const timestamp = new Date();
        this.stats.totalScans++;
        
        // Check for duplicate (same QR code scanned before)
        const previousScan = this.scanHistory.find(item => item.qrData === qrData);
        
        if (previousScan) {
            this.stats.duplicates++;
            return {
                qrData,
                timestamp,
                status: 'duplicate',
                message: 'QR code already scanned',
                previousScan: previousScan.timestamp,
                matchedRecord: previousScan.matchedRecord,
                matchType: previousScan.matchType,
                matchField: previousScan.matchField
            };
        }

        // Try different matching algorithms
        const matchingMethods = [
            { name: 'exact', func: this.exactMatch, priority: 1 },
            { name: 'caseInsensitive', func: this.caseInsensitiveMatch, priority: 2 },
            { name: 'email', func: this.emailMatch, priority: 3 },
            { name: 'phone', func: this.phoneMatch, priority: 4 },
            { name: 'partial', func: this.partialMatch, priority: 5 }
        ];

        // Sort by priority and try each method
        matchingMethods.sort((a, b) => a.priority - b.priority);

        for (const method of matchingMethods) {
            const match = method.func.call(this, qrData);
            if (match) {
                this.stats.matches++;
                return {
                    qrData,
                    timestamp,
                    status: 'found',
                    message: 'Match found in CSV data',
                    matchedRecord: match.record,
                    matchType: method.name,
                    matchField: match.field,
                    matchValue: match.value,
                    confidence: match.confidence || 100
                };
            }
        }

        return {
            qrData,
            timestamp,
            status: 'not-found',
            message: 'No matching record found',
            matchedRecord: null,
            matchType: null
        };
    }

    exactMatch(qrData) {
        for (let i = 0; i < this.csvData.length; i++) {
            for (let j = 0; j < this.csvData[i].length; j++) {
                const cellValue = String(this.csvData[i][j]).trim();
                if (cellValue === qrData.trim()) {
                    return {
                        record: this.csvData[i],
                        field: this.csvHeaders[j],
                        value: cellValue
                    };
                }
            }
        }
        return null;
    }

    caseInsensitiveMatch(qrData) {
        const lowerQR = qrData.toLowerCase().trim();
        for (let i = 0; i < this.csvData.length; i++) {
            for (let j = 0; j < this.csvData[i].length; j++) {
                const cellValue = String(this.csvData[i][j]).toLowerCase().trim();
                if (cellValue === lowerQR) {
                    return {
                        record: this.csvData[i],
                        field: this.csvHeaders[j],
                        value: this.csvData[i][j]
                    };
                }
            }
        }
        return null;
    }

    partialMatch(qrData) {
        const qrLower = qrData.toLowerCase().trim();
        for (let i = 0; i < this.csvData.length; i++) {
            for (let j = 0; j < this.csvData[i].length; j++) {
                const cellValue = String(this.csvData[i][j]).toLowerCase().trim();
                if (cellValue.includes(qrLower) || qrLower.includes(cellValue)) {
                    return {
                        record: this.csvData[i],
                        field: this.csvHeaders[j],
                        value: this.csvData[i][j]
                    };
                }
            }
        }
        return null;
    }

    emailMatch(qrData) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(qrData)) return null;

        for (let i = 0; i < this.csvData.length; i++) {
            for (let j = 0; j < this.csvData[i].length; j++) {
                const cellValue = String(this.csvData[i][j]).trim();
                if (emailRegex.test(cellValue) && cellValue.toLowerCase() === qrData.toLowerCase()) {
                    return {
                        record: this.csvData[i],
                        field: this.csvHeaders[j],
                        value: cellValue
                    };
                }
            }
        }
        return null;
    }

    phoneMatch(qrData) {
        const cleanQR = qrData.replace(/\D/g, '');
        if (cleanQR.length < 10) return null;

        for (let i = 0; i < this.csvData.length; i++) {
            for (let j = 0; j < this.csvData[i].length; j++) {
                const cellValue = String(this.csvData[i][j]);
                const cleanCell = cellValue.replace(/\D/g, '');
                if (cleanCell.length >= 10 && (cleanCell === cleanQR || cleanCell.includes(cleanQR) || cleanQR.includes(cleanCell))) {
                    return {
                        record: this.csvData[i],
                        field: this.csvHeaders[j],
                        value: cellValue
                    };
                }
            }
        }
        return null;
    }

    displayValidationResult(result) {
        const container = document.getElementById('validationResults');
        
        // Remove no-results message if present
        const noResults = container.querySelector('.no-results');
        if (noResults) {
            noResults.remove();
        }
        
        const resultElement = document.createElement('div');
        resultElement.className = `scan-result ${result.status}`;
        
        let statusIcon = '';
        let statusText = '';
        
        switch (result.status) {
            case 'found':
                statusIcon = '✅';
                statusText = 'Match Found';
                break;
            case 'not-found':
                statusIcon = '❌';
                statusText = 'No Match Found';
                break;
            case 'duplicate':
                statusIcon = '⚠️';
                statusText = 'Already Scanned';
                break;
        }

        let html = `
            <h3>${statusIcon} ${statusText}</h3>
            <div class="timestamp">${result.timestamp.toLocaleString()}</div>
            <div class="scan-data">
                <strong>Scanned QR Code:</strong><br>${result.qrData}
            </div>
        `;

        if (result.status === 'duplicate') {
            html += `
                <div class="scan-data">
                    <strong>Previously scanned:</strong> ${result.previousScan.toLocaleString()}
                </div>
            `;
        }

        if (result.matchedRecord) {
            html += `
                <div class="match-summary">
                    <h4>Matched Record Summary</h4>
                    <div class="match-field">
                        <span class="field-name">Match Type:</span>
                        <span class="field-value">${this.getMatchTypeDescription(result.matchType)}</span>
                    </div>
                    <div class="match-field">
                        <span class="field-name">Matched Field:</span>
                        <span class="field-value">${result.matchField}</span>
                    </div>
                    <div class="match-field">
                        <span class="field-name">Matched Value:</span>
                        <span class="field-value">${result.matchValue || result.qrData}</span>
                    </div>
            `;

            // Show first few fields as preview
            const previewFields = Math.min(3, this.csvHeaders.length);
            for (let i = 0; i < previewFields; i++) {
                html += `
                    <div class="match-field">
                        <span class="field-name">${this.csvHeaders[i]}:</span>
                        <span class="field-value">${result.matchedRecord[i] || 'N/A'}</span>
                    </div>
                `;
            }

            html += `
                    <button class="btn btn--outline btn--sm view-details-btn" onclick="window.qrMatcher.showMatchDetails(${this.scanHistory.length})">
                        View Full Details
                    </button>
                </div>
            `;
        }

        resultElement.innerHTML = html;
        
        // Insert at the beginning
        if (container.firstChild) {
            container.insertBefore(resultElement, container.firstChild);
        } else {
            container.appendChild(resultElement);
        }
        
        // Keep only the latest 3 results visible
        const results = container.querySelectorAll('.scan-result');
        if (results.length > 3) {
            for (let i = 3; i < results.length; i++) {
                results[i].remove();
            }
        }
    }

    showMatchDetails(historyIndex) {
        const result = this.scanHistory[historyIndex];
        if (!result || !result.matchedRecord) return;

        const modal = document.getElementById('matchModal');
        const content = document.getElementById('matchDetails');
        
        let html = `
            <dl class="match-details-grid">
                <dt>QR Code Content:</dt>
                <dd>${result.qrData}</dd>
                <dt>Match Type:</dt>
                <dd>${this.getMatchTypeDescription(result.matchType)}</dd>
                <dt>Matched Field:</dt>
                <dd>${result.matchField}</dd>
                <dt>Matched Value:</dt>
                <dd>${result.matchValue || result.qrData}</dd>
                <dt>Scanned Time:</dt>
                <dd>${result.timestamp.toLocaleString()}</dd>
        `;

        if (result.confidence && result.confidence < 100) {
            html += `
                <dt>Match Confidence:</dt>
                <dd>${result.confidence}%</dd>
            `;
        }

        html += '</dl>';

        html += `
            <h4>Complete Record Details</h4>
            <table class="record-table">
                <thead>
                    <tr>
                        <th>Field</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
        `;

        this.csvHeaders.forEach((header, index) => {
            const isMatchedField = header === result.matchField;
            const cellClass = isMatchedField ? 'matched-field' : '';
            html += `
                <tr>
                    <td class="${cellClass}">${header}</td>
                    <td class="${cellClass}">${result.matchedRecord[index] || 'N/A'}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        content.innerHTML = html;
        modal.classList.remove('hidden');
    }

    getMatchTypeDescription(matchType) {
        const descriptions = {
            exact: 'Exact Match - Perfect match with CSV field',
            caseInsensitive: 'Case Insensitive Match - Match ignoring case differences',
            partial: 'Partial Match - QR content found within CSV field',
            email: 'Email Match - Email format validation and match',
            phone: 'Phone Match - Phone number format match'
        };
        return descriptions[matchType] || matchType;
    }

    addToHistory(result) {
        this.scanHistory.unshift(result);
        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        const container = document.getElementById('scanHistory');
        
        if (this.scanHistory.length === 0) {
            container.innerHTML = '<p class="text-secondary">No scan history available</p>';
            return;
        }

        const historyHTML = this.scanHistory.map((item, index) => {
            let statusClass = '';
            let statusIcon = '';
            
            switch (item.status) {
                case 'found':
                    statusClass = 'status--success';
                    statusIcon = '✅';
                    break;
                case 'not-found':
                    statusClass = 'status--error';
                    statusIcon = '❌';
                    break;
                case 'duplicate':
                    statusClass = 'status--warning';
                    statusIcon = '⚠️';
                    break;
            }

            let matchInfo = '';
            if (item.matchedRecord && item.status !== 'duplicate') {
                matchInfo = `Matched: ${item.matchField} (${this.getMatchTypeDescription(item.matchType)})`;
            } else if (item.status === 'duplicate') {
                matchInfo = `Previous scan: ${item.previousScan.toLocaleString()}`;
            } else {
                matchInfo = 'No matching record found';
            }

            return `
                <div class="history-item">
                    <div class="history-content">
                        <div class="history-data">${item.qrData}</div>
                        <div class="history-match">${matchInfo}</div>
                    </div>
                    <div class="history-status">
                        <span class="status ${statusClass}">${statusIcon} ${item.message}</span>
                        <div class="history-time">${item.timestamp.toLocaleString()}</div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = historyHTML;
    }

    updateStats() {
        document.getElementById('totalScans').textContent = this.stats.totalScans;
        document.getElementById('matchCount').textContent = this.stats.matches;
        document.getElementById('duplicateCount').textContent = this.stats.duplicates;
    }

    clearHistory() {
        this.scanHistory = [];
        this.stats = { totalScans: 0, matches: 0, duplicates: 0 };
        this.updateHistoryDisplay();
        this.updateStats();
        
        // Reset results display
        const container = document.getElementById('validationResults');
        container.innerHTML = `
            <div class="no-results">
                <p class="text-secondary">No scans performed yet</p>
                <p class="text-secondary">Upload CSV data and start scanning QR codes</p>
            </div>
        `;
        
        this.updateAppStatus('Scan history cleared');
    }

    resetAll() {
        this.stopScanner();
        this.csvData = [];
        this.csvHeaders = [];
        this.clearHistory();
        
        document.getElementById('csvFile').value = '';
        document.getElementById('csvPreview').classList.add('hidden');
        
        this.updateCSVStatus('', '');
        this.updateAppStatus('All data cleared - Ready to start over');
    }

    downloadHistory() {
        if (this.scanHistory.length === 0) {
            this.showError('No scan history to download');
            return;
        }

        const csvContent = this.generateHistoryCSV();
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `qr_scan_history_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    generateHistoryCSV() {
        const headers = ['Timestamp', 'QR Data', 'Status', 'Message', 'Match Type', 'Matched Field', 'Matched Value'];
        const rows = this.scanHistory.map(item => [
            item.timestamp.toISOString(),
            `"${item.qrData}"`,
            item.status,
            `"${item.message}"`,
            item.matchType || '',
            item.matchField || '',
            item.matchValue || ''
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    updateAppStatus(message) {
        document.getElementById('app-status').textContent = message;
    }

    updateCSVStatus(message, type) {
        const statusElement = document.getElementById('csvStatus');
        statusElement.textContent = message;
        statusElement.className = `csv-status ${type}`;
        
        if (!message) {
            statusElement.className = 'csv-status';
        }
    }

    updateScannerStatus(message, type) {
        const statusElement = document.getElementById('scannerStatus');
        const statusClass = type ? `status--${type}` : 'status--info';
        statusElement.innerHTML = `<span class="status ${statusClass}">${message}</span>`;
    }

    showLoading(show) {
        const modal = document.getElementById('loadingModal');
        if (show) {
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorModal').classList.remove('hidden');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.qrMatcher = new QRCSVMatcher();
});

// Handle page visibility changes to stop scanner when page is hidden
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.qrMatcher && window.qrMatcher.isScanning) {
        window.qrMatcher.stopScanner();
    }
});