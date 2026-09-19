import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_presentation():
    # 1. Base Canvas (1920 x 1080)
    W, H = 1920, 1080
    canvas = Image.new("RGBA", (W, H), (11, 13, 17, 255))
    draw = ImageDraw.Draw(canvas)

    # 2. Add subtle background lighting / radial glows
    glow_img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_img)
    # Ambient top-center warm orange glow
    glow_draw.ellipse([W//2 - 500, -200, W//2 + 500, 400], fill=(255, 69, 26, 35))
    # Ambient mobile highlight glow
    glow_draw.ellipse([1400, 250, 1900, 950], fill=(255, 69, 26, 25))
    # Ambient desktop highlight glow
    glow_draw.ellipse([100, 300, 800, 900], fill=(46, 196, 182, 18))
    glow_img = glow_img.filter(ImageFilter.GaussianBlur(100))
    canvas.alpha_composite(glow_img)

    draw = ImageDraw.Draw(canvas)

    # Fonts
    font_brand = ImageFont.truetype("C:\\Windows\\Fonts\\impact.ttf", 44)
    font_title = ImageFont.truetype("C:\\Windows\\Fonts\\segoeui.ttf", 36)
    font_subtitle = ImageFont.truetype("C:\\Windows\\Fonts\\segoeui.ttf", 18)
    font_badge = ImageFont.truetype("C:\\Windows\\Fonts\\segoeui.ttf", 13)
    font_pill = ImageFont.truetype("C:\\Windows\\Fonts\\segoeui.ttf", 15)

    # 3. Header Section
    # Orange brand tag
    draw.rectangle([80, 50, 310, 98], fill=(255, 69, 26, 255))
    draw.text((92, 48), "NIDALPLAYER", font=font_brand, fill=(11, 13, 17, 255))

    # Version pill
    draw.rounded_rectangle([325, 58, 420, 90], radius=6, fill=(28, 34, 45, 255), outline=(50, 59, 75, 255), width=1)
    draw.text((342, 64), "V4.1 PRO", font=font_badge, fill=(255, 110, 70, 255))

    # Header Title & Subtitle
    draw.text((80, 115), "ULTRA HD STREAM & CINEMA ECOSYSTEM", font=font_title, fill=(244, 241, 234, 255))
    draw.text((80, 162), "Windows 64-bit Desktop Media Engine + Touch-Optimized Mobile Companion Web Remote", font=font_subtitle, fill=(139, 146, 158, 255))

    # 4. Load & Frame Desktop Screenshot
    desktop_path = "assets/screenshot.png"
    if os.path.exists(desktop_path):
        d_img = Image.open(desktop_path).convert("RGBA")
        
        # Target Desktop Dimensions on Canvas: ~1140 x 708
        dt_w = 1140
        dt_h = int(d_img.height * (dt_w / d_img.width))
        if dt_h > 720:
            dt_h = 720
            dt_w = int(d_img.width * (dt_h / d_img.height))
        
        d_resized = d_img.resize((dt_w, dt_h), Image.Resampling.LANCZOS)
        
        # Desktop Frame / Window Bezel
        desk_x = 80
        desk_y = 220
        
        # Window Drop Shadow
        shadow = Image.new("RGBA", (dt_w + 40, dt_h + 40), (0, 0, 0, 0))
        sh_draw = ImageDraw.Draw(shadow)
        sh_draw.rounded_rectangle([10, 10, dt_w + 30, dt_h + 30], radius=16, fill=(0, 0, 0, 140))
        shadow = shadow.filter(ImageFilter.GaussianBlur(16))
        canvas.alpha_composite(shadow, (desk_x - 10, desk_y - 10))
        
        # Window Border & Glass Container
        draw = ImageDraw.Draw(canvas)
        draw.rounded_rectangle([desk_x - 4, desk_y - 4, desk_x + dt_w + 4, desk_y + dt_h + 4], radius=12, fill=(20, 24, 32, 255), outline=(50, 59, 75, 255), width=2)
        
        canvas.paste(d_resized, (desk_x, desk_y), d_resized)
        
        # Desktop Badge
        draw.rounded_rectangle([desk_x + 16, desk_y + 16, desk_x + 360, desk_y + 48], radius=6, fill=(11, 13, 17, 230), outline=(255, 69, 26, 200), width=1)
        draw.text((desk_x + 26, desk_y + 24), "DESKTOP CINEMA & 4K STREAM ENGINE", font=font_badge, fill=(244, 241, 234, 255))

    # 5. Load & Frame Mobile Remote Screenshot
    mobile_path = "assets/mobile-remote.png"
    if os.path.exists(mobile_path):
        m_img = Image.open(mobile_path).convert("RGBA")
        
        # Phone target dimensions: ~420 x 780
        mb_w = 380
        mb_h = int(m_img.height * (mb_w / m_img.width))
        if mb_h > 720:
            mb_h = 720
            mb_w = int(m_img.width * (mb_h / m_img.height))
            
        m_resized = m_img.resize((mb_w, mb_h), Image.Resampling.LANCZOS)
        
        mob_x = 1350
        mob_y = 220
        
        # Phone Shadow
        m_shadow = Image.new("RGBA", (mb_w + 40, mb_h + 40), (0, 0, 0, 0))
        m_sh_draw = ImageDraw.Draw(m_shadow)
        m_sh_draw.rounded_rectangle([10, 10, mb_w + 30, mb_h + 30], radius=28, fill=(0, 0, 0, 170))
        m_shadow = m_shadow.filter(ImageFilter.GaussianBlur(18))
        canvas.alpha_composite(m_shadow, (mob_x - 10, mob_y - 10))
        
        # Phone Bezel Frame (Sleek Smartphone body)
        draw = ImageDraw.Draw(canvas)
        draw.rounded_rectangle([mob_x - 10, mob_y - 10, mob_x + mb_w + 10, mob_y + mb_h + 10], radius=24, fill=(18, 22, 30, 255), outline=(255, 69, 26, 180), width=2)
        
        # Paste Mobile UI
        canvas.paste(m_resized, (mob_x, mob_y), m_resized)
        
        # Phone Dynamic Island / Speaker notch
        draw.rounded_rectangle([mob_x + mb_w//2 - 45, mob_y - 4, mob_x + mb_w//2 + 45, mob_y + 4], radius=4, fill=(8, 10, 14, 255))
        
        # Mobile Badge
        draw.rounded_rectangle([mob_x + 12, mob_y + 16, mob_x + mb_w - 12, mob_y + 46], radius=6, fill=(11, 13, 17, 230), outline=(0, 230, 118, 180), width=1)
        draw.text((mob_x + 24, mob_y + 22), "TOUCH WEB REMOTE (LAN QR SYNC)", font=font_badge, fill=(0, 230, 118, 255))

    # 6. Bottom Feature Pills Bar
    pills = [
        "FAST STARTUP (<150ms)",
        "TOP 5 LEAGUES MATCH RADAR",
        "4K TMDB POSTER ENRICHMENT",
        "SMARTPHONE WEB REMOTE",
        "SILENT AUTO-UPDATES"
    ]
    
    px = 80
    py = 990
    for p in pills:
        bbox = font_pill.getbbox(p)
        pw = bbox[2] - bbox[0] + 32
        ph = 42
        draw.rounded_rectangle([px, py, px + pw, py + ph], radius=8, fill=(19, 23, 31, 255), outline=(40, 48, 62, 255), width=1)
        draw.text((px + 16, py + 10), p, font=font_pill, fill=(220, 225, 232, 255))
        px += pw + 16

    # 7. Save outputs
    out_assets = "assets/presentation.png"
    out_release = "C:\\Users\\nidal\\.gemini\\antigravity-ide\\brain\\ad6ba384-bfc0-4852-a7b0-5bc7161fcb25\\scratch\\release_repo\\presentation.png"
    
    canvas_rgb = canvas.convert("RGB")
    canvas_rgb.save(out_assets, quality=95)
    canvas_rgb.save(out_release, quality=95)
    print(f"Presentation graphic successfully generated at {out_assets} and {out_release}")

if __name__ == "__main__":
    create_presentation()
