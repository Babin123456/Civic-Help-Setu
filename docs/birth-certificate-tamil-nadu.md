# Birth Certificate — Tamil Nadu Research Notes

**Prepared:** 5 November 2026  
**Related issue:** [#501 — Add a Birth Certificate issuance guide](https://github.com/GoldRay19/Civic-Help-Setu/issues/501)  
**Scope:** Tamil Nadu-specific research and citizen-facing content.  
**Status:** Research notes supporting the service-page implementation in PR #535; maintainer review is required before publication.

## 1. Citizen-facing summary

A birth certificate is an official extract of a birth entry in the civil registration system. Births must be registered with the Registrar responsible for the area where the birth occurred. The normal reporting period is 21 days from the date of occurrence. Registration jurisdiction is based on the place of occurrence, not simply the family's current residential address.

## 2. Who reports the birth

- **Institutional birth (hospital, health centre, maternity home, nursing home or similar institution):** the institution is responsible for informing the Registrar under the civil-registration process.
- **Home birth:** the citizen/informant should report the event to the Registrar for the place where it occurred within 21 days.
- **Jurisdiction:** each local area has an appointed Registrar. Applicants should confirm the correct office with the relevant local body/Registrar; do not rely on an old office-title list from a legacy FAQ.

## 3. Normal reporting period and delayed registration

The normal reporting period is 21 days from the date of occurrence. The Directorate of Town Panchayats, Tamil Nadu, currently publishes this delayed-registration summary:

| Delay from date of birth | Published procedure / authority | Published late fee |
| --- | --- | ---: |
| Within 21 days | Normal registration | Free |
| More than 21 days and up to 30 days | Delayed registration under the prescribed rules | ₹100 |
| More than 30 days and up to 1 year | Permission / documents from the competent authority under the prescribed rules | ₹200 |
| More than 1 year and up to 2 years | Order of the District Magistrate, Sub-Divisional Magistrate, or an Executive Magistrate authorised by the District Magistrate, under section 13(3) as amended in 2026 | ₹500* |
| More than 2 years | Order of a Judicial Magistrate of the First Class, under section 13(3A) as amended in 2026 | ₹500* |

* The Directorate says the ₹500 figure is based on the Tamil Nadu rules and advises applicants to follow current government instructions and confirm the payable fee with the competent authority. The required permission/order and supporting evidence also matter; payment alone does not complete registration.

**Legal update:** the Registration of Births and Deaths (Amendment) Act, 2026 came into force on **1 October 2026**, according to the Tamil Nadu Directorate of Town Panchayats. For delayed information after one year but within two years, section 13(3) names the District Magistrate, Sub-Divisional Magistrate or an authorised Executive Magistrate. For information after two years, section 13(3A) requires an order of a Judicial Magistrate of the First Class.

Do not repeat legacy CRSTN FAQ text that directs every case after one year to an RDO without checking the current Act and Tamil Nadu Rules, 2025.

## 4. Documents and evidence

The current official public pages reviewed do not establish one universal document checklist for every birth scenario and jurisdiction. The guide should therefore avoid presenting a fixed statewide checklist as mandatory.

- For an institutional birth, keep the hospital/institution birth record or discharge summary and any reference/acknowledgement supplied by the institution.
- Keep the mother's RCH/PICME reference available where applicable. The CRSTN FAQ mentions the mother's RCH ID, but legacy FAQ material must be checked against current instructions before calling it mandatory in every case.
- For a home birth or delayed registration, ask the jurisdictional Registrar for the current evidence and declaration/document list. Requirements can depend on the circumstances and applicable rules.
- Never publish or collect Aadhaar numbers, RCH IDs, OTPs, identity-document scans or other personal identifiers in a public guide.

## 5. Suggested application journey

1. **Identify the place of occurrence.** Registration jurisdiction is based on where the birth happened.
2. **Check who must report it.** For an institutional birth, the institution informs the Registrar. For a home birth, the informant should contact the Registrar within the normal 21-day period.
3. **Contact the jurisdictional Registrar if the event is not registered.** Ask for the current form, supporting evidence and any delay-specific permission/order. Do not rely on old FAQ material for a delayed case.
4. **Check whether the entry is available online.** Tamil Nadu's CRSTN portal states that certificates for events registered from 1 January 2018 onward can be downloaded online.
5. **Search and download.** The current CRSTN birth-search page exposes search by RCH ID or by gender, district, place of birth and date of birth, with mobile verification. The portal controls the actual current fields and verification steps.
6. **For an event registered before 1 January 2018,** contact the relevant local body/registration office; the CRSTN portal directs applicants to local bodies for older records.
7. **For corrections or a missing entry,** contact the Registrar for the place of occurrence and follow the current correction/non-availability procedure. Do not create a duplicate registration for an event that may already be recorded.

## 6. Child's name

The Directorate of Town Panchayats page states that when a birth was registered without the child's name, the name may be added under the prescribed procedure:
- Within 12 months from registration without a late fee.
- After 12 months but within 15 years, with a published late fee of ₹200.

Applicants should confirm the current form and supporting evidence with the Registrar.

## 7. Fees: keep service categories distinct

Do not display one generic "birth certificate fee" in the UI.

- **Late-registration fee:** depends on how late the birth is reported and on the required permission/order.
- **CRSTN online certificate download:** the CRSTN portal says events registered from 1 January 2018 onward can be downloaded online free of cost.
- **Record search / certificate copy / non-availability services:** the Directorate page separately lists fees for record searches, certificate copies and non-availability certificates. The UI should distinguish these services and direct applicants to confirm the exact fee with the relevant office.

## 8. Official sources reviewed

1. **Directorate of Town Panchayats, Tamil Nadu — Birth and Death Registration Details:** <https://townpanchayat.in/birth_death.php>  
   Current public guidance reviewed on 4 November 2026. It identifies the Tamil Nadu Rules, 2025 and the 2026 central amendment effective 1 October 2026; publishes delayed-registration fee/authority information, child-name timelines, CRSTN links and caveats.
2. **Tamil Nadu Civil Registration System (CRSTN):** <https://www.crstn.org/birth_death_tn/crs>  
   States that institutions report institutional births, citizens report home births within 21 days, local Registrars cover their jurisdictions, and records registered from 1 January 2018 onward can be downloaded online; older records should be obtained from the relevant local body.
3. **CRSTN Birth Certificate Search:** <https://www.crstn.org/birth_death_tn/BCert>  
   Shows the current public search fields and mobile verification.
4. **Office of the Registrar General & Census Commissioner, India — Civil Registration System:** <https://censusindia.mha.gov.in/census.website/en/node/180>  
   National overview of mandatory registration, place-of-occurrence registration and Registrar roles.
5. **Tamil Nadu Government Gazette archive (2025):** <https://www.stationeryprinting.tn.gov.in/extra_ordinary_lists.php?id=MjAyNQ%3D%3D>  
   Archive listing for issue 417 dated 31 July 2025, titled "The Tamil Nadu Registration of Births and Deaths Rules, 2025", SRO A-20(a)/2025, G.O. Ms. No. 351, Health and Family Welfare Department.
6. **ORGI Digital Library — Registration of Births and Deaths (Amendment) Act, 2026:** <https://censusindia.mha.gov.in/nada/index.php/catalog/47182>  
   Official ORGI catalogue record for the 2026 Amendment Act.

## 9. Source-quality warning

Some legacy CRSTN FAQ material still refers to the Tamil Nadu Rules, 2000 and older delayed-registration authority instructions. The Tamil Nadu Government Gazette archive lists the Tamil Nadu Rules, 2025, and the Directorate's current page summarises the 2026 central amendment. The guide must prioritise current rules and official guidance rather than copy obsolete delay instructions from a legacy FAQ/PDF.

## 10. Maintainer review items before publication

- Confirm the final wording and fee treatment for late cases directly against the signed Tamil Nadu Rules, 2025 and any post-1 October 2026 implementation circulars.
- Confirm the current document list for institutional and home births with the competent local Registrar; the public pages reviewed do not establish one universal checklist.
- Confirm local Registrar mapping for each local-body type; avoid listing officers from legacy FAQs without current source verification.
- Explain the distinction between free CRSTN online downloads and separately charged record searches/certified copies.
- Add state/district-specific contact details only when sourced from the relevant official local-body portal.

---

**Last verified:** 4 November 2026. Re-check official laws, rules, fees, links and instructions before publication because civil-registration procedures can change.
