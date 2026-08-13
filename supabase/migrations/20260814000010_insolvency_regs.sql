-- Kenya insolvency and advocates statutes. Catalog in code is the source of truth;
-- these rows let organisation_regulations attach after a scan.

insert into public.regulations (code, name, jurisdiction, category, summary, industries)
values
  (
    'KE-IA',
    'Insolvency Act, 2015',
    'KE',
    'insolvency',
    'Kenya’s framework for administration, liquidation, receivership and related insolvency procedures, including books of account, statements of affairs and cooperation with an insolvency practitioner.',
    array['financial_services','fintech','insurance','technology','saas','healthcare','telecommunications','retail','logistics','public_sector','professional_services','energy','agriculture','manufacturing','other']
  ),
  (
    'KE-ADV',
    'Advocates Act / Law Society of Kenya professional conduct',
    'KE',
    'professional',
    'Admission, practising certificate, client-account and professional-conduct expectations for advocates in Kenya. Mapped to professional-services firms — not a finding of professional misconduct.',
    array['professional_services']
  )
on conflict (code) do update
set
  name = excluded.name,
  jurisdiction = excluded.jurisdiction,
  category = excluded.category,
  summary = excluded.summary,
  industries = excluded.industries;
