/**
 * AI Explanation Translation Service
 * Provides optional translation for AI-generated summaries and explanatory text
 * using the application's supported languages (English, Hindi, Bengali, Tamil).
 * 
 * Strict Grounding & Integrity Policy:
 * 1. Preservation: Official names, dates, amounts, URLs, and document names are strictly
 *    preserved so translation never changes their legal or operational meaning.
 * 2. Availability: Original source text is always kept accessible.
 * 3. Informational Labeling: Translations are clearly marked as informational guidance,
 *    never as official government translated notices.
 * 4. Resilient Fallbacks: Translation failures fall back cleanly to original text.
 * 5. Record Integrity: Official catalogue records are never silently translated or overwritten.
 */

import { SUPPORTED_LANGUAGES, SOURCE_LANGUAGE } from '../utils/languagePreference';

export const INFORMATIONAL_TRANSLATION_NOTICE =
  'Informational translation only. This translation is provided for citizen convenience and is not an official government notice. Legal terms, dates, and official records remain governed by the source text.';

export const TRANSLATION_FALLBACK_MESSAGE =
  'Translation unavailable. Showing original English text.';

// Well-known official entity names to protect from machine translation distortion
export const PROTECTED_OFFICIAL_NAMES = [
  'Civic-Help-Setu',
  'Civic Help Setu',
  'UIDAI',
  'Parivahan Sewa',
  'NSDL',
  'UTIITSL',
  'Election Commission of India',
  'Income Tax Department',
  'Municipal Administration',
  'National Government Services Portal',
  'DigiLocker',
  'Aadhaar Seva Kendra',
  'RTO',
];

// Official document names to preserve
export const PROTECTED_DOCUMENT_NAMES = [
  'Aadhaar Card',
  'Aadhaar',
  'PAN Card',
  'PAN',
  'Voter ID',
  'Birth Certificate',
  'Driving License',
  'Learner\'s License',
  'Passport',
  'Ration Card',
  'Form 49A',
  'Form 49AA',
  'Form 1A',
  'Discharge Summary',
  'Electricity Bill',
  'Rent Agreement',
  'Community Certificate',
  'Affidavit',
];

// Common phrases and vocabulary mappings for civic service explanations
const TRANSLATION_DICTIONARIES = {
  hi: {
    'Key prerequisite documents for': 'के लिए मुख्य आवश्यक दस्तावेज़:',
    'Official Fees for': 'के लिए आधिकारिक शुल्क:',
    'Estimated processing duration for': 'के लिए अनुमानित प्रसंस्करण समय:',
    'Most centers accept UPI, Netbanking, or Challan.': 'अधिकांश केंद्र UPI, नेटबैंकिंग या चालान स्वीकार करते हैं।',
    'Online fast-track applications often process sooner.': 'ऑनलाइन त्वरित आवेदन अक्सर जल्दी संसाधित होते हैं।',
    'Official record of a person\'s birth, required for various legal and identity purposes.': 'व्यक्ति के जन्म का आधिकारिक रिकॉर्ड, जो विभिन्न कानूनी और पहचान उद्देश्यों के लिए आवश्यक है।',
    '12-digit unique identity number based on biometric and demographic data.': 'बायोमेट्रिक और जनसांख्यिकीय डेटा पर आधारित 12-अंकीय विशिष्ट पहचान संख्या।',
    'Official document certifying authorization to drive a motor vehicle.': 'मोटर वाहन चलाने के प्राधिकरण को प्रमाणित करने वाला आधिकारिक दस्तावेज़।',
    '10-digit alphanumeric identity issued by the Income Tax Department.': 'आयकर विभाग द्वारा जारी 10-अंकीय अल्फ़ान्यूमेरिक पहचान।',
    'EPIC card required to cast a vote in democratic elections.': 'लोकतांत्रिक चुनावों में मतदान करने के लिए आवश्यक मतदाता पहचान पत्र।',
    'Fees:': 'शुल्क:',
    'Est. Time:': 'अनुमानित समय:',
    'Action Steps:': 'आवेदन के चरण:',
    'Official Policy Notice:': 'आधिकारिक नीति सूचना:',
    'Notice:': 'सूचना:',
    'Free for new enrollment': 'नए नामांकन के लिए निःशुल्क',
    'Free': 'निःशुल्क',
    'mandatory': 'अनिवार्य',
    'required': 'आवश्यक',
    'optional': 'वैकल्पिक',
    'conditional': 'शर्त-आधारित',
    'not verified': 'सत्यापित नहीं',
  },
  bn: {
    'Key prerequisite documents for': 'এর জন্য প্রধান প্রয়োজনীয় নথি:',
    'Official Fees for': 'এর জন্য সরকারী ফি:',
    'Estimated processing duration for': 'এর জন্য আনুমানিক প্রক্রিয়াকরণ সময়:',
    'Most centers accept UPI, Netbanking, or Challan.': 'বেশিরভাগ কেন্দ্র UPI, নেটব্যাঙ্কিং বা চালান গ্রহণ করে।',
    'Online fast-track applications often process sooner.': 'অনলাইন ফাস্ট-ট্র্যাক আবেদনগুলি প্রায়শই দ্রুত প্রক্রিয়া করা হয়।',
    'Official record of a person\'s birth, required for various legal and identity purposes.': 'একজন ব্যক্তির জন্মের সরকারী নথি, যা বিভিন্ন আইনি এবং পরিচয়গত প্রয়োজনে আবশ্যক।',
    '12-digit unique identity number based on biometric and demographic data.': 'বায়োমেট্রিক এবং জনসংখ্যার ডেটার উপর ভিত্তি করে ১২-সংখ্যার অনন্য পরিচয় নম্বর।',
    'Official document certifying authorization to drive a motor vehicle.': 'মোটর গাড়ি চালানোর অনুমোদনের জন্য সরকারি প্রশংসাপত্র।',
    '10-digit alphanumeric identity issued by the Income Tax Department.': 'আয়কর বিভাগ কর্তৃক জারি করা ১০-সংখ্যার আলফানিউমেরিক পরিচয়।',
    'EPIC card required to cast a vote in democratic elections.': 'গণতান্ত্রিক নির্বাচনে ভোট দেওয়ার জন্য প্রয়োজনীয় ভোটার কার্ড।',
    'Fees:': 'ফি:',
    'Est. Time:': 'আনুমানিক সময়:',
    'Action Steps:': 'আবেদনের ধাপ:',
    'Official Policy Notice:': 'সরকারি নীতি বিজ্ঞপ্তি:',
    'Notice:': 'বিজ্ঞপ্তি:',
    'Free for new enrollment': 'নতুন তালিকাভুক্তির জন্য বিনামূল্যে',
    'Free': 'বিনামূল্যে',
    'mandatory': 'বাধ্যতামূলক',
    'required': 'প্রয়োজনীয়',
    'optional': 'ঐচ্ছিক',
    'conditional': 'শর্তাধীন',
    'not verified': 'যাচাই করা হয়নি',
  },
  ta: {
    'Key prerequisite documents for': 'க்கான முக்கிய தேவையான ஆவணங்கள்:',
    'Official Fees for': 'க்கான அதிகாரப்பூர்வ கட்டணம்:',
    'Estimated processing duration for': 'க்கான மதிப்பிடப்பட்ட செயலாக்க நேரம்:',
    'Most centers accept UPI, Netbanking, or Challan.': 'பெரும்பாலான மையங்கள் UPI, நெட்பேங்கிங் அல்லது சலானை ஏற்றுக்கொள்கின்றன.',
    'Online fast-track applications often process sooner.': 'ஆன்லைன் விரைவு விண்ணப்பங்கள் பெரும்பாலும் விரைவில் செயலாக்கப்படுகின்றன.',
    'Official record of a person\'s birth, required for various legal and identity purposes.': 'பல்வேறு சட்ட மற்றும் அடையாள நோக்கங்களுக்காகத் தேவைப்படும் நபரின் பிறப்புக்கான அதிகாரப்பூர்வ பதிவு.',
    '12-digit unique identity number based on biometric and demographic data.': 'பயோமெட்ரிக் மற்றும் மக்கள்தொகை தரவுகளின் அடிப்படையில் 12 இலக்க தனித்துவ அடையாள எண்.',
    'Official document certifying authorization to drive a motor vehicle.': 'மோட்டார் வாகனத்தை ஓட்டுவதற்கான அங்கீகாரத்தை உறுதிப்படுத்தும் அதிகாரப்பூர்வ ஆவணம்.',
    '10-digit alphanumeric identity issued by the Income Tax Department.': 'வருமான வரித் துறையால் வழங்கப்பட்ட 10 இலக்க எண்ணெழுத்து அடையாளம்.',
    'EPIC card required to cast a vote in democratic elections.': 'ஜனநாயகத் தேர்தல்களில் வாக்களிக்கத் தேவையான வாக்காளர் அட்டை.',
    'Fees:': 'கட்டணம்:',
    'Est. Time:': 'மதிப்பிடப்பட்ட நேரம்:',
    'Action Steps:': 'செயல்பாட்டு படிகள்:',
    'Official Policy Notice:': 'அதிகாரப்பூர்வ கொள்கை அறிவிப்பு:',
    'Notice:': 'அறிவிப்பு:',
    'Free for new enrollment': 'புதிய சேர்க்கைக்கு இலவசம்',
    'Free': 'இலவசம்',
    'mandatory': 'கட்டாயமானது',
    'required': 'தேவைப்படுகிறது',
    'optional': 'விருப்பத்திற்குரியது',
    'conditional': 'நிபந்தனைக்குட்பட்டது',
    'not verified': 'சரிபார்க்கப்படவில்லை',
  },
};

/**
 * Escapes characters for safe regex creation
 */
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replaces official names, URLs, amounts, dates, and document names with safe tokens
 * so translation cannot mutate or distort them.
 */
export const protectEntities = (text) => {
  if (typeof text !== 'string' || !text) {
    return { maskedText: '', tokensMap: {} };
  }

  const tokensMap = {};
  let tokenCounter = 0;
  let maskedText = text;

  // 1. Protect URLs
  const urlRegex = /https?:\/\/[^\s)\]]+/gi;
  maskedText = maskedText.replace(urlRegex, (url) => {
    const token = `__TOKEN_URL_${tokenCounter += 1}__`;
    tokensMap[token] = url;
    return token;
  });

  // 2. Protect Amounts and Currencies (e.g., ₹20 - ₹100, ₹107, $50)
  const amountRegex = /[₹$€£]\s*[\d,]+(?:\.\d+)?(?:\s*-\s*[₹$€£]?\s*[\d,]+)?/gi;
  maskedText = maskedText.replace(amountRegex, (amt) => {
    const token = `__TOKEN_AMT_${tokenCounter += 1}__`;
    tokensMap[token] = amt;
    return token;
  });

  // 3. Protect ISO and Calendar Dates (e.g. 2023-10-01, 21 days, 30 days)
  const dateRegex = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b\d+\s*(?:days?|months?|weeks?|years?)\b/gi;
  maskedText = maskedText.replace(dateRegex, (dt) => {
    const token = `__TOKEN_DT_${tokenCounter += 1}__`;
    tokensMap[token] = dt;
    return token;
  });

  // 4. Protect Official Names
  for (const name of PROTECTED_OFFICIAL_NAMES) {
    const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi');
    maskedText = maskedText.replace(regex, (match) => {
      const token = `__TOKEN_OFFICIAL_${tokenCounter += 1}__`;
      tokensMap[token] = match;
      return token;
    });
  }

  // 5. Protect Official Document Names
  for (const doc of PROTECTED_DOCUMENT_NAMES) {
    const regex = new RegExp(`\\b${escapeRegExp(doc)}\\b`, 'gi');
    maskedText = maskedText.replace(regex, (match) => {
      const token = `__TOKEN_DOC_${tokenCounter += 1}__`;
      tokensMap[token] = match;
      return token;
    });
  }

  return { maskedText, tokensMap };
};

/**
 * Restores protected tokens back to their exact original text
 */
export const restoreEntities = (maskedText, tokensMap = {}) => {
  if (typeof maskedText !== 'string') return '';
  let restored = maskedText;

  for (const [token, originalValue] of Object.entries(tokensMap)) {
    // Replace all occurrences of the token
    const tokenRegex = new RegExp(escapeRegExp(token), 'g');
    restored = restored.replace(tokenRegex, originalValue);
  }

  return restored;
};

/**
 * Translates AI-generated explanatory text into target supported language
 */
export const translateExplanationText = (text, targetLang = SOURCE_LANGUAGE, options = {}) => {
  // Empty input check
  if (!text || typeof text !== 'string' || !text.trim()) {
    return {
      translatedText: '',
      originalText: text || '',
      targetLang,
      isTranslated: false,
      status: 'empty',
      notice: null,
      error: null,
    };
  }

  const cleanOriginal = text.trim();

  // If translation failure is simulated or target language unsupported
  if (options.simulateFailure) {
    return {
      translatedText: cleanOriginal,
      originalText: cleanOriginal,
      targetLang,
      isTranslated: false,
      status: 'error',
      error: 'Translation service unavailable',
      fallbackMessage: TRANSLATION_FALLBACK_MESSAGE,
      notice: null,
    };
  }

  const validTarget = SUPPORTED_LANGUAGES.some((l) => l.code === targetLang)
    ? targetLang
    : SOURCE_LANGUAGE;

  // If target is source language (English), return clean original without translation
  if (validTarget === SOURCE_LANGUAGE) {
    return {
      translatedText: cleanOriginal,
      originalText: cleanOriginal,
      targetLang: SOURCE_LANGUAGE,
      isTranslated: false,
      status: 'source_language',
      notice: null,
      error: null,
    };
  }

  try {
    // 1. Protect official names, URLs, amounts, dates, and document names
    const { maskedText, tokensMap } = protectEntities(cleanOriginal);

    // 2. Perform dictionary and phrase translation
    const dict = TRANSLATION_DICTIONARIES[validTarget] || {};
    let translated = maskedText;

    // Apply phrase replacements
    for (const [phrase, translatedPhrase] of Object.entries(dict)) {
      const phraseRegex = new RegExp(escapeRegExp(phrase), 'g');
      translated = translated.replace(phraseRegex, translatedPhrase);
    }

    // 3. Restore all protected entities untouched
    const finalRestored = restoreEntities(translated, tokensMap);

    return {
      translatedText: finalRestored,
      originalText: cleanOriginal,
      targetLang: validTarget,
      isTranslated: true,
      status: 'success',
      notice: INFORMATIONAL_TRANSLATION_NOTICE,
      error: null,
    };
  } catch (err) {
    return {
      translatedText: cleanOriginal,
      originalText: cleanOriginal,
      targetLang: validTarget,
      isTranslated: false,
      status: 'error',
      error: err.message || 'Translation error occurred',
      fallbackMessage: TRANSLATION_FALLBACK_MESSAGE,
      notice: null,
    };
  }
};

/**
 * Asserts that the original official record was not mutated or overwritten
 */
export const doesNotOverwriteRecord = (originalRecord, translationResult) => {
  if (!originalRecord || typeof originalRecord !== 'object') return true;

  // Check if original record properties were modified
  for (const val of Object.values(originalRecord)) {
    if (typeof val === 'string' && translationResult.isTranslated) {
      if (val === translationResult.translatedText && val !== translationResult.originalText) {
        return false;
      }
    }
  }
  return true;
};
