// SafeGuard Content Filter - Content Script
// Runs on each web page to analyze content, block harmful pages, and blur sensitive images

// Flag to control filtering
let isFilteringEnabled = true;

// Store blurred images data
const blurredImages = new Map();

// Initialize content script
async function initialize() {
  // Get extension settings
  const settings = await chrome.storage.sync.get();

  // Skip if extension is not set up yet
  if (!settings.isSetup) return;

  // Analyze page content when it loads
  analyzePageOnLoad();

  // Set up observers to handle dynamic content
  setupMutationObserver();

  // Set up click handlers for blurred images
  setupClickHandlers();
}

// Analyze the current page content
async function analyzePageOnLoad() {
  // Extract text content from the page
  const pageContent = extractPageContent();

  // Send content to background script for analysis
  const analysisResult = await chrome.runtime.sendMessage({
    type: 'ANALYZE_PAGE_CONTENT',
    content: pageContent
  });

  // Handle the result
  if (analysisResult.isHarmful) {
    handleHarmfulContent(analysisResult);
  } else {
    // Still scan for images to blur
    scanAndBlurImages(analysisResult.harmfulKeywords || []);
  }
}

// Extract relevant content from the page
function extractPageContent() {
  // Get page text content
  const bodyText = document.body ? document.body.innerText : '';
  const title = document.title || '';

  // Get meta tags content
  const metaTags = Array.from(document.querySelectorAll('meta[name="description"], meta[name="keywords"]'));
  const metaContent = metaTags.map(tag => tag.getAttribute('content')).join(' ');

  return {
    url: window.location.href,
    title: title,
    text: `${title} ${metaContent} ${bodyText}`.substring(0, 10000) // Limit size
  };
}

// Handle harmful content detection
function handleHarmfulContent(analysisResult) {
  // Enhanced approach for all browsers including incognito mode

  // Save original content in case user wants to view it later
  const originalTitle = document.title;
  const originalBody = document.body.innerHTML;

  try {
    // Clear the entire page content
    document.body.innerHTML = '';
    document.title = 'Content Blocked - SafeGuard Filter';

    // Add base styles directly to ensure they're applied
    const style = document.createElement('style');
    style.textContent = `
      body, html {
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
        background-color: #f8f9fa;
        color: #333;
      }
      .container {
        max-width: 800px;
        margin: 50px auto;
        padding: 30px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        text-align: center;
      }
      .warning-icon {
        margin: 20px auto;
      }
      h1 {
        color: #e74c3c;
        font-size: 28px;
        margin-bottom: 10px;
      }
      .reason {
        font-size: 18px;
        margin-bottom: 20px;
      }
      .details {
        text-align: left;
        margin: 20px 0;
        padding: 15px;
        background-color: #f8f9fa;
        border-radius: 5px;
      }
      .detail-item {
        margin: 10px 0;
      }
      .detail-label {
        font-weight: bold;
        display: inline-block;
        width: 150px;
      }
      .keyword {
        display: inline-block;
        background: #f1f1f1;
        padding: 3px 8px;
        margin: 2px;
        border-radius: 3px;
        font-size: 14px;
      }
      .actions {
        margin: 20px 0;
      }
      button {
        padding: 10px 20px;
        margin: 0 5px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        background-color: #3498db;
        color: white;
      }
      button.secondary {
        background-color: #95a5a6;
      }
      .educational-note {
        font-size: 14px;
        color: #7f8c8d;
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #eee;
      }
    `;
    document.head.appendChild(style);

    // Create block page content directly
    const container = document.createElement('div');
    container.className = 'container';

    // Shield logo
    container.innerHTML = `
      <div class="logo">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1177ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s7-8 7-12a5 5 0 0 0-5-5 5 5 0 0 0-4 2 5 5 0 0 0-6-2 5 5 0 0 0-2 10c0 4.09 6 11 10 13z"></path>
        </svg>
      </div>

      <h1>Content Blocked</h1>

      <div class="warning-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>

      <p class="reason" id="block-reason">${analysisResult.reason || 'This content has been blocked by SafeGuard Content Filter.'}</p>

      <div class="details">
        <div class="detail-item">
          <span class="detail-label">URL:</span>
          <span class="detail-value" id="blocked-url">${window.location.href}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Filter Category:</span>
          <span class="detail-value" id="filter-category">${analysisResult.category || 'Content Policy Violation'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Detected Keywords:</span>
          <div class="keywords-container" id="detected-keywords">
            ${(analysisResult.harmfulKeywords || []).map(keyword => 
              `<span class="keyword">${keyword}</span>`
            ).join(' ')}
          </div>
        </div>
      </div>

      <div class="actions">
        <button id="back-button" class="button secondary">Go Back</button>
        <button id="override-button" class="button primary">Admin Override</button>
      </div>

      <div class="educational-note">
        <p>Educational mode: If you believe this content was blocked in error or is being accessed for legitimate educational purposes, an administrator can use the override function.</p>
      </div>
    `;

    // Add the container to the page
    document.body.appendChild(container);

    // Add back button functionality
    const backButton = document.getElementById('back-button');
    if (backButton) {
      backButton.addEventListener('click', () => {
        window.history.back();
      });
    }

    // Add override button functionality
    const overrideButton = document.getElementById('override-button');
    if (overrideButton) {
      overrideButton.addEventListener('click', async () => {
        // Simple prompt-based password verification
        const enteredPassword = prompt('Enter admin password to view this content:');
        if (!enteredPassword) return;

        try {
          // Verify with background script
          const response = await chrome.runtime.sendMessage({
            type: 'VERIFY_PASSWORD',
            password: enteredPassword
          });

          if (response && response.success) {
            // Password is correct, restore original content
            document.title = originalTitle;
            document.body.innerHTML = originalBody;

            // Re-load scripts if needed
            const scripts = document.querySelectorAll('script');
            scripts.forEach(script => {
              if (script.src) {
                const newScript = document.createElement('script');
                newScript.src = script.src;
                document.head.appendChild(newScript);
              }
            });
          } else {
            alert('Incorrect password. Access denied.');
          }
        } catch (error) {
          console.error('Password verification error:', error);
          alert('An error occurred. Please try again.');
        }
      });
    }
  } catch (error) {
    console.error('Error creating block page:', error);

    // Ultra-simple fallback that should work in any browser
    document.body.innerHTML = `
      <div style="padding: 20px; text-align: center; font-family: sans-serif;">
        <h1 style="color: #e74c3c;">Access Blocked</h1>
        <p>This content has been blocked by SafeGuard Content Filter.</p>
        <p>Reason: ${analysisResult.reason || 'Harmful content detected'}</p>
        <button onclick="window.history.back()" style="padding: 8px 16px; margin-top: 20px; background: #95a5a6; color: white; border: none; border-radius: 5px; cursor: pointer;">Go Back</button>
      </div>
    `;
  }
}

// Set up mutation observer to watch for DOM changes
function setupMutationObserver() {
  // Create a mutation observer to detect new content
  const observer = new MutationObserver((mutations) => {
    // Check if new images have been added
    const newImages = [];

    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          // If node is an image
          if (node.nodeName === 'IMG') {
            newImages.push(node);
          }
          // If node could contain images
          else if (node.nodeType === Node.ELEMENT_NODE) {
            const images = node.querySelectorAll('img');
            newImages.push(...images);
          }
        });
      }
    });

    // Process new images if any were found
    if (newImages.length > 0) {
      processNewImages(newImages);
    }
  });

  // Start observing the document with configured parameters
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // Also listen for custom event from background script
  document.addEventListener('safeguard-analyze', () => {
    // Rescan the page content
    analyzePageOnLoad();
  });
}

// Process newly added images
function processNewImages(images) {
  // Get all keywords from surrounding text
  const pageKeywords = extractKeywordsFromPage();

  // Check each image
  images.forEach(img => {
    // Skip if already processed
    if (img.dataset.safeguardProcessed) return;

    // Mark as processed to avoid duplicates
    img.dataset.safeguardProcessed = 'true';

    // Check if image should be blurred
    const shouldBlur = shouldBlurImage(img, pageKeywords);

    if (shouldBlur) {
      blurImage(img);
    }
  });
}

// Extract keywords from page content
function extractKeywordsFromPage() {
  // Get text near images
  const textContent = document.body.innerText.toLowerCase();

  // Define sensitive keywords for different categories
  const sensitiveKeywords = {
    nsfw: ['nude', 'naked', 'porn', 'xxx', 'sex', 'adult', 'nsfw'],
    violence: ['gore', 'blood', 'violent', 'crime', 'murder', 'dead body'],
    suicide: ['suicide', 'self harm', 'kill myself', 'hanging']
  };

  // Collect keywords found on the page
  const foundKeywords = [];

  Object.values(sensitiveKeywords).forEach(category => {
    category.forEach(keyword => {
      if (textContent.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    });
  });

  return foundKeywords;
}

// Determine if an image should be blurred based on context
function shouldBlurImage(img, pageKeywords) {
  // Skip small images (like icons)
  if (img.width < 100 || img.height < 100) return false;

  // Check image alt text and surrounding text
  const altText = (img.alt || '').toLowerCase();
  const parentText = img.parentElement ? img.parentElement.innerText.toLowerCase() : '';

  // Check for sensitive keywords in alt text
  for (const keyword of pageKeywords) {
    if (altText.includes(keyword) || parentText.includes(keyword)) {
      return true;
    }
  }

  // Get text within 200 characters of the image
  const nearbyText = getNearbyText(img, 200);

  // Check for sensitive keywords in nearby text
  for (const keyword of pageKeywords) {
    if (nearbyText.includes(keyword)) {
      return true;
    }
  }

  return false;
}

// Get text near an image element
function getNearbyText(element, charLimit) {
  // Get parent node
  const parent = element.parentElement;
  if (!parent) return '';

  // Get text from parent and siblings
  let text = parent.innerText || '';

  // Get text from previous and next siblings
  const prevSibling = element.previousElementSibling;
  const nextSibling = element.nextElementSibling;

  if (prevSibling) text += ' ' + (prevSibling.innerText || '');
  if (nextSibling) text += ' ' + (nextSibling.innerText || '');

  // Trim and limit length
  text = text.toLowerCase().trim();
  return text.length > charLimit ? text.substring(0, charLimit) : text;
}

// Blur a sensitive image
function blurImage(img) {
  // Wait for image to load to get proper dimensions
  if (!img.complete) {
    img.addEventListener('load', () => {
      applyBlurToLoadedImage(img);
    });

    // If image fails to load, still apply blurring
    img.addEventListener('error', () => {
      applyBlurToLoadedImage(img);
    });
  } else {
    applyBlurToLoadedImage(img);
  }
}

// Apply blur to an image that has loaded
function applyBlurToLoadedImage(img) {
  // Skip if already processed
  if (img.dataset.safeguardBlurred) return;
  img.dataset.safeguardBlurred = 'true';

  // Store original image data
  const imageId = 'safeguard-' + Math.random().toString(36).substring(2, 15);
  const imgRect = img.getBoundingClientRect();

  // Use actual dimensions if available, fallback to rect dimensions,
  // final fallback to reasonable defaults
  const width = img.naturalWidth || imgRect.width || img.width || 300;
  const height = img.naturalHeight || imgRect.height || img.height || 200;

  blurredImages.set(imageId, {
    src: img.src,
    alt: img.alt,
    width: width,
    height: height
  });

  // Create clone of the image to preserve all attributes
  const imgClone = img.cloneNode(true);

  // Create wrapper with exact dimensions of original image
  const wrapper = document.createElement('div');
  wrapper.className = 'safeguard-blur-wrapper';
  wrapper.style.position = 'relative';
  wrapper.style.display = 'inline-block';
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.overflow = 'hidden';
  wrapper.style.borderRadius = '4px';

  // Apply blur to image clone
  imgClone.style.filter = 'blur(15px)';
  imgClone.style.opacity = '0.8';  // Reduce opacity as requested
  imgClone.style.width = '100%';
  imgClone.style.height = '100%';
  imgClone.style.objectFit = 'cover';

  // Simple overlay with reduced styles for better performance
  const overlay = document.createElement('div');
  overlay.className = 'safeguard-blur-overlay';
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';  // Semi-transparent overlay
  overlay.style.color = 'white';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.textAlign = 'center';
  overlay.style.padding = '10px';

  // Simple warning message
  const warningText = document.createElement('p');
  warningText.textContent = 'Sensitive Content';
  warningText.style.margin = '0 0 10px 0';
  warningText.style.fontSize = '16px';
  warningText.style.fontWeight = 'bold';

  // View button - simpler styling
  const viewButton = document.createElement('button');
  viewButton.textContent = 'Show Image';
  viewButton.dataset.imageId = imageId;
  viewButton.className = 'safeguard-view-button';

  // Basic button styling without animations
  Object.assign(viewButton.style, {
    padding: '8px 16px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px'
  });

  // Add elements to DOM in proper hierarchy
  overlay.appendChild(warningText);
  overlay.appendChild(viewButton);
  wrapper.appendChild(imgClone);
  wrapper.appendChild(overlay);

  // Replace original image with our wrapper
  if (img.parentNode) {
    img.parentNode.replaceChild(wrapper, img);
  }
}

// Set up click handlers for blurred images
function setupClickHandlers() {
  // Use event delegation for better performance
  document.addEventListener('click', async (event) => {
    // Check if click was on a view button
    if (event.target.classList.contains('safeguard-view-button') || 
        event.target.tagName === 'BUTTON' && event.target.textContent === 'Show Image') {

      // Get image ID from dataset
      const imageId = event.target.dataset.imageId;
      if (!imageId || !blurredImages.has(imageId)) return;

      try {
        // Get extension settings - implementation using the simple approach
        const settings = await chrome.storage.sync.get();

        // Implementation based on provided code
        const enteredPassword = prompt('Enter extension password to view this image:');

        // Handle password verification - using simple comparison approach
        await handlePasswordVerification(enteredPassword, settings, imageId, event.target);
      } catch (error) {
        console.error('Error handling image unblur:', error);
        alert('An error occurred. Please try again.');
      }
    }
  });
}

// Handle password verification using the simple approach
async function handlePasswordVerification(enteredPassword, settings, imageId, buttonElement) {
  try {
    // Simple hash function for password matching
    const simpleHash = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash.toString();
    };

    // Get the correct hash from settings
    const correctHash = settings.password;

    // Compare hashed passwords
    const hashedInput = enteredPassword ? simpleHash(enteredPassword) : '';

    // If not password protected, no password set, or passwords match
    if (!settings.isPasswordProtected || !correctHash || hashedInput === correctHash) {
      // Get the image from our blurred images map
      const imageData = blurredImages.get(imageId);
      if (!imageData) return;

      // Find the img element
      const img = buttonElement.parentNode.querySelector('img');
      if (img) {
        // Remove blur filter
        img.style.filter = 'none';

        // Remove the button
        buttonElement.remove();
      }
    } else {
      // Show error message
      alert('Incorrect password.');
    }
  } catch (error) {
    console.error('Password verification error:', error);
    alert('An error occurred while verifying the password.');
  }
}

// Show password prompt
function promptForPassword(imageId, buttonElement) {
  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'safeguard-password-modal-overlay';
  Object.assign(modalOverlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: '99999'
  });

  // Create simple modal container
  const modal = document.createElement('div');
  modal.className = 'safeguard-password-modal';
  Object.assign(modal.style, {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '6px',
    width: '300px',
    maxWidth: '90%',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
  });

  // Modal header
  const header = document.createElement('h3');
  header.textContent = 'Password Required';
  Object.assign(header.style, {
    margin: '0 0 15px 0',
    color: '#333',
    fontSize: '18px',
    fontWeight: 'bold',
    textAlign: 'center'
  });

  // Password input
  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.placeholder = 'Enter password';
  Object.assign(passwordInput.style, {
    width: '100%',
    padding: '10px',
    marginBottom: '15px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    boxSizing: 'border-box'
  });

  // Error message (hidden by default)
  const errorMsg = document.createElement('p');
  Object.assign(errorMsg.style, {
    color: 'red',
    margin: '0 0 15px 0',
    fontSize: '12px',
    textAlign: 'center',
    display: 'none'
  });
  errorMsg.textContent = 'Incorrect password';

  // Button container
  const buttonContainer = document.createElement('div');
  Object.assign(buttonContainer.style, {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px'
  });

  // Submit button
  const submitButton = document.createElement('button');
  submitButton.textContent = 'Unlock';
  Object.assign(submitButton.style, {
    flex: '1',
    padding: '8px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  });

  // Cancel button
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  Object.assign(cancelButton.style, {
    flex: '1',
    padding: '8px',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  });

  // Add buttons to container
  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(submitButton);

  // Add elements to modal
  modal.appendChild(header);
  modal.appendChild(passwordInput);
  modal.appendChild(errorMsg);
  modal.appendChild(buttonContainer);

  // Add modal to overlay
  modalOverlay.appendChild(modal);

  // Add overlay to body
  document.body.appendChild(modalOverlay);

  // Focus password input
  passwordInput.focus();

  // Submit button handler
  submitButton.addEventListener('click', async () => {
    const password = passwordInput.value;
    if (!password) {
      // Show error for empty password
      errorMsg.textContent = 'Please enter a password';
      errorMsg.style.display = 'block';
      return;
    }

    // Disable button during verification
    submitButton.disabled = true;
    submitButton.textContent = 'Verifying...';

    // Send authentication request
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'AUTHENTICATE',
        password
      });

      if (response.success) {
        // If successful, remove dialog and unblur image
        document.body.removeChild(modalOverlay);
        unblurImage(imageId, buttonElement);
      } else {
        // Show error message
        errorMsg.textContent = 'Incorrect password. Please try again.';
        errorMsg.style.display = 'block';

        // Reset button
        submitButton.disabled = false;
        submitButton.textContent = 'Unlock';
      }
    } catch (error) {
      // Handle any errors
      console.error('Authentication error:', error);
      errorMsg.textContent = 'An error occurred. Please try again.';
      errorMsg.style.display = 'block';

      // Reset button
      submitButton.disabled = false;
      submitButton.textContent = 'Unlock';
    }
  });

  // Cancel button handler
  cancelButton.addEventListener('click', () => {
    document.body.removeChild(modalOverlay);
  });

  // Enter key handler
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitButton.click();
    }
  });

  // Close on click outside
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      document.body.removeChild(modalOverlay);
    }
  });
}

// Unblur an image after authentication - simplified version
function unblurImage(imageId, buttonElement) {
  // Get image data
  const imageData = blurredImages.get(imageId);
  if (!imageData) return;

  // Find the wrapper element
  const wrapper = buttonElement.closest('.safeguard-blur-wrapper');
  if (!wrapper) return;

  try {
    // Create a new unblurred image
    const newImg = document.createElement('img');
    newImg.src = imageData.src;
    newImg.alt = imageData.alt || '';
    newImg.width = imageData.width;
    newImg.height = imageData.height;
    newImg.style.display = 'block';

    // Replace wrapper with original image
    if (wrapper.parentNode) {
      wrapper.parentNode.replaceChild(newImg, wrapper);
    }

    // Record this action for stats
    chrome.runtime.sendMessage({
      type: 'RECORD_IMAGE_UNBLUR',
      imageUrl: imageData.src
    }).catch(err => console.log('Error recording unblur:', err));

  } catch (error) {
    console.error('Error unblurring image:', error);

    // Simple fallback if the main method fails
    try {
      // Find the image element
      const blurredImg = wrapper.querySelector('img');
      if (blurredImg) {
        // Just remove the blur filter
        blurredImg.style.filter = 'none';

        // Hide the overlay
        const overlay = wrapper.querySelector('.safeguard-blur-overlay');
        if (overlay) {
          overlay.style.display = 'none';
        }
      }
    } catch (fallbackError) {
      console.error('Fallback unblur failed:', fallbackError);
    }
  }

  // Remove from blurred images map
  blurredImages.delete(imageId);
}

// Scan and blur images on the page using the provided approach
async function scanAndBlurImages(harmfulKeywords) {
  // Get extension settings
  let extensionSettings;
  try {
    const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    extensionSettings = settingsResponse.settings || {};
  } catch (error) {
    console.error('Error getting extension settings:', error);
    extensionSettings = { sensitivity: 'medium' };
  }

  // Implementation based on the provided code
  const images = document.querySelectorAll('img:not([data-safeguard-processed])');
  const unsafeKeywords = ['xxx', 'porn', 'violence', 'suicide', 'self-harm', 'attack'];

  // Define sensitivity thresholds
  const sensitivityThresholds = {
    low: 0.85,
    medium: 0.75,
    high: 0.60
  };

  // Get threshold based on settings
  const threshold = sensitivityThresholds[extensionSettings.sensitivity || 'medium'];

  // Process each image
  Array.from(images).forEach(img => {
    // Mark as processed
    img.dataset.safeguardProcessed = 'true';

    const imgAlt = img.alt?.toLowerCase() || '';
    const imgSrc = img.src?.toLowerCase() || '';

    // Skip base64/blob images
    if (img.src.startsWith('data:') || img.src.startsWith('blob:')) return;

    // Check keywords from context and image attributes
    let shouldBlur = false;

    // Check specific unsafe keywords
    shouldBlur = unsafeKeywords.some(keyword =>
      imgAlt.includes(keyword) || imgSrc.includes(keyword)
    );

    // Check harmful keywords detected by backend
    if (!shouldBlur && harmfulKeywords && harmfulKeywords.length > 0) {
      shouldBlur = harmfulKeywords.some(keyword => 
        imgAlt.includes(keyword) || imgSrc.includes(keyword)
      );
    }

    // Check surrounding text context
    if (!shouldBlur) {
      shouldBlur = shouldBlurImage(img, [...unsafeKeywords, ...(harmfulKeywords || [])]);
    }

    // Apply blurring if needed
    if (shouldBlur) {
      applySimpleImageBlur(img);
    }
  });
}

// Apply the simple blurring approach from the provided code
function applySimpleImageBlur(img) {
  // Don't process already blurred images
  if (img.dataset.safeguardBlurred) return;
  img.dataset.safeguardBlurred = 'true';

  // Generate unique ID for this blurred image
  const imageId = 'safeguard-' + Math.random().toString(36).substring(2, 15);

  // Store original image data
  blurredImages.set(imageId, {
    src: img.src,
    alt: img.alt,
    width: img.width || 300,
    height: img.height || 200
  });

  // Wrap image in a container
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.display = 'inline-block';

  // Keep original dimensions
  if (img.width && img.height) {
    wrapper.style.width = `${img.width}px`;
    wrapper.style.height = `${img.height}px`;
  }

  const parent = img.parentNode;
  if (parent) {
    parent.insertBefore(wrapper, img);
    wrapper.appendChild(img);
  }

  // Blur the image
  img.style.filter = 'blur(10px)';
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.transition = 'filter 0.3s ease';

  // Create unlock button
  const button = document.createElement('button');
  button.textContent = 'Show Image';
  button.dataset.imageId = imageId;
  button.className = 'safeguard-view-button';

  Object.assign(button.style, {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: '9999',
    backgroundColor: '#000',
    color: '#fff',
    padding: '6px 10px',
    borderRadius: '5px',
    border: 'none',
    cursor: 'pointer',
    opacity: '0.85'
  });

  wrapper.appendChild(button);
}

// Enhanced image blur detection based on provided code
function shouldBlurImageAdvanced(img, settings, unsafeKeywords) {
  const imgAlt = img.alt?.toLowerCase() || '';
  const imgSrc = img.src?.toLowerCase() || '';

  // Skip base64/blob images
  if (img.src.startsWith('data:') || img.src.startsWith('blob:')) return false;

  // Sensitivity thresholds from provided code
  const sensitivityThresholds = {
    low: 0.85,
    medium: 0.75,
    high: 0.60
  };

  // Get threshold based on settings
  const threshold = sensitivityThresholds[settings.sensitivity || 'medium'];

  // Check if any unsafe keywords are in the alt text or image source
  return unsafeKeywords.some(keyword =>
    imgAlt.includes(keyword) || imgSrc.includes(keyword)
  );
}

// Initialize immediately and also on DOM content loaded
initialize();
document.addEventListener('DOMContentLoaded', initialize);

// Re-run analysis when navigation completes
window.addEventListener('load', () => {
  analyzePageOnLoad();
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REFRESH_FILTERING') {
    isFilteringEnabled = message.enabled;
    // Re-analyze page if filtering is enabled
    if (isFilteringEnabled) {
      analyzePageOnLoad();
    }
    sendResponse({ success: true });
  }
  return true;
});