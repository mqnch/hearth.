"""
Realtor.ca Scraper for DeltaHacks AccessiVision Project
Extracts property photos and metadata from Realtor.ca listings
"""

from playwright.sync_api import sync_playwright
import json
import re
import random
import time
from typing import Dict, List, Optional


def scrape_realtor_ca_listing(listing_url: str) -> Dict:
    """
    Scrape complete listing data from Realtor.ca with anti-bot bypass.

    Args:
        listing_url: Full URL to a Realtor.ca listing

    Returns:
        Dictionary containing:
        - property_photos: List of high-res image URLs
        - basic_info: address, price, bedrooms, bathrooms, sqft, mls_number
        - neighborhood: name, location, amenities, community features
        - description: Full property description
    """
    with sync_playwright() as p:
        # Launch browser with anti-detection flags
        browser = p.chromium.launch(
            headless=True,  # Run headless for production
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
            ]
        )

        # Create context with realistic settings
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale='en-CA',
            timezone_id='America/Toronto',
        )

        page = context.new_page()

        try:
            # Navigate to the page
            page.goto(listing_url, wait_until="domcontentloaded", timeout=30000)

            # Wait and mimic human behavior
            time.sleep(random.uniform(2, 4))

            # Scroll to load lazy images
            page.evaluate("""
                async () => {
                    await new Promise((resolve) => {
                        let totalHeight = 0;
                        let distance = 100;
                        let timer = setInterval(() => {
                            let scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;
                            if(totalHeight >= scrollHeight){
                                clearInterval(timer);
                                resolve();
                            }
                        }, 100);
                    });
                }
            """)

            time.sleep(1)
            page.evaluate("window.scrollTo(0, 0)")

            listing_data = {
                "url": listing_url,
                "property_photos": [],
                "basic_info": {},
                "neighborhood": {
                    "name": "",
                    "location_description": "",
                    "amenities": [],
                    "community_features": []
                },
                "description": ""
            }

            # ========== EXTRACT PROPERTY PHOTOS ==========
            images = page.query_selector_all('img')
            for img in images:
                src = img.get_attribute('src')
                if src and 'cdn.realtor.ca/listing' in src and '/highres/' in src:
                    if src not in listing_data["property_photos"]:
                        listing_data["property_photos"].append(src)

            # ========== EXTRACT PAGE TEXT ==========
            page_text = page.inner_text('body')

            # ========== EXTRACT STRUCTURED DATA ==========
            json_ld_scripts = page.query_selector_all('script[type="application/ld+json"]')
            for script in json_ld_scripts:
                try:
                    data = json.loads(script.inner_text())
                    if isinstance(data, dict) and data.get('@type') == 'Product':
                        if 'name' in data:
                            listing_data["basic_info"]["address"] = data['name']
                        if 'description' in data:
                            listing_data["description"] = data['description']
                        if 'offers' in data:
                            offers = data['offers']
                            if isinstance(offers, list):
                                offers = offers[0]
                            if 'price' in offers:
                                listing_data["basic_info"]["price"] = "$" + str(offers['price'])
                except:
                    pass

            # ========== EXTRACT FROM TEXT ==========
            # Price
            if "price" not in listing_data["basic_info"]:
                price_match = re.search(r'\$[\d,]+', page_text)
                if price_match:
                    listing_data["basic_info"]["price"] = price_match.group()

            # Bedrooms
            bed_match = re.search(r'(\d+)\s*(?:\+)?\s*Bed(?:room)?s?', page_text, re.IGNORECASE)
            if bed_match:
                listing_data["basic_info"]["bedrooms"] = bed_match.group(1)

            # Bathrooms
            bath_match = re.search(r'(\d+)\s*Bath(?:room)?s?', page_text, re.IGNORECASE)
            if bath_match:
                listing_data["basic_info"]["bathrooms"] = bath_match.group(1)

            # Square footage
            sqft_match = re.search(r'([\d,]+)\s*(?:sq\.?\s*ft|Square Feet)', page_text, re.IGNORECASE)
            if sqft_match:
                listing_data["basic_info"]["square_feet"] = sqft_match.group(1) + " sq ft"

            # MLS
            mls_match = re.search(r'MLS[®#\s]*:?\s*([A-Z0-9]+)', page_text)
            if mls_match:
                listing_data["basic_info"]["mls_number"] = mls_match.group(1)

            # ========== EXTRACT NEIGHBORHOOD INFO ==========
            description = listing_data.get('description', '')

            # Neighborhood name
            neighborhood_match = re.search(
                r'(?:in|of) (?:the )?(.+?) (?:Community|Neighbourhood|Neighborhood)',
                description, re.IGNORECASE
            )
            if neighborhood_match:
                listing_data["neighborhood"]["name"] = neighborhood_match.group(1).strip()

            # Location description
            location_match = re.search(r'Location Description\s*\n\s*(.+)', page_text, re.IGNORECASE)
            if location_match:
                listing_data["neighborhood"]["location_description"] = location_match.group(1).strip()

            # Community features
            community_match = re.search(r'Community Features\s*\n\s*(.+)', page_text, re.IGNORECASE)
            if community_match:
                features_text = community_match.group(1).strip()
                listing_data["neighborhood"]["community_features"] = [
                    f.strip() for f in features_text.split(',')
                ]

            # Extract amenities
            if description:
                proximity_keywords = {
                    'highway': r'(?:minutes|min|mins) from Highway (\d+)',
                    'downtown': r'(?:minutes|min|mins) (?:from|to) (?:downtown|city)',
                    'schools': r'(?:near|close to|walking distance to) schools',
                    'shopping': r'(?:near|close to) shopping',
                    'parks': r'(?:near|close to) parks',
                    'transit': r'(?:near|close to) (?:transit|TTC|GO Train)',
                }

                for feature, pattern in proximity_keywords.items():
                    match = re.search(pattern, description, re.IGNORECASE)
                    if match:
                        listing_data["neighborhood"]["amenities"].append(
                            feature.title() + ": " + match.group(0)
                        )

            # School bus
            if re.search(r'School Bus', page_text, re.IGNORECASE):
                listing_data["neighborhood"]["amenities"].append("School Bus Service Available")

            return listing_data

        except Exception as e:
            print(f"Error scraping listing: {str(e)}")
            return {
                "error": str(e),
                "property_photos": [],
                "basic_info": {},
                "neighborhood": {},
                "description": ""
            }
        finally:
            browser.close()


def get_property_images(listing_url: str) -> List[str]:
    """
    Quick helper to just get image URLs from a listing.

    Args:
        listing_url: Full URL to a Realtor.ca listing

    Returns:
        List of property image URLs
    """
    data = scrape_realtor_ca_listing(listing_url)
    return data.get("property_photos", [])


# For testing
if __name__ == "__main__":
    test_url = "https://www.realtor.ca/real-estate/29140184/2-prince-adam-court-king-king-city-king-city"
    print(f"Testing scraper with: {test_url}")

    result = scrape_realtor_ca_listing(test_url)

    print(f"\n✓ Found {len(result['property_photos'])} photos")
    print(f"✓ Address: {result['basic_info'].get('address', 'N/A')}")
    print(f"✓ Price: {result['basic_info'].get('price', 'N/A')}")

    print("\nFirst 3 image URLs:")
    for i, url in enumerate(result['property_photos'][:3], 1):
        print(f"  {i}. {url}")
