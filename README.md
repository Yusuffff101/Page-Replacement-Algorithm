OS Page Replacement Algorithm Simulator

This project is a web-based interactive animation tool designed to visualize core Operating System memory management concepts. It provides a step-by-step animated demonstration of various page replacement algorithms, allowing users to input custom parameters and observe the algorithmic behavior in real-time.

This tool is built as a standalone, client-side application using HTML5, CSS3 (with Tailwind CSS), and modern JavaScript (ES6+), with all animations rendered using the HTML5 Canvas API. It has zero server-side dependencies and runs locally in any modern web browser.

This project was developed by Yusuf Boot Wala.

Features Overview

Algorithm Selection: Visualize and compare three fundamental page replacement algorithms:

FIFO (First-In, First-Out): The simplest algorithm where the page in memory the longest is evicted.

LRU (Least Recently Used): Evicts the page that has not been used for the longest period.

Optimal (OPT): Evicts the page that will not be used for the longest period in the future (the "perfect" algorithm, used for benchmarking).

Interactive Simulation:

Custom Parameters: Users can define the Number of Frames (1-10) and provide a custom Reference String (comma-separated).

Modular Architecture: The code is separated into logical modules for UI management, simulation logic, animation control, and canvas rendering.

Full Animation Controls:

Play / Pause: Automatically play through the simulation steps.

Step Forward: Manually advance the simulation one step at a time.

Step Backward: Review the previous step, a key feature for debugging and understanding.

Speed Control: Adjust the playback speed from 100ms to 2000ms per step.

Real-time Visualization (via Canvas):

Reference String: The full string is displayed, highlighting the current page being processed, past pages (grayed out), and future pages.

Page Frames: A clear, centered view of the memory frames.

Color-Coded Events:

Blue: Page Hit (page found in memory).

Green: Page Fault - Compulsory (page loaded into an empty frame).

Red: Page Fault - Replacement (page evicted and new page loaded).

Helper Structures: Displays the state of the FIFO Queue or LRU Stack in real-time.

Detailed Statistics & Logging:

Live Stats: See real-time counts for Page Hits, Page Faults, Hit Rate (%), and the Current Step number.

Status Bar: A clear, color-coded message describes the outcome of each step.

Execution Log: A full, scrollable log of every step's message.

Export Functionality:

Export Log (.txt): Save the complete execution trace as a text file.

Export Screenshot (.png): Save a snapshot of the current state of the visualization canvas.