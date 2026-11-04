## 2024-11-04 - Settings Form Missing `for` Attributes
**Learning:** In `index.html`, several form labels (like `PRIMARY PLAYBACK ENGINE`, `APPLICATION LANGUAGE`, etc.) lack `for` attributes connecting them to their corresponding select inputs. This makes the form less accessible for screen reader users and those navigating with keyboards, as they miss context and click-to-focus behavior.
**Action:** Always ensure that `label` elements use the `for` attribute referencing the `id` of the form input they describe.
