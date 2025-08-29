# CodeMind HTML Template Standards

## Overview
This document defines the HTML template standards for all CodeMind dashboard components to ensure consistency, maintainability, and professional appearance.

## Component Structure Standard

### 1. Standard Component Template
All project components must follow this HTML structure:

```html
<div class="project-component" data-component="{type}">
    <header class="component-header">
        <h3 class="component-title">{title}</h3>
        <div class="component-actions">
            <button class="refresh-btn" onclick="{refreshFunction}()">🔄</button>
            <button class="expand-btn" onclick="{expandFunction}()">⛶</button>
        </div>
    </header>
    <main class="component-content">
        <div class="loading" style="display: none;">🔄 Loading...</div>
        <div class="content-area">
            {component-specific-content}
        </div>
    </main>
    <footer class="component-footer">
        <span class="last-updated">Last updated: <span id="{component}LastUpdated">Never</span></span>
        <span class="data-source">Source: {data-source}</span>
    </footer>
</div>
```

### 2. CSS Variable Standards
Use these CSS custom properties for consistency:

```css
:root {
    /* Primary Colors */
    --primary-color: #007acc;
    --secondary-color: #f0f8ff;
    --accent-color: #28a745;
    
    /* Status Colors */
    --success-color: #28a745;
    --warning-color: #ffc107;
    --error-color: #dc3545;
    --info-color: #17a2b8;
    
    /* Layout */
    --border-color: #ddd;
    --border-radius: 8px;
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 16px;
    --spacing-lg: 24px;
    --spacing-xl: 32px;
    
    /* Typography */
    --font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    --font-size-sm: 0.875rem;
    --font-size-base: 1rem;
    --font-size-lg: 1.125rem;
    --font-size-xl: 1.25rem;
    
    /* Shadows */
    --shadow-sm: 0 2px 4px rgba(0,0,0,0.1);
    --shadow-md: 0 4px 8px rgba(0,0,0,0.1);
    --shadow-lg: 0 8px 16px rgba(0,0,0,0.1);
}
```

### 3. Component CSS Classes

#### Base Component Classes
```css
.project-component {
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    margin: var(--spacing-md);
    background: white;
    box-shadow: var(--shadow-sm);
    transition: box-shadow 0.3s ease;
}

.project-component:hover {
    box-shadow: var(--shadow-md);
}

.component-header {
    background: linear-gradient(135deg, var(--primary-color) 0%, #005c99 100%);
    color: white;
    padding: var(--spacing-sm) var(--spacing-md);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: var(--border-radius) var(--border-radius) 0 0;
}

.component-title {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
}

.component-actions {
    display: flex;
    gap: var(--spacing-xs);
}

.component-content {
    padding: var(--spacing-md);
    min-height: 200px;
    position: relative;
}

.component-footer {
    background: #f8f9fa;
    padding: var(--spacing-sm) var(--spacing-md);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--border-color);
    font-size: var(--font-size-sm);
    color: #666;
    border-radius: 0 0 var(--border-radius) var(--border-radius);
}
```

#### Button Standards
```css
.btn {
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: all 0.3s ease;
    text-decoration: none;
    display: inline-block;
}

.btn-primary {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
}

.btn-primary:hover {
    background: #005c99;
    border-color: #005c99;
}

.btn-success {
    background: var(--success-color);
    color: white;
    border-color: var(--success-color);
}

.btn-warning {
    background: var(--warning-color);
    color: #212529;
    border-color: var(--warning-color);
}

.btn-danger {
    background: var(--error-color);
    color: white;
    border-color: var(--error-color);
}
```

#### Status Indicator Standards
```css
.status-indicator {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: var(--spacing-xs);
}

.status-healthy { background: var(--success-color); }
.status-warning { background: var(--warning-color); }
.status-error { background: var(--error-color); }
.status-info { background: var(--info-color); }
.status-unknown { background: #6c757d; }
```

#### Loading States
```css
.loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255, 255, 255, 0.95);
    padding: var(--spacing-md);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-md);
    text-align: center;
    z-index: 100;
}

.loading::before {
    content: "";
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid var(--border-color);
    border-radius: 50%;
    border-top-color: var(--primary-color);
    animation: spin 1s ease-in-out infinite;
    margin-right: var(--spacing-xs);
    vertical-align: middle;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
```

## JavaScript Standards

### 1. Component Loading Pattern
All components should follow this loading pattern:

```javascript
async function load{ComponentName}() {
    const container = document.getElementById('{component}Content');
    const loadingEl = container.querySelector('.loading');
    
    try {
        // Show loading state
        loadingEl.style.display = 'block';
        
        // Fetch data
        const response = await fetch(`/api/dashboard/projects/${currentProject}/{endpoint}`);
        const data = await response.json();
        
        // Update UI
        render{ComponentName}(data);
        updateLastUpdated('{component}LastUpdated');
        
    } catch (error) {
        console.error(`❌ Error loading {component}:`, error);
        container.innerHTML = '<p class="text-error">Failed to load data. Please try again.</p>';
    } finally {
        // Hide loading state
        loadingEl.style.display = 'none';
    }
}
```

### 2. Error Handling Standards
```javascript
function handleError(error, componentName) {
    console.error(`❌ Error in ${componentName}:`, error);
    return `
        <div class="error-message">
            <div class="status-indicator status-error"></div>
            <span>Failed to load ${componentName}. Please try again.</span>
            <button class="btn btn-primary" onclick="refresh${componentName}()">Retry</button>
        </div>
    `;
}
```

### 3. Utility Functions
```javascript
function updateLastUpdated(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = new Date().toLocaleString();
    }
}

function formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
```

## Accessibility Standards

### 1. ARIA Labels
- All interactive elements must have proper ARIA labels
- Use `aria-label` for buttons without visible text
- Use `role` attributes for custom components

### 2. Keyboard Navigation
- All interactive elements must be keyboard accessible
- Use proper `tabindex` values
- Implement focus management for dynamic content

### 3. Screen Reader Support
```html
<button aria-label="Refresh component data" class="refresh-btn">🔄</button>
<div role="status" aria-live="polite" class="loading">Loading...</div>
```

## Performance Standards

### 1. Lazy Loading
- Components should load content on-demand
- Use intersection observers for viewport-based loading
- Implement virtual scrolling for large lists

### 2. Caching
- Cache API responses for 5 minutes by default
- Use localStorage for user preferences
- Implement stale-while-revalidate pattern

### 3. Optimization
- Minimize DOM manipulation
- Use document fragments for batch updates
- Debounce user input events

## Integration Standards

### 1. API Integration
- All API endpoints must follow RESTful conventions
- Use consistent error response format
- Implement proper HTTP status codes

### 2. WebSocket Integration
- Use WebSocket for real-time updates
- Implement reconnection logic
- Handle connection state gracefully

### 3. Orchestrator Integration
- Components should integrate with workflow orchestrator
- Use standardized data exchange format
- Implement workflow triggers consistently

## Testing Standards

### 1. Component Testing
- Each component should have unit tests
- Test loading, error, and success states
- Verify accessibility compliance

### 2. Integration Testing
- Test API integration
- Verify WebSocket functionality
- Test orchestrator integration

This document serves as the definitive guide for all CodeMind dashboard components. All new components must adhere to these standards, and existing components should be updated to match.