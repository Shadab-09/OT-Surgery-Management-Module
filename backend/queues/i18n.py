"""Multilingual support for queue management — 22 Indian languages + English.

The display board, kiosk, and notification surfaces all consume strings from
here. Each supported language provides:

  • ``labels``   — static UI strings (status, priority, channel labels)
  • ``templates`` — parametrised announcement / notification phrases

The :func:`translate` and :func:`announce` helpers never raise; unknown locales
silently fall back to English so a malformed ``Accept-Language`` header can
never break token issuance.
"""
from __future__ import annotations

from typing import Any

DEFAULT_LANGUAGE = "en"

# ISO 639-1 (or 639-3 where applicable) codes for the 22 Eighth-Schedule
# languages plus English. ``name`` is the autonym, ``english_name`` is its
# label in English.
LANGUAGES: dict[str, dict[str, str]] = {
    "en": {"name": "English", "english_name": "English", "script": "Latin"},
    "hi": {"name": "हिन्दी", "english_name": "Hindi", "script": "Devanagari"},
    "bn": {"name": "বাংলা", "english_name": "Bengali", "script": "Bengali"},
    "te": {"name": "తెలుగు", "english_name": "Telugu", "script": "Telugu"},
    "mr": {"name": "मराठी", "english_name": "Marathi", "script": "Devanagari"},
    "ta": {"name": "தமிழ்", "english_name": "Tamil", "script": "Tamil"},
    "ur": {"name": "اُردُو", "english_name": "Urdu", "script": "Perso-Arabic"},
    "gu": {"name": "ગુજરાતી", "english_name": "Gujarati", "script": "Gujarati"},
    "kn": {"name": "ಕನ್ನಡ", "english_name": "Kannada", "script": "Kannada"},
    "ml": {"name": "മലയാളം", "english_name": "Malayalam", "script": "Malayalam"},
    "or": {"name": "ଓଡ଼ିଆ", "english_name": "Odia", "script": "Odia"},
    "pa": {"name": "ਪੰਜਾਬੀ", "english_name": "Punjabi", "script": "Gurmukhi"},
    "as": {"name": "অসমীয়া", "english_name": "Assamese", "script": "Bengali"},
    "sa": {"name": "संस्कृतम्", "english_name": "Sanskrit", "script": "Devanagari"},
    "ne": {"name": "नेपाली", "english_name": "Nepali", "script": "Devanagari"},
    "ks": {"name": "कॉशुर", "english_name": "Kashmiri", "script": "Devanagari"},
    "sd": {"name": "سنڌي", "english_name": "Sindhi", "script": "Perso-Arabic"},
    "kok": {"name": "कोंकणी", "english_name": "Konkani", "script": "Devanagari"},
    "mai": {"name": "मैथिली", "english_name": "Maithili", "script": "Devanagari"},
    "mni": {"name": "মৈতৈলোন্", "english_name": "Manipuri", "script": "Bengali"},
    "sat": {"name": "ᱥᱟᱱᱛᱟᱲᱤ", "english_name": "Santali", "script": "Ol Chiki"},
    "brx": {"name": "बड़ो", "english_name": "Bodo", "script": "Devanagari"},
    "doi": {"name": "डोगरी", "english_name": "Dogri", "script": "Devanagari"},
}

# Canonical label keys used across the queue app. Keeping them here lets us
# statically verify coverage per language.
LABEL_KEYS = {
    # status
    "status.waiting", "status.called", "status.in_service", "status.completed",
    "status.skipped", "status.no_show", "status.cancelled",
    # priority
    "priority.normal", "priority.elderly", "priority.disabled", "priority.emergency",
    # channel
    "channel.kiosk", "channel.counter", "channel.web", "channel.app",
    # UI
    "ui.token_number", "ui.now_serving", "ui.waiting_count", "ui.counter",
    "ui.please_wait", "ui.your_turn", "ui.department", "ui.service",
    "ui.estimated_wait", "ui.priority_queue",
    # Kiosk flow (patient-facing)
    "ui.full_name", "ui.phone", "ui.mrn", "ui.generate_token",
    "ui.issue_another", "ui.token_generated", "ui.fill_details",
    "ui.up_next", "ui.queue_empty", "ui.total_waiting",
}

# Announcement/notification templates. Placeholders: {token}, {counter},
# {department}, {minutes}.
TEMPLATE_KEYS = {
    "announce.call",        # "Token {token}, please proceed to counter {counter}."
    "announce.recall",      # "Final call for token {token} at counter {counter}."
    "announce.skipped",     # "Token {token} has been skipped."
    "announce.ready_soon",  # "Token {token}, your turn is in about {minutes} minutes."
    "notify.issued",        # confirmation on issuance
    "notify.completed",     # confirmation on completion
}


def _t(en: str, **rest: str) -> dict[str, str]:
    """Build a {lang: translation} dict, defaulting missing entries to English."""
    out = {"en": en}
    out.update(rest)
    return out


# ── Translations ────────────────────────────────────────────────────
# Each label is a dict keyed by language code. Languages not listed explicitly
# fall back to English at resolve-time.

LABELS: dict[str, dict[str, str]] = {
    "status.waiting": _t(
        "Waiting",
        hi="प्रतीक्षा में", bn="অপেক্ষমাণ", te="వేచి ఉంది", mr="प्रतीक्षेत",
        ta="காத்திருக்கிறது", ur="انتظار میں", gu="રાહ જોઈ રહ્યું છે",
        kn="ಕಾಯುತ್ತಿದೆ", ml="കാത്തിരിക്കുന്നു", or_="ଅପେକ୍ଷାରତ",
        pa="ਉਡੀਕ ਵਿੱਚ", as_="অপেক্ষাৰত", sa="प्रतीक्षायाम्", ne="पर्खाइमा",
    ),
    "status.called": _t(
        "Called",
        hi="बुलाया गया", bn="ডাকা হয়েছে", te="పిలిచారు", mr="बोलावले",
        ta="அழைக்கப்பட்டது", ur="بلایا گیا", gu="બોલાવાયું",
        kn="ಕರೆಯಲಾಗಿದೆ", ml="വിളിച്ചു", or_="ଡାକାଯାଇଛି",
        pa="ਬੁਲਾਇਆ ਗਿਆ", as_="মতা হৈছে", sa="आहूतः", ne="बोलाइयो",
    ),
    "status.in_service": _t(
        "In Service",
        hi="सेवा में", bn="সেবায়", te="సేవలో", mr="सेवेत सुरू",
        ta="சேவையில்", ur="خدمت میں", gu="સેવામાં",
        kn="ಸೇವೆಯಲ್ಲಿ", ml="സേവനത്തിൽ", or_="ସେବାରେ",
        pa="ਸੇਵਾ ਵਿੱਚ", as_="সেৱাত", sa="सेवायाम्", ne="सेवामा",
    ),
    "status.completed": _t(
        "Completed",
        hi="पूर्ण हुआ", bn="সম্পূর্ণ", te="పూర్తయింది", mr="पूर्ण",
        ta="முடிந்தது", ur="مکمل", gu="પૂર્ણ",
        kn="ಪೂರ್ಣಗೊಂಡಿದೆ", ml="പൂർത്തിയായി", or_="ସମ୍ପୂର୍ଣ୍ଣ",
        pa="ਪੂਰਾ ਹੋਇਆ", as_="সম্পূৰ্ণ", sa="समाप्तम्", ne="पूरा भयो",
    ),
    "status.skipped": _t(
        "Skipped",
        hi="छूट गया", bn="এড়িয়ে যাওয়া", te="తప్పించబడింది", mr="वगळले",
        ta="தவிர்க்கப்பட்டது", ur="نظرانداز", gu="છોડી દેવાયું",
        kn="ಬಿಟ್ಟುಬಿಡಲಾಗಿದೆ", ml="ഒഴിവാക്കി", or_="ଛାଡ଼ିଦିଆଯାଇଛି",
        pa="ਛੱਡ ਦਿੱਤਾ", as_="এৰি দিয়া হৈছে", sa="त्यक्तम्", ne="छुटेको",
    ),
    "status.no_show": _t(
        "No Show",
        hi="अनुपस्थित", bn="অনুপস্থিত", te="హాజరుకాలేదు", mr="गैरहजर",
        ta="வரவில்லை", ur="غیر حاضر", gu="ગેરહાજર",
        kn="ಗೈರುಹಾಜರ್", ml="ഹാജരല്ല", or_="ଅନୁପସ୍ଥିତ",
        pa="ਗੈਰ-ਹਾਜ਼ਰ", as_="অনুপস্থিত", sa="अनुपस्थितः", ne="अनुपस्थित",
    ),
    "status.cancelled": _t(
        "Cancelled",
        hi="रद्द", bn="বাতিল", te="రద్దు చేయబడింది", mr="रद्द",
        ta="ரத்து செய்யப்பட்டது", ur="منسوخ", gu="રદ",
        kn="ರದ್ದಾಗಿದೆ", ml="റദ്ദാക്കി", or_="ବାତିଲ",
        pa="ਰੱਦ", as_="বাতিল", sa="निरस्तम्", ne="रद्द",
    ),

    "priority.normal": _t(
        "Normal",
        hi="सामान्य", bn="সাধারণ", te="సాధారణ", mr="सामान्य",
        ta="சாதாரண", ur="عام", gu="સામાન્ય",
        kn="ಸಾಮಾನ್ಯ", ml="സാധാരണ", or_="ସାଧାରଣ",
        pa="ਸਧਾਰਨ", as_="সাধাৰণ", sa="सामान्यः", ne="सामान्य",
    ),
    "priority.elderly": _t(
        "Elderly",
        hi="वरिष्ठ नागरिक", bn="প্রবীণ নাগরিক", te="వృద్ధులు", mr="ज्येष्ठ नागरिक",
        ta="மூத்த குடிமகன்", ur="بزرگ شہری", gu="વૃદ્ધ",
        kn="ಹಿರಿಯ ನಾಗರಿಕ", ml="മുതിർന്ന പൗരൻ", or_="ବରିଷ୍ଠ ନାଗରିକ",
        pa="ਬਜ਼ੁਰਗ", as_="জ্যেষ্ঠ নাগৰিক", sa="वृद्धः", ne="जेष्ठ नागरिक",
    ),
    "priority.disabled": _t(
        "Disabled",
        hi="दिव्यांग", bn="প্রতিবন্ধী", te="దివ్యాంగులు", mr="दिव्यांग",
        ta="மாற்றுத்திறனாளி", ur="معذور", gu="દિવ્યાંગ",
        kn="ಅಂಗವಿಕಲ", ml="ഭിന്നശേഷി", or_="ଦିବ୍ୟାଙ୍ଗ",
        pa="ਦਿਵਯਾਂਗ", as_="দিব্যাংগ", sa="दिव्याङ्गः", ne="अपाङ्ग",
    ),
    "priority.emergency": _t(
        "Emergency",
        hi="आपातकाल", bn="জরুরি", te="అత్యవసరం", mr="आपत्कालीन",
        ta="அவசரம்", ur="ہنگامی", gu="કટોકટી",
        kn="ತುರ್ತು", ml="അടിയന്തരം", or_="ଜରୁରୀ",
        pa="ਐਮਰਜੈਂਸੀ", as_="জৰুৰীকালীন", sa="आपत्कालिकः", ne="आपतकालीन",
    ),

    "channel.kiosk": _t(
        "Kiosk Self Check-in",
        hi="स्वयं चेक-इन कियोस्क", bn="কিয়স্ক সেলফ চেক-ইন",
        te="కియోస్క్ సెల్ఫ్ చెక్-ఇన్", mr="कियोस्क स्वयं चेक-इन",
        ta="கியோஸ்க் சுய பதிவு", ur="کیوسک خود چیک ان",
        gu="કિઓસ્ક સ્વ ચેક-ઇન", kn="ಕಿಯೋಸ್ಕ್ ಸ್ವಯಂ ಚೆಕ್-ಇನ್",
        ml="കിയോസ്ക് സെൽഫ് ചെക്ക്-ഇൻ", or_="କିଓସ୍କ ନିଜ ଚେକ-ଇନ",
        pa="ਕਿਓਸਕ ਸਵੈ ਚੈੱਕ-ਇਨ",
    ),
    "channel.counter": _t(
        "Counter",
        hi="काउंटर", bn="কাউন্টার", te="కౌంటర్", mr="काउंटर",
        ta="கவுண்டர்", ur="کاؤنٹر", gu="કાઉન્ટર",
        kn="ಕೌಂಟರ್", ml="കൗണ്ടർ", or_="କାଉଣ୍ଟର",
        pa="ਕਾਊਂਟਰ", as_="কাউণ্টাৰ",
    ),
    "channel.web": _t(
        "Web",
        hi="वेब", bn="ওয়েব", te="వెబ్", mr="वेब",
        ta="வலை", ur="ویب", gu="વેબ", kn="ವೆಬ್", ml="വെബ്",
        or_="ୱେବ", pa="ਵੈੱਬ",
    ),
    "channel.app": _t(
        "Mobile App",
        hi="मोबाइल ऐप", bn="মোবাইল অ্যাপ", te="మొబైల్ యాప్",
        mr="मोबाइल ॲप", ta="மொபைல் செயலி", ur="موبائل ایپ",
        gu="મોબાઇલ ઍપ", kn="ಮೊಬೈಲ್ ಆಪ್", ml="മൊബൈൽ ആപ്പ്",
        or_="ମୋବାଇଲ ଆପ", pa="ਮੋਬਾਈਲ ਐਪ",
    ),

    "ui.token_number": _t(
        "Token Number",
        hi="टोकन संख्या", bn="টোকেন নম্বর", te="టోకెన్ సంఖ్య",
        mr="टोकन क्रमांक", ta="டோக்கன் எண்", ur="ٹوکن نمبر",
        gu="ટોકન નંબર", kn="ಟೋಕನ್ ಸಂಖ್ಯೆ", ml="ടോക്കൺ നമ്പർ",
        or_="ଟୋକେନ ସଂଖ୍ୟା", pa="ਟੋਕਨ ਨੰਬਰ",
    ),
    "ui.now_serving": _t(
        "Now Serving",
        hi="अभी सेवा में", bn="এখন সেবা হচ্ছে", te="ఇప్పుడు సేవలో",
        mr="आता सेवा सुरू", ta="இப்போது சேவை", ur="ابھی خدمت جاری",
        gu="હાલ સેવા", kn="ಈಗ ಸೇವೆಯಲ್ಲಿ", ml="ഇപ്പോൾ സേവിക്കുന്നു",
        or_="ବର୍ତ୍ତମାନ ସେବା", pa="ਹੁਣ ਸੇਵਾ",
    ),
    "ui.waiting_count": _t(
        "People Waiting",
        hi="प्रतीक्षारत लोग", bn="অপেক্ষমাণ মানুষ", te="వేచి ఉన్నవారు",
        mr="प्रतीक्षेत लोक", ta="காத்திருப்பவர்கள்", ur="منتظر افراد",
        gu="રાહ જોતા લોકો", kn="ಕಾಯುತ್ತಿರುವವರು", ml="കാത്തിരിക്കുന്നവർ",
        or_="ଅପେକ୍ଷାରତ ଲୋକ", pa="ਉਡੀਕ ਕਰ ਰਹੇ ਲੋਕ",
    ),
    "ui.counter": _t(
        "Counter",
        hi="काउंटर", bn="কাউন্টার", te="కౌంటర్", mr="काउंटर",
        ta="கவுண்டர்", ur="کاؤنٹر", gu="કાઉન્ટર", kn="ಕೌಂಟರ್",
        ml="കൗണ്ടർ", or_="କାଉଣ୍ଟର", pa="ਕਾਊਂਟਰ",
    ),
    "ui.please_wait": _t(
        "Please wait for your turn",
        hi="कृपया अपनी बारी की प्रतीक्षा करें",
        bn="অনুগ্রহ করে আপনার পালার জন্য অপেক্ষা করুন",
        te="దయచేసి మీ వంతు కోసం వేచి ఉండండి",
        mr="कृपया आपल्या वेळेची प्रतीक्षा करा",
        ta="தயவுசெய்து உங்கள் முறைக்கு காத்திருக்கவும்",
        ur="براہ کرم اپنی باری کا انتظار کریں",
        gu="કૃપા કરીને તમારા વારાની રાહ જુઓ",
        kn="ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸರದಿಗಾಗಿ ಕಾಯಿರಿ",
        ml="ദയവായി നിങ്ങളുടെ ഊഴം കാത്തിരിക്കുക",
        or_="ଦୟାକରି ଆପଣଙ୍କ ପାଳି ପାଇଁ ଅପେକ୍ଷା କରନ୍ତୁ",
        pa="ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਵਾਰੀ ਦੀ ਉਡੀਕ ਕਰੋ",
    ),
    "ui.your_turn": _t(
        "It is your turn",
        hi="आपकी बारी है", bn="এটি আপনার পালা", te="మీ వంతు వచ్చింది",
        mr="तुमची वेळ आली आहे", ta="உங்கள் முறை",
        ur="آپ کی باری ہے", gu="તમારો વારો છે",
        kn="ನಿಮ್ಮ ಸರದಿ", ml="നിങ്ങളുടെ ഊഴം",
        or_="ଆପଣଙ୍କ ପାଳି", pa="ਤੁਹਾਡੀ ਵਾਰੀ ਹੈ",
    ),
    "ui.department": _t(
        "Department",
        hi="विभाग", bn="বিভাগ", te="విభాగం", mr="विभाग",
        ta="துறை", ur="شعبہ", gu="વિભાગ", kn="ವಿಭಾಗ",
        ml="വിഭാഗം", or_="ବିଭାଗ", pa="ਵਿਭਾਗ",
    ),
    "ui.service": _t(
        "Service",
        hi="सेवा", bn="সেবা", te="సేవ", mr="सेवा",
        ta="சேவை", ur="خدمت", gu="સેવા", kn="ಸೇವೆ",
        ml="സേവനം", or_="ସେବା", pa="ਸੇਵਾ",
    ),
    "ui.estimated_wait": _t(
        "Estimated wait",
        hi="अनुमानित प्रतीक्षा", bn="আনুমানিক অপেক্ষা",
        te="అంచనా నిరీక్షణ", mr="अंदाजे प्रतीक्षा",
        ta="மதிப்பிடப்பட்ட காத்திருப்பு", ur="متوقع انتظار",
        gu="અંદાજિત રાહ", kn="ಅಂದಾಜು ಕಾಯುವಿಕೆ",
        ml="കണക്കാക്കിയ കാത്തിരിപ്പ്", or_="ଆନୁମାନିକ ଅପେକ୍ଷା",
        pa="ਅੰਦਾਜ਼ਨ ਉਡੀਕ",
    ),
    "ui.priority_queue": _t(
        "Priority Queue",
        hi="प्राथमिकता कतार", bn="অগ্রাধিকার সারি",
        te="ప్రాధాన్యత క్యూ", mr="प्राधान्य रांग",
        ta="முன்னுரிமை வரிசை", ur="ترجیحی قطار",
        gu="અગ્રતા ક્યુ", kn="ಆದ್ಯತೆ ಸಾಲು",
        ml="മുൻഗണനാ ക്യൂ", or_="ଅଗ୍ରାଧିକାର ଧାଡ଼ି",
        pa="ਤਰਜੀਹੀ ਲਾਈਨ",
    ),

    "ui.full_name": _t(
        "Full Name",
        hi="पूरा नाम", bn="পুরো নাম", te="పూర్తి పేరు", mr="पूर्ण नाव",
        ta="முழு பெயர்", ur="پورا نام", gu="પૂરું નામ",
        kn="ಪೂರ್ಣ ಹೆಸರು", ml="പൂർണ്ണ നാമം", or_="ପୂର୍ଣ୍ଣ ନାମ",
        pa="ਪੂਰਾ ਨਾਮ",
    ),
    "ui.phone": _t(
        "Phone",
        hi="फ़ोन", bn="ফোন", te="ఫోన్", mr="फोन",
        ta="தொலைபேசி", ur="فون", gu="ફોન",
        kn="ಫೋನ್", ml="ഫോൺ", or_="ଫୋନ", pa="ਫ਼ੋਨ",
    ),
    "ui.mrn": _t(
        "Medical Record Number",
        hi="मेडिकल रिकॉर्ड संख्या", bn="মেডিকেল রেকর্ড নম্বর",
        te="వైద్య రికార్డు సంఖ్య", mr="वैद्यकीय नोंद क्रमांक",
        ta="மருத்துவ பதிவு எண்", ur="میڈیکل ریکارڈ نمبر",
        gu="તબીબી રેકોર્ડ નંબર", kn="ವೈದ್ಯಕೀಯ ದಾಖಲೆ ಸಂಖ್ಯೆ",
        ml="മെഡിക്കൽ റെക്കോർഡ് നമ്പർ", or_="ଚିକିତ୍ସା ରେକର୍ଡ ସଂଖ୍ୟା",
        pa="ਮੈਡੀਕਲ ਰਿਕਾਰਡ ਨੰਬਰ",
    ),
    "ui.generate_token": _t(
        "Generate Token",
        hi="टोकन बनाएँ", bn="টোকেন তৈরি করুন",
        te="టోకెన్ రూపొందించండి", mr="टोकन तयार करा",
        ta="டோக்கன் உருவாக்கு", ur="ٹوکن بنائیں",
        gu="ટોકન બનાવો", kn="ಟೋಕನ್ ರಚಿಸಿ",
        ml="ടോക്കൺ സൃഷ്ടിക്കുക", or_="ଟୋକେନ ସୃଷ୍ଟି କରନ୍ତୁ",
        pa="ਟੋਕਨ ਬਣਾਓ",
    ),
    "ui.issue_another": _t(
        "Issue another token",
        hi="दूसरा टोकन जारी करें", bn="আরেকটি টোকেন নিন",
        te="మరో టోకెన్ జారీ చేయండి", mr="आणखी एक टोकन द्या",
        ta="மற்றொரு டோக்கன் வழங்கு", ur="دوسرا ٹوکن جاری کریں",
        gu="બીજું ટોકન ઇશ્યૂ કરો", kn="ಇನ್ನೊಂದು ಟೋಕನ್ ನೀಡಿ",
        ml="മറ്റൊരു ടോക്കൺ നൽകുക", or_="ଅନ୍ୟ ଟୋକେନ ଜାରି କରନ୍ତୁ",
        pa="ਹੋਰ ਟੋਕਨ ਜਾਰੀ ਕਰੋ",
    ),
    "ui.token_generated": _t(
        "Token Generated",
        hi="टोकन जारी हुआ", bn="টোকেন তৈরি হয়েছে",
        te="టోకెన్ జారీ అయ్యింది", mr="टोकन तयार झाले",
        ta="டோக்கன் உருவாக்கப்பட்டது", ur="ٹوکن جاری ہو گیا",
        gu="ટોકન ઇશ્યૂ થયું", kn="ಟೋಕನ್ ರಚಿಸಲಾಗಿದೆ",
        ml="ടോക്കൺ സൃഷ്ടിച്ചു", or_="ଟୋକେନ ଜାରି ହୋଇଛି",
        pa="ਟੋਕਨ ਜਾਰੀ ਹੋਇਆ",
    ),
    "ui.fill_details": _t(
        "Fill in your details to get a queue token.",
        hi="कतार टोकन प्राप्त करने के लिए अपना विवरण भरें।",
        bn="সারি টোকেন পেতে আপনার বিবরণ পূরণ করুন।",
        te="క్యూ టోకెన్ పొందడానికి మీ వివరాలను నింపండి.",
        mr="रांगेचा टोकन मिळवण्यासाठी आपली माहिती भरा.",
        ta="வரிசை டோக்கன் பெற உங்கள் விவரங்களை நிரப்பவும்.",
        ur="قطار کا ٹوکن حاصل کرنے کے لیے اپنی تفصیلات پُر کریں۔",
        gu="ક્યુ ટોકન મેળવવા માટે તમારી વિગતો ભરો.",
        kn="ಸಾಲಿನ ಟೋಕನ್ ಪಡೆಯಲು ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ.",
        ml="ക്യൂ ടോക്കൺ ലഭിക്കാൻ നിങ്ങളുടെ വിശദാംശങ്ങൾ പൂരിപ്പിക്കുക.",
        or_="ଧାଡ଼ି ଟୋକେନ ପାଇବା ପାଇଁ ଆପଣଙ୍କ ବିବରଣୀ ପୁରଣ କରନ୍ତୁ।",
        pa="ਲਾਈਨ ਟੋਕਨ ਪ੍ਰਾਪਤ ਕਰਨ ਲਈ ਆਪਣੀ ਜਾਣਕਾਰੀ ਭਰੋ।",
    ),
    "ui.up_next": _t(
        "Up Next",
        hi="आगे", bn="পরবর্তী", te="తరువాత", mr="पुढील",
        ta="அடுத்து", ur="اگلا", gu="આગળ",
        kn="ಮುಂದಿನದು", ml="അടുത്തത്", or_="ପରବର୍ତ୍ତୀ",
        pa="ਅੱਗੇ",
    ),
    "ui.queue_empty": _t(
        "Queue is empty.",
        hi="कतार खाली है।", bn="সারি খালি।",
        te="క్యూ ఖాళీగా ఉంది.", mr="रांग रिकामी आहे.",
        ta="வரிசை காலியாக உள்ளது.", ur="قطار خالی ہے۔",
        gu="ક્યુ ખાલી છે.", kn="ಸಾಲು ಖಾಲಿಯಾಗಿದೆ.",
        ml="ക്യൂ ശൂന്യമാണ്.", or_="ଧାଡ଼ି ଖାଲି ଅଛି।",
        pa="ਲਾਈਨ ਖਾਲੀ ਹੈ।",
    ),
    "ui.total_waiting": _t(
        "Total waiting",
        hi="कुल प्रतीक्षा", bn="মোট অপেক্ষমাণ",
        te="మొత్తం నిరీక్షణ", mr="एकूण प्रतीक्षेत",
        ta="மொத்த காத்திருப்பு", ur="کل انتظار",
        gu="કુલ રાહ", kn="ಒಟ್ಟು ಕಾಯುತ್ತಿದೆ",
        ml="മൊത്തം കാത്തിരിപ്പ്", or_="ମୋଟ ଅପେକ୍ଷା",
        pa="ਕੁੱਲ ਉਡੀਕ",
    ),
    "ui.uhid": _t(
        "UHID",
        hi="यू.एच.आई.डी.", bn="ইউএইচআইডি", te="యు.హెచ్.ఐ.డి.",
        mr="यू.एच.आय.डी.", ta="யு.எச்.ஐ.டி.", ur="یو ایچ آئی ڈی",
        gu="યુ.એચ.આઈ.ડી.", kn="ಯು.ಎಚ್.ಐ.ಡಿ.", ml="യു.എച്ച്.ഐ.ഡി.",
        or_="ୟୁ.ଏଚ.ଆଇ.ଡି.", pa="ਯੂ.ਐੱਚ.ਆਈ.ਡੀ.",
    ),
    "ui.fetch": _t(
        "Fetch",
        hi="लाएँ", bn="আনুন", te="తీసుకురండి", mr="आणा",
        ta="பெறுக", ur="حاصل کریں", gu="લાવો",
        kn="ತರಿಸಿ", ml="കൊണ്ടുവരിക", or_="ଆଣନ୍ତୁ",
        pa="ਲਿਆਓ",
    ),
    "ui.age": _t(
        "Age",
        hi="आयु", bn="বয়স", te="వయస్సు", mr="वय",
        ta="வயது", ur="عمر", gu="ઉંમર",
        kn="ವಯಸ್ಸು", ml="പ്രായം", or_="ବୟସ",
        pa="ਉਮਰ",
    ),
    "ui.gender": _t(
        "Gender",
        hi="लिंग", bn="লিঙ্গ", te="లింగం", mr="लिंग",
        ta="பாலினம்", ur="جنس", gu="લિંગ",
        kn="ಲಿಂಗ", ml="ലിംഗം", or_="ଲିଙ୍ଗ",
        pa="ਲਿੰਗ",
    ),
    "ui.uhid_not_found": _t(
        "No patient found for this UHID.",
        hi="इस यू.एच.आई.डी. के लिए कोई मरीज़ नहीं मिला।",
        bn="এই ইউএইচআইডির জন্য কোনও রোগী পাওয়া যায়নি।",
        te="ఈ యు.హెచ్.ఐ.డి.కి రోగి కనుగొనబడలేదు.",
        mr="या यू.एच.आय.डी. साठी रुग्ण सापडला नाही.",
        ta="இந்த யு.எச்.ஐ.டி.க்கு நோயாளி இல்லை.",
        ur="اس یو ایچ آئی ڈی کے لیے کوئی مریض نہیں ملا۔",
        gu="આ યુ.એચ.આઈ.ડી. માટે દર્દી મળ્યો નથી.",
        kn="ಈ ಯು.ಎಚ್.ಐ.ಡಿ.ಗೆ ರೋಗಿ ಕಂಡುಬಂದಿಲ್ಲ.",
        ml="ഈ യു.എച്ച്.ഐ.ഡി.ക്ക് രോഗിയെ കണ്ടെത്തിയില്ല.",
        or_="ଏହି ୟୁ.ଏଚ.ଆଇ.ଡି. ପାଇଁ କୌଣସି ରୋଗୀ ମିଳିଲା ନାହିଁ।",
        pa="ਇਸ ਯੂ.ਐੱਚ.ਆਈ.ਡੀ. ਲਈ ਕੋਈ ਮਰੀਜ਼ ਨਹੀਂ ਮਿਲਿਆ।",
    ),
}

TEMPLATES: dict[str, dict[str, str]] = {
    "announce.call": _t(
        "Token {token}, please proceed to counter {counter}.",
        hi="टोकन {token}, कृपया काउंटर {counter} पर जाएँ।",
        bn="টোকেন {token}, অনুগ্রহ করে কাউন্টার {counter}-এ যান।",
        te="టోకెన్ {token}, దయచేసి కౌంటర్ {counter}కి వెళ్ళండి.",
        mr="टोकन {token}, कृपया काउंटर {counter} वर जा.",
        ta="டோக்கன் {token}, தயவுசெய்து கவுண்டர் {counter} க்கு செல்லவும்.",
        ur="ٹوکن {token}, براہ کرم کاؤنٹر {counter} پر جائیں۔",
        gu="ટોકન {token}, કૃપા કરીને કાઉન્ટર {counter} પર જાઓ.",
        kn="ಟೋಕನ್ {token}, ದಯವಿಟ್ಟು ಕೌಂಟರ್ {counter}ಗೆ ತೆರಳಿ.",
        ml="ടോക്കൺ {token}, ദയവായി കൗണ്ടർ {counter}ലേക്ക് പോകുക.",
        or_="ଟୋକେନ {token}, ଦୟାକରି କାଉଣ୍ଟର {counter}କୁ ଯାଆନ୍ତୁ।",
        pa="ਟੋਕਨ {token}, ਕਿਰਪਾ ਕਰਕੇ ਕਾਊਂਟਰ {counter} ਤੇ ਜਾਓ।",
    ),
    "announce.recall": _t(
        "Final call for token {token} at counter {counter}.",
        hi="टोकन {token} के लिए अंतिम कॉल, काउंटर {counter}।",
        bn="টোকেন {token}-এর জন্য শেষ ডাক, কাউন্টার {counter}।",
        te="టోకెన్ {token} కోసం చివరి పిలుపు, కౌంటర్ {counter}.",
        mr="टोकन {token} साठी अंतिम बोलावणे, काउंटर {counter}.",
        ta="டோக்கன் {token}க்கான இறுதி அழைப்பு, கவுண்டர் {counter}.",
        ur="ٹوکن {token} کے لیے آخری کال، کاؤنٹر {counter}۔",
        gu="ટોકન {token} માટે અંતિમ કોલ, કાઉન્ટર {counter}.",
        kn="ಟೋಕನ್ {token}ಗೆ ಅಂತಿಮ ಕರೆ, ಕೌಂಟರ್ {counter}.",
        ml="ടോക്കൺ {token}നുള്ള അവസാന വിളി, കൗണ്ടർ {counter}.",
        or_="ଟୋକେନ {token} ପାଇଁ ଶେଷ ଡାକ, କାଉଣ୍ଟର {counter}।",
        pa="ਟੋਕਨ {token} ਲਈ ਅੰਤਿਮ ਕਾਲ, ਕਾਊਂਟਰ {counter}।",
    ),
    "announce.skipped": _t(
        "Token {token} has been skipped. Please contact the counter staff.",
        hi="टोकन {token} छोड़ दिया गया है। कृपया काउंटर कर्मचारी से संपर्क करें।",
        bn="টোকেন {token} এড়ানো হয়েছে। অনুগ্রহ করে কাউন্টার কর্মীদের সাথে যোগাযোগ করুন।",
        te="టోకెన్ {token} వదిలివేయబడింది. దయచేసి కౌంటర్ సిబ్బందిని సంప్రదించండి.",
        mr="टोकन {token} वगळला आहे. कृपया काउंटर कर्मचाऱ्यांशी संपर्क साधा.",
        ta="டோக்கன் {token} தவிர்க்கப்பட்டது. கவுண்டர் ஊழியரை தொடர்பு கொள்ளவும்.",
        ur="ٹوکن {token} نظرانداز کر دیا گیا ہے۔ برائے مہربانی کاؤنٹر عملے سے رابطہ کریں۔",
        gu="ટોકન {token} છોડી દેવામાં આવ્યું છે. કૃપા કરીને કાઉન્ટર સ્ટાફનો સંપર્ક કરો.",
        kn="ಟೋಕನ್ {token} ಬಿಟ್ಟುಬಿಡಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಕೌಂಟರ್ ಸಿಬ್ಬಂದಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.",
        ml="ടോക്കൺ {token} ഒഴിവാക്കി. ദയവായി കൗണ്ടർ സ്റ്റാഫുമായി ബന്ധപ്പെടുക.",
        or_="ଟୋକେନ {token} ଛାଡ଼ିଦିଆଯାଇଛି। ଦୟାକରି କାଉଣ୍ଟର କର୍ମଚାରୀଙ୍କ ସହିତ ଯୋଗାଯୋଗ କରନ୍ତୁ।",
        pa="ਟੋਕਨ {token} ਛੱਡ ਦਿੱਤਾ ਗਿਆ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਕਾਊਂਟਰ ਸਟਾਫ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।",
    ),
    "announce.ready_soon": _t(
        "Token {token}, your turn is in about {minutes} minutes.",
        hi="टोकन {token}, आपकी बारी लगभग {minutes} मिनट में है।",
        bn="টোকেন {token}, আপনার পালা প্রায় {minutes} মিনিটে।",
        te="టోకెన్ {token}, మీ వంతు సుమారు {minutes} నిమిషాల్లో.",
        mr="टोकन {token}, तुमची वेळ सुमारे {minutes} मिनिटांत.",
        ta="டோக்கன் {token}, உங்கள் முறை சுமார் {minutes} நிமிடங்களில்.",
        ur="ٹوکن {token}, آپ کی باری تقریباً {minutes} منٹ میں ہے۔",
        gu="ટોકન {token}, તમારો વારો આશરે {minutes} મિનિટમાં છે.",
        kn="ಟೋಕನ್ {token}, ನಿಮ್ಮ ಸರದಿ ಸುಮಾರು {minutes} ನಿಮಿಷಗಳಲ್ಲಿ.",
        ml="ടോക്കൺ {token}, നിങ്ങളുടെ ഊഴം ഏകദേശം {minutes} മിനിറ്റിനുള്ളിൽ.",
        or_="ଟୋକେନ {token}, ଆପଣଙ୍କ ପାଳି ପ୍ରାୟ {minutes} ମିନିଟରେ।",
        pa="ਟੋਕਨ {token}, ਤੁਹਾਡੀ ਵਾਰੀ ਲਗਭਗ {minutes} ਮਿੰਟਾਂ ਵਿੱਚ ਹੈ।",
    ),
    "notify.issued": _t(
        "Your token is {token} for {department}. {waiting_count} patient(s) ahead of you.",
        hi="{department} के लिए आपका टोकन {token} है। आपसे पहले {waiting_count} मरीज़ हैं।",
        bn="{department}-এর জন্য আপনার টোকেন {token}। আপনার আগে {waiting_count} রোগী আছেন।",
        te="{department} కోసం మీ టోకెన్ {token}. మీ ముందు {waiting_count} రోగులు ఉన్నారు.",
        mr="{department} साठी तुमचा टोकन {token} आहे. तुमच्या आधी {waiting_count} रुग्ण आहेत.",
        ta="{department}க்கான உங்கள் டோக்கன் {token}. உங்களுக்கு முன் {waiting_count} நோயாளிகள்.",
        ur="{department} کے لیے آپ کا ٹوکن {token} ہے۔ آپ سے پہلے {waiting_count} مریض ہیں۔",
        gu="{department} માટે તમારો ટોકન {token} છે. તમારા પહેલા {waiting_count} દર્દી છે.",
        kn="{department}ಗೆ ನಿಮ್ಮ ಟೋಕನ್ {token}. ನಿಮ್ಮ ಮುಂದೆ {waiting_count} ರೋಗಿಗಳಿದ್ದಾರೆ.",
        ml="{department}നായി നിങ്ങളുടെ ടോക്കൺ {token}. നിങ്ങളുടെ മുമ്പിൽ {waiting_count} രോഗികൾ.",
        or_="{department} ପାଇଁ ଆପଣଙ୍କ ଟୋକେନ {token}। ଆପଣଙ୍କ ଆଗରେ {waiting_count} ରୋଗୀ।",
        pa="{department} ਲਈ ਤੁਹਾਡਾ ਟੋਕਨ {token} ਹੈ। ਤੁਹਾਡੇ ਤੋਂ ਪਹਿਲਾਂ {waiting_count} ਮਰੀਜ਼ ਹਨ।",
    ),
    "notify.completed": _t(
        "Thank you. Token {token} is complete.",
        hi="धन्यवाद। टोकन {token} पूर्ण हुआ।",
        bn="ধন্যবাদ। টোকেন {token} সম্পূর্ণ।",
        te="ధన్యవాదాలు. టోకెన్ {token} పూర్తయింది.",
        mr="धन्यवाद. टोकन {token} पूर्ण झाला.",
        ta="நன்றி. டோக்கன் {token} முடிந்தது.",
        ur="شکریہ۔ ٹوکن {token} مکمل ہوا۔",
        gu="આભાર. ટોકન {token} પૂર્ણ થયું.",
        kn="ಧನ್ಯವಾದಗಳು. ಟೋಕನ್ {token} ಪೂರ್ಣಗೊಂಡಿದೆ.",
        ml="നന്ദി. ടോക്കൺ {token} പൂർത്തിയായി.",
        or_="ଧନ୍ୟବାଦ। ଟୋକେନ {token} ସମ୍ପୂର୍ଣ୍ଣ।",
        pa="ਧੰਨਵਾਦ। ਟੋਕਨ {token} ਪੂਰਾ ਹੋਇਆ।",
    ),
}


# ── Public API ──────────────────────────────────────────────────────

def normalize_language(code: str | None) -> str:
    """Map a user-supplied code (case / BCP-47 / alias) to a supported key."""
    if not code:
        return DEFAULT_LANGUAGE
    base = code.strip().lower().replace("_", "-").split("-")[0]
    # Handle the ``or`` / ``or_`` / ``as`` / ``as_`` reserved-word aliases.
    alias_map = {"or_": "or", "as_": "as", "odia": "or", "oriya": "or",
                 "bangla": "bn", "punjabi": "pa"}
    base = alias_map.get(base, base)
    return base if base in LANGUAGES else DEFAULT_LANGUAGE


def _lookup(mapping: dict[str, dict[str, str]], key: str, lang: str) -> str:
    """Resolve a key for ``lang`` with dict-key alias + English fallback."""
    entry = mapping.get(key)
    if not entry:
        return key
    # stored keys may use trailing underscore (``or_``, ``as_``) to avoid
    # Python reserved words when using keyword args in _t().
    for candidate in (lang, f"{lang}_"):
        if candidate in entry:
            return entry[candidate]
    return entry.get("en", key)


def translate(key: str, lang: str | None = None) -> str:
    """Translate a static label. Unknown key → returned verbatim."""
    lang = normalize_language(lang)
    return _lookup(LABELS, key, lang)


def announce(key: str, lang: str | None = None, **params: Any) -> str:
    """Resolve an announcement template and fill in placeholders."""
    lang = normalize_language(lang)
    template = _lookup(TEMPLATES, key, lang)
    try:
        return template.format(**params)
    except (KeyError, IndexError):
        # Missing placeholder → fall back to English template to reduce garbling.
        return TEMPLATES.get(key, {}).get("en", template).format(**{k: "" for k in params}) or template


def bundle(lang: str | None = None) -> dict[str, Any]:
    """Full translation bundle for a single language — used by the frontend.

    The frontend pulls this once at startup (or when the operator switches
    language) and caches it locally — avoids chattier per-request lookups.
    """
    lang = normalize_language(lang)
    return {
        "language": lang,
        "meta": LANGUAGES[lang],
        "labels": {k: _lookup(LABELS, k, lang) for k in LABELS},
        "templates": {k: _lookup(TEMPLATES, k, lang) for k in TEMPLATES},
    }


def supported_languages() -> list[dict[str, str]]:
    """List of {code, name, english_name, script} for UI pickers."""
    return [{"code": code, **meta} for code, meta in LANGUAGES.items()]


def resolve_request_language(request) -> str:
    """Pick a language from ``?lang=``, then ``Accept-Language``, then default."""
    q = request.query_params.get("lang") if hasattr(request, "query_params") else None
    if q:
        return normalize_language(q)
    header = (
        request.META.get("HTTP_ACCEPT_LANGUAGE", "")
        if hasattr(request, "META") else ""
    )
    if header:
        for part in header.split(","):
            code = part.split(";")[0].strip()
            norm = normalize_language(code)
            if norm != DEFAULT_LANGUAGE or code.lower().startswith("en"):
                return norm
    return DEFAULT_LANGUAGE
