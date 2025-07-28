// ============= COMPLETE VEBLEN TASK TRACKER SCRIPT.JS =============
// Version: 2.1 - Final Clean Version with All Fixes
// Part 1 of 2

// ============= GLOBAL CONFIGURATION =============
const CONFIG = {
    n8nWebhookUrl: '/api/task-action',
    taskUpdateUrl: '/api/task-update', 
    timeLoggerUrl: '/api/task-action',
    imgbbApiKey: '679bd601ac49c50cae877fb240620cfe'
};

const PROGRESS_ATTRIBUTES = {
    "CROWN REALITY": "eb943dd8-dd91-4620-a875-59bdeee59a1f",
    "LCMB GROUP": "4cff12df-fc0d-40aa-aade-e52161b37621", 
    "NEWTECH TRAILERS": "f78f7f1b-ec1f-4f1b-972b-6931f6925373",
    "VEBLEN (Internal)": "05ba9bd9-6829-4049-8366-a1ec8d9281d4",
    "FLECK GROUP": "2f9594ea-c62d-4a15-b668-0cdf2f9162cd"
};

// ============= GLOBAL STATE VARIABLES =============
let currentEmployee = null;
let activeTask = null;
let timerInterval = null;
let elapsedSeconds = 0;
let workSessions = [];
let activeTaskProgress = 0;
let availableTasks = [];
let dailyShiftData = null;
let shiftStartTime = null;
window.loadedTasks = [];

// Workflow state management
const WORKFLOW_STATES = {
    NOT_STARTED: 'not_started',
    WORKING: 'working', 
    ON_BREAK: 'on_break',
    FINISHED: 'finished'
};

let currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;

// Testing bypass configuration
const BYPASS_PASSWORD = 'veblen2024';

// ============= INITIALIZATION =============
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 VEBLEN Task Tracker initializing...');
    
    // Initialize employee selector
    const employeeSelect = document.getElementById('employeeSelect');
    if (employeeSelect) {
        employeeSelect.addEventListener('change', handleEmployeeChange);
        
        // Load saved employee
        const savedEmployee = localStorage.getItem('selectedEmployee');
        if (savedEmployee) {
            employeeSelect.value = savedEmployee;
            currentEmployee = savedEmployee;
            loadEmployeeData();
        }
    }
    
    // Initialize forms
    const taskForm = document.getElementById('taskForm');
    if (taskForm) {
        taskForm.addEventListener('submit', handleTaskSubmit);
    }
    
    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
        reportForm.addEventListener('submit', handleDailyReport);
    }
    
    // Initialize image previews
    const taskImageInput = document.getElementById('taskImage');
    if (taskImageInput) {
        taskImageInput.addEventListener('change', handleTaskImagePreview);
    }
    
    const reportPhotoInput = document.getElementById('reportPhoto');
    if (reportPhotoInput) {
        reportPhotoInput.addEventListener('change', handleReportPhotoPreview);
    }
    
    // Initialize workflow
    initializeWorkflowState();
    startShiftTimeUpdater();
    
    console.log('✅ VEBLEN Task Tracker initialized successfully!');
});

// ============= WORKFLOW MANAGEMENT =============
function initializeWorkflowState() {
    const saved = localStorage.getItem('workflowState');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            currentWorkflowState = data.state || WORKFLOW_STATES.NOT_STARTED;
            shiftStartTime = data.shiftStartTime ? new Date(data.shiftStartTime) : null;
            dailyShiftData = data.dailyShiftData || null;
        } catch (e) {
            console.warn('Could not load workflow state:', e);
            currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
        }
    }
    updateWorkflowButtonStates();
}

function saveWorkflowState() {
    const data = {
        state: currentWorkflowState,
        shiftStartTime: shiftStartTime?.toISOString(),
        dailyShiftData: dailyShiftData,
        lastUpdated: new Date().toISOString()
    };
    localStorage.setItem('workflowState', JSON.stringify(data));
}

// ENHANCED BUTTON STATE MANAGEMENT - Single Definition
function updateWorkflowButtonStates() {
    const startBtn = document.getElementById('startWorkBtn');
    const breakBtn = document.getElementById('breakBtn');
    const backToWorkBtn = document.getElementById('resumeWorkBtn');
    const endWorkBtn = document.getElementById('finishWorkBtn');
    
    // Reset all buttons to disabled state
    [startBtn, breakBtn, backToWorkBtn, endWorkBtn].forEach(btn => {
        if (btn) {
            btn.disabled = true;
            btn.classList.add('btn-disabled');
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.4';
        }
    });
    
    // Enable appropriate buttons based on state
    switch (currentWorkflowState) {
        case WORKFLOW_STATES.NOT_STARTED:
            if (startBtn && currentEmployee) {
                startBtn.disabled = false;
                startBtn.classList.remove('btn-disabled');
                startBtn.style.pointerEvents = 'auto';
                startBtn.style.opacity = '1';
            }
            updateTimeClockStatus('Ready to start your shift');
            break;
            
        case WORKFLOW_STATES.WORKING:
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
            if (backToWorkBtn) {
                backToWorkBtn.disabled = false;
                backToWorkBtn.classList.remove('btn-disabled');
                backToWorkBtn.style.pointerEvents = 'auto';
                backToWorkBtn.style.opacity = '1';
            }
            if (endWorkBtn) {
                endWorkBtn.disabled = false;
                endWorkBtn.classList.remove('btn-disabled');
                endWorkBtn.style.pointerEvents = 'auto';
                endWorkBtn.style.opacity = '1';
            }
            break;
            
        case WORKFLOW_STATES.FINISHED:
            updateTimeClockStatus('Shift completed. See you tomorrow!');
            break;
    }
}

async function startWorkDay() {
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    await handleTimeClock('🟢 START WORK');
    currentWorkflowState = WORKFLOW_STATES.WORKING;
    shiftStartTime = new Date();
    
    if (!dailyShiftData) {
        dailyShiftData = {
            totalWorkedMs: 0,
            workSessions: [],
            breaks: []
        };
    }
    
    saveWorkflowState();
    updateWorkflowButtonStates();
    showToast('Work day started! 🚀', 'success');
}

async function takeBreak() {
    if (currentWorkflowState !== WORKFLOW_STATES.WORKING) {
        return;
    }
    
    await handleTimeClock('☕ TAKE BREAK');
    currentWorkflowState = WORKFLOW_STATES.ON_BREAK;
    saveWorkflowState();
    updateWorkflowButtonStates();
    showToast('Break time! Take a rest 😌', 'info');
}

async function resumeWork() {
    if (currentWorkflowState !== WORKFLOW_STATES.ON_BREAK) {
        return;
    }
    
    await handleTimeClock('🔵 BACK TO WORK');
    currentWorkflowState = WORKFLOW_STATES.WORKING;
    saveWorkflowState();
    updateWorkflowButtonStates();
    showToast('Back to work! Let\'s go! 💪', 'success');
}

async function finishWorkDay() {
    if (currentWorkflowState === WORKFLOW_STATES.FINISHED) {
        return;
    }
    
    await handleTimeClock('🔴 DONE FOR TODAY');
    currentWorkflowState = WORKFLOW_STATES.FINISHED;
    saveWorkflowState();
    updateWorkflowButtonStates();
    showShiftSummary();
    showToast('Shift completed! Great work today! 🎯', 'success');
}

// ============= COMPLETE MODAL SYSTEM =============

// 1. COMPLETE TASK EDITOR MODAL CREATION
function createTaskEditorModal() {
    // Remove existing modal if it exists
    const existingModal = document.getElementById('taskEditorModal');
    if (existingModal) {
        existingModal.remove();
    }
    
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
                        <label for="masterBoardId">Master Board Item ID:</label>
                        <input type="text" 
                               id="masterBoardId" 
                               placeholder="Paste Master Board Item ID here" 
                               class="form-control">
                        <small class="help-text">📋 Copy this from Discord: Right-click task → Copy ID</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="companyBoardId">Company Board Item ID:</label>
                        <input type="text" 
                               id="companyBoardId" 
                               placeholder="Paste Company Board Item ID here" 
                               class="form-control">
                        <small class="help-text">🏢 Copy this from Discord: Right-click task → Copy ID</small>
                    </div>
                    
                    <div class="form-group">
                        <button type="button" 
                                onclick="importTaskFromIds()" 
                                class="btn btn-primary btn-full-width">
                            📥 Import Task to Dashboard
                        </button>
                    </div>
                </div>
                
                <!-- Task Editor Content -->
                <div id="taskEditorContent">
                    <p style="color: var(--text-secondary); text-align: center; padding: 2rem;">
                        Enter both IDs above and click "Import Task" to add it to your dashboard
                    </p>
                </div>
                
                <!-- Task Edit Form (Hidden initially) -->
                <div id="taskEditForm" class="task-edit-form">
                    <div class="edit-grid">
                        <div class="form-group">
                            <label for="editTaskName">Task Name:</label>
                            <input type="text" id="editTaskName" class="form-control">
                        </div>
                        
                        <div class="form-group">
                            <label for="editTaskStatus">Status:</label>
                            <select id="editTaskStatus" class="form-control">
                                <option value="Project">Project</option>
                                <option value="Priority Project">Priority Project</option>
                                <option value="Current Project">Current Project</option>
                                <option value="Revision">Revision</option>
                                <option value="Waiting Approval">Waiting Approval</option>
                                <option value="Project Finished">Project Finished</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                        </div>
                        
                        <div class="form-group full-width">
                            <label for="editTaskDescription">Description:</label>
                            <textarea id="editTaskDescription" class="form-control" rows="3"></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="editTaskPriority">Priority:</label>
                            <select id="editTaskPriority" class="form-control">
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Urgent">Urgent</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="editTaskDueDate">Due Date:</label>
                            <input type="date" id="editTaskDueDate" class="form-control">
                        </div>
                    </div>
                    
                    <!-- Progress Editor -->
                    <div class="progress-editor">
                        <label>Progress:</label>
                        <div class="progress-preview">
                            <span id="modalProgressValue">0%</span>
                            <div class="status-indicator" id="modalStatusIndicator">Project</div>
                        </div>
                        <input type="range" 
                               id="editModalProgress" 
                               min="0" 
                               max="100" 
                               value="0" 
                               onchange="updateModalProgress()">
                        <div class="progress-hints">
                            <span class="hint">0% - Just Started</span>
                            <span class="hint">50% - In Progress</span>
                            <span class="hint">100% - Complete</span>
                        </div>
                    </div>
                    
                    <!-- Modal Footer -->
                    <div class="modal-footer">
                        <button type="button" onclick="closeTaskEditorModal()" class="btn btn-secondary">
                            Cancel
                        </button>
                        <button type="button" onclick="quickCompleteTask()" class="btn btn-success">
                            ✅ Quick Complete (100%)
                        </button>
                        <button type="button" onclick="saveTaskEdits()" class="btn btn-primary">
                            💾 Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listeners
    setupModalEventListeners();
}

// 2. COMPLETE CLOSE MODAL FUNCTION
function closeTaskEditorModal() {
    const modal = document.getElementById('taskEditorModal');
    if (modal) {
        // Add fade out animation
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            modal.style.display = 'none';
            modal.style.opacity = '1';
            modal.style.transform = 'scale(1)';
        }, 300);
    }
    
    // Clean up global state
    window.currentEditingTask = null;
    
    // Reset form if it exists
    const taskEditForm = document.getElementById('taskEditForm');
    if (taskEditForm) {
        taskEditForm.classList.remove('active');
    }
}

// 3. MODAL EVENT LISTENERS SETUP
function setupModalEventListeners() {
    // Close modal when clicking outside
    const modal = document.getElementById('taskEditorModal');
    if (modal) {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeTaskEditorModal();
            }
        });
    }
    
    // ESC key to close modal
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const modal = document.getElementById('taskEditorModal');
            if (modal && modal.style.display === 'block') {
                closeTaskEditorModal();
            }
            
            const passwordModal = document.getElementById('passwordModal');
            if (passwordModal && passwordModal.style.display === 'block') {
                closePasswordModal();
            }
        }
    });
}

// 4. COMPLETE OPEN MODAL FUNCTION
function openTaskEditorModal() {
    // Create modal if it doesn't exist
    if (!document.getElementById('taskEditorModal')) {
        createTaskEditorModal();
    }
    
    // Reset form state
    const masterInput = document.getElementById('masterBoardId');
    const companyInput = document.getElementById('companyBoardId');
    const contentDiv = document.getElementById('taskEditorContent');
    const taskEditForm = document.getElementById('taskEditForm');
    
    if (masterInput) masterInput.value = '';
    if (companyInput) companyInput.value = '';
    if (contentDiv) {
        contentDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Enter both IDs above and click "Import Task" to add it to your dashboard</p>';
    }
    if (taskEditForm) {
        taskEditForm.classList.remove('active');
    }
    
    // Show modal with animation
    const modal = document.getElementById('taskEditorModal');
    if (modal) {
        modal.style.display = 'block';
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.95)';
        
        // Trigger animation
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.style.transform = 'scale(1)';
        }, 10);
    }
}

// 5. IMPORT TASK FUNCTION
async function importTaskFromIds() {
    const masterBoardId = document.getElementById('masterBoardId')?.value?.trim();
    const companyBoardId = document.getElementById('companyBoardId')?.value?.trim();
    
    if (!masterBoardId || !companyBoardId) {
        showToast('❌ Please enter both Master Board and Company Board IDs', 'error');
        return;
    }
    
    if (!currentEmployee) {
        showToast('❌ Please select an employee first', 'error');
        return;
    }
    
    try {
        showToast('🔄 Importing task...', 'info');
        
        // Call your existing function to get task data
        const response = await fetch(`/api/task/${companyBoardId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch task: ${response.status}`);
        }
        
        const taskData = await response.json();
        
        // Save to local dashboard
        const tasksKey = `myTasks_${currentEmployee}`;
        let myTasks = [];
        
        try {
            const saved = localStorage.getItem(tasksKey);
            if (saved) {
                myTasks = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Could not load existing tasks, starting fresh');
        }
        
        const taskId = `${masterBoardId}_${companyBoardId}`;
        
        // Check if task already exists
        const existingIndex = myTasks.findIndex(t => t.id === taskId);
        
        // Use enhanced task object creation
        const taskObject = createEnhancedTaskObject(taskData, masterBoardId, companyBoardId);
        
        if (existingIndex >= 0) {
            myTasks[existingIndex] = taskObject;
            showToast('✅ Task updated in your dashboard', 'success');
        } else {
            myTasks.push(taskObject);
            showToast('✅ Task imported to your dashboard', 'success');
        }
        
        localStorage.setItem(tasksKey, JSON.stringify(myTasks));
        availableTasks = myTasks;
        
        // Display for editing
        displayTaskForEditing(taskObject, masterBoardId, companyBoardId);
        
        // Refresh the main task list
        await loadAssignedTasks();
        
    } catch (error) {
        console.error('Import error:', error);
        showToast(`❌ Import failed: ${error.message}`, 'error');
    }
}
// ============= COMPLETE VEBLEN TASK TRACKER SCRIPT.JS =============
// Part 2 of 2 - Final Clean Version with All Fixes

// 6. DISPLAY TASK FOR EDITING
function displayTaskForEditing(task, masterBoardId, companyBoardId) {
    const contentDiv = document.getElementById('taskEditorContent');
    const taskEditForm = document.getElementById('taskEditForm');
    
    if (!contentDiv || !taskEditForm) return;
    
    // Hide import section and show edit form
    contentDiv.style.display = 'none';
    taskEditForm.classList.add('active');
    
    // Populate form fields
    document.getElementById('editTaskName').value = task.name || '';
    document.getElementById('editTaskDescription').value = task.description || '';
    document.getElementById('editTaskStatus').value = task.status || 'Project';
    document.getElementById('editTaskPriority').value = task.priority || 'Medium';
    document.getElementById('editTaskDueDate').value = task.dueDate || '';
    document.getElementById('editModalProgress').value = task.progress || 0;
    
    // Update progress display
    updateModalProgress();
    
    // Store current editing task
    window.currentEditingTask = {
        ...task,
        masterBoardId,
        companyBoardId
    };
}

// 7. PROGRESS UPDATE FUNCTION
function updateModalProgress() {
    const progressSlider = document.getElementById('editModalProgress');
    const progressValue = document.getElementById('modalProgressValue');
    const statusIndicator = document.getElementById('modalStatusIndicator');
    
    if (!progressSlider || !progressValue || !statusIndicator) return;
    
    const progress = parseInt(progressSlider.value);
    progressValue.textContent = `${progress}%`;
    
    // Update status indicator based on progress
    let status = 'Project';
    let statusClass = 'status-project';
    
    if (progress >= 100) {
        status = 'Project Finished';
        statusClass = 'status-finished';
    } else if (progress >= 80) {
        status = 'Current Project';
        statusClass = 'status-current';
    } else if (progress >= 50) {
        status = 'Current Project';
        statusClass = 'status-current';
    }
    
    statusIndicator.textContent = status;
    statusIndicator.className = `status-indicator ${statusClass}`;
}

// 8. SAVE TASK EDITS
async function saveTaskEdits() {
    if (!window.currentEditingTask) {
        showToast('❌ No task selected for editing', 'error');
        return;
    }
    
    const task = window.currentEditingTask;
    
    try {
        const updates = {
            name: document.getElementById('editTaskName').value,
            description: document.getElementById('editTaskDescription').value,
            status: document.getElementById('editTaskStatus').value,
            priority: document.getElementById('editTaskPriority').value,
            dueDate: document.getElementById('editTaskDueDate').value,
            progress: parseInt(document.getElementById('editModalProgress').value)
        };
        
        // Update via API
        const response = await fetch('/api/task-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update_details',
                task_id: task.companyBoardId,
                master_task_id: task.masterBoardId,
                company: task.company,
                ...updates
            })
        });
        
        if (response.ok) {
            // Update local storage
            await updateTaskInMyDashboard(task.masterBoardId, task.companyBoardId, updates);
            
            showToast('✅ Task updated successfully', 'success');
            
            // Refresh task list
            await loadAssignedTasks();
            
            // Close modal
            closeTaskEditorModal();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.error('Save error:', error);
        showToast(`❌ Save failed: ${error.message}`, 'error');
    }
}

// 9. QUICK COMPLETE FUNCTION
async function quickCompleteTask() {
    if (!window.currentEditingTask) {
        showToast('❌ No task selected', 'error');
        return;
    }
    
    if (!confirm('Mark this task as 100% complete?')) {
        return;
    }
    
    // Set progress to 100% and status to finished
    document.getElementById('editModalProgress').value = 100;
    document.getElementById('editTaskStatus').value = 'Project Finished';
    updateModalProgress();
    
    // Save changes
    await saveTaskEdits();
}

// 10. UPDATE TASK IN DASHBOARD FUNCTION
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

// ============= CRITICAL MISSING FUNCTIONS =============

// SYNC TASK TO INFINITY (Critical for task updates)
async function syncTaskToInfinity(taskId) {
    const task = availableTasks.find(t => t.id === taskId);
    if (!task) {
        showToast('Task not found', 'error');
        return;
    }
    
    try {
        // Show syncing state
        const syncBtn = document.querySelector(`[onclick="syncTaskToInfinity('${taskId}')"]`);
        if (syncBtn) {
            const originalText = syncBtn.innerHTML;
            syncBtn.innerHTML = '🔄 Syncing...';
            syncBtn.disabled = true;
        }
        
        console.log('🔄 Syncing task to StartInfinity:', task.name);
        
        const response = await fetch('/api/task-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'sync_task',
                task_id: task.companyBoardId,
                master_task_id: task.masterBoardId,
                company: task.company,
                name: task.name,
                description: task.description,
                status: task.status,
                priority: task.priority,
                progress: task.progress,
                dueDate: task.dueDate
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                // Update sync status
                await updateTaskInMyDashboard(task.masterBoardId, task.companyBoardId, {
                    syncStatus: 'synced',
                    lastSyncedAt: new Date().toISOString()
                });
                
                showToast('✅ Task synced with Infinity successfully', 'success');
                await loadAssignedTasks();
            } else {
                throw new Error(result.message || 'Sync failed');
            }
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.error('❌ Error syncing task:', error);
        showToast(`❌ Sync failed: ${error.message}`, 'error');
        
        // Update sync status to error
        await updateTaskInMyDashboard(task.masterBoardId, task.companyBoardId, {
            syncStatus: 'error'
        });
        await loadAssignedTasks();
    }
}

// REMOVE TASK FROM DASHBOARD
async function removeTaskFromDashboard(taskId) {
    if (!confirm('Remove this task from your dashboard?\n\nThis will not affect the task in Infinity.')) {
        return;
    }
    
    try {
        const tasksKey = `myTasks_${currentEmployee}`;
        let myTasks = JSON.parse(localStorage.getItem(tasksKey) || '[]');
        
        // Remove task
        myTasks = myTasks.filter(t => t.id !== taskId);
        
        localStorage.setItem(tasksKey, JSON.stringify(myTasks));
        availableTasks = myTasks;
        
        await loadAssignedTasks();
        showToast('🗑️ Task removed from dashboard', 'success');
        
    } catch (error) {
        console.error('Error removing task:', error);
        showToast('Error removing task', 'error');
    }
}

// HELPER FUNCTION
function getValue(elementId) {
    const element = document.getElementById(elementId);
    return element ? element.value.trim() : '';
}

// ENHANCED TASK CREATION WITH METADATA
function createEnhancedTaskObject(taskData, masterBoardId, companyBoardId) {
    return {
        id: `${masterBoardId}_${companyBoardId}`,
        masterBoardId: masterBoardId,
        companyBoardId: companyBoardId,
        name: taskData.name || 'Imported Task',
        description: taskData.description || '',
        status: taskData.status || 'Project',
        priority: taskData.priority || 'Medium',
        progress: taskData.progress || 0,
        assignedTo: currentEmployee,
        company: taskData.company || 'Unknown',
        dueDate: taskData.dueDate || '',
        
        // Enhanced metadata
        importedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'synced',
        
        // UI flags
        isHighPriority: (taskData.priority === 'High' || taskData.priority === 'Urgent'),
        isCurrentProject: (taskData.status === 'Current Project'),
        isComplete: (taskData.progress >= 100),
        isEditable: true,
        
        // Links and additional data
        links: taskData.links || '',
        
        // Debug info
        debug: {
            importSource: 'manual_import',
            extractedFromInfinity: true,
            originalTaskData: taskData
        }
    };
}

// EVENT LISTENERS FUNCTION
function attachTaskEventListeners(taskId) {
    console.log(`Attaching event listeners for task: ${taskId}`);
    // Implementation for inline editing if needed
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

// ============= TASK MANAGEMENT =============

async function loadAssignedTasks() {
    if (!currentEmployee) return;
    
    const tasksContainer = document.getElementById('assignedTasksList');
    if (!tasksContainer) return;
    
    try {
        tasksContainer.innerHTML = '<p class="loading">Loading your assigned tasks...</p>';
        
        // Load from localStorage first
        const tasksKey = `myTasks_${currentEmployee}`;
        let myTasks = [];
        
        try {
            const saved = localStorage.getItem(tasksKey);
            if (saved) {
                myTasks = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Could not load saved tasks:', e);
        }
        
        availableTasks = myTasks;
        
        if (myTasks.length === 0) {
            tasksContainer.innerHTML = `
                <div class="no-tasks">
                    <p>No tasks found in your dashboard.</p>
                    <button onclick="openTaskEditorModal()" class="btn btn-primary">
                        📥 Import Task from Infinity
                    </button>
                </div>
            `;
            return;
        }
        
        // Display tasks using enhanced task cards
        const tasksHTML = myTasks.map(task => createTaskCard(task)).join('');
        tasksContainer.innerHTML = tasksHTML;
        
        console.log(`✅ Loaded ${myTasks.length} tasks for ${currentEmployee}`);
        
    } catch (error) {
        console.error('Error loading tasks:', error);
        tasksContainer.innerHTML = '<p class="error">Error loading tasks. Please try refreshing.</p>';
    }
}

// ENHANCED TASK CARD CREATION - Single Definition with Sync Buttons
function createTaskCard(task) {
    const progressColor = getProgressColor(task.progress || 0);
    const statusBadge = getStatusBadge(task.status || 'Project');
    const priorityBadge = getPriorityBadge(task.priority || 'Medium');
    
    return `
        <div class="task-card" data-task-id="${task.id}">
            <div class="task-header">
                <h3 class="task-title">${task.name || 'Untitled Task'}</h3>
                <div class="task-badges">
                    ${statusBadge}
                    ${priorityBadge}
                </div>
            </div>
            
            ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
            
            <!-- Progress Section -->
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
}

function getProgressColor(progress) {
    if (progress >= 100) return '#48bb78';
    if (progress >= 75) return '#38a169';
    if (progress >= 50) return '#3182ce';
    if (progress >= 25) return '#d69e2e';
    return '#e53e3e';
}

function getStatusBadge(status) {
    const statusClass = getStatusClass(status);
    return `<span class="status-badge ${statusClass}">${status}</span>`;
}

function getPriorityBadge(priority) {
    const priorityClass = `priority-${priority.toLowerCase()}`;
    return `<span class="priority-badge ${priorityClass}">${priority}</span>`;
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

async function startWorkingOnTask(taskId) {
    const task = availableTasks.find(t => t.id === taskId);
    if (!task) {
        showToast('Task not found', 'error');
        return;
    }
    
    // If not already working, start the work day
    if (currentWorkflowState === WORKFLOW_STATES.NOT_STARTED) {
        await startWorkDay();
    }
    
    activeTask = task;
    showToast(`🎯 Started working on: ${task.name}`, 'success');
    
    // Update active task display
    updateActiveTaskDisplay();
}

function updateActiveTaskDisplay() {
    const activeTaskDiv = document.getElementById('activeTaskDisplay');
    if (!activeTaskDiv) return;
    
    if (activeTask) {
        activeTaskDiv.innerHTML = `
            <div class="active-task-info">
                <h4>🎯 Currently Working On:</h4>
                <h3>${activeTask.name}</h3>
                <p>${activeTask.description || 'No description'}</p>
                <div class="active-task-progress">
                    <span>Progress: ${activeTask.progress || 0}%</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${activeTask.progress || 0}%; background-color: ${getProgressColor(activeTask.progress || 0)};"></div>
                    </div>
                </div>
                <button onclick="pauseCurrentTask()" class="btn btn-warning">
                    ⏸️ Pause Task
                </button>
            </div>
        `;
    } else {
        activeTaskDiv.innerHTML = '<p>No active task. Select a task to start working.</p>';
    }
}

function pauseCurrentTask() {
    if (activeTask) {
        showToast(`⏸️ Paused work on: ${activeTask.name}`, 'info');
        activeTask = null;
        updateActiveTaskDisplay();
    }
}

// ============= TASK SUBMISSION =============

async function handleTaskSubmit(e) {
    e.preventDefault();
    
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    const form = e.target;
    const formData = new FormData(form);
    
    try {
        showToast('🔄 Starting new task...', 'info');
        
        let imageUrl = null;
        const imageFile = formData.get('taskImage');
        
        if (imageFile && imageFile.size > 0) {
            imageUrl = await uploadImageToImgBB(imageFile);
        }
        
        const taskData = {
            action: 'start_task',
            'WHO ARE YOU?': currentEmployee,
            'WHAT ARE YOU DOING?': formData.get('taskType'),
            'NOTES': formData.get('taskNotes') || '',
            'IMAGE_URL': imageUrl,
            'COMPANY': formData.get('company') || 'VEBLEN (Internal)'
        };
        
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        
        if (response.ok) {
            showToast('✅ Task started successfully!', 'success');
            form.reset();
            clearTaskImagePreview();
            
            // Refresh task list
            await loadAssignedTasks();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.error('Task submission error:', error);
        showToast(`❌ Failed to start task: ${error.message}`, 'error');
    }
}

// ============= DAILY REPORT HANDLER =============

async function handleDailyReport(e) {
    e.preventDefault();
    
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    const form = e.target;
    const formData = new FormData(form);
    
    try {
        showToast('🔄 Submitting daily report...', 'info');
        
        // Upload photo to ImgBB
        const photoFile = formData.get('reportPhoto');
        if (!photoFile || photoFile.size === 0) {
            showToast('❌ Report photo is required', 'error');
            return;
        }
        
        const photoUrl = await uploadImageToImgBB(photoFile);
        
        const reportData = {
            action: 'daily_report',
            'Name': currentEmployee,
            'Company': formData.get('company') || 'VEBLEN (Internal)',
            'Date': new Date().toISOString().split('T')[0],
            'Project Name': formData.get('projectName'),
            'Revisions': formData.get('numRevisions'),
            'Time Spent': formData.get('totalTimeSpent'),
            'Notes': formData.get('reportNotes'),
            'Links': formData.get('reportLinks') || '',
            'Photo URL': photoUrl,
            'Feedback': formData.get('feedbackRequests') || ''
        };
        
        const response = await fetch(CONFIG.n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportData)
        });
        
        if (response.ok) {
            showToast('✅ Daily report submitted successfully!', 'success');
            form.reset();
            clearReportPhotoPreview();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.error('Report submission error:', error);
        showToast(`❌ Failed to submit report: ${error.message}`, 'error');
    }
}

// ============= IMAGE HANDLING =============

async function uploadImageToImgBB(imageFile) {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.imgbbApiKey}`, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error('Image upload failed');
    }
    
    const data = await response.json();
    
    if (!data.success) {
        throw new Error('Image upload failed');
    }
    
    return data.data.url;
}

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
                    <span style="color: var(--text-primary); font-weight: 600;">📸 Image Preview:</span>
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
        showToast('✅ Task image loaded successfully', 'success');
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

function clearTaskImagePreview() {
    const previewContainer = document.getElementById('taskImagePreview');
    const imageInput = document.getElementById('taskImage');
    
    if (previewContainer) previewContainer.innerHTML = '';
    if (imageInput) imageInput.value = '';
    
    showToast('📸 Task image removed', 'info');
}

function clearReportPhotoPreview() {
    const previewContainer = document.getElementById('reportPhotoPreview');
    const photoInput = document.getElementById('reportPhoto');
    
    if (previewContainer) previewContainer.innerHTML = '';
    if (photoInput) photoInput.value = '';
    
    showToast('📷 Report photo removed', 'info');
}

// ============= TIME CLOCK FUNCTIONS =============

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
        console.error('Time clock error:', error);
        showToast(`❌ Failed to log ${action}: ${error.message}`, 'error');
    }
}

function handleClockAction(action, timestamp) {
    if (!dailyShiftData) {
        dailyShiftData = {
            totalWorkedMs: 0,
            workSessions: [],
            breaks: []
        };
    }
    
    const currentSession = {
        action: action,
        timestamp: timestamp.toISOString(),
        timeString: timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        })
    };
    
    if (action.includes('START') || action.includes('RESUME')) {
        dailyShiftData.workSessions.push({
            ...currentSession,
            type: 'start'
        });
    } else if (action.includes('BREAK') || action.includes('DONE')) {
        dailyShiftData.workSessions.push({
            ...currentSession,
            type: 'end'
        });
        
        if (action.includes('BREAK')) {
            dailyShiftData.breaks.push(currentSession);
        }
    }
    
    // Calculate total worked time
    calculateTotalWorkedTime();
    updateShiftProgress();
    saveWorkClockState();
}

function calculateTotalWorkedTime() {
    if (!dailyShiftData || !dailyShiftData.workSessions.length) return;
    
    let totalMs = 0;
    let sessionStart = null;
    
    for (const session of dailyShiftData.workSessions) {
        if (session.type === 'start') {
            sessionStart = new Date(session.timestamp);
        } else if (session.type === 'end' && sessionStart) {
            const sessionEnd = new Date(session.timestamp);
            totalMs += sessionEnd.getTime() - sessionStart.getTime();
            sessionStart = null;
        }
    }
    
    // Add ongoing session if working
    if (sessionStart && currentWorkflowState === WORKFLOW_STATES.WORKING) {
        totalMs += new Date().getTime() - sessionStart.getTime();
    }
    
    dailyShiftData.totalWorkedMs = totalMs;
}

function loadWorkClockState() {
    if (!currentEmployee) return;
    
    const stateKey = `workClock_${currentEmployee}`;
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const saved = localStorage.getItem(stateKey);
        if (saved) {
            const data = JSON.parse(saved);
            if (data.date === today) {
                dailyShiftData = data.shiftData;
                shiftStartTime = data.shiftStartTime ? new Date(data.shiftStartTime) : null;
                updateShiftProgress();
                return;
            }
        }
    } catch (e) {
        console.warn('Could not load work clock state:', e);
    }
    
    // Initialize fresh for today
    dailyShiftData = {
        totalWorkedMs: 0,
        workSessions: [],
        breaks: []
    };
    updateShiftProgress();
}

function saveWorkClockState() {
    if (!currentEmployee) return;
    
    const stateKey = `workClock_${currentEmployee}`;
    const today = new Date().toISOString().split('T')[0];
    
    const data = {
        date: today,
        shiftData: dailyShiftData,
        shiftStartTime: shiftStartTime?.toISOString(),
        lastUpdated: new Date().toISOString()
    };
    
    localStorage.setItem(stateKey, JSON.stringify(data));
}

function clearWorkClockState() {
    dailyShiftData = null;
    shiftStartTime = null;
    updateShiftProgress();
}

function updateShiftProgress() {
    const progressBar = document.getElementById('shiftProgressBar');
    const shiftStatus = document.getElementById('shiftStatus');
    
    if (!progressBar || !shiftStatus) return;
    
    if (!dailyShiftData) {
        progressBar.style.width = '0%';
        progressBar.className = 'shift-bar';
        shiftStatus.textContent = 'No shift data available';
        return;
    }
    
    const hours = dailyShiftData.totalWorkedMs / (60 * 60 * 1000);
    const percentage = Math.min((hours / 8) * 100, 125); // Allow up to 125% for overtime
    
    progressBar.style.width = `${Math.min(percentage, 100)}%`;
    
    if (percentage >= 100) {
        progressBar.className = 'shift-bar completed';
        shiftStatus.className = 'shift-completed';
        
        if (percentage > 100) {
            const overtimeHours = hours - 8;
            shiftStatus.textContent = `✅ Shift Complete! +${overtimeHours.toFixed(1)} hours overtime (${hours.toFixed(1)} total)`;
        } else {
            shiftStatus.textContent = `✅ 8-hour shift completed! Total: ${hours.toFixed(1)} hours`;
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
        message += `✅ Target Achieved! Great work!`;
    } else {
        message += `📈 ${(8 - totalHours).toFixed(1)} hours short of 8-hour target`;
    }
    
    alert(message);
}

function formatElapsedTime(ms) {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${minutes}m`;
}

function startShiftTimeUpdater() {
    setInterval(() => {
        if (dailyShiftData && currentWorkflowState === WORKFLOW_STATES.WORKING) {
            calculateTotalWorkedTime();
            updateShiftProgress();
        }
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
        
        // Clear input and refocus
        input.value = '';
        input.focus();
        
        // Hide error after 3 seconds
        setTimeout(() => {
            error.style.display = 'none';
        }, 3000);
    }
}

function performTestingBypass() {
    console.log('🧪 PERFORMING TESTING BYPASS...');
    
    // Reset workflow state
    currentWorkflowState = WORKFLOW_STATES.NOT_STARTED;
    
    // Clear shift data
    dailyShiftData = null;
    shiftStartTime = null;
    
    // Clear localStorage for current employee
    if (currentEmployee) {
        const stateKey = `workClock_${currentEmployee}`;
        localStorage.removeItem(stateKey);
    }
    localStorage.removeItem('workflowState');
    
    // Update UI
    updateWorkflowButtonStates();
    updateShiftProgress();
    updateTimeClockStatus('🧪 TESTING MODE: Ready to start your shift');
    
    console.log('✅ TESTING BYPASS COMPLETE - All states reset');
}

// ============= UTILITY FUNCTIONS =============

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add toast to container
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove toast after delay
    const delay = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, delay);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    
    try {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return 'Invalid date';
    }
}

function getSyncStatusIcon(status) {
    switch (status) {
        case 'synced': return '✅';
        case 'pending': return '🔄';
        case 'error': return '❌';
        default: return '✅';
    }
}

// ============= MODAL CLOSE ON OUTSIDE CLICK =============

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

// ============= DEBUG FUNCTIONS =============

// Debug function for testing
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

// Debug function for modals
window.debugModals = function() {
    console.log('🔧 DEBUGGING MODALS...');
    
    const taskModal = document.getElementById('taskEditorModal');
    const passwordModal = document.getElementById('passwordModal');
    
    console.log('Task Editor Modal:', taskModal ? '✅ Found' : '❌ Not found');
    console.log('Password Modal:', passwordModal ? '✅ Found' : '❌ Not found');
    
    // Test modal creation
    if (!taskModal) {
        createTaskEditorModal();
        console.log('✅ Task Editor Modal created');
    }
    
    // Test modal opening
    try {
        openTaskEditorModal();
        console.log('✅ Task Editor Modal opened');
        
        setTimeout(() => {
            closeTaskEditorModal();
            console.log('✅ Task Editor Modal closed');
        }, 2000);
    } catch (error) {
        console.error('❌ Modal test failed:', error);
    }
    
    return 'Modal debugging complete - check console for results';
};

// Debug function for employee state
window.debugEmployee = function() {
    console.log('🔧 DEBUGGING EMPLOYEE STATE...');
    
    const employeeSelect = document.getElementById('employeeSelect');
    
    console.log('Employee Select Element:', employeeSelect ? '✅ Found' : '❌ Not found');
    console.log('Current Employee:', currentEmployee);
    console.log('Employee Select Value:', employeeSelect?.value);
    console.log('Saved Employee:', localStorage.getItem('selectedEmployee'));
    
    if (employeeSelect && !currentEmployee) {
        employeeSelect.value = 'Tony Herrera';
        handleEmployeeChange({ target: { value: 'Tony Herrera' } });
        console.log('✅ Employee set to Tony Herrera');
    }
    
    return `Employee: ${currentEmployee || 'Not set'}`;
};

// Quick progress update functions
async function updateTaskProgress(taskId, newProgress) {
    const task = availableTasks.find(t => t.id === taskId);
    if (!task) {
        showToast('Task not found', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/task-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update_progress',
                task_id: task.companyBoardId,
                master_task_id: task.masterBoardId,
                company: task.company,
                progress: newProgress
            })
        });
        
        if (response.ok) {
            // Update local storage
            await updateTaskInMyDashboard(task.masterBoardId, task.companyBoardId, { progress: newProgress });
            
            // Refresh task list
            await loadAssignedTasks();
            
            showToast(`✅ Progress updated to ${newProgress}%`, 'success');
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.error('Progress update error:', error);
        showToast(`❌ Failed to update progress: ${error.message}`, 'error');
    }
}

// ============= KEYBOARD SHORTCUTS =============

document.addEventListener('keydown', function(event) {
    // Ctrl/Cmd + I = Import Task
    if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
        event.preventDefault();
        openTaskEditorModal();
    }
    
    // Ctrl/Cmd + S = Start Work Day (if not started)
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (currentWorkflowState === WORKFLOW_STATES.NOT_STARTED && currentEmployee) {
            startWorkDay();
        }
    }
    
    // Ctrl/Cmd + B = Take Break (if working)
    if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        if (currentWorkflowState === WORKFLOW_STATES.WORKING) {
            takeBreak();
        }
    }
    
    // Ctrl/Cmd + R = Resume Work (if on break)
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        if (currentWorkflowState === WORKFLOW_STATES.ON_BREAK) {
            resumeWork();
        }
    }
});

// ============= ERROR HANDLING =============

// Global error handler
window.addEventListener('error', function(event) {
    console.error('🚨 Global JavaScript Error:', event.error);
    showToast('❌ An unexpected error occurred. Please refresh the page.', 'error');
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(event) {
    console.error('🚨 Unhandled Promise Rejection:', event.reason);
    showToast('❌ Network error. Please check your connection.', 'error');
    event.preventDefault();
});

// ============= FINAL INITIALIZATION =============

console.log('🚀 Complete VEBLEN Task Tracker script loaded successfully!');
console.log('📋 Available debug functions:');
console.log('  - window.debugStartButton()');
console.log('  - window.debugModals()');
console.log('  - window.debugEmployee()');
console.log('⌨️ Keyboard shortcuts:');
console.log('  - Ctrl/Cmd + I: Import Task');
console.log('  - Ctrl/Cmd + S: Start Work Day');
console.log('  - Ctrl/Cmd + B: Take Break');
console.log('  - Ctrl/Cmd + R: Resume Work');
console.log('  - ESC: Close Modals');

// Auto-initialize if employee is already selected
if (currentEmployee) {
    console.log(`👤 Auto-loading data for ${currentEmployee}...`);
    loadEmployeeData();
}
