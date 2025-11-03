/**
 * This file contains the complete modular JavaScript code for the 
 * OS Page Replacement Simulator.
 * * It includes all classes required for the application to run:
 * - PageReplacementSimulator: The main application class.
 * - UIManager: Handles all DOM interactions.
 * - SimulationLogic: Contains the pure algorithms (FIFO, LRU, Optimal).
 * - Animator: Manages the simulation playback (play, pause, step).
 * - Renderer: Handles all drawing on the HTML5 Canvas.
 */
// This variable will be used by the Renderer to show eviction animations.
let lastStateFrames = [];

/**
 * Main application class. Orchestrates all modules.
 */
class PageReplacementSimulator {
    constructor() {
        // Get all DOM elements
        this.uiManager = new UIManager();
        this.renderer = new Renderer(this.uiManager.canvas);
        this.animator = null;
        this.simulationLogic = new SimulationLogic();

        this.fullStateHistory = [];
        this.pages = [];

        // Bind event listeners
        this.uiManager.startButton.addEventListener('click', this.startSimulation.bind(this));
        this.uiManager.playPauseButton.addEventListener('click', this.togglePlayPause.bind(this));
        this.uiManager.stepForwardButton.addEventListener('click', this.stepForward.bind(this));
        this.uiManager.stepBackwardButton.addEventListener('click', this.stepBackward.bind(this));
        this.uiManager.speedSlider.addEventListener('input', this.updateSpeed.bind(this));
        this.uiManager.exportLogButton.addEventListener('click', this.exportLog.bind(this));
        this.uiManager.exportPngButton.addEventListener('click', this.exportScreenshot.bind(this));
    
        // Modify the renderer's animateStep to pass context
        // This is a way to link the classes without creating complex circular dependencies
        const originalAnimateStep = this.renderer.animateStep.bind(this.renderer);
        this.renderer.animateStep = (lastState, state, allPages) => {
            lastStateFrames = lastState ? lastState.frames : new Array(state.frames.length).fill(null);
            
            // Pass the selected algorithm to the renderer for its drawing logic
            const algorithm = this.uiManager.algorithmSelect.value;
            originalAnimateStep(lastState, state, allPages, algorithm);
            
            // After resizing, we need to redraw the current state
            this.renderer.onResize = () => {
                if(this.animator) {
                    this.animator.drawCurrentState(true); // Redraw without logging
                }
            }
        }
    }
    startSimulation() {
        // 1. Get and validate inputs
        const algorithm = this.uiManager.algorithmSelect.value;
        const frameCount = parseInt(this.uiManager.framesInput.value, 10);
        const refString = this.uiManager.refStringInput.value;
        this.pages = refString.split(',')
            .map(p => p.trim())
            .filter(p => p !== '')
            .map(p => parseInt(p, 10))
            .filter(p => !isNaN(p)); // Ensure only numbers are processed

        if (this.pages.length === 0 || isNaN(frameCount) || frameCount <= 0 || frameCount > 10) {
            this.uiManager.setStatusMessage("Invalid input. Frames must be 1-10 and string non-empty.", "error");
            return;
        }

        // 2. Generate the full state history
        try {
            this.fullStateHistory = this.simulationLogic.run(this.pages, frameCount, algorithm);
        } catch (error) {
            this.uiManager.setStatusMessage(`Error: ${error.message}`, "error");
            console.error(error);
            return;
        }
        
        // 3. Initialize Animator
        if (this.animator) {
            this.animator.pause();
        }
        this.animator = new Animator(this.renderer, this.uiManager, this.fullStateHistory, this.pages);
        this.animator.setSpeed(this.uiManager.speedSlider.value);
        
        // 4. Reset UI
        this.uiManager.resetUI(this.pages.length);
        this.uiManager.toggleControls(true); // Enable animation controls
        this.uiManager.setPlayButtonState(true); // Set to "Pause"
        
        // Initial draw and start playing
        this.animator.drawCurrentState();
        this.animator.play();
    }

    togglePlayPause() {
        if (!this.animator) return;
        
        if (this.animator.isPlaying) {
            this.animator.pause();
        } else {
            this.animator.play();
        }
    }

    stepForward() {
        if (!this.animator) return;
        this.animator.pause();
        this.animator.stepForward();
    }

stopSimulation() {
        if (this.animator) {
            this.animator.pause();
        }
        this.animator = null;
        this.uiManager.toggleControls(false);
        this.uiManager.setPlayButtonState(false);
        this.uiManager.startButton.disabled = false;
        this.uiManager.resetUI(0);
        this.renderer.clear();
        this.renderer.drawText("Simulation stopped.", this.renderer.canvas.clientWidth / 2, this.renderer.canvas.clientHeight / 2, 20, "center");
    }

    stepBackward() {
        if (!this.animator) return;
        this.animator.pause();
        this.animator.stepBackward();
    }

    updateSpeed() {
        if (!this.animator) return;
        this.animator.setSpeed(this.uiManager.speedSlider.value);
    }

    exportLog() {
        const logContent = this.uiManager.executionLog.textContent;
        const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
        this.downloadBlob(blob, 'page-sim-log.txt');
    }

    exportScreenshot() {
        // Ensure canvas is drawn before exporting
        if(this.animator) {
            this.animator.drawCurrentState();
        } else {
            this.renderer.clear();
            this.renderer.drawText("No simulation running.", this.renderer.canvas.clientWidth / 2, this.renderer.canvas.clientHeight / 2, 20, "center");
        }

        const dataURL = this.uiManager.canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'page-sim-screenshot.png';
        link.href = dataURL;
        link.click();
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
}

/**
 * Manages all UI element interactions and updates.
 */
class UIManager {
    constructor() {
        // Configuration
        this.algorithmSelect = document.getElementById('algorithm');
        this.framesInput = document.getElementById('frames');
        this.refStringInput = document.getElementById('ref-string');
        this.startButton = document.getElementById('start-sim');

        // Animation Controls
        this.playPauseButton = document.getElementById('play-pause');
        this.stepBackwardButton = document.getElementById('step-backward');
        this.stepForwardButton = document.getElementById('step-forward');
        this.speedSlider = document.getElementById('speed-slider');

        // Canvas
        this.canvas = document.getElementById('simulation-canvas');

        // Statistics
        this.statHits = document.getElementById('stat-hits');
        this.statFaults = document.getElementById('stat-faults');
        this.statHitRate = document.getElementById('stat-hit-rate');
        this.statStep = document.getElementById('stat-step');
        this.statusMessage = document.getElementById('status-message');

        // Log & Export
        this.executionLog = document.getElementById('execution-log');
        this.exportLogButton = document.getElementById('export-log');
        this.exportPngButton = document.getElementById('export-png');
    }

    /**
     * Resets the UI to its initial state before a simulation.
     * @param {number} totalSteps - The total number of steps for the new sim.
     */
    resetUI(totalSteps = 0) {
        this.statHits.textContent = '0';
        this.statFaults.textContent = '0';
        this.statHitRate.textContent = '0.00%';
        this.statStep.textContent = `0 / ${totalSteps}`;
        this.executionLog.textContent = '';
        if (totalSteps > 0) {
            this.setStatusMessage("Simulation started.", "info");
        } else {
            this.setStatusMessage("Ready to start simulation.", "info");
        }
    }

    /**
     * Toggles the enabled/disabled state of simulation controls.
     * @param {boolean} isSimulating - True if simulation is starting, false if not.
     */
    toggleControls(isSimulating) {
        this.playPauseButton.disabled = !isSimulating;
        this.stepBackwardButton.disabled = !isSimulating;
        this.stepForwardButton.disabled = !isSimulating;
        this.exportLogButton.disabled = !isSimulating;
        this.exportPngButton.disabled = !isSimulating;
        
        // Config controls are disabled *during* simulation
        this.startButton.disabled = isSimulating;
        this.algorithmSelect.disabled = isSimulating;
        this.framesInput.disabled = isSimulating;
        this.refStringInput.disabled = isSimulating;

        if (!isSimulating) {
             this.exportPngButton.disabled = true; // No sim, no screenshot
        }
    }

    /**
     * Updates the Play/Pause button text and style.
     * @param {boolean} isPlaying - True if the animator is currently playing.
     */
    setPlayButtonState(isPlaying) {
        if (isPlaying) {
            this.playPauseButton.textContent = "Pause";
            this.playPauseButton.classList.remove('bg-green-600', 'hover:bg-green-700');
            this.playPauseButton.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
        } else {
            this.playPauseButton.textContent = "Play";
            this.playPauseButton.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
            this.playPauseButton.classList.add('bg-green-600', 'hover:bg-green-700');
        }
    }

    /**
     * Toggles the state of step buttons based on the current index.
     * @param {number} currentIndex - The current step index.
     * @param {number} totalSteps - The total number of steps.
     */
    updateStepButtonStates(currentIndex, totalSteps) {
        this.stepBackwardButton.disabled = (currentIndex <= 0);
        this.stepForwardButton.disabled = (currentIndex >= totalSteps - 1);
    }

    /**
     * Updates all statistical displays.
     * @param {object} stats - The statistics object from the current state.
     * @param {number} currentStep - The current step number (1-based).
     * @param {number} totalSteps - The total number of steps.
     */
    updateStats(stats, currentStep, totalSteps) {
        const { hits, faults, total } = stats;
        const hitRate = total === 0 ? 0 : (hits / total) * 100;
        
        this.statHits.textContent = hits;
        this.statFaults.textContent = faults;
        this.statHitRate.textContent = `${hitRate.toFixed(2)}%`;
        this.statStep.textContent = `${currentStep} / ${totalSteps}`;
    }

    /**
     * Sets the main status message.
     * @param {string} message - The message to display.
     * @param {'info' | 'error' | 'success'} type - The type of message.
     */
    setStatusMessage(message, type = 'info') {
        this.statusMessage.textContent = message;
        this.statusMessage.classList.remove('bg-red-100', 'text-red-800', 'bg-green-100', 'text-green-800', 'bg-gray-100', 'text-gray-800');
        
        switch (type) {
            case 'error':
                this.statusMessage.classList.add('bg-red-100', 'text-red-800');
                break;
            case 'success':
                this.statusMessage.classList.add('bg-green-100', 'text-green-800');
                break;
            case 'info':
            default:
                this.statusMessage.classList.add('bg-gray-100', 'text-gray-800');
                break;
        }
    }

    /**
     * Appends a message to the execution log.
     * @param {string} message - The log message.
     */
    addLogMessage(message) {
        this.executionLog.textContent += `${message}\n`;
        // Auto-scroll to bottom
        this.executionLog.scrollTop = this.executionLog.scrollHeight;
    }
}

/**
 * Contains the pure logic for all page replacement algorithms.
 * Generates a complete step-by-step history of the simulation.
 */
class SimulationLogic {
    /**
     * Runs the selected algorithm and returns the state history.
     * @param {number[]} pages - The array of page numbers.
     * @param {number} frameCount - The number of frames.
     * @param {string} algorithm - "FIFO", "LRU", or "OPTIMAL".
     * @returns {object[]} - An array of state objects.
     */
    run(pages, frameCount, algorithm) {
        switch (algorithm) {
            case 'FIFO':
                return this.runFIFO(pages, frameCount);
            case 'LRU':
                return this.runLRU(pages, frameCount);
            case 'OPTIMAL':
                return this.runOptimal(pages, frameCount);
            default:
                throw new Error("Unknown algorithm selected.");
        }
    }

    /**
     * Creates a standardized state object for the history.
     */
    createState(step, page, frames, isHit, pageToEvict, helperQueue, message, stats) {
        return {
            step,           // Current step index
            page,           // Page being referenced
            frames: [...frames], // State of frames *after* this step
            isHit,
            pageToEvict,    // Page that was just evicted (if any)
            helperQueue: [...helperQueue], // FIFO queue or LRU stack
            message,
            stats: {...stats} // { hits, faults, total }
        };
    }

    runFIFO(pages, frameCount) {
        let frames = new Array(frameCount).fill(null);
        let fifoQueue = []; // Tracks entry order
        let history = [];
        let stats = { hits: 0, faults: 0, total: 0 };

        pages.forEach((page, step) => {
            stats.total++;
            let isHit = frames.includes(page);
            let pageToEvict = null;
            let message = `Step ${step + 1} (Page ${page}): `;

            if (isHit) {
                stats.hits++;
                message += `Page ${page} is already in memory. (HIT)`;
            } else {
                stats.faults++;
                if (frames.includes(null)) {
                    // Compulsory fault (empty frame available)
                    let emptyIndex = frames.indexOf(null);
                    frames[emptyIndex] = page;
                    fifoQueue.push(page);
                    message += `Page ${page} caused a FAULT. Loaded into empty Frame ${emptyIndex}.`;
                } else {
                    // Replacement fault
                    pageToEvict = fifoQueue.shift();
                    let evictIndex = frames.indexOf(pageToEvict);
                    frames[evictIndex] = page;
                    fifoQueue.push(page);
                    message += `Page ${page} caused a FAULT. Page ${pageToEvict} (FIFO) was evicted from Frame ${evictIndex}.`;
                }
            }
            history.push(this.createState(step, page, frames, isHit, pageToEvict, fifoQueue, message, stats));
        });
        return history;
    }

    runLRU(pages, frameCount) {
        let frames = new Array(frameCount).fill(null);
        let lruStack = []; // Tracks usage (MRU at 0, LRU at end)
        let history = [];
        let stats = { hits: 0, faults: 0, total: 0 };

        pages.forEach((page, step) => {
            stats.total++;
            let isHit = frames.includes(page);
            let pageToEvict = null;
            let message = `Step ${step + 1} (Page ${page}): `;

            if (isHit) {
                stats.hits++;
                // Move to MRU (front of stack)
                lruStack.splice(lruStack.indexOf(page), 1);
                lruStack.unshift(page);
                message += `Page ${page} is already in memory. (HIT)`;
            } else {
                stats.faults++;
                if (frames.includes(null)) {
                    // Compulsory fault
                    let emptyIndex = frames.indexOf(null);
                    frames[emptyIndex] = page;
                    lruStack.unshift(page); // Add to MRU
                    message += `Page ${page} caused a FAULT. Loaded into empty Frame ${emptyIndex}.`;
                } else {
                    // Replacement fault
                    pageToEvict = lruStack.pop(); // Evict from LRU (end of stack)
                    let evictIndex = frames.indexOf(pageToEvict);
                    frames[evictIndex] = page;
                    lruStack.unshift(page); // Add to MRU
                    message += `Page ${page} caused a FAULT. Page ${pageToEvict} (LRU) was evicted from Frame ${evictIndex}.`;
                }
            }
            history.push(this.createState(step, page, frames, isHit, pageToEvict, lruStack, message, stats));
        });
        return history;
    }

    runOptimal(pages, frameCount) {
        let frames = new Array(frameCount).fill(null);
        let history = [];
        let stats = { hits: 0, faults: 0, total: 0 };

        pages.forEach((page, step) => {
            stats.total++;
            let isHit = frames.includes(page);
            let pageToEvict = null;
            let message = `Step ${step + 1} (Page ${page}): `;

            if (isHit) {
                stats.hits++;
                message += `Page ${page} is already in memory. (HIT)`;
            } else {
                stats.faults++;
                if (frames.includes(null)) {
                    // Compulsory fault
                    let emptyIndex = frames.indexOf(null);
                    frames[emptyIndex] = page;
                    message += `Page ${page} caused a FAULT. Loaded into empty Frame ${emptyIndex}.`;
                } else {
                    // Replacement fault - find page to evict
                    let futureUses = {};
                    let pagesInFrames = frames.filter(p => p !== null);

                    pagesInFrames.forEach(p => {
                        let nextUse = pages.slice(step + 1).indexOf(p);
                        futureUses[p] = (nextUse === -1) ? Infinity : nextUse;
                    });

                    pageToEvict = Object.keys(futureUses).reduce((a, b) => futureUses[a] > futureUses[b] ? a : b);
                    pageToEvict = parseInt(pageToEvict, 10);
                    
                    let evictIndex = frames.indexOf(pageToEvict);
                    frames[evictIndex] = page;
                    message += `Page ${page} caused a FAULT. Page ${pageToEvict} (Optimal) was evicted from Frame ${evictIndex}.`;
                }
            }
            // For Optimal, the "helperQueue" isn't used, but we can pass the 'future' to visualize
            let future = pages.slice(step + 1);
            // --- FIX 1 ---
            // Fixed typo 'inHit' to 'isHit'
            history.push(this.createState(step, page, frames, isHit, pageToEvict, future, message, stats));
        });
        return history;
    }
}

/**
 * Manages the playback of the simulation (play, pause, step).
 */
class Animator {
    constructor(renderer, uiManager, stateHistory, pages) {
        this.renderer = renderer;
        this.uiManager = uiManager;
        this.stateHistory = stateHistory;
        this.pages = pages; // Full original reference string
        
        this.currentIndex = 0;
        this.isPlaying = false;
        this.animationSpeed = 1000; // ms
        this.timer = null;
        this.lastLoggedIndex = -1; // Tracks logging to avoid duplicates
    }

    play() {
        if (this.isPlaying) return;
        
        // If at the end, reset to beginning
        if (this.currentIndex >= this.stateHistory.length - 1) {
            this.currentIndex = 0;
            this.lastLoggedIndex = -1;
            this.uiManager.executionLog.textContent = ''; // Clear log
        }

        this.isPlaying = true;
        this.uiManager.setPlayButtonState(true);
        this.uiManager.toggleControls(true); // Re-enable controls, but lock config

        // Immediately execute the first step, then set timeout
        this.nextStep();
    }

    pause() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        this.uiManager.setPlayButtonState(false);
        clearTimeout(this.timer);
        this.timer = null;
    }

    nextStep() {
        this.drawCurrentState(); // Draw the current state
        
        // Check if we are at the end
        if (this.currentIndex >= this.stateHistory.length - 1) {
            this.pause();
            this.uiManager.setStatusMessage("Simulation finished.", "success");
            this.uiManager.toggleControls(false); // Unlock config controls
            this.uiManager.startButton.disabled = false;
            this.uiManager.playPauseButton.disabled = false; // Allow replay
        } else {
            // If playing, increment index and set timer for the *next* step
            if (this.isPlaying) {
                this.currentIndex++;
                this.timer = setTimeout(() => this.nextStep(), this.animationSpeed);
            }
        }
    }

    stepForward() {
        if (this.currentIndex >= this.stateHistory.length - 1) return;
        this.currentIndex++;
        this.drawCurrentState();
    }

    stepBackward() {
        if (this.currentIndex <= 0) return;
        this.currentIndex--;
        // When stepping back, we can't "un-log", so we just draw
        this.drawCurrentState(true); // Pass flag to suppress logging
    }

    /**
     * Draws the state at the current index.
     * @param {boolean} [suppressLog=false] - If true, do not add to the log.
     */
    drawCurrentState(suppressLog = false) {
        if (this.currentIndex < 0 || this.currentIndex >= this.stateHistory.length) {
            return;
        }
        
        const state = this.stateHistory[this.currentIndex];
        const lastState = this.currentIndex > 0 ? this.stateHistory[this.currentIndex - 1] : null;

        // Animate the transition
        this.renderer.animateStep(lastState, state, this.pages);
        
        // Update UI elements
        this.uiManager.updateStats(state.stats, this.currentIndex + 1, this.pages.length);
        this.uiManager.setStatusMessage(state.message, state.isHit ? 'success' : 'error');
        
        // Log message only when moving forward
        if (!suppressLog && this.currentIndex > this.lastLoggedIndex) {
             this.uiManager.addLogMessage(state.message);
             this.lastLoggedIndex = this.currentIndex;
        }
        
        this.uiManager.updateStepButtonStates(this.currentIndex, this.stateHistory.length);
    }

    setSpeed(value) {
        // Inverse relationship: higher slider value = faster = less time
        this.animationSpeed = 2100 - value; // Map 100-2000 to 2000ms-100ms
    }
}

/**
 * Handles all drawing on the canvas.
 */
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.devicePixelRatio = window.devicePixelRatio || 1;
        this.onResize = () => {}; // Callback for when resize happens

        // --- FIX 2 ---
        // Use ResizeObserver to watch the canvas *itself*
        new ResizeObserver(() => this.resizeCanvas()).observe(this.canvas);
        
        // Call resizeCanvas once manually to set initial size
        this.resizeCanvas();
    }

    resizeCanvas() {
        // Get the display size the canvas is *supposed* to be (from CSS)
        const { clientWidth, clientHeight } = this.canvas;
        
        // Check if internal size needs updating
        if (this.canvas.width !== Math.round(clientWidth * this.devicePixelRatio) ||
            this.canvas.height !== Math.round(clientHeight * this.devicePixelRatio)) {

            // Reset the transform *before* scaling
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);

            // Set internal resolution
            this.canvas.width = Math.round(clientWidth * this.devicePixelRatio);
            this.canvas.height = Math.round(clientHeight * this.devicePixelRatio);
            
            // Update internal dimension properties
            this.width = this.canvas.width; // This is the buffer width
            this.height = this.canvas.height; // This is the buffer height
            
            // Scale context for HDPI
            this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);

            // Trigger a redraw in case a simulation is active
            this.onResize();
        }
    }

    /**
     * Main animation function. Draws a single, complete step.
     */
    animateStep(lastState, state, allPages, algorithm) {
        this.clear();
        
        // If canvas has no height, don't try to draw
        if (this.canvas.clientHeight === 0) return;

        const { page: currentPage, step: currentIndex } = state;
        
        // 1. Draw Reference String
        this.drawReferenceString(allPages, currentIndex);

        // 2. Draw Page Frames
        this.drawFrames(state.frames, state.pageToEvict, state.isHit ? null : currentPage, state.isHit ? currentPage : null);
        
        // 3. Draw Helper Queue (FIFO/LRU)
        if (algorithm === 'FIFO' || algorithm === 'LRU') {
            let title = "Queue:";
            if(algorithm === 'LRU') title = "LRU Stack (MRU...LRU):";
            if(algorithm === 'FIFO') title = "FIFO Queue (Old...New):";
            this.drawText(title, 20, 100, 16, "left", "#555");
            this.drawText(state.helperQueue.join(', '), 20, 125, 14, "left", "#000");
        }
        
        // 4. Draw Hit/Fault Animation
        this.drawHitFaultIndicator(state);
    }

    clear() {
        // Use clientWidth/Height for clearing the scaled context
        // These are the *display* dimensions, which match the coordinate space after scaling
        this.ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    }

    /**
     * Draws the reference string at the top of the canvas.
     */
    drawReferenceString(allPages, currentIndex) {
        const boxWidth = 35;
        const boxHeight = 35;
        const spacing = 5;
        const startY = 30;
        const startX = 20;

        this.drawText("Reference String:", startX, startY - 10, 16, "left", "#555");
        
        allPages.forEach((page, index) => {
            const x = startX + index * (boxWidth + spacing);
            const y = startY;
            
            // Ensure drawing stays within canvas bounds
            if (x + boxWidth > this.canvas.clientWidth) {
                // Stop drawing if it goes off-screen
                return;
            }

            if (index < currentIndex) {
                // Already processed
                this.drawBox(page, x, y, boxWidth, boxHeight, "#d1d5db", "#6b7280");
            } else if (index === currentIndex) {
                // Current page
                this.drawBox(page, x, y, boxWidth, boxHeight, "#3b82f6", "#ffffff");
                // Draw "Current" arrow
                this.ctx.fillStyle = "#3b82f6";
                this.ctx.beginPath();
                this.ctx.moveTo(x + boxWidth / 2, y + boxHeight + 5);
                this.ctx.lineTo(x + boxWidth / 2 - 5, y + boxHeight + 12);
                this.ctx.lineTo(x + boxWidth / 2 + 5, y + boxHeight + 12);
                this.ctx.closePath();
                this.ctx.fill();
            } else {
                // Future page
                this.drawBox(page, x, y, boxWidth, boxHeight, "#ffffff", "#374151", "#e5e7eb");
            }
        });
    }

    /**
     * Draws the page frames in the center.
     */
    drawFrames(frames, evictedPage, newPage, hitPage) {
        const frameWidth = 80;
        const frameHeight = 100;
        const spacing = 20;
        const totalWidth = frames.length * (frameWidth + spacing) - spacing;
        const startX = Math.max(20, (this.canvas.clientWidth - totalWidth) / 2);
        const startY = this.canvas.clientHeight / 2.5; 

        this.drawText("Page Frames:", startX, startY - 20, 18, "left", "#333");

        frames.forEach((page, index) => {
            const x = startX + index * (frameWidth + spacing);
            let bgColor = "#ffffff";
            let textColor = "#11182c";
            let strokeColor = "#9ca3af";

            if (page === newPage) {
                // --- FIX 3 ---
                // Fixed invalid hex code '#10b81'
                bgColor = "#10b981"; // Green
                textColor = "#ffffff";
            } else if (page === hitPage) {
                // Just hit
                bgColor = "#3b82f6"; // Blue
                textColor = "#ffffff";
            }
            
            // Check if this frame *was* the one holding the evicted page
            if(evictedPage !== null && lastStateFrames[index] === evictedPage) {
                 bgColor = "#ef4444"; // Red
                 textColor = "#ffffff";
                 this.drawText("Evicted", x + frameWidth / 2, startY + frameHeight + 20, 14, "center", "#ef4444");
            }

            this.drawBox(page, x, startY, frameWidth, frameHeight, bgColor, textColor, strokeColor, 10, 36);
        });
    }
    
    /**
     * Draws the "HIT" or "FAULT" message.
     */
    drawHitFaultIndicator(state) {
        const y = this.canvas.clientHeight / 1.5;
        const x = this.canvas.clientWidth / 2;
        
        if (state.isHit) {
            this.drawText("HIT!", x, y, 48, "center", "#10b981");
        } else {
            this.drawText("PAGE FAULT!", x, y, 48, "center", "#ef4444");
        }
    }
    
    /**
     * Helper to draw a text element.
     */
    drawText(text, x, y, size = 16, align = "center", color = "#000") {
        this.ctx.fillStyle = color;
        this.ctx.font = `bold ${size}px Inter`;
        this.ctx.textAlign = align;
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(text, x, y);
    }
    
    /**
     * Helper to draw a styled box with text.
     */
    drawBox(text, x, y, w, h, bgColor, textColor, strokeColor = "transparent", radius = 8, fontSize = 20) {
        this.ctx.fillStyle = bgColor;
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        // Use a custom roundRect polyfill if ctx.roundRect is not available
        if (this.ctx.roundRect) {
            this.ctx.roundRect(x, y, w, h, radius);
        } else {
            // Fallback for older browsers
            this.ctx.moveTo(x + radius, y);
            this.ctx.lineTo(x + w - radius, y);
            this.ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
            this.ctx.lineTo(x + w, y + h - radius);
            this.ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            this.ctx.lineTo(x + radius, y + h);
            this.ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
            this.ctx.lineTo(x, y + radius);
            this.ctx.quadraticCurveTo(x, y, x + radius, y);
            this.ctx.closePath();
        }
        this.ctx.fill();
        this.ctx.stroke();

        if (text !== null && text !== undefined) {
            this.drawText(String(text), x + w / 2, y + h / 2, fontSize, "center", textColor);
        }
    }
}

// Initialize the application
// This code runs when the app.js script is loaded.
try {
    const app = new PageReplacementSimulator();
} catch (e) {
    console.error("Failed to initialize the simulator:", e);
    document.body.innerHTML = `<div style="padding: 20px; text-align: center; font-family: sans-serif; color: red;">
        <h1>Application Error</h1>
        <p>Could not initialize the simulator. Please check the console for details.</p>
        <pre>${e.message}</pre>
    </div>`;
}