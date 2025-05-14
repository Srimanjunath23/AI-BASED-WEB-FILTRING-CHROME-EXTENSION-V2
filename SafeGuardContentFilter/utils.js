/**
 * SafeGuard Content Filter - Utility Functions
 * Provides common utility functions used throughout the extension
 */

// Safely parse JSON
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('JSON parse error:', e);
    return null;
  }
}

// Check if a URL is a search engine results page
function isSearchResultsPage(url) {
  const searchEngines = [
    { domain: 'google.com', params: ['q'] },
    { domain: 'bing.com', params: ['q'] },
    { domain: 'yahoo.com', params: ['p'] },
    { domain: 'duckduckgo.com', params: ['q'] },
    { domain: 'yandex.com', params: ['text'] },
    { domain: 'baidu.com', params: ['wd', 'word'] }
  ];
  
  try {
    const urlObj = new URL(url);
    
    for (const engine of searchEngines) {
      if (urlObj.hostname.includes(engine.domain)) {
        for (const param of engine.params) {
          if (urlObj.searchParams.has(param)) {
            return {
              isSearch: true,
              query: urlObj.searchParams.get(param),
              engine: engine.domain
            };
          }
        }
      }
    }
    
    return { isSearch: false };
  } catch (e) {
    console.error('URL parsing error:', e);
    return { isSearch: false };
  }
}

// Extract text in proximity to an element
function getTextAroundElement(element, maxDistance = 200) {
  const walkNodes = (node, texts, distance = 0) => {
    // Stop if we've gone too far
    if (distance > maxDistance) return;
    
    // Get text from this node
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) texts.push(text);
    }
    
    // Check children
    if (node.childNodes && distance < maxDistance) {
      for (const child of node.childNodes) {
        walkNodes(child, texts, distance + 1);
      }
    }
    
    // Check siblings within distance
    if (distance < maxDistance / 2) {
      const nextSibling = node.nextSibling;
      if (nextSibling) walkNodes(nextSibling, texts, distance + 1);
    }
  };
  
  const texts = [];
  
  // Check the element itself
  if (element.nodeType === Node.TEXT_NODE) {
    texts.push(element.textContent.trim());
  }
  
  // Check parent
  if (element.parentNode) {
    walkNodes(element.parentNode, texts);
  }
  
  // Check previous siblings
  let sibling = element.previousSibling;
  let count = 0;
  while (sibling && count < 3) {
    walkNodes(sibling, texts);
    sibling = sibling.previousSibling;
    count++;
  }
  
  // Check next siblings
  sibling = element.nextSibling;
  count = 0;
  while (sibling && count < 3) {
    walkNodes(sibling, texts);
    sibling = sibling.nextSibling;
    count++;
  }
  
  return texts.join(' ');
}

// Extract keywords from text
function extractKeywords(text) {
  // Skip if no text
  if (!text) return [];
  
  // Convert to lowercase for case-insensitive matching
  const lowerText = text.toLowerCase();
  
  // Define categories of sensitive keywords
  const sensitiveTerms = {
    nsfw: [
      'porn', 'xxx', 'nude', 'naked', 'sex video', 'adult content',
      'pornography', 'erotic', 'nsfw', 'explicit', 'onlyfans'
    ],
    violence: [
      'violence', 'gore', 'blood', 'kill', 'murder', 'dead body',
      'graphic violence', 'brutal', 'fight video', 'torture', 'death'
    ],
    suicide: [
      'suicide', 'kill myself', 'self-harm', 'how to die', 'end my life',
      'suicide methods', 'hanging myself', 'painless suicide'
    ]
  };
  
  // Find matches
  const foundKeywords = {};
  
  for (const [category, keywords] of Object.entries(sensitiveTerms)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        if (!foundKeywords[category]) {
          foundKeywords[category] = [];
        }
        foundKeywords[category].push(keyword);
      }
    }
  }
  
  // Convert to array of unique keywords
  const result = [];
  for (const keywordsArray of Object.values(foundKeywords)) {
    for (const keyword of keywordsArray) {
      if (!result.includes(keyword)) {
        result.push(keyword);
      }
    }
  }
  
  return result;
}

// Check if an image should be blurred
function shouldBlurImage(img, surroundingText) {
  // Skip small icons
  if (img.width < 60 || img.height < 60) return false;
  
  // Check alt text
  const altText = img.alt || '';
  const keywords = extractKeywords(altText);
  
  if (keywords.length > 0) {
    return true;
  }
  
  // Check surrounding text if provided
  if (surroundingText) {
    const textKeywords = extractKeywords(surroundingText);
    return textKeywords.length > 0;
  }
  
  return false;
}

// Check if a domain is potentially harmful
function isPotentiallyHarmfulDomain(domain) {
  const harmfulPatterns = [
    'porn', 'xxx', 'adult', 'sex', 'nude', 'nsfw',
    'gore', 'violence', 'death', 'suicide', 'self-harm'
  ];
  
  const domainParts = domain.toLowerCase().split('.');
  
  for (const pattern of harmfulPatterns) {
    // Check each part of the domain
    for (const part of domainParts) {
      if (part === pattern || part.includes(pattern)) {
        return true;
      }
    }
  }
  
  return false;
}

// Blur an image element
function applyBlurToImage(img) {
  // Get original styles
  const computedStyle = window.getComputedStyle(img);
  const originalStyles = {
    width: computedStyle.width,
    height: computedStyle.height,
    display: computedStyle.display
  };
  
  // Save original image data
  const originalSrc = img.src;
  const originalAlt = img.alt;
  
  // Create a unique ID for this blurred image
  const uniqueId = 'safeguard-' + Math.random().toString(36).substring(2, 10);
  img.dataset.safeguardId = uniqueId;
  
  // Apply blur
  img.style.filter = 'blur(20px)';
  
  // Create overlay container
  const container = document.createElement('div');
  container.className = 'safeguard-blur-container';
  container.style.position = 'relative';
  container.style.display = originalStyles.display;
  container.style.width = originalStyles.width;
  container.style.height = originalStyles.height;
  container.style.overflow = 'hidden';
  
  // Create info overlay
  const overlay = document.createElement('div');
  overlay.className = 'safeguard-blur-overlay';
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  overlay.style.color = 'white';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.padding = '10px';
  overlay.style.textAlign = 'center';
  
  // Create overlay text
  const overlayText = document.createElement('p');
  overlayText.textContent = 'Image filtered';
  overlayText.style.margin = '0 0 10px 0';
  
  // Create view button
  const viewButton = document.createElement('button');
  viewButton.textContent = 'View Image';
  viewButton.className = 'safeguard-view-button';
  viewButton.dataset.imageId = uniqueId;
  viewButton.style.padding = '5px 10px';
  viewButton.style.backgroundColor = '#1177ea';
  viewButton.style.color = 'white';
  viewButton.style.border = 'none';
  viewButton.style.borderRadius = '3px';
  viewButton.style.cursor = 'pointer';
  
  // Add elements to DOM
  overlay.appendChild(overlayText);
  overlay.appendChild(viewButton);
  
  // Replace image with container
  img.parentNode.insertBefore(container, img);
  container.appendChild(img);
  container.appendChild(overlay);
  
  // Save original image data for later restoration
  img.dataset.originalSrc = originalSrc;
  img.dataset.originalAlt = originalAlt;
  
  return uniqueId;
}

// Remove blur from an image
function removeBlurFromImage(imageId) {
  const img = document.querySelector(`[data-safeguard-id="${imageId}"]`);
  if (!img) return false;
  
  // Get the container
  const container = img.closest('.safeguard-blur-container');
  if (!container) return false;
  
  // Restore original image
  img.style.filter = 'none';
  
  // Remove overlay
  const overlay = container.querySelector('.safeguard-blur-overlay');
  if (overlay) container.removeChild(overlay);
  
  // Unwrap image from container
  const parent = container.parentNode;
  parent.insertBefore(img, container);
  parent.removeChild(container);
  
  return true;
}

// Export functions if running in a module context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    safeJsonParse,
    isSearchResultsPage,
    getTextAroundElement,
    extractKeywords,
    shouldBlurImage,
    isPotentiallyHarmfulDomain,
    applyBlurToImage,
    removeBlurFromImage
  };
}
