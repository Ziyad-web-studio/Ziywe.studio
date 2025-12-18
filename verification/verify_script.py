from playwright.sync_api import sync_playwright, expect

def verify_landing():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the local server
        page.goto("http://localhost:8080")

        # Wait for fade-in animations
        page.wait_for_timeout(1000)

        # Verify Hero Section
        expect(page.locator("h1")).to_have_text("Nameless Serve")
        expect(page.locator(".slogan")).to_have_text("The Only Serve Coffee and Dark.")

        # Verify Navigation
        expect(page.locator(".navbar")).to_be_visible()

        # Scroll down to trigger animations
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1000)

        # Take a full page screenshot
        page.screenshot(path="verification/landing_page.png", full_page=True)

        browser.close()

if __name__ == "__main__":
    verify_landing()
