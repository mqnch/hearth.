# Realtor.ca Scraper Integration Guide

## ✅ What's Been Added

The Realtor.ca scraper has been successfully integrated into your DeltaHacks AccessiVision project!

### Files Added/Modified:

1. **`backend/scraper.py`** ✨ NEW
   - Main scraper module with anti-bot bypass
   - Extracts property photos and metadata from Realtor.ca listings

2. **`backend/requirements.txt`** 📝 MODIFIED
   - Added `playwright>=1.40.0` dependency

3. **`backend/main.py`** 📝 MODIFIED
   - Added new `/analyze-from-listing` endpoint
   - Imports scraper functions

---

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
cd /Users/zishine/VSCODE/deltahacks/deltahacks26/backend

# Install Python packages
pip install -r requirements.txt

# Install Playwright browsers (IMPORTANT!)
python -m playwright install chromium
```

### 2. Test the Scraper

```bash
# Test scraper standalone
python scraper.py
```

You should see:
```
✓ Found 50 photos
✓ Address: 2 PRINCE ADAM COURT...
✓ Price: $3,585,000
```

### 3. Start the Backend

```bash
# From backend folder
uvicorn main:app --reload
```

Backend will run on `http://localhost:8000`

---

## 📡 API Endpoint

### `POST /analyze-from-listing`

Scrapes a Realtor.ca listing and analyzes all property images for accessibility.

**Request Body:**
```json
{
  "listing_url": "https://www.realtor.ca/real-estate/29140184/...",
  "max_images": 5
}
```

**Response:**
```json
{
  "property_info": {
    "address": "2 PRINCE ADAM COURT, King City, ON",
    "price": "$3,585,000",
    "bedrooms": "4",
    "bathrooms": "5",
    "square_feet": "7,000 sq ft",
    "mls_number": "N12579788",
    "neighborhood": "Prestigious Laskay",
    "location": "King Rd / Weston Rd"
  },
  "total_images_found": 50,
  "images_analyzed": 5,
  "results": [
    {
      "image_number": 1,
      "original_url": "https://cdn.realtor.ca/...",
      "audit": {
        "barrier": "...",
        "cost_estimate": "...",
        "compliance_notes": "...",
        ...
      },
      "renovated_image": "data:image/jpeg;base64,..."
    },
    // ... more results
  ]
}
```

---

## 🧪 Testing the Endpoint

### Option 1: Using cURL

```bash
curl -X POST http://localhost:8000/analyze-from-listing \
  -H "Content-Type: application/json" \
  -d '{
    "listing_url": "https://www.realtor.ca/real-estate/29140184/2-prince-adam-court-king-king-city-king-city",
    "max_images": 3
  }'
```

### Option 2: Using Python

```python
import requests

response = requests.post(
    "http://localhost:8000/analyze-from-listing",
    json={
        "listing_url": "https://www.realtor.ca/real-estate/29140184/2-prince-adam-court-king-king-city-king-city",
        "max_images": 3
    }
)

data = response.json()
print(f"Analyzed {data['images_analyzed']} images")
print(f"Address: {data['property_info']['address']}")
print(f"Price: {data['property_info']['price']}")
```

### Option 3: Using Postman

1. Method: `POST`
2. URL: `http://localhost:8000/analyze-from-listing`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "listing_url": "https://www.realtor.ca/real-estate/29140184/2-prince-adam-court-king-king-city-king-city",
  "max_images": 3
}
```

---

## 🎨 Frontend Integration (Optional)

### Option A: Add to Existing Hero Component

Update `frontend/src/components/landing/Hero.tsx`:

```typescript
// Add state for listing URL option
const [inputMode, setInputMode] = useState<'image' | 'listing'>('image')
const [listingUrl, setListingUrl] = useState('')

// Add toggle between image URL and listing URL
<div className="mb-4">
  <button onClick={() => setInputMode('image')}>Image URL</button>
  <button onClick={() => setInputMode('listing')}>Listing URL</button>
</div>

{inputMode === 'image' ? (
  // Existing image URL input
  <Input
    value={imageUrl}
    onChange={(e) => setImageUrl(e.target.value)}
    placeholder="Paste image URL here"
  />
) : (
  // NEW: Listing URL input
  <Input
    value={listingUrl}
    onChange={(e) => setListingUrl(e.target.value)}
    placeholder="Paste Realtor.ca listing URL"
  />
)}

// Update submit handler
const handleSubmit = async () => {
  if (inputMode === 'listing') {
    const response = await fetch('http://localhost:8000/analyze-from-listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listing_url: listingUrl,
        max_images: 5
      })
    })
    // Handle response...
  } else {
    // Existing image URL logic
  }
}
```

### Option B: Create Dedicated Listing Analysis Page

Create `frontend/src/app/listing-analysis/page.tsx` for bulk property analysis.

---

## ⚙️ Configuration

### Scraper Settings (in `backend/scraper.py`)

```python
# Adjust these parameters:
headless=True,  # Set to False to see browser (debugging)
timeout=30000,  # Request timeout in ms
```

### Analysis Settings (in endpoint)

```python
max_images: int = 5  # Default images to analyze
```

**Why limit images?**
- Each image analysis costs API credits (Gemini API)
- 50 images × 2 API calls = 100 API requests per listing
- Limiting to 5 images keeps costs reasonable

---

## 🔧 Troubleshooting

### Issue: `ModuleNotFoundError: No module named 'playwright'`

**Solution:**
```bash
pip install playwright
python -m playwright install chromium
```

### Issue: Robot/CAPTCHA Detection

**Solution:**
The scraper already uses stealth mode. If still detected:
1. Set `headless=False` in `scraper.py`
2. Add more random delays
3. Use a proxy (requires setup)

### Issue: No images found

**Causes:**
- Invalid listing URL
- Listing expired/removed
- Robot check blocked scraper

**Solution:**
- Verify URL in browser first
- Check backend logs for errors
- Try a different listing

### Issue: Analysis too slow

**Causes:**
- Analyzing too many images
- Slow internet connection
- Gemini API rate limits

**Solution:**
- Reduce `max_images` to 2-3
- Implement image selection (e.g., only bedrooms/bathrooms)
- Add caching for repeated listings

---

## 📊 Cost Considerations

### Gemini API Usage per Listing:

- **Audit:** 1 call per image × `max_images`
- **Image Generation:** 1 call per image × `max_images`
- **Total:** ~2 × `max_images` API calls

**Example with max_images=5:**
- 5 images × 2 calls = 10 API calls per listing
- At Gemini's pricing, this is very affordable for demos

**Recommendation:** Keep `max_images` ≤ 5 for hackathon

---

## 🎯 Next Steps

### 1. Frontend Integration
- [ ] Add listing URL input to Hero component
- [ ] Handle multi-image results in Report page
- [ ] Add property info display (address, price, etc.)

### 2. Enhanced Features
- [ ] Image selection (choose which rooms to analyze)
- [ ] Batch processing (multiple listings)
- [ ] Comparison view (multiple properties side-by-side)

### 3. Production Readiness
- [ ] Add rate limiting
- [ ] Implement caching (Redis/file-based)
- [ ] Error handling improvements
- [ ] Add logging/monitoring

---

## 💡 Usage Examples

### Example 1: Quick Accessibility Check
```bash
# Analyze first 3 images from a listing
curl -X POST http://localhost:8000/analyze-from-listing \
  -H "Content-Type: application/json" \
  -d '{"listing_url": "...", "max_images": 3}'
```

### Example 2: Full Property Report
```python
# Analyze all images (expensive!)
response = requests.post(
    "http://localhost:8000/analyze-from-listing",
    json={
        "listing_url": "https://www.realtor.ca/...",
        "max_images": 50  # Analyze all images
    }
)
```

### Example 3: Targeted Room Analysis
```python
# Future enhancement: Specify which rooms
response = requests.post(
    "http://localhost:8000/analyze-from-listing",
    json={
        "listing_url": "https://www.realtor.ca/...",
        "rooms_to_analyze": ["bathroom", "bedroom", "entrance"]
    }
)
```

---

## 🚨 Important Notes

1. **Respect Realtor.ca's Terms of Service**
   - Don't scrape too frequently
   - Use for educational purposes (hackathon)
   - Consider caching results

2. **API Costs**
   - Monitor Gemini API usage
   - Set usage limits in Google Cloud Console
   - Use `max_images` parameter wisely

3. **Performance**
   - Each image takes ~5-10 seconds to analyze
   - 5 images = ~30-50 seconds total
   - Consider async processing for better UX

4. **Browser Dependency**
   - Playwright requires Chromium browser
   - Ensure `playwright install chromium` was run
   - Headless mode works in production

---

## ✅ Success Checklist

- [x] Scraper code added to backend
- [x] Dependencies updated in requirements.txt
- [x] New `/analyze-from-listing` endpoint created
- [ ] Dependencies installed (`pip install -r requirements.txt`)
- [ ] Playwright browsers installed (`playwright install chromium`)
- [ ] Backend tested and running
- [ ] Endpoint tested with sample listing
- [ ] Frontend integration (optional)

---

## 📞 Support

If you encounter issues:

1. Check backend logs (`uvicorn` output)
2. Verify Gemini API key is set
3. Test scraper standalone (`python scraper.py`)
4. Ensure Playwright browsers are installed

---

**Happy Hacking! 🚀**

Your scraper is ready to analyze real estate listings for accessibility barriers!
