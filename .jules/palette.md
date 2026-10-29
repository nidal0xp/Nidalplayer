## 2026-10-29 - Added missing HTML 'for' attributes to labels
**Learning:** Found labels in the configuration forms of index.html that lacked 'for' attributes linking them to their respective input fields. This impacts screen reader accessibility.
**Action:** Always ensure all `<label>` elements have a 'for' attribute matching the ID of the corresponding input/select element to maintain accessibility standards.
