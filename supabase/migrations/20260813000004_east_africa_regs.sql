-- East Africa regulatory pack. Catalog in code is the source of truth;
-- these rows let organisation_regulations attach after a scan.

insert into public.regulations (code, name, jurisdiction, category, summary, industries)
values
  (
    'KE-CMCA',
    'Computer Misuse and Cybercrimes Act, 2018',
    'KE',
    'cybersecurity',
    'Kenya’s criminal and investigative framework for unauthorised access, data interference and related cyber offences.',
    array['financial_services','fintech','insurance','technology','saas','healthcare','telecommunications','retail','logistics','public_sector','professional_services','energy','agriculture','manufacturing']
  ),
  (
    'UG-DPA',
    'Uganda Data Protection and Privacy Act, 2019',
    'UG',
    'privacy',
    'Uganda’s framework for personal data processing, security and data subject rights.',
    array['financial_services','fintech','insurance','technology','saas','healthcare','telecommunications','retail','logistics','public_sector','professional_services']
  ),
  (
    'UG-AML',
    'Anti-Money Laundering Act (Uganda)',
    'UG',
    'aml',
    'Uganda’s AML/CFT obligations for financial institutions and accountable persons.',
    array['financial_services','fintech','insurance']
  ),
  (
    'TZ-PDPA',
    'Tanzania Personal Data Protection Act, 2022',
    'TZ',
    'privacy',
    'Tanzania’s personal data protection statute covering processing, security and cross-border transfer.',
    array['financial_services','fintech','insurance','technology','saas','healthcare','telecommunications','retail','logistics','public_sector','professional_services']
  ),
  (
    'TZ-CYBER',
    'Cybercrimes Act (Tanzania)',
    'TZ',
    'cybersecurity',
    'Tanzania’s cybercrime statute covering unauthorised access, data interference and related computer offences.',
    array['financial_services','fintech','insurance','technology','saas','healthcare','telecommunications','retail','logistics','public_sector','professional_services','energy']
  ),
  (
    'RW-DPA',
    'Law Nº 058/2021 relating to the protection of personal data',
    'RW',
    'privacy',
    'Rwanda’s personal data protection law — lawful processing, security, retention and data subject rights.',
    array['financial_services','fintech','insurance','technology','saas','healthcare','telecommunications','retail','logistics','public_sector','professional_services']
  ),
  (
    'RW-CYBER',
    'Law on cyber security / critical information infrastructure (Rwanda)',
    'RW',
    'cybersecurity',
    'Rwanda’s cybersecurity and critical-information-infrastructure expectations, including incident handling.',
    array['financial_services','fintech','telecommunications','public_sector','energy']
  )
on conflict (code) do update
set
  name = excluded.name,
  jurisdiction = excluded.jurisdiction,
  category = excluded.category,
  summary = excluded.summary,
  industries = excluded.industries;
