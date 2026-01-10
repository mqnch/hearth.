import os
import json
import base64
import requests
from io import BytesIO
from typing import Dict, Optional, Any, Union
from urllib.parse import urlparse
from PIL import Image
from dotenv import load_dotenv
import google.generativeai as genai

# Load API Keys
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# ============================================================================
# CONFIGURATION CONSTANTS
# ============================================================================

# Gemini Configuration
MODEL_NAME = "models/gemini-2.5-flash"  # Alternative: "models/gemini-2.5-pro" for maximum capability
GEMINI_GENERATION_CONFIG = {
    "temperature": 0.4,
    "top_p": 0.95,
    "top_k": 64,
    "max_output_tokens": 8192,
    "response_mime_type": "application/json",
}

# Stability AI Configuration
STABILITY_API_URL = "https://api.stability.ai/v2beta/stable-image/edit/search-and-replace"
STABILITY_API_TIMEOUT = 60  # seconds
STABILITY_OUTPUT_FORMAT = "webp"
DENOISING_STRENGTH_ERASE = "0.75"  # High denoising strength to regenerate background
DENOISING_STRENGTH_CONSTRUCT = "0.6"  # Moderate denoising strength for construction
MASK_PADDING = "7"  # 5-10 pixel range, using 7 as middle

# Image Processing Configuration
MAX_IMAGE_SIZE_MB = 10
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

# Feasibility Score Weights (0-100 scale, where higher = more feasible)
FEASIBILITY_SCORE_WEIGHTS = {
    "cost": {
        "max_points": 40,
        "ranges": [
            (0, 5000, 40),
            (5001, 15000, 30),
            (15001, 30000, 20),
            (30001, 50000, 10),
            (50001, float('inf'), 0),
        ]
    },
    "complexity": {
        "max_points": 30,
        "non_structural": 30,  # Single-pass
        "structural": 15,  # Two-pass, requires removal
        "major_structural": 0,  # Multi-component
    },
    "barrier_type": {
        "max_points": 20,
        "simple_additions": 20,  # Grab bars, signage
        "moderate_changes": 15,  # Ramps, wider doorways
        "complex_changes": 5,  # Lifts, major structural
    },
    "time_scope": {
        "max_points": 10,
        "quick_fix": 10,  # < 1 week
        "standard": 7,  # 1-4 weeks
        "major": 3,  # 1-3 months
        "extensive": 0,  # 3+ months
    }
}

# Initialize Gemini Model
model = genai.GenerativeModel(
    model_name=MODEL_NAME,
    generation_config=GEMINI_GENERATION_CONFIG,
)

# ============================================================================
# VALIDATION HELPERS
# ============================================================================

def _validate_image_url(image_url: str) -> None:
    """Validates that the image URL is properly formatted.
    
    Args:
        image_url: The URL to validate
        
    Raises:
        ValueError: If the URL is invalid
    """
    if not image_url or not isinstance(image_url, str):
        raise ValueError("Image URL must be a non-empty string")
    
    try:
        parsed = urlparse(image_url)
        if not parsed.scheme or not parsed.netloc:
            raise ValueError(f"Invalid URL format: {image_url}")
    except Exception as e:
        raise ValueError(f"Invalid URL format: {image_url}") from e


def _validate_image_size(image_data: bytes) -> None:
    """Validates that the image size is within acceptable limits.
    
    Args:
        image_data: The image bytes to validate
        
    Raises:
        ValueError: If the image is too large
    """
    if len(image_data) > MAX_IMAGE_SIZE_BYTES:
        size_mb = len(image_data) / (1024 * 1024)
        raise ValueError(
            f"Image size ({size_mb:.2f} MB) exceeds maximum allowed size "
            f"({MAX_IMAGE_SIZE_MB} MB)"
        )


def _validate_audit_response(audit_data: Dict[str, Any]) -> Dict[str, Any]:
    """Validates and ensures all required fields are present in audit response.
    
    Args:
        audit_data: The audit data dictionary from Gemini
        
    Returns:
        Validated audit data with defaults for missing optional fields
        
    Raises:
        ValueError: If required fields are missing
    """
    required_fields = [
        "barrier_detected",
        "renovation_suggestion",
        "estimated_cost_usd",
        "compliance_note",
        "build_mask",
        "build_prompt",
        "mask_prompt",
        "image_gen_prompt",
    ]
    
    missing_fields = [field for field in required_fields if field not in audit_data]
    if missing_fields:
        raise ValueError(
            f"Missing required fields in audit response: {', '.join(missing_fields)}"
        )
    
    # Set defaults for optional two-pass fields if not present
    audit_data.setdefault("clear_mask", "")
    audit_data.setdefault("clear_prompt", "")
    
    # Validate cost is a number
    if not isinstance(audit_data.get("estimated_cost_usd"), (int, float)):
        raise ValueError("estimated_cost_usd must be a number")
    
    # Ensure cost is non-negative
    if audit_data["estimated_cost_usd"] < 0:
        audit_data["estimated_cost_usd"] = 0
    
    return audit_data


# ============================================================================
# CORE FUNCTIONS
# ============================================================================

def get_image_bytes(image_url: str) -> bytes:
    """Downloads an image and returns its raw bytes.
    
    Args:
        image_url: The URL of the image to download
        
    Returns:
        The raw image bytes
        
    Raises:
        ValueError: If the URL is invalid
        requests.RequestException: If the download fails
        TimeoutError: If the request times out
    """
    _validate_image_url(image_url)
    
    try:
        response = requests.get(image_url, timeout=STABILITY_API_TIMEOUT)
        response.raise_for_status()
        
        image_data = response.content
        _validate_image_size(image_data)
        
        return image_data
    except requests.Timeout:
        raise TimeoutError(f"Request timed out while downloading image from {image_url}")
    except requests.RequestException as e:
        raise requests.RequestException(
            f"Failed to download image from {image_url}: {str(e)}"
        ) from e

def calculate_feasibility_score(audit_data: Dict[str, Any]) -> int:
    """Calculates a feasibility score (0-100) based on renovation complexity.
    
    Higher score = more feasible. Factors include:
    - Cost (0-40 points)
    - Complexity (0-30 points)
    - Barrier type (0-20 points)
    - Time/scope (0-10 points)
    
    Args:
        audit_data: The audit data dictionary containing renovation information
        
    Returns:
        An integer feasibility score from 0-100
    """
    score = 0
    weights = FEASIBILITY_SCORE_WEIGHTS
    
    # Cost Factor (0-40 points)
    cost = audit_data.get("estimated_cost_usd", 0)
    if not isinstance(cost, (int, float)):
        cost = 0
    
    for min_cost, max_cost, points in weights["cost"]["ranges"]:
        if min_cost <= cost <= max_cost:
            score += points
            break
    
    # Complexity Factor (0-30 points)
    clear_mask = audit_data.get("clear_mask", "")
    renovation_suggestion = audit_data.get("renovation_suggestion", "").lower()
    
    # Determine if structural (requires removal)
    is_structural = bool(clear_mask and clear_mask.strip())
    
    # Check for major structural indicators
    major_structural_keywords = ["lift", "elevator", "platform", "major structural", "foundation"]
    is_major_structural = any(keyword in renovation_suggestion for keyword in major_structural_keywords)
    
    if is_major_structural:
        score += weights["complexity"]["major_structural"]
    elif is_structural:
        score += weights["complexity"]["structural"]
    else:
        score += weights["complexity"]["non_structural"]
    
    # Barrier Type Factor (0-20 points)
    barrier = audit_data.get("barrier_detected", "").lower()
    suggestion = renovation_suggestion.lower()
    
    # Simple additions
    simple_keywords = ["grab bar", "signage", "sign", "handle", "lever"]
    if any(keyword in suggestion for keyword in simple_keywords):
        score += weights["barrier_type"]["simple_additions"]
    # Moderate changes
    elif any(keyword in suggestion for keyword in ["ramp", "wider", "doorway", "threshold"]):
        score += weights["barrier_type"]["moderate_changes"]
    # Complex changes
    else:
        score += weights["barrier_type"]["complex_changes"]
    
    # Time/Scope Factor (0-10 points)
    # Estimate based on cost and complexity
    if cost < 5000 and not is_structural:
        score += weights["time_scope"]["quick_fix"]
    elif cost < 30000 and not is_major_structural:
        score += weights["time_scope"]["standard"]
    elif cost < 50000:
        score += weights["time_scope"]["major"]
    else:
        score += weights["time_scope"]["extensive"]
    
    # Ensure score is within 0-100 range
    return max(0, min(100, score))


def audit_room(image_url: str) -> Dict[str, Any]:
    """Performs a spatial audit of a room for accessibility.
    
    Analyzes the image using Gemini to identify accessibility barriers and
    suggests renovations with AODA compliance standards.
    
    Args:
        image_url: The URL of the image to analyze
        
    Returns:
        A dictionary containing:
        - barrier_detected: The accessibility issue found
        - renovation_suggestion: The recommended fix
        - estimated_cost_usd: Estimated cost in USD
        - compliance_note: AODA compliance standards and regulations
        - clear_mask: Mask prompt for Pass 1 (erase) if structural
        - clear_prompt: Image gen prompt for Pass 1 if structural
        - build_mask: Mask prompt for Pass 2
        - build_prompt: Image gen prompt for Pass 2
        - mask_prompt: Backward compatible mask prompt
        - image_gen_prompt: Backward compatible image gen prompt
        - feasibility_score: Calculated feasibility score (0-100)
        
    Raises:
        ValueError: If the URL is invalid or response is malformed
        requests.RequestException: If image download fails
        Exception: If Gemini API call fails
    """
    try:
        image_data = get_image_bytes(image_url)
        img = Image.open(BytesIO(image_data))

        prompt = """You are an expert Accessibility Architect (AODA compliant). Analyze this real estate photo.
Identify the single most critical accessibility barrier (e.g., stairs, narrow doorway, high tub, bathroom vanity).
Return a strict JSON object with these keys:
- barrier_detected: string (The issue found)
- renovation_suggestion: string (The fix, e.g., 'Install vertical platform lift')
- estimated_cost_usd: integer (Rough estimate)
- compliance_note: string (MUST reference specific AODA (Accessibility for Ontarians with Disabilities Act) standards and regulations, e.g., 'AODA Section 4.1.3: Minimum clear width of 920mm for doorways', 'AODA Section 4.2.1: Maximum 1:12 slope ratio for ramps', 'AODA Section 4.3.2: Grab bar height requirements of 33-36 inches above floor', 'AODA Section 4.4.1: Accessible route requirements')
- clear_mask: string (For structural renovations requiring removal: describe the object to be removed, e.g., "the bathroom vanity cabinet". For non-structural renovations, use empty string "")
- clear_prompt: string (For structural renovations: describe what should replace the removed object, e.g., "empty matching floor and wall, seamless transition". For non-structural renovations, use empty string "")
- build_mask: string (MUST describe a wider area that includes where the new feature will be AND the adjacent ground/floor space surrounding it on both sides. This gives the AI enough pixel space to draw railings and other safety features. Example: 'the floating sink area and surrounding wall space' or 'the concrete stairs and the ground area immediately surrounding them on both sides')
- build_prompt: string (MUST start with the most critical visual elements first, especially safety features like railings, ramps, and structural elements. Front-load these details at the very beginning of the prompt. Example: 'Black metal railings on both sides of a modern wooden ramp with 1:12 slope, photorealistic, 8k, cinematic lighting, matching original siding style' - notice how 'Black metal railings' comes FIRST)
- mask_prompt: string (For backward compatibility: same as build_mask if structural renovation, otherwise describe the area to modify)
- image_gen_prompt: string (For backward compatibility: same as build_prompt if structural renovation, otherwise the prompt for the image generator)"""

        response = model.generate_content([prompt, img])
        audit_data = json.loads(response.text)
        
        # Validate response
        audit_data = _validate_audit_response(audit_data)
        
        # Calculate feasibility score
        audit_data["feasibility_score"] = calculate_feasibility_score(audit_data)
        
        return audit_data
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse JSON response from Gemini: {str(e)}") from e
    except ValueError:
        raise  # Re-raise validation errors as-is
    except Exception as e:
        raise Exception(f"Audit failed: {str(e)}") from e

def generate_renovation(
    image_url: str,
    prompt: str,
    mask_prompt: str,
    is_two_pass: bool = False,
    clear_mask: Optional[str] = None,
    clear_prompt: Optional[str] = None,
    build_mask: Optional[str] = None,
    build_prompt: Optional[str] = None
) -> Optional[bytes]:
    """Uses Stability AI's Search-and-Replace to visualize the change.
    
    Supports two-pass workflow for structural renovations:
    - Pass 1 (Erase): Removes structural elements with high denoising strength
    - Pass 2 (Construct): Adds new accessible features with moderate denoising strength
    
    Args:
        image_url: The URL of the original image
        prompt: The image generation prompt (for single-pass or backward compatibility)
        mask_prompt: The mask prompt (for single-pass or backward compatibility)
        is_two_pass: Whether to use two-pass workflow
        clear_mask: Mask prompt for Pass 1 (erase) if two-pass
        clear_prompt: Image gen prompt for Pass 1 if two-pass
        build_mask: Mask prompt for Pass 2 (construct) if two-pass
        build_prompt: Image gen prompt for Pass 2 if two-pass
        
    Returns:
        The generated image bytes, or None if generation fails
        
    Raises:
        ValueError: If required parameters are missing
        requests.RequestException: If API request fails
        TimeoutError: If request times out
    """
    stability_key = os.getenv('STABILITY_KEY')
    if not stability_key:
        raise ValueError("STABILITY_KEY environment variable is not set")
    
    headers = {
        "authorization": f"Bearer {stability_key}",
        "accept": "image/*"
    }
    
    # Two-pass workflow for structural renovations
    if is_two_pass and clear_mask and clear_prompt and build_mask and build_prompt:
        try:
            # Pass 1: Erase the object to be removed
            image_data = get_image_bytes(image_url)
            
            print(f"[Pass 1 - Erase] Mask Prompt: {clear_mask}")
            print(f"[Pass 1 - Erase] Image Gen Prompt: {clear_prompt}")
            
            files_pass1 = {
                "image": ("image.webp", image_data, "image/webp")
            }
            
            data_pass1 = {
                "prompt": clear_prompt,
                "search_prompt": clear_mask,
                "output_format": STABILITY_OUTPUT_FORMAT,
                "strength": DENOISING_STRENGTH_ERASE,
                "grow_mask": MASK_PADDING,
            }
            
            response_pass1 = requests.post(
                STABILITY_API_URL,
                headers=headers,
                files=files_pass1,
                data=data_pass1,
                timeout=STABILITY_API_TIMEOUT
            )
            
            if response_pass1.status_code != 200:
                # If Pass 1 fails, log error and fall back to single-pass if possible
                try:
                    error_data = response_pass1.json()
                    print(f"[Pass 1 - Erase] Stability AI Error ({response_pass1.status_code}): {error_data}")
                except:
                    print(f"[Pass 1 - Erase] Stability AI Error ({response_pass1.status_code}): {response_pass1.text}")
                
                # Fall back to single-pass mode if mask_prompt and prompt are available
                if mask_prompt and prompt:
                    print("[Pass 1 - Erase] Falling back to single-pass mode")
                    return _single_pass_renovation(image_url, prompt, mask_prompt, headers)
                return None
            
            # Store Pass 1 result as intermediate image
            intermediate_image_bytes = response_pass1.content
            
            # Pass 2: Construct the new accessible features
            print(f"[Pass 2 - Construct] Mask Prompt: {build_mask}")
            print(f"[Pass 2 - Construct] Image Gen Prompt: {build_prompt}")
            
            files_pass2 = {
                "image": ("image.webp", intermediate_image_bytes, "image/webp")
            }
            
            data_pass2 = {
                "prompt": build_prompt,
                "search_prompt": build_mask,
                "output_format": STABILITY_OUTPUT_FORMAT,
                "strength": DENOISING_STRENGTH_CONSTRUCT,
                "grow_mask": MASK_PADDING,
            }
            
            response_pass2 = requests.post(
                STABILITY_API_URL,
                headers=headers,
                files=files_pass2,
                data=data_pass2,
                timeout=STABILITY_API_TIMEOUT
            )
            
            if response_pass2.status_code == 200:
                return response_pass2.content
            else:
                # If Pass 2 fails, return Pass 1 result with warning
                try:
                    error_data = response_pass2.json()
                    print(f"[Pass 2 - Construct] Stability AI Error ({response_pass2.status_code}): {error_data}")
                except:
                    print(f"[Pass 2 - Construct] Stability AI Error ({response_pass2.status_code}): {response_pass2.text}")
                print("[Pass 2 - Construct] Warning: Returning Pass 1 result (erased but not constructed)")
                return intermediate_image_bytes
                
        except requests.Timeout:
            print("Two-pass renovation timed out")
            # Fall back to single-pass mode if mask_prompt and prompt are available
            if mask_prompt and prompt:
                print("Falling back to single-pass mode")
                return _single_pass_renovation(image_url, prompt, mask_prompt, headers)
            return None
        except Exception as e:
            # Handle network errors or other exceptions
            print(f"Two-pass renovation failed: {str(e)}")
            # Fall back to single-pass mode if mask_prompt and prompt are available
            if mask_prompt and prompt:
                print("Falling back to single-pass mode")
                return _single_pass_renovation(image_url, prompt, mask_prompt, headers)
            return None
    
    # Single-pass workflow (backward compatible)
    if not prompt or not mask_prompt:
        raise ValueError("prompt and mask_prompt are required for single-pass workflow")
    
    return _single_pass_renovation(image_url, prompt, mask_prompt, headers)


def _single_pass_renovation(
    image_url: str,
    prompt: str,
    mask_prompt: str,
    headers: Dict[str, str]
) -> Optional[bytes]:
    """Helper function for single-pass renovation workflow.
    
    Args:
        image_url: The URL of the original image
        prompt: The image generation prompt
        mask_prompt: The mask prompt
        headers: HTTP headers for the API request
        
    Returns:
        The generated image bytes, or None if generation fails
        
    Raises:
        requests.RequestException: If API request fails
        TimeoutError: If request times out
    """
    image_data = get_image_bytes(image_url)
    
    files = {
        "image": ("image.webp", image_data, "image/webp")
    }
    
    data = {
        "prompt": prompt,
        "search_prompt": mask_prompt,
        "output_format": STABILITY_OUTPUT_FORMAT,
    }

    # Log the prompts being sent to Stability AI for debugging
    print(f"[Stability AI] Image Gen Prompt: {prompt}")
    print(f"[Stability AI] Mask Prompt: {mask_prompt}")

    try:
        response = requests.post(
            STABILITY_API_URL,
            headers=headers,
            files=files,
            data=data,
            timeout=STABILITY_API_TIMEOUT
        )
        
        if response.status_code == 200:
            return response.content
        else:
            # If visual gen fails, we still want the audit, so we log the error
            try:
                error_data = response.json()
                print(f"Stability AI Error ({response.status_code}): {error_data}")
            except:
                print(f"Stability AI Error ({response.status_code}): {response.text}")
            return None
    except requests.Timeout:
        print(f"Stability AI request timed out after {STABILITY_API_TIMEOUT} seconds")
        return None
    except requests.RequestException as e:
        # Handle network errors or other exceptions
        print(f"Stability AI request failed: {str(e)}")
        return None