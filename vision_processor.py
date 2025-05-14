"""
SafeGuard Content Filter - Vision Analysis Module
Provides YOLOv5 image analysis to detect NSFW or harmful visual content
"""
import os
import io
import requests
import numpy as np
import json
import base64
from urllib.parse import urlparse

# Import error handling utility
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

# Get API key from environment
ROBOFLOW_API_KEY = os.getenv("YOLO-API", "")
YOLO_API_ENDPOINT = "https://detect.roboflow.com/nsfw-detection-v1/1"

# If no API key is available, we'll use a fallback method that analyzes image metadata

class YOLODetector:
    """
    YOLO-based detector for harmful content in images
    Uses external API or falls back to local analysis
    """
    def __init__(self):
        self.api_key = ROBOFLOW_API_KEY
        self.has_api = bool(self.api_key)
        
        # NSFW object categories
        self.nsfw_categories = [
            "nude", "pornography", "nudity", "explicit", "sexual", 
            "adult", "naked", "nsfw", "explicit content"
        ]
        
        # Violence categories
        self.violence_categories = [
            "blood", "gore", "weapon", "gun", "knife", "injury",
            "dead body", "violence", "wound", "graphic"
        ]

    def analyze_image(self, image_url):
        """
        Analyze an image for NSFW/harmful content using YOLO
        Returns analysis results with NSFW probability and detected objects
        """
        # First check if this is a valid image URL
        if not self._is_valid_image_url(image_url):
            return {
                "nsfw_probability": 0.0,
                "detected_objects": [],
                "error": "Invalid image URL"
            }
        
        # Try API-based detection if available
        if self.has_api:
            try:
                return self._api_based_detection(image_url)
            except Exception as e:
                print(f"API-based detection failed: {str(e)}")
                # Fall back to local analysis on API failure
                return self._local_analysis(image_url)
        else:
            # No API key, use local analysis
            return self._local_analysis(image_url)

    def _api_based_detection(self, image_url):
        """
        Use external YOLO API to detect objects in image
        """
        # Prepare API request
        api_params = {
            "api_key": self.api_key
        }
        
        # Make request to the YOLO API with the image URL
        response = requests.post(
            f"{YOLO_API_ENDPOINT}?api_key={self.api_key}",
            json={"image": image_url}
        )
        
        if response.status_code == 200:
            # Parse the response
            result = response.json()
            
            # Extract detected objects
            detected_objects = []
            nsfw_confidence = 0.0
            
            if "predictions" in result:
                for prediction in result["predictions"]:
                    object_class = prediction.get("class", "")
                    confidence = prediction.get("confidence", 0)
                    
                    detected_objects.append({
                        "class": object_class,
                        "confidence": confidence
                    })
                    
                    # Update NSFW confidence if this object is in NSFW categories
                    if object_class.lower() in self.nsfw_categories:
                        nsfw_confidence = max(nsfw_confidence, confidence)
                    elif object_class.lower() in self.violence_categories:
                        # Violence is also considered harmful
                        nsfw_confidence = max(nsfw_confidence, confidence * 0.8)  # Slightly lower weight
            
            return {
                "nsfw_probability": nsfw_confidence,
                "detected_objects": detected_objects
            }
        else:
            # API call failed
            return {
                "nsfw_probability": 0.0,
                "detected_objects": [],
                "error": f"API request failed with status code {response.status_code}"
            }

    def _local_analysis(self, image_url):
        """
        Fallback method when API is not available
        Uses image metadata and basic image analysis
        """
        try:
            # Download image headers only first to check metadata
            head_response = requests.head(image_url, allow_redirects=True)
            content_type = head_response.headers.get('Content-Type', '')
            
            # If not an image, return zero probability
            if 'image' not in content_type:
                return {
                    "nsfw_probability": 0.0,
                    "detected_objects": [],
                    "error": "Not an image file"
                }
            
            # Extract filename from URL to check for suspicious names
            url_path = urlparse(image_url).path
            filename = os.path.basename(url_path).lower()
            
            # Check filename for NSFW indicators
            nsfw_probability = 0.0
            detected_keywords = []
            
            # Check filename against NSFW keywords
            for keyword in self.nsfw_categories + self.violence_categories:
                if keyword in filename:
                    nsfw_probability = max(nsfw_probability, 0.7)  # Filename match gives high probability
                    detected_keywords.append(keyword)
            
            # If we have OpenCV available, try to analyze the image
            if CV2_AVAILABLE:
                # Download the image
                img_response = requests.get(image_url)
                img_array = np.frombuffer(img_response.content, np.uint8)
                img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                
                if img is not None:
                    # Calculate color distribution - NSFW content often has specific skin tone distributions
                    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
                    
                    # Skin tone detection (simplified approach)
                    lower_skin = np.array([0, 20, 70], dtype=np.uint8)
                    upper_skin = np.array([20, 150, 255], dtype=np.uint8)
                    skin_mask = cv2.inRange(hsv, lower_skin, upper_skin)
                    
                    # Calculate percentage of skin tone pixels
                    skin_percentage = np.count_nonzero(skin_mask) / (img.shape[0] * img.shape[1])
                    
                    # High skin percentage might indicate NSFW content
                    if skin_percentage > 0.5:
                        nsfw_probability = max(nsfw_probability, skin_percentage * 0.6)
                        detected_keywords.append("high skin tone percentage")
            
            return {
                "nsfw_probability": nsfw_probability,
                "detected_objects": detected_keywords
            }
                
        except Exception as e:
            print(f"Local image analysis error: {str(e)}")
            return {
                "nsfw_probability": 0.0,
                "detected_objects": [],
                "error": str(e)
            }

    def _is_valid_image_url(self, url):
        """
        Check if a URL points to a valid image
        """
        try:
            # Check URL format
            result = urlparse(url)
            if not all([result.scheme, result.netloc]):
                return False
                
            # Check common image extensions
            image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
            path = result.path.lower()
            
            if any(path.endswith(ext) for ext in image_extensions):
                return True
                
            # If no extension, try to get headers
            try:
                response = requests.head(url, timeout=3)
                content_type = response.headers.get('Content-Type', '')
                return 'image/' in content_type
            except:
                return False
                
        except:
            return False


def analyze_image_with_yolo(image_url):
    """
    Analyze an image for NSFW/harmful content using YOLO
    Returns analysis results with NSFW probability and detected objects
    """
    detector = YOLODetector()
    return detector.analyze_image(image_url)


# For testing
if __name__ == "__main__":
    test_urls = [
        "https://example.com/test.jpg",
        "https://example.com/nsfw_image.jpg"
    ]
    
    for url in test_urls:
        result = analyze_image_with_yolo(url)
        print(f"URL: {url}")
        print(f"NSFW Probability: {result['nsfw_probability']}")
        print(f"Detected Objects: {result['detected_objects']}")
        if 'error' in result:
            print(f"Error: {result['error']}")
        print("---")
