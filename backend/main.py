from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import base64
import google.genai as genai
from services import audit_room, generate_renovation
from scraper import scrape_realtor_ca_listing, get_property_images

# Load environment variables from .env file
load_dotenv()

# Verify environment variables are loaded (for later use)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize FastAPI app
app = FastAPI()

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

class ListingUrlRequest(BaseModel):
    listing_url: str
    max_images: int = 5  # Limit number of images to analyze (cost control)

class TestRenovationRequest(BaseModel):
    image_url: str
    image_gen_prompt: str
    mask_prompt: str

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
        audit_data = audit_room(request.image_url)
        
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
                    build_prompt=build_prompt if is_two_pass else None
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

# NEW: Analyze from Realtor.ca listing URL
@app.post("/analyze-from-listing")
async def analyze_from_listing(request: ListingUrlRequest):
    """
    Scrape a Realtor.ca listing and analyze all property images for accessibility.

    Args:
        listing_url: Full URL to a Realtor.ca listing
        max_images: Maximum number of images to analyze (default: 5)

    Returns:
        {
            "property_info": {...},  # Address, price, etc.
            "images_analyzed": int,
            "results": [...]  # Array of analysis results
        }
    """
    try:
        # Step 1: Scrape the listing
        print(f"Scraping listing: {request.listing_url}")
        listing_data = scrape_realtor_ca_listing(request.listing_url)

        if "error" in listing_data:
            return {
                "error": f"Failed to scrape listing: {listing_data['error']}",
                "property_info": None,
                "results": []
            }

        # Step 2: Get property images
        image_urls = listing_data.get("property_photos", [])

        if not image_urls:
            return {
                "error": "No images found in listing",
                "property_info": listing_data.get("basic_info", {}),
                "results": []
            }

        # Limit number of images to analyze
        images_to_analyze = image_urls[:request.max_images]
        print(f"Analyzing {len(images_to_analyze)} images (out of {len(image_urls)} total)")

        # Step 3: Analyze each image
        results = []
        for idx, image_url in enumerate(images_to_analyze, 1):
            try:
                print(f"Analyzing image {idx}/{len(images_to_analyze)}...")

                # Run audit
                audit_data = audit_room(image_url)

                # Generate renovation if prompts available
                image_gen_prompt = audit_data.get("image_gen_prompt")
                mask_prompt = audit_data.get("mask_prompt")

                renovated_image_base64 = None
                if image_gen_prompt and mask_prompt:
                    try:
                        renovated_image_bytes = generate_renovation(
                            image_url,
                            image_gen_prompt,
                            mask_prompt
                        )

                        if renovated_image_bytes:
                            base64_encoded = base64.b64encode(renovated_image_bytes).decode('utf-8')
                            renovated_image_base64 = f"data:image/jpeg;base64,{base64_encoded}"
                    except Exception as e:
                        print(f"Image generation error for image {idx}: {str(e)}")

                results.append({
                    "image_number": idx,
                    "original_url": image_url,
                    "audit": audit_data,
                    "renovated_image": renovated_image_base64
                })

            except Exception as e:
                print(f"Error analyzing image {idx}: {str(e)}")
                results.append({
                    "image_number": idx,
                    "original_url": image_url,
                    "error": str(e),
                    "audit": None,
                    "renovated_image": None
                })

        # Step 4: Return comprehensive report
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

