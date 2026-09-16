# SailSight color reference

The implemented theme tokens live in [`src/app/globals.css`](../src/app/globals.css). Tailwind 4 exposes them through `@theme inline`; `:root` defines light values and `.dark` overrides them. `next-themes` applies the theme class. This reference describes current colors; component guidance below is a convention for future edits, not a claim that every visualization uses CSS tokens.

## 1. Design Philosophy

The SailSight frontend employs a **High-Tech / Racing** aesthetic. The color system is built to resemble modern racing dash displays: dark, high-contrast, and utilitarian, featuring neon accents for critical data readability.

The palette uses **SailSight Red / Orange** for primary actions. Charts and maps use distinct series colors; several chart series have separate light/dark colors. Readability still needs visual verification in both themes.

This document defines abstract "design tokens" (functional color roles) rather than hardcoded hex values tied to specific UI components. This ensures that as the frontend evolves, the underlying color system remains cohesive.

---

## 2. Core Palette

### Brand Colors

* **Primary Brand:** SailSight Red/Orange (#FF4500)
* **Primary Accent:** Vibrant Racing Orange (#FF6A00)

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

* **Flat GPS track:** Cyan (#00FFFF).
* **SOG / COG:** Sky blue (#0369A1 light / #38BDF8 dark).
* **Boat heading:** Dashed amber (#92400E light / #FBBF24 dark).
* **Heel:** Teal (#0F766E light / #2DD4BF dark).
* **Trim:** Purple (#7E22CE light / #C084FC dark).
* **Optional telemetry:** Wind speed, speed through water, and shift-record heading use neon green (#39FF14); wind direction and depth use yellow (#FFFF00); temperature uses cyan (#00FFFF); load uses magenta (#FF00FF).
* **Heatmap Gradient (Speed over Ground):**
  * Slow / Low: **Deep Blue** (#0000FF)
  * Medium-Low: **Cyan** (#00FFFF)
  * Medium-High: **Neon Green** (#00FF00)
  * Fast / High: **Bright Yellow** (#FFFF00)
  * Maximum: **SailSight Red** (#FF0000)

* **Special overlays:** Countdown track is dashed purple (#B200FF); selected time-window track is translucent orange (#FF8C00). Course targets are yellow (#FFCC00), with the active target teal (#0D9488). Rounding-radius outlines use green for starboard and red for port.
* **Start-line marks:** Boat end is a square in #FF4500; pin end is a triangle in #00CCFF. The playback boat arrow is #FF4500.

Leaflet and ECharts receive explicit color values from their components. Shared digital instruments use theme utilities for text, borders, and direction indicators; heel/trim scales do not use the former green/yellow/red severity thresholds.

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
  * *Light Mode:* #FF4500.
  * *Dark Mode:* #00CCFF.

---

## 5. UI Component Guidelines

When building or updating the UI (from tables to maps), ensure components apply these tokens generically:

1. **Tab Bars & Sidebars:** Use color-bg-surface with color-action-primary to indicate the active route/tab.
2. **Telemetry Maps (Leaflet):** The map tiles (Carto minimalistic) will inherently define the base. Ensure the track colors (Cyan/Magenta) are bright enough to contrast against both Light and Dark map instances.
3. **Race Timer:** Ensure the numbers use Monospace fonts. Apply the **Warning (Amber)** token during the countdown phase and the **Success (Neon Green)** token for the elapsed race time.
4. **Charts:** Chart crosshairs and grids should use a faint color-border-default with a very low opacity, ensuring the Data Visualization palette (Cyan, Magenta, etc.) remains central.
5. **Toasts:** Use `bg-bg-elevated` with semantic icon and ring colors. Toasts appear at the top right and adapt their surface to the selected theme.
