## 2024-05-24 - Form Label Association
**Learning:** Form labels in the application (e.g., in index.html settings) frequently lack the 'for' attribute required to associate them with their corresponding input/select elements, breaking accessibility and reducing the clickable area for users.
**Action:** Always add a 'for' attribute to `<label>` elements that perfectly matches the `id` of the corresponding form control (input, select, textarea).
