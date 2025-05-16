"""
SafeGuard Content Filter - Backend Server
Handles AI-powered content analysis using BERT NLP and YOLO image detection
"""

import os
import json
import logging
from flask import Flask, request, jsonify,render_template, send_from_directory
import requests
from flask_cors import CORS
import numpy as np
from PIL import Image
from io import BytesIO

# Import utilities for AI processing
from nlp_processor import analyze_text_with_bert
from vision_processor import ViolenceDetector

# Initialize the ViolenceDetector
detector = ViolenceDetector()

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
  "porn", "porno", "pornographic", "pornography", "xxx", "xxx video", "xxx movies",
  "nudity", "naked", "nude", "boobs", "breasts", "sex", "sex video", "having sex", 
  "hot sex", "adult content", "adult video", "explicit", "erotic", "sexual", "masturbate",
  "masturbation", "hentai", "fetish", "onlyfans", "only fans", "camgirl", "cam girl",
  "live sex", "strip", "stripper", "orgy", "blowjob", "bj", "69", "nude pic", "fuck",
  "fucking", "fucked", "fucker", "fucking hot", "fucking sexy", "sexy", "sexy"
  "nude photo", "leaked nudes", "xhamster", "xmasti", "xmaza", "xvideos", "xnxx",
  "redtube", "brazzers", "bangbros", "playboy", "sensual", "softcore", "hardcore"
]
,
   "violence": [
  "violence", "violent", "gore", "gory", "blood", "bloody", "kill", "killed", "killing",
  "murder", "murdered", "murdering", "stab", "stabbing", "beating", "brutal", "brutality",
  "fight", "fighting", "fight video", "dead body", "corpses", "death", "dead", "torture",
  "graphic violence", "executed", "execution", "massacre", "slaughter", "chopped",
  "decapitate", "decapitated", "shoot", "shooting", "gunshot", "gunfire", "bloodshed",
  "assault", "physical abuse", "knife attack", "clubbed", "bashed", "burnt alive"
]
,"suicide": [
  "suicide", "kill myself", "killing myself", "how to die", "want to die", 
  "i want to die", "self-harm", "self harm", "cutting myself", "cut myself", 
  "painless suicide", "end my life", "ending my life", "commit suicide", 
  "committing suicide", "overdose", "hang myself", "hanging myself", 
  "drown myself", "jump off building", "suicidal", "depressed", 
  "i want to disappear", "i can't live", "worthless", "hopeless", 
  "how to hang myself", "how to kill myself", "die by suicide", 
  "ways to die", "methods of suicide", "leave this world", 
  "exit life", "ending it all"
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
    "professor", "counselor", "program", "curriculum", "dissertation", "thesis","theory","theories","Social",
    
    # Paper and document types
    "literature", "publication", "dissertation", "thesis", "journal", 
    "proceedings", "textbook", "encyclopedia", "bibliography", "citation"
]


@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')


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


# @app.route('/analyze_content', methods=['POST'])
# def analyze_page_content():
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
    "exampleporn.com", "adultsite.xyz", "nsfwvideos.io", "xxxhub.org",
    "pornhub.com", "xvideos.com", "redtube.com",
    "xnxx.com", "youjizz.com", "spankbang.com", "youporn.com",
    "brazzers.com", "bangbros.com", "team-skeet.com", "hclips.com",
    "tnaflix.com", "fapello.com", "rule34.xxx", "porn.com",
    "onlyfans.com", "manyvids.com", "nudogram.com", "motherless.com",
    "erome.com", "camwhores.tv", "cam4.com", "livejasmin.com",
    "chaturbate.com", "stripchat.com", "mydirtyhobby.com",
    "metart.com", "hqporner.com", "porndig.com", "tubegalore.com","webxseries","xmaza"
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

@app.route('/analyze_content', methods=['POST'])
def analyze_page_content():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.json or {}
    content = data.get('content', '')
    url = data.get('url', '')
    title = data.get('title', '')
    sensitivity = data.get('sensitivity', 'medium')
    educational_mode = data.get('educational_mode', True)
    filters = data.get('filters', ['nsfw', 'violence', 'suicide'])

    logger.info(f"Analyzing content from URL: {url}")

    # Blocklist Domain Check
    # if is_domain_blocked(url):
    #     logger.warning(f"Blocked domain detected: {url}")
    #     return jsonify({
    #         "is_harmful": True,
    #         "reason": "Blocked domain",
    #         "harmful_keywords": ["blocked_domain"],
    #         "category": "blocked"
    #     })

    # Keyword Detection
    is_harmful = False
    matched_keywords = []
    text_to_check = f"{title} {content}".lower()

    for filter_type in filters:
        patterns = harmful_patterns.get(filter_type, [])
        for pattern in patterns:
            if pattern in text_to_check:
                is_harmful = True
                matched_keywords.append(pattern)

    # Educational Context
    if is_harmful and educational_mode:
        educational_score = 0
        for term in educational_terms:
            if term in text_to_check:
                educational_score += 2 if term in [
                    "research", "study", "paper", "academic",
                    "psychology", "education", "prevention",
                    "awareness", "effects", "impact"
                ] else 1

        if educational_score >= 1:
            is_harmful = False
            logger.info(f"Educational context detected, allowing content")

    # Sensitivity Threshold
    threshold = 2
    if sensitivity == 'low':
        threshold = 3
    elif sensitivity == 'high':
        threshold = 1

    if sensitivity != 'high' and len(matched_keywords) < threshold:
        is_harmful = False

    # Fallback BERT for high sensitivity
    if sensitivity == 'high' and not is_harmful:
        try:
            sample = (title + " " + content[:1000])
            bert_result = analyze_text_with_bert(sample)
            if bert_result.get('harmful_probability', 0) > 0.5:
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

@app.route('/analyze_image', methods=['POST'])
def analyze_image():
    try:
        data = request.get_json()
        image_url = data.get("image_url")
        image_alt = data.get("image_alt", "").lower()
        surrounding_text = data.get("surrounding_text", "").lower()
        sensitivity = data.get("sensitivity", "medium")

        temp_path = "temp_image.jpg"
        response = requests.get(image_url, timeout=10)
        img = Image.open(BytesIO(response.content))
        img.save(temp_path)

        # AI detection
        score, tags = detector.analyze_image(temp_path)
        os.remove(temp_path)

        # Keyword-based fallback
        all_text = image_alt + " " + surrounding_text
        keyword_matches = [k for k in detector.violence_categories if k in all_text]

        # Sensitivity threshold
        thresholds = {'low': 0.85, 'medium': 0.75, 'high': 0.60}
        threshold = thresholds.get(sensitivity, 0.75)

        is_harmful = score >= threshold or len(keyword_matches) > 0

        return jsonify({
            "is_harmful": is_harmful,
            "score": score,
            "tags": tags,
            "keywords": keyword_matches
        })

    except Exception as e:
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

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('templates', filename)

if __name__ == '__main__':
    # Run the Flask app without SSL (for development)
    app.run(host='0.0.0.0', port=8000, debug=False)
