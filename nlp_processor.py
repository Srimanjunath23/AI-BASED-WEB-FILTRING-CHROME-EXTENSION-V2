"""
SafeGuard Content Filter - NLP Text Analysis Module
Provides BERT-based analysis for text content to detect harmful intent
"""
import os
import re
import requests
import json
from collections import Counter
from dotenv import load_dotenv

load_dotenv()  

# Get API key from environment
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY", "")

# BERT model endpoint - using Hugging Face Inference API
BERT_API_ENDPOINT = os.getenv("BERT-API", "")

# Harmful content patterns for keyword detection
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

def analyze_text_with_bert(text):
    """
    Analyze text using BERT-based model for sentiment/intent analysis
    Returns a dictionary with harmful_probability and detected_keywords
    """
    # First do keyword detection
    keywords = detect_harmful_keywords(text)
    
    # If we have an API key, use the BERT model for advanced analysis
    if HUGGINGFACE_API_KEY:
        try:
            # Prepare headers with API key
            headers = {
                "Authorization": f"Bearer {HUGGINGFACE_API_KEY}",
                "Content-Type": "application/json"
            }
            
            # Limit text length for API call
            truncated_text = text[:512] if len(text) > 512 else text
            
            # Send request to Hugging Face API
            response = requests.post(
                BERT_API_ENDPOINT,
                headers=headers,
                json={"inputs": truncated_text}
            )
            
            if response.status_code == 200:
                predictions = response.json()
                
                # The model returns sentiment scores, but we can use them to detect harmful content
                # Lower sentiment (negative) often correlates with harmful content
                # Extract the negative sentiment score
                negative_score = 0
                
                # Adapt to different response formats
                if isinstance(predictions, list) and len(predictions) > 0:
                    # Format: [{"label": "NEGATIVE", "score": 0.9}, {"label": "POSITIVE", "score": 0.1}]
                    for pred in predictions[0]:
                        if pred["label"] == "NEGATIVE":
                            negative_score = pred["score"]
                            break
                elif isinstance(predictions, dict):
                    # Format: {"sequence": "text", "labels": ["NEGATIVE", "POSITIVE"], "scores": [0.9, 0.1]}
                    if "labels" in predictions and "scores" in predictions:
                        for i, label in enumerate(predictions["labels"]):
                            if label == "NEGATIVE":
                                negative_score = predictions["scores"][i]
                                break
                
                # Adjust harmful probability based on keyword matches
                keyword_factor = min(1.0, len(keywords) * 0.2)  # Each keyword adds 0.2 up to 1.0
                harmful_probability = max(negative_score, keyword_factor)
                
                # Return results
                return {
                    "harmful_probability": harmful_probability,
                    "detected_keywords": keywords
                }
            else:
                # API call failed, fall back to keyword matching
                return fallback_analysis(text, keywords)
                
        except Exception as e:
            print(f"BERT analysis error: {str(e)}")
            # Fall back to keyword matching on error
            return fallback_analysis(text, keywords)
    else:
        # No API key, use fallback keyword analysis
        return fallback_analysis(text, keywords)

def detect_harmful_keywords(text):
    """
    Detect harmful keywords in text
    Returns a list of detected keywords
    """
    text = text.lower()
    detected_keywords = []
    
    # Check for harmful patterns in each category
    for category, patterns in harmful_patterns.items():
        for pattern in patterns:
            # Use word boundary matching to find whole words/phrases
            matches = re.findall(r'\b' + re.escape(pattern) + r'\b', text)
            if matches:
                detected_keywords.extend(matches)
    
    # Return unique keywords
    return list(set(detected_keywords))

def fallback_analysis(text, keywords):
    """
    Fallback analysis when API is unavailable
    Uses keyword matching and basic text analysis
    """
    text = text.lower()
    
    # Calculate a harmful probability based on keyword density
    word_count = len(text.split())
    if word_count == 0:
        word_count = 1  # Avoid division by zero
    
    # Calculate keyword density
    keyword_count = len(keywords)
    keyword_density = keyword_count / word_count
    
    # Calculate a harmful probability score (0.0 to 1.0)
    harmful_probability = min(1.0, keyword_density * 100)
    
    # Boost score based on harmful keyword repetition
    keyword_repetition = Counter([word for word in text.split() if word in " ".join(keywords)])
    if keyword_repetition:
        most_common_count = keyword_repetition.most_common(1)[0][1]
        repetition_factor = min(0.5, most_common_count * 0.1)  # Max 0.5 boost
        harmful_probability = min(1.0, harmful_probability + repetition_factor)
    
    # Check for strongly harmful phrases that should immediately flag content
    immediate_flag_phrases = [
        "how to kill myself", "ways to commit suicide", "child porn", 
        "how to murder", "torture video"
    ]
    
    for phrase in immediate_flag_phrases:
        if phrase in text:
            harmful_probability = 1.0
            if phrase not in keywords:
                keywords.append(phrase)
            break
    
    return {
        "harmful_probability": harmful_probability,
        "detected_keywords": keywords
    }

def analyze_search_intent(query):
    """
    Specialized analysis for search queries to determine user intent
    Returns a dictionary with classification of query intent
    """
    # First perform general analysis
    bert_result = analyze_text_with_bert(query)
    
    # Educational intent indicators
    educational_terms = [
        "education", "research", "study", "information", "learn", "article", 
        "report", "news", "medical", "health", "science", "history", "academic","theory","theories"
    ]
    
    # Check for educational intent
    educational_score = 0
    for term in educational_terms:
        if term in query.lower():
            educational_score += 1
    
    # Normalize educational score (0.0 to 1.0)
    educational_intent = min(1.0, educational_score / 3)
    
    # Combine with harmful probability to determine final intent
    return {
        "harmful_probability": bert_result["harmful_probability"],
        "educational_intent": educational_intent,
        "detected_keywords": bert_result["detected_keywords"],
        "is_harmful": bert_result["harmful_probability"] > 0.7 and educational_intent < 0.5
    }

def get_category_from_keywords(keywords):
    """
    Determine the primary category of harmful content based on keywords
    Returns the category with the most matches
    """
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

# For testing
if __name__ == "__main__":
    test_texts = [
        "How to make a cake recipe with chocolate",
        "Pornography videos free download",
        "Research paper on suicide prevention strategies",
        "How to kill myself painlessly",
        "Violence in video games research study"
    ]
    
    for text in test_texts:
        result = analyze_text_with_bert(text)
        print(f"Text: {text}")
        print(f"Harmful Probability: {result['harmful_probability']}")
        print(f"Detected Keywords: {result['detected_keywords']}")
        print("---")
