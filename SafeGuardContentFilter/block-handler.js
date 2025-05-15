// SafeGuard Content Filter - Block Page Handler

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const reason = urlParams.get('reason');
const keywords = urlParams.get('keywords');
const url = urlParams.get('url');
const domain = urlParams.get('domain');
const query = urlParams.get('query');
const category = urlParams.get('category');

// DOM elements
const blockReason = document.getElementById('block-reason');
const blockedUrl = document.getElementById('blocked-url');
const filterCategory = document.getElementById('filter-category');
const detectedKeywords = document.getElementById('detected-keywords');
const backButton = document.getElementById('back-button');
const overrideButton = document.getElementById('override-button');
const passwordModal = document.getElementById('password-modal');
const adminPassword = document.getElementById('admin-password');
const authError = document.getElementById('auth-error');
const cancelButton = document.getElementById('cancel-button');
const submitButton = document.getElementById('submit-button');

// Display block reason
if (reason) {
    blockReason.textContent = reason;
}

// Display blocked URL
if (url) {
    blockedUrl.textContent = url;
} else if (domain) {
    blockedUrl.textContent = domain;
} else if (query) {
    blockedUrl.textContent = 'Search query: ' + query;
}

// Display keywords as pills
if (keywords) {
    const keywordsList = keywords.split(',');
    
    // Create keywords pills
    keywordsList.forEach(keyword => {
        if (keyword.trim()) {
            const pill = document.createElement('span');
            pill.className = 'keyword-pill';
            pill.textContent = keyword.trim();
            detectedKeywords.appendChild(pill);
        }
    });
} else {
    // Hide keywords section if none detected
    document.querySelector('.detected-keywords').style.display = 'none';
}

// Set filter category based on the category parameter from the URL
if (category) {
    switch (category.toLowerCase()) {
        case 'nsfw':
            filterCategory.textContent = 'NSFW Content';
            break;
        case 'violence':
            filterCategory.textContent = 'Violence';
            break;
        case 'suicide':
            filterCategory.textContent = 'Self-harm & Suicide';
            break;
        default:
            filterCategory.textContent = 'Potentially Harmful Content';
    }
} else {
    // Fallback to keyword-based detection if no category provided
    if (keywords) {
        const keywordsList = keywords.split(',');
        
        if (keywordsList.some(k => ['porn', 'nude', 'xxx', 'sex', 'naked'].includes(k.toLowerCase()))) {
            filterCategory.textContent = 'NSFW Content';
        } else if (keywordsList.some(k => ['violence', 'gore', 'blood', 'murder', 'kill'].includes(k.toLowerCase()))) {
            filterCategory.textContent = 'Violence';
        } else if (keywordsList.some(k => ['suicide', 'self-harm', 'kill myself'].includes(k.toLowerCase()))) {
            filterCategory.textContent = 'Self-harm & Suicide';
        } else {
            filterCategory.textContent = 'Potentially Harmful Content';
        }
    } else {
        filterCategory.textContent = 'Potentially Harmful Content';
    }
}

// Back button handler
backButton.addEventListener('click', () => {
    history.back();
});



// Cancel button handler
cancelButton.addEventListener('click', () => {
    // Hide password modal
    passwordModal.classList.add('hidden');
    adminPassword.value = '';
    authError.classList.add('hidden');
});

// Submit button handler
submitButton.addEventListener('click', async () => {
    const password = adminPassword.value;
    if (!password) return;
    
    try {
        // Authenticate with background script
        const response = await chrome.runtime.sendMessage({
            type: 'AUTHENTICATE',
            password
        });
        
        if (response.success) {
            // Authentication successful, allow access to content
            if (url) {
                // Navigate to the original URL
                window.location.href = url;
            } else {
                // Go back if we can't redirect to specific URL
                history.back();
            }
        } else {
            // Authentication failed
            authError.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Authentication error:', error);
        authError.textContent = 'An error occurred. Please try again.';
        authError.classList.remove('hidden');
    }
});

// Enter key handler for password input
adminPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        submitButton.click();
    }
});