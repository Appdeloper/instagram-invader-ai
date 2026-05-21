import os
import requests
from PIL import Image

def main():
    print("=== STARTING ASSET GENERATION ===")
    assets_dir = os.path.join(os.path.dirname(__file__), "static", "assets")
    os.makedirs(assets_dir, exist_ok=True)
    
    # 1. Download Sample Portraits from Unsplash
    # URL 1: Female portrait
    # URL 2: Male portrait
    samples = [
        {
            "url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80",
            "name": "sample_portrait_1.png"
        },
        {
            "url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80",
            "name": "sample_portrait_2.png"
        }
    ]
    
    for sample in samples:
        target_path = os.path.join(assets_dir, sample["name"])
        if not os.path.exists(target_path):
            try:
                print(f"Downloading {sample['name']} from Unsplash...")
                r = requests.get(sample["url"], timeout=20)
                r.raise_for_status()
                with open(target_path, "wb") as f:
                    f.write(r.content)
                print(f"  [OK] Saved {sample['name']}")
            except Exception as e:
                print(f"  [ERROR] Failed to download {sample['name']}: {e}")
        else:
            print(f"  [SKIP] {sample['name']} already exists.")
            
    # 2. Pre-generate Gallery Showcase Composites
    try:
        from image_processor import composite_images
        
        # Gallery 1: Female portrait in circle rip dark theme
        g1_path = os.path.join(assets_dir, "gallery_1.png")
        p1_path = os.path.join(assets_dir, "sample_portrait_1.png")
        if os.path.exists(p1_path) and not os.path.exists(g1_path):
            print("Generating gallery_1.png...")
            p1_img = Image.open(p1_path)
            res1 = composite_images(
                portrait_img=p1_img,
                profile_img=None,
                style='circle',
                intensity=1.1,
                meme_text="Breaking out of the grid! ⚡",
                theme='dark'
            )
            res1.save(g1_path, "PNG")
            print("  [OK] Generated gallery_1.png")
            
        # Gallery 2: Male portrait in vertical slit light theme
        g2_path = os.path.join(assets_dir, "gallery_2.png")
        p2_path = os.path.join(assets_dir, "sample_portrait_2.png")
        if os.path.exists(p2_path) and not os.path.exists(g2_path):
            print("Generating gallery_2.png...")
            p2_img = Image.open(p2_path)
            res2 = composite_images(
                portrait_img=p2_img,
                profile_img=None,
                style='vertical',
                intensity=1.2,
                meme_text="Is your screen ripped? 😂",
                theme='light'
            )
            res2.save(g2_path, "PNG")
            print("  [OK] Generated gallery_2.png")
            
    except Exception as e:
        print(f"  [ERROR] Gallery pre-generation failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
