# Design Specification: Color Scheme

## 1. Design Philosophy

The SailSight frontend employs a **High-Tech / Racing** aesthetic. The color system is built to resemble modern racing dash displays: dark, high-contrast, and utilitarian, featuring neon accents for critical data readability.

The palette uses a **SailSight Red / Orange** primary brand color, grounding the application in its maritime performance identity. Data visualization relies on vibrant, high-contrast colors (Cyans, Magentas, Yellows, Neon Greens) ensuring telemetry lines and heatmaps stand out sharply against both light and dark backgrounds.

This document defines abstract "design tokens" (functional color roles) rather than hardcoded hex values tied to specific UI components. This ensures that as the frontend evolves, the underlying color system remains cohesive.

---

## 2. Core Palette

### Brand Colors

* **Primary Brand:** SailSight Red/Orange (e.g., #FF4500 to #E63900)
* **Primary Accent:** Vibrant Racing Orange (e.g., #FF6A00)

### Neutrals (Surfaces & Typography)

The neutral palette leans towards cool, "carbon" grays to reinforce the high-tech feel.

* **Base White:** #FFFFFF
* **Cool Gray 100-300:** Light mode surfaces and dark mode typography.
* **Carbon Gray 600-800:** Dark mode elevated surfaces, light mode secondary text.
* **Deep Carbon (Black):** #0F1115 - Dark mode base background.

### Semantic Status Colors

Used for system feedback, alerts, and toasts.

* **Success:** Neon Green (e.g., #00FF66) - High-contrast validation.
* **Warning:** Amber / Yellow (e.g., #FFCC00) - Cautionary alerts, countdown timers.
* **Error:** Alarm Red (e.g., #FF3333) - Failures, destructive actions.
* **Info:** Cyan / Bright Blue (e.g., #00CCFF) - Neutral information.

---

## 3. Data Visualization & Telemetry Palette

Data needs maximum legibility on the interactive maps and charts.

* **Primary Track/Telemetry Line:** Cyan (#00FFFF) or Magenta (#FF00FF) for extreme contrast.
* **Secondary/Compare Lines:** Neon Green (#39FF14), Bright Yellow (#FFFF00).
* **Heatmap Gradient (Speed over Ground):**
  * Slow / Low: **Deep Blue** (#0000FF)
  * Medium-Low: **Cyan** (#00FFFF)
  * Medium-High: **Neon Green** (#00FF00)
  * Fast / High: **Bright Yellow** (#FFFF00)
  * Maximum: **SailSight Red** (#FF0000)

* **Special Overlays:**

* *Pre-Race Countdown Track:* Dashed Vibrant Purple (#B200FF) or Amber (#FFBF00).
* *Start Line Marks:* Boat end (Squared Red/Orange), Pin end (Triangular Blue/Cyan).

---

## 4. Theme Implementation (Tokens)

To support both Light and Dark modes without redefining components, use the following functional token mapping.

### 4.1. Backgrounds & Surfaces

* **color-bg-base**:
  * *Light Mode:* #F5F7F9 (Off-white/light gray)
  * *Dark Mode:* #0F1115 (Deep Carbon)
* **color-bg-surface**: Cards, Modals, Popovers.
  * *Light Mode:* #FFFFFF
  * *Dark Mode:* #1A1D24
* **color-bg-elevated**: Dropdowns, floating action menus.
  * *Light Mode:* #FFFFFF (with strong shadow)
  * *Dark Mode:* #252933 (with dark shadow)

### 4.2. Typography & Icons

* **color-text-primary**: Standard readable text.
  * *Light Mode:* #111827 (Very dark gray)
  * *Dark Mode:* #F9FAFB (Off-white)
* **color-text-secondary**: Muted text, captions, table headers.
  * *Light Mode:* #6B7280
  * *Dark Mode:* #9CA3AF
* **color-text-disabled**:
  * *Light Mode:* #9CA3AF
  * *Dark Mode:* #4B5563

### 4.3. Interactive Elements (Controls, Buttons, Links)

* **color-action-primary**: Primary buttons and active states.
  * *Both Modes:* SailSight Red/Orange (#FF4500).
* **color-action-hover**:
  * *Both Modes:* Lightened/Brightened Orange (#FF6A00).
* **color-border-default**: Dividers, inactive input borders.
  * *Light Mode:* #E5E7EB
  * *Dark Mode:* #374151
* **color-border-active**: Focused inputs, active tabs.
  * *Both Modes:* SailSight Red/Orange or Cyan (to contrast High-Tech vibe).

---

## 5. UI Component Guidelines

When building or updating the UI (from tables to maps), ensure components apply these tokens generically:

1. **Tab Bars & Sidebars:** Use color-bg-surface with color-action-primary to indicate the active route/tab.
2. **Telemetry Maps (Leaflet):** The map tiles (Carto minimalistic) will inherently define the base. Ensure the track colors (Cyan/Magenta) are bright enough to contrast against both Light and Dark map instances.
3. **Race Timer:** Ensure the numbers use Monospace fonts. Apply the **Warning (Amber)** token during the countdown phase and the **Success (Neon Green)** token for the elapsed race time.
4. **Charts:** Chart crosshairs and grids should use a faint color-border-default with a very low opacity, ensuring the Data Visualization palette (Cyan, Magenta, etc.) remains central.
5. **Toasts:** Toast backgrounds should ideally be deep dark (even in light mode) or use color-bg-surface but highlighted heavily by the Semantic Colors (Green, Red, Amber, Cyan) for immediate visual identification.
