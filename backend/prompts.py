"""
Prompts for Gemini AI models used in accessibility analysis and renovation visualization.

Edit these prompts to adjust the behavior of the AI analysis and image generation.
"""

# ============================================================================
# AUDIT PROMPT
# ============================================================================
# This prompt is used to analyze images and identify accessibility barriers
AUDIT_PROMPT = """You are an expert Accessibility Architect (AODA compliant). Analyze this real estate photo.
Identify the single most critical accessibility barrier (e.g., stairs, narrow doorway, high tub, bathroom vanity).
Return a strict JSON object with these keys:
- barrier_detected: string (The issue found)
- renovation_suggestion: string (The fix, e.g., 'Install vertical platform lift')
- estimated_cost_usd: integer (Realistic cost estimate in USD. Use conservative, market-appropriate pricing: grab bars $50-200, ramps $500-3000, wider doorways $800-2000, platform lifts $8000-15000, bathroom modifications $2000-8000. Avoid inflated estimates - these are for residential renovations, not commercial projects)
- compliance_note: string (MUST reference specific AODA (Accessibility for Ontarians with Disabilities Act) standards and regulations, e.g., 'AODA Section 4.1.3: Minimum clear width of 920mm for doorways', 'AODA Section 4.2.1: Maximum 1:12 slope ratio for ramps', 'AODA Section 4.3.2: Grab bar height requirements of 33-36 inches above floor', 'AODA Section 4.4.1: Accessible route requirements')
- clear_mask: string (For structural renovations requiring removal: describe the object to be removed, e.g., "the bathroom vanity cabinet". For non-structural renovations, use empty string "")
- clear_prompt: string (For structural renovations: describe what should replace the removed object, e.g., "empty matching floor and wall, seamless transition". For non-structural renovations, use empty string "")
- build_mask: string (MUST describe a wider area that includes where the new feature will be AND the adjacent ground/floor space surrounding it on both sides. This gives the AI enough pixel space to draw railings and other safety features. Example: 'the floating sink area and surrounding wall space' or 'the concrete stairs and the ground area immediately surrounding them on both sides')
- build_prompt: string (MUST start with the most critical visual elements first, especially safety features like railings, ramps, and structural elements. Front-load these details at the very beginning of the prompt. Example: 'Black metal railings on both sides of a modern wooden ramp with 1:12 slope, photorealistic, 8k, cinematic lighting, matching original siding style' - notice how 'Black metal railings' comes FIRST)
- mask_prompt: string (For backward compatibility: same as build_mask if structural renovation, otherwise describe the area to modify)
- image_gen_prompt: string (For backward compatibility: same as build_prompt if structural renovation, otherwise the prompt for the image generator)"""


# ============================================================================
# IMAGE GENERATION PROMPTS
# ============================================================================

def get_structural_renovation_prompt(clear_mask: str, clear_prompt: str, build_mask: str, build_prompt: str) -> str:
    """
    Returns the reasoning prompt for structural renovations requiring removal.
    
    Args:
        clear_mask: Description of object to be removed
        clear_prompt: What should replace the removed object
        build_mask: Wider area description for construction
        build_prompt: Detailed prompt for new accessible features
        
    Returns:
        The formatted reasoning prompt for structural renovations
    """
    return f"""You are an expert accessibility architect performing a visual renovation.

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


def get_non_structural_renovation_prompt(mask_prompt: str, prompt: str) -> str:
    """
    Returns the reasoning prompt for non-structural renovations (direct modifications).
    
    Args:
        mask_prompt: Description of the area to modify
        prompt: The renovation prompt describing what to add/change
        
    Returns:
        The formatted reasoning prompt for non-structural renovations
    """
    return f"""You are an expert accessibility architect performing a visual renovation.

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

