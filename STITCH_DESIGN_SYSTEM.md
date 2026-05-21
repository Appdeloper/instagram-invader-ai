# Instagram Invader AI - Stitch UI Design System

Use this design system document to bootstrap, configure, or guide Google Stitch AI (`stitch.withgoogle.com`) when generating and styling new components for the Instagram Invader AI platform.

---

## 🎨 Color Palette & Shadows

Our aesthetic is a premium, futuristic dark mode featuring ambient neon highlights, clean glassmorphism, and deep slate/black space backdrops.

```json
{
  "theme": "Dark Cinematic / Glassmorphic",
  "colors": {
    "backgrounds": {
      "base": "#000000",
      "surface": "#0a0612",
      "card": "rgba(18, 12, 28, 0.75)",
      "input": "rgba(255, 255, 255, 0.02)"
    },
    "accents": {
      "pink": "#d946ef",
      "purple": "#a855f7",
      "cyan": "#06b6d4"
    },
    "borders": {
      "glass": "rgba(255, 255, 255, 0.08)",
      "glow_pink": "rgba(255, 20, 147, 0.3)"
    },
    "typography": {
      "main": "#f8fafc",
      "muted": "#94a3b8",
      "secondary": "#64748b"
    }
  },
  "effects": {
    "blur": "20px",
    "glows": {
      "pink": "0 0 20px rgba(217, 70, 239, 0.5)",
      "cyan": "0 0 20px rgba(6, 182, 212, 0.5)"
    },
    "transitions": "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
  }
}
```

---

## ✍️ Typography

- **Headers & Display Text**: `Poppins`, sans-serif (Weights: 600, 700, 800)
- **Body & Controls**: `Outfit`, sans-serif (Weights: 300, 400, 500, 600)

---

## 📐 Layout & Dimensions

- **Max Layout Width**: `1280px`
- **Gutter Padding**: `2rem (32px)` on desktop, `1rem (16px)` on mobile
- **Card Border Radius**: `24px`
- **Control Element Radius (Buttons, Inputs)**: `12px` to `16px`
- **Header Navbar Height**: `76px`

---

## 💎 Custom CSS Component Tokens

When outputting Vanilla CSS or styling elements, use the following core classes:

### Glassmorphic Card Container
```css
.card {
    background: rgba(18, 12, 28, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    padding: 2.2rem;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(20px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.card:hover {
    border-color: rgba(255, 255, 255, 0.12);
}
```

### Premium Glow Buttons
```css
.btn-primary {
    background: linear-gradient(135deg, #d946ef 0%, #a855f7 100%);
    border: none;
    border-radius: 14px;
    padding: 1.1rem;
    color: #ffffff;
    font-family: 'Poppins', sans-serif;
    font-weight: 700;
    box-shadow: 0 4px 20px rgba(217, 70, 239, 0.3);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(217, 70, 239, 0.55), 0 0 20px rgba(217, 70, 239, 0.5);
}
```

### Floating Input Fields
```css
.input-group {
    position: relative;
    margin-bottom: 1.4rem;
}
.input-group input {
    width: 100%;
    padding: 0.9rem 1rem 0.9rem 2.8rem;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    color: #ffffff;
    outline: none;
}
.input-group input:focus {
    border-color: #06b6d4;
    box-shadow: 0 0 15px rgba(6, 182, 212, 0.15);
}
```
