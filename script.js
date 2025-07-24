// VEBLEN Task Tracker - Complete Enhanced script.js with Infinity Integration
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

// ============= ENHANCED TASK IMPORT & MANAGEMENT WITH N8N INTEGRATION =============

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

// ENHANCED TASK IMPORT - INTEGRATED WITH YOUR N8N WORKFLOW
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
        
        // UPDATED: Request format matching your n8n workflow
        const requestData = {
            action: 'get_task_by_ids',
            master_board_id: masterBoardId,
            company_board_id: companyBoardId,
            timestamp: new Date().toISOString()
        };
        
        console.log('📤 Sending request to n8n:', requestData);
        
        const response = await fetch(CONFIG.taskRetrievalUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        console.log('📨 Response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('📥 N8N response received:', data);
            
            // UPDATED: Handle your n8n workflow response format
            if (data.success && data.task) {
                // Save to personal dashboard with enhanced data
                await saveTaskToMyDashboard(data.task, masterBoardId, companyBoardId);
                
                // Display in modal for editing
                displayTaskForEditing(data.task, masterBoardId, companyBoardId);
                
                showToast('✅ Task imported successfully to your dashboard!', 'success');
                
                // Refresh the assigned tasks list
                await loadAssignedTasks();
            } else {
                throw new Error(data.message || 'Failed to retrieve task from Infinity');
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
            
            throw new Error(errorData.message || `Failed to connect to Infinity API`);
        }
    } catch (error) {
        console.error('❌ Error importing task from Infinity:', error);
        showToast('❌ Failed to import from Infinity: ' + error.message, 'error');
        
        // Show manual entry fallback
        showManualTaskEntry(masterBoardId, companyBoardId);
    }
}

// ENHANCED TASK DISPLAY - SHOWS ALL INFINITY ATTRIBUTES
function displayTaskForEditing(task, masterBoardId, companyBoardId) {
    const content = document.getElementById('taskEditorContent');
    
    // ENHANCED: Extract all the rich data from your n8n workflow
    const assignedToDisplay = task.assignedTo && task.assignedTo.length > 0 
        ? task.assignedTo.join(', ') 
        : 'Not assigned';
    
    const assignedDetailsDisplay = task.assignedDetails && task.assignedDetails.length > 0
        ? task.assignedDetails.map(user => `${user.name} (${user.role} - ${user.department})`).join(', ')
        : 'No detailed assignments';
    
    // ENHANCED: Show comprehensive task information
    content.innerHTML = `
        <div class="task-editor-form">
            <div class="task-info-header">
                <h3>${task.name || 'Imported Task'}</h3>
                <div class="task-badges">
                    <span class="company-badge">${task.company_display_name || task.company || 'Unknown Company'}</span>
                    <span class="infinity-badge">📥 From Infinity</span>
                    ${task.isHighPriority ? '<span class="priority-badge">🔥 High Priority</span>' : ''}
                    ${task.isComplete ? '<span class="complete-badge">✅ Complete</span>' : ''}
                    ${task.isOverdue ? '<span class="overdue-badge">⚠️ Overdue</span>' : ''}
                </div>
            </div>
            
            <!-- ENHANCED FORM WITH ALL ATTRIBUTES -->
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
                    <div class="progress-bar ${getProgressClass(task.progress || 0)}" id="editProgressBar" style="width: ${task.progress || 0}%"></div>
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
            
            <!-- ENHANCED TASK METADATA DISPLAY -->
            <div class="task-meta-info">
                <h4>📊 Task Information</h4>
                <div class="meta-grid">
                    <div class="meta-item">
                        <strong>Task ID:</strong> ${task.id || `${masterBoardId}_${companyBoardId}`}
                    </div>
                    <div class="meta-item">
                        <strong>Company:</strong> ${task.company_display_name || task.company}
                    </div>
                    <div class="meta-item">
                        <strong>Due Date:</strong> ${task.dueDate || 'Not set'}
                    </div>
                    <div class="meta-item">
                        <strong>Status Priority:</strong> ${task.status_priority || 'N/A'}
                    </div>
                    <div class="meta-item">
                        <strong>Progress:</strong> ${task.progress || 0}%
                    </div>
                    <div class="meta-item">
                        <strong>High Priority:</strong> ${task.isHighPriority ? '🔥 Yes' : '📋 No'}
                    </div>
                    <div class="meta-item">
                        <strong>Complete:</strong> ${task.isComplete ? '✅ Yes' : '⏳ No'}
                    </div>
                    <div class="meta-item">
                        <strong>Overdue:</strong> ${task.isOverdue ? '⚠️ Yes' : '✅ No'}
                    </div>
                </div>
                
                <h4>👥 Assignment Information</h4>
                <div class="assignment-info">
                    <div class="meta-item">
                        <strong>Assigned To:</strong> ${assignedToDisplay}
                    </div>
                    <div class="meta-item">
                        <strong>Assignment Details:</strong> ${assignedDetailsDisplay}
                    </div>
                </div>
                
                <h4>📅 Timeline Information</h4>
                <div class="timeline-info">
                    <div class="meta-item">
                        <strong>Created:</strong> ${task.createdDate || 'Unknown'}
                    </div>
                    <div class="meta-item">
                        <strong>Last Updated:</strong> ${task.updatedDate || 'Unknown'}
                    </div>
                    <div class="meta-item">
                        <strong>Retrieved At:</strong> ${task.retrievedAt ? new Date(task.retrievedAt).toLocaleString() : 'Unknown'}
                    </div>
                </div>
                
                <h4>🔗 Board References</h4>
                <div class="board-refs">
                    <div class="meta-item">
                        <strong>Master Board ID:</strong> 
                        <code>${masterBoardId}</code>
                    </div>
                    <div class="meta-item">
                        <strong>Company Board ID:</strong> 
                        <code>${companyBoardId}</code>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Store current task data for saving (with enhanced format)
    window.currentEditingTask = {
        ...task,
        masterBoardId: masterBoardId,
        companyBoardId: companyBoardId
    };
    
    // Show footer buttons
    document.getElementById('taskEditorFooter').style.display = 'flex';
}

// ENHANCED TASK SAVE - PRESERVES ALL INFINITY DATA
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
    
    // ENHANCED: Create task with ALL Infinity data preserved
    const taskForDashboard = {
        // Basic identifiers
        id: `${masterBoardId}_${companyBoardId}`,
        masterBoardId: masterBoardId,
        companyBoardId: companyBoardId,
        
        // Task information from Infinity
        name: task.name || 'Imported Task',
        company: task.company || 'Unknown Company',
        company_display_name: task.company_display_name || task.company || 'Unknown Company',
        description: task.description || '',
        notes: task.notes || '',
        
        // Status and progress from Infinity
        status: task.status || 'Project',
        status_priority: task.status_priority || 1,
        status_color: task.status_color || '#718096',
        progress: task.progress || 0,
        
        // Date information from Infinity
        dueDate: task.dueDate || 'Not set',
        dueDateRaw: task.dueDateRaw || null,
        createdDate: task.createdDate || new Date().toLocaleDateString(),
        updatedDate: task.updatedDate || new Date().toLocaleDateString(),
        createdDateRaw: task.createdDateRaw || null,
        updatedDateRaw: task.updatedDateRaw || null,
        
        // Assignment information from Infinity
        assignedTo: task.assignedTo || [],
        assignedDetails: task.assignedDetails || [],
        
        // Task flags from Infinity
        isHighPriority: task.isHighPriority || false,
        isComplete: task.isComplete || false,
        isOverdue: task.isOverdue || false,
        
        // Metadata
        importedBy: currentEmployee,
        importedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        retrievedAt: task.retrievedAt || new Date().toISOString(),
        
        // Source tracking
        source: 'infinity_import',
        sourceWorkflow: 'n8n_get_tasks'
    };
    
    // Check if task already exists and update or add
    const existingIndex = myTasks.findIndex(t => t.id === taskForDashboard.id);
    if (existingIndex >= 0) {
        // Preserve some local data when updating
        const existing = myTasks[existingIndex];
        taskForDashboard.importedAt = existing.importedAt; // Keep original import time
        taskForDashboard.localNotes = existing.localNotes || ''; // Preserve local notes
        
        myTasks[existingIndex] = taskForDashboard;
        console.log('📝 Task updated in dashboard:', taskForDashboard.name);
    } else {
        myTasks.push(taskForDashboard);
        console.log('📥 Task added to dashboard:', taskForDashboard.name);
    }
    
    // Save back to localStorage
    localStorage.setItem(tasksKey, JSON.stringify(myTasks));
    
    // Update availableTasks array for the UI
    availableTasks = myTasks;
    
    console.log(`✅ Task saved to ${currentEmployee}'s dashboard:`, {
        name: taskForDashboard.name,
        company: taskForDashboard.company,
        progress: taskForDashboard.progress,
        status: taskForDashboard.status,
        assigned: taskForDashboard.assignedTo.length,
        priority: taskForDashboard.isHighPriority
    });
}

// ENHANCED TASK UPDATE - SYNCS BACK TO INFINITY VIA N8N
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
    
    // UPDATED: Use your n8n task-update webhook format
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
        
        console.log('📤 Sending update to n8n:', updateData);
        
        const response = await fetch(CONFIG.taskUpdateUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        console.log('📨 Update response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('📤 Update response:', result);
            
            if (result.success) {
                // Update local dashboard with new values
                await updateTaskInMyDashboard(masterBoardId, companyBoardId, {
                    name: taskName,
                    progress: progress,
                    status: status,
                    description: description,
                    notes: notes,
                    lastUpdated: new Date().toISOString()
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
            notes: notes,
            lastUpdated: new Date().toISOString()
        });
        
        showToast('⚠️ Updated locally, but failed to sync with Infinity: ' + error.message, 'warning');
        await loadAssignedTasks();
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
            statusMessage = `Shift ended at ${time}`;
            statusClass = 'status-finished';
            break;
        default:
            statusMessage = action;
            statusClass = 'status-default';
    }
    
    statusDiv.textContent = statusMessage;
    statusDiv.className = `time-clock-status ${statusClass}`;
}

function stopAllClocks() {
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
    
    document.getElementById('workClockDisplay').style.display = 'none';
    document.getElementById('breakClockDisplay').style.display = 'none';
    
    clearWorkClockState();
}

function clearWorkClockState() {
    if (!currentEmployee) return;
    
    const clockStateKey = `clockState_${currentEmployee}`;
    localStorage.removeItem(clockStateKey);
    
    dailyShiftData = null;
    currentWorkSession = null;
    currentBreakSession = null;
    
    if (workClockInterval) {
        clearInterval(workClockInterval);
        workClockInterval = null;
    }
    
    if (breakClockInterval) {
        clearInterval(breakClockInterval);
        breakClockInterval = null;
    }
    
    document.getElementById('workClockDisplay').style.display = 'none';
    document.getElementById('breakClockDisplay').style.display = 'none';
}

function saveWorkClockState(type, startTime) {
    if (!currentEmployee) return;
    
    const clockStateKey = `clockState_${currentEmployee}`;
    const state = {
        type: type,
        startTime: startTime.toISOString(),
        dailyShiftData: dailyShiftData,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem(clockStateKey, JSON.stringify(state));
}

async function loadWorkClockState() {
    if (!currentEmployee) return;
    
    const clockStateKey = `clockState_${currentEmployee}`;
    const saved = localStorage.getItem(clockStateKey);
    
    if (!saved) return;
    
    try {
        const state = JSON.parse(saved);
        const savedDate = new Date(state.timestamp).toDateString();
        const today = new Date().toDateString();
        
        if (savedDate !== today) {
            localStorage.removeItem(clockStateKey);
            return;
        }
        
        dailyShiftData = state.dailyShiftData || null;
        const startTime = new Date(state.startTime);
        
        if (state.type === 'working') {
            currentWorkSession = {
                startTime: startTime,
                lastUpdate: new Date()
            };
            startWorkClock();
        } else if (state.type === 'break') {
            currentBreakSession = {
                startTime: startTime,
                lastUpdate: new Date()
            };
            startBreakClock();
        }
        
    } catch (error) {
        console.error('Error loading work clock state:', error);
        localStorage.removeItem(clockStateKey);
    }
}

function showShiftSummary() {
    if (!dailyShiftData) return;
    
    const totalHours = dailyShiftData.totalWorkedMs / (1000 * 60 * 60);
    const sessionCount = dailyShiftData.workSessions.length;
    
    let summaryMessage = `🎯 Shift Complete!\n\n`;
    summaryMessage += `⏱️ Total Time: ${totalHours.toFixed(1)} hours\n`;
    summaryMessage += `📊 Work Sessions: ${sessionCount}\n`;
    
    if (totalHours >= 8) {
        summaryMessage += `✅ Full shift completed!`;
        if (totalHours > 8.5) {
            summaryMessage += ` (+${(totalHours - 8).toFixed(1)}h overtime)`;
        }
    } else {
        summaryMessage += `⚠️ Partial shift (${(8 - totalHours).toFixed(1)}h short)`;
    }
    
    showToast(summaryMessage, 'success');
}

// ============= ASSIGNED TASKS MANAGEMENT =============

async function loadAssignedTasks() {
    if (!currentEmployee) {
        document.getElementById('assignedTasksList').innerHTML = '<p class="loading">Select an employee to view assigned tasks...</p>';
        return;
    }
    
    console.log('🔄 Loading assigned tasks for:', currentEmployee);
    
    const tasksKey = `myTasks_${currentEmployee}`;
    
    try {
        const saved = localStorage.getItem(tasksKey);
        if (saved) {
            availableTasks = JSON.parse(saved);
        } else {
            availableTasks = [];
        }
        
        displayAssignedTasks();
        
    } catch (error) {
        console.error('Error loading assigned tasks:', error);
        availableTasks = [];
        displayAssignedTasks();
    }
}

function displayAssignedTasks() {
    const container = document.getElementById('assignedTasksList');
    
    if (!availableTasks || availableTasks.length === 0) {
        container.innerHTML = `
            <div class="no-tasks">
                <p>No tasks in your dashboard yet</p>
                <button class="btn btn-primary" onclick="openTaskEditorModal()">
                    📥 Import Task from Infinity
                </button>
            </div>
        `;
        return;
    }
    
    // Sort tasks by priority and status
    const sortedTasks = [...availableTasks].sort((a, b) => {
        // First by high priority
        if (a.isHighPriority && !b.isHighPriority) return -1;
        if (!a.isHighPriority && b.isHighPriority) return 1;
        
        // Then by status priority
        const aPriority = a.status_priority || 1;
        const bPriority = b.status_priority || 1;
        if (aPriority !== bPriority) return bPriority - aPriority;
        
        // Then by progress (incomplete first)
        const aProgress = a.progress || 0;
        const bProgress = b.progress || 0;
        if (aProgress >= 100 && bProgress < 100) return 1;
        if (aProgress < 100 && bProgress >= 100) return -1;
        
        // Finally by last updated
        const aDate = new Date(a.lastUpdated || a.importedAt || 0);
        const bDate = new Date(b.lastUpdated || b.importedAt || 0);
        return bDate - aDate;
    });
    
    const tasksHTML = sortedTasks.map(task => createTaskHTML(task)).join('');
    
    container.innerHTML = `
        <div class="tasks-header">
            <h3>📋 My Assigned Tasks (${availableTasks.length})</h3>
            <div class="tasks-actions">
                <button class="btn btn-sm btn-primary" onclick="openTaskEditorModal()">
                    📥 Import from Infinity
                </button>
                <button class="btn btn-sm btn-secondary" onclick="loadAssignedTasks()">
                    🔄 Refresh
                </button>
            </div>
        </div>
        <div class="tasks-grid">
            ${tasksHTML}
        </div>
    `;
}

// ENHANCED TASK CARD CREATION - SHOWS ALL INFINITY ATTRIBUTES
function createTaskHTML(task) {
    const progressClass = getProgressClass(task.progress || 0);
    const statusBadgeClass = getStatusBadgeClass(task.status || 'Project');
    
    // Enhanced priority and status icons
    const priorityIcon = task.isHighPriority ? '🔥' : '📋';
    const overdueIcon = task.isOverdue ? '⚠️' : '';
    const completeIcon = task.isComplete ? '✅' : '';
    const infinityIcon = '📥'; // Shows this was imported from Infinity
    
    // Enhanced assigned users display
    let assignedDisplay = 'Not assigned';
    let assignedDetails = '';
    
    if (task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
        assignedDisplay = task.assignedTo.slice(0, 2).join(', ');
        if (task.assignedTo.length > 2) {
            assignedDisplay += ` +${task.assignedTo.length - 2} more`;
        }
        
        // Show detailed assignment info if available
        if (task.assignedDetails && task.assignedDetails.length > 0) {
            assignedDetails = task.assignedDetails
                .slice(0, 2)
                .map(user => `${user.name} (${user.role})`)
                .join(', ');
        }
    }
    
    // Enhanced status color from Infinity
    const statusColor = task.status_color || '#718096';
    
    return `
        <div class="task-card imported-task-card" data-task-id="${task.id}">
            <div class="task-header">
                <div class="task-title">
                    ${infinityIcon} ${priorityIcon} ${overdueIcon} ${completeIcon}
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
                <span class="status-badge ${statusBadgeClass}" style="background-color: ${statusColor}20; border-color: ${statusColor}; color: ${statusColor};">
                    ${task.status}
                </span>
                <div class="task-badges">
                    <span class="infinity-badge">From Infinity</span>
                    ${task.isHighPriority ? '<span class="priority-badge">High Priority</span>' : ''}
                </div>
            </div>
            
            <!-- ENHANCED PROGRESS DISPLAY -->
            <div class="task-progress">
                <div class="progress-label">
                    Progress: ${task.progress || 0}% 
                    ${task.isComplete ? '(Complete)' : ''}
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar ${progressClass}" style="width: ${task.progress || 0}%"></div>
                </div>
            </div>
            
            <div class="task-details">
                ${task.description ? `<p class="task-description">${task.description.length > 150 ? task.description.substring(0, 147) + '...' : task.description}</p>` : ''}
                
                <div class="task-info-grid">
                    <div class="info-item">
                        <span class="info-label">Due Date:</span>
                        <span class="info-value ${task.isOverdue ? 'overdue' : ''}">${task.dueDate}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Assigned:</span>
                        <span class="info-value" title="${assignedDetails}">${assignedDisplay}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Status Level:</span>
                        <span class="info-value">Priority ${task.status_priority || 1}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Last Updated:</span>
                        <span class="info-value">${task.updatedDate || task.createdDate}</span>
                    </div>
                </div>
                
                <!-- ENHANCED NOTES SECTION -->
                ${task.notes ? `
                <div class="task-notes">
                    <strong>Notes:</strong>
                    <p>${task.notes.length > 100 ? task.notes.substring(0, 97) + '...' : task.notes}</p>
                </div>
                ` : ''}
                
                <!-- BOARD ID REFERENCES -->
                <div class="task-ids">
                    <small>Master: ${task.masterBoardId}</small>
                    <small>Company: ${task.companyBoardId}</small>
                    <small>Retrieved: ${task.retrievedAt ? new Date(task.retrievedAt).toLocaleTimeString() : 'N/A'}</small>
                </div>
            </div>
        </div>
    `;
}

// HELPER FUNCTIONS FOR ENHANCED DISPLAY
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

function updateProgressDisplay(value) {
    const display = document.getElementById('progressDisplay');
    const bar = document.getElementById('editProgressBar');
    
    if (display) display.textContent = `${value}%`;
    if (bar) {
        bar.style.width = `${value}%`;
        bar.className = `progress-bar ${getProgressClass(parseInt(value))}`;
    }
}

async function editTaskFromDashboard(taskId) {
    const task = availableTasks.find(t => t.id === taskId);
    if (!task) {
        showToast('Task not found', 'error');
        return;
    }
    
    // Open task editor modal
    openTaskEditorModal();
    
    // Pre-fill the IDs
    document.getElementById('masterBoardId').value = task.masterBoardId || '';
    document.getElementById('companyBoardId').value = task.companyBoardId || '';
    
    // Display the task for editing
    displayTaskForEditing(task, task.masterBoardId, task.companyBoardId);
}

async function removeTaskFromDashboard(taskId) {
    if (!confirm('Are you sure you want to remove this task from your dashboard?\n\nThis will not delete the task from Infinity.')) {
        return;
    }
    
    if (!currentEmployee) return;
    
    const tasksKey = `myTasks_${currentEmployee}`;
    let myTasks = [];
    
    try {
        const saved = localStorage.getItem(tasksKey);
        if (saved) {
            myTasks = JSON.parse(saved);
        }
    } catch (error) {
        console.error('Error loading tasks for removal:', error);
        return;
    }
    
    // Remove task
    myTasks = myTasks.filter(task => task.id !== taskId);
    
    // Save back to localStorage
    localStorage.setItem(tasksKey, JSON.stringify(myTasks));
    
    // Update availableTasks array
    availableTasks = myTasks;
    
    // Refresh display
    displayAssignedTasks();
    
    showToast('✅ Task removed from your dashboard', 'success');
}

// ============= TASK INTAKE FORM HANDLER =============

async function handleTaskIntake(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const taskData = {};
    
    // Extract form data
    for (let [key, value] of formData.entries()) {
        if (key !== 'taskImage') {
            taskData[key] = value;
        }
    }
    
    // Handle image upload
    const imageFile = document.getElementById('taskImage').files[0];
    let imageUrl = '';
    
    if (imageFile) {
        try {
            showToast('📤 Uploading image...', 'info');
            imageUrl = await uploadToImgBB(imageFile);
            taskData['Image_URL'] = imageUrl;
        } catch (error) {
            console.error('Image upload failed:', error);
            showToast('⚠️ Image upload failed, continuing without image', 'warning');
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
            showToast('✅ Task created successfully!', 'success');
            e.target.reset();
            document.getElementById('taskImagePreview').style.display = 'none';
        } else {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
    } catch (error) {
        console.error('Error creating task:', error);
        showToast('❌ Failed to create task: ' + error.message, 'error');
    }
}

// ============= DAILY REPORT FORM HANDLER =============

async function handleDailyReport(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const reportData = {};
    
    // Extract form data
    for (let [key, value] of formData.entries()) {
        if (key !== 'reportPhoto') {
            reportData[key] = value;
        }
    }
    
    // Handle photo upload
    const photoFile = document.getElementById('reportPhoto').files[0];
    let photoUrl = '';
    
    if (photoFile) {
        try {
            showToast('📤 Uploading photo...', 'info');
            photoUrl = await uploadToImgBB(photoFile);
            reportData['Photo for report'] = photoUrl;
        } catch (error) {
            console.error('Photo upload failed:', error);
            showToast('⚠️ Photo upload failed, continuing without photo', 'warning');
        }
    }
    
    try {
        showToast('📊 Submitting daily report...', 'info');
        
        const response = await fetch(CONFIG.reportLoggerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportData)
        });
        
        if (response.ok) {
            showToast('✅ Daily report submitted successfully!', 'success');
            e.target.reset();
            document.getElementById('reportPhotoPreview').style.display = 'none';
            
            // Reset date to today
            document.getElementById('reportDate').valueAsDate = new Date();
        } else {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
    } catch (error) {
        console.error('Error submitting daily report:', error);
        showToast('❌ Failed to submit daily report: ' + error.message, 'error');
    }
}

// ============= IMAGE UPLOAD UTILITIES =============

async function uploadToImgBB(file) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('key', CONFIG.imgbbApiKey);
    
    const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`ImgBB upload failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
        throw new Error('ImgBB upload unsuccessful');
    }
    
    return data.data.url;
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

// ============= OVERRIDE BUTTON FOR TESTING =============

function initializeOverrideButton() {
    const overrideHTML = `
        <div id="overrideSection" class="override-section" style="position: fixed; bottom: 20px; right: 20px; z-index: 1000;">
            <button id="overrideBtn" class="btn btn-warning btn-sm" onclick="toggleOverrideMode()" title="Enable Override Mode">
                🔧 Override
            </button>
            <div id="overrideControls" class="override-controls" style="display: none; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--spacing-md); margin-top: var(--spacing-sm); min-width: 200px;">
                <h4>Override Mode</h4>
                <button class="btn btn-sm btn-secondary" onclick="resetWorkflowState()">Reset Workflow</button>
                <button class="btn btn-sm btn-secondary" onclick="clearAllData()">Clear All Data</button>
                <button class="btn btn-sm btn-secondary" onclick="setWorkflowState('not_started')">Set: Not Started</button>
                <button class="btn btn-sm btn-secondary" onclick="setWorkflowState('working')">Set: Working</button>
                <button class="btn btn-sm btn-secondary" onclick="setWorkflowState('on_break')">Set: On Break</button>
                <button class="btn btn-sm btn-secondary" onclick="setWorkflowState('finished')">Set: Finished</button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', overrideHTML);
}

function toggleOverrideMode() {
    const controls = document.getElementById('overrideControls');
    const btn = document.getElementById('overrideBtn');
    
    if (controls.style.display === 'none') {
        controls.style.display = 'block';
        btn.textContent = '🔧 Close';
        btn.className = 'btn btn-danger btn-sm';
    } else {
        controls.style.display = 'none';
        btn.textContent = '🔧 Override';
        btn.className = 'btn btn-warning btn-sm';
    }
}

function resetWorkflowState() {
    if (!confirm('Reset workflow state? This will clear all clock data.')) return;
    
    currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
    clearWorkClockState();
    updateWorkflowButtonStates();
    saveWorkflowState();
    
    showToast('🔄 Workflow state reset to NOT_STARTED', 'info');
}

function clearAllData() {
    if (!confirm('Clear ALL data including tasks and time logs? This cannot be undone.')) return;
    
    if (!currentEmployee) {
        showToast('Select an employee first', 'warning');
        return;
    }
    
    // Clear all employee data
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.includes(currentEmployee)) {
            localStorage.removeItem(key);
        }
    });
    
    // Reset state
    availableTasks = [];
    currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
    clearWorkClockState();
    updateWorkflowButtonStates();
    displayAssignedTasks();
    
    showToast('🗑️ All data cleared for ' + currentEmployee, 'info');
}

function setWorkflowState(state) {
    const stateMap = {
        'not_started': WORKFLOW_STATES.NOT_STARTED,
        'working': WORKFLOW_STATES.WORKING,
        'on_break': WORKFLOW_STATES.ON_BREAK,
        'finished': WORKFLOW_STATES.FINISHED
    };
    
    if (!stateMap[state]) {
        showToast('Invalid state', 'error');
        return;
    }
    
    currentWorkflowState = stateMap[state];
    updateWorkflowButtonStates();
    saveWorkflowState();
    
    showToast(`🔧 Workflow state set to: ${state.toUpperCase()}`, 'info');
}
