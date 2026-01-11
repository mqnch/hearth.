from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import base64
import asyncio
import hashlib
import json
import uuid
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

# Global job tracking dictionary
# Structure: {
#   job_id: {
#     "status": "processing" | "completed" | "failed",
#     "property_info": {...},
#     "total_images": int,
#     "audit_progress": int,  # 0-100
#     "generation_progress": int,  # 0-100
#     "current_status": str,  # "Auditing image 3/10"
#     "results": [...],  # List of completed image results
#     "error": str | None
#   }
# }
JOBS: dict[str, dict] = {}

def get_cache_key(image_url: str, audit_data: dict, wheelchair_accessible: bool) -> str:
    """Calculates a unique cache key for a renovation request."""
    image_gen_prompt = audit_data.get("image_gen_prompt", "")
    mask_prompt = audit_data.get("mask_prompt", "")
    clear_mask = audit_data.get("clear_mask", "")
    clear_prompt = audit_data.get("clear_prompt", "")
    build_mask = audit_data.get("build_mask", "")
    build_prompt = audit_data.get("build_prompt", "")
    
    is_two_pass = bool(clear_mask and clear_prompt and build_mask and build_prompt)
    
    cache_key_data = {
        "image_url": image_url,
        "image_gen_prompt": image_gen_prompt,
        "mask_prompt": mask_prompt,
        "is_two_pass": is_two_pass,
        "clear_mask": clear_mask if is_two_pass else "",
        "clear_prompt": clear_prompt if is_two_pass else "",
        "build_mask": build_mask if is_two_pass else "",
        "build_prompt": build_prompt if is_two_pass else "",
        "wheelchair_accessible": wheelchair_accessible,
    }
    return hashlib.sha256(
        json.dumps(cache_key_data, sort_keys=True).encode('utf-8')
    ).hexdigest()
 
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

# Background worker function for processing listing jobs
async def process_listing_job(
    job_id: str,
    listing_url: str,
    max_images: int,
    wheelchair_accessible: bool
):
    """
    Background worker that processes a listing job:
    1. Scrapes the listing
    2. Audits all images
    3. Generates renovations for all images
    4. Updates JOBS[job_id] with progress throughout
    """
    try:
        loop = asyncio.get_event_loop()
        
        # Phase 1: Scraping & Setup
        JOBS[job_id]["current_status"] = "Scraping listing..."
        listing_data = await loop.run_in_executor(
            executor,
            scrape_realtor_ca_listing,
            listing_url
        )
        
        if "error" in listing_data:
            JOBS[job_id]["status"] = "failed"
            JOBS[job_id]["error"] = f"Failed to scrape listing: {listing_data['error']}"
            return
        
        # Store property info
        property_info = {
            "address": listing_data.get("basic_info", {}).get("address", "Unknown"),
            "price": listing_data.get("basic_info", {}).get("price", "Unknown"),
            "bedrooms": listing_data.get("basic_info", {}).get("bedrooms", "Unknown"),
            "bathrooms": listing_data.get("basic_info", {}).get("bathrooms", "Unknown"),
            "square_feet": listing_data.get("basic_info", {}).get("square_feet", "Unknown"),
            "mls_number": listing_data.get("basic_info", {}).get("mls_number", "Unknown"),
            "neighborhood": listing_data.get("neighborhood", {}).get("name", "Unknown"),
            "location": listing_data.get("neighborhood", {}).get("location_description", ""),
            "amenities": listing_data.get("neighborhood", {}).get("amenities", []),
        }
        JOBS[job_id]["property_info"] = property_info
        
        # Get image URLs
        image_urls = listing_data.get("property_photos", [])
        if not image_urls:
            JOBS[job_id]["status"] = "failed"
            JOBS[job_id]["error"] = "No images found in listing"
            return
        
        images_to_analyze = image_urls[:max_images]
        total_images = len(images_to_analyze)
        JOBS[job_id]["total_images"] = total_images
        JOBS[job_id]["results"] = []
        
        # Phase 2: Audit Loop
        audit_results = []
        for idx, image_url in enumerate(images_to_analyze, 1):
            try:
                JOBS[job_id]["current_status"] = f"Auditing image {idx}/{total_images}"
                
                # Run audit in executor (synchronous function)
                audit_data = await loop.run_in_executor(
                    executor,
                    audit_room,
                    image_url,
                    wheelchair_accessible
                )
                
                audit_results.append({
                    "image_number": idx,
                    "original_url": image_url,
                    "audit": audit_data
                })
                
                # Update audit progress
                JOBS[job_id]["audit_progress"] = int((idx / total_images) * 100)
                JOBS[job_id]["results"] = audit_results.copy()
                
            except Exception as e:
                print(f"Error auditing image {idx}: {str(e)}")
                audit_results.append({
                    "image_number": idx,
                    "original_url": image_url,
                    "error": str(e),
                    "audit": None
                })
                # Continue with next image
        
        # Phase 3: Generation Loop
        for idx, result in enumerate(audit_results, 1):
            try:
                if not result.get("audit"):
                    # Skip if audit failed
                    continue
                
                audit_data = result["audit"]
                image_url = result["original_url"]
                
                JOBS[job_id]["current_status"] = f"Generating image {idx}/{total_images}"
                
                # Extract prompts
                image_gen_prompt = audit_data.get("image_gen_prompt")
                mask_prompt = audit_data.get("mask_prompt")
                
                if not image_gen_prompt or not mask_prompt:
                    # No prompts available, skip generation
                    continue
                
                # Check for two-pass workflow
                clear_mask = audit_data.get("clear_mask", "")
                clear_prompt = audit_data.get("clear_prompt", "")
                build_mask = audit_data.get("build_mask", "")
                build_prompt = audit_data.get("build_prompt", "")
                
                is_two_pass = bool(clear_mask and clear_prompt and build_mask and build_prompt)
                
                # Generate renovation in executor (synchronous function)
                renovated_image_bytes = await loop.run_in_executor(
                    executor,
                    lambda: generate_renovation(
                        image_url,
                        image_gen_prompt,
                        mask_prompt,
                        is_two_pass=is_two_pass,
                        clear_mask=clear_mask if is_two_pass else None,
                        clear_prompt=clear_prompt if is_two_pass else None,
                        build_mask=build_mask if is_two_pass else None,
                        build_prompt=build_prompt if is_two_pass else None,
                        wheelchair_accessible=wheelchair_accessible
                    )
                )
                
                if renovated_image_bytes:
                    # Encode to base64
                    base64_encoded = base64.b64encode(renovated_image_bytes).decode('utf-8')
                    renovated_image_base64 = f"data:image/jpeg;base64,{base64_encoded}"
                    result["renovated_image"] = renovated_image_base64
                    
                    # NEW: Populate the generation cache so follow-up requests are HITs
                    try:
                        cache_key = get_cache_key(image_url, audit_data, wheelchair_accessible)
                        image_generation_cache[cache_key] = {
                            "renovated_image": renovated_image_base64,
                            "original_url": image_url
                        }
                        print(f"Populated cache for: {image_url[:50]}... (key: {cache_key[:8]})")
                    except Exception as cache_err:
                        print(f"Error populating cache: {str(cache_err)}")
                
                # Update generation progress
                JOBS[job_id]["generation_progress"] = int((idx / total_images) * 100)
                JOBS[job_id]["results"] = audit_results.copy()
                
            except Exception as e:
                print(f"Error generating renovation for image {idx}: {str(e)}")
                # Continue with next image
        
        # Phase 4: Completion
        JOBS[job_id]["status"] = "completed"
        JOBS[job_id]["current_status"] = "Completed"
        JOBS[job_id]["audit_progress"] = 100
        JOBS[job_id]["generation_progress"] = 100
        
    except Exception as e:
        print(f"Error in process_listing_job: {str(e)}")
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = f"Job failed: {str(e)}"


# Background worker function for processing single image jobs
async def process_single_image_job(
    job_id: str,
    image_url: str,
    wheelchair_accessible: bool
):
    """
    Background worker that processes a single image job:
    1. Audits the image
    2. Generates renovation
    3. Updates JOBS[job_id] with progress
    """
    try:
        loop = asyncio.get_event_loop()
        
        # Initialize job structure
        JOBS[job_id]["total_images"] = 1
        JOBS[job_id]["results"] = []
        
        # Phase 1: Audit
        JOBS[job_id]["current_status"] = "Auditing image 1/1"
        audit_data = await loop.run_in_executor(
            executor,
            audit_room,
            image_url,
            wheelchair_accessible
        )
        
        result = {
            "image_number": 1,
            "original_url": image_url,
            "audit": audit_data
        }
        
        JOBS[job_id]["audit_progress"] = 100
        JOBS[job_id]["results"].append(result)
        
        # Phase 2: Generation
        JOBS[job_id]["current_status"] = "Generating image 1/1"
        
        image_gen_prompt = audit_data.get("image_gen_prompt")
        mask_prompt = audit_data.get("mask_prompt")
        
        if image_gen_prompt and mask_prompt:
            # Check for two-pass workflow
            clear_mask = audit_data.get("clear_mask", "")
            clear_prompt = audit_data.get("clear_prompt", "")
            build_mask = audit_data.get("build_mask", "")
            build_prompt = audit_data.get("build_prompt", "")
            
            is_two_pass = bool(clear_mask and clear_prompt and build_mask and build_prompt)
            
            renovated_image_bytes = await loop.run_in_executor(
                executor,
                lambda: generate_renovation(
                    image_url,
                    image_gen_prompt,
                    mask_prompt,
                    is_two_pass=is_two_pass,
                    clear_mask=clear_mask if is_two_pass else None,
                    clear_prompt=clear_prompt if is_two_pass else None,
                    build_mask=build_mask if is_two_pass else None,
                    build_prompt=build_prompt if is_two_pass else None,
                    wheelchair_accessible=wheelchair_accessible
                )
            )
            
            if renovated_image_bytes:
                base64_encoded = base64.b64encode(renovated_image_bytes).decode('utf-8')
                renovated_image_base64 = f"data:image/jpeg;base64,{base64_encoded}"
                result["renovated_image"] = renovated_image_base64
                
                # Populate the generation cache so follow-up requests are HITs
                try:
                    cache_key = get_cache_key(image_url, audit_data, wheelchair_accessible)
                    image_generation_cache[cache_key] = {
                        "renovated_image": renovated_image_base64,
                        "original_url": image_url
                    }
                    print(f"Populated cache for single image: {image_url[:50]}... (key: {cache_key[:8]})")
                except Exception as cache_err:
                    print(f"Error populating cache: {str(cache_err)}")
        
        # Add to results list again to ensure it has the image
        JOBS[job_id]["results"] = [result]
        
        # Completion
        JOBS[job_id]["status"] = "completed"
        JOBS[job_id]["current_status"] = "Completed"
        JOBS[job_id]["generation_progress"] = 100
        JOBS[job_id]["property_info"] = {
            "address": "Single Image Analysis",
            "price": "N/A",
            "bedrooms": "N/A",
            "bathrooms": "N/A",
            "square_feet": "N/A",
            "mls_number": "N/A",
            "neighborhood": "N/A",
            "location": "",
            "amenities": []
        }
        
    except Exception as e:
        print(f"Error in process_single_image_job: {str(e)}")
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = f"Job failed: {str(e)}"


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

# Analyze endpoint - starts background job for single image
@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    """
    Start a background job to audit a single image and generate renovation.

    Args:
        image_url: URL of the image to analyze
        wheelchair_accessible: Whether to apply wheelchair-accessible modifications

    Returns:
        {
            "job_id": str  # Use this to poll /job-status/{job_id} for progress
        }
    """
    try:
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        
        # Initialize job in JOBS dict
        JOBS[job_id] = {
            "status": "processing",
            "property_info": None,
            "total_images": 1,
            "audit_progress": 0,
            "generation_progress": 0,
            "current_status": "Initializing...",
            "results": [],
            "error": None
        }
        
        # Launch background task
        asyncio.create_task(
            process_single_image_job(
                job_id,
                request.image_url,
                request.wheelchair_accessible
            )
        )
        
        # Return job_id immediately
        return {"job_id": job_id}
        
    except Exception as e:
        return {
            "error": f"Failed to start job: {str(e)}",
            "job_id": None
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

# NEW: Analyze from Realtor.ca listing URL with background processing
@app.post("/analyze-from-listing")
async def analyze_from_listing(request: ListingUrlRequest):
    """
    Start a background job to scrape a Realtor.ca listing, audit all property images,
    and generate renovation images automatically.

    Args:
        listing_url: Full URL to a Realtor.ca listing
        max_images: Maximum number of images to analyze (default: 5)
        wheelchair_accessible: Whether to apply wheelchair-accessible modifications

    Returns:
        {
            "job_id": str  # Use this to poll /job-status/{job_id} for progress
        }
    """
    try:
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        
        # Initialize job in JOBS dict
        JOBS[job_id] = {
            "status": "processing",
            "property_info": None,
            "total_images": 0,
            "audit_progress": 0,
            "generation_progress": 0,
            "current_status": "Initializing...",
            "results": [],
            "error": None
        }
        
        # Launch background task
        asyncio.create_task(
            process_listing_job(
                job_id,
                request.listing_url,
                request.max_images,
                request.wheelchair_accessible
            )
        )
        
        # Return job_id immediately
        return {"job_id": job_id}
        
    except Exception as e:
        return {
            "error": f"Failed to start job: {str(e)}",
            "job_id": None
        }

# Status endpoint for job tracking
@app.get("/job-status/{job_id}")
async def get_job_status(job_id: str):
    """
    Get the current status of a background job.
    
    Returns:
        {
            "job_id": str,
            "status": "processing" | "completed" | "failed",
            "audit_progress": int,  # 0-100
            "generation_progress": int,  # 0-100
            "current_status": str,
            "total_images": int,
            "property_info": {...},
            "results": [...],
            "error": str | None
        }
    """
    if job_id not in JOBS:
        return {
            "error": "Job not found",
            "status_code": 404
        }
    
    job = JOBS[job_id]
    return {
        "job_id": job_id,
        "status": job["status"],
        "audit_progress": job.get("audit_progress", 0),
        "generation_progress": job.get("generation_progress", 0),
        "current_status": job.get("current_status", ""),
        "total_images": job.get("total_images", 0),
        "property_info": job.get("property_info"),
        "results": job.get("results", []),
        "error": job.get("error")
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

        # Create cache key using helper function
        cache_key = get_cache_key(request.image_url, request.audit_data, request.wheelchair_accessible)

        # Check cache first
        if cache_key in image_generation_cache:
            cached_result = image_generation_cache[cache_key]
            print(f"Cache HIT for: {request.image_url[:50]}... (key: {cache_key[:8]})")
            return {
                "success": True,
                "renovated_image": cached_result["renovated_image"],
                "original_url": cached_result["original_url"],
                "cached": True
            }

        print(f"Cache MISS - Generating renovation for: {request.image_url[:50]}... (key: {cache_key[:8]})")

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

