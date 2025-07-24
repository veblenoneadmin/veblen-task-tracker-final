// VEBLEN Task Tracker - Complete script.js
// Configuration - UPDATED WITH LOCAL API ENDPOINTS
const CONFIG = {
    // UPDATED: Use local API endpoints that proxy to n8n webhooks
    taskIntakeUrl: '/api/task-intake',          // Proxies to n8n taskintakewebhook
    taskUpdateUrl: '/api/task-update',          // Proxies to n8n task-update
    timeLoggerUrl: '/api/time-logger',          // Proxies to n8n timelogging
    reportLoggerUrl: '/api/report-logger',      // Proxies to n8n reportlogging
    taskRetrievalUrl: '/api/get-tasks',         // Proxies to n8n get-tasks
    imgbbApiKey: '679bd601ac49c50cae877fb240620cfe'
};

// WORKFLOW STATES - SIMPLIFIED
const WORKFLOW_STATES = {
    NOT_STARTED: 'not_started',
    WORKING: 'working', 
    ON_BREAK: 'on_break',
    FINISHED: 'finished'
};

// Progress attribute IDs for each company
const PROGRESS_ATTRIBUTES = {
    "CROWN REALITY": "eb943dd8-dd91-4620-a875-59bdeee59a1f",
    "LCMB GROUP": "4cff12df-fc0d-40aa-aade-e52161b37621",
    "NEWTECH TRAILERS": "f78f7f1b-ec1f-4f1b-972b-6931f6925373",
    "VEBLEN (Internal)": "05ba9bd9-6829-4049-8366-a1ec8d9281d4",
    "FLECK GROUP": "2f9594ea-c62d-4a15-b668-0cdf2f9162cd"
};

// State Management - SIMPLIFIED
let currentEmployee = null;
let workClockInterval = null;
let breakClockInterval = null;
let currentWorkSession = null;
let currentBreakSession = null;
let dailyShiftData = null;
let brisbaneClockInterval = null;
let currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
let shiftResetTime = null;
let availableTasks = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    console.log('🚀 Initializing VEBLEN Task Tracker...');
    
    // Initialize Brisbane clock first
    initializeBrisbaneClock();
    
    // Initialize override button
    initializeOverrideButton();
    
    // Load saved employee
    const savedEmployee = localStorage.getItem('selectedEmployee');
    if (savedEmployee) {
        document.getElementById('employeeSelect').value = savedEmployee;
        currentEmployee = savedEmployee;
        console.log('🔄 Loaded saved employee:', currentEmployee);
        loadEmployeeData();
    }

    // Set up event listeners
    document.getElementById('employeeSelect').addEventListener('change', handleEmployeeChange);
    document.getElementById('taskIntakeForm').addEventListener('submit', handleTaskIntake);
    document.getElementById('refreshTasksBtn').addEventListener('click', loadAssignedTasks);
    document.getElementById('dailyReportForm').addEventListener('submit', handleDailyReport);
    
    // SIMPLIFIED TIME CLOCK BUTTONS - PURE TIMER
    document.getElementById('startWorkBtn').addEventListener('click', handleStartWork);
    document.getElementById('breakBtn').addEventListener('click', handleBreak);
    document.getElementById('backToWorkBtn').addEventListener('click', handleResumeWork);
    document.getElementById('endWorkBtn').addEventListener('click', handleEndWork);

    // Image upload previews
    document.getElementById('taskImage').addEventListener('change', handleTaskImagePreview);
    document.getElementById('reportPhoto').addEventListener('change', handleReportPhotoPreview);

    // Set default date to today for report
    document.getElementById('reportDate').valueAsDate = new Date();
    
    // Initialize workflow state
    console.log('🔄 Initializing workflow state...');
    currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
    initializeWorkflowState();
    
    // Debug: Log button state after 1 second
    setTimeout(() => {
        const startBtn = document.getElementById('startWorkBtn');
        console.log('🔄 START button after init:', {
            exists: !!startBtn,
            disabled: startBtn ? startBtn.disabled : 'N/A',
            workflowState: currentWorkflowState,
            employee: currentEmployee
        });
    }, 1000);
}

// ============= BRISBANE CLOCK SYSTEM =============

function initializeBrisbaneClock() {
    console.log('🕐 Initializing Brisbane clock...');
    createBrisbaneClockDisplay();
    updateBrisbaneClock();
    brisbaneClockInterval = setInterval(updateBrisbaneClock, 1000);
}

function createBrisbaneClockDisplay() {
    const header = document.querySelector('.header');
    if (!header) {
        console.error('❌ Header not found for Brisbane clock');
        return;
    }
    
    const clockHTML = `
        <div id="brisbaneClockSection" class="brisbane-clock-section">
            <div class="brisbane-clock-container">
                <div class="local-time-display">
                    <div class="time-zone-label" id="localTimezoneLabel">🕐 Your Time (GMT+0)</div>
                    <div class="current-time local-time" id="localTime">--:--:--</div>
                    <div class="current-date" id="localDate">-- -- ----</div>
                </div>
                <div class="brisbane-time-display">
                    <div class="time-zone-label">🇦🇺 Brisbane Time</div>
                    <div class="current-time" id="brisbaneTime">--:--:--</div>
                    <div class="current-date" id="brisbaneDate">-- -- ----</div>
                </div>
                <div class="shift-reset-display">
                    <div class="reset-label">Next Shift Reset</div>
                    <div class="reset-countdown" id="resetCountdown">--:--:--</div>
                    <div class="reset-time" id="nextResetTime">Tomorrow at 9:00 AM</div>
                    <div class="work-start-notice" id="workStartNotice">🔴 Work starts at 9:00 AM your time</div>
                </div>
            </div>
        </div>
    `;
    
    header.insertAdjacentHTML('afterend', clockHTML);
    console.log('✅ Brisbane clock display created');
}

function updateBrisbaneClock() {
    const now = new Date();
    const brisbaneNow = new Date(now.toLocaleString("en-US", {timeZone: "Australia/Brisbane"}));
    
    updateLocalTime(now);
    
    const brisbaneTimeStr = brisbaneNow.toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit', 
        second: '2-digit',
        hour12: false
    });
    
    const brisbaneDateStr = brisbaneNow.toLocaleDateString('en-AU', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
    
    const brisbaneTimeEl = document.getElementById('brisbaneTime');
    const brisbaneDateEl = document.getElementById('brisbaneDate');
    
    if (brisbaneTimeEl) brisbaneTimeEl.textContent = brisbaneTimeStr;
    if (brisbaneDateEl) brisbaneDateEl.textContent = brisbaneDateStr;
    
    updateShiftResetCountdown(brisbaneNow, now);
}

function updateLocalTime(localNow) {
    const timeZoneShort = getTimezoneShort(localNow);
    
    const localTimeStr = localNow.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    
    const localDateStr = localNow.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
    });
    
    const localTimeElement = document.getElementById('localTime');
    const localDateElement = document.getElementById('localDate');
    const localTimezoneElement = document.getElementById('localTimezoneLabel');
    
    if (localTimeElement) localTimeElement.textContent = localTimeStr;
    if (localDateElement) localDateElement.textContent = localDateStr;
    if (localTimezoneElement) localTimezoneElement.textContent = `🕐 Your Time (${timeZoneShort})`;
}

function getTimezoneShort(date) {
    const timeZoneName = date.toLocaleDateString('en', {
        day: '2-digit',
        timeZoneName: 'short'
    }).substring(4);
    
    if (!timeZoneName || timeZoneName.length > 6) {
        const offset = -date.getTimezoneOffset();
        const hours = Math.floor(Math.abs(offset) / 60);
        const minutes = Math.abs(offset) % 60;
        const sign = offset >= 0 ? '+' : '-';
        return `GMT${sign}${hours.toString().padStart(2, '0')}${minutes > 0 ? ':' + minutes.toString().padStart(2, '0') : ''}`;
    }
    
    return timeZoneName;
}

function updateShiftResetCountdown(brisbaneNow, localNow) {
    const next9AM = new Date(brisbaneNow);
    next9AM.setHours(9, 0, 0, 0);
    
    if (brisbaneNow >= next9AM) {
        next9AM.setDate(next9AM.getDate() + 1);
    }
    
    shiftResetTime = next9AM;
    
    const timeDiff = next9AM.getTime() - brisbaneNow.getTime();
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    
    const countdownStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const resetTimeStr = next9AM.toLocaleDateString('en-AU', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    }) + ' at 9:00 AM';
    
    const localResetTime = new Date(next9AM.getTime());
    const localResetTimeStr = localResetTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    
    const countdownEl = document.getElementById('resetCountdown');
    const resetTimeEl = document.getElementById('nextResetTime');
    const workStartEl = document.getElementById('workStartNotice');
    
    if (countdownEl) countdownEl.textContent = countdownStr;
    if (resetTimeEl) resetTimeEl.textContent = resetTimeStr;
    if (workStartEl) workStartEl.textContent = `🔴 Work starts at ${localResetTimeStr} your time`;
    
    checkForShiftReset(brisbaneNow);
}

function checkForShiftReset(brisbaneNow) {
    const today9AM = new Date(brisbaneNow);
    today9AM.setHours(9, 0, 0, 0);
    
    const lastResetCheck = localStorage.getItem('lastShiftResetCheck');
    const lastResetDate = lastResetCheck ? new Date(lastResetCheck) : new Date(0);
    
    if (brisbaneNow >= today9AM && lastResetDate < today9AM) {
        performShiftReset();
        localStorage.setItem('lastShiftResetCheck', brisbaneNow.toISOString());
    }
}

function performShiftReset() {
    console.log('🔄 Performing automatic shift reset at 9 AM Brisbane time');
    
    currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
    clearWorkClockState();
    updateWorkflowButtonStates();
    saveWorkflowState();
    
    showToast('🌅 New shift day has begun! You can now start work.', 'info');
}

// ============= WORKFLOW STATE MANAGEMENT =============

function initializeWorkflowState() {
    console.log('🔄 initializeWorkflowState called');
    
    if (!currentEmployee) {
        console.log('🔄 No employee selected, setting to NOT_STARTED');
        currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
        updateWorkflowButtonStates();
        return;
    }
    
    const savedState = loadWorkflowState();
    
    if (savedState && savedState.state) {
        currentWorkflowState = savedState.state;
        console.log('🔄 Restored workflow state:', currentWorkflowState);
    } else {
        currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
        console.log('🔄 No saved state, defaulting to:', currentWorkflowState);
    }
    
    updateWorkflowButtonStates();
    saveWorkflowState();
}

function saveWorkflowState() {
    if (!currentEmployee) return;
    
    const workflowStateKey = `workflowState_${currentEmployee}`;
    const state = {
        state: currentWorkflowState,
        timestamp: new Date().toISOString(),
        employee: currentEmployee,
        shiftDate: new Date().toDateString()
    };
    
    localStorage.setItem(workflowStateKey, JSON.stringify(state));
}

function loadWorkflowState() {
    if (!currentEmployee) return null;
    
    const workflowStateKey = `workflowState_${currentEmployee}`;
    const saved = localStorage.getItem(workflowStateKey);
    
    if (saved) {
        try {
            const state = JSON.parse(saved);
            const stateDate = state.shiftDate;
            const today = new Date().toDateString();
            
            if (stateDate === today) {
                return state;
            } else {
                localStorage.removeItem(workflowStateKey);
                return null;
            }
        } catch (error) {
            console.error('Error loading workflow state:', error);
            localStorage.removeItem(workflowStateKey);
            return null;
        }
    }
    
    return null;
}

function updateWorkflowButtonStates() {
    const startBtn = document.getElementById('startWorkBtn');
    const breakBtn = document.getElementById('breakBtn'); 
    const backToWorkBtn = document.getElementById('backToWorkBtn');
    const endWorkBtn = document.getElementById('endWorkBtn');
    
    console.log('🔄 Current workflow state:', currentWorkflowState);
    console.log('🔄 Current employee:', currentEmployee);
    
    // Reset all buttons first
    [startBtn, breakBtn, backToWorkBtn, endWorkBtn].forEach(btn => {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('btn-disabled');
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
        }
    });
    
    // Apply workflow restrictions
    switch (currentWorkflowState) {
        case WORKFLOW_STATES.NOT_STARTED:
            if (breakBtn) { 
                breakBtn.disabled = true; 
                breakBtn.classList.add('btn-disabled');
                breakBtn.style.pointerEvents = 'none';
                breakBtn.style.opacity = '0.4';
            }
            if (backToWorkBtn) { 
                backToWorkBtn.disabled = true; 
                backToWorkBtn.classList.add('btn-disabled');
                backToWorkBtn.style.pointerEvents = 'none';
                backToWorkBtn.style.opacity = '0.4';
            }
            if (endWorkBtn) { 
                endWorkBtn.disabled = true; 
                endWorkBtn.classList.add('btn-disabled');
                endWorkBtn.style.pointerEvents = 'none';
                endWorkBtn.style.opacity = '0.4';
            }
            
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.classList.remove('btn-disabled');
                startBtn.style.pointerEvents = 'auto';
                startBtn.style.opacity = '1';
            }
            
            updateTimeClockStatus('Ready to start your shift', new Date());
            break;
            
        case WORKFLOW_STATES.WORKING:
            if (startBtn) { 
                startBtn.disabled = true; 
                startBtn.classList.add('btn-disabled');
                startBtn.style.pointerEvents = 'none';
                startBtn.style.opacity = '0.4';
            }
            if (backToWorkBtn) { 
                backToWorkBtn.disabled = true; 
                backToWorkBtn.classList.add('btn-disabled');
                backToWorkBtn.style.pointerEvents = 'none';
                backToWorkBtn.style.opacity = '0.4';
            }
            
            if (breakBtn) {
                breakBtn.disabled = false;
                breakBtn.classList.remove('btn-disabled');
                breakBtn.style.pointerEvents = 'auto';
                breakBtn.style.opacity = '1';
            }
            if (endWorkBtn) {
                endWorkBtn.disabled = false;
                endWorkBtn.classList.remove('btn-disabled');
                endWorkBtn.style.pointerEvents = 'auto';
                endWorkBtn.style.opacity = '1';
            }
            break;
            
        case WORKFLOW_STATES.ON_BREAK:
            if (startBtn) { 
                startBtn.disabled = true; 
                startBtn.classList.add('btn-disabled');
                startBtn.style.pointerEvents = 'none';
                startBtn.style.opacity = '0.4';
            }
            if (breakBtn) { 
                breakBtn.disabled = true; 
                breakBtn.classList.add('btn-disabled');
                breakBtn.style.pointerEvents = 'none';
                breakBtn.style.opacity = '0.4';
            }
            if (endWorkBtn) { 
                endWorkBtn.disabled = true; 
                endWorkBtn.classList.add('btn-disabled');
                endWorkBtn.style.pointerEvents = 'none';
                endWorkBtn.style.opacity = '0.4';
            }
            
            if (backToWorkBtn) {
                backToWorkBtn.disabled = false;
                backToWorkBtn.classList.remove('btn-disabled');
                backToWorkBtn.style.pointerEvents = 'auto';
                backToWorkBtn.style.opacity = '1';
            }
            break;
            
        case WORKFLOW_STATES.FINISHED:
            [startBtn, breakBtn, backToWorkBtn, endWorkBtn].forEach(btn => {
                if (btn) {
                    btn.disabled = true;
                    btn.classList.add('btn-disabled');
                    btn.style.pointerEvents = 'none';
                    btn.style.opacity = '0.4';
                }
            });
            
            updateTimeClockStatus('Shift completed. See you tomorrow!', new Date());
            break;
            
        default:
            console.log('🔄 Unknown workflow state, defaulting to NOT_STARTED');
            currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
            updateWorkflowButtonStates();
            return;
    }
    
    console.log('🔄 Button states updated for workflow:', currentWorkflowState);
    console.log('🔄 START button enabled:', startBtn ? !startBtn.disabled : 'button not found');
}

// ============= SIMPLIFIED TIME CLOCK - PURE TIMER =============

async function handleStartWork() {
    console.log('🟢 START WORK button clicked!');
    
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    if (currentWorkflowState !== WORKFLOW_STATES.NOT_STARTED) {
        console.log('❌ Wrong workflow state for starting work:', currentWorkflowState);
        showToast('You can only start work at the beginning of your shift', 'error');
        return;
    }
    
    console.log('✅ Starting work shift...');
    await handleTimeClock('🟢 START WORK');
    currentWorkflowState = WORKFLOW_STATES.WORKING;
    saveWorkflowState();
    updateWorkflowButtonStates();
    showToast('Work shift started! ⏱️', 'success');
}

async function handleBreak() {
    console.log('☕ BREAK button clicked!');
    
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    if (currentWorkflowState !== WORKFLOW_STATES.WORKING) {
        showToast('You can only take a break while working', 'error');
        return;
    }
    
    await handleTimeClock('☕ TAKE BREAK');
    currentWorkflowState = WORKFLOW_STATES.ON_BREAK;
    saveWorkflowState();
    updateWorkflowButtonStates();
    showToast('Break started! ☕', 'success');
}

async function handleResumeWork() {
    console.log('🔵 BACK TO WORK button clicked!');
    
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    if (currentWorkflowState !== WORKFLOW_STATES.ON_BREAK) {
        showToast('You can only resume work from a break', 'error');
        return;
    }
    
    await handleTimeClock('🔵 BACK TO WORK');
    currentWorkflowState = WORKFLOW_STATES.WORKING;
    saveWorkflowState();
    updateWorkflowButtonStates();
    showToast('Back to work! 💪', 'success');
}

async function handleEndWork() {
    console.log('🔴 END WORK button clicked!');
    
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    if (currentWorkflowState !== WORKFLOW_STATES.WORKING) {
        showToast('You can only end work while actively working', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to end your shift for today?\n\nYou won\'t be able to start work again until tomorrow at 9 AM Brisbane time.')) {
        return;
    }
    
    await handleTimeClock('🔴 DONE FOR TODAY');
    currentWorkflowState = WORKFLOW_STATES.FINISHED;
    saveWorkflowState();
    updateWorkflowButtonStates();
    showShiftSummary();
    showToast('Shift completed! Great work today! 🎯', 'success');
}

// ============= TASK IMPORT & MANAGEMENT WITH ENHANCED BACKEND INTEGRATION =============

function openTaskEditorModal() {
    // Create modal if it doesn't exist
    if (!document.getElementById('taskEditorModal')) {
        createTaskEditorModal();
    }
    
    // Reset form
    document.getElementById('masterBoardId').value = '';
    document.getElementById('companyBoardId').value = '';
    document.getElementById('taskEditorContent').innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Enter both IDs above and click "Import Task" to add it to your dashboard</p>';
    
    // Show modal
    document.getElementById('taskEditorModal').style.display = 'block';
}

function createTaskEditorModal() {
    const modalHTML = `
    <div id="taskEditorModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>📥 Import Task from Infinity</h2>
                <span class="close" onclick="closeTaskEditorModal()">&times;</span>
            </div>
            
            <div class="modal-body">
                <div class="task-id-inputs">
                    <div class="form-group">
                        <label for="masterBoardId">Master Board Item ID*</label>
                        <input type="text" id="masterBoardId" placeholder="Enter master board item ID from Infinity" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="companyBoardId">Company Board Item ID*</label>
                        <input type="text" id="companyBoardId" placeholder="Enter company board item ID from Infinity" required>
                    </div>
                    
                    <button type="button" class="btn btn-primary" onclick="importTaskToMyDashboard()">
                        📥 Import Task to My Dashboard
                    </button>
                </div>
                
                <div id="taskEditorContent">
                    <p style="color: var(--text-secondary); text-align: center; padding: 2rem;">
                        Enter both IDs above and click "Import Task" to add it to your dashboard
                    </p>
                </div>
                
                <div class="modal-footer" id="taskEditorFooter" style="display: none;">
                    <button type="button" class="btn btn-secondary" onclick="closeTaskEditorModal()">
                        Cancel
                    </button>
                    <button type="button" class="btn btn-success" onclick="updateTaskInInfinity()">
                        🔄 Update in Infinity
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// UPDATED: Enhanced task import with proper error handling
async function importTaskToMyDashboard() {
    const masterBoardId = document.getElementById('masterBoardId').value.trim();
    const companyBoardId = document.getElementById('companyBoardId').value.trim();
    
    if (!masterBoardId || !companyBoardId) {
        showToast('Please enter both Master Board ID and Company Board ID', 'warning');
        return;
    }
    
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    try {
        showToast('📥 Importing task from Infinity...', 'info');
        
        // UPDATED: Use the correct request format for your n8n workflow
        const requestData = {
            action: 'get_task_by_ids',
            master_board_id: masterBoardId,
            company_board_id: companyBoardId
        };
        
        console.log('📤 Sending request:', requestData);
        
        const response = await fetch(CONFIG.taskRetrievalUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        
        console.log('📨 Response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('📥 Backend response:', data);
            
            // UPDATED: Handle the enhanced response format from your n8n workflow
            if (data.success && data.task) {
                await saveTaskToMyDashboard(data.task, masterBoardId, companyBoardId);
                displayTaskForEditing(data.task, masterBoardId, companyBoardId);
                showToast('✅ Task imported successfully to your dashboard!', 'success');
                
                // Refresh the assigned tasks list to show the new task
                await loadAssignedTasks();
            } else {
                throw new Error(data.message || 'Task not found in Infinity');
            }
        } else {
            const errorText = await response.text();
            console.error('❌ Response error:', errorText);
            
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { message: `HTTP ${response.status}: ${errorText}` };
            }
            
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('❌ Error importing task from Infinity:', error);
        showToast('❌ Failed to import from Infinity: ' + error.message, 'error');
        
        // Fallback to manual entry
        showManualTaskEntry(masterBoardId, companyBoardId);
    }
}

function showManualTaskEntry(masterBoardId, companyBoardId) {
    document.getElementById('taskEditorContent').innerHTML = `
        <div class="task-editor-form">
            <div class="task-info-header">
                <h3>✏️ Manual Task Entry</h3>
                <span class="task-company-badge">Infinity Import</span>
            </div>
            
            <p style="color: var(--text-secondary); margin-bottom: var(--spacing-lg); text-align: center;">
                Unable to auto-fetch from Infinity. Please enter task details manually:
            </p>
            
            <div class="form-group">
                <label for="manualTaskName">Task Name*</label>
                <input type="text" id="manualTaskName" placeholder="Enter task name" required>
            </div>
            
            <div class="form-group">
                <label for="manualTaskCompany">Company*</label>
                <select id="manualTaskCompany" required>
                    <option value="">Select Company</option>
                    <option value="VEBLEN (Internal)">VEBLEN (Internal)</option>
                    <option value="LCMB GROUP">LCMB GROUP</option>
                    <option value="NEWTECH TRAILERS">NEWTECH TRAILERS</option>
                    <option value="CROWN REALITY">CROWN REALITY</option>
                    <option value="FLECK GROUP">FLECK GROUP</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="manualTaskProgress">Progress (%)</label>
                <div class="progress-input-container">
                    <input type="range" id="manualTaskProgress" min="0" max="100" value="0" 
                           oninput="updateProgressDisplay(this.value)">
                    <span id="progressDisplay">0%</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" id="editProgressBar" style="width: 0%"></div>
                </div>
            </div>
            
            <div class="form-group">
                <label for="manualTaskStatus">Status</label>
                <select id="manualTaskStatus">
                    <option value="Project">Project</option>
                    <option value="Priority Project">Priority Project</option>
                    <option value="Current Project" selected>Current Project</option>
                    <option value="Revision">Revision</option>
                    <option value="Waiting Approval">Waiting Approval</option>
                    <option value="Project Finished">Project Finished</option>
                    <option value="Rejected">Rejected</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="manualTaskDescription">Description</label>
                <textarea id="manualTaskDescription" rows="3" placeholder="Enter task description"></textarea>
            </div>
            
            <div class="form-group">
                <label for="manualTaskNotes">Notes</label>
                <textarea id="manualTaskNotes" rows="4" placeholder="Add any notes or updates..."></textarea>
            </div>
            
            <div class="task-meta-info">
                <p><strong>Master Board ID:</strong> ${masterBoardId}</p>
                <p><strong>Company Board ID:</strong> ${companyBoardId}</p>
                <p><strong>Employee:</strong> ${currentEmployee}</p>
            </div>
            
            <button type="button" class="btn btn-primary" onclick="saveManualTaskEntry('${masterBoardId}', '${companyBoardId}')">
                💾 Add to My Dashboard
            </button>
        </div>
    `;
}

async function saveManualTaskEntry(masterBoardId, companyBoardId) {
    const taskName = document.getElementById('manualTaskName').value.trim();
    const taskCompany = document.getElementById('manualTaskCompany').value;
    const progress = parseInt(document.getElementById('manualTaskProgress').value);
    const status = document.getElementById('manualTaskStatus').value;
    const description = document.getElementById('manualTaskDescription').value;
    const notes = document.getElementById('manualTaskNotes').value;
    
    if (!taskName || !taskCompany) {
        showToast('Please fill in Task Name and Company', 'warning');
        return;
    }
    
    const manualTask = {
        id: `${masterBoardId}_${companyBoardId}`,
        name: taskName,
        company: taskCompany,
        progress: progress,
        status: status,
        description: description,
        notes: notes,
        dueDate: 'Not set',
        createdDate: new Date().toLocaleDateString(),
        masterBoardId: masterBoardId,
        companyBoardId: companyBoardId,
        importedBy: currentEmployee,
        importedAt: new Date().toISOString()
    };
    
    await saveTaskToMyDashboard(manualTask, masterBoardId, companyBoardId);
    showToast('✅ Task added to your dashboard successfully!', 'success');
    closeTaskEditorModal();
    await loadAssignedTasks();
}

async function saveTaskToMyDashboard(task, masterBoardId, companyBoardId) {
    if (!currentEmployee) return;
    
    // Get user's personal task list
    const tasksKey = `myTasks_${currentEmployee}`;
    let myTasks = [];
    
    try {
        const saved = localStorage.getItem(tasksKey);
        if (saved) {
            myTasks = JSON.parse(saved);
        }
    } catch (error) {
        console.error('Error loading existing tasks:', error);
        myTasks = [];
    }
    
    // Create task with Infinity IDs - UPDATED FORMAT
    const taskForDashboard = {
        id: `${masterBoardId}_${companyBoardId}`,
        name: task.name || 'Imported Task',
        company: task.company || 'Unknown Company',
        company_display_name: task.company_display_name || task.company || 'Unknown Company',
        progress: task.progress || 0,
        status: task.status || 'Current Project',
        status_priority: task.status_priority || 1,
        status_color: task.status_color || '#718096',
        description: task.description || '',
        notes: task.notes || '',
        dueDate: task.dueDate || 'Not set',
        dueDateRaw: task.dueDateRaw || null,
        assignedTo: task.assignedTo || [],
        assignedDetails: task.assignedDetails || [],
        createdDate: task.createdDate || new Date().toLocaleDateString(),
        updatedDate: task.updatedDate || new Date().toLocaleDateString(),
        createdDateRaw: task.createdDateRaw || null,
        updatedDateRaw: task.updatedDateRaw || null,
        masterBoardId: masterBoardId,
        companyBoardId: companyBoardId,
        importedBy: currentEmployee,
        importedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        isHighPriority: task.isHighPriority || false,
        isComplete: task.isComplete || false,
        isOverdue: task.isOverdue || false,
        retrievedAt: task.retrievedAt || new Date().toISOString()
    };
    
    // Check if task already exists
    const existingIndex = myTasks.findIndex(t => t.id === taskForDashboard.id);
    if (existingIndex >= 0) {
        myTasks[existingIndex] = taskForDashboard;
        showToast('📝 Task updated in your dashboard', 'info');
    } else {
        myTasks.push(taskForDashboard);
        showToast('📥 Task added to your dashboard', 'success');
    }
    
    // Save back to localStorage
    localStorage.setItem(tasksKey, JSON.stringify(myTasks));
    
    // Update availableTasks array
    availableTasks = myTasks;
}

// UPDATED: Enhanced displayTaskForEditing to handle the new response format
function displayTaskForEditing(task, masterBoardId, companyBoardId) {
    const content = document.getElementById('taskEditorContent');
    
    // Extract assignedTo array (handle both old and new formats)
    let assignedToDisplay = 'Not assigned';
    if (task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
        assignedToDisplay = task.assignedTo.join(', ');
    } else if (task.assignedDetails && Array.isArray(task.assignedDetails) && task.assignedDetails.length > 0) {
        assignedToDisplay = task.assignedDetails.map(user => `${user.name} (${user.role})`).join(', ');
    }
    
    content.innerHTML = `
        <div class="task-editor-form">
            <div class="task-info-header">
                <h3>${task.name || 'Imported Task'}</h3>
                <span class="task-company-badge">${task.company_display_name || task.company || 'Unknown Company'}</span>
            </div>
            
            <div class="form-group">
                <label for="editTaskName">Task Name*</label>
                <input type="text" id="editTaskName" value="${task.name || ''}" placeholder="Enter task name" required>
            </div>
            
            <div class="form-group">
                <label for="editTaskProgress">Progress (%)</label>
                <div class="progress-input-container">
                    <input type="range" id="editTaskProgress" min="0" max="100" value="${task.progress || 0}" 
                           oninput="updateProgressDisplay(this.value)">
                    <span id="progressDisplay">${task.progress || 0}%</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" id="editProgressBar" style="width: ${task.progress || 0}%"></div>
                </div>
            </div>
            
            <div class="form-group">
                <label for="editTaskStatus">Status</label>
                <select id="editTaskStatus">
                    <option value="Project" ${task.status === 'Project' ? 'selected' : ''}>Project</option>
                    <option value="Priority Project" ${task.status === 'Priority Project' ? 'selected' : ''}>Priority Project</option>
                    <option value="Current Project" ${task.status === 'Current Project' ? 'selected' : ''}>Current Project</option>
                    <option value="Revision" ${task.status === 'Revision' ? 'selected' : ''}>Revision</option>
                    <option value="Waiting Approval" ${task.status === 'Waiting Approval' ? 'selected' : ''}>Waiting Approval</option>
                    <option value="Project Finished" ${task.status === 'Project Finished' ? 'selected' : ''}>Project Finished</option>
                    <option value="Rejected" ${task.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="editTaskDescription">Description</label>
                <textarea id="editTaskDescription" rows="3" placeholder="Enter task description">${task.description || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label for="editTaskNotes">Notes</label>
                <textarea id="editTaskNotes" rows="4" placeholder="Add any notes or updates...">${task.notes || ''}</textarea>
            </div>
            
            <div class="task-meta-info">
                <p><strong>Master Board ID:</strong> ${masterBoardId}</p>
                <p><strong>Company Board ID:</strong> ${companyBoardId}</p>
                <p><strong>Task ID:</strong> ${task.id || `${masterBoardId}_${companyBoardId}`}</p>
                <p><strong>Due Date:</strong> ${task.dueDate || 'Not set'}</p>
                <p><strong>Assigned To:</strong> ${assignedToDisplay}</p>
                <p><strong>Status Priority:</strong> ${task.status_priority || 'N/A'}</p>
                <p><strong>Is High Priority:</strong> ${task.isHighPriority ? 'Yes' : 'No'}</p>
                <p><strong>Is Complete:</strong> ${task.isComplete ? 'Yes' : 'No'}</p>
                <p><strong>Is Overdue:</strong> ${task.isOverdue ? 'Yes' : 'No'}</p>
                <p><strong>Retrieved:</strong> ${task.retrievedAt ? new Date(task.retrievedAt).toLocaleString() : 'Unknown'}</p>
            </div>
        </div>
    `;
    
    // Store current task data for saving (updated format)
    window.currentEditingTask = {
        ...task,
        masterBoardId: masterBoardId,
        companyBoardId: companyBoardId
    };
    
    // Show footer buttons
    document.getElementById('taskEditorFooter').style.display = 'flex';
}

function updateProgressDisplay(value) {
    document.getElementById('progressDisplay').textContent = value + '%';
    document.getElementById('editProgressBar').style.width = value + '%';
}

// UPDATED: Enhanced updateTaskInInfinity to use the new API
async function updateTaskInInfinity() {
    if (!window.currentEditingTask) {
        showToast('No task loaded for editing', 'error');
        return;
    }
    
    const taskName = document.getElementById('editTaskName').value.trim();
    const progress = parseInt(document.getElementById('editTaskProgress').value);
    const status = document.getElementById('editTaskStatus').value;
    const description = document.getElementById('editTaskDescription').value;
    const notes = document.getElementById('editTaskNotes').value;
    const masterBoardId = window.currentEditingTask.masterBoardId;
    const companyBoardId = window.currentEditingTask.companyBoardId;
    
    if (!taskName) {
        showToast('Please enter a task name', 'warning');
        return;
    }
    
    // UPDATED: Use the format your n8n task-update webhook expects
    const updateData = {
        action: 'update_task',
        master_board_id: masterBoardId,
        company_board_id: companyBoardId,
        task_name: taskName,
        progress: progress,
        status: status,
        description: description,
        notes: notes,
        timestamp: new Date().toISOString(),
        updated_by: currentEmployee || 'Unknown User'
    };
    
    try {
        showToast('🔄 Updating task in Infinity...', 'info');
        
        console.log('📤 Sending update:', updateData);
        
        const response = await fetch(CONFIG.taskUpdateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        console.log('📨 Update response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('📤 Update response:', result);
            
            if (result.success) {
                // Update local dashboard
                await updateTaskInMyDashboard(masterBoardId, companyBoardId, {
                    name: taskName,
                    progress: progress,
                    status: status,
                    description: description,
                    notes: notes
                });
                
                showToast('✅ Task updated successfully in Infinity and your dashboard!', 'success');
                closeTaskEditorModal();
                
                // Refresh assigned tasks list
                await loadAssignedTasks();
            } else {
                throw new Error(result.message || 'Update failed in Infinity');
            }
        } else {
            const errorText = await response.text();
            console.error('❌ Update error:', errorText);
            
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { message: `HTTP ${response.status}: ${errorText}` };
            }
            
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('❌ Error updating task in Infinity:', error);
        
        // Still update locally even if Infinity update fails
        await updateTaskInMyDashboard(masterBoardId, companyBoardId, {
            name: taskName,
            progress: progress,
            status: status,
            description: description,
            notes: notes
        });
        
        showToast('⚠️ Updated locally, but failed to sync with Infinity: ' + error.message, 'warning');
        await loadAssignedTasks();
    }
}

async function updateTaskInMyDashboard(masterBoardId, companyBoardId, updates) {
    if (!currentEmployee) return;
    
    const tasksKey = `myTasks_${currentEmployee}`;
    let myTasks = [];
    
    try {
        const saved = localStorage.getItem(tasksKey);
        if (saved) {
            myTasks = JSON.parse(saved);
        }
    } catch (error) {
        console.error('Error loading tasks for update:', error);
        return;
    }
    
    const taskId = `${masterBoardId}_${companyBoardId}`;
    const taskIndex = myTasks.findIndex(t => t.id === taskId);
    
    if (taskIndex >= 0) {
        // Update existing task
        myTasks[taskIndex] = {
            ...myTasks[taskIndex],
            ...updates,
            lastUpdated: new Date().toISOString()
        };
        
        localStorage.setItem(tasksKey, JSON.stringify(myTasks));
        availableTasks = myTasks;
    }
}

function closeTaskEditorModal() {
    const modal = document.getElementById('taskEditorModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Clean up
    window.currentEditingTask = null;
}

// ============= EMPLOYEE CHANGE HANDLER =============

function handleEmployeeChange(e) {
    currentEmployee = e.target.value;
    localStorage.setItem('selectedEmployee', currentEmployee);
    
    if (currentEmployee) {
        loadEmployeeData();
    } else {
        clearEmployeeData();
    }
}

async function loadEmployeeData() {
    if (!currentEmployee) return;
    
    await loadAssignedTasks();
    await loadWorkClockState();
    initializeWorkflowState();
}

function clearEmployeeData() {
    document.getElementById('assignedTasksList').innerHTML = '<p class="loading">Select an employee to view assigned tasks...</p>';
    clearWorkClockState();
    availableTasks = [];
    currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
    updateWorkflowButtonStates();
}

// ============= ESSENTIAL UTILITY FUNCTIONS =============

// Handle time clock
async function handleTimeClock(action) {
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    try {
        const response = await fetch(CONFIG.timeLoggerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                'WHO ARE YOU?': currentEmployee,
                'WHAT ARE YOU DOING?': action
            })
        });

        if (response.ok) {
            console.log(`✅ ${action} recorded successfully!`);
            
            // Update real-time clock based on action
            const now = new Date();
            handleClockAction(action, now);
            updateTimeClockStatus(action, now);
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error recording time clock:', error);
        showToast('Error recording time clock action', 'error');
    }
}

// Handle clock action for real-time display
function handleClockAction(action, timestamp) {
    if (!dailyShiftData) {
        initializeDailyShiftData();
    }
    
    switch (action) {
        case '🟢 START WORK':
            if (!dailyShiftData.shiftStartTime) {
                dailyShiftData.shiftStartTime = timestamp;
            }
            currentWorkSession = {
                startTime: timestamp,
                lastUpdate: timestamp
            };
            currentBreakSession = null;
            startWorkClock();
            break;
            
        case '☕ TAKE BREAK':
            if (currentWorkSession) {
                const sessionTime = timestamp.getTime() - currentWorkSession.startTime.getTime();
                dailyShiftData.totalWorkedMs += sessionTime;
                
                dailyShiftData.workSessions.push({
                    startTime: currentWorkSession.startTime.toISOString(),
                    endTime: timestamp.toISOString(),
                    durationMs: sessionTime
                });
                
                currentWorkSession = null;
            }
            
            currentBreakSession = {
                startTime: timestamp,
                lastUpdate: timestamp
            };
            startBreakClock();
            break;
            
        case '🔵 BACK TO WORK':
            currentWorkSession = {
                startTime: timestamp,
                lastUpdate: timestamp
            };
            currentBreakSession = null;
            startWorkClock();
            break;
            
        case '🔴 DONE FOR TODAY':
            if (currentWorkSession) {
                const sessionTime = timestamp.getTime() - currentWorkSession.startTime.getTime();
                dailyShiftData.totalWorkedMs += sessionTime;
                
                dailyShiftData.workSessions.push({
                    startTime: currentWorkSession.startTime.toISOString(),
                    endTime: timestamp.toISOString(),
                    durationMs: sessionTime
                });
            }
            
            stopAllClocks();
            break;
    }
}

// Initialize daily shift data
function initializeDailyShiftData() {
    dailyShiftData = {
        totalWorkedMs: 0,
        workSessions: [],
        shiftStartTime: null,
        targetShiftMs: 8 * 60 * 60 * 1000
    };
}

function formatElapsedTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    const container = document.getElementById('toastContainer');
    if (container) {
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
}

// Start work clock timer
function startWorkClock() {
    if (workClockInterval) clearInterval(workClockInterval);
    if (breakClockInterval) clearInterval(breakClockInterval);
    
    document.getElementById('breakClockDisplay').style.display = 'none';
    document.getElementById('workClockDisplay').style.display = 'block';
    
    updateWorkTimer();
    
    workClockInterval = setInterval(updateWorkTimer, 1000);
    
    if (currentWorkSession) {
        saveWorkClockState('working', currentWorkSession.startTime);
    }
}

function startBreakClock() {
    if (workClockInterval) clearInterval(workClockInterval);
    if (breakClockInterval) clearInterval(breakClockInterval);
    
    document.getElementById('workClockDisplay').style.display = 'none';
    document.getElementById('breakClockDisplay').style.display = 'block';
    
    updateBreakTimer();
    
    breakClockInterval = setInterval(updateBreakTimer, 1000);
    
    if (currentBreakSession) {
        saveWorkClockState('break', currentBreakSession.startTime);
    }
}

function updateWorkTimer() {
    if (!currentWorkSession || !dailyShiftData) return;
    
    const now = Date.now();
    const currentSessionElapsed = now - currentWorkSession.startTime.getTime();
    const currentSessionFormatted = formatElapsedTime(currentSessionElapsed);
    const totalShiftTime = dailyShiftData.totalWorkedMs + currentSessionElapsed;
    const totalShiftFormatted = formatElapsedTime(totalShiftTime);
    
    const workTimerEl = document.getElementById('workTimer');
    const totalShiftTimeEl = document.getElementById('totalShiftTime');
    
    if (workTimerEl) workTimerEl.textContent = currentSessionFormatted;
    if (totalShiftTimeEl) totalShiftTimeEl.textContent = totalShiftFormatted;
    
    updateShiftProgress(totalShiftTime);
    
    const startTimeStr = currentWorkSession.startTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const workStatusEl = document.getElementById('workStatus');
    if (workStatusEl) {
        workStatusEl.textContent = `Current session started at ${startTimeStr}`;
    }
}

function updateBreakTimer() {
    if (!currentBreakSession || !dailyShiftData) return;
    
    const now = Date.now();
    const elapsed = now - currentBreakSession.startTime.getTime();
    const formattedTime = formatElapsedTime(elapsed);
    
    const breakTimerEl = document.getElementById('breakTimer');
    if (breakTimerEl) breakTimerEl.textContent = formattedTime;
    
    const totalWorkedFormatted = formatElapsedTime(dailyShiftData.totalWorkedMs);
    const remainingMs = Math.max(0, dailyShiftData.targetShiftMs - dailyShiftData.totalWorkedMs);
    const remainingFormatted = formatElapsedTime(remainingMs);
    
    const totalWorkedEl = document.getElementById('totalWorkedOnBreak');
    const shiftRemainingEl = document.getElementById('shiftRemainingOnBreak');
    
    if (totalWorkedEl) totalWorkedEl.textContent = totalWorkedFormatted;
    if (shiftRemainingEl) shiftRemainingEl.textContent = remainingFormatted;
    
    const startTimeStr = currentBreakSession.startTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const breakStatusEl = document.getElementById('breakStatus');
    if (breakStatusEl) {
        breakStatusEl.textContent = `Started break at ${startTimeStr}`;
    }
}

function updateShiftProgress(totalShiftTimeMs) {
    if (!dailyShiftData) return;
    
    const progressBar = document.getElementById('shiftProgressBar');
    const shiftStatus = document.getElementById('shiftStatus');
    
    if (!progressBar || !shiftStatus) return;
    
    const percentage = (totalShiftTimeMs / dailyShiftData.targetShiftMs) * 100;
    const clampedPercentage = Math.min(100, percentage);
    
    progressBar.style.width = `${clampedPercentage}%`;
    
    const hours = totalShiftTimeMs / (60 * 60 * 1000);
    
    if (percentage >= 100) {
        progressBar.className = 'shift-bar complete';
        shiftStatus.className = 'shift-target complete';
        
        if (percentage > 110) {
            progressBar.className = 'shift-bar overtime';
            shiftStatus.className = 'shift-target overtime';
            shiftStatus.textContent = `🎉 Overtime! ${hours.toFixed(1)} hours completed (+${(hours - 8).toFixed(1)}h extra)`;
        } else {
            shiftStatus.textContent = `🎉 Shift Complete! ${hours.toFixed(1)} hours completed`;
        }
    } else {
        progressBar.className = 'shift-bar';
        shiftStatus.className = 'shift-target';
        const remainingHours = (8 - hours).toFixed(1);
        shiftStatus.textContent = `${percentage.toFixed(0)}% of 8 hours completed (${remainingHours}h remaining)`;
    }
    
    if (percentage >= 100 && percentage < 101) {
        showToast('🎉 Congratulations! You\'ve completed your 8-hour shift!', 'success');
    }
}

function updateTimeClockStatus(action, timestamp = new Date()) {
    const statusDiv = document.getElementById('timeClockStatus');
    if (!statusDiv) return;
    
    const time = timestamp.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    let statusMessage = '';
    let statusClass = '';
    
    switch (action) {
        case '🟢 START WORK':
            statusMessage = `Work started at ${time}`;
            statusClass = 'status-working';
            break;
        case '☕ TAKE BREAK':
            statusMessage = `Break started at ${time}`;
            statusClass = 'status-break';
            break;
        case '🔵 BACK TO WORK':
            statusMessage = `Resumed work at ${time}`;
            statusClass = 'status-working';
            break;
        case '🔴 DONE FOR TODAY':
            statusMessage = `Work ended at ${time}`;
            statusClass = 'status-ended';
            break;
        case 'Ready to start your shift':
            statusMessage = 'Ready to start your shift';
            statusClass = 'status-ready';
            break;
        case 'Shift completed. See you tomorrow!':
            statusMessage = 'Shift completed. See you tomorrow!';
            statusClass = 'status-ended';
            break;
        default:
            statusMessage = `Last action: ${action} at ${time}`;
    }
    
    statusDiv.innerHTML = `<span class="${statusClass}">${statusMessage}</span>`;
}

function showShiftSummary() {
    if (!dailyShiftData) return;
    
    const totalHours = dailyShiftData.totalWorkedMs / (60 * 60 * 1000);
    const sessions = dailyShiftData.workSessions.length;
    
    let message = `🎯 Shift Summary:\n`;
    message += `⏰ Total Time: ${formatElapsedTime(dailyShiftData.totalWorkedMs)}\n`;
    message += `📊 Work Sessions: ${sessions}\n`;
    
    if (totalHours >= 8) {
        message += `✅ Target Achieved! (+${(totalHours - 8).toFixed(1)}h extra)`;
        showToast(message, 'success');
    } else {
        message += `⚠️ Target: ${(8 - totalHours).toFixed(1)}h short of 8 hours`;
        showToast(message, 'warning');
    }
    
    console.log('📋 Detailed Shift Data:', dailyShiftData);
}

// Load work clock state for current employee
async function loadWorkClockState() {
    if (!currentEmployee) return;
    
    const clockStateKey = `workClock_${currentEmployee}`;
    const savedState = localStorage.getItem(clockStateKey);
    
    if (savedState) {
        try {
            const state = JSON.parse(savedState);
            const now = Date.now();
            const timeDiff = now - new Date(state.lastUpdate).getTime();
            
            const today = new Date().toDateString();
            const stateDate = new Date(state.lastUpdate).toDateString();
            
            if (stateDate === today && timeDiff < 24 * 60 * 60 * 1000) {
                if (state.status === 'working') {
                    currentWorkSession = {
                        startTime: new Date(state.startTime),
                        lastUpdate: new Date(state.lastUpdate)
                    };
                    startWorkClock();
                    updateTimeClockStatus('🟢 START WORK', new Date(state.startTime));
                } else if (state.status === 'break') {
                    currentBreakSession = {
                        startTime: new Date(state.startTime),
                        lastUpdate: new Date(state.lastUpdate)
                    };
                    startBreakClock();
                    updateTimeClockStatus('☕ TAKE BREAK', new Date(state.startTime));
                }
            } else {
                localStorage.removeItem(clockStateKey);
                initializeDailyShiftData();
            }
        } catch (error) {
            console.error('Error loading clock state:', error);
            localStorage.removeItem(clockStateKey);
            initializeDailyShiftData();
        }
    } else {
        initializeDailyShiftData();
    }
}

// Save work clock state
function saveWorkClockState(status, startTime) {
    if (!currentEmployee) return;
    
    const clockStateKey = `workClock_${currentEmployee}`;
    const state = {
        status: status,
        startTime: startTime.toISOString(),
        lastUpdate: new Date().toISOString(),
        dailyShiftData: dailyShiftData,
        employee: currentEmployee
    };
    
    localStorage.setItem(clockStateKey, JSON.stringify(state));
}

// Clear work clock state
function clearWorkClockState() {
    if (workClockInterval) {
        clearInterval(workClockInterval);
        workClockInterval = null;
    }
    if (breakClockInterval) {
        clearInterval(breakClockInterval);
        breakClockInterval = null;
    }
    
    currentWorkSession = null;
    currentBreakSession = null;
    dailyShiftData = null;
    
    // Hide both clock displays
    const workClock = document.getElementById('workClockDisplay');
    const breakClock = document.getElementById('breakClockDisplay');
    if (workClock) workClock.style.display = 'none';
    if (breakClock) breakClock.style.display = 'none';
    
    // Clear status
    updateTimeClockStatus('Select an employee and start work', new Date());
    
    if (currentEmployee) {
        const clockStateKey = `workClock_${currentEmployee}`;
        localStorage.removeItem(clockStateKey);
    }
}

function stopAllClocks() {
    if (workClockInterval) clearInterval(workClockInterval);
    if (breakClockInterval) clearInterval(breakClockInterval);
    
    currentWorkSession = null;
    currentBreakSession = null;
    
    document.getElementById('workClockDisplay').style.display = 'none';
    document.getElementById('breakClockDisplay').style.display = 'none';
}

// ============= TASK MANAGEMENT FUNCTIONS =============

async function loadAssignedTasks() {
    if (!currentEmployee) {
        document.getElementById('assignedTasksList').innerHTML = '<p class="loading">Select an employee to view tasks...</p>';
        return;
    }
    
    document.getElementById('assignedTasksList').innerHTML = '<p class="loading">Loading your assigned tasks...</p>';
    
    try {
        // Load from localStorage (user's personal dashboard)
        const tasksKey = `myTasks_${currentEmployee}`;
        const saved = localStorage.getItem(tasksKey);
        
        if (saved) {
            const myTasks = JSON.parse(saved);
            availableTasks = myTasks;
            displayAssignedTasks(myTasks);
        } else {
            availableTasks = [];
            document.getElementById('assignedTasksList').innerHTML = `
                <div class="no-tasks">
                    <p>📝 No tasks in your dashboard yet</p>
                    <p>Click "Import Task from Infinity" to add tasks to your personal dashboard</p>
                    <button class="btn btn-primary" onclick="openTaskEditorModal()">
                        📥 Import Task from Infinity
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading assigned tasks:', error);
        document.getElementById('assignedTasksList').innerHTML = '<p class="error">Error loading tasks. Please try again.</p>';
    }
}

function displayAssignedTasks(tasks) {
    const container = document.getElementById('assignedTasksList');
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = `
            <div class="no-tasks">
                <p>📝 No tasks in your dashboard yet</p>
                <p>Click "Import Task from Infinity" to add tasks to your personal dashboard</p>
                <button class="btn btn-primary" onclick="openTaskEditorModal()">
                    📥 Import Task from Infinity
                </button>
            </div>
        `;
        return;
    }
    
    // Sort tasks by priority and due date
    const sortedTasks = tasks.sort((a, b) => {
        // First by priority (higher priority first)
        const aPriority = a.status_priority || 1;
        const bPriority = b.status_priority || 1;
        if (aPriority !== bPriority) return bPriority - aPriority;
        
        // Then by completion status (incomplete first)
        if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
        
        // Then by overdue status (overdue first)
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        
        return 0;
    });
    
    const tasksHTML = sortedTasks.map(task => createTaskHTML(task)).join('');
    
    container.innerHTML = `
        <div class="tasks-header">
            <h3>📋 Your Personal Task Dashboard</h3>
            <button class="btn btn-primary" onclick="openTaskEditorModal()">
                📥 Import Task from Infinity
            </button>
        </div>
        <div class="tasks-grid">
            ${tasksHTML}
        </div>
    `;
}

function createTaskHTML(task) {
    const progressClass = getProgressClass(task.progress);
    const statusBadgeClass = getStatusBadgeClass(task.status);
    const priorityIcon = task.isHighPriority ? '🔥' : '📋';
    const overdueIcon = task.isOverdue ? '⚠️' : '';
    const completeIcon = task.isComplete ? '✅' : '';
    
    // Format assigned users
    let assignedDisplay = 'Not assigned';
    if (task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
        assignedDisplay = task.assignedTo.slice(0, 2).join(', ');
        if (task.assignedTo.length > 2) {
            assignedDisplay += ` +${task.assignedTo.length - 2} more`;
        }
    }
    
    return `
        <div class="task-card" data-task-id="${task.id}">
            <div class="task-header">
                <div class="task-title">
                    ${priorityIcon} ${overdueIcon} ${completeIcon}
                    <span class="task-name">${task.name}</span>
                </div>
                <div class="task-actions">
                    <button class="btn-icon" onclick="editTaskFromDashboard('${task.id}')" title="Edit Task">
                        ✏️
                    </button>
                    <button class="btn-icon" onclick="removeTaskFromDashboard('${task.id}')" title="Remove from Dashboard">
                        🗑️
                    </button>
                </div>
            </div>
            
            <div class="task-meta">
                <span class="company-badge">${task.company_display_name || task.company}</span>
                <span class="status-badge ${statusBadgeClass}">${task.status}</span>
            </div>
            
            <div class="task-progress">
                <div class="progress-label">Progress: ${task.progress}%</div>
                <div class="progress-bar-container">
                    <div class="progress-bar ${progressClass}" style="width: ${task.progress}%"></div>
                </div>
            </div>
            
            <div class="task-details">
                ${task.description ? `<p class="task-description">${task.description.length > 100 ? task.description.substring(0, 97) + '...' : task.description}</p>` : ''}
                
                <div class="task-info-grid">
                    <div class="info-item">
                        <span class="info-label">Due:</span>
                        <span class="info-value ${task.isOverdue ? 'overdue' : ''}">${task.dueDate}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Assigned:</span>
                        <span class="info-value">${assignedDisplay}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Updated:</span>
                        <span class="info-value">${task.updatedDate || task.createdDate}</span>
                    </div>
                </div>
                
                <div class="task-ids">
                    <small>Master: ${task.masterBoardId}</small>
                    <small>Company: ${task.companyBoardId}</small>
                </div>
            </div>
        </div>
    `;
}

function getProgressClass(progress) {
    if (progress >= 100) return 'complete';
    if (progress >= 75) return 'high';
    if (progress >= 50) return 'medium';
    if (progress >= 25) return 'low';
    return 'none';
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'Priority Project': return 'priority';
        case 'Current Project': return 'current';
        case 'Project Finished': return 'finished';
        case 'Waiting Approval': return 'waiting';
        case 'Revision': return 'revision';
        case 'Rejected': return 'rejected';
        default: return 'project';
    }
}

async function editTaskFromDashboard(taskId) {
    if (!currentEmployee) return;
    
    const tasksKey = `myTasks_${currentEmployee}`;
    const saved = localStorage.getItem(tasksKey);
    
    if (!saved) return;
    
    try {
        const myTasks = JSON.parse(saved);
        const task = myTasks.find(t => t.id === taskId);
        
        if (!task) {
            showToast('Task not found in your dashboard', 'error');
            return;
        }
        
        // Open task editor modal with this task
        if (!document.getElementById('taskEditorModal')) {
            createTaskEditorModal();
        }
        
        // Populate IDs
        document.getElementById('masterBoardId').value = task.masterBoardId;
        document.getElementById('companyBoardId').value = task.companyBoardId;
        
        // Display task for editing
        displayTaskForEditing(task, task.masterBoardId, task.companyBoardId);
        
        // Show modal
        document.getElementById('taskEditorModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading task for editing:', error);
        showToast('Error loading task for editing', 'error');
    }
}

async function removeTaskFromDashboard(taskId) {
    if (!currentEmployee) return;
    
    if (!confirm('Are you sure you want to remove this task from your dashboard?\n\nThis will not delete the task from Infinity, only from your personal dashboard.')) {
        return;
    }
    
    const tasksKey = `myTasks_${currentEmployee}`;
    const saved = localStorage.getItem(tasksKey);
    
    if (!saved) return;
    
    try {
        const myTasks = JSON.parse(saved);
        const filteredTasks = myTasks.filter(t => t.id !== taskId);
        
        localStorage.setItem(tasksKey, JSON.stringify(filteredTasks));
        availableTasks = filteredTasks;
        
        showToast('📝 Task removed from your dashboard', 'success');
        await loadAssignedTasks(); // Refresh display
        
    } catch (error) {
        console.error('Error removing task:', error);
        showToast('Error removing task from dashboard', 'error');
    }
}

// ============= TASK INTAKE FORM =============

async function handleTaskIntake(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const taskData = Object.fromEntries(formData.entries());

    // Handle image upload
    const imageFile = document.getElementById('taskImage').files[0];
    if (imageFile) {
        try {
            showToast('📤 Uploading image...', 'info');
            taskData.Image_URL = await uploadImageToImgBB(imageFile);
        } catch (error) {
            console.error('Image upload failed:', error);
            showToast('⚠️ Image upload failed, submitting without image', 'warning');
        }
    }

    try {
        showToast('📝 Creating task...', 'info');
        
        const response = await fetch(CONFIG.taskIntakeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });

        if (response.ok) {
            const result = await response.json();
            showToast('✅ Task created successfully!', 'success');
            e.target.reset();
            document.getElementById('taskImagePreview').style.display = 'none';
            console.log('✅ Task creation result:', result);
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('❌ Task creation error:', error);
        showToast('❌ Failed to create task: ' + error.message, 'error');
    }
}

// ============= DAILY REPORT FORM =============

async function handleDailyReport(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const reportData = Object.fromEntries(formData.entries());

    // Handle image upload
    const imageFile = document.getElementById('reportPhoto').files[0];
    if (imageFile) {
        try {
            showToast('📤 Uploading photo...', 'info');
            reportData['Photo for report'] = await uploadImageToImgBB(imageFile);
        } catch (error) {
            console.error('Photo upload failed:', error);
            showToast('⚠️ Photo upload failed, submitting without photo', 'warning');
        }
    }

    try {
        showToast('📋 Submitting daily report...', 'info');
        
        const response = await fetch(CONFIG.reportLoggerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportData)
        });

        if (response.ok) {
            const result = await response.json();
            showToast('✅ Daily report submitted successfully!', 'success');
            e.target.reset();
            document.getElementById('reportPhotoPreview').style.display = 'none';
            console.log('✅ Report submission result:', result);
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('❌ Report submission error:', error);
        showToast('❌ Failed to submit report: ' + error.message, 'error');
    }
}

// ============= IMAGE UPLOAD FUNCTIONS =============

async function uploadImageToImgBB(file) {
    const maxSize = 32 * 1024 * 1024; // 32MB limit
    if (file.size > maxSize) {
        throw new Error('Image size too large. Please use an image smaller than 32MB.');
    }

    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.imgbbApiKey}`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error(`ImgBB upload failed: ${response.status}`);
    }

    const result = await response.json();
    if (result.success) {
        return result.data.url;
    } else {
        throw new Error('ImgBB upload failed: ' + (result.error?.message || 'Unknown error'));
    }
}

function handleTaskImagePreview(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('taskImagePreview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Task Image Preview">`;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        preview.style.display = 'none';
    }
}

function handleReportPhotoPreview(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('reportPhotoPreview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Report Photo Preview">`;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        preview.style.display = 'none';
    }
}

// ============= OVERRIDE SYSTEM =============

function initializeOverrideButton() {
    console.log('🔧 Initializing override system...');
    
    // Create override button
    const overrideHTML = `
        <div id="overrideSystem" class="override-system">
            <button id="overrideBtn" class="btn-override" onclick="toggleOverrideMode()" title="Emergency Override - For admins only">
                🔧 Override
            </button>
            <div id="overridePanel" class="override-panel" style="display: none;">
                <h4>🚨 Emergency Override Panel</h4>
                <p>This will reset your workflow state and enable all buttons.</p>
                <div class="override-actions">
                    <button class="btn btn-warning" onclick="performWorkflowReset()">
                        🔄 Reset Workflow State
                    </button>
                    <button class="btn btn-danger" onclick="clearAllEmployeeData()">
                        🗑️ Clear All Data (Danger)
                    </button>
                    <button class="btn btn-secondary" onclick="toggleOverrideMode()">
                        ❌ Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add to header or create container
    const header = document.querySelector('.header');
    if (header) {
        header.insertAdjacentHTML('beforeend', overrideHTML);
    } else {
        document.body.insertAdjacentHTML('afterbegin', overrideHTML);
    }
}

function toggleOverrideMode() {
    const panel = document.getElementById('overridePanel');
    const isVisible = panel.style.display !== 'none';
    
    panel.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
        showToast('🔧 Override panel opened - Use with caution!', 'warning');
    }
}

function performWorkflowReset() {
    if (!confirm('Are you sure you want to reset the workflow state?\n\nThis will:\n- Reset workflow to NOT_STARTED\n- Enable all buttons\n- Clear time clock state\n\nThis action cannot be undone.')) {
        return;
    }
    
    console.log('🔧 Performing emergency workflow reset...');
    
    // Reset workflow state
    currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
    
    // Clear clock state
    clearWorkClockState();
    
    // Update button states
    updateWorkflowButtonStates();
    
    // Save state
    saveWorkflowState();
    
    // Close override panel
    document.getElementById('overridePanel').style.display = 'none';
    
    showToast('🔧 Workflow state reset successfully!', 'success');
    console.log('✅ Override complete - Workflow reset to:', currentWorkflowState);
}

function clearAllEmployeeData() {
    if (!confirm('⚠️ DANGER: This will delete ALL data for the current employee!\n\nThis includes:\n- Workflow state\n- Time clock data\n- Personal task dashboard\n- All saved preferences\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?')) {
        return;
    }
    
    if (!confirm('🚨 FINAL WARNING: You are about to permanently delete all data!\n\nType "DELETE" in the next prompt to confirm.')) {
        return;
    }
    
    const confirmation = prompt('Type "DELETE" to confirm permanent data deletion:');
    if (confirmation !== 'DELETE') {
        showToast('❌ Deletion cancelled - confirmation text did not match', 'info');
        return;
    }
    
    if (!currentEmployee) {
        showToast('❌ No employee selected', 'error');
        return;
    }
    
    console.log('🗑️ Performing emergency data clear for employee:', currentEmployee);
    
    // Clear all localStorage keys for this employee
    const keysToRemove = [
        `workflowState_${currentEmployee}`,
        `workClock_${currentEmployee}`,
        `myTasks_${currentEmployee}`,
        `timeData_${currentEmployee}`,
        `preferences_${currentEmployee}`
    ];
    
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ Removed: ${key}`);
    });
    
    // Reset current state
    currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
    clearWorkClockState();
    availableTasks = [];
    
    // Update UI
    updateWorkflowButtonStates();
    await loadAssignedTasks();
    
    // Close override panel
    document.getElementById('overridePanel').style.display = 'none';
    
    showToast('🗑️ All employee data cleared successfully!', 'success');
    console.log('✅ Emergency data clear complete for:', currentEmployee);
}

// ============= UTILITY FUNCTIONS =============

// Modal close handlers
window.onclick = function(event) {
    const modal = document.getElementById('taskEditorModal');
    if (event.target === modal) {
        closeTaskEditorModal();
    }
};

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // ESC to close modals
    if (e.key === 'Escape') {
        closeTaskEditorModal();
    }
    
    // Ctrl+O for override (hidden shortcut)
    if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        toggleOverrideMode();
    }
});

// Debug helper functions
window.debugApp = function() {
    console.log('🔍 VEBLEN App Debug Info:');
    console.log('Current Employee:', currentEmployee);
    console.log('Workflow State:', currentWorkflowState);
    console.log('Available Tasks:', availableTasks.length);
    console.log('Daily Shift Data:', dailyShiftData);
    console.log('Current Work Session:', currentWorkSession);
    console.log('Current Break Session:', currentBreakSession);
    
    // Button states
    const buttons = ['startWorkBtn', 'breakBtn', 'backToWorkBtn', 'endWorkBtn'];
    buttons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        console.log(`${btnId}:`, {
            exists: !!btn,
            disabled: btn ? btn.disabled : 'N/A',
            classes: btn ? btn.className : 'N/A'
        });
    });
};

// Performance monitoring
console.log('✅ VEBLEN Task Tracker script loaded successfully');
console.log('🔧 Available debug function: debugApp()');
console.log('🔑 Override shortcut: Ctrl+O');
