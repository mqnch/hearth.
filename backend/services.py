import os
import json
import base64
import requests
from io import BytesIO
from typing import Dict, Optional, Any, Union
from urllib.parse import urlparse
from PIL import Image
from dotenv import load_dotenv

# Google AI Libraries
import google.genai as genai_client  # For all Gemini operations
from google.genai import types as genai_types

# Load API Keys
load_dotenv()

# Initialize Gemini Client (used for both text analysis and image generation)
gemini_client = genai_client.Client(api_key=os.getenv("GEMINI_API_KEY"))

# ============================================================================
# CONFIGURATION CONSTANTS
# ============================================================================

# Gemini Configuration
GEMINI_TEXT_MODEL = "gemini-3-pro-preview" # Flash-optimized for speed

# Gemini Image Generation Configuration
GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"
GEMINI_IMAGE_TIMEOUT = 60  # Reduced for Flash-optimized speed

# Image Processing Configuration
MAX_IMAGE_SIZE_MB = 10
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

# Accessibility Score Weights (0-100 scale, where higher = more accessible after renovation)
ACCESSIBILITY_SCORE_WEIGHTS = {
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
        response = requests.get(image_url, timeout=GEMINI_IMAGE_TIMEOUT)
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

def calculate_accessibility_score(audit_data: Dict[str, Any]) -> int:
    """Calculates an accessibility score (0-100) based on renovation impact.
    
    Higher score = more accessible after renovation. Factors include:
    - Cost effectiveness (0-40 points) - lower cost renovations that improve accessibility
    - Implementation complexity (0-30 points) - simpler renovations are more likely to be completed
    - Barrier type impact (0-20 points) - effectiveness of addressing the barrier
    - Time/scope (0-10 points) - quicker implementations improve accessibility sooner
    
    Args:
        audit_data: The audit data dictionary containing renovation information
        
    Returns:
        An integer accessibility score from 0-100
    """
    score = 0
    weights = ACCESSIBILITY_SCORE_WEIGHTS
    
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
        - accessibility_score: Calculated accessibility score (0-100)
        
    Raises:
        ValueError: If the URL is invalid or response is malformed
        requests.RequestException: If image download fails
        Exception: If Gemini API call fails
    """
    try:
        image_data = get_image_bytes(image_url)
        base64_image = base64.b64encode(image_data).decode('utf-8')
        
        # Determine MIME type from image data
        img = Image.open(BytesIO(image_data))
        mime_type = f"image/{img.format.lower()}" if img.format else "image/jpeg"

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

        # Use new google.genai client for text analysis
        # Use same format as generate_renovation for consistency
        response = gemini_client.models.generate_content(
            model=GEMINI_TEXT_MODEL,
            contents=[
                prompt,
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": base64_image
                    }
                }
            ],
            config=genai_types.GenerateContentConfig(
                response_modalities=["TEXT"],
                response_mime_type="application/json"
            )
        )
        
        # Extract text response from GenerateContentResponse
        # The response has a .text property and also candidates[0].content.parts[0].text
        try:
            # Try the .text property first (simplest)
            response_text = response.text
            
            # Fallback to candidates structure if .text is empty
            if not response_text and response.candidates and len(response.candidates) > 0:
                candidate = response.candidates[0]
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, 'text') and part.text:
                            response_text = part.text
                            break
            
            if not response_text:
                raise ValueError("No text found in Gemini response")
            
            # Parse JSON - handle both object and array formats
            parsed_json = json.loads(response_text)
            
            # If the response is an array, extract the first element
            if isinstance(parsed_json, list):
                if len(parsed_json) > 0:
                    audit_data = parsed_json[0]
                else:
                    raise ValueError("Empty array in JSON response")
            else:
                audit_data = parsed_json
                
        except json.JSONDecodeError as e:
            print(f"[DEBUG] Failed to parse JSON. Response text: {response_text[:500] if 'response_text' in locals() else 'None'}")
            raise ValueError(f"Failed to parse JSON response from Gemini: {str(e)}. Response: {response_text[:200] if 'response_text' in locals() else 'None'}") from e
        except Exception as e:
            print(f"[DEBUG] Error extracting response: {str(e)}")
            raise
        
        # Validate response
        if not audit_data:
            raise ValueError("audit_data is None after parsing")
        
        audit_data = _validate_audit_response(audit_data)
        
        # Calculate accessibility score
        audit_data["accessibility_score"] = calculate_accessibility_score(audit_data)
        
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
    """Uses Gemini 3 Pro Image to visualize accessibility renovations.
    
    Leverages Gemini's multimodal generate_content endpoint with Reasoning mode
    for enhanced spatial analysis before regenerating barrier areas with
    AODA-compliant fixes.
    
    Args:
        image_url: The URL of the original image
        prompt: The image generation prompt (what to add/change)
        mask_prompt: Description of the area to modify
        is_two_pass: Whether structural removal is needed (handled by reasoning)
        clear_mask: Description of object to remove (for structural renovations)
        clear_prompt: What to replace removed object with
        build_mask: Wider area description for construction
        build_prompt: Detailed prompt for new accessible features
        
    Returns:
        The generated image bytes, or None if generation fails
        
    Raises:
        ValueError: If required parameters are missing
        Exception: If Gemini API call fails
    """
    if not prompt or not mask_prompt:
        raise ValueError("prompt and mask_prompt are required")
    
    try:
        # Download and encode the original image
        image_data = get_image_bytes(image_url)
        base64_image = base64.b64encode(image_data).decode('utf-8')
        
        # Determine MIME type from image data
        img = Image.open(BytesIO(image_data))
        mime_type = f"image/{img.format.lower()}" if img.format else "image/jpeg"
        
        # Build reasoning prompt for spatial analysis and AODA-compliant regeneration
        if is_two_pass and clear_mask and clear_prompt and build_mask and build_prompt:
            # Structural renovation: needs removal then construction
            reasoning_prompt = f"""You are an expert accessibility architect performing a visual renovation.

STEP 1 - SPATIAL ANALYSIS:
First, carefully analyze the spatial constraints of this image. Focus on:
- The area described as: "{clear_mask}" (this needs to be removed)
- The surrounding context and boundaries
- The floor/ground plane and wall intersections
- Lighting conditions and perspective

STEP 2 - REMOVAL REASONING:
The object "{clear_mask}" must be removed and replaced with: "{clear_prompt}"
Reason about how to seamlessly blend the removal with the surrounding environment.

STEP 3 - CONSTRUCTION REASONING:
In the area described as: "{build_mask}"
Construct the following AODA-compliant accessible feature: "{build_prompt}"

Reason about:
- Proper scale and proportion relative to the space
- Safety features like railings (these are CRITICAL - include them prominently)
- How the new feature integrates with existing architectural elements
- AODA compliance requirements (slopes, widths, heights)

STEP 4 - GENERATE:
Generate a photorealistic image that shows the renovated space with the accessibility improvement.
Preserve all surrounding context exactly. Only modify the specified barrier region.
Ensure safety features like railings are clearly visible and properly positioned."""
        else:
            # Non-structural renovation: direct modification
            reasoning_prompt = f"""You are an expert accessibility architect performing a visual renovation.

STEP 1 - SPATIAL ANALYSIS:
Carefully analyze the spatial constraints of this image, focusing on:
- The area described as: "{mask_prompt}"
- The surrounding context, boundaries, and adjacent elements
- The floor/ground plane, wall positions, and perspective
- Current lighting conditions and shadows

STEP 2 - AODA COMPLIANCE REASONING:
For the area "{mask_prompt}", reason about how to implement:
"{prompt}"

Consider:
- Proper scale and proportion for accessibility (AODA standards)
- Safety features like grab bars, railings, or contrast markings
- How modifications integrate with existing architectural elements
- Maintaining visual consistency with the surrounding space

STEP 3 - GENERATE:
Generate a photorealistic image showing the accessibility improvement.
Preserve all surrounding context exactly. Only modify the specified barrier region.
Ensure any safety features are clearly visible and properly positioned per AODA guidelines."""

        print(f"[Gemini Image] Reasoning prompt constructed for: {mask_prompt}")
        print(f"[Gemini Image] Target modification: {prompt}")
        
        # Call Gemini for image generation with Flash-optimized settings
        # We prioritize speed by removing any reasoning/thinking requirements
        response = gemini_client.models.generate_content(
            model=GEMINI_IMAGE_MODEL,
            contents=[
                reasoning_prompt,
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": base64_image
                    }
                }
            ],
            config=genai_types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
                # Flash-optimized: Thinking disabled for raw speed
            )
        )
        
        # Extract the generated image from the response
        # Iterate through parts to find the actual image modality
        print(f"[DEBUG] Response type: {type(response)}")
        
        parts = []
        if response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]
            if candidate.content and candidate.content.parts:
                parts = candidate.content.parts
                print(f"[DEBUG] Found {len(parts)} parts in candidate.content.parts")
        
        # Fallback to response.parts if available
        if not parts and hasattr(response, 'parts') and response.parts:
            parts = response.parts
            print(f"[DEBUG] Found {len(parts)} parts in response.parts")
            
        if not parts:
            print(f"[DEBUG] No parts found in response or candidate. Finish reason: {getattr(response.candidates[0], 'finish_reason', 'N/A') if response.candidates else 'N/A'}")
            return None

        # Find all parts that could be images
        image_bytes = None
        for i, part in enumerate(parts):
            print(f"[DEBUG] Inspecting part {i}: type={type(part)}")
            
            # Log any text/reasoning if present
            if hasattr(part, 'text') and part.text:
                print(f"[Gemini Image] Output text: {part.text[:200]}...")
            
            # Check for image data in different possible attributes
            # 1. inline_data.data (Standard for generate_content with IMAGE modality)
            if hasattr(part, 'inline_data') and part.inline_data:
                if part.inline_data.data:
                    current_data = part.inline_data.data
                    print(f"[DEBUG] Part {i} has inline_data.data, size: {len(current_data)} bytes")
                    # If it's a significant size, it's likely our image
                    if len(current_data) > 10000:
                        image_bytes = current_data
                        break
            
            # 2. image attribute (Some SDK versions/models)
            if hasattr(part, 'image') and part.image:
                if hasattr(part.image, 'data') and part.image.data:
                    print(f"[DEBUG] Part {i} has image.data, size: {len(part.image.data)} bytes")
                    image_bytes = part.image.data
                    break
        
        if image_bytes:
            print(f"[Gemini Image] Successfully extracted image ({len(image_bytes)} bytes)")
            return image_bytes
        
        print("[Gemini Image] No image part found in response parts")
        return None
        
    except Exception as e:
        print(f"[Gemini Image] Generation failed: {str(e)}")
        return None