# Design System Document: High-End Editorial Monochromatic

## 1. Overview & Creative North Star
**Creative North Star: "The Intellectual Sanctuary"**

This design system is engineered to transform a high-productivity study environment into a serene, premium editorial experience. Moving away from the cluttered "dashboard" look, we treat the UI as a curated publication. We achieve this through **Organic High-Contrast**: utilizing the absolute authority of deep blacks (`primary: #000000`) against the breathable purity of off-whites (`surface: #f9f9f9`).

The design breaks the "template" aesthetic by favoring generous, regular spacing (8px grid) and intentional tonal depth. Instead of relying on lines to organize information, we use mathematical symmetry and varied surface heights to guide the eye, creating a sanctuary for focus and deep learning.

---

## 2. Colors
Our palette is a sophisticated exercise in tonal restraint. It uses the Material Design convention to define functional roles while maintaining a strictly monochromatic soul.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning or containment. Structural boundaries must be defined solely through:
1. **Tonal Shifts:** Placing a `surface_container_low` (`#f3f3f4`) card on a `surface` (`#f9f9f9`) background.
2. **Negative Space:** Using the 8px grid to create "gutters" of air that act as invisible dividers.

### Surface Hierarchy & Nesting
Treat the UI as physical layers of fine paper. Use the following hierarchy to nest elements:
* **Base Layer:** `surface` (#f9f9f9) for the primary application background.
* **Secondary Sections:** `surface_container` (#eeeeee) for sidebar backgrounds or large content areas.
* **Floating Cards:** `surface_container_lowest` (#ffffff) to create the highest contrast and "pop" against the gray-tinted backgrounds.

### Glass & Gradient Rule
To prevent the design from feeling "flat" or "cheap," apply Glassmorphism to floating modals and navigation overlays.
* **Effect:** Use `surface_container_lowest` at 80% opacity with a 20px Backdrop Blur.
* **Signature Gradients:** For primary CTAs, use a subtle linear gradient from `primary` (#000000) to `primary_container` (#3c3b3b) at a 135° angle. This adds a "weighted" feel to buttons that flat black cannot achieve.

---

## 3. Typography
We utilize a pairing of **Manrope** for high-impact display and **Inter** for functional reading.

* **Display & Headlines (Manrope):** These are the "Editorial Voice." Use `display-lg` (3.5rem) for major milestones or focus-mode timers. The geometric nature of Manrope conveys modern authority.
* **Body & Titles (Inter):** These are the "Functional Voice." Use `body-md` (0.875rem) for all study notes and descriptions. Inter’s high X-height ensures legibility during long-form reading sessions.
* **Labels (Inter Bold):** Small caps or bold labels (`label-sm`) should be used for metadata like "TIME REMAINING" or "TASK CATEGORY" to provide a technical, high-end feel.

---

## 4. Elevation & Depth
Depth in this system is a result of **Tonal Layering** rather than traditional drop shadows.

* **The Layering Principle:** Place a white card (`surface_container_lowest`) on a light gray background (`surface_container_low`). The contrast difference creates a natural lift.
* **Ambient Shadows:** Where shadows are essential (e.g., a floating Action Button), use an "Atmospheric Shadow":
* **Blur:** 24px - 40px
* **Opacity:** 4% - 6%
* **Color:** `#1a1c1c` (on_surface)
* **Ghost Borders:** If an element lacks sufficient contrast, use a "Ghost Border": `outline_variant` (#c6c6c6) at **15% opacity**. It should be felt, not seen.
* **Roundedness:** A strict adherence to the `xl` (12px) radius for primary cards and `lg` (8px) for buttons creates a soft, approachable geometry that offsets the high-contrast color palette.

---

## 5. Components

### Buttons
* **Primary:** Solid `primary` (#000000) with `on_primary` (#e5e2e1) text. Apply the signature gradient for a premium sheen. 12px border radius.
* **Secondary:** `surface_container_high` (#e8e8e8) background with `on_surface` text. No border.
* **Tertiary:** No background. Bold `primary` text with a 2px underline appearing only on hover.

### Cards & Lists
* **The Divider Ban:** Strictly forbid `
` lines. Separate list items using 16px of vertical white space or by alternating background tones between `surface` and `surface_container_low`.

* **Progress Cards:** Use `primary` (#000000) for progress bars against a `surface_variant` (#e2e2e2) track to create high-visibility data visualization.

### Study-Specific Components
* **Focus Timer:** Utilize `display-lg` typography centered in a `surface_container_lowest` circular container with a 4% ambient shadow.
* **Note Tiles:** Use asymmetric layouts—place the title at the top left and metadata (`label-sm`) at the bottom right to break the standard grid feel.

### Input Fields
* **Style:** Minimalist. No background. Only a bottom "Ghost Border" (15% opacity `outline_variant`). On focus, the border transitions to 100% `primary` black with a 2px thickness.

---

## 6. Do's and Don'ts

### Do
* **Do** use extreme white space. If you think there is enough padding, add 8px more.
* **Do** use `primary` black for text that needs to be "authoritative" (Headlines) and `on_surface_variant` (#474747) for "supportive" text (Body).
* **Do** ensure all icons are "Line-based" with a consistent 1.5px or 2px stroke weight.

### Don'ts
* **Don't** use pure `#000000` for shadows; it looks muddy. Use a tinted shadow.
* **Don't** use 1px solid black borders. This destroys the editorial "premium" feel and makes the app look like a wireframe.
* **Don't** use bright colors for success or warning unless absolutely necessary. Use `error` (#ba1a1a) sparingly; prefer monochromatic "state icons" (checkmarks/exclamations) to convey status.