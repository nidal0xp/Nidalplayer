## 2024-05-24 - Unquoted HTML attributes break screen reader parsing
**Learning:** Screen readers and assistive technologies may fail to parse HTML attributes correctly when they contain spaces but are not enclosed in quotes (e.g. `alt=Nidalplayer Logo`). The parser treats the first word as the attribute value and subsequent words as separate boolean attributes, breaking accessibility.
**Action:** Always wrap HTML attribute values in double quotes, particularly when the value may contain spaces or special characters.
