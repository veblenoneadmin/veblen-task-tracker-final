// Configuration - SIMPLIFIED VERSION
const CONFIG = {
    taskIntakeUrl: 'https://primary-s0q-production.up.railway.app/webhook/taskintakewebhook',
    taskUpdateUrl: 'https://primary-s0q-production.up.railway.app/webhook/task-update',
    timeLoggerUrl: 'https://primary-s0q-production.up.railway.app/webhook/timelogging',
    reportLoggerUrl: 'https://primary-s0q-production.up.railway.app/webhook/reportlogging',
    taskRetrievalUrl: 'https://primary-s0q-production.up.railway.app/webhook/get-tasks',
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

// TESTING BYPASS FUNCTIONALITY - ADMIN ONLY
const BYPASS_PASSWORD = 'veblenone123';

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    
    // Add password input handler
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                validatePassword();
            }
        });
    }
});

function initializeApp() {
    console.log('🚀 Initializing VEBLEN Task Tracker...');
    
    // Initialize Brisbane clock first
    initializeBrisbaneClock();
    
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

// ============= TESTING BYPASS FUNCTIONS =============

function openPasswordModal() {
    const modal = document.getElementById('passwordModal');
    const input = document.getElementById('passwordInput');
    const error = document.getElementById('passwordError');
    const success = document.getElementById('passwordSuccess');
    
    // Reset modal state
    input.value = '';
    error.style.display = 'none';
    success.style.display = 'none';
    
    modal.style.display = 'block';
    
    // Focus on input after modal is shown
    setTimeout(() => input.focus(), 100);
}

function closePasswordModal() {
    const modal = document.getElementById('passwordModal');
    modal.style.display = 'none';
}

function validatePassword() {
    const input = document.getElementById('passwordInput');
    const error = document.getElementById('passwordError');
    const success = document.getElementById('passwordSuccess');
    const confirmBtn = document.querySelector('.password-btn-confirm');
    
    const enteredPassword = input.value.trim();
    
    if (enteredPassword === BYPASS_PASSWORD) {
        // Show success message
        error.style.display = 'none';
        success.style.display = 'block';
        confirmBtn.disabled = true;
        
        // Perform testing reset after short delay
        setTimeout(() => {
            performTestingBypass();
            closePasswordModal();
            showToast('🧪 TESTING MODE: Shift reset for testing only', 'success');
        }, 1500);
        
    } else {
        // Show error message
        success.style.display = 'none';
        error.style.display = 'block';
        
        // Clear input and shake effect
        input.value = '';
        input.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            input.style.animation = '';
            input.focus();
        }, 500);
    }
}

function performTestingBypass() {
    console.log('🧪 ADMIN TESTING: Performing bypass reset for testing purposes only...');
    
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    // THIS IS ONLY FOR TESTING - Normal workflow restrictions remain for regular users
    
    // Reset workflow state for testing
    currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
    
    // Clear stored testing states
    const workflowStateKey = `workflowState_${currentEmployee}`;
    const clockStateKey = `workClock_${currentEmployee}`;
    
    localStorage.removeItem(workflowStateKey);
    localStorage.removeItem(clockStateKey);
    
    // Clear any active timers for testing
    clearWorkClockState();
    
    // Reset button states for testing
    updateWorkflowButtonStates();
    
    // Update status with testing indicator
    updateTimeClockStatus('🧪 TESTING MODE: Ready to start your shift', new Date());
    
    // Save the reset state
    saveWorkflowState();
    
    console.log('✅ TESTING BYPASS: System reset for admin testing - normal users remain in their workflow states');
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

// ============= SIMPLIFIED TASK IMPORT & MANAGEMENT =============

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

// Enhanced import function with immediate dashboard display
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
        
        // Fetch task data from Infinity
        const response = await fetch(CONFIG.taskRetrievalUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get_task_by_ids',
                master_board_id: masterBoardId,
                company_board_id: companyBoardId
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.task) {
                // Add task to user's personal dashboard
                await saveTaskToMyDashboard(data.task, masterBoardId, companyBoardId);
                
                // Close the import modal
                closeTaskEditorModal();
                
                // Immediately refresh the dashboard to show the new task
                await loadAssignedTasks();
                
                showToast('✅ Task imported successfully! Now visible on your dashboard.', 'success');
                
                // Auto-scroll to the new task
                setTimeout(() => {
                    const taskCards = document.querySelectorAll('.task-card');
                    if (taskCards.length > 0) {
                        taskCards[taskCards.length - 1].scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center' 
                        });
                    }
                }, 500);
                
            } else {
                throw new Error(data.message || 'Task not found in Infinity');
            }
        } else {
            // If API fails, allow manual entry
            showManualTaskEntry(masterBoardId, companyBoardId);
        }
    } catch (error) {
        console.error('Error importing task from Infinity:', error);
        // Allow manual entry if API fails
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

// Enhanced task saving with better data structure
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
    
    // Create enhanced task with Infinity IDs
    const taskForDashboard = {
        id: `${masterBoardId}_${companyBoardId}`,
        name: task.name || 'Imported Task',
        company: task.company || 'Unknown Company',
        progress: task.progress || 0,
        status: task.status || 'Current Project',
        description: task.description || '',
        notes: task.notes || '',
        dueDate: task.dueDate || 'Not set',
        createdDate: task.createdDate || new Date().toLocaleDateString(),
        masterBoardId: masterBoardId,
        companyBoardId: companyBoardId,
        importedBy: currentEmployee,
        importedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'synced', // synced, pending, error
        isEditable: true
    };
    
    // Check if task already exists
    const existingIndex = myTasks.findIndex(t => t.id === taskForDashboard.id);
    if (existingIndex >= 0) {
        // Update existing task but preserve edit status
        myTasks[existingIndex] = {
            ...myTasks[existingIndex],
            ...taskForDashboard,
            lastUpdated: new Date().toISOString()
        };
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

function displayTaskForEditing(task, masterBoardId, companyBoardId) {
    const content = document.getElementById('taskEditorContent');
    
    content.innerHTML = `
        <div class="task-editor-form">
            <div class="task-info-header">
                <h3>${task.name || 'Imported Task'}</h3>
                <span class="task-company-badge">${task.company || 'Unknown Company'}</span>
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
                <p><strong>Imported:</strong> ${new Date().toLocaleString()}</p>
            </div>
        </div>
    `;
    
    // Store current task data for saving
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
        
        // Update in Infinity
        const response = await fetch(CONFIG.taskUpdateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            const result = await response.json();
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
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error updating task in Infinity:', error);
        
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
        case '🧪 TESTING MODE: Ready to start your shift':
            statusMessage = '🧪 TESTING MODE: Ready to start your shift';
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
                dailyShiftData = state.dailyShiftData || {
                    totalWorkedMs: 0,
                    workSessions: [],
                    shiftStartTime: null,
                    targetShiftMs: 8 * 60 * 60 * 1000
                };
                
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

function saveWorkClockState(status, startTime) {
    if (!currentEmployee) return;
    
    const clockStateKey = `workClock_${currentEmployee}`;
    const state = {
        status: status,
        startTime: startTime.toISOString(),
        lastUpdate: new Date().toISOString(),
        employee: currentEmployee,
        dailyShiftData: dailyShiftData
    };
    
    localStorage.setItem(clockStateKey, JSON.stringify(state));
}

function clearWorkClockState() {
    if (workClockInterval) {
        clearInterval(workClockInterval);
        workClockInterval = null;
    }
    
    if (breakClockInterval) {
        clearInterval(breakClockInterval);
        breakClockInterval = null;
    }
    
    const workDisplay = document.getElementById('workClockDisplay');
    const breakDisplay = document.getElementById('breakClockDisplay');
    
    if (workDisplay) workDisplay.style.display = 'none';
    if (breakDisplay) breakDisplay.style.display = 'none';
    
    currentWorkSession = null;
    currentBreakSession = null;
    dailyShiftData = null;
    
    if (currentEmployee) {
        const clockStateKey = `workClock_${currentEmployee}`;
        localStorage.removeItem(clockStateKey);
    }
}

function stopAllClocks() {
    clearWorkClockState();
    
    if (currentEmployee) {
        const clockStateKey = `workClock_${currentEmployee}`;
        saveWorkClockState('stopped', new Date());
    }
}

// Load user's imported tasks from dashboard
async function loadAssignedTasks() {
    console.log('📋 Loading your imported tasks...');
    if (!currentEmployee) {
        document.getElementById('assignedTasksList').innerHTML = '<p class="loading">Select an employee to view assigned tasks...</p>';
        return;
    }
    
    try {
        // Load user's personal imported tasks
        const tasksKey = `myTasks_${currentEmployee}`;
        const saved = localStorage.getItem(tasksKey);
        let myTasks = [];
        
        if (saved) {
            myTasks = JSON.parse(saved);
            availableTasks = myTasks;
        }
        
        if (myTasks.length === 0) {
            document.getElementById('assignedTasksList').innerHTML = `
                <p class="loading">No tasks imported yet.</p>
                <div style="background: rgba(102, 126, 234, 0.1); border: 2px solid rgba(102, 126, 234, 0.3); border-radius: var(--radius-md); padding: var(--spacing-lg); margin-top: var(--spacing-md);">
                    <h4 style="color: var(--text-primary); margin-bottom: var(--spacing-sm);">📥 Import Your First Task:</h4>
                    <p style="color: var(--text-secondary); margin-bottom: var(--spacing-sm);">1. Click "📥 Import Task from Infinity" button above</p>
                    <p style="color: var(--text-secondary); margin-bottom: var(--spacing-sm);">2. Enter your Master Board Item ID and Company Board Item ID</p>
                    <p style="color: var(--text-secondary); margin-bottom: var(--spacing-sm);">3. Click "Import Task" to add it to your personal dashboard</p>
                    <p style="color: var(--text-secondary);">4. Edit progress, status, and sync changes back to Infinity</p>
                </div>
            `;
            return;
        }
        
        // Render imported tasks
        renderMyImportedTasks(myTasks);
        showToast(`📋 Loaded ${myTasks.length} imported task${myTasks.length === 1 ? '' : 's'}`, 'info');
        
    } catch (error) {
        console.error('Error loading imported tasks:', error);
        document.getElementById('assignedTasksList').innerHTML = '<p class="loading" style="color: var(--text-error);">Error loading your tasks. Please try refreshing.</p>';
        showToast('Error loading your imported tasks', 'error');
    }
}

// Enhanced dashboard rendering with edit capabilities
function renderMyImportedTasks(tasks) {
    const tasksList = document.getElementById('assignedTasksList');
    
    if (tasks.length === 0) {
        tasksList.innerHTML = `
            <div style="text-align: center; padding: var(--spacing-2xl);">
                <p style="color: var(--text-secondary); margin-bottom: var(--spacing-lg);">No tasks imported yet.</p>
                <div style="background: rgba(102, 126, 234, 0.1); border: 2px solid rgba(102, 126, 234, 0.3); border-radius: var(--radius-lg); padding: var(--spacing-xl);">
                    <h4 style="color: var(--text-primary); margin-bottom: var(--spacing-md);">📥 Import Your First Task:</h4>
                    <p style="color: var(--text-secondary); margin-bottom: var(--spacing-sm);">1. Click "📥 Import Task from Infinity" button above</p>
                    <p style="color: var(--text-secondary); margin-bottom: var(--spacing-sm);">2. Enter Master Board Item ID and Company Board Item ID</p>
                    <p style="color: var(--text-secondary);">3. Task will appear here for editing and syncing</p>
                </div>
            </div>
        `;
        return;
    }
    
    tasksList.innerHTML = `
        <div style="margin-bottom: var(--spacing-xl); text-align: center;">
            <h3 style="color: var(--text-primary); margin-bottom: var(--spacing-sm);">📋 Your Personal Task Dashboard</h3>
            <p style="color: var(--text-secondary);">${tasks.length} imported task${tasks.length === 1 ? '' : 's'} • Click any task to edit inline</p>
        </div>
        <div class="tasks-grid">
            ${tasks.map(task => createTaskCard(task)).join('')}
        </div>
    `;
    
    // Add event listeners for inline editing
    tasks.forEach(task => {
        attachTaskEventListeners(task.id);
    });
}
// Create enhanced task card with inline editing
function createTaskCard(task) {
    const syncStatusIcon = getSyncStatusIcon(task.syncStatus);
    const statusClass = getStatusClass(task.status);
    
    return `
        <div class="task-card enhanced-task-card" data-task-id="${task.id}">
            <div class="task-card-header">
                <div class="task-title-section">
                    <input type="text" 
                           class="task-name-edit" 
                           value="${task.name}" 
                           data-field="name"
                           placeholder="Task name...">
                    <div class="task-badges">
                        <span class="task-status ${statusClass}">${task.status}</span>
                        <span class="sync-status ${task.syncStatus}">${syncStatusIcon}</span>
                    </div>
                </div>
            </div>
            
            <div class="task-details">
                <div class="task-field">
                    <label>Company:</label>
                    <span class="company-badge">${task.company}</span>
                </div>
                
                <div class="task-field">
                    <label>Description:</label>
                    <textarea class="task-description-edit" 
                              data-field="description" 
                              placeholder="Add description...">${task.description}</textarea>
                </div>
                
                <div class="task-field">
                    <label>Status:</label>
                    <select class="task-status-edit" data-field="status">
                        <option value="Project" ${task.status === 'Project' ? 'selected' : ''}>Project</option>
                        <option value="Priority Project" ${task.status === 'Priority Project' ? 'selected' : ''}>Priority Project</option>
                        <option value="Current Project" ${task.status === 'Current Project' ? 'selected' : ''}>Current Project</option>
                        <option value="Revision" ${task.status === 'Revision' ? 'selected' : ''}>Revision</option>
                        <option value="Waiting Approval" ${task.status === 'Waiting Approval' ? 'selected' : ''}>Waiting Approval</option>
                        <option value="Project Finished" ${task.status === 'Project Finished' ? 'selected' : ''}>Project Finished</option>
                        <option value="Rejected" ${task.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                    </select>
                </div>
                
                <div class="task-field">
                    <label>Progress:</label>
                    <div class="progress-control">
                        <input type="range" 
                               class="task-progress-edit" 
                               data-field="progress"
                               min="0" 
                               max="100" 
                               value="${task.progress}">
                        <span class="progress-value">${task.progress}%</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${task.progress}%"></div>
                    </div>
                </div>
                
                <div class="task-field">
                    <label>Notes:</label>
                    <textarea class="task-notes-edit" 
                              data-field="notes" 
                              placeholder="Add notes...">${task.notes}</textarea>
                </div>
            </div>
            
            <div class="task-meta-info">
                <div class="meta-row">
                    <span><strong>Master ID:</strong> ${task.masterBoardId}</span>
                    <span><strong>Company ID:</strong> ${task.companyBoardId}</span>
                </div>
                <div class="meta-row">
                    <span><strong>Due:</strong> ${task.dueDate}</span>
                    <span><strong>Last Sync:</strong> ${formatDate(task.lastSyncedAt)}</span>
                </div>
            </div>
            
            <div class="task-actions">
                <button class="btn btn-primary btn-sm sync-btn" onclick="syncTaskWithInfinity('${task.id}')">
                    🔄 Sync to Infinity
                </button>
                <button class="btn btn-secondary btn-sm save-btn" onclick="saveTaskChanges('${task.id}')" style="display: none;">
                    💾 Save Changes
                </button>
                <button class="btn btn-danger btn-sm" onclick="removeImportedTask('${task.id}')">
                    🗑️ Remove
                </button>
            </div>
        </div>
    `;
}

// Attach event listeners for inline editing
function attachTaskEventListeners(taskId) {
    const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!taskCard) return;
    
    const editableFields = taskCard.querySelectorAll('.task-name-edit, .task-description-edit, .task-status-edit, .task-progress-edit, .task-notes-edit');
    
    editableFields.forEach(field => {
        field.addEventListener('input', () => handleTaskFieldChange(taskId, field));
        field.addEventListener('change', () => handleTaskFieldChange(taskId, field));
    });
}

// Handle field changes and show save button
function handleTaskFieldChange(taskId, field) {
    const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
    const saveBtn = taskCard.querySelector('.save-btn');
    const syncBtn = taskCard.querySelector('.sync-btn');
    
    // Show save button, hide sync button
    saveBtn.style.display = 'inline-flex';
    syncBtn.style.opacity = '0.5';
    
    // Update progress display if it's the progress field
    if (field.classList.contains('task-progress-edit')) {
        const progressValue = taskCard.querySelector('.progress-value');
        const progressBar = taskCard.querySelector('.progress-bar');
        const value = field.value;
        
        progressValue.textContent = `${value}%`;
        progressBar.style.width = `${value}%`;
    }
    
    // Mark task as having unsaved changes
    taskCard.classList.add('has-unsaved-changes');
    
    // Update sync status
    updateTaskSyncStatus(taskId, 'pending');
}

// Save task changes locally
async function saveTaskChanges(taskId) {
    const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
    const saveBtn = taskCard.querySelector('.save-btn');
    const syncBtn = taskCard.querySelector('.sync-btn');
    
    // Collect all field values
    const updatedData = {
        name: taskCard.querySelector('.task-name-edit').value.trim(),
        description: taskCard.querySelector('.task-description-edit').value.trim(),
        status: taskCard.querySelector('.task-status-edit').value,
        progress: parseInt(taskCard.querySelector('.task-progress-edit').value),
        notes: taskCard.querySelector('.task-notes-edit').value.trim()
    };
    
    // Validate required fields
    if (!updatedData.name) {
        showToast('Task name is required', 'warning');
        return;
    }
    
    try {
        // Update task in local storage
        await updateTaskInMyDashboard(taskId, updatedData);
        
        // Update UI
        saveBtn.style.display = 'none';
        syncBtn.style.opacity = '1';
        taskCard.classList.remove('has-unsaved-changes');
        
        // Update status badge
        const statusBadge = taskCard.querySelector('.task-status');
        statusBadge.textContent = updatedData.status;
        statusBadge.className = `task-status ${getStatusClass(updatedData.status)}`;
        
        updateTaskSyncStatus(taskId, 'pending');
        showToast('💾 Changes saved locally. Click "Sync to Infinity" to update Infinity.', 'success');
        
    } catch (error) {
        console.error('Error saving task changes:', error);
        showToast('Error saving changes', 'error');
    }
}

// Sync task with Infinity
async function syncTaskWithInfinity(taskId) {
    const task = availableTasks.find(t => t.id === taskId);
    if (!task) {
        showToast('Task not found', 'error');
        return;
    }
    
    const syncBtn = document.querySelector(`[data-task-id="${taskId}"] .sync-btn`);
    const originalText = syncBtn.innerHTML;
    
    try {
        // Update button to show loading
        syncBtn.innerHTML = '⏳ Syncing...';
        syncBtn.disabled = true;
        
        updateTaskSyncStatus(taskId, 'syncing');
        
        const updateData = {
            action: 'update_task',
            master_board_id: task.masterBoardId,
            company_board_id: task.companyBoardId,
            task_name: task.name,
            progress: task.progress,
            status: task.status,
            description: task.description,
            notes: task.notes,
            timestamp: new Date().toISOString(),
            updated_by: currentEmployee || 'Unknown User'
        };
        
        const response = await fetch(CONFIG.taskUpdateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                // Update sync status and timestamp
                await updateTaskSyncStatus(taskId, 'synced');
                await updateTaskInMyDashboard(taskId, {
                    lastSyncedAt: new Date().toISOString(),
                    syncStatus: 'synced'
                });
                
                showToast('✅ Task synced successfully with Infinity!', 'success');
                
                // Refresh dashboard to show updated sync time
                await loadAssignedTasks();
                
            } else {
                throw new Error(result.message || 'Sync failed');
            }
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
    } catch (error) {
        console.error('Error syncing task:', error);
        updateTaskSyncStatus(taskId, 'error');
        showToast(`❌ Sync failed: ${error.message}`, 'error');
        
    } finally {
        // Restore button
        syncBtn.innerHTML = originalText;
        syncBtn.disabled = false;
    }
}

// Update task in dashboard storage
async function updateTaskInMyDashboard(taskId, updates) {
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

// Update sync status indicator
function updateTaskSyncStatus(taskId, status) {
    const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!taskCard) return;
    
    const syncStatus = taskCard.querySelector('.sync-status');
    const icon = getSyncStatusIcon(status);
    
    syncStatus.innerHTML = icon;
    syncStatus.className = `sync-status ${status}`;
    
    // Update local storage
    updateTaskInMyDashboard(taskId, { syncStatus: status });
}

// Helper functions
function getSyncStatusIcon(status) {
    switch (status) {
        case 'synced': return '✅ Synced';
        case 'pending': return '⏳ Pending';
        case 'syncing': return '🔄 Syncing';
        case 'error': return '❌ Error';
        default: return '📥 Imported';
    }
}

function getStatusClass(status) {
    const statusClasses = {
        'Project': 'status-project',
        'Priority Project': 'status-priority',
        'Current Project': 'status-current',
        'Revision': 'status-revision',
        'Waiting Approval': 'status-waiting',
        'Project Finished': 'status-finished',
        'Rejected': 'status-rejected'
    };
    return statusClasses[status] || 'status-project';
}

function formatDate(dateString) {
    if (!dateString) return 'Never';
    try {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return 'Invalid date';
    }
}
function getStatusClass(status) {
    const statusClasses = {
        'Project': 'status-project',
        'Priority Project': 'status-priority',
        'Current Project': 'status-current',
        'Revision': 'status-revision',
        'Waiting Approval': 'status-waiting',
        'Project Finished': 'status-finished',
        'Rejected': 'status-rejected'
    };
    return statusClasses[status] || 'status-project';
}

async function editImportedTask(taskId) {
    const task = availableTasks.find(t => t.id === taskId);
    if (!task) {
        showToast('Task not found', 'error');
        return;
    }
    
    // Open task editor modal
    if (!document.getElementById('taskEditorModal')) {
        createTaskEditorModal();
    }
    
    // Pre-fill the IDs
    document.getElementById('masterBoardId').value = task.masterBoardId;
    document.getElementById('companyBoardId').value = task.companyBoardId;
    
    // Display task for editing
    displayTaskForEditing(task, task.masterBoardId, task.companyBoardId);
    
    // Show modal
    document.getElementById('taskEditorModal').style.display = 'block';
}

async function removeImportedTask(taskId) {
    if (!confirm('Are you sure you want to remove this task from your dashboard?\n\nThis will not affect the task in Infinity, only remove it from your personal dashboard.')) {
        return;
    }
    
    if (!currentEmployee) return;
    
    try {
        const tasksKey = `myTasks_${currentEmployee}`;
        let myTasks = [];
        
        const saved = localStorage.getItem(tasksKey);
        if (saved) {
            myTasks = JSON.parse(saved);
        }
        
        // Remove task
        myTasks = myTasks.filter(t => t.id !== taskId);
        
        // Save back
        localStorage.setItem(tasksKey, JSON.stringify(myTasks));
        availableTasks = myTasks;
        
        // Refresh display
        await loadAssignedTasks();
        
        showToast('🗑️ Task removed from your dashboard', 'success');
        
    } catch (error) {
        console.error('Error removing task:', error);
        showToast('Error removing task', 'error');
    }
}

// Stub implementations for form handlers
async function handleTaskIntake(e) {
    e.preventDefault();
    
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    const form = e.target;
    const formData = new FormData(form);
    
    try {
        showToast('📝 Creating new task...', 'info');
        
        // Build task data with CORRECT field names that match n8n workflow
        const taskData = {
            action: 'task_intake',
            'Project Title': formData.get('taskName'),           // Maps to Project Title
            'Description': formData.get('taskDescription'),     // Maps to Description
            'Company': formData.get('taskCompany'),            // Maps to Company
            'Is this project a priority?': formData.get('taskPriority') === 'yes' ? 'Yes' : 'No', // Maps to priority
            'Due Date': formData.get('taskDueDate'),           // Maps to Due Date
            'Links': formData.get('taskLinks'),                // Maps to Links
            'Name': currentEmployee,                           // Who submitted it
            'Assigned': formData.getAll('taskAssigned'),       // Maps to Assigned (array)
            'Employee Name': currentEmployee,                  // For logging
            'Timestamp': new Date().toISOString()
        };
        
        console.log('📤 Sending task data:', taskData);
        
        // Handle image upload if present
        const imageFile = formData.get('taskImage');
        if (imageFile && imageFile.size > 0) {
            console.log('📸 Uploading image to ImgBB...');
            
            const imgbbFormData = new FormData();
            imgbbFormData.append('image', imageFile);
            
            const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.imgbbApiKey}`, {
                method: 'POST',
                body: imgbbFormData
            });
            
            if (imgbbResponse.ok) {
                const imgbbData = await imgbbResponse.json();
                taskData.Image_URL = imgbbData.data.url;
                console.log('✅ Image uploaded successfully:', imgbbData.data.url);
            } else {
                console.warn('⚠️ Image upload failed, proceeding without image');
            }
        }
        
        // Send to n8n webhook via your server
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        
        console.log('📡 Server response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Task created successfully:', result);
            showToast('✅ Task created successfully!', 'success');
            form.reset();
        } else {
            const errorData = await response.json();
            console.error('❌ Server error:', errorData);
            throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
        }
        
    } catch (error) {
        console.error('❌ Task intake error:', error);
        showToast(`Failed to create task: ${error.message}`, 'error');
    }
}

async function handleDailyReport(e) {
    e.preventDefault();
    
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    const form = e.target;
    const formData = new FormData(form);
    
    try {
        showToast('📊 Submitting daily report...', 'info');
        
        // Build report data
        const reportData = {
            action: 'daily_report',
            'Employee Name': currentEmployee,
            'Company': formData.get('reportCompany'),
            'Project Name': formData.get('reportProject'),
            'Revisions': formData.get('reportRevisions'),
            'Total Time Spent': formData.get('reportTotalTime'),
            'Today Time Spent': formData.get('reportTodayTime'),
            'Notes': formData.get('reportNotes'),
            'Links': formData.get('reportLinks'),
            'Date': new Date().toISOString().split('T')[0], // YYYY-MM-DD format
            'Timestamp': new Date().toISOString()
        };
        
        // Handle photo upload (required for daily reports)
        const photoFile = formData.get('reportPhoto');
        if (!photoFile || photoFile.size === 0) {
            showToast('Please select a photo for your daily report', 'warning');
            return;
        }
        
        console.log('📸 Uploading photo to ImgBB...');
        
        const imgbbFormData = new FormData();
        imgbbFormData.append('image', photoFile);
        
        const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.imgbbApiKey}`, {
            method: 'POST',
            body: imgbbFormData
        });
        
        if (imgbbResponse.ok) {
            const imgbbData = await imgbbResponse.json();
            reportData.Photo_URL = imgbbData.data.url;
            console.log('✅ Photo uploaded successfully');
        } else {
            throw new Error('Failed to upload photo');
        }
        
        // Send to n8n webhook
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reportData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showToast('✅ Daily report submitted successfully!', 'success');
            form.reset();
            console.log('Daily report submitted:', result);
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('❌ Daily report error:', error);
        showToast('Failed to submit daily report. Please try again.', 'error');
    }
}

function handleTaskImagePreview(e) {
    console.log('📸 Image preview');
}

function handleReportPhotoPreview(e) {
    console.log('📸 Photo preview');
}

// Modal close on outside click
window.addEventListener('click', function(event) {
    const taskEditorModal = document.getElementById('taskEditorModal');
    const passwordModal = document.getElementById('passwordModal');
    
    if (event.target === taskEditorModal) {
        closeTaskEditorModal();
    }
    
    if (event.target === passwordModal) {
        closePasswordModal();
    }
});

// Debug function
window.debugStartButton = function() {
    console.log('🔧 DEBUGGING START BUTTON...');
    
    const startBtn = document.getElementById('startWorkBtn');
    
    if (startBtn) {
        startBtn.disabled = false;
        startBtn.classList.remove('btn-disabled');
        startBtn.style.pointerEvents = 'auto';
        startBtn.style.opacity = '1';
        
        currentEmployee = currentEmployee || 'Tony Herrera';
        currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
        
        if (!document.getElementById('employeeSelect').value) {
            document.getElementById('employeeSelect').value = 'Tony Herrera';
        }
        
        console.log('✅ START button force-enabled!');
        return 'START button should now work!';
    } else {
        console.error('❌ START button not found!');
        return 'START button element not found!';
    }
};

console.log('🚀 Simplified VEBLEN Task Tracker loaded!');
