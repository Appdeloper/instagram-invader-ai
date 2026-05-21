import os
import math
import random
import numpy as np
import requests
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops, ImageOps, ImageFont

FONT_BOLD_URL = "https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Bold.ttf"
FONT_BOLD_PATH = os.path.join(os.path.dirname(__file__), "static", "assets", "Poppins-Bold.ttf")
FONT_PATH = FONT_BOLD_PATH  # Backwards compatibility

FONT_REG_URL = "https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Regular.ttf"
FONT_REG_PATH = os.path.join(os.path.dirname(__file__), "static", "assets", "Poppins-Regular.ttf")

def download_font():
    """Download Poppins fonts if not already present."""
    os.makedirs(os.path.dirname(FONT_BOLD_PATH), exist_ok=True)
    
    # Download Bold Font
    if not os.path.exists(FONT_BOLD_PATH):
        try:
            print(f"Downloading Poppins-Bold font from {FONT_BOLD_URL}...")
            r = requests.get(FONT_BOLD_URL, timeout=15)
            r.raise_for_status()
            with open(FONT_BOLD_PATH, "wb") as f:
                f.write(r.content)
            print("Poppins-Bold font downloaded successfully.")
        except Exception as e:
            print(f"Error downloading Poppins-Bold font: {e}.")
            
    # Download Regular Font
    if not os.path.exists(FONT_REG_PATH):
        try:
            print(f"Downloading Poppins-Regular font from {FONT_REG_URL}...")
            r = requests.get(FONT_REG_URL, timeout=15)
            r.raise_for_status()
            with open(FONT_REG_PATH, "wb") as f:
                f.write(r.content)
            print("Poppins-Regular font downloaded successfully.")
        except Exception as e:
            print(f"Error downloading Poppins-Regular font: {e}.")

def auto_orient_image(img):
    """Auto-orient image based on EXIF data."""
    try:
        return ImageOps.exif_transpose(img)
    except Exception as e:
        print(f"Error fixing orientation: {e}")
        return img

def remove_background(img):
    """Remove background using rembg and smooth the edges with robust fallback."""
    try:
        from rembg import remove
        # Remove background
        cutout = remove(img)
        
        # Feather edges slightly for realism
        # Split channels
        r, g, b, a = cutout.split()
        # Smooth the alpha channel using a small Gaussian blur and threshold
        a_blurred = a.filter(ImageFilter.GaussianBlur(1.0))
        # Combine back
        smoothed_cutout = Image.merge("RGBA", (r, g, b, a_blurred))
        return smoothed_cutout
    except Exception as e:
        print(f"rembg background removal failed, applying fallback: {e}")
        # Robust fallback: return image with a circular or soft gradient mask
        # so it doesn't crash the server. We will create a soft vignette/circular cutout
        w, h = img.size
        # Create a circle/oval alpha mask
        mask = Image.new("L", (w, h), 0)
        md = ImageDraw.Draw(mask)
        # draw soft oval filling 80% of width/height
        margin_x = int(w * 0.1)
        margin_y = int(h * 0.1)
        md.ellipse([margin_x, margin_y, w - margin_x, h - margin_y], fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(min(w, h) * 0.03)) # soft edge
        
        # Merge source image with mask
        rgba_img = img.convert("RGBA")
        r, g, b, a = rgba_img.split()
        # Multiply existing alpha channel with our soft circle mask
        fallback_a = ImageChops.multiply(a, mask)
        return Image.merge("RGBA", (r, g, b, fallback_a))


def displace_segment(p1, p2, roughness, depth, current_depth=0):
    """Recursively displace the midpoint of a segment to create a fractal edge."""
    if current_depth >= depth:
        return [p1]
    
    mx = (p1[0] + p2[0]) / 2.0
    my = (p1[1] + p2[1]) / 2.0
    
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    length = math.sqrt(dx*dx + dy*dy)
    
    if length < 2.0:  # Don't subdivide pixels too much
        return [p1]
    
    # Normal vector
    nx = -dy / length
    ny = dx / length
    
    # Displace midpoint based on length and roughness
    disp = random.uniform(-0.5, 0.5) * length * roughness
    mx += nx * disp
    my += ny * disp
    
    m = (mx, my)
    
    left = displace_segment(p1, m, roughness, depth, current_depth + 1)
    right = displace_segment(m, p2, roughness, depth, current_depth + 1)
    
    return left + right

def generate_jagged_line(p1, p2, depth=5, roughness=0.15):
    """Create a jagged path from p1 to p2 using midpoint displacement."""
    points = displace_segment(p1, p2, roughness, depth)
    points.append(p2)
    return points

def generate_paper_texture(w, h):
    """Generate a realistic warm off-white paper texture."""
    # Warm off-white base color
    paper = Image.new("RGBA", (w, h), (248, 246, 240, 255))
    
    # Generate coarse fiber noise
    coarse_noise = np.random.normal(128, 6, (h // 2, w // 2)).astype(np.uint8)
    coarse_img = Image.fromarray(coarse_noise, mode="L").resize((w, h), Image.Resampling.BILINEAR)
    coarse_img = coarse_img.filter(ImageFilter.GaussianBlur(1.5))
    coarse_img = ImageEnhance.Contrast(coarse_img).enhance(2.0)
    coarse_rgba = Image.merge("RGBA", (coarse_img, coarse_img, coarse_img, Image.new("L", (w, h), 255)))
    paper = Image.blend(paper, coarse_rgba, 0.05)
    
    # Generate fine grain noise
    fine_noise = np.random.normal(128, 4, (h, w)).astype(np.uint8)
    fine_img = Image.fromarray(fine_noise, mode="L")
    fine_rgba = Image.merge("RGBA", (fine_img, fine_img, fine_img, Image.new("L", (w, h), 255)))
    paper = Image.blend(paper, fine_rgba, 0.03)
    
    return paper

def create_tear_masks(w, h, style='circle', intensity=1.0):
    """
    Generate the paper mask, hole mask, and list of boundary paths for drawing the fuzzy border.
    paper_mask: L mode, 255 for paper area, 0 for hole.
    hole_mask: L mode, 255 for hole area, 0 for paper.
    boundaries: List of list of points (paths) representing the tear lines.
    """
    paper_mask = Image.new("L", (w, h), 255)
    draw = ImageDraw.Draw(paper_mask)
    
    boundaries = []
    
    # Scale parameters by intensity
    intensity = max(0.5, min(intensity, 2.0))
    
    if style == 'circle':
        # Jagged circular cutout in center
        cx, cy = w / 2, h / 2
        r = min(w, h) * 0.23 * intensity
        
        # 12 base vertices around circle
        num_vertices = 12
        angles = [2 * math.pi * i / num_vertices for i in range(num_vertices)]
        base_points = []
        for a in angles:
            # Add small random variation to starting radius
            var_r = r * random.uniform(0.9, 1.1)
            base_points.append((cx + var_r * math.cos(a), cy + var_r * math.sin(a)))
            
        # Displace each segment
        all_points = []
        for i in range(num_vertices):
            p1 = base_points[i]
            p2 = base_points[(i + 1) % num_vertices]
            all_points.extend(generate_jagged_line(p1, p2, depth=4, roughness=0.18)[:-1])
            
        # Draw the hole
        draw.polygon(all_points, fill=0)
        boundaries.append(all_points + [all_points[0]])
        
    elif style == 'vertical':
        # Vertically ripped opening in the middle
        left_x_base = w * (0.5 - 0.16 * intensity)
        right_x_base = w * (0.5 + 0.16 * intensity)
        
        scale = w / 1080.0
        var_range = 20 * scale
        
        # Generate jagged lines from top to bottom
        p_left_top = (left_x_base + random.uniform(-var_range, var_range), 0)
        p_left_bottom = (left_x_base + random.uniform(-var_range, var_range), h)
        left_edge = generate_jagged_line(p_left_top, p_left_bottom, depth=5, roughness=0.14)
        
        p_right_top = (right_x_base + random.uniform(-var_range, var_range), 0)
        p_right_bottom = (right_x_base + random.uniform(-var_range, var_range), h)
        right_edge = generate_jagged_line(p_right_top, p_right_bottom, depth=5, roughness=0.14)
        
        # Draw Left sheet paper: we erase the center hole.
        # It's easier to start with paper mask, then draw the center hole polygon.
        # Hole goes from Left edge to Right edge.
        hole_poly = left_edge + list(reversed(right_edge))
        draw.polygon(hole_poly, fill=0)
        
        boundaries.append(left_edge)
        boundaries.append(right_edge)
        
    elif style == 'horizontal':
        # Horizontally ripped opening in the middle
        top_y_base = h * (0.5 - 0.16 * intensity)
        bottom_y_base = h * (0.5 + 0.16 * intensity)
        
        scale = w / 1080.0
        var_range = 20 * scale
        
        # Generate jagged lines from left to right
        p_top_left = (0, top_y_base + random.uniform(-var_range, var_range))
        p_top_right = (w, top_y_base + random.uniform(-var_range, var_range))
        top_edge = generate_jagged_line(p_top_left, p_top_right, depth=5, roughness=0.14)
        
        p_bottom_left = (0, bottom_y_base + random.uniform(-var_range, var_range))
        p_bottom_right = (w, bottom_y_base + random.uniform(-var_range, var_range))
        bottom_edge = generate_jagged_line(p_bottom_left, p_bottom_right, depth=5, roughness=0.14)
        
        # Draw center hole polygon
        hole_poly = top_edge + list(reversed(bottom_edge))
        draw.polygon(hole_poly, fill=0)
        
        boundaries.append(top_edge)
        boundaries.append(bottom_edge)
        
    elif style == 'diagonal':
        # Ripped opening from top-left to bottom-right
        # Boundary 1 (bottom-left paper sheet edge)
        p1_start = (0, h * (0.55 - 0.22 * intensity))
        p1_end = (w * (0.55 - 0.22 * intensity), h)
        edge1 = generate_jagged_line(p1_start, p1_end, depth=5, roughness=0.15)
        
        # Boundary 2 (top-right paper sheet edge)
        p2_start = (w * (0.45 + 0.22 * intensity), 0)
        p2_end = (w, h * (0.45 + 0.22 * intensity))
        edge2 = generate_jagged_line(p2_start, p2_end, depth=5, roughness=0.15)
        
        # Draw paper sheets by creating a black hole in the center
        # The hole polygon is between edge1 and edge2, enclosing the diagonal channel
        # We can draw the hole as: edge1 -> bottom-right corner (W, H) -> edge2 -> top-left corner (0, 0)
        # Wait, the easiest way is:
        # Left edge starts at (0, y1), ends at (x1, H)
        # Right edge starts at (x2, 0), ends at (W, y2)
        # Hole polygon: edge1 points -> (w, h) -> reversed(edge2) points -> (0, 0)
        hole_poly = edge1 + [(w, h)] + list(reversed(edge2)) + [(0, 0)]
        draw.polygon(hole_poly, fill=0)
        
        boundaries.append(edge1)
        boundaries.append(edge2)
        
    else:  # Default to simple center circular hole
        return create_tear_masks(w, h, 'circle', intensity)
        
    # Create hole mask by inverting paper mask
    hole_mask = ImageOps.invert(paper_mask)
    
    return paper_mask, hole_mask, boundaries

def apply_inner_shadow(hole_mask, intensity=0.7):
    """Cast a shadow from the paper edge INWARD into the hole."""
    w, h = hole_mask.size
    scale = w / 1080.0
    # Invert to get paper mask
    paper_mask = ImageOps.invert(hole_mask)
    
    # Blur the paper mask to create a soft bleed into the hole
    blur_radius = max(1, int(18 * scale))
    blurred_paper = paper_mask.filter(ImageFilter.GaussianBlur(blur_radius))
    
    # Mask it with hole_mask so the shadow is only visible inside the hole
    shadow_mask = ImageChops.multiply(blurred_paper, hole_mask)
    
    # Create black RGBA shadow image
    shadow_rgba = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    # Set the opacity based on the shadow mask and intensity
    shadow_arr = np.zeros((h, w, 4), dtype=np.uint8)
    shadow_mask_np = np.array(shadow_mask)
    shadow_arr[..., 3] = (shadow_mask_np * intensity * 0.75).astype(np.uint8)
    shadow_img = Image.fromarray(shadow_arr, mode="RGBA")
    
    return shadow_img

def apply_drop_shadow(paper_mask, intensity=0.6, offset=(6, 10)):
    """Cast a shadow from the paper sheet OUTWARD onto the background."""
    w, h = paper_mask.size
    scale = w / 1080.0
    
    # Create shadow mask by blurring the paper mask
    blur_radius = max(1, int(24 * scale))
    shadow_mask = paper_mask.filter(ImageFilter.GaussianBlur(blur_radius))
    
    # Create black RGBA image
    shadow_rgba = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shadow_arr = np.zeros((h, w, 4), dtype=np.uint8)
    shadow_mask_np = np.array(shadow_mask)
    shadow_arr[..., 3] = (shadow_mask_np * intensity * 0.65).astype(np.uint8)
    shadow_img = Image.fromarray(shadow_arr, mode="RGBA")
    
    # Apply offset
    scaled_offset = (int(offset[0] * scale), int(offset[1] * scale))
    offset_shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    offset_shadow.paste(shadow_img, scaled_offset)
    
    return offset_shadow

def apply_cinematic_lighting(img, face_center, intensity=1.0, theme='dark'):
    """Apply a cinematic radial spotlight centered on the face."""
    w, h = img.size
    fx, fy = face_center
    
    # Create radial gradient mask
    radial_mask = np.zeros((h, w), dtype=np.float32)
    # Compute distances to face center
    y_indices, x_indices = np.indices((h, w))
    # Normalize distances by the diagonal of the image to make it scale-invariant
    diag = math.sqrt(w*w + h*h)
    dist = np.sqrt((x_indices - fx)**2 + (y_indices - fy)**2) / (diag * 0.45)
    
    # Generate spotlight falloff: 1.0 at center, fading to 0.0
    spotlight = np.clip(1.0 - dist, 0.0, 1.0)
    # Smooth step for a soft professional studio lighting profile
    spotlight = spotlight ** 1.8
    
    # Convert image to numpy array for lighting adjustments
    img_np = np.array(img).astype(np.float32)
    
    # 1. Apply Contrast Boost / Darken Shadows (ambient dimming)
    # Ambient dimming factor: dark theme dims more for dramatic effect
    ambient = 0.55 if theme == 'dark' else 0.75
    # Light intensity booster
    boost = 1.0 + (0.35 * intensity)
    
    # Brightness scale map: ambient shadow in corners, bright spotlight in center
    light_map = ambient + (boost - ambient) * spotlight
    # Expand dims for RGB
    light_map_3ch = np.expand_dims(light_map, axis=2)
    
    # Apply lighting map to RGB channels
    img_np[..., :3] = img_np[..., :3] * light_map_3ch
    
    # 2. Add Warm/Cool Color Tint to the Spotlight for a cinematic feel
    # Dark theme gets a cool cyberpunk blue/purple glow or a warm golden studio glow
    # Let's apply a warm cinematic gold tint to the spotlight center
    if theme == 'dark':
        # Add gold/orange color cast at the center of the spotlight
        color_cast = np.zeros((h, w, 3), dtype=np.float32)
        color_cast[..., 0] = spotlight * 30 * intensity  # Red boost
        color_cast[..., 1] = spotlight * 18 * intensity  # Green boost
        color_cast[..., 2] = spotlight * 5 * intensity   # Blue boost
        img_np[..., :3] = img_np[..., :3] + color_cast
    else:
        # Light theme: subtle cool cyan/blue studio lighting
        color_cast = np.zeros((h, w, 3), dtype=np.float32)
        color_cast[..., 0] = spotlight * 5 * intensity   # Red boost
        color_cast[..., 1] = spotlight * 15 * intensity  # Green boost
        color_cast[..., 2] = spotlight * 25 * intensity  # Blue boost
        img_np[..., :3] = img_np[..., :3] + color_cast
        
    # Clip values to valid range
    img_np = np.clip(img_np, 0.0, 255.0).astype(np.uint8)
    
    # 3. Apply Vignette (darken edges of the final composite)
    vignette_mask = np.zeros((h, w), dtype=np.float32)
    cx, cy = w / 2, h / 2
    dist_center = np.sqrt((x_indices - cx)**2 + (y_indices - cy)**2) / (diag * 0.5)
    vignette = np.clip(1.0 - dist_center**2 * 0.75, 0.0, 1.0)
    
    vignette_3ch = np.expand_dims(vignette, axis=2)
    img_np[..., :3] = img_np[..., :3] * vignette_3ch
    
    return Image.fromarray(np.clip(img_np, 0.0, 255.0).astype(np.uint8), mode="RGBA")

def draw_meme_text(img, text, theme='dark'):
    """Draw meme text at the top-left of the image with a cinematic bold style and soft drop shadow."""
    draw = ImageDraw.Draw(img)
    w, h = img.size
    scale = w / 1080.0
    
    # Load Font
    font_size = int(w * 0.038)  # Auto-scaled based on canvas size
    max_font_limit = int(64 * scale)
    font_size = max(24, min(font_size, max_font_limit))
    
    try:
        if os.path.exists(FONT_PATH):
            font = ImageFont.truetype(FONT_PATH, font_size)
        else:
            from PIL import ImageFont
            font = ImageFont.load_default()
    except Exception:
        from PIL import ImageFont
        font = ImageFont.load_default()
        
    # Position text
    x = int(w * 0.05)
    y = int(h * 0.05)
    
    # Draw soft black shadow
    # We do this by creating a separate transparent mask, drawing the text, blurring it, and overlaying it
    shadow_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_img)
    
    # Scale shadow offset and blur by scale factor
    shadow_offset = int(3 * scale)
    shadow_blur = 3.0 * scale
    
    # Draw text on shadow layer
    s_draw.text((x + shadow_offset, y + shadow_offset), text, fill=(0, 0, 0, 230), font=font)
    # Blur the shadow
    blurred_shadow = shadow_img.filter(ImageFilter.GaussianBlur(shadow_blur))
    # Paste shadow onto image
    img.alpha_composite(blurred_shadow)
    
    # Draw crisp white text
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)


def get_font(font_type='regular', size=14):
    try:
        path = FONT_BOLD_PATH if font_type == 'bold' else FONT_REG_PATH
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    except Exception:
        pass
    return ImageFont.load_default()

def generate_default_instagram_ui(theme='dark', w=1080, h=1080):
    """
    Procedurally draws a realistic, vector-clean Instagram profile screen.
    Scales dynamically to support high-resolution templates up to 4K.
    """
    scale = w / 1080.0

    # Colors depending on theme
    if theme == 'dark':
        bg_color = (0, 0, 0, 255)
        text_color = (255, 255, 255, 255)
        sec_text_color = (168, 168, 168, 255)
        btn_bg = (38, 38, 38, 255)
        btn_text = (255, 255, 255, 255)
        border_color = (38, 38, 38, 255)
        accent_blue = (0, 149, 246, 255)
    else:
        bg_color = (255, 255, 255, 255)
        text_color = (0, 0, 0, 255)
        sec_text_color = (115, 115, 115, 255)
        btn_bg = (239, 239, 239, 255)
        btn_text = (0, 0, 0, 255)
        border_color = (219, 219, 219, 255)
        accent_blue = (0, 149, 246, 255)

    img = Image.new("RGBA", (w, h), bg_color)
    draw = ImageDraw.Draw(img)
    
    # 2. Draw Top Bar (Header)
    # Profile Username
    username = "invader.ai"
    font_bold_title = get_font('bold', int(34 * scale))
    font_reg_small = get_font('regular', int(28 * scale))
    font_bold_small = get_font('bold', int(28 * scale))
    
    # Draw back arrow chevron: <
    draw.line([(50 * scale, 70 * scale), (35 * scale, 80 * scale), (50 * scale, 90 * scale)], fill=text_color, width=int(4 * scale))
    
    # Draw username text
    draw.text((80 * scale, 60 * scale), username, fill=text_color, font=font_bold_title)
    
    # Draw verified badge next to username
    user_width = font_bold_title.getlength(username)
    badge_x = 80 * scale + user_width + 15 * scale
    badge_y = 65 * scale
    # Draw blue circle
    draw.ellipse([badge_x, badge_y, badge_x + 30 * scale, badge_y + 30 * scale], fill=accent_blue)
    # Draw white checkmark inside badge
    draw.line([(badge_x + 9 * scale, badge_y + 16 * scale), (badge_x + 14 * scale, badge_y + 21 * scale), (badge_x + 21 * scale, badge_y + 12 * scale)], fill=(255, 255, 255, 255), width=int(3 * scale))
    
    # Draw right header buttons (three dots)
    draw.ellipse([930 * scale, 80 * scale, 936 * scale, 86 * scale], fill=text_color)
    draw.ellipse([950 * scale, 80 * scale, 956 * scale, 86 * scale], fill=text_color)
    draw.ellipse([970 * scale, 80 * scale, 976 * scale, 86 * scale], fill=text_color)
    
    # 3. Draw Profile Info Row (Avatar + Stats)
    avatar_size = int(180 * scale)
    avatar_x, avatar_y = int(60 * scale), int(160 * scale)
    
    # Draw avatar circle or load skull placeholder
    avatar_loaded = False
    skull_path = os.path.join(os.path.dirname(__file__), "static", "assets", "skull_placeholder.png")
    if os.path.exists(skull_path):
        try:
            sk_img = Image.open(skull_path).convert("RGBA")
            sk_img = sk_img.resize((avatar_size, avatar_size), Image.Resampling.LANCZOS)
            # Create a circular mask
            mask = Image.new("L", (avatar_size, avatar_size), 0)
            mask_draw = ImageDraw.Draw(mask)
            mask_draw.ellipse([0, 0, avatar_size, avatar_size], fill=255)
            # Paste into our canvas
            avatar_circle = Image.new("RGBA", (avatar_size, avatar_size), (0,0,0,0))
            avatar_circle.paste(sk_img, (0,0), mask)
            img.paste(avatar_circle, (avatar_x, avatar_y), avatar_circle)
            avatar_loaded = True
        except Exception as e:
            print(f"Error drawing skull avatar: {e}")
            
    if not avatar_loaded:
        draw.ellipse([avatar_x, avatar_y, avatar_x + avatar_size, avatar_y + avatar_size], fill=btn_bg)
        draw.text((avatar_x + int(55 * scale), avatar_y + int(55 * scale)), "💀", fill=text_color, font=get_font('bold', int(48 * scale)))
 
    # Stats layout
    draw.text((440 * scale, 190 * scale), "42", fill=text_color, font=font_bold_small, anchor="mm")
    draw.text((690 * scale, 190 * scale), "1.8M", fill=text_color, font=font_bold_small, anchor="mm")
    draw.text((920 * scale, 190 * scale), "248", fill=text_color, font=font_bold_small, anchor="mm")
    
    font_reg_label = get_font('regular', int(24 * scale))
    draw.text((440 * scale, 240 * scale), "Posts", fill=sec_text_color, font=font_reg_label, anchor="mm")
    draw.text((690 * scale, 240 * scale), "Followers", fill=sec_text_color, font=font_reg_label, anchor="mm")
    draw.text((920 * scale, 240 * scale), "Following", fill=sec_text_color, font=font_reg_label, anchor="mm")
 
    # 4. Draw Bio Section
    bio_y = int(370 * scale)
    draw.text((60 * scale, bio_y), "Instagram Invader AI ⚡", fill=text_color, font=font_bold_small)
    draw.text((60 * scale, bio_y + int(40 * scale)), "Product/Service", fill=sec_text_color, font=font_reg_small)
    draw.text((60 * scale, bio_y + int(80 * scale)), "🤖 Procedural 3D pop-out meme engine", fill=text_color, font=font_reg_small)
    draw.text((60 * scale, bio_y + int(120 * scale)), "🔥 Break through normal social grids", fill=text_color, font=font_reg_small)
    draw.text((60 * scale, bio_y + int(160 * scale)), "👇 Tap INVADE to tear your feed!", fill=text_color, font=font_reg_small)
    draw.text((60 * scale, bio_y + int(200 * scale)), "invader.ai/install", fill=accent_blue, font=font_bold_small)
 
    # 5. Buttons Row
    btn_y = int(650 * scale)
    btn_w = int(460 * scale)
    btn_h = int(72 * scale)
    draw.rounded_rectangle([60 * scale, btn_y, 60 * scale + btn_w, btn_y + btn_h], radius=int(16 * scale), fill=accent_blue)
    draw.text((60 * scale + btn_w // 2, btn_y + btn_h // 2), "Follow", fill=(255,255,255,255), font=font_bold_small, anchor="mm")
    
    draw.rounded_rectangle([540 * scale, btn_y, 540 * scale + btn_w, btn_y + btn_h], radius=int(16 * scale), fill=btn_bg)
    draw.text((540 * scale + btn_w // 2, btn_y + btn_h // 2), "Message", fill=btn_text, font=font_bold_small, anchor="mm")
 
    # 6. Highlights Row
    hl_y = int(750 * scale)
    hl_r = int(130 * scale)
    hl_titles = ["Breaches", "Styles", "Sandbox", "FAQ"]
    hl_emojis = ["⚡", "🎨", "👾", "🚀"]
    
    for i in range(4):
        cx = int(60 * scale + i * (hl_r + 105 * scale))
        if i < 2:
            draw.ellipse([cx, hl_y, cx + hl_r, hl_y + hl_r], outline=(255, 20, 147, 255), width=int(3 * scale))
        else:
            draw.ellipse([cx, hl_y, cx + hl_r, hl_y + hl_r], outline=border_color, width=int(3 * scale))
            
        inner_cx = cx + int(8 * scale)
        inner_cy = hl_y + int(8 * scale)
        inner_r = hl_r - int(16 * scale)
        draw.ellipse([inner_cx, inner_cy, inner_cx + inner_r, inner_cy + inner_r], fill=btn_bg)
        draw.text((inner_cx + inner_r // 2, inner_cy + inner_r // 2), hl_emojis[i], fill=text_color, font=get_font('bold', int(40 * scale)), anchor="mm")
        draw.text((cx + hl_r // 2, hl_y + hl_r + int(25 * scale)), hl_titles[i], fill=text_color, font=get_font('regular', int(22 * scale)), anchor="mm")
 
    # 7. Tab Bar
    tab_y = int(935 * scale)
    tab_h = int(80 * scale)
    draw.line([(0, tab_y), (w, tab_y)], fill=border_color, width=int(2 * scale))
    indicator_w = w // 3
    draw.line([(0, tab_y + tab_h - int(2 * scale)), (indicator_w, tab_y + tab_h - int(2 * scale))], fill=text_color, width=int(4 * scale))
    
    # Draw Grid Icon Tab 1
    grid_cx = indicator_w // 2
    grid_cy = tab_y + tab_h // 2
    gs = int(8 * scale)
    gsp = int(4 * scale)
    for r in range(3):
        for c in range(3):
            sx = grid_cx - int(16 * scale) + c * (gs + gsp)
            sy = grid_cy - int(16 * scale) + r * (gs + gsp)
            draw.rectangle([sx, sy, sx + gs, sy + gs], fill=text_color)
            
    # Draw Reels Icon Tab 2
    reels_cx = indicator_w + indicator_w // 2
    reels_cy = tab_y + tab_h // 2
    draw.rectangle([reels_cx - int(15 * scale), reels_cy - int(15 * scale), reels_cx + int(15 * scale), reels_cy + int(15 * scale)], outline=sec_text_color, width=int(3 * scale))
    draw.line([(reels_cx - int(15 * scale), reels_cy - int(7 * scale)), (reels_cx + int(15 * scale), reels_cy - int(7 * scale))], fill=sec_text_color, width=int(3 * scale))
    draw.polygon([(reels_cx - int(4 * scale), reels_cy - int(2 * scale)), (reels_cx - int(4 * scale), reels_cy + int(6 * scale)), (reels_cx + int(5 * scale), reels_cy + int(2 * scale))], fill=sec_text_color)
    
    # Draw Tagged Icon Tab 3
    tagged_cx = indicator_w * 2 + indicator_w // 2
    tagged_cy = tab_y + tab_h // 2
    draw.ellipse([tagged_cx - int(8 * scale), tagged_cy - int(14 * scale), tagged_cx + int(8 * scale), tagged_cy - int(2 * scale)], outline=sec_text_color, width=int(3 * scale))
    draw.arc([tagged_cx - int(14 * scale), tagged_cy, tagged_cx + int(14 * scale), tagged_cy + int(16 * scale)], start=180, end=360, fill=sec_text_color, width=int(3 * scale))
 
    # 8. Posts Grid
    grid_start_y = tab_y + tab_h
    post_size = (w - int(12 * scale)) // 3
    for i in range(3):
        px = int(3 * scale) + i * (post_size + int(3 * scale))
        py = grid_start_y + int(3 * scale)
        post_img = Image.new("RGBA", (post_size, post_size), bg_color)
        p_draw = ImageDraw.Draw(post_img)
        if i == 0:
            for y_grad in range(post_size):
                alpha = int(255 * (y_grad / post_size))
                p_draw.line([(0, y_grad), (post_size, y_grad)], fill=(255, 20, 147, alpha))
        elif i == 1:
            for y_grad in range(post_size):
                alpha = int(255 * (y_grad / post_size))
                p_draw.line([(0, y_grad), (post_size, y_grad)], fill=(155, 81, 224, alpha))
        else:
            for y_grad in range(post_size):
                alpha = int(255 * (y_grad / post_size))
                p_draw.line([(0, y_grad), (post_size, y_grad)], fill=(0, 240, 255, alpha))
        img.paste(post_img, (px, py), post_img)
 
    return img

def composite_images(portrait_img, profile_img=None, style='circle', intensity=1.0, meme_text="Hi, I just invaded your Instagram 😂", theme='dark', target_w=1080):
    """
    Core image processing pipeline.
    Composites the portrait cutout inside a procedural torn paper hole on top of the Instagram profile.
    """
    scale = target_w / 1080.0

    if profile_img is None:
        profile_img = generate_default_instagram_ui(theme, target_w, target_w)

    # 1. Standardize Canvas Size (Instagram post size, target width target_w)
    orig_w, orig_h = profile_img.size
    scale_factor = target_w / float(orig_w)
    target_h = int(orig_h * scale_factor)
    
    # Resize Instagram profile
    profile_resized = profile_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    canvas_w, canvas_h = target_w, target_h
    
    # Fix orientation and remove background from portrait
    portrait_oriented = auto_orient_image(portrait_img)
    print("Removing portrait background...")
    portrait_cutout = remove_background(portrait_oriented)
    
    # 2. Generate procedural paper torn components
    print("Generating torn paper masks...")
    paper_mask, hole_mask, boundaries = create_tear_masks(canvas_w, canvas_h, style, intensity)
    
    # Create the warm paper sheet frame
    paper_texture = generate_paper_texture(canvas_w, canvas_h)
    # Mask paper texture to only where the paper exists
    paper_frame = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    paper_frame.paste(paper_texture, (0, 0), paper_mask)
    
    # Draw fuzzy paper fiber border along the edges
    border_img = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    border_draw = ImageDraw.Draw(border_img)
    # Draw multiple thick white lines along the boundaries to simulate paper tear borders
    for border in boundaries:
        # Draw a thick white path
        for i in range(len(border) - 1):
            p1, p2 = border[i], border[i+1]
            w_stroke = random.randint(int(10 * scale), int(16 * scale))
            border_draw.line([p1, p2], fill=(255, 255, 255, 255), width=w_stroke)
            
    # Apply a Gaussian blur and add subtle noise to border to make it fuzzy
    border_img = border_img.filter(ImageFilter.GaussianBlur(1.2 * scale))
    
    # Add border on top of the paper frame
    paper_frame.alpha_composite(border_img)
    
    # Create shadows
    inner_shadow = apply_inner_shadow(hole_mask, intensity=0.7)
    drop_shadow = apply_drop_shadow(paper_mask, intensity=0.6)
    
    # 3. Position and scale the Portrait Cutout
    # We want the portrait to fill the tear opening and scale up 115% for the 3D breakout.
    # Find bounding box of subject to scale them correctly
    subj_bbox = portrait_cutout.getbbox()
    if subj_bbox:
        subj_w = subj_bbox[2] - subj_bbox[0]
        subj_h = subj_bbox[3] - subj_bbox[1]
        subj_cropped = portrait_cutout.crop(subj_bbox)
    else:
        subj_w, subj_h = portrait_cutout.size
        subj_cropped = portrait_cutout
        
    # Scale subject to fill a solid portion of the screen (e.g. 70% of canvas height or width)
    # Maintain aspect ratio
    scale_y = (canvas_h * 0.78) / float(subj_h)
    scale_x = (canvas_w * 0.72) / float(subj_w)
    scale = min(scale_x, scale_y)
    
    new_subj_w = int(subj_w * scale)
    new_subj_h = int(subj_h * scale)
    
    subj_scaled = subj_cropped.resize((new_subj_w, new_subj_h), Image.Resampling.LANCZOS)
    
    # Position subject centered horizontally, aligned towards the lower middle vertically
    pos_x = (canvas_w - new_subj_w) // 2
    # Place slightly lower so head is in center
    pos_y = int(canvas_h * 0.15) if style == 'circle' else int(canvas_h * 0.2)
    # Ensure fits within canvas bounds nicely
    pos_y = max(50, min(pos_y, canvas_h - new_subj_h - 20))
    
    # Create a full-canvas portrait layer
    portrait_canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    portrait_canvas.paste(subj_scaled, (pos_x, pos_y))
    
    # Find subject's face center heuristic for cinematic lighting
    # Heuristic: 25% down from top of the cropped subject
    face_cx = pos_x + new_subj_w // 2
    face_cy = pos_y + int(new_subj_h * 0.25)
    face_center = (face_cx, face_cy)
    
    # 4. Process Background
    print("Processing background layers...")
    # Apply depth of field (slight blur) to profile background
    bg_dof = profile_resized.convert("RGBA").filter(ImageFilter.GaussianBlur(3.5))
    
    # Darken and glow the area inside the hole (hole background)
    hole_bg = profile_resized.convert("RGBA")
    # Apply stronger blur and darkening
    hole_bg = hole_bg.filter(ImageFilter.GaussianBlur(8.0))
    # Darken hole background
    enhancer = ImageEnhance.Brightness(hole_bg)
    hole_bg = enhancer.enhance(0.40) # Darken by 60%
    
    # Apply warm/cool glow overlay inside the hole
    glow = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    # Radial glow at face center
    glow_radius = int(max(canvas_w, canvas_h) * 0.4)
    glow_color = (130, 50, 200, 45) if theme == 'dark' else (50, 150, 250, 30) # Purple glow vs Blue glow
    # Draw radial gradient step-by-step
    glow_step = max(5, int(15 * scale))
    for r_glow in range(glow_radius, 0, -glow_step):
        alpha = int(glow_color[3] * (1.0 - r_glow / glow_radius))
        glow_draw.ellipse(
            [face_cx - r_glow, face_cy - r_glow, face_cx + r_glow, face_cy + r_glow],
            fill=(glow_color[0], glow_color[1], glow_color[2], alpha)
        )
    hole_bg.alpha_composite(glow)
    
    # 5. Assemble Layers
    # Base is the slightly blurred Instagram screen
    composite = bg_dof.copy()
    
    # Paste hole background, masked by the hole mask
    composite.paste(hole_bg, (0, 0), hole_mask)
    
    # Paste the portrait cutout, masked by the hole mask (the UNDER layer)
    composite.paste(portrait_canvas, (0, 0), hole_mask)
    
    # Paste the inner shadow inside the hole
    composite.alpha_composite(inner_shadow)
    
    # Paste the drop shadow of the paper sheet onto the background
    composite.alpha_composite(drop_shadow)
    
    # Paste the paper sheet frame
    composite.alpha_composite(paper_frame)
    
    # 6. Apply 3D Breakout Layer (OVER the paper)
    # The breakout layer is the portrait canvas overlayed on top of the paper,
    # but masked with a vertical gradient so it fades to transparent at the bottom
    # (making the bottom stay inside/under the paper, and the top pop out).
    
    # Create the vertical gradient mask for breakout transition
    # Gradient goes from 255 (top) to 0 (bottom)
    # Let's start the transition around 45% of canvas height and end at 80% height
    grad_mask = Image.new("L", (canvas_w, canvas_h), 255)
    grad_arr = np.ones((canvas_h, canvas_w), dtype=np.uint8) * 255
    
    # Define start and end of fade transition
    fade_start = int(canvas_h * 0.38)
    fade_end = int(canvas_h * 0.78)
    
    for y in range(canvas_h):
        if y < fade_start:
            grad_arr[y, :] = 255
        elif y > fade_end:
            grad_arr[y, :] = 0
        else:
            # Linear interpolation
            factor = 1.0 - (y - fade_start) / (fade_end - fade_start)
            grad_arr[y, :] = int(factor * 255)
            
    grad_mask = Image.fromarray(grad_arr, mode="L")
    
    # Combine the vertical gradient with the portrait alpha channel
    breakout_mask = ImageChops.multiply(portrait_canvas.split()[3], grad_mask)
    
    # Add a drop shadow for the breakout part (casting shadow from head onto the paper frame)
    breakout_shadow = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    # Set alpha to the breakout mask
    bo_shadow_arr = np.zeros((canvas_h, canvas_w, 4), dtype=np.uint8)
    bo_shadow_arr[..., 3] = (np.array(breakout_mask) * 0.55).astype(np.uint8) # shadow strength 55%
    bo_blur = max(1, int(15 * scale))
    bo_shadow_img = Image.fromarray(bo_shadow_arr, mode="RGBA").filter(ImageFilter.GaussianBlur(bo_blur))
    # Offset shadow slightly down and right
    bo_offset = (int(5 * scale), int(8 * scale))
    offset_bo_shadow = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    offset_bo_shadow.paste(bo_shadow_img, bo_offset)
    # Paste breakout shadow onto composite
    composite.alpha_composite(offset_bo_shadow)
    
    # Paste the breakout portrait layer
    composite.paste(portrait_canvas, (0, 0), breakout_mask)
    
    # 7. Apply Cinematic Lighting Engine
    print("Applying cinematic lighting...")
    composite = apply_cinematic_lighting(composite, face_center, intensity, theme)
    
    # 8. Draw Meme Text
    if meme_text:
        print("Drawing meme text...")
        draw_meme_text(composite, meme_text, theme)
        
    return composite
