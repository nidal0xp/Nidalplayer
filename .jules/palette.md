## 2024-05-24 - Form Label Association
**Learning:** Form labels in custom config-card layouts often lack the 'for' attribute, breaking screen reader association and click-to-focus behavior.
**Action:** Always verify that every <label> tag explicitly uses a 'for' attribute matching the target input/select 'id', even when visually grouped inside a card component.
