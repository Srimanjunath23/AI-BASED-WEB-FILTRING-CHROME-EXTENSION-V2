// SafeGuard Content Filter - Background Script
// Handles background tasks like tab monitoring, search query filtering, and VPN detection

// Backend API endpoint
const API_ENDPOINT = "http://localhost:8000"; // For local development

// Flag to track if extension is active
let isExtensionActive = true;
// Track if user is authenticated for this session
let isAuthenticated = false;
// Track if content script is authenticated (for image unblur)
let sessionAuthenticated = false;
// Authentication session timeout (in milliseconds) - 30 minutes
const AUTH_TIMEOUT = 30 * 60 * 1000;
// Time when authentication expires
let authExpirationTime = 0;

// Initialize storage on extension startup
chrome.runtime.onInstalled.addListener(async () => {
  // Get existing settings first
  const existingSettings = await chrome.storage.sync.get();
  
  // Default settings
  const defaultSettings = {
    filterNSFW: true,
    filterViolence: true,
    filterSuicide: true,
    sensitivityLevel: 'medium', // low, medium, high
    educationalMode: true,
    password: existingSettings.password || '', // Preserve existing password
    isSetup: existingSettings.isSetup || false,
  };

  // Set default settings in storage
  await chrome.storage.sync.set(defaultSettings);
  
  // Check if password is set; if not, open setup page
  const settings = await chrome.storage.sync.get(['isSetup', 'password']);
  if (!settings.isSetup || !settings.password) {
    // Open popup for initial setup
    chrome.action.openPopup();
  }
});

// Intercept and analyze web requests
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Skip non-main frame requests
  if (details.frameId !== 0) return;
  
  // Get settings
  const settings = await chrome.storage.sync.get();
  if (!settings.isSetup) return;
  
  // Check if extension is active
  if (!isExtensionActive) return;
  
  // Skip browser extension pages
  if (details.url.startsWith('chrome-extension://') || 
      details.url.startsWith('moz-extension://') || 
      details.url.startsWith('edge-extension://')) {
    return;
  }
  
  // Extract domain from URL
  const urlObj = new URL(details.url);
  const domain = urlObj.hostname;
  
  // Check for search engines and filter search queries
  if (isSearchEngine(domain)) {
    const searchQuery = extractSearchQuery(urlObj);
    if (searchQuery) {
      const queryResult = await analyzeSearchQuery(searchQuery, settings);
      if (queryResult.isHarmful) {
        // Block harmful search
        chrome.tabs.update(details.tabId, {
          url: chrome.runtime.getURL('block.html') + 
               `?reason=${encodeURIComponent('Harmful search detected')}` +
               `&query=${encodeURIComponent(searchQuery)}` +
               `&keywords=${encodeURIComponent(queryResult.keywords.join(','))}` +
               `&category=${encodeURIComponent(queryResult.category || 'inappropriate')}`
        });
      }
    }
  }
  
  // Check for known harmful domains
  const domainResult = await checkBlockedDomain(domain, settings);
  if (domainResult.isBlocked) {
    chrome.tabs.update(details.tabId, {
      url: chrome.runtime.getURL('block.html') + 
           `?reason=${encodeURIComponent('Blocked website')}` +
           `&domain=${encodeURIComponent(domain)}` +
           `&keywords=${encodeURIComponent(domainResult.pattern || '')}` +
           `&category=${encodeURIComponent(domainResult.category || 'inappropriate')}`
    });
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle different message types
  switch (message.type) {
    case 'GET_SETTINGS':
      // Get settings for popup or content script
      chrome.storage.sync.get(null, (settings) => {
        // Convert storage format to popup format
        const popupSettings = {
          enabled: isExtensionActive,
          nsfwFilter: settings.filterNSFW || true,
          violenceFilter: settings.filterViolence || true,
          suicideFilter: settings.filterSuicide || true,
          educationalMode: settings.educationalMode || true,
          sensitivity: settings.sensitivityLevel || 'medium',
          isPasswordProtected: !!settings.password,
          password: settings.password || ''
        };
        sendResponse({ success: true, settings: popupSettings });
      });
      return true; // Keeps the message channel open for async response
    
    case 'UPDATE_SETTINGS':
      // Update settings from popup
      const popupSettings = message.settings;
      isExtensionActive = popupSettings.enabled;
      
      // Convert popup format to storage format
      const storageSettings = {
        filterNSFW: popupSettings.nsfwFilter,
        filterViolence: popupSettings.violenceFilter,
        filterSuicide: popupSettings.suicideFilter,
        educationalMode: popupSettings.educationalMode,
        sensitivityLevel: popupSettings.sensitivity,
        password: popupSettings.password, // Keep existing password
        isSetup: true
      };
      
      chrome.storage.sync.set(storageSettings, () => {
        sendResponse({ success: true });
      });
      return true;
    
    case 'AUTHENTICATE':
      // Verify password from content script for unblurring images
      (async () => {
        try {
          // Get stored password
          const settings = await chrome.storage.sync.get(['password']);
          
          // If no password is set or it's empty, authentication automatically succeeds
          if (!settings.password) {
            sessionAuthenticated = true;
            sendResponse({ success: true });
            return;
          }
          
          // Verify provided password
          const isValid = await verifyPassword(message.password);
          
          // If valid, set authenticated flag
          if (isValid) {
            sessionAuthenticated = true;
          }
          
          sendResponse({ success: isValid });
        } catch (error) {
          console.error('Authentication error:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true; // Keep connection open for async response
      
    case 'CHECK_AUTH':
      // Check if user is already authenticated for this session (for image unblurring)
      sendResponse({ isAuthenticated: sessionAuthenticated });
      return false; // Synchronous response
      
    case 'VERIFY_PASSWORD':
      verifyPassword(message.password)
        .then(result => {
          if (result) {
            isAuthenticated = true;
            authExpirationTime = Date.now() + AUTH_TIMEOUT;
          }
          sendResponse({ success: result });
        });
      return true;
    
    case 'SET_PASSWORD':
      (async () => {
        try {
          // Get current settings
          const settings = await chrome.storage.sync.get(['password']);
          let success = true;
          let error = null;
          
          // If there's an existing password, verify the current password
          if (settings.password && message.currentPassword) {
            const isValid = await verifyPassword(message.currentPassword);
            if (!isValid) {
              success = false;
              error = 'Current password is incorrect';
            }
          }
          
          if (success) {
            try {
              const hashedPassword = await hashPasswordString(message.newPassword);
              
              // Update password in storage
              await chrome.storage.sync.set({ password: hashedPassword });
              
              sendResponse({ 
                success: true, 
                hashedPassword: hashedPassword 
              });
            } catch (error) {
              console.error("Error processing password:", error);
              sendResponse({ 
                success: false, 
                error: 'Error processing password' 
              });
            }
          } else {
            sendResponse({ success: false, error: error });
          }
        } catch (err) {
          console.error("Password update error:", err);
          sendResponse({ success: false, error: 'An unexpected error occurred' });
        }
      })();
      return true;
    
    case 'CHECK_PASSWORD':
      verifyPassword(message.password)
        .then(result => sendResponse({ isValid: result }));
      return true;
    
    case 'AUTHENTICATE':
      verifyPassword(message.password)
        .then(result => {
          if (result) {
            isAuthenticated = true;
            authExpirationTime = Date.now() + AUTH_TIMEOUT;
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Invalid password' });
          }
        });
      return true;
    
    case 'CHECK_AUTH':
      // Check if authentication is still valid
      if (isAuthenticated && Date.now() < authExpirationTime) {
        sendResponse({ isAuthenticated: true });
      } else {
        isAuthenticated = false;
        sendResponse({ isAuthenticated: false });
      }
      return true;
    
    case 'TOGGLE_EXTENSION':
      if (isAuthenticated && Date.now() < authExpirationTime) {
        isExtensionActive = message.active;
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Authentication required' });
      }
      return true;
    
    case 'ANALYZE_PAGE_CONTENT':
      analyzePageContent(message.content, sender.tab.id)
        .then(result => sendResponse(result));
      return true;
      
    case 'RECORD_IMAGE_UNBLUR':
      // Record statistics for unblurred images
      try {
        chrome.storage.sync.get(['statsImagesUnblurred'], (result) => {
          const count = (result.statsImagesUnblurred || 0) + 1;
          chrome.storage.sync.set({ statsImagesUnblurred: count });
          
          // Also record image URL in activity logs if URL is available
          if (message.imageUrl) {
            const now = new Date().toISOString();
            const logEntry = {
              type: 'image_unblur',
              timestamp: now,
              url: message.imageUrl
            };
            
            chrome.storage.local.get(['activityLogs'], (data) => {
              const logs = data.activityLogs || [];
              logs.unshift(logEntry); // Add to beginning
              
              // Keep only the last 100 entries
              const trimmedLogs = logs.slice(0, 100);
              chrome.storage.local.set({ activityLogs: trimmedLogs });
            });
          }
        });
      } catch (error) {
        console.error('Error recording image unblur stats:', error);
      }
      return false;
    
    case 'DETECT_VPN':
      detectVPN().then(result => sendResponse(result));
      return true;
  }
});

// Function to check if domain is a search engine
function isSearchEngine(domain) {
  const searchEngines = [
    'google.com', 'www.google.com',
    'bing.com', 'www.bing.com',
    'yahoo.com', 'search.yahoo.com',
    'duckduckgo.com', 'www.duckduckgo.com',
    'yandex.com', 'www.yandex.com',
    'baidu.com', 'www.baidu.com'
  ];
  
  return searchEngines.some(engine => domain.endsWith(engine));
}

// Extract search query from URL
function extractSearchQuery(urlObj) {
  // Different search engines use different query parameters
  const searchParams = urlObj.searchParams;
  const possibleParams = ['q', 'query', 'search', 'p', 'text'];
  
  for (const param of possibleParams) {
    const value = searchParams.get(param);
    if (value) return value;
  }
  
  return null;
}

// Analyze search query for harmful intent
async function analyzeSearchQuery(query, settings) {
  try {
    // First do basic keyword matching for instant filtering
    const harmfulKeywords = {
      nsfw: ['porn', 'xxx', 'sex video', 'nude', 'naked', 'onlyfans'],
      violence: ['how to kill', 'murder', 'torture', 'fight video', 'gore'],
      suicide: ['how to commit suicide', 'kill myself', 'suicide methods']
    };
    
    // Check which filters are enabled
    const filters = [];
    if (settings.filterNSFW) filters.push('nsfw');
    if (settings.filterViolence) filters.push('violence');
    if (settings.filterSuicide) filters.push('suicide');
    
    // Track matched keywords and categories
    let isHarmful = false;
    const matchedKeywords = [];
    let matchedCategory = null;
    
    // Simple keyword matching
    for (const filter of filters) {
      for (const keyword of harmfulKeywords[filter]) {
        if (query.toLowerCase().includes(keyword)) {
          // Check for educational exceptions if educational mode is on
          if (settings.educationalMode) {
            const educationalTerms = [
              'education', 'research', 'study', 'paper', 'academic',
              'psychology', 'effects', 'impact', 'analysis', 'thesis',
              'treatment', 'addiction', 'prevention', 'awareness', 'health'
            ];
            
            const queryLower = query.toLowerCase();
            const hasEducationalContext = educationalTerms.some(term => queryLower.includes(term));
            
            if (hasEducationalContext) {
              // Skip this keyword match since it's likely educational
              continue;
            }
          }
          
          isHarmful = true;
          matchedKeywords.push(keyword);
          matchedCategory = filter;
          break;
        }
      }
      
      if (isHarmful) break;
    }
    
    // If already found harmful through simple method, return early with details
    if (isHarmful) {
      return {
        isHarmful: true,
        keywords: matchedKeywords,
        category: matchedCategory
      };
    }
    
    // For more nuanced queries, use the NLP API
    try {
      const response = await fetch(`${API_ENDPOINT}/analyze_query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          sensitivity: settings.sensitivityLevel,
          educational_mode: settings.educationalMode,
          filters
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        return {
          isHarmful: result.is_harmful,
          keywords: result.harmful_keywords || [],
          category: result.category || 'inappropriate'
        };
      }
    } catch (apiError) {
      console.error("API error during search query analysis:", apiError);
    }
    
    // If API fails or we passed all checks, return safe result
    return {
      isHarmful: false,
      keywords: [],
      category: null
    };
  } catch (error) {
    console.error("Error analyzing search query:", error);
    // On error, be conservative and allow the search
    return {
      isHarmful: false,
      keywords: [],
      category: null
    };
  }
}

// Check if a domain should be blocked
async function checkBlockedDomain(domain, settings) {
  // Known harmful domain patterns (partial matching)
  const knownHarmfulPatterns = {
    nsfw: ['porn', 'xxx', 'adult', 'nsfw'],
    violence: ['gore', 'violence', 'bestgore', 'fight'],
    suicide: ['suicide', 'selfharm']
  };
  
  // Check which filters are enabled
  const filters = [];
  if (settings.filterNSFW) filters.push('nsfw');
  if (settings.filterViolence) filters.push('violence');
  if (settings.filterSuicide) filters.push('suicide');
  
  // Check domain against harmful patterns
  let matchedCategory = null;
  let matchedPattern = null;
  
  for (const filter of filters) {
    for (const pattern of knownHarmfulPatterns[filter]) {
      if (domain.includes(pattern)) {
        return {
          isBlocked: true,
          category: filter,
          pattern: pattern
        };
      }
    }
  }
  
  // Check specific harmful domains
  try {
    const response = await fetch(`${API_ENDPOINT}/check_domain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        domain,
        sensitivity: settings.sensitivityLevel,
        filters
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      
      if (result.is_harmful) {
        return {
          isBlocked: true,
          category: result.category || 'inappropriate',
          pattern: result.matched_patterns ? result.matched_patterns[0] : domain
        };
      }
    }
  } catch (error) {
    console.error("Error checking domain against API:", error);
  }
  
  // If API check fails or returns not harmful, return false
  return {
    isBlocked: false,
    category: null,
    pattern: null
  };
}

// Analyze page content sent from content script
async function analyzePageContent(content, tabId) {
  try {
    const settings = await chrome.storage.sync.get();
    
    // Basic keyword detection in page content
    const harmfulKeywords = {
      nsfw: ['porn', 'xxx', 'nude', 'naked', 'sex', 'adult content'],
      violence: ['gore', 'violence', 'murder', 'kill', 'blood', 'graphic'],
      suicide: ['suicide', 'kill myself', 'how to die', 'end my life']
    };
    
    // Check which filters are enabled
    const filters = [];
    if (settings.filterNSFW) filters.push('nsfw');
    if (settings.filterViolence) filters.push('violence');
    if (settings.filterSuicide) filters.push('suicide');
    
    let isHarmful = false;
    let harmfulKeywordsFound = [];
    
    // Simple keyword matching
    for (const filter of filters) {
      for (const keyword of harmfulKeywords[filter]) {
        if (content.text.toLowerCase().includes(keyword)) {
          isHarmful = true;
          harmfulKeywordsFound.push(keyword);
        }
      }
    }
    
    // If harmful content detected, check for educational context if educational mode is on
    if (isHarmful && settings.educationalMode) {
      const educationalKeywords = [
        // General education terms
        'education', 'research', 'study', 'information', 'learn', 'article',
        'report', 'news', 'medical', 'health', 'science', 'history', 'academic',
        
        // Additional academic and research terms
        'effects', 'impact', 'paper', 'case study', 'studies', 'statistics',
        'psychological', 'analysis', 'assessment', 'correlation', 'comparison',
        'theory', 'evidence', 'data', 'findings', 'review', 'journal',
        
        // Subject-specific educational terms
        'neurological', 'psychology', 'therapy', 'counseling', 'prevention',
        'awareness', 'treatment', 'mental health', 'strategies', 'recovery',
        'behavior', 'cognitive', 'development', 'intervention',
        
        // Educational roles and institutions
        'school', 'university', 'college', 'classroom', 'teacher', 'student',
        'professor', 'counselor', 'program', 'curriculum'
      ];
      
      // Strong educational indicators get more weight
      const strongEducationalKeywords = [
        'research', 'study', 'paper', 'academic', 'psychology',
        'education', 'prevention', 'awareness', 'effects', 'impact'
      ];
      
      // Count educational context indicators
      let educationalScore = 0;
      const contentLower = content.text.toLowerCase();
      
      for (const keyword of educationalKeywords) {
        if (contentLower.includes(keyword)) {
          // Give more weight to strong educational indicators
          if (strongEducationalKeywords.includes(keyword)) {
            educationalScore += 2;
          } else {
            educationalScore += 1;
          }
        }
      }
      
      console.log(`Educational score for content: ${educationalScore}`);
      
      // Lower the threshold for educational content detection
      if (educationalScore >= 2) {
        console.log('Educational content detected, allowing content');
        isHarmful = false;
      }
    }
    
    // For more advanced analysis, use the API
    try {
      const response = await fetch(`${API_ENDPOINT}/analyze_content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: content.text.substring(0, 5000),  // Limit text size
          url: content.url,
          title: content.title,
          sensitivity: settings.sensitivityLevel,
          educational_mode: settings.educationalMode,
          filters
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        // API result overrides simple keyword matching
        return {
          isHarmful: result.is_harmful,
          reason: result.reason || 'Harmful content detected',
          category: result.category || 'inappropriate',
          harmfulKeywords: result.harmful_keywords || harmfulKeywordsFound
        };
      }
    } catch (error) {
      console.error("Error analyzing content with API:", error);
      // On API error, fall back to keyword matching
    }
    
    // Determine category based on matched keywords
    const category = determineCategory(harmfulKeywordsFound, filters);
    
    return {
      isHarmful,
      reason: 'Harmful keywords detected',
      category: category,
      harmfulKeywords: harmfulKeywordsFound
    };
  } catch (error) {
    console.error("Error in content analysis:", error);
    return { 
      isHarmful: false,
      reason: 'Analysis failed',
      category: 'error',
      harmfulKeywords: [],
      error: 'Analysis failed'
    };
  }
}

// Password hashing function
async function hashPasswordString(password) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Error hashing password:', error);
    throw error;
  }
}

// Verify password
async function verifyPassword(password) {
  try {
    // Get stored password hash from settings
    const settings = await chrome.storage.sync.get(['password']);
    if (!settings.password) return false;
    
    // Hash and compare the provided password
    const hashedPassword = await hashPasswordString(password);
    return hashedPassword === settings.password;
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
}

// Helper function to determine category from keywords (fallback when API fails)
function determineCategory(keywords, enabledFilters) {
  if (!keywords || keywords.length === 0) {
    return 'inappropriate';
  }
  
  // Define keyword categories
  const categoryKeywords = {
    nsfw: ['porn', 'xxx', 'nudity', 'naked', 'sex video', 'adult content', 'pornography', 'erotic', 'nsfw', 'explicit', 'onlyfans'],
    violence: ['violence', 'gore', 'blood', 'kill', 'murder', 'dead body', 'graphic violence', 'brutal', 'fight video', 'torture', 'death'],
    suicide: ['suicide', 'kill myself', 'self-harm', 'how to die', 'end my life', 'suicide methods', 'hanging myself', 'painless suicide']
  };
  
  // Count matches in each category
  const counts = {
    nsfw: 0,
    violence: 0,
    suicide: 0
  };
  
  // Only count categories that are enabled
  for (const keyword of keywords) {
    for (const category of enabledFilters) {
      if (categoryKeywords[category] && categoryKeywords[category].some(k => keyword.includes(k) || k.includes(keyword))) {
        counts[category]++;
      }
    }
  }
  
  // Find category with most matches
  let maxCategory = 'inappropriate';
  let maxCount = 0;
  
  for (const [category, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxCategory = category;
    }
  }
  
  return maxCategory;
}

// Detect VPN or proxy usage using WebRTC and IP geolocation
async function detectVPN() {
  try {
    // First check if WebRTC is available
    if (typeof RTCPeerConnection === 'undefined') {
      return { usingVPN: false, confidence: 'low' };
    }
    
    // Create a new connection
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    // Create a data channel and offer
    pc.createDataChannel('');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    // Wait for ICE candidates
    const ips = [];
    return new Promise((resolve) => {
      // Set a timeout for the check
      const timeout = setTimeout(() => {
        pc.close();
        resolve({ usingVPN: false, confidence: 'low' });
      }, 5000);
      
      // Listen for ICE candidates
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        
        // Extract IP addresses from ICE candidates
        const matches = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(e.candidate.candidate);
        if (matches && matches[1]) {
          ips.push(matches[1]);
        }
        
        // If we have multiple different IPs, it might indicate VPN
        if (ips.length > 1 && new Set(ips).size > 1) {
          clearTimeout(timeout);
          pc.close();
          resolve({ usingVPN: true, confidence: 'medium', ips });
        }
      };
      
      // When ICE gathering is complete
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          pc.close();
          
          // Multiple different IPs might indicate VPN
          const usingVPN = ips.length > 1 && new Set(ips).size > 1;
          resolve({ 
            usingVPN, 
            confidence: usingVPN ? 'medium' : 'low',
            ips
          });
        }
      };
    });
  } catch (error) {
    console.error("VPN detection error:", error);
    return { usingVPN: false, confidence: 'low', error: error.message };
  }
}

// Listen for tab creation or update to re-analyze content
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only run when page is loaded
  if (changeInfo.status === 'complete') {
    // Inject content script to analyze page
    chrome.scripting.executeScript({
      target: { tabId },
      function: () => {
        // This code runs in the context of the web page
        // It will trigger the content script's MutationObserver
        document.dispatchEvent(new CustomEvent('safeguard-analyze'));
      }
    }).catch(error => {
      // This might fail for restricted pages, which is expected
      console.log("Cannot execute script on this page:", error);
    });
  }
});
