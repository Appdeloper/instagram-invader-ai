import os
import sys
from PIL import Image, ImageDraw

def run_tests():
    print("=== INSTAGRAM INVADER AI SETUP VERIFICATION ===")
    
    # 1. Check folder structure
    print("\n1. Verifying folder structure...")
    dirs = ['static/css', 'static/js', 'static/assets', 'templates']
    for d in dirs:
        os.makedirs(d, exist_ok=True)
        print(f"  [OK] Directory exists/created: {d}")
        
    # 2. Check local modules
    print("\n2. Checking python import paths...")
    try:
        import image_processor
        print("  [OK] image_processor.py imported successfully.")
    except Exception as e:
        print(f"  [ERROR] Failed to import image_processor.py: {e}")
        return False
        
    # 3. Check font download
    print("\n3. Verifying Google Font availability...")
    try:
        image_processor.download_font()
        if os.path.exists(image_processor.FONT_PATH):
            print(f"  [OK] Font file exists at: {image_processor.FONT_PATH} ({os.path.getsize(image_processor.FONT_PATH)} bytes)")
        else:
            print("  [ERROR] Font file not found after download attempt.")
            return False
    except Exception as e:
        print(f"  [ERROR] Font download failed: {e}")
        return False

    # 4. Check procedural tear generation
    print("\n4. Testing procedural tear generation algorithm (500x500)...")
    try:
        w, h = 500, 500
        # Test circle mask
        paper, hole, boundaries = image_processor.create_tear_masks(w, h, 'circle', 1.0)
        assert paper.size == (w, h), "Paper mask size mismatch"
        assert hole.size == (w, h), "Hole mask size mismatch"
        assert len(boundaries) == 1, "Circular tear should have 1 boundary path"
        print("  [OK] Circle style procedural tear masks created successfully.")
        
        # Test vertical mask
        paper_v, hole_v, boundaries_v = image_processor.create_tear_masks(w, h, 'vertical', 1.0)
        assert len(boundaries_v) == 2, "Vertical tear should have 2 boundary paths"
        print("  [OK] Vertical style procedural tear masks created successfully.")
        
        # Test paper texture
        texture = image_processor.generate_paper_texture(w, h)
        assert texture.size == (w, h), "Texture size mismatch"
        print("  [OK] Procedural paper texture generated successfully.")
    except Exception as e:
        print(f"  [ERROR] Procedural tear algorithm failed: {e}")
        import traceback
        traceback.print_exc()
        return False

    # 5. Check PIL operations
    print("\n5. Testing PIL drawing operations...")
    try:
        test_img = Image.new("RGBA", (200, 200), (255, 255, 255, 255))
        draw = ImageDraw.Draw(test_img)
        draw.text((10, 10), "TEST", fill=(0,0,0,255))
        print("  [OK] Standard PIL drawing verified.")
    except Exception as e:
        print(f"  [ERROR] PIL drawing failed: {e}")
        return False

    print("\n=== VERIFICATION COMPLETE: ALL INTERNAL PIPELINES SUCCESSFUL! ===")
    print("Ready to run Flask server. Use command: python app.py")
    return True

if __name__ == '__main__':
    # Add workspace to path
    sys.path.append(os.path.dirname(__file__))
    success = run_tests()
    sys.exit(0 if success else 1)
