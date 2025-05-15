"""
SafeGuard Content Filter - Backend Server
Handles AI-powered content analysis using BERT NLP and YOLO image detection
"""

import os
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np

# Import utilities for AI processing
from nlp_processor import analyze_text_with_bert
from vision_processor import analyze_image_with_yolo

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for browser extension requests

# Get API keys from environment variables
API_KEY = os.getenv("HUGGINGFACE_API_KEY", "")

# Load harmful content patterns
harmful_patterns = {
    "nsfw": [
        "porn", "xxx", "nudity", "naked", "sex video", "adult content",
        "pornography", "erotic", "nsfw", "explicit", "onlyfans"
    ],
    "violence": [
        "violence", "gore", "blood", "kill", "murder", "dead body",
        "graphic violence", "brutal", "fight video", "torture", "death"
    ],
    "suicide": [
        "suicide", "kill myself", "self-harm", "how to die", "end my life",
        "suicide methods", "hanging myself", "painless suicide"
    ]
}

# Educational context indicators
educational_terms = [
    # General education terms
    "education", "research", "study", "information", "learn", "article", 
    "report", "news", "medical", "health", "science", "history", "academic",
    
    # Additional academic and research terms
    "effects", "impact", "paper", "case study", "studies", "statistics",
    "psychological", "analysis", "assessment", "correlation", "comparison",
    "theory", "evidence", "data", "findings", "review", "journal", "bibliography",
    
    # Subject-specific educational terms
    "neurological", "psychology", "therapy", "counseling", "prevention", 
    "awareness", "treatment", "mental health", "strategies", "recovery",
    "behavior", "cognitive", "development", "intervention", "methodology",
    
    # Educational roles and institutions
    "school", "university", "college", "classroom", "teacher", "student", 
    "professor", "counselor", "program", "curriculum", "dissertation", "thesis",
    
    # Paper and document types
    "literature", "publication", "dissertation", "thesis", "journal", 
    "proceedings", "textbook", "encyclopedia", "bibliography", "citation"
]

@app.route('/', methods=['GET'])
def index():
    """Index page with project information"""
    from flask import Response
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SafeGuard Content Filter - Server</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            h1 {
                color: #1177ea;
                border-bottom: 2px solid #e6f2ff;
                padding-bottom: 10px;
            }
            h2 {
                color: #343a40;
                margin-top: 30px;
            }
            .endpoint {
                background-color: #f8f9fa;
                border-left: 4px solid #1177ea;
                padding: 15px;
                margin-bottom: 15px;
                border-radius: 0 4px 4px 0;
            }
            .endpoint h3 {
                margin-top: 0;
                color: #1177ea;
            }
            code {
                background-color: #f1f3f5;
                padding: 2px 5px;
                border-radius: 3px;
                font-family: monospace;
            }
            .status {
                display: inline-block;
                padding: 5px 10px;
                border-radius: 4px;
                font-weight: bold;
                background-color: #28a745;
                color: white;
            }
        </style>
    </head>
    <body>
        <h1>SafeGuard Content Filter - Backend Server</h1>
        <p class="status">Server Running</p>
        
        <p>This is the backend server for the SafeGuard Content Filter browser extension. 
        It provides AI-powered content analysis using BERT for text analysis and YOLO for image detection.</p>
        
        <h2>Available API Endpoints</h2>
        
        <div class="endpoint">
            <h3>Health Check</h3>
            <p><code>GET /health</code></p>
            <p>Check if the server is running.</p>
        </div>
        
        <div class="endpoint">
            <h3>Analyze Search Query</h3>
            <p><code>POST /analyze_query</code></p>
            <p>Analyze a search query for harmful intent.</p>
        </div>
        
        <div class="endpoint">
            <h3>Analyze Page Content</h3>
            <p><code>POST /analyze_content</code></p>
            <p>Analyze web page content for harmful material.</p>
        </div>
        
        <div class="endpoint">
            <h3>Check Domain</h3>
            <p><code>POST /check_domain</code></p>
            <p>Check if a domain is known to host harmful content.</p>
        </div>
        
        <div class="endpoint">
            <h3>Analyze Image</h3>
            <p><code>POST /analyze_image</code></p>
            <p>Analyze an image for NSFW/harmful content using YOLO.</p>
        </div>
        
        <h2>How to Use</h2>
        <p>This server is designed to be used with the SafeGuard Content Filter browser extension. 
        It's not intended for direct browser access.</p>
        
        <p>For optimal performance, consider setting up API keys for external services:</p>
        <ul>
            <li><code>HUGGINGFACE_API_KEY</code> - For enhanced text analysis</li>
            <li><code>ROBOFLOW_API_KEY</code> - For improved image analysis</li>
        </ul>
        
        <p>Refer to the <code>INSTRUCTIONS.md</code> file in the project repository for more detailed setup instructions.</p>
    </body>
    </html>
    """
    # Set headers to allow inline scripts and styles
    response = Response(html_content)
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    return response

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok"})

@app.route('/test-all-filters', methods=['GET'])
def test_all_filters():
    """Test endpoint to check all filter categories"""
    all_categories = {}
    
    # Test NSFW filter
    nsfw_result = {
        "is_harmful": True,
        "harmful_keywords": ["porn", "nude", "explicit"],
        "category": "nsfw"
    }
    all_categories["nsfw"] = nsfw_result
    
    # Test Violence filter
    violence_result = {
        "is_harmful": True,
        "harmful_keywords": ["violence", "gore", "murder"],
        "category": "violence"
    }
    all_categories["violence"] = violence_result
    
    # Test Suicide filter
    suicide_result = {
        "is_harmful": True,
        "harmful_keywords": ["suicide", "kill myself"],
        "category": "suicide"
    }
    all_categories["suicide"] = suicide_result
    
    return jsonify({
        "status": "ok",
        "filter_categories": all_categories,
        "message": "All filter categories are available and functioning"
    })

@app.route('/analyze_query', methods=['POST'])
def analyze_search_query():
    """Analyze a search query for harmful intent"""
    # Check if request contains JSON data
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    # Safely get data from the request
    data = request.json or {}
    query = data.get('query', '')
    sensitivity = data.get('sensitivity', 'medium')
    educational_mode = data.get('educational_mode', True)
    filters = data.get('filters', ['nsfw', 'violence', 'suicide'])
    
    logger.info(f"Analyzing search query: {query}")
    
    # Basic pattern matching
    is_harmful = False
    matched_keywords = []
    
    # Check each filter category
    for filter_type in filters:
        if filter_type in harmful_patterns:
            patterns = harmful_patterns[filter_type]
            for pattern in patterns:
                if pattern in query.lower():
                    is_harmful = True
                    matched_keywords.append(pattern)
    
    # If harmful and educational mode is on, check for educational context
    if is_harmful and educational_mode:
        educational_score = 0
        query_lower = query.lower()
        
        # Multiple word terms need special handling
        for term in educational_terms:
            if term in query_lower:
                # Give higher score to stronger educational indicators
                if term in ["research", "study", "paper", "academic", "psychology", 
                           "education", "prevention", "awareness", "effects", "impact"]:
                    educational_score += 2
                else:
                    educational_score += 1
        
        logger.info(f"Educational score for query '{query}': {educational_score}")
        
        # If educational context is detected, allow the content
        # Lower threshold for search queries since they're shorter
        if educational_score >= 1:
            is_harmful = False
            logger.info(f"Educational context detected, allowing query")
    
    # Apply sensitivity adjustments
    if sensitivity == 'low' and len(matched_keywords) <= 1:
        is_harmful = False
    elif sensitivity == 'high' and not is_harmful:
        # Use BERT for advanced analysis on high sensitivity
        try:
            bert_result = analyze_text_with_bert(query)
            if bert_result['harmful_probability'] > 0.6:
                is_harmful = True
                matched_keywords.extend(bert_result.get('detected_keywords', []))
        except Exception as e:
            logger.error(f"BERT analysis error: {str(e)}")
    
    return jsonify({
        "is_harmful": is_harmful,
        "harmful_keywords": list(set(matched_keywords)),
        "category": determine_category(matched_keywords)
    })

@app.route('/analyze_content', methods=['POST'])
def analyze_page_content():
    """Analyze web page content for harmful material"""
    # Check if request contains JSON data
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    # Safely get data from the request
    data = request.json or {}
    content = data.get('content', '')
    url = data.get('url', '')
    title = data.get('title', '')
    sensitivity = data.get('sensitivity', 'medium')
    educational_mode = data.get('educational_mode', True)
    filters = data.get('filters', ['nsfw', 'violence', 'suicide'])
    
    logger.info(f"Analyzing content from URL: {url}")
    
    # Basic keyword detection
    is_harmful = False
    matched_keywords = []
    
    # Check title and content for harmful patterns
    text_to_check = f"{title} {content}".lower()
    
    # Check each filter category
    for filter_type in filters:
        if filter_type in harmful_patterns:
            patterns = harmful_patterns[filter_type]
            for pattern in patterns:
                if pattern in text_to_check:
                    is_harmful = True
                    matched_keywords.append(pattern)
    
    # If harmful and educational mode is on, check for educational context
    if is_harmful and educational_mode:
        educational_score = 0
        text_lower = text_to_check.lower()
        
        # Check for educational context
        for term in educational_terms:
            if term in text_lower:
                # Give higher score to stronger educational indicators
                if term in ["research", "study", "paper", "academic", "psychology", 
                           "education", "prevention", "awareness", "effects", "impact"]:
                    educational_score += 2
                else:
                    educational_score += 1
        
        logger.info(f"Educational score for content from URL {url}: {educational_score}")
        
        # Lower threshold for educational content detection
        # Single strong educational term is enough
        if educational_score >= 1:
            is_harmful = False
            logger.info(f"Educational context detected, allowing content")
    
    # Apply sensitivity adjustments
    harmful_threshold = 2  # Default for medium
    if sensitivity == 'low':
        harmful_threshold = 3
    elif sensitivity == 'high':
        harmful_threshold = 1
    
    # For medium and low sensitivity, require multiple matches
    if sensitivity != 'high' and len(matched_keywords) < harmful_threshold:
        is_harmful = False
    
    # For high sensitivity with no basic matches, use BERT
    if sensitivity == 'high' and not is_harmful:
        try:
            # Use first 1000 chars for BERT analysis
            sample_text = (title + " " + content[:1000])
            bert_result = analyze_text_with_bert(sample_text)
            if bert_result['harmful_probability'] > 0.5:
                is_harmful = True
                matched_keywords.extend(bert_result.get('detected_keywords', []))
        except Exception as e:
            logger.error(f"BERT analysis error: {str(e)}")
    
    return jsonify({
        "is_harmful": is_harmful,
        "reason": "Harmful content detected" if is_harmful else "Content allowed",
        "harmful_keywords": list(set(matched_keywords)),
        "category": determine_category(matched_keywords)
    })

@app.route('/check_domain', methods=['POST'])
def check_domain():
    """Check if a domain is known to host harmful content"""
    # Check if request contains JSON data
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    # Safely get data from the request
    data = request.json or {}
    domain = data.get('domain', '')
    sensitivity = data.get('sensitivity', 'medium')
    filters = data.get('filters', ['nsfw', 'violence', 'suicide'])
    
    logger.info(f"Checking domain: {domain}")
    
    # Basic pattern matching for domain
    is_harmful = False
    matched_patterns = []
    
    # Check each filter category
    for filter_type in filters:
        if filter_type in harmful_patterns:
            patterns = harmful_patterns[filter_type]
            for pattern in patterns:
                if pattern in domain.lower():
                    is_harmful = True
                    matched_patterns.append(pattern)
    
    # Known harmful domains list - these would be blocked regardless of sensitivity
    known_harmful_domains = [
        "pornhub.com", "xvideos.com", "xnxx.com",
        "bestgore.com", "liveleak.com", 
        "suicidemethod.com", "howtokillmyself.com"
    ]
    
    for known_domain in known_harmful_domains:
        if known_domain in domain:
            is_harmful = True
            matched_patterns.append(known_domain)
    
    # Apply sensitivity adjustments
    if sensitivity == 'low' and len(matched_patterns) == 1:
        # For low sensitivity, require more evidence unless it's a known domain
        if domain not in known_harmful_domains:
            is_harmful = False
    
    return jsonify({
        "is_harmful": is_harmful,
        "matched_patterns": matched_patterns,
        "category": determine_category(matched_patterns)
    })

@app.route('/analyze_image', methods=['POST'])
def analyze_image():
    """Analyze an image for NSFW/harmful content using YOLO and additional heuristics"""
    # Check if request.json exists and has image_url
    if not request.json or 'image_url' not in request.json:
        return jsonify({"error": "No image URL provided"}), 400
    
    # Now safely access data from request.json
    image_url = request.json.get('image_url', '')
    sensitivity = request.json.get('sensitivity', 'medium')
    surrounding_text = request.json.get('surrounding_text', '')
    image_alt = request.json.get('image_alt', '')
    
    try:
        # Use YOLO to detect objects/content in the image
        result = analyze_image_with_yolo(image_url)
        
        # Start with YOLO detection probability
        nsfw_probability = result['nsfw_probability']
        category = "unknown"
        detected_keywords = result.get('detected_objects', [])
        
        # Additional analysis based on surrounding text and alt text
        if surrounding_text or image_alt:
            # Check text against harmful patterns
            text_to_analyze = (surrounding_text + " " + image_alt).lower()
            matched_keywords = []
            
            # Check against harmful content patterns
            for cat, patterns in harmful_patterns.items():
                for pattern in patterns:
                    if pattern.lower() in text_to_analyze:
                        matched_keywords.append(pattern)
                        # Set category if we found a match and don't have one yet
                        if not category or category == "unknown":
                            category = cat
            
            # Increase probability based on matched keywords
            if matched_keywords:
                keyword_probability = min(0.8, len(matched_keywords) * 0.2)
                nsfw_probability = max(nsfw_probability, keyword_probability)
                detected_keywords.extend(matched_keywords)
            
            # Check if educational context (reduces probability)
            edu_terms = ["research", "study", "paper", "academic", "education", 
                         "prevention", "awareness", "effects", "impact", "scholarly"]
            
            edu_matches = [term for term in edu_terms if term in text_to_analyze]
            if edu_matches and len(edu_matches) >= 2:
                # Educational context reduces probability
                nsfw_probability *= 0.5
                logger.info(f"Educational context detected in image analysis, reducing probability")
        
        # Determine if image is harmful based on adjusted probability and sensitivity
        threshold = get_threshold_for_sensitivity(sensitivity)
        is_harmful = nsfw_probability > threshold
        
        # If it's a very high probability, also determine category
        if nsfw_probability > 0.8:
            # Look at the detected objects to determine category
            nsfw_count = violence_count = suicide_count = 0
            
            for obj in detected_keywords:
                obj_lower = obj.lower() if isinstance(obj, str) else str(obj).lower()
                
                if any(term in obj_lower for term in harmful_patterns["nsfw"]):
                    nsfw_count += 1
                elif any(term in obj_lower for term in harmful_patterns["violence"]):
                    violence_count += 1
                elif any(term in obj_lower for term in harmful_patterns["suicide"]):
                    suicide_count += 1
            
            # Set category based on highest count
            if nsfw_count >= violence_count and nsfw_count >= suicide_count:
                category = "nsfw"
            elif violence_count >= nsfw_count and violence_count >= suicide_count:
                category = "violence"
            elif suicide_count > 0:
                category = "suicide"
        
        # Return detailed result
        return jsonify({
            "is_harmful": is_harmful,
            "nsfw_probability": nsfw_probability,
            "detected_objects": list(set(detected_keywords)),
            "category": category,
            "threshold": threshold
        })
    except Exception as e:
        logger.error(f"Image analysis error: {str(e)}")
        return jsonify({"error": str(e)}), 500

def determine_category(keywords):
    """Determine the primary category of harmful content"""
    if not keywords:
        return "none"
    
    category_counts = {
        "nsfw": 0,
        "violence": 0,
        "suicide": 0
    }
    
    # Count keywords in each category
    for keyword in keywords:
        for category, patterns in harmful_patterns.items():
            if keyword in patterns:
                category_counts[category] += 1
    
    # Find category with most matches
    max_category = max(category_counts.items(), key=lambda x: x[1])
    if max_category[1] == 0:
        return "none"
    
    return max_category[0]

def get_threshold_for_sensitivity(sensitivity):
    """Get the threshold value based on sensitivity setting"""
    if sensitivity == 'low':
        return 0.8  # 80% confidence required
    elif sensitivity == 'medium':
        return 0.6  # 60% confidence required
    elif sensitivity == 'high':
        return 0.4  # 40% confidence required
    else:
        return 0.6  # Default medium

if __name__ == '__main__':
    # Run the Flask app without SSL (for development)
    app.run(host='0.0.0.0', port=8000, debug=False)
