import os
import cv2
import numpy as np
import requests
from PIL import Image
from io import BytesIO

class ViolenceDetector:
    def __init__(self):
        self.api_url = "https://detect.roboflow.com/nsfw-v2/1"
        self.api_key = os.getenv("YOLO-API", "")
        self.confidence_threshold = 0.5

        self.violence_categories = [
            "blood", "gore", "weapon", "gun", "knife", "injury",
            "dead body", "violence", "wound", "graphic", "murder",
            "fight", "corpse", "burn", "kill", "torture", "assault"
        ]

    def _detect_online(self, image_path):
        try:
            image = Image.open(image_path).convert("RGB")
            buffered = BytesIO()
            image.save(buffered, format="JPEG")
            img_bytes = buffered.getvalue()

            response = requests.post(
                f"{self.api_url}?api_key={self.api_key}",
                files={"file": img_bytes},
                timeout=10
            )
            data = response.json()

            if "predictions" not in data:
                return 0, []

            score = 0
            detected_keywords = []

            for pred in data["predictions"]:
                label = pred["class"].lower()
                confidence = pred["confidence"]

                if any(cat in label for cat in self.violence_categories):
                    detected_keywords.append(label)
                    score = max(score, confidence)

            return score, detected_keywords
        except Exception as e:
            print(f"API detection failed: {e}")
            return None, []

    def _local_analysis(self, image_path):
        try:
            img = cv2.imread(image_path)
            if img is None:
                return 0, []

            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            nsfw_probability = 0
            detected_keywords = []

            filename = os.path.basename(image_path).lower()
            if any(cat in filename for cat in self.violence_categories):
                nsfw_probability += 0.3
                detected_keywords.append("filename-match")

            lower_skin = np.array([0, 48, 80], dtype=np.uint8)
            upper_skin = np.array([20, 255, 255], dtype=np.uint8)
            skin_mask = cv2.inRange(hsv, lower_skin, upper_skin)
            skin_percentage = np.count_nonzero(skin_mask) / (img.shape[0] * img.shape[1])
            if skin_percentage > 0.2:
                nsfw_probability += skin_percentage * 0.5
                detected_keywords.append("skin")

            lower_red1 = np.array([0, 70, 50], dtype=np.uint8)
            upper_red1 = np.array([10, 255, 255], dtype=np.uint8)
            lower_red2 = np.array([160, 70, 50], dtype=np.uint8)
            upper_red2 = np.array([180, 255, 255], dtype=np.uint8)
            red_mask = cv2.inRange(hsv, lower_red1, upper_red1) | cv2.inRange(hsv, lower_red2, upper_red2)
            red_percentage = np.count_nonzero(red_mask) / (img.shape[0] * img.shape[1])
            if red_percentage > 0.2:
                nsfw_probability = max(nsfw_probability, red_percentage * 0.6)
                detected_keywords.append("high red region (possible blood)")

            return nsfw_probability, detected_keywords
        except Exception as e:
            print(f"Local detection failed: {e}")
            return 0, []

    def analyze_image(self, image_path):
        online_score, online_tags = self._detect_online(image_path)
        if online_score is None or online_score < self.confidence_threshold:
            print("Fallback to local detection...")
            local_score, local_tags = self._local_analysis(image_path)
            return local_score, local_tags
        return online_score, online_tags
