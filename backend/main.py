from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import base64
import asyncio
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
import google.genai as genai
from services import audit_room, generate_renovation
from scraper import scrape_realtor_ca_listing, get_property_images

# Load environment variables from .env file
load_dotenv()

# Verify environment variables are loaded (for later use)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize FastAPI app
app = FastAPI()

# Thread pool for running synchronous code in async context
executor = ThreadPoolExecutor(max_workers=3)

# In-memory cache for generated images
# Key: hash of (image_url + image_gen_prompt + mask_prompt + two_pass params)
# Value: { "renovated_image": base64_string, "original_url": str }
image_generation_cache: dict[str, dict] = {}
 
# Add CORS middleware to allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request validation
class AnalyzeRequest(BaseModel):
    image_url: str
    wheelchair_accessible: bool = False

class ListingUrlRequest(BaseModel):
    listing_url: str
    max_images: int = 5  # Limit number of images to analyze (cost control)
    wheelchair_accessible: bool = False

class TestRenovationRequest(BaseModel):
    image_url: str
    image_gen_prompt: str
    mask_prompt: str

class GenerateRenovationRequest(BaseModel):
    image_url: str
    audit_data: dict  # Pass the full audit result from the listing analysis
    wheelchair_accessible: bool = False

# Health check endpoint
@app.get("/health")
async def health():
    return {"status": "healthy"}

# List available Gemini models
@app.get("/models")
async def list_models():
    """List all available Gemini models for your API key."""
    try:
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        models = client.models.list()
        
        # Filter and format model information
        available_models = []
        for model in models:
            available_models.append({
                "name": model.name,
                "display_name": getattr(model, 'display_name', model.name),
                "description": getattr(model, 'description', ''),
            })
        
        return {
            "available_models": available_models,
            "total_count": len(available_models)
        }
    except Exception as e:
        return {
            "error": f"Failed to list models: {str(e)}",
            "available_models": []
        }

# Analyze endpoint - orchestrates audit and image generation
@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    try:
        # Step 1: Perform accessibility audit using Gemini
        audit_data = audit_room(request.image_url, wheelchair_accessible=request.wheelchair_accessible)
        
        # Step 2: Extract prompts from audit
        image_gen_prompt = audit_data.get("image_gen_prompt")
        mask_prompt = audit_data.get("mask_prompt")
        
        # Extract two-pass fields
        clear_mask = audit_data.get("clear_mask", "")
        clear_prompt = audit_data.get("clear_prompt", "")
        build_mask = audit_data.get("build_mask", "")
        build_prompt = audit_data.get("build_prompt", "")
        
        # Determine if two-pass workflow should be used
        is_two_pass = bool(
            clear_mask and 
            clear_prompt and 
            build_mask and 
            build_prompt
        )
        
        # Step 3: Generate renovated image using Gemini 3 Pro Image
        renovated_image_bytes = None
        renovated_image_base64 = None
        
        if is_two_pass or (image_gen_prompt and mask_prompt):
            try:
                renovated_image_bytes = generate_renovation(
                    request.image_url,
                    image_gen_prompt,
                    mask_prompt,
                    is_two_pass=is_two_pass,
                    clear_mask=clear_mask if is_two_pass else None,
                    clear_prompt=clear_prompt if is_two_pass else None,
                    build_mask=build_mask if is_two_pass else None,
                    build_prompt=build_prompt if is_two_pass else None,
                    wheelchair_accessible=request.wheelchair_accessible
                )
                
                # Step 4: Encode image to base64 (Gemini returns JPEG based on JFIF signature)
                if renovated_image_bytes:
                    base64_encoded = base64.b64encode(renovated_image_bytes).decode('utf-8')
                    renovated_image_base64 = f"data:image/jpeg;base64,{base64_encoded}"
            except Exception as e:
                # If image generation fails, log error but continue with audit data
                print(f"Image generation error: {str(e)}")
                renovated_image_base64 = None
        
        # Return response with audit and image (or null if generation failed)
        return {
            "audit": audit_data,
            "image_data": renovated_image_base64
        }
        
    except Exception as e:
        # If audit fails, return error response
        return {
            "error": f"Analysis failed: {str(e)}",
            "audit": None
        }

# Test endpoint for generate_renovation (Phase 3 testing)
@app.post("/test-renovation")
async def test_renovation(request: TestRenovationRequest):
    """Test endpoint for generate_renovation function. Returns base64-encoded image."""
    try:
        # Call generate_renovation with provided parameters
        renovated_image_bytes = generate_renovation(
            request.image_url,
            request.image_gen_prompt,
            request.mask_prompt
        )
        
        if renovated_image_bytes:
            # Encode image to base64 (Gemini returns JPEG based on JFIF signature)
            base64_encoded = base64.b64encode(renovated_image_bytes).decode('utf-8')
            return {
                "success": True,
                "image_base64": f"data:image/jpeg;base64,{base64_encoded}",
                "message": "Image generated successfully"
            }
        else:
            return {
                "success": False,
                "image_base64": None,
                "message": "Image generation failed. Check server logs for details."
            }
    except Exception as e:
        return {
            "success": False,
            "error": f"Renovation test failed: {str(e)}",
            "image_base64": None
        }

# NEW: Analyze from Realtor.ca listing URL (AUDIT ONLY - no image generation)
@app.post("/analyze-from-listing")
async def analyze_from_listing(request: ListingUrlRequest):
    """
    Scrape a Realtor.ca listing and audit all property images for accessibility.
    Does NOT generate renovation images - those are generated on-demand via /generate-renovation.

    Args:
        listing_url: Full URL to a Realtor.ca listing
        max_images: Maximum number of images to analyze (default: 5)

    Returns:
        {
            "property_info": {...},  # Address, price, neighborhood, etc.
            "images_analyzed": int,
            "results": [
                {
                    "image_number": 1,
                    "original_url": "...",
                    "audit": {
                        "barrier": "...",
                        "cost_estimate": "...",
                        "compliance_notes": "...",
                        ...
                    }
                }
            ]
        }
    """
    try:
        # Step 1: Scrape the listing (run in thread pool to avoid blocking async loop)
        print(f"Scraping listing: {request.listing_url}")
        loop = asyncio.get_event_loop()
        listing_data = await loop.run_in_executor(
            executor,
            scrape_realtor_ca_listing,
            request.listing_url
        )

        if "error" in listing_data:
            return {
                "error": f"Failed to scrape listing: {listing_data['error']}",
                "property_info": None,
                "results": []
            }

        # Step 2: Get property images
        image_urls = listing_data.get("property_photos", [])

        if not image_urls:
            # Provide more detailed error message
            basic_info = listing_data.get("basic_info", {})
            address = basic_info.get("address", "Unknown")

            error_msg = "No images found in listing. "
            if address == "Unknown" or not address:
                error_msg += "The page might be blocked by robot detection or the listing URL is invalid. Try a different listing or check if the scraper browser window opened successfully."
            else:
                error_msg += f"Found property at '{address}' but no photos were extracted. The listing might have no photos or the page structure changed."

            return {
                "error": error_msg,
                "property_info": basic_info,
                "results": [],
                "total_images_found": 0,
                "images_analyzed": 0
            }

        # Limit number of images to analyze
        images_to_analyze = image_urls[:request.max_images]
        print(f"Analyzing {len(images_to_analyze)} images (out of {len(image_urls)} total)")

        # Step 3: Audit each image (NO generation yet)
        results = []
        for idx, image_url in enumerate(images_to_analyze, 1):
            try:
                print(f"Auditing image {idx}/{len(images_to_analyze)}...")

                # Run audit only
                audit_data = audit_room(image_url, wheelchair_accessible=request.wheelchair_accessible)

                results.append({
                    "image_number": idx,
                    "original_url": image_url,
                    "audit": audit_data
                })

            except Exception as e:
                print(f"Error auditing image {idx}: {str(e)}")
                results.append({
                    "image_number": idx,
                    "original_url": image_url,
                    "error": str(e),
                    "audit": None
                })

        # Step 4: Return comprehensive report with property info
        return {
            "property_info": {
                "address": listing_data.get("basic_info", {}).get("address", "Unknown"),
                "price": listing_data.get("basic_info", {}).get("price", "Unknown"),
                "bedrooms": listing_data.get("basic_info", {}).get("bedrooms", "Unknown"),
                "bathrooms": listing_data.get("basic_info", {}).get("bathrooms", "Unknown"),
                "square_feet": listing_data.get("basic_info", {}).get("square_feet", "Unknown"),
                "mls_number": listing_data.get("basic_info", {}).get("mls_number", "Unknown"),
                "neighborhood": listing_data.get("neighborhood", {}).get("name", "Unknown"),
                "location": listing_data.get("neighborhood", {}).get("location_description", ""),
                "amenities": listing_data.get("neighborhood", {}).get("amenities", []),
            },
            "total_images_found": len(image_urls),
            "images_analyzed": len(results),
            "results": results
        }

    except Exception as e:
        return {
            "error": f"Failed to analyze listing: {str(e)}",
            "property_info": None,
            "results": []
        }

# NEW: Generate renovation image on-demand when user clicks on a photo
@app.post("/generate-renovation")
async def generate_renovation_endpoint(request: GenerateRenovationRequest):
    """
    Generate renovation image for a specific photo when user clicks on it.
    This is called on-demand to save API costs and improve UX.
    Includes caching to prevent duplicate generations for the same image+prompts.

    Args:
        image_url: URL of the original property image
        audit_data: The audit result containing prompts for image generation

    Returns:
        {
            "success": true,
            "renovated_image": "data:image/jpeg;base64,...",
            "original_url": "...",
            "cached": false  # Whether result was from cache
        }
    """
    try:
        # Extract prompts from audit data
        image_gen_prompt = request.audit_data.get("image_gen_prompt")
        mask_prompt = request.audit_data.get("mask_prompt")

        # Check for two-pass workflow
        clear_mask = request.audit_data.get("clear_mask", "")
        clear_prompt = request.audit_data.get("clear_prompt", "")
        build_mask = request.audit_data.get("build_mask", "")
        build_prompt = request.audit_data.get("build_prompt", "")

        is_two_pass = bool(clear_mask and clear_prompt and build_mask and build_prompt)

        if not image_gen_prompt or not mask_prompt:
            return {
                "success": False,
                "error": "No renovation prompts found in audit data",
                "renovated_image": None
            }

        # Create cache key from image URL and all prompt parameters
        cache_key_data = {
            "image_url": request.image_url,
            "image_gen_prompt": image_gen_prompt,
            "mask_prompt": mask_prompt,
            "is_two_pass": is_two_pass,
            "clear_mask": clear_mask if is_two_pass else "",
            "clear_prompt": clear_prompt if is_two_pass else "",
            "build_mask": build_mask if is_two_pass else "",
            "build_prompt": build_prompt if is_two_pass else "",
            "wheelchair_accessible": request.wheelchair_accessible,
        }
        cache_key = hashlib.sha256(
            json.dumps(cache_key_data, sort_keys=True).encode('utf-8')
        ).hexdigest()

        # Check cache first
        if cache_key in image_generation_cache:
            cached_result = image_generation_cache[cache_key]
            print(f"Cache HIT for: {request.image_url[:50]}...")
            return {
                "success": True,
                "renovated_image": cached_result["renovated_image"],
                "original_url": cached_result["original_url"],
                "cached": True
            }

        print(f"Cache MISS - Generating renovation for: {request.image_url}")

        # Generate the renovation image
        renovated_image_bytes = generate_renovation(
            request.image_url,
            image_gen_prompt,
            mask_prompt,
            is_two_pass=is_two_pass,
            clear_mask=clear_mask if is_two_pass else None,
            clear_prompt=clear_prompt if is_two_pass else None,
            build_mask=build_mask if is_two_pass else None,
            build_prompt=build_prompt if is_two_pass else None,
            wheelchair_accessible=request.wheelchair_accessible
        )

        if renovated_image_bytes:
            # Encode to base64
            base64_encoded = base64.b64encode(renovated_image_bytes).decode('utf-8')
            renovated_image_base64 = f"data:image/jpeg;base64,{base64_encoded}"

            # Store in cache
            image_generation_cache[cache_key] = {
                "renovated_image": renovated_image_base64,
                "original_url": request.image_url
            }
            print(f"Cached result for key: {cache_key[:16]}... (cache size: {len(image_generation_cache)})")

            return {
                "success": True,
                "renovated_image": renovated_image_base64,
                "original_url": request.image_url,
                "cached": False
            }
        else:
            return {
                "success": False,
                "error": "Image generation returned no data",
                "renovated_image": None
            }

    except Exception as e:
        print(f"Error generating renovation: {str(e)}")
        return {
            "success": False,
            "error": f"Generation failed: {str(e)}",
            "renovated_image": None
        }

