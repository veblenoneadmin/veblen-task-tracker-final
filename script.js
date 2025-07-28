// Configuration - SIMPLIFIED VERSION
const CONFIG = {
    taskIntakeUrl: '/api/task-action',
    taskUpdateUrl: '/api/task-action',  // ✅ Use unified endpoint
    timeLoggerUrl: '/api/task-action',
    reportLoggerUrl: '/api/task-action', 
    taskRetrievalUrl: '/api/task-action', // ✅ Use unified endpoint
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
    
    // ✅ FIXED: Get Brisbane time correctly
    const brisbaneTimeStr = now.toLocaleTimeString('en-AU', {
        timeZone: 'Australia/Brisbane',
        hour: '2-digit',
        minute: '2-digit', 
        second: '2-digit',
        hour12: true
    });
    
    const brisbaneDateStr = now.toLocaleDateString('en-AU', {
        timeZone: 'Australia/Brisbane',
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
    
    // ✅ FIXED: Create Brisbane Date object properly
    // Get Brisbane time as milliseconds since epoch
    const brisbaneOffsetMs = 10 * 60 * 60 * 1000; // UTC+10 in milliseconds
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000); // Convert to UTC
    const brisbaneMs = utcMs + brisbaneOffsetMs; // Add Brisbane offset
    const brisbaneNow = new Date(brisbaneMs);
    
    // Update local time display
    updateLocalTime(now);
    
    // Update Brisbane time display
    const brisbaneTimeEl = document.getElementById('brisbaneTime');
    const brisbaneDateEl = document.getElementById('brisbaneDate');
    
    if (brisbaneTimeEl) brisbaneTimeEl.textContent = brisbaneTimeStr;
    if (brisbaneDateEl) brisbaneDateEl.textContent = brisbaneDateStr;
    
    // ✅ FIXED: Use the corrected Brisbane time for shift reset calculation
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
    // ✅ Calculate next 9 AM Brisbane time
    const next9AM = new Date(brisbaneNow);
    next9AM.setHours(9, 0, 0, 0);
    
    // If it's already past 9 AM today in Brisbane, move to tomorrow
    if (brisbaneNow >= next9AM) {
        next9AM.setDate(next9AM.getDate() + 1);
    }
    
    shiftResetTime = next9AM;
    
    // ✅ Calculate time difference correctly
    const timeDiff = next9AM.getTime() - brisbaneNow.getTime();
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    
    const countdownStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // ✅ Format reset time display
    const resetTimeStr = next9AM.toLocaleDateString('en-AU', {
        timeZone: 'Australia/Brisbane',
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    }) + ' at 9:00 AM';
    
    // ✅ FIXED: Convert Brisbane 9 AM to user's local time
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localResetTimeStr = next9AM.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: userTimezone
    });
    
    // Update display elements
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
        // Show loading state
        const importBtn = document.querySelector('button[onclick="importTaskToMyDashboard()"]');
        const originalText = importBtn.innerHTML;
        importBtn.innerHTML = '🔄 Importing from StartInfinity...';
        importBtn.disabled = true;
        
        console.log('📥 Importing task via n8n workflow...');
        console.log('- Master ID:', masterBoardId);
        console.log('- Company ID:', companyBoardId);
        
        // ✅ Call your working n8n workflow
        const response = await fetch('/api/task-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get_task_by_ids',
                master_board_id: masterBoardId,
                company_board_id: companyBoardId
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('📊 n8n Response:', result);
        
        // ✅ FIXED - Handle multiple possible response formats
        let importedTask = null;
        
        // Format 1: Direct task object
        if (result.task) {
            importedTask = result.task;
        }
        // Format 2: Success wrapper
        else if (result.success && result.data && result.data.task) {
            importedTask = result.data.task;
        }
        // Format 3: Array response (first item)
        else if (Array.isArray(result) && result[0] && result[0].task) {
            importedTask = result[0].task;
        }
        // Format 4: Direct object (no wrapper)
        else if (result.name || result.id) {
            importedTask = result;
        }
        // Format 5: Check for common task properties
        else if (result.masterBoardId || result.companyBoardId) {
            importedTask = result;
        }
        
        // ✅ Validate we got a valid task
        if (!importedTask) {
            console.error('❌ No valid task found in response:', result);
            throw new Error('No valid task data found in response. Please check the IDs and try again.');
        }
        
        // ✅ Ensure required fields exist
        if (!importedTask.name && !importedTask.task_name && !importedTask.title) {
            console.error('❌ Task missing name field:', importedTask);
            throw new Error('Task data is missing required name field');
        }
        
        // ✅ Normalize task data structure
        const normalizedTask = {
            // Core identifiers
            id: importedTask.id || `${masterBoardId}_${companyBoardId}`,
            masterBoardId: masterBoardId,
            companyBoardId: companyBoardId,
            
            // Task properties (handle multiple possible field names)
            name: importedTask.name || importedTask.task_name || importedTask.title || 'Imported Task',
            description: importedTask.description || importedTask.desc || '',
            progress: importedTask.progress || 0,
            status: importedTask.status || 'Project',
            company: importedTask.company || 'Unknown Company',
            
            // Optional fields
            dueDate: importedTask.dueDate || importedTask.due_date || 'Not set',
            dueDateRaw: importedTask.dueDateRaw || importedTask.due_date_raw || '',
            links: importedTask.links || '',
            imageUrl: importedTask.imageUrl || importedTask.image_url || importedTask.Image_URL || '',
            
            // Metadata
            createdDate: importedTask.createdDate || new Date().toLocaleDateString(),
            updatedDate: importedTask.updatedDate || new Date().toLocaleDateString(),
            importedBy: currentEmployee,
            importedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            syncStatus: 'synced',
            isEditable: true
        };
        
        console.log('✅ Normalized task data:');
        console.log('- Name:', normalizedTask.name);
        console.log('- Progress:', normalizedTask.progress + '%');
        console.log('- Status:', normalizedTask.status);
        console.log('- Company:', normalizedTask.company);
        
        // ✅ Save to dashboard
        await saveTaskToMyDashboard(normalizedTask, masterBoardId, companyBoardId);
        
        // ✅ Show in editor
        displayTaskForEditing(normalizedTask, masterBoardId, companyBoardId);
        
        // ✅ Refresh task list
        await loadAssignedTasks();
        
        // ✅ Success message
        showToast(`✅ "${normalizedTask.name}" imported successfully! (${normalizedTask.progress}% complete, ${normalizedTask.status})`, 'success');
        
        // ✅ Auto-scroll to see new task
        setTimeout(() => {
            const taskCards = document.querySelectorAll('.task-card');
            if (taskCards.length > 0) {
                taskCards[taskCards.length - 1].scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }
        }, 500);
        
    } catch (error) {
        console.error('❌ Import failed:', error);
        showToast(`❌ Import failed: ${error.message}`, 'error');
        
        // ✅ Enhanced error logging for debugging
        console.log('🔍 Debug info for failed import:');
        console.log('- Master Board ID:', masterBoardId);
        console.log('- Company Board ID:', companyBoardId);
        console.log('- Current Employee:', currentEmployee);
        console.log('- Error details:', error);
        
        // ✅ Fallback to manual entry
        console.log('🔄 Falling back to manual entry...');
        showManualTaskEntry(masterBoardId, companyBoardId);
        
    } finally {
        // Restore button
        const importBtn = document.querySelector('button[onclick="importTaskToMyDashboard()"]');
        if (importBtn) {
            importBtn.innerHTML = '📥 Import Task to My Dashboard';
            importBtn.disabled = false;
        }
    }
}

// ✅ REMOVE TASK - Smart confirmation
async function removeTaskFromDashboard(taskId) {
    const task = availableTasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Smart confirmation based on completion
    const isComplete = task.status === 'Project Finished' || task.progress >= 100;
    const message = isComplete 
        ? `✅ Remove completed task "${task.name}"?`
        : `⚠️ Remove "${task.name}"? (${task.progress}% complete)`;
    
    if (!confirm(message)) return;
    
    // Remove from localStorage  
    const tasksKey = `myTasks_${currentEmployee}`;
    let myTasks = JSON.parse(localStorage.getItem(tasksKey) || '[]');
    myTasks = myTasks.filter(t => t.id !== taskId);
    localStorage.setItem(tasksKey, JSON.stringify(myTasks));
    availableTasks = myTasks;
    
    // Refresh display
    await loadAssignedTasks();
    showToast(`🗑️ "${task.name}" removed from dashboard`, 'success');
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
// ✅ UPDATED - Enhanced task saving with n8n import data
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
    
    // ✅ Create enhanced task with REAL n8n import data
    const taskForDashboard = {
        // Core identifiers
        id: `${masterBoardId}_${companyBoardId}`,
        masterBoardId: masterBoardId,
        companyBoardId: companyBoardId,
        
        // ✅ REAL data from StartInfinity (via n8n)
        name: task.name || 'Imported Task',
        description: task.description || '',
        notes: task.notes || '',
        progress: task.progress || 0,
        status: task.status || 'Current Project',
        company: task.company || 'Unknown Company',
        company_display_name: task.company_display_name || task.company,
        
        // Date information
        dueDate: task.dueDate || 'Not set',
        dueDateRaw: task.dueDateRaw,
        createdDate: task.createdDate || new Date().toLocaleDateString(),
        updatedDate: task.updatedDate || new Date().toLocaleDateString(),
        
        // Import metadata
        importedBy: currentEmployee,
        importedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        lastSyncedAt: task.lastSyncedAt || new Date().toISOString(),
        syncStatus: task.syncStatus || 'synced',
        
        // UI flags
        isHighPriority: task.isHighPriority || false,
        isCurrentProject: task.isCurrentProject || false,
        isComplete: task.isComplete || false,
        isEditable: true,
        
        // Links and additional data
        links: task.links || '',
        assignedTo: task.assignedTo || [],
        
        // Debug info (helpful for troubleshooting)
        debug: {
            importSource: 'n8n_workflow',
            extractedFromInfinity: true,
            originalTaskData: task.debug || null
        }
    };
    
    // Check if task already exists (update) or add new
    const existingIndex = myTasks.findIndex(t => t.id === taskForDashboard.id);
    
    if (existingIndex >= 0) {
        // Update existing task with new data from StartInfinity
        myTasks[existingIndex] = {
            ...myTasks[existingIndex], // Keep existing metadata
            ...taskForDashboard,       // Override with fresh data
            importedAt: myTasks[existingIndex].importedAt, // Keep original import time
            lastUpdated: new Date().toISOString() // Update the last updated time
        };
        console.log('🔄 Updated existing task:', taskForDashboard.name);
    } else {
        // Add new task
        myTasks.push(taskForDashboard);
        console.log('➕ Added new task:', taskForDashboard.name);
    }
    
    // Save to localStorage
    localStorage.setItem(tasksKey, JSON.stringify(myTasks));
    availableTasks = myTasks;
    
    console.log('💾 Task saved to dashboard:', taskForDashboard.id);
}

// ✅ ENHANCED - Display real task data in editor with task name editing
// ✅ ENHANCED - Display task with ALL editable fields (no Notes textarea)
function displayTaskForEditing(task, masterBoardId, companyBoardId) {
    document.getElementById('taskEditorContent').innerHTML = `
        <div class="task-editor-form">
            <!-- ✅ Header showing REAL task data -->
            <div class="task-info-header" style="
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                margin-bottom: var(--spacing-lg);
                padding: var(--spacing-md);
                background: rgba(102, 126, 234, 0.1);
                border-radius: var(--radius-md);
                border: 1px solid rgba(102, 126, 234, 0.3);
            ">
                <h3 style="margin: 0; color: var(--text-primary);">
                    ✅ Task Editor
                </h3>
                <span class="task-company-badge" style="
                    padding: 0.25rem 0.75rem;
                    background: rgba(16, 185, 129, 0.2);
                    color: #34D399;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 600;
                ">
                    ${task.company || 'Unknown Company'}
                </span>
            </div>
            
            <!-- ✅ Task Name -->
            <div class="form-group">
                <label for="editTaskName">Task Name*</label>
                <input type="text" 
                       id="editTaskName" 
                       value="${task.name || ''}"
                       placeholder="Enter task name"
                       required
                       style="
                           width: 100%;
                           padding: var(--spacing-md);
                           background: rgba(0, 0, 0, 0.2);
                           border: 1px solid var(--border);
                           border-radius: var(--radius-md);
                           color: var(--text-primary);
                           font-size: 0.9rem;
                       ">
            </div>
            
            <!-- ✅ Description -->
            <div class="form-group">
                <label for="editTaskDescription">Description</label>
                <textarea id="editTaskDescription" 
                          rows="3" 
                          placeholder="Enter task description"
                          style="
                              width: 100%;
                              min-height: 80px;
                              padding: var(--spacing-md);
                              background: rgba(0, 0, 0, 0.2);
                              border: 1px solid var(--border);
                              border-radius: var(--radius-md);
                              color: var(--text-primary);
                              resize: vertical;
                          ">${task.description || ''}</textarea>
            </div>
            
            <!-- ✅ Progress -->
            <div class="form-group">
                <label for="editTaskProgress">Progress: <span id="progressDisplay">${task.progress || 0}%</span></label>
                <div style="display: flex; align-items: center; gap: var(--spacing-md); margin-bottom: var(--spacing-sm);">
                    <input type="range" 
                           id="editTaskProgress" 
                           min="0" 
                           max="100" 
                           value="${task.progress || 0}"
                           style="flex: 1; height: 8px;">
                    <span id="progressPercentage" style="
                        font-weight: 700;
                        color: var(--primary-color);
                        font-size: 1.1rem;
                        min-width: 60px;
                        text-align: center;
                    ">${task.progress || 0}%</span>
                </div>
                <div style="height: 8px; background: rgba(0,0,0,0.3); border-radius: 4px;">
                    <div id="progressBar" style="
                        height: 100%;
                        background: var(--primary-gradient);
                        border-radius: 4px;
                        width: ${task.progress || 0}%;
                        transition: width 0.3s ease;
                    "></div>
                </div>
            </div>
            
            <!-- ✅ Status -->
            <div class="form-group">
                <label for="editTaskStatus">Status*</label>
                <select id="editTaskStatus" required style="
                    width: 100%;
                    padding: var(--spacing-md);
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                ">
                    <option value="Project" ${task.status === 'Project' ? 'selected' : ''}>Project</option>
                    <option value="Priority Project" ${task.status === 'Priority Project' ? 'selected' : ''}>Priority Project</option>
                    <option value="Current Project" ${task.status === 'Current Project' ? 'selected' : ''}>Current Project</option>
                    <option value="Revision" ${task.status === 'Revision' ? 'selected' : ''}>Revision</option>
                    <option value="Waiting Approval" ${task.status === 'Waiting Approval' ? 'selected' : ''}>Waiting Approval</option>
                    <option value="Project Finished" ${task.status === 'Project Finished' ? 'selected' : ''}>Project Finished</option>
                    <option value="Rejected" ${task.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                </select>
            </div>
            
            <!-- ✅ Due Date -->
            <div class="form-group">
                <label for="editTaskDueDate">Due Date</label>
                <input type="date" 
                       id="editTaskDueDate" 
                       value="${task.dueDateRaw || ''}"
                       style="
                           width: 100%;
                           padding: var(--spacing-md);
                           background: rgba(0, 0, 0, 0.2);
                           border: 1px solid var(--border);
                           border-radius: var(--radius-md);
                           color: var(--text-primary);
                       ">
            </div>
            
            <!-- ✅ Links -->
            <div class="form-group">
                <label for="editTaskLinks">Links (one per line)</label>
                <textarea id="editTaskLinks" 
                          rows="3" 
                          placeholder="Add any relevant links (one per line)"
                          style="
                              width: 100%;
                              min-height: 80px;
                              padding: var(--spacing-md);
                              background: rgba(0, 0, 0, 0.2);
                              border: 1px solid var(--border);
                              border-radius: var(--radius-md);
                              color: var(--text-primary);
                              resize: vertical;
                          ">${task.links || ''}</textarea>
            </div>
            
            <!-- ✅ Task Metadata Display -->
            <div class="task-meta-info" style="
                background: rgba(0,0,0,0.2);
                padding: var(--spacing-md);
                border-radius: var(--radius-md);
                font-size: 0.85rem;
                color: var(--text-secondary);
                margin-top: var(--spacing-lg);
            ">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm);">
                    <p><strong>Master ID:</strong> ${masterBoardId}</p>
                    <p><strong>Company ID:</strong> ${companyBoardId}</p>
                    <p><strong>Company:</strong> ${task.company || 'Unknown'}</p>
                    <p><strong>Last Updated:</strong> ${task.lastUpdated ? new Date(task.lastUpdated).toLocaleDateString() : 'Now'}</p>
                </div>
                <p style="margin-top: var(--spacing-sm);"><strong>Imported from:</strong> StartInfinity via n8n workflow</p>
            </div>
        </div>
    `;
    
    // ✅ Add real-time progress slider updates
    const progressSlider = document.getElementById('editTaskProgress');
    const progressDisplay = document.getElementById('progressDisplay');
    const progressPercentage = document.getElementById('progressPercentage');
    const progressBar = document.getElementById('progressBar');
    
    if (progressSlider) {
        progressSlider.addEventListener('input', function() {
            const value = this.value;
            progressDisplay.textContent = value + '%';
            progressPercentage.textContent = value + '%';
            progressBar.style.width = value + '%';
        });
    }
    
    // Store current task data for saving
    window.currentEditingTask = {
        ...task,
        masterBoardId: masterBoardId,
        companyBoardId: companyBoardId
    };
    
    // Show the footer buttons
    document.getElementById('taskEditorFooter').style.display = 'flex';
}

// ✅ ENHANCED - Update task with ALL fields
async function updateTaskInInfinity() {
    if (!window.currentEditingTask) {
        showToast('No task loaded for editing', 'error');
        return;
    }
    
    // ✅ Get ALL form values
    const taskName = document.getElementById('editTaskName').value.trim();
    const description = document.getElementById('editTaskDescription').value.trim();
    const progress = parseInt(document.getElementById('editTaskProgress').value);
    const status = document.getElementById('editTaskStatus').value;
    const dueDate = document.getElementById('editTaskDueDate').value;
    const links = document.getElementById('editTaskLinks').value.trim();
    
    const masterBoardId = window.currentEditingTask.masterBoardId;
    const companyBoardId = window.currentEditingTask.companyBoardId;
    
    if (!taskName) {
        showToast('Please enter a task name', 'warning');
        return;
    }
    
    // ✅ Build comprehensive update data matching your n8n workflow
    const updateData = {
        action: 'update_task',
        master_board_id: masterBoardId,
        company_board_id: companyBoardId,
        company: window.currentEditingTask.company || 'VEBLEN (Internal)',
        
        // ✅ ALL updatable fields
        task_name: taskName,
        description: description,
        progress: progress,
        status: status,
        due_date: dueDate,
        links: links,
        
        // Metadata
        timestamp: new Date().toISOString(),
        updated_by: currentEmployee || 'Unknown User'
    };
    
    try {
        showToast('🔄 Updating task in StartInfinity...', 'info');
        
        // Update in Infinity using the unified API endpoint
        const response = await fetch('/api/task-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                // Update local dashboard with ALL fields
                await updateTaskInMyDashboard(masterBoardId, companyBoardId, {
                    name: taskName,
                    description: description,
                    progress: progress,
                    status: status,
                    dueDate: dueDate ? formatDate(dueDate) : null,
                    dueDateRaw: dueDate,
                    links: links,
                    lastUpdated: new Date().toISOString()
                });
                
                showToast('✅ Task updated successfully in StartInfinity and your dashboard!', 'success');
                closeTaskEditorModal();
                
                // Refresh assigned tasks list
                await loadAssignedTasks();
            } else {
                throw new Error(result.message || 'Update failed in StartInfinity');
            }
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error updating task in StartInfinity:', error);
        
        // Still update locally even if StartInfinity update fails
        await updateTaskInMyDashboard(masterBoardId, companyBoardId, {
            name: taskName,
            description: description,
            progress: progress,
            status: status,
            dueDate: dueDate ? formatDate(dueDate) : null,
            dueDateRaw: dueDate,
            links: links,
            lastUpdated: new Date().toISOString()
        });
        
        showToast('⚠️ Updated locally, but failed to sync with StartInfinity: ' + error.message, 'warning');
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
                action: 'time_clock',
                'WHO ARE YOU?': currentEmployee,
                'WHAT ARE YOU DOING?': action
            })
        });

        if (response.ok) {
            console.log(`✅ ${action} recorded successfully!`);
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

// ✅ ADD THESE MISSING FUNCTIONS TO YOUR script.js

function getSyncStatusIcon(status) {
    switch (status) {
        case 'synced': return '✅ Synced';
        case 'pending': return '⏳ Pending';
        case 'syncing': return '🔄 Syncing';
        case 'error': return '❌ Error';
        default: return '📥 Imported';
    }
}

function attachTaskEventListeners(taskId) {
    // Placeholder for task event listeners
    console.log('Event listeners attached for task:', taskId);
}

// ✅ COMPLETE renderMyImportedTasks function
// ✅ ENHANCED - Task cards with image thumbnails
// ✅ UPDATED - Task cards without Notes textarea
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
${tasks.map(task => {
    // Calculate progress bar color based on real progress
    const progressColor = task.progress >= 80 ? '#10B981' : 
                        task.progress >= 50 ? '#F59E0B' : '#EF4444';
    
    // Status badge styling with real status
    const statusClass = getStatusClass(task.status);
    
    // Truncate description if too long
    const shortDescription = task.description ? 
        (task.description.length > 120 ? 
            task.description.substring(0, 120) + '...' : 
            task.description) 
        : 'No description available';
    
    // ✅ Handle task image with fallback
    const taskImage = task.imageUrl || task.image_url || task.Image_URL || null;
    const hasImage = taskImage && taskImage.trim() !== '';
    
    return `
        <div class="task-card" data-task-id="${task.id}" style="
            background: rgba(0, 0, 0, 0.3);
            border-radius: 12px;
            padding: 1.5rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
            margin-bottom: var(--spacing-lg);
            ${hasImage ? 'min-height: 420px;' : ''}
        ">
            <!-- ✅ Task Image Thumbnail (if exists) -->
            ${hasImage ? `
            <div style="
                margin-bottom: 1rem;
                text-align: center;
                position: relative;
                overflow: hidden;
                border-radius: 8px;
                background: rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.1);
            ">
                <img src="${taskImage}" 
                     alt="Task Image" 
                     loading="lazy"
                     onclick="openImageModal('${taskImage}', '${task.name}')"
                     style="
                         width: 100%;
                         height: 120px;
                         object-fit: cover;
                         cursor: pointer;
                         transition: all 0.3s ease;
                         border-radius: 6px;
                     "
                     onmouseover="this.style.transform='scale(1.05)'"
                     onmouseout="this.style.transform='scale(1)'"
                     onerror="this.parentElement.style.display='none'">
                <div style="
                    position: absolute;
                    bottom: 4px;
                    right: 4px;
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 0.7rem;
                    pointer-events: none;
                ">🔍 Click to expand</div>
            </div>
            ` : ''}
            
            <!-- Task Header with Real Data -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; gap: 1rem;">
                <h3 style="
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                    flex: 1;
                    line-height: 1.4;
                " title="${task.name}">
                    ${hasImage ? '🖼️ ' : ''}${task.name || 'Untitled Task'}
                </h3>
                <span class="task-status ${statusClass}" style="
                    padding: 0.25rem 0.75rem;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    white-space: nowrap;
                ">
                    ${task.status || 'Unknown'}
                </span>
            </div>
            
            <!-- Company Info -->
            <div style="margin-bottom: 0.75rem; opacity: 0.8;">
                <small>🏢 ${task.company || 'No Company'}</small>
            </div>
            
            <!-- Description -->
            <div style="
                color: var(--text-secondary);
                font-size: 0.9rem;
                line-height: 1.5;
                margin-bottom: 1rem;
                min-height: 2.7rem;
            ">
                ${shortDescription}
            </div>
            
            <!-- Progress Bar -->
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span>Progress</span>
                    <span style="font-weight: 700; color: ${progressColor};">${task.progress || 0}%</span>
                </div>
                <div style="height: 8px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; overflow: hidden;">
                    <div style="
                        height: 100%;
                        border-radius: 4px;
                        transition: width 0.5s ease;
                        background-color: ${progressColor};
                        width: ${task.progress || 0}%;
                    "></div>
                </div>
            </div>
            
            <!-- Due Date Info -->
            ${task.dueDate && task.dueDate !== 'Not set' ? `
            <div style="margin-bottom: 1rem; font-size: 0.85rem; color: var(--text-secondary);">
                📅 <strong>Due:</strong> ${task.dueDate}
            </div>
            ` : ''}
            
            <!-- Links Info -->
            ${task.links && task.links.trim() !== '' ? `
            <div style="margin-bottom: 1rem; font-size: 0.85rem; color: var(--text-secondary);">
                🔗 <strong>Links:</strong> ${task.links.split('\\n').length} link(s) attached
            </div>
            ` : ''}
            
            <!-- Task Metadata -->
            <div style="margin-bottom: 1rem; font-size: 0.8rem; color: var(--text-secondary);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                    <small>🆔 Master: ${task.masterBoardId?.substring(0, 8)}...</small>
                    <small>🏢 Company: ${task.companyBoardId?.substring(0, 8)}...</small>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                    <small>📅 Updated: ${formatDate(task.lastUpdated)}</small>
                    <small>${getSyncStatusIcon(task.syncStatus || 'synced')}</small>
                </div>
                ${hasImage ? `<div style="text-align: center; margin-top: 0.5rem;"><small>📷 Image attached</small></div>` : ''}
            </div>
            
            <!-- Action Buttons -->
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-primary" style="
                    flex: 1; 
                    font-size: 0.85rem; 
                    padding: 0.6rem 0.8rem;
                    background: var(--primary-gradient);
                    border: none;
                    border-radius: var(--radius-md);
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                " onclick="editImportedTask('${task.id}')">
                    ✏️ Edit
                </button>
                
                <button class="btn btn-success" style="
                    flex: 1; 
                    font-size: 0.85rem; 
                    padding: 0.6rem 0.8rem;
                    background: linear-gradient(135deg, #10B981, #059669);
                    border: none;
                    border-radius: var(--radius-md);
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                " onclick="syncTaskToInfinity('${task.id}')">
                    🔄 Sync
                </button>
                
                <button class="btn btn-danger" style="
                    flex: 0.8; 
                    font-size: 0.85rem; 
                    padding: 0.6rem 0.8rem;
                    background: linear-gradient(135deg, #EF4444, #DC2626);
                    border: none;
                    border-radius: var(--radius-md);
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                " onclick="removeTaskFromDashboard('${task.id}')">
                    🗑️ Remove
                </button>
            </div>
        </div>
    `;
}).join('')}
        </div>
    `;
    
    // Add event listeners for inline editing
    tasks.forEach(task => {
        attachTaskEventListeners(task.id);
    });
}

// ✅ NEW - Image modal for full-size viewing
function openImageModal(imageUrl, taskName) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('imageModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'imageModal';
        modal.className = 'modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content" style="
                background: var(--surface);
                margin: 2% auto;
                padding: 0;
                border-radius: var(--radius-xl);
                width: 90%;
                max-width: 800px;
                box-shadow: var(--shadow-xl);
                border: 2px solid var(--border);
                position: relative;
            ">
                <div class="modal-header" style="
                    padding: var(--spacing-lg);
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: var(--dark-gradient);
                    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
                ">
                    <h3 id="imageModalTitle" style="margin: 0; color: var(--text-primary);">Task Image</h3>
                    <span class="close" onclick="closeImageModal()" style="
                        color: var(--text-secondary);
                        font-size: 2rem;
                        font-weight: 300;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        padding: 0;
                        background: none;
                        border: none;
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">&times;</span>
                </div>
                <div class="modal-body" style="
                    padding: var(--spacing-lg);
                    text-align: center;
                    background: var(--surface);
                ">
                    <img id="imageModalImg" 
                         style="
                             max-width: 100%;
                             max-height: 70vh;
                             border-radius: var(--radius-md);
                             box-shadow: var(--shadow-lg);
                             border: 1px solid var(--border);
                         "
                         alt="Task Image">
                    <div style="
                        margin-top: var(--spacing-md);
                        color: var(--text-secondary);
                        font-size: 0.875rem;
                    ">
                        Click image to open in new tab • Press ESC to close
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add click outside to close
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeImageModal();
            }
        });
        
        // Add ESC key to close
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.style.display === 'block') {
                closeImageModal();
            }
        });
    }
    
    // Update modal content
    document.getElementById('imageModalTitle').textContent = `📷 ${taskName || 'Task Image'}`;
    const img = document.getElementById('imageModalImg');
    img.src = imageUrl;
    img.onclick = () => window.open(imageUrl, '_blank');
    
    // Show modal
    modal.style.display = 'block';
    modal.style.animation = 'fadeIn 0.3s ease';
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

// ✅ UPDATE - Enhanced saveTaskToMyDashboard to preserve image URLs
async function saveTaskToMyDashboard(task, masterBoardId, companyBoardId) {
    if (!currentEmployee) {
        console.error('❌ No current employee set');
        return;
    }
    
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
    
    // ✅ Ensure task has required fields
    const taskForDashboard = {
        // Core identifiers
        id: task.id || `${masterBoardId}_${companyBoardId}`,
        masterBoardId: masterBoardId,
        companyBoardId: companyBoardId,
        
        // Required fields with fallbacks
        name: task.name || 'Imported Task',
        description: task.description || '',
        progress: Math.max(0, Math.min(100, parseInt(task.progress) || 0)),
        status: task.status || 'Project',
        company: task.company || 'Unknown Company',
        
        // Optional fields
        dueDate: task.dueDate || 'Not set',
        dueDateRaw: task.dueDateRaw || '',
        links: task.links || '',
        imageUrl: task.imageUrl || '',
        
        // Metadata
        createdDate: task.createdDate || new Date().toLocaleDateString(),
        updatedDate: task.updatedDate || new Date().toLocaleDateString(),
        importedBy: currentEmployee,
        importedAt: task.importedAt || new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'synced',
        isEditable: true,
        
        // UI flags
        isHighPriority: task.status === 'Priority Project',
        isCurrentProject: task.status === 'Current Project',
        isComplete: task.status === 'Project Finished' || task.progress >= 100,
        
        // Debug info
        debug: {
            importSource: 'n8n_workflow',
            importTimestamp: new Date().toISOString(),
            originalTaskData: task
        }
    };
    
    // Check if task already exists (update) or add new
    const existingIndex = myTasks.findIndex(t => t.id === taskForDashboard.id);
    
    if (existingIndex >= 0) {
        // Update existing task
        myTasks[existingIndex] = {
            ...myTasks[existingIndex], // Keep existing metadata
            ...taskForDashboard,       // Override with fresh data
            importedAt: myTasks[existingIndex].importedAt, // Keep original import time
            lastUpdated: new Date().toISOString() // Update the last updated time
        };
        console.log('🔄 Updated existing task:', taskForDashboard.name);
    } else {
        // Add new task
        myTasks.push(taskForDashboard);
        console.log('➕ Added new task:', taskForDashboard.name);
    }
    
    // Save to localStorage
    try {
        localStorage.setItem(tasksKey, JSON.stringify(myTasks));
        availableTasks = myTasks;
        console.log('💾 Task saved to dashboard:', taskForDashboard.id);
    } catch (error) {
        console.error('❌ Failed to save task to localStorage:', error);
        throw new Error('Failed to save task to local storage');
    }
}
    
// ✅ FIXED - Sync function with proper variable scope
// ✅ ENHANCED - Bi-directional sync (pull FROM Infinity, then push TO Infinity)
async function syncTaskToInfinity(taskId) {
    const task = availableTasks.find(t => t.id === taskId);
    if (!task) {
        showToast('Task not found', 'error');
        return;
    }
    
    const syncBtn = document.querySelector(`[onclick="syncTaskToInfinity('${taskId}')"]`);
    let originalText = '🔄 Sync';
    
    if (!syncBtn) {
        console.error('Sync button not found for task:', taskId);
        showToast('Sync button not found', 'error');
        return;
    }
    
    originalText = syncBtn.innerHTML;
    
    try {
        // ✅ STEP 1: PULL latest data FROM Infinity first
        syncBtn.innerHTML = '📥 Fetching latest...';
        syncBtn.disabled = true;
        
        console.log('🔄 Starting bi-directional sync for:', task.name);
        console.log('📥 Step 1: Pulling latest data FROM StartInfinity...');
        
        // Fetch latest data from Infinity
        const getResponse = await fetch('/api/task-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get_task_by_ids',
                master_board_id: task.masterBoardId,
                company_board_id: task.companyBoardId
            })
        });
        
        let latestTaskData = task; // Fallback to current data
        let changesFromInfinity = [];
        
        if (getResponse.ok) {
            const getResult = await getResponse.json();
            if (getResult.success && getResult.task) {
                latestTaskData = getResult.task;
                
                // Compare with local data to detect changes made in Infinity
                if (latestTaskData.name !== task.name) {
                    changesFromInfinity.push(`Name: "${task.name}" → "${latestTaskData.name}"`);
                }
                if (latestTaskData.progress !== task.progress) {
                    changesFromInfinity.push(`Progress: ${task.progress}% → ${latestTaskData.progress}%`);
                }
                if (latestTaskData.status !== task.status) {
                    changesFromInfinity.push(`Status: "${task.status}" → "${latestTaskData.status}"`);
                }
                if (latestTaskData.description !== task.description) {
                    changesFromInfinity.push('Description updated');
                }
                
                console.log('📊 Changes detected from Infinity:', changesFromInfinity);
                
                // Update local task with latest Infinity data
                const updatedTask = {
                    ...task, // Keep local metadata
                    ...latestTaskData, // Override with fresh Infinity data
                    lastSyncedAt: new Date().toISOString(),
                    syncStatus: 'synced'
                };
                
                // Save the updated data locally
                await saveTaskToMyDashboard(updatedTask, task.masterBoardId, task.companyBoardId);
                
                // Update our working reference
                const taskIndex = availableTasks.findIndex(t => t.id === taskId);
                if (taskIndex >= 0) {
                    availableTasks[taskIndex] = updatedTask;
                }
                
                if (changesFromInfinity.length > 0) {
                    const changesSummary = changesFromInfinity.length > 2 
                        ? `${changesFromInfinity.slice(0, 2).join(', ')} +${changesFromInfinity.length - 2} more`
                        : changesFromInfinity.join(', ');
                    showToast(`📥 Pulled changes from Infinity: ${changesSummary}`, 'info');
                } else {
                    console.log('✅ No changes detected in Infinity');
                }
            } else {
                console.warn('Could not fetch latest data from Infinity, using local data');
                showToast('⚠️ Could not fetch latest from Infinity, syncing local data', 'warning');
            }
        } else {
            console.warn('Failed to fetch from Infinity, proceeding with local data');
            showToast('⚠️ Could not fetch latest from Infinity, syncing local data', 'warning');
        }
        
        // ✅ STEP 2: PUSH the (now current) data TO Infinity
        syncBtn.innerHTML = '🔄 Syncing to Infinity...';
        
        console.log('🔄 Step 2: Pushing data TO StartInfinity...');
        
        const syncData = {
            action: 'update_task',
            master_board_id: latestTaskData.masterBoardId || task.masterBoardId,
            company_board_id: latestTaskData.companyBoardId || task.companyBoardId,
            company: latestTaskData.company || task.company || 'VEBLEN (Internal)',
            task_name: latestTaskData.name || task.name,
            description: latestTaskData.description || '',
            progress: latestTaskData.progress || 0,
            status: latestTaskData.status || 'Project',
            notes: latestTaskData.notes || ''
        };
        
        const syncResponse = await fetch('/api/task-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(syncData)
        });
        
        if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            if (syncResult.success) {
                // Final update of sync status
                const finalTask = {
                    ...latestTaskData,
                    syncStatus: 'synced',
                    lastSyncedAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                };
                
                await saveTaskToMyDashboard(finalTask, finalTask.masterBoardId, finalTask.companyBoardId);
                
                // Success message
                if (changesFromInfinity.length > 0) {
                    showToast(`✅ Bi-directional sync complete! Pulled ${changesFromInfinity.length} change(s) and synced to Infinity`, 'success');
                } else {
                    showToast(`✅ Sync complete! Task is up-to-date with Infinity`, 'success');
                }
                
                // Refresh dashboard to show all updates
                await loadAssignedTasks();
                
            } else {
                throw new Error(syncResult.error || 'Sync to Infinity failed');
            }
        } else {
            throw new Error(`HTTP ${syncResponse.status}: Failed to sync to Infinity`);
        }
        
    } catch (error) {
        console.error('❌ Bi-directional sync error:', error);
        
        // Update error status
        if (task) {
            task.syncStatus = 'error';
            await saveTaskToMyDashboard(task, task.masterBoardId, task.companyBoardId);
        }
        
        let errorMessage = 'Sync failed';
        if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = 'Network error - check connection';
        } else if (error.message.includes('404')) {
            errorMessage = 'Task not found in Infinity';
        } else {
            errorMessage = `Sync failed: ${error.message}`;
        }
        
        showToast(`❌ ${errorMessage}`, 'error');
        await loadAssignedTasks();
        
    } finally {
        // Restore button
        if (syncBtn) {
            syncBtn.innerHTML = originalText;
            syncBtn.disabled = false;
        }
        
        console.log('🔄 Bi-directional sync completed for:', taskId);
    }
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
        
        console.log('🔄 Syncing task to Infinity:', updateData);
        
        const response = await fetch(CONFIG.taskUpdateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        console.log('📡 Sync response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Sync result:', result);
            
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
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error ${response.status}`);
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
// Daily Report Handler - ADD THIS TO YOUR SCRIPT.JS
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
        
        // Handle photo upload (required)
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
        
        if (!imgbbResponse.ok) {
            throw new Error('Failed to upload photo');
        }
        
        const imgbbData = await imgbbResponse.json();
        console.log('✅ Photo uploaded successfully');
        
        // Build report data with EXACT field names from n8n workflow
        const reportData = {
            action: 'daily_report',
            'Name': currentEmployee,
            'Company': formData.get('reportCompany'),
            'Project Name': formData.get('projectName'),
            'Number of Revisions': formData.get('numRevisions'),
            'Total Time Spent on Project': formData.get('totalTimeSpent'),
            'Notes': formData.get('reportNotes'),
            'Links': formData.get('reportLinks') || '',
            'Date': formData.get('reportDate'),
            'Photo for report': imgbbData.data.url,
            'Feedback or Requests': formData.get('feedbackRequests') || '',
            'Timestamp': new Date().toISOString()
        };
        
        console.log('📤 Sending report data:', reportData);
        
        const response = await fetch(CONFIG.reportLoggerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportData)
        });
        
        console.log('📡 Report response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Daily report submitted successfully:', result);
            showToast('✅ Daily report submitted successfully!', 'success');
            form.reset();
            
            // Clear photo preview
            const photoPreview = document.getElementById('reportPhotoPreview');
            if (photoPreview) photoPreview.innerHTML = '';
            
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Report submission error:', errorData);
            throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
        }
        
    } catch (error) {
        console.error('❌ Daily report error:', error);
        showToast(`Failed to submit daily report: ${error.message}`, 'error');
    }
}
// Stub implementations for form handlers
// ✅ ENHANCED - Task intake with optional image handling
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
        
        // ✅ Handle optional image upload
        const imageFile = formData.get('taskImage');
        let imageUrl = '';
        
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
                imageUrl = imgbbData.data.url;
                console.log('✅ Image uploaded successfully:', imageUrl);
            } else {
                console.warn('⚠️ Image upload failed, proceeding without image');
                showToast('⚠️ Image upload failed, but task will be created without image', 'warning');
            }
        } else {
            console.log('📝 No image provided - creating task without image');
        }
        
        // Get assigned users (multiple select)
        const assignedElements = form.querySelectorAll('#taskAssigned option:checked');
        const assignedArray = Array.from(assignedElements).map(option => option.value);
        
        // ✅ Build comprehensive task data with ALL required fields
        const taskData = {
            action: 'task_intake',
            
            // ✅ Core required fields
            'Project Title': formData.get('taskTitle') || '',
            'Description': formData.get('taskDescription') || '',
            'Company': formData.get('taskCompany') || '',
            'Is this project a priority?': formData.get('taskPriority') || 'No',
            'Due Date': formData.get('taskDueDate') || '',
            'Links': formData.get('taskLinks') || '',
            'Assigned': assignedArray,
            'Name': currentEmployee,
            'Employee Name': currentEmployee,
            
            // ✅ Optional image URL (empty string if no image)
            'Image_URL': imageUrl,
            
            // ✅ Metadata
            'Timestamp': new Date().toISOString()
        };
        
        console.log('📤 Sending task data:', taskData);
        
        const response = await fetch(CONFIG.taskIntakeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        
        console.log('📡 Response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Task created successfully:', result);
            
            if (imageUrl) {
                showToast('✅ Task created successfully with image!', 'success');
            } else {
                showToast('✅ Task created successfully!', 'success');
            }
            
            form.reset();
            
            // Clear image preview
            const imagePreview = document.getElementById('taskImagePreview');
            if (imagePreview) imagePreview.innerHTML = '';
            
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Server error:', errorData);
            throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
        }
        
    } catch (error) {
        console.error('❌ Task intake error:', error);
        showToast(`Failed to create task: ${error.message}`, 'error');
    }
}

// ✅ ENHANCED - Clear image preview function
function clearTaskImagePreview() {
    const input = document.getElementById('taskImage');
    const preview = document.getElementById('taskImagePreview');
    
    if (input) input.value = '';
    if (preview) preview.innerHTML = '';
    
    showToast('Image removed', 'info');
}

// ✅ ENHANCED - Image preview with better validation
function handleTaskImagePreview(e) {
    const file = e.target.files[0];
    const previewContainer = document.getElementById('taskImagePreview');
    
    // Clear previous preview
    previewContainer.innerHTML = '';
    
    if (!file) {
        console.log('📸 No file selected for task image');
        return;
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
        showToast('❌ Please select a valid image file (JPEG, PNG, GIF, BMP, WebP)', 'error');
        e.target.value = ''; // Clear the input
        return;
    }
    
    // Validate file size (32MB limit for ImgBB)
    const maxSize = 32 * 1024 * 1024; // 32MB in bytes
    if (file.size > maxSize) {
        showToast('❌ Image too large. Please select an image under 32MB', 'error');
        e.target.value = ''; // Clear the input
        return;
    }
    
    // Create file reader
    const reader = new FileReader();
    
    reader.onload = function(event) {
        console.log('📸 Task image preview loaded:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        // Create preview HTML
        const previewHTML = `
            <div style="margin-top: var(--spacing-md); padding: var(--spacing-md); background: rgba(0, 0, 0, 0.2); border-radius: var(--radius-md); border: 1px solid rgba(255, 255, 255, 0.1);">
                <div style="display: flex; align-items: center; gap: var(--spacing-md); margin-bottom: var(--spacing-sm);">
                    <span style="color: var(--text-primary); font-weight: 600;">📸 Image Preview (Optional):</span>
                    <span style="color: var(--text-secondary); font-size: 0.875rem;">${file.name}</span>
                    <span style="color: var(--text-secondary); font-size: 0.75rem; background: rgba(102, 126, 234, 0.2); padding: 2px 8px; border-radius: 12px;">${(file.size / 1024 / 1024).toFixed(2)}MB</span>
                </div>
                <div style="text-align: center;">
                    <img src="${event.target.result}" 
                         alt="Task Image Preview" 
                         style="max-width: 300px; max-height: 200px; border-radius: var(--radius-md); box-shadow: var(--shadow-lg); border: 2px solid var(--border); object-fit: cover;">
                </div>
                <button type="button" 
                        onclick="clearTaskImagePreview()" 
                        style="margin-top: var(--spacing-sm); padding: var(--spacing-xs) var(--spacing-sm); background: rgba(252, 129, 129, 0.2); color: #fc8181; border: 1px solid rgba(252, 129, 129, 0.3); border-radius: var(--radius-sm); font-size: 0.75rem; cursor: pointer; transition: all 0.3s ease;"
                        onmouseover="this.style.background='rgba(252, 129, 129, 0.3)'"
                        onmouseout="this.style.background='rgba(252, 129, 129, 0.2)'">
                    🗑️ Remove Image
                </button>
            </div>
        `;
        
        previewContainer.innerHTML = previewHTML;
        showToast('✅ Task image loaded successfully (optional)', 'success');
    };
    
    reader.onerror = function() {
        console.error('❌ Error reading task image file');
        showToast('❌ Error reading image file', 'error');
        previewContainer.innerHTML = '';
    };
    
    // Read the file as data URL
    reader.readAsDataURL(file);
}

function handleReportPhotoPreview(e) {
    const file = e.target.files[0];
    const previewContainer = document.getElementById('reportPhotoPreview');
    
    // Clear previous preview
    previewContainer.innerHTML = '';
    
    if (!file) {
        console.log('📸 No file selected for report photo');
        return;
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
        showToast('❌ Please select a valid image file (JPEG, PNG, GIF, BMP, WebP)', 'error');
        e.target.value = ''; // Clear the input
        return;
    }
    
    // Validate file size (32MB limit for ImgBB)
    const maxSize = 32 * 1024 * 1024; // 32MB in bytes
    if (file.size > maxSize) {
        showToast('❌ Image too large. Please select an image under 32MB', 'error');
        e.target.value = ''; // Clear the input
        return;
    }
    
    // Create file reader
    const reader = new FileReader();
    
    reader.onload = function(event) {
        console.log('📸 Report photo preview loaded:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        // Create preview HTML
        const previewHTML = `
            <div style="margin-top: var(--spacing-md); padding: var(--spacing-md); background: rgba(0, 0, 0, 0.2); border-radius: var(--radius-md); border: 1px solid rgba(255, 255, 255, 0.1);">
                <div style="display: flex; align-items: center; gap: var(--spacing-md); margin-bottom: var(--spacing-sm);">
                    <span style="color: var(--text-primary); font-weight: 600;">📷 Report Photo:</span>
                    <span style="color: var(--text-secondary); font-size: 0.875rem;">${file.name}</span>
                    <span style="color: var(--text-secondary); font-size: 0.75rem; background: rgba(72, 187, 120, 0.2); padding: 2px 8px; border-radius: 12px;">${(file.size / 1024 / 1024).toFixed(2)}MB</span>
                </div>
                <div style="text-align: center;">
                    <img src="${event.target.result}" 
                         alt="Report Photo Preview" 
                         style="max-width: 300px; max-height: 200px; border-radius: var(--radius-md); box-shadow: var(--shadow-lg); border: 2px solid var(--border); object-fit: cover;">
                </div>
                <button type="button" 
                        onclick="clearReportPhotoPreview()" 
                        style="margin-top: var(--spacing-sm); padding: var(--spacing-xs) var(--spacing-sm); background: rgba(252, 129, 129, 0.2); color: #fc8181; border: 1px solid rgba(252, 129, 129, 0.3); border-radius: var(--radius-sm); font-size: 0.75rem; cursor: pointer; transition: all 0.3s ease;"
                        onmouseover="this.style.background='rgba(252, 129, 129, 0.3)'"
                        onmouseout="this.style.background='rgba(252, 129, 129, 0.2)'">
                    🗑️ Remove Photo
                </button>
            </div>
        `;
        
        previewContainer.innerHTML = previewHTML;
        showToast('✅ Report photo loaded successfully', 'success');
    };
    
    reader.onerror = function() {
        console.error('❌ Error reading report photo file');
        showToast('❌ Error reading photo file', 'error');
        previewContainer.innerHTML = '';
    };
    
    // Read the file as data URL
    reader.readAsDataURL(file);
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

// ✅ Add this debug function to your script.js to check n8n responses
window.debugN8nResponse = async function() {
    const masterBoardId = document.getElementById('masterBoardId').value.trim();
    const companyBoardId = document.getElementById('companyBoardId').value.trim();
    
    if (!masterBoardId || !companyBoardId) {
        console.log('❌ Please enter both IDs first');
        return;
    }
    
    try {
        console.log('🔍 DEBUGGING N8N RESPONSE...');
        console.log('📤 Sending request with IDs:');
        console.log('- Master:', masterBoardId);
        console.log('- Company:', companyBoardId);
        
        const response = await fetch('/api/task-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get_task_by_ids',
                master_board_id: masterBoardId,
                company_board_id: companyBoardId
            })
        });
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', [...response.headers.entries()]);
        
        const responseText = await response.text();
        console.log('📄 Raw response text:', responseText);
        
        try {
            const jsonData = JSON.parse(responseText);
            console.log('📊 Parsed JSON data:', jsonData);
            console.log('📊 JSON structure:');
            console.log('- Type:', typeof jsonData);
            console.log('- Is Array:', Array.isArray(jsonData));
            console.log('- Keys:', Object.keys(jsonData));
            console.log('- Has success:', 'success' in jsonData);
            console.log('- Has task:', 'task' in jsonData);
            console.log('- Has data:', 'data' in jsonData);
            
            if (jsonData.task) {
                console.log('✅ Found task object:', jsonData.task);
            } else if (jsonData.data && jsonData.data.task) {
                console.log('✅ Found nested task object:', jsonData.data.task);
            } else {
                console.log('❌ No task object found in expected locations');
            }
            
        } catch (parseError) {
            console.error('❌ Failed to parse JSON:', parseError);
            console.log('📄 Response is not valid JSON');
        }
        
    } catch (error) {
        console.error('❌ Debug request failed:', error);
    }
};

// ✅ Call this in browser console: debugN8nResponse()
console.log('🔧 Debug function available: Call debugN8nResponse() in console after entering IDs');

console.log('🚀 Simplified VEBLEN Task Tracker loaded!');
