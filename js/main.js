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
        
        // Panel width constant
        const PANEL_WIDTH = 368;
        
        // Get current viewport to understand available space
        const currentViewport = await miro.board.viewport.get();
        
        // Calculate the frame bounds
        // Frame coordinates are centered, so we need to get the corners
        const frameLeft = frame.x - (frame.width / 2);
        const frameTop = frame.y - (frame.height / 2);
        const frameRight = frame.x + (frame.width / 2);
        const frameBottom = frame.y + (frame.height / 2);
        
        // Add padding to ensure frame title is visible
        // Miro frame titles are typically about 40-50 pixels above the frame
        const TITLE_PADDING = 60;
        const CONTENT_PADDING = 20; // Small padding for breathing room
        
        // Calculate desired viewport dimensions
        // We want to fit the frame in the available space (viewport width - panel)
        const availableWidth = currentViewport.width - PANEL_WIDTH;
        const frameDisplayWidth = frame.width + (CONTENT_PADDING * 2);
        const frameDisplayHeight = frame.height + TITLE_PADDING + CONTENT_PADDING;
        
        // Calculate zoom level to fit frame in available space
        const zoomToFitWidth = availableWidth / frameDisplayWidth;
        const zoomToFitHeight = currentViewport.height / frameDisplayHeight;
        const optimalZoom = Math.min(zoomToFitWidth, zoomToFitHeight, 1); // Don't zoom in more than 100%
        
        // Calculate the viewport dimensions at this zoom level
        const newViewportWidth = currentViewport.width;
        const newViewportHeight = currentViewport.height;
        
        // Calculate where to position the viewport
        // We want the frame's top-left visible, accounting for the panel
        const viewportLeft = frameLeft - CONTENT_PADDING - (PANEL_WIDTH / 2);
        const viewportTop = frameTop - TITLE_PADDING;
        
        // Calculate the center point for the viewport
        const viewportCenterX = viewportLeft + (newViewportWidth / 2);
        const viewportCenterY = viewportTop + (newViewportHeight / 2);
        
        // Set the viewport with calculated position and zoom
        await miro.board.viewport.set({
            viewport: {
                x: viewportCenterX,
                y: viewportCenterY,
                width: newViewportWidth / optimalZoom,
                height: newViewportHeight / optimalZoom
            },
            animationDurationInMs: 300
        });
        
        // Alternative approach if the above doesn't work as expected:
        // Use zoomTo first, then adjust position
        /*
        await miro.board.viewport.zoomTo([frame]);
        const viewport = await miro.board.viewport.get();
        
        // Calculate offset to account for panel and ensure top-left is visible
        const panelOffset = (PANEL_WIDTH / 2) * (viewport.width / frame.width);
        const topOffset = (TITLE_PADDING / 2) * (viewport.height / frame.height);
        
        await miro.board.viewport.set({
            viewport: {
                x: viewport.x - panelOffset,
                y: viewport.y - topOffset,
                width: viewport.width,
                height: viewport.height
            },
            animationDurationInMs: 300
        });
        */
        
    } catch (error) {
        console.error('Failed to navigate to frame:', error);
        // showStatus('Failed to navigate to frame', 'error');
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
