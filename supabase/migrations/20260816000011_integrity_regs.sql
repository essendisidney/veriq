-- Integrity and beneficial-ownership statutes. Catalog in code is the source of truth;
-- these rows let organisation_regulations attach after a scan.
-- ACECA/PPADA mapping is a standing public regime — not an allegation of corruption.

insert into public.regulations (code, name, jurisdiction, category, summary, industries)
values
  (
    'KE-ACECA',
    'Anti-Corruption and Economic Crimes Act',
    'KE',
    'integrity',
    'Kenya’s standing anti-corruption and economic-crimes framework, including conflict, gifts and abuse-of-office duties. Mapped as a public regime — not a finding that this company or any person is corrupt.',
    array['financial_services','fintech','insurance','technology','saas','healthcare','telecommunications','retail','logistics','public_sector','professional_services','energy','agriculture','manufacturing','other']
  ),
  (
    'KE-BO',
    'Companies Act beneficial-ownership duties',
    'KE',
    'governance',
    'Beneficial-ownership filing and persons-with-significant-control duties under Kenya company law. Where the register is published it is a public fact; VERIQ does not scrape it.',
    array['financial_services','fintech','insurance','technology','saas','healthcare','telecommunications','retail','logistics','public_sector','professional_services','energy','agriculture','manufacturing','other']
  ),
  (
    'KE-PPADA',
    'Public Procurement and Asset Disposal Act',
    'KE',
    'integrity',
    'Public procurement, evaluation and award duties for public entities in Kenya. Mapped to public-sector organisations — not a finding that a tender was irregular.',
    array['public_sector']
  )
on conflict (code) do update
set
  name = excluded.name,
  jurisdiction = excluded.jurisdiction,
  category = excluded.category,
  summary = excluded.summary,
  industries = excluded.industries;
