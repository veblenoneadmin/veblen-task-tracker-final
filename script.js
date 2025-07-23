// Configuration - ENHANCED VERSION WITH WORKFLOW CONTROLS
const CONFIG = {
    taskIntakeUrl: 'https://primary-s0q-production.up.railway.app/webhook/taskintakewebhook',
    taskUpdateUrl: 'https://primary-s0q-production.up.railway.app/webhook/task-update',
    timeLoggerUrl: 'https://primary-s0q-production.up.railway.app/webhook/timelogging',
    reportLoggerUrl: 'https://primary-s0q-production.up.railway.app/webhook/reportlogging',
    taskRetrievalUrl: 'https://primary-s0q-production.up.railway.app/webhook/get-tasks',
    imgbbApiKey: '679bd601ac49c50cae877fb240620cfe'
};

// WORKFLOW STATES - NEW SYSTEM
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

// State Management - ENHANCED WITH WORKFLOW CONTROLS
let currentEmployee = null;
let loadedTasks = [];
let workClockInterval = null;
let breakClockInterval = null;
let currentWorkSession = null;
let currentBreakSession = null;
let dailyShiftData = null;
let brisbaneClockInterval = null;

// NEW: Workflow State Management
let currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
let shiftResetTime = null; // 9 AM Brisbane time for next reset

// Task-specific tracking
let activeTask = null;
let taskTimeData = {};
let availableTasks = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
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
    
    // Time clock buttons - ENHANCED WITH WORKFLOW VALIDATION
    document.getElementById('startWorkBtn').addEventListener('click', handleStartWork);
    document.getElementById('breakBtn').addEventListener('click', handleBreak);
    document.getElementById('backToWorkBtn').addEventListener('click', handleResumeWork);
    document.getElementById('endWorkBtn').addEventListener('click', handleEndWork);

    // Image upload previews
    document.getElementById('taskImage').addEventListener('change', handleTaskImagePreview);
    document.getElementById('reportPhoto').addEventListener('change', handleReportPhotoPreview);

    // Set default date to today for report
    document.getElementById('reportDate').valueAsDate = new Date();
    
    // Force initialize workflow state even without employee
    console.log('🔄 Initializing workflow state...');
    currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
    initializeWorkflowState();
    
    // Debug: Log button state after 1 second
    setTimeout(() => {
        const startBtn = document.getElementById('startWorkBtn');
        console.log('🔄 START button after init:', {
            exists: !!startBtn,
            disabled: startBtn ? startBtn.disabled : 'N/A',
            classList: startBtn ? Array.from(startBtn.classList) : 'N/A',
            style: startBtn ? startBtn.style.cssText : 'N/A',
            workflowState: currentWorkflowState,
            employee: currentEmployee
        });
    }, 1000);
}

// ============= BRISBANE CLOCK SYSTEM =============

function initializeBrisbaneClock() {
    // Create Brisbane clock display after header
    createBrisbaneClockDisplay();
    
    // Update immediately
    updateBrisbaneClock();
    
    // Update every second
    brisbaneClockInterval = setInterval(updateBrisbaneClock, 1000);
}

function createBrisbaneClockDisplay() {
    const header = document.querySelector('.header');
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
}

function updateBrisbaneClock() {
    // Get current times
    const now = new Date();
    const brisbaneNow = new Date(now.toLocaleString("en-US", {timeZone: "Australia/Brisbane"}));
    
    // Update local time
    updateLocalTime(now);
    
    // Format Brisbane time and date
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
    
    // Update Brisbane display
    document.getElementById('brisbaneTime').textContent = brisbaneTimeStr;
    document.getElementById('brisbaneDate').textContent = brisbaneDateStr;
    
    // Calculate next 9 AM reset
    updateShiftResetCountdown(brisbaneNow, now);
}

function updateLocalTime(localNow) {
    // Get user's timezone
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timeZoneShort = getTimezoneShort(localNow);
    
    // Format local time
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
    
    // Update display
    const localTimeElement = document.getElementById('localTime');
    const localDateElement = document.getElementById('localDate');
    const localTimezoneElement = document.getElementById('localTimezoneLabel');
    
    if (localTimeElement) localTimeElement.textContent = localTimeStr;
    if (localDateElement) localDateElement.textContent = localDateStr;
    if (localTimezoneElement) localTimezoneElement.textContent = `🕐 Your Time (${timeZoneShort})`;
}

function getTimezoneShort(date) {
    // Get timezone abbreviation
    const timeZoneName = date.toLocaleDateString('en', {
        day: '2-digit',
        timeZoneName: 'short'
    }).substring(4);
    
    // Fallback to offset if abbreviation not available
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
    // Calculate next 9 AM Brisbane time
    const next9AM = new Date(brisbaneNow);
    next9AM.setHours(9, 0, 0, 0);
    
    // If it's already past 9 AM today, set for tomorrow
    if (brisbaneNow >= next9AM) {
        next9AM.setDate(next9AM.getDate() + 1);
    }
    
    shiftResetTime = next9AM;
    
    // Calculate time until reset
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
    
    // Calculate what 9 AM Brisbane time is in user's local time
    const localResetTime = new Date(next9AM.getTime());
    const localResetTimeStr = localResetTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    
    document.getElementById('resetCountdown').textContent = countdownStr;
    document.getElementById('nextResetTime').textContent = resetTimeStr;
    
    // Update work start notice with user's local time
    const workStartNotice = document.querySelector('.work-start-notice');
    if (workStartNotice) {
        workStartNotice.textContent = `🔴 Work starts at ${localResetTimeStr} your time`;
    }
    
    // Check if we need to reset workflow state
    checkForShiftReset(brisbaneNow);
}

function checkForShiftReset(brisbaneNow) {
    const today9AM = new Date(brisbaneNow);
    today9AM.setHours(9, 0, 0, 0);
    
    // Get last reset check time
    const lastResetCheck = localStorage.getItem('lastShiftResetCheck');
    const lastResetDate = lastResetCheck ? new Date(lastResetCheck) : new Date(0);
    
    // If it's past 9 AM today and we haven't reset since yesterday's 9 AM
    if (brisbaneNow >= today9AM && lastResetDate < today9AM) {
        performShiftReset();
        localStorage.setItem('lastShiftResetCheck', brisbaneNow.toISOString());
    }
}

function performShiftReset() {
    console.log('🔄 Performing automatic shift reset at 9 AM Brisbane time');
    
    // Reset workflow state
    currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
    
    // Clear all sessions and clock data
    clearWorkClockState();
    
    // Reset task time data (keep historical but reset daily totals)
    resetDailyTaskTimeData();
    
    // Update button states
    updateWorkflowButtonStates();
    
    // Clear active task display
    const activeTaskSection = document.getElementById('activeTaskSection');
    if (activeTaskSection) {
        activeTaskSection.style.display = 'none';
    }
    
    // Save state
    saveWorkflowState();
    
    showToast('🌅 New shift day has begun! You can now start work.', 'info');
}

// ============= WORKFLOW STATE MANAGEMENT =============

function initializeWorkflowState() {
    console.log('🔄 initializeWorkflowState called');
    
    // Always start fresh if no employee is selected
    if (!currentEmployee) {
        console.log('🔄 No employee selected, setting to NOT_STARTED');
        currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
        updateWorkflowButtonStates();
        return;
    }
    
    // Load saved workflow state for this employee
    const savedState = loadWorkflowState();
    
    if (savedState && savedState.state) {
        currentWorkflowState = savedState.state;
        console.log('🔄 Restored workflow state:', currentWorkflowState);
    } else {
        // Default to NOT_STARTED if no saved state
        currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
        console.log('🔄 No saved state, defaulting to:', currentWorkflowState);
    }
    
    // Update button states based on current workflow
    updateWorkflowButtonStates();
    
    // Force save the current state
    saveWorkflowState();
}

function saveWorkflowState() {
    if (!currentEmployee) return;
    
    const workflowStateKey = `workflowState_${currentEmployee}`;
    const state = {
        state: currentWorkflowState,
        timestamp: new Date().toISOString(),
        employee: currentEmployee,
        shiftDate: new Date().toDateString() // Track which day this state is for
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
            
            // Only restore state if it's from today
            if (stateDate === today) {
                return state;
            } else {
                // Clear old state
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
    
    // Debug logging
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
            // Only START WORK is available
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
            
            // Ensure START WORK is enabled
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.classList.remove('btn-disabled');
                startBtn.style.pointerEvents = 'auto';
                startBtn.style.opacity = '1';
            }
            
            updateTimeClockStatus('Ready to start your shift', new Date());
            break;
            
        case WORKFLOW_STATES.WORKING:
            // Only BREAK and END WORK are available
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
            // Only BACK TO WORK is available
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
            // No buttons available until next shift reset
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
            // Fallback to NOT_STARTED if state is undefined
            console.log('🔄 Unknown workflow state, defaulting to NOT_STARTED');
            currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
            updateWorkflowButtonStates();
            return;
    }
    
    console.log('🔄 Button states updated for workflow:', currentWorkflowState);
    console.log('🔄 START button enabled:', startBtn ? !startBtn.disabled : 'button not found');
}

// Reset daily task time data
function resetDailyTaskTimeData() {
    Object.keys(taskTimeData).forEach(taskId => {
        if (taskTimeData[taskId]) {
            // Keep historical data but reset daily totals
            taskTimeData[taskId].totalTimeToday = 0;
            taskTimeData[taskId].lastActiveDate = new Date().toDateString();
            
            // Clear any current session
            if (taskTimeData[taskId].currentSession) {
                delete taskTimeData[taskId].currentSession;
            }
        }
    });
    
    saveTaskTimeData();
}

// ============= BRISBANE CLOCK SYSTEM =============

function initializeBrisbaneClock() {
    // Create Brisbane clock display after header
    createBrisbaneClockDisplay();
    
    // Update immediately
    updateBrisbaneClock();
    
    // Update every second
    brisbaneClockInterval = setInterval(updateBrisbaneClock, 1000);
}

function createBrisbaneClockDisplay() {
    const header = document.querySelector('.header');
    const clockHTML = `
        <div id="brisbaneClockSection" class="brisbane-clock-section">
            <div class="brisbane-clock-container">
                <div class="brisbane-time-display">
                    <div class="time-zone-label">Brisbane Time</div>
                    <div class="current-time" id="brisbaneTime">--:--:--</div>
                    <div class="current-date" id="brisbaneDate">-- -- ----</div>
                </div>
                <div class="shift-reset-display">
                    <div class="reset-label">Next Shift Reset</div>
                    <div class="reset-countdown" id="resetCountdown">--:--:--</div>
                    <div class="reset-time" id="nextResetTime">Tomorrow at 9:00 AM</div>
                </div>
            </div>
        </div>
    `;
    
    header.insertAdjacentHTML('afterend', clockHTML);
}

function updateBrisbaneClock() {
    // Get current Brisbane time (AEST/AEDT)
    const brisbaneTime = new Date().toLocaleString("en-AU", {
        timeZone: "Australia/Brisbane",
        hour12: false
    });
    
    const now = new Date();
    const brisbaneNow = new Date(now.toLocaleString("en-US", {timeZone: "Australia/Brisbane"}));
    
    // Format time and date
    const timeStr = brisbaneNow.toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit', 
        second: '2-digit',
        hour12: false
    });
    
    const dateStr = brisbaneNow.toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Update display
    document.getElementById('brisbaneTime').textContent = timeStr;
    document.getElementById('brisbaneDate').textContent = dateStr;
    
    // Calculate next 9 AM reset
    updateShiftResetCountdown(brisbaneNow);
}

function updateShiftResetCountdown(brisbaneNow) {
    // Calculate next 9 AM Brisbane time
    const next9AM = new Date(brisbaneNow);
    next9AM.setHours(9, 0, 0, 0);
    
    // If it's already past 9 AM today, set for tomorrow
    if (brisbaneNow >= next9AM) {
        next9AM.setDate(next9AM.getDate() + 1);
    }
    
    shiftResetTime = next9AM;
    
    // Calculate time until reset
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
    
    document.getElementById('resetCountdown').textContent = countdownStr;
    document.getElementById('nextResetTime').textContent = resetTimeStr;
    
    // Check if we need to reset workflow state
    checkForShiftReset(brisbaneNow);
}

function checkForShiftReset(brisbaneNow) {
    const today9AM = new Date(brisbaneNow);
    today9AM.setHours(9, 0, 0, 0);
    
    // Get last reset check time
    const lastResetCheck = localStorage.getItem('lastShiftResetCheck');
    const lastResetDate = lastResetCheck ? new Date(lastResetCheck) : new Date(0);
    
    // If it's past 9 AM today and we haven't reset since yesterday's 9 AM
    if (brisbaneNow >= today9AM && lastResetDate < today9AM) {
        performShiftReset();
        localStorage.setItem('lastShiftResetCheck', brisbaneNow.toISOString());
    }
}

function performShiftReset() {
    console.log('🔄 Performing automatic shift reset at 9 AM Brisbane time');
    
    // Reset workflow state
    currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
    
    // Clear all sessions and clock data
    clearWorkClockState();
    
    // Reset task time data (keep historical but reset daily totals)
    resetDailyTaskTimeData();
    
    // Update button states
    updateWorkflowButtonStates();
    
    // Clear active task display
    const activeTaskSection = document.getElementById('activeTaskSection');
    if (activeTaskSection) {
        activeTaskSection.style.display = 'none';
    }
    
    // Save state
    saveWorkflowState();
    
    showToast('🌅 New shift day has begun! You can now start work.', 'info');
}

// ============= WORKFLOW STATE MANAGEMENT =============

function initializeWorkflowState() {
    // Load saved workflow state
    const savedState = loadWorkflowState();
    
    if (savedState) {
        currentWorkflowState = savedState.state;
        console.log('🔄 Restored workflow state:', currentWorkflowState);
    }
    
    // Update button states based on current workflow
    updateWorkflowButtonStates();
}

function saveWorkflowState() {
    if (!currentEmployee) return;
    
    const workflowStateKey = `workflowState_${currentEmployee}`;
    const state = {
        state: currentWorkflowState,
        timestamp: new Date().toISOString(),
        employee: currentEmployee,
        shiftDate: new Date().toDateString() // Track which day this state is for
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
            
            // Only restore state if it's from today
            if (stateDate === today) {
                return state;
            } else {
                // Clear old state
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
    
    // Reset all buttons
    [startBtn, breakBtn, backToWorkBtn, endWorkBtn].forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('btn-disabled');
    });
    
    // Apply workflow restrictions
    switch (currentWorkflowState) {
        case WORKFLOW_STATES.NOT_STARTED:
            // Only START WORK is available
            breakBtn.disabled = true;
            backToWorkBtn.disabled = true;
            endWorkBtn.disabled = true;
            
            startBtn.classList.remove('btn-disabled');
            breakBtn.classList.add('btn-disabled');
            backToWorkBtn.classList.add('btn-disabled');
            endWorkBtn.classList.add('btn-disabled');
            
            updateTimeClockStatus('Ready to start your shift', new Date());
            break;
            
        case WORKFLOW_STATES.WORKING:
            // Only BREAK and END WORK are available
            startBtn.disabled = true;
            backToWorkBtn.disabled = true;
            
            startBtn.classList.add('btn-disabled');
            breakBtn.classList.remove('btn-disabled');
            backToWorkBtn.classList.add('btn-disabled');
            endWorkBtn.classList.remove('btn-disabled');
            break;
            
        case WORKFLOW_STATES.ON_BREAK:
            // Only BACK TO WORK is available
            startBtn.disabled = true;
            breakBtn.disabled = true;
            endWorkBtn.disabled = true;
            
            startBtn.classList.add('btn-disabled');
            breakBtn.classList.add('btn-disabled');
            backToWorkBtn.classList.remove('btn-disabled');
            endWorkBtn.classList.add('btn-disabled');
            break;
            
        case WORKFLOW_STATES.FINISHED:
            // No buttons available until next shift reset
            startBtn.disabled = true;
            breakBtn.disabled = true;
            backToWorkBtn.disabled = true;
            endWorkBtn.disabled = true;
            
            [startBtn, breakBtn, backToWorkBtn, endWorkBtn].forEach(btn => {
                btn.classList.add('btn-disabled');
            });
            
            updateTimeClockStatus('Shift completed. See you tomorrow!', new Date());
            break;
    }
    
    console.log('🔄 Updated button states for workflow:', currentWorkflowState);
}

// ============= ENHANCED TIME CLOCK WITH WORKFLOW VALIDATION =============

// Handle start work with enhanced debugging
async function handleStartWork() {
    console.log('🟢 START WORK button clicked!');
    console.log('🔄 Current employee:', currentEmployee);
    console.log('🔄 Current workflow state:', currentWorkflowState);
    
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    // Validate workflow state
    if (currentWorkflowState !== WORKFLOW_STATES.NOT_STARTED) {
        console.log('❌ Wrong workflow state for starting work:', currentWorkflowState);
        showToast('You can only start work at the beginning of your shift', 'error');
        return;
    }
    
    console.log('✅ Proceeding to task selection...');
    // Show task selection modal
    await showTaskSelectionModal();
}

async function handleBreak() {
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    // Validate workflow state
    if (currentWorkflowState !== WORKFLOW_STATES.WORKING) {
        showToast('You can only take a break while working', 'error');
        return;
    }
    
    await handleTimeClock('☕ TAKE BREAK');
    currentWorkflowState = WORKFLOW_STATES.ON_BREAK;
    saveWorkflowState();
    updateWorkflowButtonStates();
}

async function handleResumeWork() {
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    // Validate workflow state
    if (currentWorkflowState !== WORKFLOW_STATES.ON_BREAK) {
        showToast('You can only resume work from a break', 'error');
        return;
    }
    
    // Ask if they want to continue the same task or switch
    if (activeTask) {
        const continueTask = confirm(`Continue working on "${activeTask.name}"?\n\nClick OK to continue, Cancel to select a different task.`);
        
        if (continueTask) {
            // Continue with same task
            await handleTimeClock('🔵 BACK TO WORK');
            resumeTaskTimeTracking();
            currentWorkflowState = WORKFLOW_STATES.WORKING;
            saveWorkflowState();
            updateWorkflowButtonStates();
            showToast(`Resumed: ${activeTask.name}`, 'success');
        } else {
            // Select different task but stay in same workflow transition
            await showTaskSelectionModalForResume();
        }
    } else {
        // No active task, show selection
        await showTaskSelectionModalForResume();
    }
}

async function showTaskSelectionModalForResume() {
    // Ensure we have tasks loaded
    if (availableTasks.length === 0) {
        showToast('Loading your tasks...', 'info');
        await loadAssignedTasks();
    }
    
    if (availableTasks.length === 0) {
        showToast('No tasks available. Create a task first!', 'warning');
        return;
    }
    
    // Create modal if it doesn't exist
    if (!document.getElementById('taskSelectionModal')) {
        createTaskSelectionModal();
    }
    
    // Populate tasks
    populateTaskSelection();
    
    // Update modal for resume context
    document.querySelector('#taskSelectionModal .modal-header h2').textContent = '🔄 Resume Work - Select Task';
    document.getElementById('startSelectedTaskBtn').textContent = '🔵 Resume Working';
    document.getElementById('startSelectedTaskBtn').onclick = resumeWorkOnSelectedTask;
    
    // Show modal
    document.getElementById('taskSelectionModal').style.display = 'block';
}

async function resumeWorkOnSelectedTask() {
    if (!activeTask) {
        showToast('Please select a task first', 'warning');
        return;
    }
    
    // Close modal
    closeTaskSelectionModal();
    
    // Resume the actual time tracking
    await handleTimeClock('🔵 BACK TO WORK');
    
    // Initialize task time tracking
    resumeTaskTimeTracking();
    
    // Update workflow state
    currentWorkflowState = WORKFLOW_STATES.WORKING;
    saveWorkflowState();
    updateWorkflowButtonStates();
    
    showToast(`Resumed working on: ${activeTask.name}`, 'success');
}

async function handleEndWork() {
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    // Validate workflow state
    if (currentWorkflowState !== WORKFLOW_STATES.WORKING) {
        showToast('You can only end work while actively working', 'error');
        return;
    }
    
    // Confirm end of shift
    if (!confirm('Are you sure you want to end your shift for today?\n\nYou won\'t be able to start work again until tomorrow at 9 AM Brisbane time.')) {
        return;
    }
    
    // Finalize current task time
    if (activeTask && taskTimeData[activeTask.id]?.currentSession) {
        finalizeCurrentTaskSession();
    }
    
    // End work day
    await handleTimeClock('🔴 DONE FOR TODAY');
    
    // Update workflow state
    currentWorkflowState = WORKFLOW_STATES.FINISHED;
    saveWorkflowState();
    updateWorkflowButtonStates();
    
    // Show summary including task-specific time
    showDayEndSummary();
    
    // Clear active task
    activeTask = null;
    updateActiveTaskDisplay();
}

// ============= START WORK WITH TASK SELECTION =============

async function showTaskSelectionModal() {
    // Ensure we have tasks loaded
    if (availableTasks.length === 0) {
        showToast('Loading your tasks...', 'info');
        await loadAssignedTasks();
    }
    
    if (availableTasks.length === 0) {
        showToast('No tasks available. Create a task first!', 'warning');
        return;
    }
    
    // Create modal if it doesn't exist
    if (!document.getElementById('taskSelectionModal')) {
        createTaskSelectionModal();
    }
    
    // Reset modal for start work context
    document.querySelector('#taskSelectionModal .modal-header h2').textContent = '🎯 What are you working on?';
    document.getElementById('startSelectedTaskBtn').textContent = '🟢 Start Working';
    document.getElementById('startSelectedTaskBtn').onclick = startWorkOnSelectedTask;
    
    // Populate tasks
    populateTaskSelection();
    
    // Show modal
    document.getElementById('taskSelectionModal').style.display = 'block';
}

async function startWorkOnSelectedTask() {
    if (!activeTask) {
        showToast('Please select a task first', 'warning');
        return;
    }
    
    // Close modal
    closeTaskSelectionModal();
    
    // Start the actual time tracking
    await handleTimeClock('🟢 START WORK');
    
    // Update workflow state
    currentWorkflowState = WORKFLOW_STATES.WORKING;
    saveWorkflowState();
    updateWorkflowButtonStates();
    
    // Initialize task time tracking
    initializeTaskTimeTracking();
    
    showToast(`Started working on: ${activeTask.name}`, 'success');
}

// ============= EMPLOYEE CHANGE HANDLER - ENHANCED =============

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
    
    // Load assigned tasks for task selection
    await loadAssignedTasks();
    
    // Load and restore work clock state
    await loadWorkClockState();
    
    // Load task time data
    loadTaskTimeData();
    
    // Initialize workflow state for this employee
    initializeWorkflowState();
}

function clearEmployeeData() {
    document.getElementById('assignedTasksList').innerHTML = '<p class="loading">Select an employee to view assigned tasks...</p>';
    clearWorkClockState();
    availableTasks = [];
    taskTimeData = {};
    currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
    updateWorkflowButtonStates();
}

// ============= RESET DAILY TASK TIME DATA =============

function resetDailyTaskTimeData() {
    Object.keys(taskTimeData).forEach(taskId => {
        if (taskTimeData[taskId]) {
            // Keep historical data but reset daily totals
            taskTimeData[taskId].totalTimeToday = 0;
            taskTimeData[taskId].lastActiveDate = new Date().toDateString();
            
            // Clear any current session
            if (taskTimeData[taskId].currentSession) {
                delete taskTimeData[taskId].currentSession;
            }
        }
    });
    
    saveTaskTimeData();
}

// ============= ALL EXISTING FUNCTIONS (keeping all the original functionality) =============

// Create task selection modal
function createTaskSelectionModal() {
    const modalHTML = `
    <div id="taskSelectionModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>🎯 What are you working on?</h2>
                <span class="close" onclick="closeTaskSelectionModal()">&times;</span>
            </div>
            
            <div class="modal-body">
                <p style="color: var(--text-secondary); margin-bottom: var(--spacing-lg);">
                    Select a task to start tracking your time:
                </p>
                
                <div id="taskSelectionList" class="task-selection-list">
                    <!-- Tasks will be populated here -->
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeTaskSelectionModal()">
                        Cancel
                    </button>
                    <button type="button" class="btn btn-primary" onclick="startWorkOnSelectedTask()" id="startSelectedTaskBtn" disabled>
                        🟢 Start Working
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Populate task selection
function populateTaskSelection() {
    const taskList = document.getElementById('taskSelectionList');
    
    if (availableTasks.length === 0) {
        taskList.innerHTML = `
            <div class="no-tasks-message">
                <p>No tasks available</p>
                <p style="color: var(--text-secondary); font-size: 0.875rem;">Create a task first to start tracking time</p>
            </div>
        `;
        return;
    }
    
    taskList.innerHTML = availableTasks.map(task => `
        <div class="task-selection-item" onclick="selectTaskForWork('${task.id}')">
            <div class="task-selection-header">
                <div class="task-selection-title">${task.name}</div>
                <div class="task-selection-company">${task.company}</div>
            </div>
            <div class="task-selection-meta">
                <span class="task-selection-status ${getStatusClass(task.status)}">${task.status}</span>
                <span class="task-selection-progress">${task.progress}%</span>
            </div>
            <div class="task-selection-time">
                ⏱️ Today: ${getTaskTodayTime(task.id)}
            </div>
        </div>
    `).join('');
}

// Select task for work
function selectTaskForWork(taskId) {
    // Remove previous selection
    document.querySelectorAll('.task-selection-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add selection to clicked item
    event.currentTarget.classList.add('selected');
    
    // Find and store selected task
    activeTask = availableTasks.find(task => task.id === taskId);
    
    // Enable start button
    document.getElementById('startSelectedTaskBtn').disabled = false;
    
    console.log('Selected task for work:', activeTask);
}

// Close task selection modal
function closeTaskSelectionModal() {
    const modal = document.getElementById('taskSelectionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Initialize task time tracking
function initializeTaskTimeTracking() {
    if (!activeTask) return;
    
    const now = new Date();
    
    // Initialize task time data if not exists
    if (!taskTimeData[activeTask.id]) {
        taskTimeData[activeTask.id] = {
            taskName: activeTask.name,
            company: activeTask.company,
            sessions: [],
            totalTimeToday: 0,
            totalTimeAllTime: 0
        };
    }
    
    // Start new session for this task
    taskTimeData[activeTask.id].currentSession = {
        startTime: now.toISOString(),
        breakTime: 0
    };
    
    // Save to localStorage
    saveTaskTimeData();
    
    // Update UI to show active task
    updateActiveTaskDisplay();
}

// Resume task time tracking
function resumeTaskTimeTracking() {
    if (!activeTask || !taskTimeData[activeTask.id]) return;
    
    const now = new Date();
    
    // Start new session or resume existing one
    if (!taskTimeData[activeTask.id].currentSession) {
        taskTimeData[activeTask.id].currentSession = {
            startTime: now.toISOString(),
            breakTime: 0
        };
    } else {
        // If resuming from break, just update the resume time
        taskTimeData[activeTask.id].currentSession.resumeTime = now.toISOString();
    }
    
    saveTaskTimeData();
    updateActiveTaskDisplay();
}

// Update active task display
function updateActiveTaskDisplay() {
    const activeTaskSection = document.getElementById('activeTaskSection');
    
    if (!activeTask) {
        if (activeTaskSection) {
            activeTaskSection.style.display = 'none';
        }
        return;
    }
    
    if (activeTaskSection) {
        activeTaskSection.style.display = 'block';
        const activeTaskInfo = document.getElementById('activeTaskInfo');
        
        if (activeTaskInfo) {
            activeTaskInfo.innerHTML = `
                <div class="active-task-card">
                    <div class="active-task-header">
                        <h4>Currently Working On:</h4>
                        <span class="task-company-badge">${activeTask.company}</span>
                    </div>
                    <div class="active-task-name">${activeTask.name}</div>
                    <div class="active-task-meta">
                        <span class="active-task-status ${getStatusClass(activeTask.status)}">${activeTask.status}</span>
                        <span class="active-task-progress">${activeTask.progress}% complete</span>
                    </div>
                    <div class="active-task-time">
                        <div class="time-today">Today on this task: <span id="activeTaskTimeToday">${getTaskTodayTime(activeTask.id)}</span></div>
                        <div class="time-session">This session: <span id="activeTaskSessionTime">00:00:00</span></div>
                    </div>
                </div>
            `;
        }
    }
}

// Finalize current task session
function finalizeCurrentTaskSession() {
    if (!activeTask || !taskTimeData[activeTask.id]?.currentSession) return;
    
    const now = new Date();
    const session = taskTimeData[activeTask.id].currentSession;
    const startTime = new Date(session.startTime);
    const sessionDuration = now.getTime() - startTime.getTime();
    
    // Add completed session
    taskTimeData[activeTask.id].sessions.push({
        startTime: session.startTime,
        endTime: now.toISOString(),
        duration: sessionDuration,
        breakTime: session.breakTime || 0,
        workTime: sessionDuration - (session.breakTime || 0)
    });
    
    // Update totals
    taskTimeData[activeTask.id].totalTimeToday += sessionDuration - (session.breakTime || 0);
    taskTimeData[activeTask.id].totalTimeAllTime += sessionDuration - (session.breakTime || 0);
    
    // Clear current session
    delete taskTimeData[activeTask.id].currentSession;
    
    saveTaskTimeData();
    
    console.log('Finalized task session:', {
        task: activeTask.name,
        sessionTime: formatElapsedTime(sessionDuration),
        workTime: formatElapsedTime(sessionDuration - (session.breakTime || 0))
    });
}

// Get task today time
function getTaskTodayTime(taskId) {
    if (!taskTimeData[taskId]) return '00:00:00';
    
    let totalTime = taskTimeData[taskId].totalTimeToday || 0;
    
    // Add current session time if active
    if (taskTimeData[taskId].currentSession) {
        const now = Date.now();
        const sessionStart = new Date(taskTimeData[taskId].currentSession.startTime).getTime();
        const sessionTime = now - sessionStart;
        totalTime += sessionTime;
    }
    
    return formatElapsedTime(totalTime);
}

// Load task time data from localStorage
function loadTaskTimeData() {
    if (!currentEmployee) return;
    
    const taskTimeKey = `taskTime_${currentEmployee}`;
    const saved = localStorage.getItem(taskTimeKey);
    
    if (saved) {
        try {
            const data = JSON.parse(saved);
            const today = new Date().toDateString();
            
            // Reset daily totals if it's a new day
            Object.keys(data).forEach(taskId => {
                if (data[taskId].lastActiveDate !== today) {
                    data[taskId].totalTimeToday = 0;
                    data[taskId].lastActiveDate = today;
                }
            });
            
            taskTimeData = data;
        } catch (error) {
            console.error('Error loading task time data:', error);
            taskTimeData = {};
        }
    }
}

// Save task time data to localStorage
function saveTaskTimeData() {
    if (!currentEmployee) return;
    
    const taskTimeKey = `taskTime_${currentEmployee}`;
    const today = new Date().toDateString();
    
    // Mark last active date
    Object.keys(taskTimeData).forEach(taskId => {
        taskTimeData[taskId].lastActiveDate = today;
    });
    
    localStorage.setItem(taskTimeKey, JSON.stringify(taskTimeData));
}

// Show day end summary with task breakdown
function showDayEndSummary() {
    if (!taskTimeData || Object.keys(taskTimeData).length === 0) {
        showShiftSummary(); // Fallback to existing summary
        return;
    }
    
    let summary = `🎯 Day Complete!\n\n`;
    summary += `📊 TASK BREAKDOWN:\n`;
    
    let totalTaskTime = 0;
    
    Object.values(taskTimeData).forEach(task => {
        if (task.totalTimeToday > 0) {
            const timeFormatted = formatElapsedTime(task.totalTimeToday);
            summary += `• ${task.taskName}: ${timeFormatted}\n`;
            totalTaskTime += task.totalTimeToday;
        }
    });
    
    summary += `\n⏱️ Total Task Time: ${formatElapsedTime(totalTaskTime)}\n`;
    
    if (dailyShiftData) {
        const shiftTime = formatElapsedTime(dailyShiftData.totalWorkedMs);
        summary += `🕐 Total Shift Time: ${shiftTime}\n`;
        
        if (totalTaskTime < dailyShiftData.totalWorkedMs) {
            const unaccountedTime = dailyShiftData.totalWorkedMs - totalTaskTime;
            summary += `❓ Unaccounted Time: ${formatElapsedTime(unaccountedTime)}`;
        }
    }
    
    summary += `\n\n🌅 See you tomorrow! Work can resume at 9:00 AM Brisbane time.`;
    
    showToast(summary, 'success');
}

// ============= ALL OTHER EXISTING FUNCTIONS (keeping unchanged) =============
// [Include all your other existing functions here - task intake, daily report, etc.]
// I'll include the key ones to maintain functionality:

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
            showToast(`${action} recorded successfully!`, 'success');
            
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
            
            if (activeTask && taskTimeData[activeTask.id]?.currentSession) {
                taskTimeData[activeTask.id].currentSession.breakStartTime = timestamp.toISOString();
            }
            
            currentBreakSession = {
                startTime: timestamp,
                lastUpdate: timestamp
            };
            startBreakClock();
            break;
            
        case '🔵 BACK TO WORK':
            if (activeTask && taskTimeData[activeTask.id]?.currentSession?.breakStartTime) {
                const breakStart = new Date(taskTimeData[activeTask.id].currentSession.breakStartTime);
                const breakDuration = timestamp.getTime() - breakStart.getTime();
                taskTimeData[activeTask.id].currentSession.breakTime += breakDuration;
                delete taskTimeData[activeTask.id].currentSession.breakStartTime;
                saveTaskTimeData();
            }
            
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

// Format elapsed time to HH:MM:SS
function formatElapsedTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Start work clock timer
function startWorkClock() {
    if (workClockInterval) clearInterval(workClockInterval);
    if (breakClockInterval) clearInterval(breakClockInterval);
    
    document.getElementById('breakClockDisplay').style.display = 'none';
    document.getElementById('workClockDisplay').style.display = 'block';
    
    updateWorkTimer();
    
    workClockInterval = setInterval(() => {
        updateWorkTimer();
        updateActiveTaskTimer();
    }, 1000);
    
    if (currentWorkSession) {
        saveWorkClockState('working', currentWorkSession.startTime);
    }
}

// Start break clock timer
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

// Update active task timer
function updateActiveTaskTimer() {
    const sessionTimeElement = document.getElementById('activeTaskSessionTime');
    const todayTimeElement = document.getElementById('activeTaskTimeToday');
    
    if (sessionTimeElement && activeTask && taskTimeData[activeTask.id]?.currentSession) {
        const now = Date.now();
        const sessionStart = new Date(taskTimeData[activeTask.id].currentSession.startTime).getTime();
        const sessionTime = now - sessionStart;
        sessionTimeElement.textContent = formatElapsedTime(sessionTime);
    }
    
    if (todayTimeElement && activeTask) {
        todayTimeElement.textContent = getTaskTodayTime(activeTask.id);
    }
}

// Update work timer display
function updateWorkTimer() {
    if (!currentWorkSession || !dailyShiftData) return;
    
    const now = Date.now();
    const currentSessionElapsed = now - currentWorkSession.startTime.getTime();
    const currentSessionFormatted = formatElapsedTime(currentSessionElapsed);
    const totalShiftTime = dailyShiftData.totalWorkedMs + currentSessionElapsed;
    const totalShiftFormatted = formatElapsedTime(totalShiftTime);
    
    document.getElementById('workTimer').textContent = currentSessionFormatted;
    document.getElementById('totalShiftTime').textContent = totalShiftFormatted;
    
    updateShiftProgress(totalShiftTime);
    
    const startTimeStr = currentWorkSession.startTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('workStatus').textContent = `Current session started at ${startTimeStr}`;
}

// Update break timer display
function updateBreakTimer() {
    if (!currentBreakSession || !dailyShiftData) return;
    
    const now = Date.now();
    const elapsed = now - currentBreakSession.startTime.getTime();
    const formattedTime = formatElapsedTime(elapsed);
    
    document.getElementById('breakTimer').textContent = formattedTime;
    
    const totalWorkedFormatted = formatElapsedTime(dailyShiftData.totalWorkedMs);
    const remainingMs = Math.max(0, dailyShiftData.targetShiftMs - dailyShiftData.totalWorkedMs);
    const remainingFormatted = formatElapsedTime(remainingMs);
    
    document.getElementById('totalWorkedOnBreak').textContent = totalWorkedFormatted;
    document.getElementById('shiftRemainingOnBreak').textContent = remainingFormatted;
    
    const startTimeStr = currentBreakSession.startTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('breakStatus').textContent = `Started break at ${startTimeStr}`;
}

// Update shift progress bar and status
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

// Save work clock state
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
    
    document.getElementById('workClockDisplay').style.display = 'none';
    document.getElementById('breakClockDisplay').style.display = 'none';
    
    currentWorkSession = null;
    currentBreakSession = null;
    dailyShiftData = null;
    
    if (currentEmployee) {
        const clockStateKey = `workClock_${currentEmployee}`;
        localStorage.removeItem(clockStateKey);
    }
}

// Stop all clocks
function stopAllClocks() {
    clearWorkClockState();
    
    if (currentEmployee) {
        const clockStateKey = `workClock_${currentEmployee}`;
        saveWorkClockState('stopped', new Date());
    }
}

// Update time clock status
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
            statusMessage = `Work started at ${time}${activeTask ? ` on "${activeTask.name}"` : ''}`;
            statusClass = 'status-working';
            break;
        case '☕ TAKE BREAK':
            statusMessage = `Break started at ${time}`;
            statusClass = 'status-break';
            break;
        case '🔵 BACK TO WORK':
            statusMessage = `Resumed work at ${time}${activeTask ? ` on "${activeTask.name}"` : ''}`;
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

// Show shift summary when ending work
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

// Load assigned tasks
async function loadAssignedTasks() {
    if (!currentEmployee) {
        document.getElementById('assignedTasksList').innerHTML = '<p class="loading">Select an employee to view assigned tasks...</p>';
        return;
    }
    
    try {
        showToast('Loading your tasks...', 'info');
        
        // Try to fetch real tasks
        try {
            const response = await fetch(CONFIG.taskRetrievalUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'get_assigned_tasks',
                    employee: currentEmployee
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.tasks) {
                    availableTasks = data.tasks;
                    renderTasksList(data.tasks);
                    return;
                }
            }
        } catch (error) {
            console.log('Task retrieval endpoint not ready, using sample data');
        }
        
        // Fallback to sample data
        availableTasks = [
            {
                id: 'TASK_001',
                name: 'Website Design Updates',
                company: 'CROWN REALITY',
                status: 'Current Project',
                progress: 45,
                dueDate: '2025-02-01',
                description: 'Update homepage design and mobile responsiveness'
            },
            {
                id: 'TASK_002',
                name: 'Social Media Campaign',
                company: 'LCMB GROUP',
                status: 'Project',
                progress: 20,
                dueDate: '2025-02-15',
                description: 'Create social media content for Q1 campaign'
            }
        ];
        
        renderTasksList(availableTasks);
        
    } catch (error) {
        console.error('Error loading assigned tasks:', error);
        showToast('Error loading assigned tasks', 'error');
    }
}

// Render tasks list with time tracking info
function renderTasksList(tasks) {
    const tasksList = document.getElementById('assignedTasksList');
    
    if (tasks.length === 0) {
        tasksList.innerHTML = '<p class="loading">No tasks assigned. Create a task to get started!</p>';
        return;
    }
    
    tasksList.innerHTML = tasks.map(task => `
        <div class="task-card ${activeTask?.id === task.id ? 'active-task' : ''}">
            <div class="task-card-header">
                <h4>${task.name}</h4>
                <span class="task-status ${getStatusClass(task.status)}">${task.status}</span>
            </div>
            <p><strong>Company:</strong> ${task.company}</p>
            <p><strong>Due Date:</strong> ${task.dueDate || 'Not set'}</p>
            <p><strong>Description:</strong> ${task.description}</p>
            
            <div class="progress-section">
                <div class="progress-header">
                    <span class="progress-label">Progress</span>
                    <span class="progress-value">${task.progress}%</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${task.progress}%"></div>
                </div>
                <input type="range" 
                       class="progress-slider" 
                       min="0" 
                       max="100" 
                       value="${task.progress}"
                       data-task-id="${task.id}"
                       data-company="${task.company}"
                       onchange="updateTaskProgress(this)">
            </div>
            
            <div class="task-time-info">
                <div class="time-stat">
                    <span class="time-label">Today:</span>
                    <span class="time-value">${getTaskTodayTime(task.id)}</span>
                </div>
                <div class="time-stat">
                    <span class="time-label">Status:</span>
                    <span class="time-value">${activeTask?.id === task.id ? '🟢 Active' : '⏸️ Inactive'}</span>
                </div>
            </div>
            
            <div class="task-actions">
                <button class="btn btn-secondary btn-sm" onclick="openTaskEditor('${task.id}')">
                    ✏️ Edit Task
                </button>
                ${activeTask?.id === task.id 
                    ? '<button class="btn btn-warning btn-sm" onclick="switchToTask(\'' + task.id + '\')">🔄 Current Task</button>'
                    : '<button class="btn btn-success btn-sm" onclick="switchToTask(\'' + task.id + '\')">▶️ Work on This</button>'
                }
            </div>
        </div>
    `).join('');
}

// Switch to different task
async function switchToTask(taskId) {
    const task = availableTasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Check workflow state
    if (currentWorkflowState === WORKFLOW_STATES.NOT_STARTED) {
        showToast('Please start your work shift first', 'warning');
        return;
    }
    
    if (currentWorkflowState === WORKFLOW_STATES.ON_BREAK) {
        showToast('Please resume work from break first', 'warning');
        return;
    }
    
    if (currentWorkflowState === WORKFLOW_STATES.FINISHED) {
        showToast('Your shift has ended. You cannot switch tasks until tomorrow.', 'warning');
        return;
    }
    
    // If currently working, finalize current task
    if (activeTask && taskTimeData[activeTask.id]?.currentSession) {
        finalizeCurrentTaskSession();
    }
    
    // Set new active task
    activeTask = task;
    
    // Initialize time tracking for new task
    initializeTaskTimeTracking();
    
    // Update UI
    await loadAssignedTasks();
    updateActiveTaskDisplay();
    
    showToast(`Switched to: ${task.name}`, 'success');
}

// Helper function to get status class for styling
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
    return statusClasses[status] || 'status-default';
}

// Toast notification
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

// ============= ENHANCED TIME CLOCK WITH WORKFLOW VALIDATION =============

async function handleStartWork() {
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    // Validate workflow state
    if (currentWorkflowState !== WORKFLOW_STATES.NOT_STARTED) {
        showToast('You can only start work at the beginning of your shift', 'error');
        return;
    }
    
    // Show task selection modal
    await showTaskSelectionModal();
}

async function handleBreak() {
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    // Validate workflow state
    if (currentWorkflowState !== WORKFLOW_STATES.WORKING) {
        showToast('You can only take a break while working', 'error');
        return;
    }
    
    await handleTimeClock('☕ TAKE BREAK');
    currentWorkflowState = WORKFLOW_STATES.ON_BREAK;
    saveWorkflowState();
    updateWorkflowButtonStates();
}

async function handleResumeWork() {
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    // Validate workflow state
    if (currentWorkflowState !== WORKFLOW_STATES.ON_BREAK) {
        showToast('You can only resume work from a break', 'error');
        return;
    }
    
    // Ask if they want to continue the same task or switch
    if (activeTask) {
        const continueTask = confirm(`Continue working on "${activeTask.name}"?\n\nClick OK to continue, Cancel to select a different task.`);
        
        if (continueTask) {
            // Continue with same task
            await handleTimeClock('🔵 BACK TO WORK');
            resumeTaskTimeTracking();
            currentWorkflowState = WORKFLOW_STATES.WORKING;
            saveWorkflowState();
            updateWorkflowButtonStates();
            showToast(`Resumed: ${activeTask.name}`, 'success');
        } else {
            // Select different task but stay in same workflow transition
            await showTaskSelectionModalForResume();
        }
    } else {
        // No active task, show selection
        await showTaskSelectionModalForResume();
    }
}

async function showTaskSelectionModalForResume() {
    // Ensure we have tasks loaded
    if (availableTasks.length === 0) {
        showToast('Loading your tasks...', 'info');
        await loadAssignedTasks();
    }
    
    if (availableTasks.length === 0) {
        showToast('No tasks available. Create a task first!', 'warning');
        return;
    }
    
    // Create modal if it doesn't exist
    if (!document.getElementById('taskSelectionModal')) {
        createTaskSelectionModal();
    }
    
    // Populate tasks
    populateTaskSelection();
    
    // Update modal for resume context
    document.querySelector('#taskSelectionModal .modal-header h2').textContent = '🔄 Resume Work - Select Task';
    document.getElementById('startSelectedTaskBtn').textContent = '🔵 Resume Working';
    document.getElementById('startSelectedTaskBtn').onclick = resumeWorkOnSelectedTask;
    
    // Show modal
    document.getElementById('taskSelectionModal').style.display = 'block';
}

async function resumeWorkOnSelectedTask() {
    if (!activeTask) {
        showToast('Please select a task first', 'warning');
        return;
    }
    
    // Close modal
    closeTaskSelectionModal();
    
    // Resume the actual time tracking
    await handleTimeClock('🔵 BACK TO WORK');
    
    // Initialize task time tracking
    resumeTaskTimeTracking();
    
    // Update workflow state
    currentWorkflowState = WORKFLOW_STATES.WORKING;
    saveWorkflowState();
    updateWorkflowButtonStates();
    
    showToast(`Resumed working on: ${activeTask.name}`, 'success');
}

async function handleEndWork() {
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    // Validate workflow state
    if (currentWorkflowState !== WORKFLOW_STATES.WORKING) {
        showToast('You can only end work while actively working', 'error');
        return;
    }
    
    // Confirm end of shift
    if (!confirm('Are you sure you want to end your shift for today?\n\nYou won\'t be able to start work again until tomorrow at 9 AM Brisbane time.')) {
        return;
    }
    
    // Finalize current task time
    if (activeTask && taskTimeData[activeTask.id]?.currentSession) {
        finalizeCurrentTaskSession();
    }
    
    // End work day
    await handleTimeClock('🔴 DONE FOR TODAY');
    
    // Update workflow state
    currentWorkflowState = WORKFLOW_STATES.FINISHED;
    saveWorkflowState();
    updateWorkflowButtonStates();
    
    // Show summary including task-specific time
    showDayEndSummary();
    
    // Clear active task
    activeTask = null;
    updateActiveTaskDisplay();
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const taskSelectionModal = document.getElementById('taskSelectionModal');
    const taskEditorModal = document.getElementById('taskEditorModal');
    
    if (event.target === taskSelectionModal) {
        closeTaskSelectionModal();
    }
    if (event.target === taskEditorModal && window.closeTaskEditorModal) {
        closeTaskEditorModal();
    }
});

// Debug function to force enable START button
window.debugStartButton = function() {
    console.log('🔧 DEBUGGING START BUTTON...');
    
    const startBtn = document.getElementById('startWorkBtn');
    console.log('🔄 Button element:', startBtn);
    console.log('🔄 Current employee:', currentEmployee);
    console.log('🔄 Current workflow state:', currentWorkflowState);
    
    if (startBtn) {
        // Force enable the button
        startBtn.disabled = false;
        startBtn.classList.remove('btn-disabled');
        startBtn.style.pointerEvents = 'auto';
        startBtn.style.opacity = '1';
        startBtn.style.filter = 'none';
        
        // Force set states
        currentEmployee = currentEmployee || 'Tony Herrera';
        currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
        
        console.log('✅ START button force-enabled!');
        console.log('✅ Employee set to:', currentEmployee);
        console.log('✅ Workflow state set to:', currentWorkflowState);
        
        // Update employee selector if needed
        if (!document.getElementById('employeeSelect').value) {
            document.getElementById('employeeSelect').value = 'Tony Herrera';
        }
        
        return 'START button should now work!';
    } else {
        console.error('❌ START button not found!');
        return 'START button element not found!';
    }
};

console.log('🚀 Enhanced VEBLEN Task Tracker loaded with workflow controls and Brisbane clock!');
console.log('🔧 If START button doesn\'t work, run: debugStartButton() in console');
