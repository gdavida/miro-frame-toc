        let frames = [];
        const HIERARCHY_SEPARATOR = '*-*';
        let currentTab = 'toc';

        // Tab switching
        function switchTab(tabName) {
            currentTab = tabName;
            
            // Update tab link states
            document.querySelectorAll('.tabLinks').forEach(link => {
                link.classList.remove('active');
            });
            
            // Add active class to clicked tab
            event.currentTarget.classList.add('active');
            
            // Update tab content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabName + 'Tab').classList.add('active');
            
            // Refresh frames if switching to TOC tab
            if (tabName === 'toc') {
                refreshFrames();
            }
        }// Replace your existing switchTab function with this
        function switchTab(tabName) {
            currentTab = tabName;
            
            // Update tab link states
            document.querySelectorAll('.tabLinks').forEach(link => {
                link.classList.remove('active');
            });
            
            // Add active class to clicked tab
            event.currentTarget.classList.add('active');
            
            // Update tab content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabName + 'Tab').classList.add('active');
            
            // Refresh frames if switching to TOC tab
            if (tabName === 'toc') {
                refreshFrames();
            }
        }
        // Initialize the app
        async function initApp() {
            try {
                console.log('Initializing Frame TOC app...');

                // Check if Miro SDK is available
                if (typeof miro === 'undefined') {
                    throw new Error('Miro SDK not available');
                }

                console.log('Miro SDK available, loading frames...');

                // Initial load
                await refreshFrames();

                // Listen for frame changes (simplified event listeners)
                try {
                    if (typeof miro !== 'undefined' && miro.board && miro.board.ui) {
                        miro.board.ui.on('items:create', handleItemChange);
                        miro.board.ui.on('items:delete', handleItemChange);
                    }
                } catch (error) {
                    console.warn('Could not set up event listeners:', error);
                }

                console.log('App initialized successfully');

            } catch (error) {
                console.error('Failed to initialize app:', error);
                showError('Failed to initialize app. Please make sure you are running this inside Miro.');
            }
        }

        async function handleItemChange(event) {
            try {
                // Check if any of the items are frames
                if (event.items && event.items.some(item => item.type === 'frame')) {
                    await refreshFrames();
                }
            } catch (error) {
                console.error('Error handling item change:', error);
            }
        }

        async function refreshFrames() {
            if (currentTab !== 'toc') return;
            
            try {
                const container = document.getElementById('tocContainer');
                container.innerHTML = '<div class="loading"><div class="spinner"></div><span>Loading frames...</span></div>';

                console.log('Fetching board items...');

                // Get all items on the board
                const items = await miro.board.get();
                console.log('Found', items.length, 'items on board');

                // Filter for frames
                frames = items.filter(item => item.type === 'frame');
                console.log('Found', frames.length, 'frames');

                if (frames.length === 0) {
                    showEmptyState();
                    return;
                }

                renderTableOfContents();
                showStatus(`Found ${frames.length} frame${frames.length !== 1 ? 's' : ''}`, 'success');

            } catch (error) {
                console.error('Failed to refresh frames:', error);
                showError('Failed to load frames. Please try again.');
            }
        }

        function parseFrameHierarchy(frames) {
            const hierarchicalFrames = [];
            
            frames.forEach(frame => {
                const title = frame.title || '';
                
                if (title.includes(HIERARCHY_SEPARATOR)) {
                    // This frame has hierarchy
                    const parts = title.split(HIERARCHY_SEPARATOR).map(p => p.trim());
                    const level = parts.length - 1; // Last part is the actual name
                    const displayName = parts[parts.length - 1];
                    const parentPath = parts.slice(0, -1).join(HIERARCHY_SEPARATOR);
                    
                    hierarchicalFrames.push({
                        frame: frame,
                        displayName: displayName,
                        level: level,
                        parentPath: parentPath,
                        fullPath: title,
                        sortKey: title.toLowerCase()
                    });
                } else {
                    // Regular frame without hierarchy
                    hierarchicalFrames.push({
                        frame: frame,
                        displayName: title,
                        level: 0,
                        parentPath: '',
                        fullPath: title,
                        sortKey: title.toLowerCase()
                    });
                }
            });
            
            // Sort frames alphabetically, maintaining hierarchy
            hierarchicalFrames.sort((a, b) => {
                // If they share the same parent path, sort by display name
                if (a.parentPath === b.parentPath) {
                    return a.displayName.localeCompare(b.displayName);
                }
                // Otherwise sort by full path to keep hierarchies together
                return a.sortKey.localeCompare(b.sortKey);
            });
            
            return hierarchicalFrames;
        }

        function getHierarchyIndicator(level) {
            if (level === 1) return '▸';
            if (level === 2) return '•';
            if (level === 3) return '◦';
            return '▸'; // Default for any deeper levels
        }

        function renderTableOfContents() {
            const container = document.getElementById('tocContainer');
            
            if (frames.length === 0) {
                showEmptyState();
                return;
            }

            const hierarchicalFrames = parseFrameHierarchy(frames);
            let html = '<div class="toc-list">';
            
            hierarchicalFrames.forEach((item, index) => {
                const frameId = item.frame.id;
                const frameName = item.displayName || `Frame ${index + 1}`;
                const level = item.level;
                
                const levelClass = level > 0 ? `level-${Math.min(level, 3)}` : '';
                const indicator = level > 0 ? getHierarchyIndicator(level) : '';
                
                html += `
                    <div class="toc-item ${levelClass}">
                        <div class="toc-header">
                            ${indicator ? `<span class="hierarchy-indicator">${indicator}</span>` : ''}
                            <a href="#" class="frame-name" onclick="navigateToFrame('${frameId}'); return false;">
                                ${escapeHtml(frameName)}
                                <svg class="link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                </svg>
                            </a>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            container.innerHTML = html;
        }

async function navigateToFrame(frameId) {
    try {
        const frame = frames.find(f => f.id === frameId);
        if (!frame) return;
        
        // Use Miro's built-in zoom to frame
        await miro.board.viewport.zoomTo([frame]);
        
        // Get current viewport
        const viewport = await miro.board.viewport.get();
        
        // Simple offset calculation
        // The panel takes up roughly 368px, which is about 20-25% of typical screen width
        // We'll offset by a proportion of the viewport width
        const offsetRatio = 0.25; // Shift right by 15% of viewport width
        const offset = viewport.width * offsetRatio;
        
        // Apply a simple rightward shift to account for the panel
        await miro.board.viewport.set({
            viewport: {
                x: viewport.x - offset,
                y: viewport.y,
                width: viewport.width,
                height: viewport.height
            },
            animationDurationInMs: 300
        });
        
        // Add the highlight effect after navigation
        await createFrameHighlight(frame);
        
    } catch (error) {
        console.error('Failed to navigate to frame:', error);
    }
}

async function createFrameHighlight(frame) {
    try {
        // Create a soft glow effect with two gentle pulses
        const pulses = 2;
        const pulseDuration = 500; // Duration of each pulse
        
        for (let pulse = 0; pulse < pulses; pulse++) {
            setTimeout(async () => {
                const padding = 30;
                
                // Create the highlight with rounded corners
                const highlight = await miro.board.createShape({
                    shape: 'round_rectangle',
                    x: frame.x,
                    y: frame.y,
                    width: frame.width + padding * 2,
                    height: frame.height + padding * 2,
                    style: {
                        fillColor: '#FFB6C1',     // Light pink fill
                        fillOpacity: 0.05,        // Almost invisible fill
                        borderColor: '#FF69B4',   // Hot pink border
                        borderWidth: 24,          // Nice thick border
                        borderOpacity: 0          // Start invisible
                    }
                });
                
                // Fade in then out for smooth pulse
                const steps = [
                    { opacity: 0.3, fillOpacity: 0.03, delay: 50 },   // Fade in
                    { opacity: 0.5, fillOpacity: 0.05, delay: 100 },  // Peak
                    { opacity: 0.3, fillOpacity: 0.03, delay: 150 },  // Start fade
                    { opacity: 0.1, fillOpacity: 0.01, delay: 200 },  // Fading
                    { opacity: 0, fillOpacity: 0, delay: 250 }        // Gone
                ];
                
                for (let step of steps) {
                    setTimeout(async () => {
                        try {
                            await highlight.update({
                                style: {
                                    fillColor: '#FFB6C1',
                                    fillOpacity: step.fillOpacity,
                                    borderColor: '#FF69B4',
                                    borderWidth: 24,
                                    borderOpacity: step.opacity
                                }
                            });
                        } catch (err) {}
                    }, step.delay);
                }
                
                // Remove after animation completes
                setTimeout(async () => {
                    try {
                        await miro.board.remove(highlight);
                    } catch (err) {}
                }, 300);
                
            }, pulse * 550); // Slight gap between pulses
        }
        
    } catch (error) {
        console.error('Failed to create highlight:', error);
    }
}

        function handleUpgrade() {
            showStatus('Coming soon! Pro features will be available shortly.', 'success');
        }

        function showEmptyState() {
            const container = document.getElementById('tocContainer');
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="9" y1="9" x2="15" y2="9"></line>
                        <line x1="9" y1="13" x2="15" y2="13"></line>
                        <line x1="9" y1="17" x2="11" y2="17"></line>
                    </svg>
                    <h3>No frames found</h3>
                    <p>Create frames on your board to generate a table of contents</p>
                </div>
            `;
        }

        function showError(message) {
            const container = document.getElementById('tocContainer');
            container.innerHTML = `
                <div class="error-state">
                    <h3>Error</h3>
                    <p>${message}</p>
                    <button class="btn btn-refresh" onclick="initApp()">Retry</button>
                </div>
            `;
        }

        function showStatus(message, type) {
            const container = document.getElementById('statusMessage');
            container.innerHTML = `
                <div class="status-message status-${type}">
                    ${message}
                </div>
            `;
            
            setTimeout(() => {
                container.innerHTML = '';
            }, 3000);
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Initialize when the page loads
        window.addEventListener('load', function() {
            console.log('Page loaded, initializing app...');
            initApp();
        });
