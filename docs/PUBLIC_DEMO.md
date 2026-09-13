# Public demo data

The public sample must contain only invented companies, people, machines,
documents, identifiers, measurements, and support cases. It must not reuse text,
tables, specifications, screenshots, or terminology from an employer, customer,
supplier, or commercial manual.

The local fixture uses the clearly labelled Atlas and Nova training cells for
the fictional Atlas Industrial Systems and Northstar Components workspaces. It
includes two sites, four machines, one customer contact, and two open sample
requests. Account email addresses use reserved `.invalid` domains, contact email
addresses use `.example`, and generated PDFs state that they are fictional and
are not operating instructions.

Before publishing a screenshot:

1. Start from a fresh `make setup` fixture.
2. Remove records created by earlier QA runs.
3. Keep the synthetic/demo label visible.
4. Check names, email addresses, phone numbers, serials, document text, browser
   tabs, and file paths.
5. Do not show API keys, cookies, database URLs, recovery links, local usernames,
   or provider responses.
6. Capture only workflows that actually work in the checked-in source.

Open, unresolved sample cases are suitable. Do not seed resolved, assigned, or
customer-replied states solely for screenshots while those workflow transitions
remain incomplete.
