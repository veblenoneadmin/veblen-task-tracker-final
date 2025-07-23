// Configuration - ENHANCED VERSION
const CONFIG = {
    taskIntakeUrl: 'https://primary-s0q-production.up.railway.app/webhook/taskintakewebhook',
    taskUpdateUrl: 'https://primary-s0q-production.up.railway.app/webhook/task-update',
    timeLoggerUrl: 'https://primary-s0q-production.up.railway.app/webhook/timelogging',
    reportLoggerUrl: 'https://primary-s0q-production.up.railway.app/webhook/reportlogging',
    taskRetrievalUrl: 'https://primary-s0q-production.up.railway.app/webhook/get-tasks', // NEW: For fetching tasks
    imgbbApiKey: '679bd601ac49c50cae877fb240620cfe'
};

// Progress attribute IDs for each company
const PROGRESS_ATTRIBUTES = {
    "CROWN REALITY": "eb943dd8-dd91-4620-a875-59bdeee59a1f",
    "LCMB GROUP": "4cff12df-fc0d-40aa-aade-e52161b37621",
    "NEWTECH TRAILERS": "f78f7f1b-ec1f-4f1b-972b-6931f6925373",
    "VEBLEN (Internal)": "05ba9bd9-6829-4049-8366-a1ec8d9281d4",
    "FLECK GROUP": "2f9594ea-c62d-4a15-b668-0cdf2f9162cd"
};

// State Management - ENHANCED WITH TASK TRACKING
let currentEmployee = null;
let loadedTasks = [];
let workClockInterval = null;
let breakClockInterval = null;
let currentWorkSession = null;
let currentBreakSession = null;
let dailyShiftData = null;

// NEW: Task-specific tracking
let activeTask = null; // Currently selected task
let taskTimeData = {}; // Track time per task
let availableTasks = []; // Tasks available for selection

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Load saved employee
    const savedEmployee = localStorage.getItem('selectedEmployee');
    if (savedEmployee) {
        document.getElementById('employeeSelect').value = savedEmployee;
        currentEmployee = savedEmployee;
        loadEmployeeData();
    }

    // Set up event listeners
    document.getElementById('employeeSelect').addEventListener('change', handleEmployeeChange);
    document.getElementById('taskIntakeForm').addEventListener('submit', handleTaskIntake);
    document.getElementById('refreshTasksBtn').addEventListener('click', loadAssignedTasks);
    document.getElementById('dailyReportForm').addEventListener('submit', handleDailyReport);
    
    // Time clock buttons - ENHANCED WITH TASK SELECTION
    document.getElementById('startWorkBtn').addEventListener('click', handleStartWork);
    document.getElementById('breakBtn').addEventListener('click', () => handleTimeClock('☕ TAKE BREAK'));
    document.getElementById('backToWorkBtn').addEventListener('click', handleResumeWork);
    document.getElementById('endWorkBtn').addEventListener('click', handleEndWork);

    // Image upload previews
    document.getElementById('taskImage').addEventListener('change', handleTaskImagePreview);
    document.getElementById('reportPhoto').addEventListener('change', handleReportPhotoPreview);

    // Set default date to today for report
    document.getElementById('reportDate').valueAsDate = new Date();
}

// Handle employee selection
function handleEmployeeChange(e) {
    currentEmployee = e.target.value;
    localStorage.setItem('selectedEmployee', currentEmployee);
    
    if (currentEmployee) {
        loadEmployeeData();
    } else {
        clearEmployeeData();
    }
}

// Load employee-specific data - ENHANCED
async function loadEmployeeData() {
    if (!currentEmployee) return;
    
    // Load assigned tasks for task selection
    await loadAssignedTasks();
    
    // Load and restore work clock state
    await loadWorkClockState();
    
    // Load task time data
    loadTaskTimeData();
}

// Clear employee data
function clearEmployeeData() {
    document.getElementById('assignedTasksList').innerHTML = '<p class="loading">Select an employee to view assigned tasks...</p>';
    clearWorkClockState();
    availableTasks = [];
    taskTimeData = {};
}

// ============= ENHANCED TIME CLOCK WITH TASK SELECTION =============

// NEW: Handle start work with task selection
async function handleStartWork() {
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    // Show task selection modal
    await showTaskSelectionModal();
}

// NEW: Show task selection modal
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
    
    // Populate tasks
    populateTaskSelection();
    
    // Show modal
    document.getElementById('taskSelectionModal').style.display = 'block';
}

// NEW: Create task selection modal
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

// NEW: Populate task selection
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

// NEW: Select task for work
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

// NEW: Start work on selected task
async function startWorkOnSelectedTask() {
    if (!activeTask) {
        showToast('Please select a task first', 'warning');
        return;
    }
    
    // Close modal
    closeTaskSelectionModal();
    
    // Start the actual time tracking
    await handleTimeClock('🟢 START WORK');
    
    // Initialize task time tracking
    initializeTaskTimeTracking();
    
    showToast(`Started working on: ${activeTask.name}`, 'success');
}

// NEW: Initialize task time tracking
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
        breakTime: 0 // Track break time during this session
    };
    
    // Save to localStorage
    saveTaskTimeData();
    
    // Update UI to show active task
    updateActiveTaskDisplay();
}

// NEW: Update active task display
function updateActiveTaskDisplay() {
    if (!activeTask) return;
    
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

// NEW: Handle resume work (might be same task or different task)
async function handleResumeWork() {
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    // Ask if they want to continue the same task or switch
    if (activeTask) {
        const continueTask = confirm(`Continue working on "${activeTask.name}"?\n\nClick OK to continue, Cancel to select a different task.`);
        
        if (continueTask) {
            // Continue with same task
            await handleTimeClock('🔵 BACK TO WORK');
            resumeTaskTimeTracking();
            showToast(`Resumed: ${activeTask.name}`, 'success');
        } else {
            // Select different task
            await showTaskSelectionModal();
        }
    } else {
        // No active task, show selection
        await showTaskSelectionModal();
    }
}

// NEW: Resume task time tracking
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

// NEW: Handle end work - finalize task time
async function handleEndWork() {
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    // Finalize current task time
    if (activeTask && taskTimeData[activeTask.id]?.currentSession) {
        finalizeCurrentTaskSession();
    }
    
    // End work day
    await handleTimeClock('🔴 DONE FOR TODAY');
    
    // Show summary including task-specific time
    showDayEndSummary();
    
    // Clear active task
    activeTask = null;
    updateActiveTaskDisplay();
}

// NEW: Finalize current task session
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

// NEW: Show day end summary with task breakdown
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
    
    showToast(summary, 'success');
}

// NEW: Get task today time
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

// NEW: Load task time data from localStorage
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

// NEW: Save task time data to localStorage
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

// NEW: Close task selection modal
function closeTaskSelectionModal() {
    const modal = document.getElementById('taskSelectionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ============= ENHANCED TASK LOADING =============

// Load assigned tasks - ENHANCED to populate task selection
async function loadAssignedTasks() {
    if (!currentEmployee) {
        document.getElementById('assignedTasksList').innerHTML = '<p class="loading">Select an employee to view assigned tasks...</p>';
        return;
    }
    
    try {
        showToast('Loading your tasks...', 'info');
        
        // Try to fetch real tasks (you'll need to implement this endpoint in n8n)
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
        
        // Fallback to sample data for now
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
            },
            {
                id: 'TASK_003',
                name: 'Logo Revision',
                company: 'FLECK GROUP',
                status: 'Revision',
                progress: 80,
                dueDate: '2025-01-25',
                description: 'Revise logo based on client feedback'
            }
        ];
        
        renderTasksList(availableTasks);
        
    } catch (error) {
        console.error('Error loading assigned tasks:', error);
        showToast('Error loading assigned tasks', 'error');
    }
}

// NEW: Render tasks list with time tracking info
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
            
            <!-- Progress Bar Section -->
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
            
            <!-- NEW: Time tracking info -->
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

// NEW: Switch to different task
async function switchToTask(taskId) {
    const task = availableTasks.find(t => t.id === taskId);
    if (!task) return;
    
    // If currently working, finalize current task
    if (activeTask && taskTimeData[activeTask.id]?.currentSession) {
        finalizeCurrentTaskSession();
    }
    
    // Set new active task
    activeTask = task;
    
    // Initialize time tracking for new task
    initializeTaskTimeTracking();
    
    // Update UI
    await loadAssignedTasks(); // Refresh task list
    updateActiveTaskDisplay();
    
    showToast(`Switched to: ${task.name}`, 'success');
}

// ============= REST OF YOUR EXISTING CODE (unchanged) =============

// Handle task intake form submission - ENHANCED WITH IMAGE HANDLING
async function handleTaskIntake(e) {
    e.preventDefault();
    
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }

    // Validate form before submission
    if (!validateTaskIntakeForm()) {
        return;
    }

    try {
        showToast('Creating task...', 'info');

        // Get all form values
        const formData = {
            'Name': currentEmployee, // Who submitted the task
            'Company': document.getElementById('taskCompany').value,
            'Is this project a priority?': document.getElementById('taskPriority').value,
            'Project Title': document.getElementById('taskTitle').value.trim(),
            'Description': document.getElementById('taskDescription').value.trim(),
            'Due Date': document.getElementById('taskDueDate').value,
            'Links': document.getElementById('taskLinks').value.trim()
        };

        // Handle multiple assigned users - join with || as your workflow expects
        const assignedSelect = document.getElementById('taskAssigned');
        const assignedUsers = Array.from(assignedSelect.selectedOptions).map(option => option.value);
        formData['Assigned'] = assignedUsers.join('||');

        // Handle image upload if present - ENHANCED VERSION
        const imageFile = document.getElementById('taskImage').files[0];
        
        if (imageFile) {
            console.log('📎 Uploading image to ImgBB:', imageFile.name, `(${(imageFile.size / 1024 / 1024).toFixed(2)} MB)`);
            
            // Upload image to ImgBB first
            const imageUrl = await uploadToImgBB(imageFile);
            
            if (!imageUrl) {
                showToast('❌ Failed to upload image. Please try again.', 'error');
                return;
            }
            
            // Add the ImgBB URL to form data - this is what n8n expects
            formData['Image_URL'] = imageUrl;
            console.log('✅ Image uploaded successfully:', imageUrl);
        }

        // Debug: Log the data being sent
        console.log('📝 Task Intake Data:', formData);

        // Send as JSON to n8n (always JSON now, no more FormData)
        const response = await fetch(CONFIG.taskIntakeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const responseText = await response.text();
        console.log('📥 Response:', response.status, responseText);

        if (response.ok) {
            showToast('✅ Task created successfully!', 'success');
            resetTaskIntakeForm();
            
            // Show the created task info
            showTaskCreationSuccess(formData, !!imageFile);
            
            // Refresh task list to include new task
            setTimeout(() => {
                loadAssignedTasks();
            }, 2000);
            
        } else {
            throw new Error(`HTTP error! status: ${response.status} - ${responseText}`);
        }

    } catch (error) {
        console.error('❌ Task creation error:', error);
        showToast(`Failed to create task: ${error.message}`, 'error');
    }
}

// Show task creation success info - ENHANCED VERSION
function showTaskCreationSuccess(taskData, hasImage) {
    const message = `
🎉 Task Created Successfully!

📋 Title: ${taskData['Project Title']}
🏢 Company: ${taskData['Company']}
👥 Assigned: ${taskData['Assigned'].replace(/\|\|/g, ', ')}
📅 Due: ${taskData['Due Date'] || 'No due date'}
${taskData['Is this project a priority?'] === 'Yes' ? '⭐ Priority Task' : '🟢 Regular Task'}
${hasImage ? '📎 Image uploaded and attached to StartInfinity' : '📄 Text-only task'}

🔔 Check Discord for task IDs and image preview!
    `;
    
    setTimeout(() => {
        showToast(message, 'success');
    }, 1000);
}

// Reset task intake form after successful submission
function resetTaskIntakeForm() {
    document.getElementById('taskIntakeForm').reset();
    document.getElementById('taskImagePreview').innerHTML = '';
    
    // Keep the employee selected but reset everything else
    const employeeSelect = document.getElementById('employeeSelect');
    if (employeeSelect.value) {
        // Just cleared form, employee stays selected
        showToast('Form cleared. You can create another task.', 'info');
    }
}

// Handle task image preview
function handleTaskImagePreview(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('taskImagePreview');
    
    if (!file) {
        preview.innerHTML = '';
        return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg'];
    if (!allowedTypes.includes(file.type)) {
        showToast('Please upload a valid image or video file', 'error');
        e.target.value = '';
        preview.innerHTML = '';
        return;
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
        showToast('File size must be less than 50MB', 'error');
        e.target.value = '';
        preview.innerHTML = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const isVideo = file.type.startsWith('video/');
        const element = isVideo 
            ? `<video controls style="max-width: 200px; max-height: 200px; margin-top: 10px; border-radius: var(--radius-md); border: 2px solid var(--border-color);"><source src="${e.target.result}" type="${file.type}">Your browser does not support video.</video>`
            : `<img src="${e.target.result}" style="max-width: 200px; max-height: 200px; margin-top: 10px; border-radius: var(--radius-md); border: 2px solid var(--border-color);">`;
            
        preview.innerHTML = `
            ${element}
            <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">
                📎 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) - Ready to upload
            </p>
        `;
    };
    reader.readAsDataURL(file);
}

// Validate task intake form before submission
function validateTaskIntakeForm() {
    const errors = [];
    
    // Check required fields
    if (!document.getElementById('taskCompany').value) {
        errors.push('Company is required');
    }
    
    if (!document.getElementById('taskTitle').value.trim()) {
        errors.push('Project Title is required');
    }
    
    if (!document.getElementById('taskDescription').value.trim()) {
        errors.push('Description is required');
    }
    
    // Check if at least one person is assigned
    const assignedSelect = document.getElementById('taskAssigned');
    if (assignedSelect.selectedOptions.length === 0) {
        errors.push('At least one person must be assigned');
    }
    
    // Show errors if any
    if (errors.length > 0) {
        showToast(`Please fix the following errors:\n${errors.join('\n')}`, 'error');
        return false;
    }
    
    return true;
}

// Update task progress
async function updateTaskProgress(slider) {
    const progress = parseInt(slider.value);
    const taskId = slider.dataset.taskId;
    const company = slider.dataset.company;
    
    // Update visual feedback immediately
    const card = slider.closest('.task-card');
    const progressBar = card.querySelector('.progress-bar');
    const progressValue = card.querySelector('.progress-value');
    
    progressBar.style.width = `${progress}%`;
    progressValue.textContent = `${progress}%`;
    
    // Determine status based on progress
    let newStatus = null;
    if (progress === 0) {
        newStatus = "Project";
    } else if (progress >= 10 && progress < 100) {
        newStatus = "Current Project";
    } else if (progress === 100) {
        newStatus = "Project Finished";
    }
    
    try {
        const response = await fetch(CONFIG.taskUpdateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update_progress',
                task_id: taskId,
                company: company,
                progress: progress,
                status: newStatus,
                employee: currentEmployee,
                timestamp: new Date().toISOString()
            })
        });

        if (response.ok) {
            showToast(`Progress updated to ${progress}%`, 'success');
            
            // Update status display
            if (newStatus) {
                const statusElement = card.querySelector('.task-status');
                statusElement.textContent = newStatus;
                statusElement.className = `task-status ${getStatusClass(newStatus)}`;
            }
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error updating progress:', error);
        showToast('Error updating progress', 'error');
        
        // Revert slider on failure
        slider.value = slider.defaultValue || 50;
        progressBar.style.width = `${slider.value}%`;
        progressValue.textContent = `${slider.value}%`;
    }
}

// ============= TIME CLOCK FUNCTIONALITY (Base functions) =============

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

// Handle clock action for real-time display - ENHANCED FOR TASK TRACKING
function handleClockAction(action, timestamp) {
    if (!dailyShiftData) {
        initializeDailyShiftData();
    }
    
    switch (action) {
        case '🟢 START WORK':
            // Set shift start time if this is the first work session of the day
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
            // If currently working, add the work session time to total
            if (currentWorkSession) {
                const sessionTime = timestamp.getTime() - currentWorkSession.startTime.getTime();
                dailyShiftData.totalWorkedMs += sessionTime;
                
                // Store this work session
                dailyShiftData.workSessions.push({
                    startTime: currentWorkSession.startTime.toISOString(),
                    endTime: timestamp.toISOString(),
                    durationMs: sessionTime
                });
                
                currentWorkSession = null;
            }
            
            // Track break time for current task
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
            // Track break duration for current task
            if (activeTask && taskTimeData[activeTask.id]?.currentSession?.breakStartTime) {
                const breakStart = new Date(taskTimeData[activeTask.id].currentSession.breakStartTime);
                const breakDuration = timestamp.getTime() - breakStart.getTime();
                taskTimeData[activeTask.id].currentSession.breakTime += breakDuration;
                delete taskTimeData[activeTask.id].currentSession.breakStartTime;
                saveTaskTimeData();
            }
            
            // Resume work - start new work session (time will accumulate)
            currentWorkSession = {
                startTime: timestamp,
                lastUpdate: timestamp
            };
            currentBreakSession = null;
            startWorkClock();
            break;
            
        case '🔴 DONE FOR TODAY':
            // If currently working, add final work session time
            if (currentWorkSession) {
                const sessionTime = timestamp.getTime() - currentWorkSession.startTime.getTime();
                dailyShiftData.totalWorkedMs += sessionTime;
                
                // Store final work session
                dailyShiftData.workSessions.push({
                    startTime: currentWorkSession.startTime.toISOString(),
                    endTime: timestamp.toISOString(),
                    durationMs: sessionTime
                });
            }
            
            // Stop all timers and clear state
            stopAllClocks();
            break;
    }
}

// ============= EXISTING FUNCTIONS (unchanged) =============

// Load work clock state for current employee
async function loadWorkClockState() {
    if (!currentEmployee) return;
    
    // Check localStorage for persisted state
    const clockStateKey = `workClock_${currentEmployee}`;
    const savedState = localStorage.getItem(clockStateKey);
    
    if (savedState) {
        try {
            const state = JSON.parse(savedState);
            const now = Date.now();
            const timeDiff = now - new Date(state.lastUpdate).getTime();
            
            // Only restore if the state is from today and less than 24 hours old
            const today = new Date().toDateString();
            const stateDate = new Date(state.lastUpdate).toDateString();
            
            if (stateDate === today && timeDiff < 24 * 60 * 60 * 1000) {
                // Restore daily shift data
                dailyShiftData = state.dailyShiftData || {
                    totalWorkedMs: 0,
                    workSessions: [],
                    shiftStartTime: null,
                    targetShiftMs: 8 * 60 * 60 * 1000 // 8 hours in milliseconds
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
                // Clear old state
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

// Initialize daily shift data
function initializeDailyShiftData() {
    dailyShiftData = {
        totalWorkedMs: 0,
        workSessions: [],
        shiftStartTime: null,
        targetShiftMs: 8 * 60 * 60 * 1000 // 8 hours in milliseconds
    };
}

// Save work clock state
function saveWorkClockState(status, startTime) {
    if (!currentEmployee) return;
    
    const clockStateKey = `workClock_${currentEmployee}`;
    const state = {
        status: status, // 'working', 'break', 'stopped'
        startTime: startTime.toISOString(),
        lastUpdate: new Date().toISOString(),
        employee: currentEmployee,
        dailyShiftData: dailyShiftData
    };
    
    localStorage.setItem(clockStateKey, JSON.stringify(state));
}

// Clear work clock state
function clearWorkClockState() {
    // Stop any running timers
    if (workClockInterval) {
        clearInterval(workClockInterval);
        workClockInterval = null;
    }
    
    if (breakClockInterval) {
        clearInterval(breakClockInterval);
        breakClockInterval = null;
    }
    
    // Hide clock displays
    document.getElementById('workClockDisplay').style.display = 'none';
    document.getElementById('breakClockDisplay').style.display = 'none';
    
    // Clear sessions
    currentWorkSession = null;
    currentBreakSession = null;
    dailyShiftData = null;
    
    // Clear persisted state
    if (currentEmployee) {
        const clockStateKey = `workClock_${currentEmployee}`;
        localStorage.removeItem(clockStateKey);
    }
}

// Start work clock timer - ENHANCED WITH TASK TIME UPDATES
function startWorkClock() {
    // Clear any existing intervals
    if (workClockInterval) clearInterval(workClockInterval);
    if (breakClockInterval) clearInterval(breakClockInterval);
    
    // Hide break display, show work display
    document.getElementById('breakClockDisplay').style.display = 'none';
    document.getElementById('workClockDisplay').style.display = 'block';
    
    // Update timer immediately
    updateWorkTimer();
    
    // Start interval to update every second
    workClockInterval = setInterval(() => {
        updateWorkTimer();
        updateActiveTaskTimer(); // NEW: Update active task timer
    }, 1000);
    
    // Save state
    if (currentWorkSession) {
        saveWorkClockState('working', currentWorkSession.startTime);
    }
}

// Start break clock timer
function startBreakClock() {
    // Clear any existing intervals
    if (workClockInterval) clearInterval(workClockInterval);
    if (breakClockInterval) clearInterval(breakClockInterval);
    
    // Hide work display, show break display
    document.getElementById('workClockDisplay').style.display = 'none';
    document.getElementById('breakClockDisplay').style.display = 'block';
    
    // Update timer immediately
    updateBreakTimer();
    
    // Start interval to update every second
    breakClockInterval = setInterval(updateBreakTimer, 1000);
    
    // Save state
    if (currentBreakSession) {
        saveWorkClockState('break', currentBreakSession.startTime);
    }
}

// NEW: Update active task timer
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
    
    // Current session time
    const currentSessionElapsed = now - currentWorkSession.startTime.getTime();
    const currentSessionFormatted = formatElapsedTime(currentSessionElapsed);
    
    // Total shift time (previous sessions + current session)
    const totalShiftTime = dailyShiftData.totalWorkedMs + currentSessionElapsed;
    const totalShiftFormatted = formatElapsedTime(totalShiftTime);
    
    // Update displays
    document.getElementById('workTimer').textContent = currentSessionFormatted;
    document.getElementById('totalShiftTime').textContent = totalShiftFormatted;
    
    // Update shift progress
    updateShiftProgress(totalShiftTime);
    
    // Update status with start time
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
    
    // Show total worked time and remaining time during break
    const totalWorkedFormatted = formatElapsedTime(dailyShiftData.totalWorkedMs);
    const remainingMs = Math.max(0, dailyShiftData.targetShiftMs - dailyShiftData.totalWorkedMs);
    const remainingFormatted = formatElapsedTime(remainingMs);
    
    document.getElementById('totalWorkedOnBreak').textContent = totalWorkedFormatted;
    document.getElementById('shiftRemainingOnBreak').textContent = remainingFormatted;
    
    // Update status with start time
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
    
    // Calculate percentage
    const percentage = (totalShiftTimeMs / dailyShiftData.targetShiftMs) * 100;
    const clampedPercentage = Math.min(100, percentage);
    
    // Update progress bar width
    progressBar.style.width = `${clampedPercentage}%`;
    
    // Update status message and styling
    const hours = totalShiftTimeMs / (60 * 60 * 1000);
    
    if (percentage >= 100) {
        // Completed 8+ hours
        progressBar.className = 'shift-bar complete';
        shiftStatus.className = 'shift-target complete';
        
        if (percentage > 110) {
            // Over 110% (8.8+ hours) = overtime
            progressBar.className = 'shift-bar overtime';
            shiftStatus.className = 'shift-target overtime';
            shiftStatus.textContent = `🎉 Overtime! ${hours.toFixed(1)} hours completed (+${(hours - 8).toFixed(1)}h extra)`;
        } else {
            shiftStatus.textContent = `🎉 Shift Complete! ${hours.toFixed(1)} hours completed`;
        }
    } else {
        // Still working towards 8 hours
        progressBar.className = 'shift-bar';
        shiftStatus.className = 'shift-target';
        const remainingHours = (8 - hours).toFixed(1);
        shiftStatus.textContent = `${percentage.toFixed(0)}% of 8 hours completed (${remainingHours}h remaining)`;
    }
    
    // Show celebration toast when hitting 8 hours exactly
    if (percentage >= 100 && percentage < 101) {
        showToast('🎉 Congratulations! You\'ve completed your 8-hour shift!', 'success');
    }
}

// Format elapsed time to HH:MM:SS
function formatElapsedTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Show shift summary when ending work - ENHANCED WITH TASK DATA
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

// Stop all clocks
function stopAllClocks() {
    clearWorkClockState();
    
    // Clear saved state
    if (currentEmployee) {
        const clockStateKey = `workClock_${currentEmployee}`;
        saveWorkClockState('stopped', new Date());
    }
}

function updateTimeClockStatus(action, timestamp = new Date()) {
    const statusDiv = document.getElementById('timeClockStatus');
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
        default:
            statusMessage = `Last action: ${action} at ${time}`;
    }
    
    statusDiv.innerHTML = `<span class="${statusClass}">${statusMessage}</span>`;
}

// ============= DAILY REPORT FUNCTIONALITY =============

// Handle daily report with photo upload - ENHANCED WITH TASK DATA
async function handleDailyReport(e) {
    e.preventDefault();
    
    if (!currentEmployee) {
        showToast('Please select an employee first', 'warning');
        return;
    }
    
    // Get photo file
    const photoFile = document.getElementById('reportPhoto').files[0];
    if (!photoFile) {
        showToast('Please upload a photo for the report', 'warning');
        return;
    }
    
    // Upload photo to ImgBB first
    showToast('📤 Uploading photo for report...', 'info');
    const photoUrl = await uploadToImgBB(photoFile);
    
    if (!photoUrl) {
        showToast('❌ Failed to upload photo. Please try again.', 'error');
        return;
    }
    
    // Prepare form data with photo URL and task time data
    const formData = {
        'Name': currentEmployee,
        'Company': document.getElementById('reportCompany').value,
        'Date': document.getElementById('reportDate').value,
        'Project Name': document.getElementById('projectName').value,
        'Number of Revisions': parseInt(document.getElementById('numRevisions').value),
        'Total Time Spent on Project': document.getElementById('totalTimeSpent').value,
        'Notes': document.getElementById('reportNotes').value,
        'Links': document.getElementById('reportLinks').value,
        'Feedback or Requests': document.getElementById('feedbackRequests').value,
        'Photo for report': photoUrl // ImgBB URL instead of binary data
    };

    // NEW: Add task time breakdown to report
    if (Object.keys(taskTimeData).length > 0) {
        let taskTimeBreakdown = '\n\n--- TASK TIME BREAKDOWN ---\n';
        Object.values(taskTimeData).forEach(task => {
            if (task.totalTimeToday > 0) {
                taskTimeBreakdown += `• ${task.taskName} (${task.company}): ${formatElapsedTime(task.totalTimeToday)}\n`;
            }
        });
        formData.Notes += taskTimeBreakdown;
    }

    try {
        showToast('📊 Submitting daily report...', 'info');
        
        const response = await fetch(CONFIG.reportLoggerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            document.getElementById('dailyReportForm').reset();
            document.getElementById('reportPhotoPreview').innerHTML = '';
            showToast('✅ Daily report submitted with task time data!', 'success');
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error submitting daily report:', error);
        showToast('Error submitting daily report', 'error');
    }
}

// Handle report photo preview
function handleReportPhotoPreview(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('reportPhotoPreview');
    
    if (!file) {
        preview.innerHTML = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        preview.innerHTML = `
            <img src="${e.target.result}" style="max-width: 200px; max-height: 200px; margin-top: 10px; border-radius: var(--radius-md); border: 2px solid var(--border-color);">
            <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">📸 Photo ready for upload</p>
        `;
    };
    reader.readAsDataURL(file);
}

// ============= UTILITY FUNCTIONS =============

// Upload image to ImgBB - ENHANCED WITH BETTER ERROR HANDLING
async function uploadToImgBB(file) {
    // Show upload progress
    showToast('📤 Uploading to ImgBB...', 'info');
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.imgbbApiKey}`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ ImgBB Upload Success:', {
                url: data.data.url,
                display_url: data.data.display_url,
                size: data.data.size,
                title: data.data.title,
                delete_url: data.data.delete_url
            });
            
            showToast('✅ Image uploaded to ImgBB successfully!', 'success');
            
            // Return the display_url which is what n8n will use to create StartInfinity attachment
            return data.data.display_url;
        } else {
            console.error('❌ ImgBB upload failed:', data);
            
            let errorMessage = 'Upload failed';
            if (data.error && data.error.message) {
                errorMessage = data.error.message;
            } else if (data.status_txt) {
                errorMessage = data.status_txt;
            }
            
            showToast(`ImgBB Error: ${errorMessage}`, 'error');
            return null;
        }
    } catch (error) {
        console.error('❌ Error uploading to ImgBB:', error);
        showToast(`Upload error: ${error.message}`, 'error');
        return null;
    }
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
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const taskSelectionModal = document.getElementById('taskSelectionModal');
    const taskEditorModal = document.getElementById('taskEditorModal');
    
    if (event.target === taskSelectionModal) {
        closeTaskSelectionModal();
    }
    if (event.target === taskEditorModal) {
        closeTaskEditorModal();
    }
});

// Open task editor (simplified version for task cards)
function openTaskEditor(taskId) {
    openTaskEditorModal();
    // You can auto-populate with task data if available
    showToast('Load task data by pasting IDs from Discord', 'info');
}

// ============= TASK EDITOR MODAL (existing code) =============

let currentModalTaskData = null;

// Open task editor modal
function openTaskEditorModal() {
    // Create modal if it doesn't exist
    if (!document.getElementById('taskEditorModal')) {
        createTaskEditorModal();
    }
    
    // Show modal
    document.getElementById('taskEditorModal').style.display = 'block';
}

// Create task editor modal
function createTaskEditorModal() {
    const modalHTML = `
    <div id="taskEditorModal" class="modal">
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h2>✏️ Task Editor - Paste IDs from Discord</h2>
                <span class="close" onclick="closeTaskEditorModal()">&times;</span>
            </div>
            
            <div class="modal-body">
                <!-- ID Input Section -->
                <div class="id-input-group">
                    <h3>Paste Task IDs from Discord Logs</h3>
                    
                    <div class="paste-area">
                        <label class="paste-label" for="masterBoardId">Master Board ID</label>
                        <input 
                            type="text" 
                            id="masterBoardId" 
                            class="paste-input" 
                            placeholder="bf8167cb-e191-4fb4-b59c-89713cd11812"
                        >
                        <button class="quick-paste-btn" onclick="pasteFromClipboard('masterBoardId')">📋 Paste</button>
                    </div>
                    
                    <div class="paste-area">
                        <label class="paste-label" for="companyBoardId">Company Board ID</label>
                        <input 
                            type="text" 
                            id="companyBoardId" 
                            class="paste-input" 
                            placeholder="8e376e2c-a1c8-434b-b6e0-27b8edbca9a5"
                        >
                        <button class="quick-paste-btn" onclick="pasteFromClipboard('companyBoardId')">📋 Paste</button>
                    </div>
                    
                    <button class="btn btn-primary load-task-btn" onclick="loadTaskForEdit()">
                        🔍 Load Task
                    </button>
                </div>

                <!-- Task Info Display -->
                <div id="taskInfoDisplay" class="task-info-display">
                    <h4>Current Task Information</h4>
                    <div class="info-grid" id="taskInfoGrid">
                        <!-- Task info will be populated here -->
                    </div>
                </div>

                <!-- Task Edit Form -->
                <form id="taskEditModalForm" class="task-edit-form">
                    <div class="edit-grid">
                        <!-- Company Selection -->
                        <div class="form-group">
                            <label for="editCompany">Company*</label>
                            <select id="editCompany" required>
                                <option value="">Select Company</option>
                                <option value="VEBLEN (Internal)">VEBLEN (Internal)</option>
                                <option value="LCMB GROUP">LCMB GROUP</option>
                                <option value="NEWTECH TRAILERS">NEWTECH TRAILERS</option>
                                <option value="CROWN REALITY">CROWN REALITY</option>
                                <option value="FLECK GROUP">FLECK GROUP</option>
                            </select>
                        </div>

                        <!-- Task Name -->
                        <div class="form-group">
                            <label for="editModalTaskName">Task Name*</label>
                            <input type="text" id="editModalTaskName" required>
                        </div>

                        <!-- Description -->
                        <div class="form-group full-width">
                            <label for="editModalDescription">Description</label>
                            <textarea id="editModalDescription" rows="4"></textarea>
                        </div>

                        <!-- Due Date -->
                        <div class="form-group">
                            <label for="editModalDueDate">Due Date</label>
                            <input type="date" id="editModalDueDate">
                        </div>

                        <!-- Status -->
                        <div class="form-group">
                            <label for="editModalStatus">Status</label>
                            <select id="editModalStatus">
                                <option value="">Auto (based on progress)</option>
                                <option value="Project">📋 Project</option>
                                <option value="Priority Project">⭐ Priority Project</option>
                                <option value="Current Project">🔄 Current Project</option>
                                <option value="Revision">📝 Revision</option>
                                <option value="Waiting Approval">⏳ Waiting Approval</option>
                                <option value="Project Finished">✅ Project Finished</option>
                                <option value="Rejected">❌ Rejected</option>
                            </select>
                        </div>

                        <!-- Progress -->
                        <div class="form-group full-width progress-editor">
                            <label for="editModalProgress">Progress</label>
                            <div class="progress-preview">
                                <div class="progress-bar-container">
                                    <div class="progress-bar" id="modalProgressBar" style="width: 0%"></div>
                                </div>
                                <span id="modalProgressValue">0%</span>
                                <span id="modalAutoStatus" class="status-indicator status-project">Project</span>
                            </div>
                            <input 
                                type="range" 
                                id="editModalProgress" 
                                min="0" 
                                max="100" 
                                value="0"
                                oninput="updateModalProgressPreview(this.value)"
                            >
                            <div class="progress-hints">
                                <span class="hint">0% = Project</span>
                                <span class="hint">10-99% = Current Project</span>
                                <span class="hint">100% = Finished</span>
                            </div>
                        </div>

                        <!-- Update Options -->
                        <div class="form-group full-width">
                            <label>
                                <input type="checkbox" id="updateBothBoards" checked>
                                Update both Master and Company boards
                            </label>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeTaskEditorModal()">
                            Cancel
                        </button>
                        <button type="button" class="btn btn-success" onclick="quickCompleteModalTask()">
                            ✅ Quick Complete
                        </button>
                        <button type="submit" class="btn btn-primary">
                            💾 Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    `;
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listener to the form
    document.getElementById('taskEditModalForm').addEventListener('submit', handleModalTaskUpdate);
}

// Close task editor modal
function closeTaskEditorModal() {
    const modal = document.getElementById('taskEditorModal');
    if (modal) {
        modal.style.display = 'none';
        resetModalTaskEditor();
    }
}

// Paste from clipboard
async function pasteFromClipboard(inputId) {
    try {
        const text = await navigator.clipboard.readText();
        const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
        const match = text.match(uuidPattern);
        
        if (match) {
            document.getElementById(inputId).value = match[0];
            showToast('ID pasted successfully!', 'success');
        } else {
            showToast('No valid ID found in clipboard', 'warning');
        }
    } catch (err) {
        showToast('Failed to read clipboard', 'error');
    }
}

// Load task for editing
async function loadTaskForEdit() {
    const masterBoardId = document.getElementById('masterBoardId').value.trim();
    const companyBoardId = document.getElementById('companyBoardId').value.trim();
    
    if (!masterBoardId && !companyBoardId) {
        showToast('Please enter at least one Task ID', 'warning');
        return;
    }
    
    showToast('Loading task data...', 'info');
    
    // For now, create mock task data - you can enhance this when you create task retrieval
    currentModalTaskData = {
        master_board_id: masterBoardId,
        company_board_id: companyBoardId,
        company: 'CROWN REALITY',
        task_name: 'Sample Task',
        description: 'Sample Description',
        due_date: '',
        status: 'Current Project',
        progress: 50
    };
    
    // Populate the form
    populateModalEditForm(currentModalTaskData);
    
    // Show task info
    displayModalTaskInfo(currentModalTaskData);
    
    // Show the edit form
    document.getElementById('taskEditModalForm').classList.add('active');
    document.getElementById('taskInfoDisplay').classList.add('active');
    
    showToast('Task loaded successfully!', 'success');
}

// Display task info in modal
function displayModalTaskInfo(taskData) {
    const infoGrid = document.getElementById('taskInfoGrid');
    infoGrid.innerHTML = `
        <div class="info-item">
            <span class="info-label">Master Board ID</span>
            <span class="info-value">${taskData.master_board_id || 'N/A'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Company Board ID</span>
            <span class="info-value">${taskData.company_board_id || 'N/A'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Company</span>
            <span class="info-value">${taskData.company || 'Not Set'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Current Status</span>
            <span class="info-value">${taskData.status || 'Not Set'}</span>
        </div>
    `;
}

// Populate modal edit form
function populateModalEditForm(taskData) {
    document.getElementById('editCompany').value = taskData.company || '';
    document.getElementById('editModalTaskName').value = taskData.task_name || '';
    document.getElementById('editModalDescription').value = taskData.description || '';
    document.getElementById('editModalDueDate').value = taskData.due_date || '';
    document.getElementById('editModalStatus').value = taskData.status || '';
    document.getElementById('editModalProgress').value = taskData.progress || 0;
    
    // Update progress preview
    updateModalProgressPreview(taskData.progress || 0);
    
    // Set update option based on whether both IDs are present
    document.getElementById('updateBothBoards').checked = 
        !!(taskData.master_board_id && taskData.company_board_id);
}

// Update modal progress preview
function updateModalProgressPreview(value) {
    const progressBar = document.getElementById('modalProgressBar');
    const progressValue = document.getElementById('modalProgressValue');
    const autoStatus = document.getElementById('modalAutoStatus');
    
    progressBar.style.width = `${value}%`;
    progressValue.textContent = `${value}%`;
    
    // Update auto status indicator
    let status = 'Project';
    let statusClass = 'status-project';
    
    if (value >= 10 && value < 100) {
        status = 'Current Project';
        statusClass = 'status-current';
    } else if (value >= 100) {
        status = 'Project Finished';
        statusClass = 'status-finished';
    }
    
    autoStatus.textContent = status;
    autoStatus.className = `status-indicator ${statusClass}`;
}

// Quick complete modal task
async function quickCompleteModalTask() {
    if (!currentModalTaskData) {
        showToast('Please load a task first', 'warning');
        return;
    }
    
    if (!confirm('Are you sure you want to mark this task as complete?')) {
        return;
    }
    
    // Set progress to 100 and update
    document.getElementById('editModalProgress').value = 100;
    updateModalProgressPreview(100);
    
    // Submit the form
    await handleModalTaskUpdate({ preventDefault: () => {} });
}

// Reset modal task editor
function resetModalTaskEditor() {
    if (document.getElementById('taskEditModalForm')) {
        document.getElementById('taskEditModalForm').reset();
        document.getElementById('taskEditModalForm').classList.remove('active');
    }
    if (document.getElementById('taskInfoDisplay')) {
        document.getElementById('taskInfoDisplay').classList.remove('active');
    }
    document.getElementById('masterBoardId').value = '';
    document.getElementById('companyBoardId').value = '';
    currentModalTaskData = null;
    updateModalProgressPreview(0);
}

// Handle modal task update
async function handleModalTaskUpdate(event) {
    event.preventDefault();
    
    if (!currentModalTaskData) {
        showToast('No task loaded', 'error');
        return;
    }
    
    const updateData = {
        action: 'update_details',
        master_task_id: currentModalTaskData.master_board_id,
        task_id: currentModalTaskData.company_board_id || currentModalTaskData.master_board_id,
        company: document.getElementById('editCompany').value,
        task_name: document.getElementById('editModalTaskName').value,
        description: document.getElementById('editModalDescription').value,
        due_date: document.getElementById('editModalDueDate').value,
        progress: parseInt(document.getElementById('editModalProgress').value),
        status: document.getElementById('editModalStatus').value || null,
        update_master: document.getElementById('updateBothBoards').checked,
        employee: currentEmployee || 'Unknown',
        timestamp: new Date().toISOString()
    };
    
    try {
        showToast('Updating task...', 'info');
        
        const response = await fetch(CONFIG.taskUpdateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        if (response.ok) {
            showToast('Task updated successfully!', 'success');
            
            // Update current task data
            currentModalTaskData = { ...currentModalTaskData, ...updateData };
            
            // Update task info display
            displayModalTaskInfo(currentModalTaskData);
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error updating task:', error);
        showToast('Error updating task', 'error');
    }
}
