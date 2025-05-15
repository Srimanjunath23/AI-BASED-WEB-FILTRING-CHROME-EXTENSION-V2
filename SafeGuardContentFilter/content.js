// SafeGuard Content Filter - Content Script
// Runs on each web page to analyze content, block harmful pages, and blur sensitive images

// Flag to control filtering
let isFilteringEnabled = true;

// Store blurred images data
const blurredImages = new Map();

// Keep track of extension settings
let extensionSettings = {
  isEnabled: true,
  sensitivity: 'medium',
  blurIntensity: 'medium',
  isPasswordProtected: false,
  password: null,
  enabledFilters: {
    nsfw: true,
    violence: true,
    suicide: true
  }
};

// Initialize content script
async function initialize() {
  try {
    // Get extension settings
    extensionSettings = await chrome.storage.sync.get();

    // Skip if extension is not set up yet
    if (!extensionSettings.isSetup) return;

    // Only run if extension is enabled
    if (!extensionSettings.isEnabled) return;

    // Analyze page content when it loads
    analyzePageOnLoad();

    // Set up observers to handle dynamic content
    setupMutationObserver();

    // Set up click handlers for blurred images
    setupClickHandlers();
  } catch (error) {
    console.error("Failed to initialize content script:", error);
  }
}
const blockedDomains = [
  "pornhub.com", "xvideos.com", "xhamster.com", "redtube.com", "xnxx.com", "youjizz.com",
  "spankbang.com", "youporn.com", "brazzers.com", "bangbros.com", "hclips.com", "fapello.com",
  "rule34.xxx", "tnaflix.com", "onlyfans.com", "manyvids.com", "nudogram.com", "motherless.com",
  "erome.com", "camwhores.tv", "livejasmin.com", "chaturbate.com", "stripchat.com", "hqporner.com",
  "cam4.com", "tubegalore.com", "mydirtyhobby.com", "metart.com", "porndig.com"
];

async function getExtensionSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
      resolve(response?.settings || {
        enabled: true,
        nsfwFilter: true,
        violenceFilter: true,
        suicideFilter: true,
        educationalMode: true,
        sensitivity: 'medium'
      });
    });
  });
}

function domainInList(url) {
  const currentHost = new URL(url).hostname.replace(/^www\./, '');
  return blockedDomains.some(domain => currentHost.includes(domain));
}

function performContentAnalysis() {
  const pageContent = document.body ? document.body.innerText.toLowerCase() : '';
  const url = window.location.href;
  const pageTitle = document.title ? document.title.toLowerCase() : '';

  const educationalWords = ['research', 'study', 'academic', 'education', 'scientific', 'analysis', 'university', 'paper', 'sex education'];
  const educationalPhrases = ['research on', 'study on', 'analysis of', 'effects of', 'impact of', 'prevention of'];

  let reason = '';
  let isEducational = false;

  const contentToCheck = pageContent + ' ' + pageTitle;

  if (extensionSettings.educationalMode) {
    const educationalWordCount = educationalWords.filter(word => contentToCheck.includes(word)).length;
    const hasSensitivePhrases = educationalPhrases.some(phrase =>
      pageContent.includes(phrase + ' violence') || pageContent.includes(phrase + ' suicide')
    );
    isEducational = (educationalWordCount >= 3) || hasSensitivePhrases;
    console.log('Educational content detected:', isEducational);
  }

  const nsfwWords = ['xxx', 'porn', 'adult content', 'nsfw', 'nude', 'sex', 'hardcore', 'erotic', 'hentai','xhamster','xmasti','xmaza'];
  const violenceWords = ['kill', 'murder', 'fight', 'blood', 'assault', 'beating'];
  const suicideWords = ['suicide', 'self-harm', 'kill myself', 'end my life'];

  if (domainInList(url)) {
    reason = 'NSFW (domain)';
  } else if (suicideWords.some(word => pageContent.includes(word))) {
    reason = 'suicide';
  } else if (nsfwWords.some(word => contentToCheck.includes(word)) && !isEducational) {
    reason = 'NSFW';
  } else if (violenceWords.some(word => pageContent.includes(word))) {
    reason = 'violence';
  }

  if (reason && isEducational && extensionSettings.educationalMode) {
    console.log('Educational content detected, allowing access');
    blurImages();
  } else if (reason) {
    blockPage(reason);
  } else {
    blurImages();
  }
}

function analyzePageContent() {
  if (isPageBlocked) return;
  performContentAnalysis();
}

//   const pageContent = document.body ? document.body.innerText.toLowerCase() : '';
//   const url = window.location.href;
//   const pageTitle = document.title ? document.title.toLowerCase() : '';

//   const educationalWords = ['research', 'study', 'academic', 'education', 'scientific', 'analysis', 'university', 'paper', 'sex education'];
//   const educationalPhrases = ['research on', 'study on', 'analysis of', 'effects of', 'impact of', 'prevention of'];

//   let reason = '';
//   let isEducational = false;

//   if (extensionSettings.educationalMode) {
//     const contentToCheck = pageContent + ' ' + pageTitle;
//     const educationalWordCount = educationalWords.filter(word => contentToCheck.includes(word)).length;
//     const hasSensitivePhrases = educationalPhrases.some(phrase => {
//       return (
//         pageContent.includes(phrase + ' violence') ||
//         pageContent.includes(phrase + ' suicide')
//       );
//     });
//     isEducational = (educationalWordCount >= 3) || hasSensitivePhrases;
//     console.log('Educational content detected:', isEducational);
//   }

//   const nsfwWords = ['xxx', 'porn', 'adult content', 'nsfw'];;
//   const suicideWords = ['suicide', 'self-harm'];

//   if (suicideWords.some(word => pageContent.includes(word))) {
//     reason = 'suicide';
//   } else if (nsfwWords.some(word => pageContent.includes(word)) && !isEducational) {
//     reason = 'NSFW';
//   } else if (violenceWords.some(word => pageContent.includes(word))) {
//     reason = 'violence';
//   }

//   if (reason && isEducational && extensionSettings.educationalMode) {
//     console.log('Educational content detected, allowing access');
//     blurImages();
//   } else if (reason) {
//     blockPage(reason);
//   } else {
//     blurImages();
//   }
// }



// function analyzePageContent() {
//   if (isPageBlocked) return;
//   performContentAnalysis();
// }
// Analyze the current page content
// async function analyzePageOnLoad() {
//   try {
//     // Extract text content from the page
//     const pageContent = extractPageContent();

//     // Send content to background script for analysis
//     const analysisResult = await chrome.runtime.sendMessage({
//       type: 'ANALYZE_PAGE_CONTENT',
//       content: pageContent
//     });

//     // Handle the result
//     if (analysisResult.isHarmful) {
//       // Check if we're in incognito mode and handle content differently
//       try {
//         // In incognito mode, we need to directly modify the DOM instead of redirecting
//         const isIncognito = chrome.extension?.inIncognitoContext;
//         if (isIncognito) {
//           handleHarmfulContentInIncognito(analysisResult);
//           return;
//         }
//       } catch (e) {
//         console.error('Error checking incognito context:', e);
//       }

//       // Handle harmful content - block page
//       handleHarmfulContent(analysisResult);
//     } else {
//       // Still scan for images to blur
//       const pageKeywords = extractKeywordsFromPage();
//       await blurImages(pageKeywords);
//     }
//   } catch (error) {
//     console.error("Failed to analyze page:", error);
//   }
// }

// // Extract content from the page
// function extractPageContent() {
//   // Get text content from the document
//   return {
//     url: window.location.href,
//     title: document.title,
//     text: document.body.innerText
//   };
// }

// // Handle harmful content by redirecting to the block page
// function handleHarmfulContent(analysisResult) {
//   // URL to the extension's block page
//   const blockUrl = chrome.runtime.getURL('block.html');

//   // Add query parameters with information about the block
//   const url = new URL(blockUrl);
//   url.searchParams.set('url', window.location.href);
//   url.searchParams.set('reason', analysisResult.reason || 'Harmful content detected');
//   url.searchParams.set('category', analysisResult.category || 'unknown');

//   // Redirect to the block page
//   window.location.href = url.toString();
// }
// async function performContentAnalysis() {
//   const pageContent = document.body ? document.body.innerText.toLowerCase() : '';
//   const url = window.location.href;
//   const pageTitle = document.title ? document.title.toLowerCase() : '';

//   const contentToCheck = pageContent + ' ' + pageTitle;

//   const educationalWords = ['research', 'study', 'academic', 'education', 'scientific', 'analysis', 'university', 'paper', 'sex education'];
//   const educationalPhrases = ['research on', 'study on', 'analysis of', 'effects of', 'impact of', 'prevention of'];

//   let reason = '';
//   let isEducational = false;

//   try {
//     if (extensionSettings.educationalMode) {
//       const educationalWordCount = educationalWords.filter(word => contentToCheck.includes(word)).length;
//       const hasSensitivePhrases = educationalPhrases.some(phrase =>
//         pageContent.includes(phrase + ' violence') || pageContent.includes(phrase + ' suicide')
//       );

//       isEducational = (educationalWordCount >= 3) || hasSensitivePhrases;
//       console.log('Educational content detected:', isEducational);
//     }

//     const nsfwWords = ['xxx', 'porn', 'adult content', 'nsfw'];
//     const violenceWords = ['kill', 'fight'];
//     const suicideWords = ['suicide', 'self-harm'];

//     if (suicideWords.some(word => pageContent.includes(word))) {
//       reason = 'suicide';
//     } else if (nsfwWords.some(word => pageContent.includes(word)) && !isEducational) {
//       reason = 'NSFW';
//     } else if (violenceWords.some(word => pageContent.includes(word))) {
//       reason = 'violence';
//     }

//     if (reason && isEducational && extensionSettings.educationalMode) {
//       console.log('Educational but sensitive content detected, allowing with blur');
//       blurImages();
//     } else if (reason) {
//       const isIncognito = chrome.extension?.inIncognitoContext;
//       if (isIncognito) {
//         handleHarmfulContentInIncognito({ reason, category: reason, isHarmful: true });
//       } else {
//         blockPage(reason);
//       }
//     } else {
//       blurImages();
//     }

//   } catch (error) {
//     console.error("Error during content analysis:", error);
//     blurImages(); // fallback
//   }
// }

// function analyzePageContent() {
//   if (isPageBlocked) return;
//   performContentAnalysis();
// }
// async function performContentAnalysis(textContent) {
//   return new Promise((resolve, reject) => {
//     chrome.runtime.sendMessage(
//       {
//         type: "analyze_content",
//         payload: textContent,
//       },
//       (response) => {
//         if (chrome.runtime.lastError) {
//           return reject(chrome.runtime.lastError.message);
//         }
//         if (response?.error) {
//           return reject(response.error);
//         }
//         resolve(response);
//       }
//     );
//   });
// }

// /**
//  * Analyze the text content of the page using OpenAI and block if needed.
//  */
// async function analyzePageContent() {
//   const pageText = document.body.innerText;
//   try {
//     const result = await performContentAnalysis(pageText);
//     if (result.block) {
//       blockPage("Blocked based on AI content analysis.");
//     }
//   } catch (error) {
//     console.error("AI content analysis failed:", error);
//   }
// }

// Handle harmful content in incognito mode with inline content replacement
function handleHarmfulContentInIncognito(analysisResult) {
  // Create a full-page overlay for incognito mode
  const fullPageOverlay = document.createElement('div');
  fullPageOverlay.className = 'safeguard-block-overlay';
  fullPageOverlay.setAttribute('role', 'alert');

  // Apply critical styling for visibility
  Object.assign(fullPageOverlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: '#f8f9fa',
    zIndex: '2147483647', // Maximum z-index
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    boxSizing: 'border-box',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif'
  });

  // Create content container
  const contentContainer = document.createElement('div');
  contentContainer.style.maxWidth = '600px';
  contentContainer.style.textAlign = 'center';
  contentContainer.style.backgroundColor = 'white';
  contentContainer.style.padding = '30px';
  contentContainer.style.borderRadius = '8px';
  contentContainer.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';

  // Add icon
  const iconElement = document.createElement('div');
  iconElement.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  `;

  // Add heading
  const heading = document.createElement('h1');
  heading.textContent = 'Content Blocked';
  heading.style.color = '#e74c3c';
  heading.style.margin = '20px 0 10px';
  heading.style.fontSize = '24px';

  // Add reason
  const reasonElement = document.createElement('p');
  reasonElement.textContent = analysisResult.reason || 'Harmful content detected';
  reasonElement.style.fontSize = '16px';
  reasonElement.style.margin = '0 0 20px';
  reasonElement.style.color = '#555';

  // Add back button
  const backButton = document.createElement('button');
  backButton.textContent = 'Go Back';
  Object.assign(backButton.style, {
    padding: '10px 20px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: 'bold'
  });

  // Add click handler for back button
  backButton.addEventListener('click', () => {
    window.history.back();
  });

  // Build DOM structure
  contentContainer.appendChild(iconElement);
  contentContainer.appendChild(heading);
  contentContainer.appendChild(reasonElement);
  contentContainer.appendChild(backButton);
  fullPageOverlay.appendChild(contentContainer);

  // Clear the page content first
  document.body.innerHTML = '';

  // Add to DOM
  document.body.appendChild(fullPageOverlay);

  // Prevent scrolling on the page
  document.body.style.overflow = 'hidden';

  // Focus on back button for accessibility
  backButton.focus();
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
      const pageKeywords = extractKeywordsFromPage();
      processNewImages(newImages, pageKeywords);
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
function processNewImages(images, pageKeywords) {
  // Performance optimization: batch processing
  const batchSize = 10;

  const processBatch = (startIndex) => {
    const endIndex = Math.min(startIndex + batchSize, images.length);

    for (let i = startIndex; i < endIndex; i++) {
      const img = images[i];

      // Skip if already processed
      if (img.dataset.safeguardProcessed) continue;

      // Mark as processed to avoid duplicates
      img.dataset.safeguardProcessed = 'true';

      // Skip tiny images (likely icons)
      if (img.width < 50 || img.height < 50) continue;

      // Check if image should be blurred
      const shouldBlur = shouldBlurImage(img, pageKeywords);

      if (shouldBlur) {
        // Use requestAnimationFrame for smoother UI
        window.requestAnimationFrame(() => blurImage(img));
      }
    }

    // Process next batch if more images exist
    if (endIndex < images.length) {
      setTimeout(() => processBatch(endIndex), 0);
    }
  };

  // Start processing the first batch
  processBatch(0);
}

// Extract keywords from page content
function extractKeywordsFromPage() {
  // Get text content of the page
  const textContent = document.body.innerText.toLowerCase();

  // Define harmful keywords for detection
  const harmfulKeywords = [
    // NSFW keywords
    'xxx', 'porn', 'pornography', 'nudity', 'naked', 'sex', 'adult', 'nsfw',
    // Violence keywords
    'gore', 'blood', 'violent', 'violence', 'murder', 'death', 'killing',
    // Suicide keywords
    'suicide', 'self-harm', 'kill myself', 'end my life', 'hanging'
  ];

  // Find all matches in the text
  return harmfulKeywords.filter(keyword => textContent.includes(keyword));
}

// Function to blur unsafe images based on alt/src and keywords
async function blurImages() {
  const images = document.querySelectorAll('img');
  const settings = await getExtensionSettings();
  const sensitivity = settings.sensitivity || 'medium';

  // Fallback keywords if AI fails
  const fallbackKeywords = [
    'xxx', 'porn', 'nudity', 'nsfw', 'sex', 'violence', 'gore',
    'blood', 'murder', 'kill', 'dead', 'knife', 'gun', 'injury', 'suicide'
  ];

  for (const img of images) {
    if (!img.src || img.dataset.safeguardProcessed === 'true') continue;
    img.dataset.safeguardProcessed = 'true';

    if (img.width < 50 || img.height < 50 || img.src.startsWith('data:') || img.src.startsWith('blob:')) continue;

    const alt = img.alt?.toLowerCase() || '';
    const src = img.src.toLowerCase();
    const pageText = document.body.innerText.toLowerCase();

    let isHarmful = false;
     isHarmful = fallbackKeywords.some(keyword =>
        alt.includes(keyword) || src.includes(keyword)
      );
      if (isHarmful) {
      blurImageWithOverlay(img);
    }

    try {
        
      const res = await fetch('http://localhost:8000/analyze_image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: img.src,
          image_alt: alt,
          surrounding_text: pageText,
          sensitivity: sensitivity
        })
      });

      const result = await res.json();
      isHarmful = result.is_harmful;
    } catch (err) {
      console.warn('AI analysis failed. Falling back to keyword check.', err);

      // Fallback keyword check
      isHarmful = fallbackKeywords.some(keyword =>
        alt.includes(keyword) || src.includes(keyword)
      );
    }

    if (isHarmful) {
      blurImageWithOverlay(img);
    }
  }
}

// Load extension settings from chrome.storage
async function getExtensionSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['sensitivity', 'password', 'isPasswordProtected'], (data) => {
      resolve({
        sensitivity: data.sensitivity || 'medium',
        password: data.password || '',
        isPasswordProtected: data.isPasswordProtected || false
      });
    });
  });
}

function blurImageWithOverlay(img) {
  // Set image to block to avoid layout issues
  img.style.display = 'block';

  // Get the image dimensions
  const width = img.offsetWidth + 'px';
  const height = img.offsetHeight + 'px';

  // Wrap image in a container to preserve layout
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.display = 'inline-block';
  wrapper.style.width = width;
  wrapper.style.height = height;
  wrapper.style.overflow = 'hidden';

  // Insert wrapper before image and append image into it
  const parent = img.parentNode;
  parent.insertBefore(wrapper, img);
  wrapper.appendChild(img);

  // Blur the image
  img.style.filter = 'blur(10px)';
  img.style.transition = 'filter 0.3s ease';

  // Create unlock button
  const button = document.createElement('button');
  button.innerText = 'Show Image';
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

  // Unlock logic
  button.addEventListener('click', async () => {
    const enteredPassword = prompt('Enter extension password to view this image:');
    const latestSettings = await getExtensionSettings();

    const hashedInput = simpleHash(enteredPassword);
    const correctHash = latestSettings.password;

    if (!latestSettings.isPasswordProtected || !correctHash || hashedInput === correctHash) {
      img.style.filter = 'none'; // remove blur
      button.remove(); // remove button
    } else {
      alert('Incorrect password.');
    }
  });
}

// Simple local hash function for comparison
function simpleHash(str) {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash.toString();
}


// Run on page load
blurImages();


// Load extension settings from chrome.storage
async function getExtensionSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['sensitivity', 'password', 'isPasswordProtected'], (data) => {
      resolve({
        sensitivity: data.sensitivity || 'medium',
        password: data.password || '',
        isPasswordProtected: data.isPasswordProtected || false
      });
    });
  });
}


// Get extension settings helper
async function getExtensionSettings() {
  try {
    return await chrome.storage.sync.get();
  } catch (error) {
    console.error('Error getting extension settings:', error);
    return {
      isEnabled: true,
      sensitivity: 'medium',
      isPasswordProtected: false
    };
  }
}
document.addEventListener('DOMContentLoaded', blurImages);

// Initialize content script
document.addEventListener('DOMContentLoaded', initialize);
initialize();  // Also try executing immediately for faster operation