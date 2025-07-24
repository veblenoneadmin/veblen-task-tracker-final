// VEBLEN Task Tracker - Complete Enhanced script.js with Fixed Issues
// Configuration - UPDATED WITH LOCAL API ENDPOINTS
const CONFIG = {
    // Use local API endpoints that proxy to n8n webhooks
    taskIntakeUrl: '/api/task-intake',
    taskUpdateUrl: '/api/task-update',
    timeLoggerUrl: '/api/time-logger',
    reportLoggerUrl: '/api/report-logger',
    taskRetrievalUrl: '/api/get-tasks',
    imgbbApiKey: '679bd601ac49c50cae877fb240620cfe'
};

// WORKFLOW STATES
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

// State Management
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
    
    // Initialize override button (if needed for debugging)
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
    setupEventListeners();
    
    // Set default date to today for report
    const reportDateEl = document.getElementById('reportDate');
    if (reportDateEl) {
        reportDateEl.valueAsDate = new Date();
    }
    
    // Initialize workflow state
    console.log('🔄 Initializing workflow state...');
    currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
    initializeWorkflowState();
}

function setupEventListeners() {
    // Employee selection
    const employeeSelect = document.getElementById('employeeSelect');
    if (employeeSelect) {
        employeeSelect.addEventListener('change', handleEmployeeChange);
    }
    
    // Forms
    const taskIntakeForm = document.getElementById('taskIntakeForm');
    if (taskIntakeForm) {
        taskIntakeForm.addEventListener('submit', handleTaskIntake);
    }
    
    const dailyReportForm = document.getElementById('dailyReportForm');
    if (dailyReportForm) {
        dailyReportForm.addEventListener('submit', handleDailyReport);
    }
    
    // Buttons
    const refreshTasksBtn = document.getElementById('refreshTasksBtn');
    if (refreshTasksBtn) {
        refreshTasksBtn.addEventListener('click', loadAssignedTasks);
    }
    
    // Time clock buttons
    const startWorkBtn = document.getElementById('startWorkBtn');
    if (startWorkBtn) {
        startWorkBtn.addEventListener('click', handleStartWork);
    }
    
    const breakBtn = document.getElementById('breakBtn');
    if (breakBtn) {
        breakBtn.addEventListener('click', handleBreak);
    }
    
    const backToWorkBtn = document.getElementById('backToWorkBtn');
    if (backToWorkBtn) {
        backToWorkBtn.addEventListener('click', handleResumeWork);
    }
    
    const endWorkBtn = document.getElementById('endWorkBtn');
    if (endWorkBtn) {
        endWorkBtn.addEventListener('click', handleEndWork);
    }

    // Image upload previews
    const taskImage = document.getElementById('taskImage');
    if (taskImage) {
        taskImage.addEventListener('change', handleTaskImagePreview);
    }
    
    const reportPhoto = document.getElementById('reportPhoto');
    if (reportPhoto) {
        reportPhoto.addEventListener('change', handleReportPhotoPreview);
    }
    
    // Modal close handlers
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal') || e.target.classList.contains('close')) {
            closeTaskEditorModal();
        }
    });
    
    // ESC key to close modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeTaskEditorModal();
        }
    });
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
    try {
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
    } catch (error) {
        console.error('Error getting timezone:', error);
        return 'GMT+0';
    }
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
    
    // Calculate local time for the next reset
    const localOffset = localNow.getTimezoneOffset() * 60000;
    const brisbaneOffset = 10 * 60 * 60000; // Brisbane is UTC+10
    const localResetTime = new Date(next9AM.getTime() - brisbaneOffset + localOffset);
    
    const localResetTimeStr = localResetTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
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
            // Only start work button should be enabled
            disableButton(breakBtn);
            disableButton(backToWorkBtn);
            disableButton(endWorkBtn);
            enableButton(startBtn);
            updateTimeClockStatus('Ready to start your shift', new Date());
            break;
            
        case WORKFLOW_STATES.WORKING:
            // Break and end work buttons should be enabled
            disableButton(startBtn);
            disableButton(backToWorkBtn);
            enableButton(breakBtn);
            enableButton(endWorkBtn);
            break;
            
        case WORKFLOW_STATES.ON_BREAK:
            // Only back to work button should be enabled
            disableButton(startBtn);
            disableButton(breakBtn);
            disableButton(endWorkBtn);
            enableButton(backToWorkBtn);
            break;
            
        case WORKFLOW_STATES.FINISHED:
            // All buttons should be disabled
            disableButton(startBtn);
            disableButton(breakBtn);
            disableButton(backToWorkBtn);
            disableButton(endWorkBtn);
            updateTimeClockStatus('Shift completed. See you tomorrow!', new Date());
            break;
            
        default:
            console.log('🔄 Unknown workflow state, defaulting to NOT_STARTED');
            currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
            updateWorkflowButtonStates();
            return;
    }
    
    console.log('🔄 Button states updated for workflow:', currentWorkflowState);
}

function enableButton(button) {
    if (button) {
        button.disabled = false;
        button.classList.remove('btn-disabled');
        button.style.pointerEvents = 'auto';
        button.style.opacity = '1';
    }
}

function disableButton(button) {
    if (button) {
        button.disabled = true;
        button.classList.add('btn-disabled');
        button.style.pointerEvents = 'none';
        button.style.opacity = '0.4';
    }
}

// ============= TIME CLOCK HANDLERS =============

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

// ============= TIME CLOCK CORE FUNCTIONS =============

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

function initializeDailyShiftData() {
    dailyShiftData = {
        totalWorkedMs: 0,
        workSessions: [],
        shiftStartTime: null,
        targetShiftMs: 8 * 60 * 60 * 1000
    };
}

function startWorkClock() {
    if (workClockInterval) clearInterval(workClockInterval);
    if (breakClockInterval) clearInterval(breakClockInterval);
    
    const breakDisplay = document.getElementById('breakClockDisplay');
    const workDisplay = document.getElementById('workClockDisplay');
    
    if (breakDisplay) breakDisplay.style.display = 'none';
    if (workDisplay) workDisplay.style.display = 'block';
    
    updateWorkTimer();
    workClockInterval = setInterval(updateWorkTimer, 1000);
    
    if (currentWorkSession) {
        saveWorkClockState('working', currentWorkSession.startTime);
    }
}

function startBreakClock() {
    if (workClockInterval) clearInterval(workClockInterval);
    if (breakClockInterval) clearInterval(breakClockInterval);
    
    const workDisplay = document.getElementById('workClockDisplay');
    const breakDisplay = document.getElementById('breakClockDisplay');
    
    if (workDisplay) workDisplay.style.display = 'none';
    if (breakDisplay) breakDisplay.style.display = 'block';
    
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
            statusClass = 'status-ended';
            break;
        default:
            statusMessage = action;
            statusClass = 'status-ready';
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
    
    const workDisplay = document.getElementById('workClockDisplay');
    const breakDisplay = document.getElementById('breakClockDisplay');
    
    if (workDisplay) workDisplay.style.display = 'none';
    if (breakDisplay) breakDisplay.style.display = 'none';
    
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
    
    const workDisplay = document.getElementById('workClockDisplay');
    const breakDisplay = document.getElementById('breakClockDisplay');
    
    if (workDisplay) workDisplay.style.display = 'none';
    if (breakDisplay) breakDisplay.style.display = 'none';
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

function formatElapsedTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ============= EMPLOYEE MANAGEMENT =============

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
    const tasksList = document.getElementById('assignedTasksList');
    if (tasksList) {
        tasksList.innerHTML = '<p class="loading">Select an employee to view assigned tasks...</p>';
    }
    
    clearWorkClockState();
    availableTasks = [];
    currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
    updateWorkflowButtonStates();
}

// ============= TASK MANAGEMENT =============

async function loadAssignedTasks() {
    if (!currentEmployee) {
        const tasksList = document.getElementById('assignedTasksList');
        if (tasksList) {
            tasksList.innerHTML = '<p class="loading">Select an employee to view assigned tasks...</p>';
        }
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
    if (!container) return;
    
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

function createTaskHTML(task) {
    const progressClass = getProgressClass(task.progress || 0);
    const statusBadgeClass = getStatusBadgeClass(task.status || 'Project');
    
    // Enhanced priority and status icons
    const priorityIcon = task.isHighPriority ? '🔥' : '📋';
    const overdueIcon = task.isOverdue ? '⚠️' : '';
    const completeIcon = task.isComplete ? '✅' : '';
    const infinityIcon = '📥';
    
    // Enhanced assigned users display
    let assignedDisplay = 'Not assigned';
    let assignedDetails = '';
    
    if (task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
        assignedDisplay = task.assignedTo.slice(0, 2).join(', ');
        if (task.assignedTo.length > 2) {
            assignedDisplay += ` +${task.assignedTo.length - 2} more`;
        }
        
        if (task.assignedDetails && task.assignedDetails.length > 0) {
            assignedDetails = task.assignedDetails
                .slice(0, 2)
                .map(user => `${user.name} (${user.role})`)
                .join(', ');
        }
    }
    
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
                
                ${task.notes ? `
                <div class="task-notes">
                    <strong>Notes:</strong>
                    <p>${task.notes.length > 100 ? task.notes.substring(0, 97) + '...' : task.notes}</p>
                </div>
                ` : ''}
                
                <div class="task-ids">
                    <small>Master: ${task.masterBoardId}</small>
                    <small>Company: ${task.companyBoardId}</small>
                    <small>Retrieved: ${task.retrievedAt ? new Date(task.retrievedAt).toLocaleTimeString() : 'N/A'}</small>
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

// ============= INFINITY INTEGRATION =============

function openTaskEditorModal() {
    if (!document.getElementById('taskEditorModal')) {
        createTaskEditorModal();
    }
    
    // Reset form
    const masterBoardId = document.getElementById('masterBoardId');
    const companyBoardId = document.getElementById('companyBoardId');
    const content = document.getElementById('taskEditorContent');
    
    if (masterBoardId) masterBoardId.value = '';
    if (companyBoardId) companyBoardId.value = '';
    if (content) {
        content.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Enter both IDs above and click "Import Task" to add it to your dashboard</p>';
    }
    
    // Show modal
    const modal = document.getElementById('taskEditorModal');
    if (modal) {
        modal.style.display = 'block';
    }
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
            
            if (data.success && data.task) {
                await saveTaskToMyDashboard(data.task, masterBoardId, companyBoardId);
                displayTaskForEditing(data.task, masterBoardId, companyBoardId);
                showToast('✅ Task imported successfully to your dashboard!', 'success');
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
        showManualTaskEntry(masterBoardId, companyBoardId);
    }
}

function displayTaskForEditing(task, masterBoardId, companyBoardId) {
    const content = document.getElementById('taskEditorContent');
    if (!content) return;
    
    const assignedToDisplay = task.assignedTo && task.assignedTo.length > 0 
        ? task.assignedTo.join(', ') 
        : 'Not assigned';
    
    const assignedDetailsDisplay = task.assignedDetails && task.assignedDetails.length > 0
        ? task.assignedDetails.map(user => `${user.name} (${user.role} - ${user.department})`).join(', ')
        : 'No detailed assignments';
    
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
    
    // Store current task data for saving
    window.currentEditingTask = {
        ...task,
        masterBoardId: masterBoardId,
        companyBoardId: companyBoardId
    };
    
    // Show footer buttons
    const footer = document.getElementById('taskEditorFooter');
    if (footer) {
        footer.style.display = 'flex';
    }
}

async function saveTaskToMyDashboard(task, masterBoardId, companyBoardId) {
    if (!currentEmployee) return;
    
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
    
    const taskForDashboard = {
        id: `${masterBoardId}_${companyBoardId}`,
        masterBoardId: masterBoardId,
        companyBoardId: companyBoardId,
        name: task.name || 'Imported Task',
        company: task.company || 'Unknown Company',
        company_display_name: task.company_display_name || task.company || 'Unknown Company',
        description: task.description || '',
        notes: task.notes || '',
        status: task.status || 'Project',
        status_priority: task.status_priority || 1,
        status_color: task.status_color || '#718096',
        progress: task.progress || 0,
        dueDate: task.dueDate || 'Not set',
        dueDateRaw: task.dueDateRaw || null,
        createdDate: task.createdDate || new Date().toLocaleDateString(),
        updatedDate: task.updatedDate || new Date().toLocaleDateString(),
        createdDateRaw: task.createdDateRaw || null,
