/**
 * Curated Civic Form Field Explainer & Plain-Language Glossary (#142)
 *
 * Provides plain-language explanations for confusing administrative terms,
 * acronyms, form field labels, and legal jargon commonly encountered
 * in Indian public service applications.
 */

export const CIVIC_GLOSSARY = [
  {
    id: 'affidavit',
    term: 'Affidavit',
    abbreviations: ['AFF', 'Shapath Patra'],
    hiTerm: 'शपथ पत्र (Affidavit)',
    bnTerm: 'হলফনামा (Affidavit)',
    taTerm: 'பிரமாணப் பத்திரம் (Affidavit)',
    simpleMeaning: 'A signed written promise made in front of an authorized legal officer (like a notary or magistrate) affirming that the facts you stated are 100% true.',
    simpleMeaningHi: 'कानूनी अधिकारी (नोटरी) के सामने दिया गया एक लिखित वादा कि आपके द्वारा दिए गए तथ्य पूरी तरह सच हैं।',
    simpleMeaningBn: 'একজন আইনি কর্মকর্তার সামনে স্বাক্ষরিত লিখিত প্রতিশ্রুতি যে আপনার বক্তব্য সম্পূর্ণরূপে সত্য।',
    simpleMeaningTa: 'ஒரு சட்ட அதிகாரியின் முன்னிலையில் கையொப்பமிடப்பட்ட உறுதிமொழி.',
    context: 'Required when changing your name, correcting date of birth, or declaring annual family income without formal pay slips.',
    reviewedSource: {
      name: 'Department of Legal Affairs, Ministry of Law and Justice',
      url: 'https://legalaffairs.gov.in',
      reviewDate: '2026-01-15',
    },
    relatedServices: ['Birth Certificate', 'Income Certificate', 'Passport'],
  },
  {
    id: 'domicile',
    term: 'Domicile / Residence Certificate',
    abbreviations: ['PRC', 'Nivas Praman Patra'],
    hiTerm: 'मूल निवास प्रमाण पत्र (Domicile)',
    bnTerm: 'স্থায়ী বাসিন্দা সনদ (Domicile)',
    taTerm: 'இருப்பிடச் சான்றிதழ் (Domicile)',
    simpleMeaning: 'Official legal proof that you have lived in a specific state or territory continuously for a required number of years (usually 5 to 15 years).',
    simpleMeaningHi: 'इस बात का सरकारी प्रमाण कि आप किसी राज्य या केंद्र शासित प्रदेश में तय वर्षों से स्थायी रूप से रह रहे हैं।',
    simpleMeaningBn: 'সরকারি প্রমাণ যে আপনি নির্দিষ্ট রাজ্যে টানা নির্ধারিত বছর ধরে বসবাস করছেন।',
    simpleMeaningTa: 'நீங்கள் ஒரு குறிப்பிட்ட மாநிலத்தில் நீண்டகாலமாக வசிக்கிறீர்கள் என்பதற்கான அரசு சான்று.',
    context: 'Mandatory for state government university admissions, civil service quotas, and local farmer subsidy schemes.',
    reviewedSource: {
      name: 'National Government Services Portal - Domicile Framework',
      url: 'https://services.india.gov.in',
      reviewDate: '2026-02-10',
    },
    relatedServices: ['Domicile Certificate', 'Scholarship Portals'],
  },
  {
    id: 'encumbrance',
    term: 'Encumbrance Certificate (EC)',
    abbreviations: ['EC'],
    hiTerm: 'भारमुक्त प्रमाण पत्र (EC)',
    bnTerm: 'দায়মুক্ত সনদপত্র (EC)',
    taTerm: 'வில்லங்கச் சான்றிதழ் (EC)',
    simpleMeaning: 'A document verifying whether a piece of property or land has any unpaid mortgages, pending bank loans, legal disputes, or third-party claims.',
    simpleMeaningHi: 'यह प्रमाणित करने वाला दस्तावेज़ कि किसी ज़मीन या मकान पर कोई बैंक कर्ज़, गिरवी या कानूनी विवाद लंबित नहीं है।',
    simpleMeaningBn: 'জমির উপর কোনো ব্যাংক ঋণ বা আইনি বিরোধ নেই তা নিশ্চিত করার সনদপত্র।',
    simpleMeaningTa: 'ஒரு சொத்தின் மீது கடன் அல்லது சட்டரீதியான சிக்கல்கள் இல்லை என்பதை உறுதிப்படுத்தும் ஆவணம்.',
    context: 'Indispensable before buying any resale flat or agricultural land to avoid inheriting someone else\'s debt.',
    reviewedSource: {
      name: 'Department of Land Resources (DoLR)',
      url: 'https://dolr.gov.in',
      reviewDate: '2026-01-20',
    },
    relatedServices: ['Property Registration', 'Home Loan Verification'],
  },
  {
    id: 'gazette',
    term: 'Gazette Notification',
    abbreviations: ['Gazette', 'Rajpatra'],
    hiTerm: 'राजपत्र अधिसूचना (Gazette)',
    bnTerm: 'সরকারি গেজেট বিজ্ঞপ্তি',
    taTerm: 'அரசிதழ் அறிவிப்பு (Gazette)',
    simpleMeaning: 'The official public journal published by the government where legal name changes, state announcements, and statutory appointments are printed for public record.',
    simpleMeaningHi: 'सरकार की आधिकारिक पत्रिका जिसमें कानूनी रूप से नाम परिवर्तन और आधिकारिक आदेश दर्ज किए जाते हैं।',
    simpleMeaningBn: 'সরকারি মুখপাত্র পত্রিকা যেখানে আইনগত নাম পরিবর্তন ও সরকারি নোটিশ প্রকাশিত হয়।',
    simpleMeaningTa: 'பெயர் மாற்றம் மற்றும் சட்ட அறிவிப்புகளை வெளியிடும் அதிகாரப்பூர்வ அரசு இதழ்.',
    context: 'Needed if you change your first or last name after marriage or religion change for updating passports and bank accounts.',
    reviewedSource: {
      name: 'Department of Publication, Government of India (e-Gazette)',
      url: 'https://egazette.gov.in',
      reviewDate: '2026-01-10',
    },
    relatedServices: ['Name Change Gazette', 'Passport Correction'],
  },
  {
    id: 'mutation',
    term: 'Mutation of Property (Dakhil Kharij)',
    abbreviations: ['Mutation', 'Dakhil Kharij', 'Namantaran'],
    hiTerm: 'दाखिल खारिज / नामांतरण (Mutation)',
    bnTerm: 'নামজারি / খতিয়ান পরিবর্তন',
    taTerm: 'பட்டா மாறுதல் (Patta Transfer)',
    simpleMeaning: 'Transferring or updating the property title name in local municipal or revenue records so property tax is billed to the new rightful owner.',
    simpleMeaningHi: 'नगर निगम या राजस्व रिकॉर्ड में संपत्ति का स्वामित्व नए खरीदार के नाम पर दर्ज कराने की प्रक्रिया।',
    simpleMeaningBn: 'মিউনিসিপ্যালিটি বা রাজস্ব দপ্তরে সম্পত্তির মালিকানা নিজের নামে নথিভুক্ত করার प्रक्रिया।',
    simpleMeaningTa: 'வருவாய்த்துறை ஆவணங்களில் சொத்து உரிமையாளர் பெயரை மாற்றுதல்.',
    context: 'Must be completed right after property deed registration to obtain utility meters in your own name.',
    reviewedSource: {
      name: 'Digital India Land Records Modernization Programme (DILRMP)',
      url: 'https://dilrmp.gov.in',
      reviewDate: '2026-02-01',
    },
    relatedServices: ['Property Tax', 'Land Registry'],
  },
  {
    id: 'attestation',
    term: 'Attestation / Self-Attestation',
    abbreviations: ['Self-Attest', 'Swapramanit'],
    hiTerm: 'सत्यापन / स्वप्रमाणित (Self-Attestation)',
    bnTerm: 'স্ব-প্রত্যয়ন (Self-Attestation)',
    taTerm: 'சுய சான்றொப்பம் (Self-Attestation)',
    simpleMeaning: 'Signing your own name across a photocopy of a document with the date and words "Self-attested" to legally confirm that the photocopy is genuine.',
    simpleMeaningHi: 'दस्तावेज़ की फोटोकॉपी पर हस्ताक्षर करके यह प्रमाणित करना कि यह प्रति मूल दस्तावेज़ के अनुसार सच्ची है।',
    simpleMeaningBn: 'কাগজপত্রের ফটোকপিতে নিজের স্বাক্ষর করে মূল কপির সাথে মিল নিশ্চিত করা।',
    simpleMeaningTa: 'ஆவண நகலில் நீங்கள் கையொப்பமிட்டு அது உண்மையானது என உறுதிப்படுத்துதல்.',
    context: 'Most government departments now accept citizen self-attestation, replacing the old requirement of finding Gazetted Officers.',
    reviewedSource: {
      name: 'Ministry of Personnel, Public Grievances and Pensions (Self-Attestation Circular)',
      url: 'https://dopt.gov.in',
      reviewDate: '2026-01-05',
    },
    relatedServices: ['PAN Card', 'Aadhaar Card', 'Voter ID'],
  },
  {
    id: 'challan',
    term: 'Challan',
    abbreviations: ['TR-5', 'E-Challan'],
    hiTerm: 'चालान (Challan)',
    bnTerm: 'চালান (Challan)',
    taTerm: 'செலான் (Challan)',
    simpleMeaning: 'An official payment slip or deposit receipt used to deposit statutory government processing fees into designated state treasury bank accounts.',
    simpleMeaningHi: 'सरकारी खजाने में तय शुल्क जमा करने के लिए इस्तेमाल की जाने वाली आधिकारिक रसीद या रसीद फॉर्म।',
    simpleMeaningBn: 'সরকারি কোষাগারে নির্দিষ্ট ফি জমা দেওয়ার অফিসিয়াল রসিদ।',
    simpleMeaningTa: 'அரசு கட்டணங்களை வங்கியில் செலுத்துவதற்கான அதிகாரப்பூர்வ ரசீது.',
    context: 'Issued at RTO for driving test fees or treasury portal for court stamp fees.',
    reviewedSource: {
      name: 'Government e-Receipt System (Non-Tax Receipt Portal)',
      url: 'https://bharatkosh.gov.in',
      reviewDate: '2026-02-12',
    },
    relatedServices: ['Driving License', 'Court Fees'],
  },
  {
    id: 'patta',
    term: 'Patta / Khata Extract',
    abbreviations: ['Patta', 'Khata', 'Chitta'],
    hiTerm: 'पट्टा / खतौनी (Patta/Khata)',
    bnTerm: 'পর্চা / খতিয়ান (Patta/Khatian)',
    taTerm: 'பட்டா / சிட்டா (Patta/Chitta)',
    simpleMeaning: 'A revenue record issued by the Tahsildar / Taluk office confirming who legally possesses an agricultural or residential land parcel.',
    simpleMeaningHi: 'तहसीलदार द्वारा जारी वह राजस्व रिकॉर्ड जो यह साबित करता है कि ज़मीन का वास्तविक और कानूनी हकदार कौन है।',
    simpleMeaningBn: 'ভূমি রাজস্ব রেকর্ড যা নির্দিষ্ট জমির আইনি মালিকানা প্রমাণ করে।',
    simpleMeaningTa: 'நிலத்தின் சட்டப்பூர்வ உரிமையை உறுதிப்படுத்தும் வருவாய்த்துறை ஆவணம்.',
    context: 'Essential for crop insurance, building plan sanctions, and agricultural subsidies.',
    reviewedSource: {
      name: 'Land Revenue Administration Guidelines',
      url: 'https://services.india.gov.in',
      reviewDate: '2026-01-25',
    },
    relatedServices: ['PM-Kisan', 'Land Conversion'],
  },
  {
    id: 'noc',
    term: 'No Objection Certificate (NOC)',
    abbreviations: ['NOC', 'NoC'],
    hiTerm: 'अनापत्ति प्रमाण पत्र (NOC)',
    bnTerm: 'অনাপত্তি সনদ (NOC)',
    taTerm: 'தடை இல்லா சான்றிதழ் (NOC)',
    simpleMeaning: 'A formal letter issued by a department, bank, or employer stating they have no objections or pending liabilities regarding your planned transaction.',
    simpleMeaningHi: 'किसी बैंक या विभाग द्वारा जारी यह लिखित प्रमाण कि उन्हें आपके आवेदन या लेन-देन पर कोई आपत्ति नहीं है।',
    simpleMeaningBn: 'কোনো কর্তৃপক্ষ কর্তৃক প্রদত্ত চিঠি যা নিশ্চিত করে যে আবেদনকারীর বিরুদ্ধে কোনো আপত্তি নেই।',
    simpleMeaningTa: 'விண்ணப்பதாரர் மீது எவ்வித ஆட்சேபனையும் இல்லை என்பதற்கான சான்று.',
    context: 'Required for vehicle re-registration across states, building construction clearances, or leaving government employment.',
    reviewedSource: {
      name: 'Ministry of Road Transport & Highways - Vehicle NOC Guidelines',
      url: 'https://parivahan.gov.in',
      reviewDate: '2026-02-14',
    },
    relatedServices: ['Driving License', 'Vehicle Registration', 'Passport'],
  },
  {
    id: 'ews',
    term: 'Economically Weaker Section (EWS) Certificate',
    abbreviations: ['EWS', 'EWS Certificate'],
    hiTerm: 'आर्थिक रूप से कमजोर वर्ग प्रमाण पत्र (EWS)',
    bnTerm: 'অর্থনৈতিকভাবে দুর্বল বিভাগ সনদ',
    taTerm: 'பொருளாதாரத்தில் பின்தங்கிய பிரிவு சான்றிதழ் (EWS)',
    simpleMeaning: 'An income and asset certificate issued by an authorized revenue authority giving 10% reservation in government jobs and college admissions to eligible general category citizens.',
    simpleMeaningHi: 'सामान्य वर्ग के उन नागरिकों के लिए 10% आरक्षण का प्रमाण पत्र जिनकी पारिवारिक आय तय सरकारी सीमा से कम है।',
    simpleMeaningBn: 'নির্দিষ্ট আয়ের নিচে থাকা সাধারণ শ্রেণির নাগরিকদের জন্য সংরক্ষণ সনদ।',
    simpleMeaningTa: 'பொதுப் பிரிவினருக்கான 10% இடஒதுக்கீடு பெற உதவும் வருமானச் சான்று.',
    context: 'Must be issued in the current financial year based on aggregate gross household income under ₹8 Lakh per annum.',
    reviewedSource: {
      name: 'DoPT Reservation Division - Office Memorandum on EWS',
      url: 'https://dopt.gov.in',
      reviewDate: '2026-01-30',
    },
    relatedServices: ['Income Certificate', 'Scholarship Portals'],
  },
  {
    id: 'ifsc',
    term: 'Indian Financial System Code (IFSC)',
    abbreviations: ['IFSC', 'IFSC Code'],
    hiTerm: 'आईएफएससी कोड (IFSC)',
    bnTerm: 'আইএফএসসি কোড',
    taTerm: 'ஐ.எஃப்.எஸ்.சி குறியீடு (IFSC)',
    simpleMeaning: 'An 11-character alphanumeric code that uniquely identifies a specific bank branch for electronic money transfers like NEFT, RTGS, and IMPS.',
    simpleMeaningHi: '11 अक्षरों का विशिष्ट कोड जो बैंक शाखा की सटीक पहचान करता है ताकि सरकारी सब्सिडी सीधे आपके खाते में पहुंच सके।',
    simpleMeaningBn: '১১ অক্ষরের আলফানিউমেরিক কোড যা নির্দিষ্ট ব্যাংক শাখাকে শনাক্ত করে।',
    simpleMeaningTa: 'வங்கி கிளையை அடையாளம் காணும் 11 இலக்க தனித்துவக் குறியீடு.',
    context: 'Mandatory on Direct Benefit Transfer (DBT) forms for scholarship payouts, pension deposits, and cooking gas subsidies.',
    reviewedSource: {
      name: 'Reserve Bank of India (RBI) Payment Systems Directive',
      url: 'https://www.rbi.org.in',
      reviewDate: '2026-02-18',
    },
    relatedServices: ['Scholarship Portals', 'PM-Kisan', 'Pension'],
  },
  {
    id: 'micr',
    term: 'Magnetic Ink Character Recognition (MICR) Code',
    abbreviations: ['MICR', 'MICR Code'],
    hiTerm: 'एमआईसीआर कोड (MICR)',
    bnTerm: 'এমআইসিআর কোড',
    taTerm: 'எம்.ஐ.சி.ஆர் குறியீடு (MICR)',
    simpleMeaning: 'A 9-digit numerical code printed at the bottom of bank cheque leaves used by clearing houses to process and clear cheques faster.',
    simpleMeaningHi: 'चेक के नीचे छपा 9 अंकों का कोड जो चेक क्लियरिंग प्रक्रिया को सुरक्षित और तेज़ बनाता है।',
    simpleMeaningBn: 'চেক পাতার নিচে মুদ্রিত ৯ অঙ্কের সংখ্যা যা চেক দ্রুত ক্লিয়ারিংয়ে সহায়তা করে।',
    simpleMeaningTa: 'காசோலைகளின் அடிப்பகுதியில் அச்சிடப்படும் 9 இலக்க குறியீடு.',
    context: 'Frequently requested when submitting ECS mandates for utility bills or provident fund (EPFO) withdrawal claims.',
    reviewedSource: {
      name: 'Reserve Bank of India Cheque Truncation System (CTS)',
      url: 'https://www.rbi.org.in',
      reviewDate: '2026-01-20',
    },
    relatedServices: ['EPFO Services', 'Banking KYC'],
  },
  {
    id: 'annexure',
    term: 'Annexure / Appendix',
    abbreviations: ['Annexure', 'Appendix', 'Schedule'],
    hiTerm: 'अनुलग्नक (Annexure)',
    bnTerm: 'সংযোজনী (Annexure)',
    taTerm: 'இணைப்பு (Annexure)',
    simpleMeaning: 'A supplementary document, declaration format, or schedule attached to the main application form to provide additional verified details.',
    simpleMeaningHi: 'मुख्य आवेदन पत्र के साथ जोड़ा जाने वाला अतिरिक्त घोषणा पत्र या दस्तावेज़ का आधिकारिक प्रारूप।',
    simpleMeaningBn: 'মূল আবেদনপত্রের সাথে যুক্ত অতিরিক্ত প্রমাণপত্র বা ঘোষণা ফর্ম্যাট।',
    simpleMeaningTa: 'முக்கிய விண்ணப்பத்துடன் இணைக்கப்படும் கூடுதல் ஆவணம் அல்லது படிவம்.',
    context: 'Examples include Annexure-D (parent consent for minor passport) or Annexure-I (standard affidavit of identity).',
    reviewedSource: {
      name: 'Passport Seva - Standard Annexures Directory',
      url: 'https://www.passportindia.gov.in',
      reviewDate: '2026-02-05',
    },
    relatedServices: ['Passport', 'Driving License', 'Visa Facilitation'],
  },
  {
    id: 'sub_registrar',
    term: 'Sub-Registrar Office (SRO)',
    abbreviations: ['SRO', 'Sub-Registrar'],
    hiTerm: 'उप-पंजीयक कार्यालय (Sub-Registrar)',
    bnTerm: 'সাব-রেজিস্ট্রার অফিস',
    taTerm: 'சார்-பதிவாளர் அலுவலகம் (Sub-Registrar)',
    simpleMeaning: 'The municipal revenue office responsible for legally recording property sale deeds, lease agreements, and formal civil marriage registrations.',
    simpleMeaningHi: 'वह सरकारी कार्यालय जहां ज़मीन/मकान की रजिस्ट्री और कानूनी विवाह का आधिकारिक पंजीकरण होता है।',
    simpleMeaningBn: 'যে সরকারি দপ্তরে জমি-বাড়ির দলিল ও আইনি বিবাহ নিবন্ধিত হয়।',
    simpleMeaningTa: 'நிலப் பத்திரப்பதிவு மற்றும் திருமணப் பதிவு செய்யும் அரசு அலுவலகம்.',
    context: 'All property buyers and sellers must appear in person before the Sub-Registrar to execute biometric registration.',
    reviewedSource: {
      name: 'Registration and Stamps Department Guidelines',
      url: 'https://services.india.gov.in',
      reviewDate: '2026-01-12',
    },
    relatedServices: ['Property Registration', 'Marriage Registration'],
  },
  {
    id: 'poi_poa',
    term: 'Proof of Identity (POI) & Proof of Address (POA)',
    abbreviations: ['POI', 'POA', 'POR', 'DOB Proof'],
    hiTerm: 'पहचान व पते का प्रमाण (POI / POA)',
    bnTerm: 'পরিচয় ও ঠিকানার প্রমাণপত্র',
    taTerm: 'அடையாளம் மற்றும் முகவரி சான்று',
    simpleMeaning: 'The statutory supporting documents accepted by government agencies to establish who you are and where you permanently reside.',
    simpleMeaningHi: 'सरकारी विभागों द्वारा स्वीकार किए जाने वाले आधिकारिक पहचान और निवास प्रमाण पत्र।',
    simpleMeaningBn: 'আবেদনকারীর পরিচয় ও স্থায়ী ঠিকানা নিশ্চিতকারী সরকারি নথি।',
    simpleMeaningTa: 'உங்கள் அடையாளம் மற்றும் இருப்பிடத்தை நிரூபிக்கும் அரசு அங்கீகரித்த ஆவணங்கள்.',
    context: 'Every major civic service requires at least one valid POI (e.g. PAN, Voter ID) and one valid POA (e.g. Utility Bill, Passport).',
    reviewedSource: {
      name: 'UIDAI Master List of Acceptable Supporting Documents',
      url: 'https://uidai.gov.in',
      reviewDate: '2026-02-20',
    },
    relatedServices: ['Aadhaar Card', 'Passport', 'Driving License', 'Voter ID'],
  },
  {
    id: 'bpl',
    term: 'Below Poverty Line (BPL) / Antyodaya Ration Category',
    abbreviations: ['BPL', 'AAY', 'PHH'],
    hiTerm: 'बीपीएल / अंत्योदय श्रेणी (BPL)',
    bnTerm: 'দারিদ্র্যসীমার নিচে (BPL)',
    taTerm: 'வறுமைக் கோட்டிற்கு கீழ் (BPL)',
    simpleMeaning: 'An economic benchmark category identified by state civil supplies departments that grants maximum government fee exemptions and subsidized ration grains.',
    simpleMeaningHi: 'राज्य सरकार द्वारा चिन्हित वह वर्ग जिसे सभी सरकारी सेवाओं में 100% शुल्क छूट और मुफ्त राशन मिलता है।',
    simpleMeaningBn: 'সরকারি ফি ছাড় ও ভর্তুকিযুক্ত খাদ্যশস্য পাওয়ার জন্য নির্ধারিত অর্থনৈতিক শ্রেণি।',
    simpleMeaningTa: 'அரசு கட்டண விலக்கு மற்றும் மானிய உணவுப்பொருட்கள் பெற தகுதியான பொருளாதார பிரிவு.',
    context: 'BPL cardholders are exempt from paying fees for RTI applications, court fees, and municipal certificates.',
    reviewedSource: {
      name: 'Department of Food and Public Distribution - NFSA Portal',
      url: 'https://nfsa.gov.in',
      reviewDate: '2026-01-18',
    },
    relatedServices: ['Ration Card', 'Income Certificate', 'Ayushman Bharat'],
  },
];

/**
 * Finds all jargon terms appearing within arbitrary text.
 * @param {string} text
 * @returns {Array} Matching glossary items
 */
export const findJargonTerms = (text = '') => {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  return CIVIC_GLOSSARY.filter((item) => {
    if (lower.includes(item.term.toLowerCase()) || lower.includes(item.id.toLowerCase())) return true;
    if (Array.isArray(item.abbreviations)) {
      return item.abbreviations.some((abbr) => {
        const regex = new RegExp(`\\b${abbr}\\b`, 'i');
        return regex.test(text);
      });
    }
    return false;
  });
};

/**
 * Searches the glossary by term name, abbreviation, simple definition, or context.
 *
 * @param {string} query
 * @returns {Array} Matching glossary items
 */
export const searchGlossary = (query = '') => {
  if (!query || typeof query !== 'string' || !query.trim()) return CIVIC_GLOSSARY;
  const q = query.toLowerCase().trim();

  return CIVIC_GLOSSARY.filter((item) => {
    // 1. Exact or partial term match
    if (item.term.toLowerCase().includes(q)) return true;
    if (item.id.toLowerCase().includes(q)) return true;

    // 2. Abbreviation matches
    if (Array.isArray(item.abbreviations)) {
      if (item.abbreviations.some((abbr) => abbr.toLowerCase() === q || abbr.toLowerCase().includes(q))) {
        return true;
      }
    }

    // 3. Definition or context match
    if (item.simpleMeaning && item.simpleMeaning.toLowerCase().includes(q)) return true;
    if (item.context && item.context.toLowerCase().includes(q)) return true;

    // 4. Multilingual match
    if (item.hiTerm && item.hiTerm.toLowerCase().includes(q)) return true;
    if (item.bnTerm && item.bnTerm.toLowerCase().includes(q)) return true;
    if (item.taTerm && item.taTerm.toLowerCase().includes(q)) return true;

    return false;
  });
};
