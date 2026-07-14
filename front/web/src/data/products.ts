import type { ProductConfig, ProductId } from '../types'
import type { Lang } from '../lib/i18n'

// Everything that differs between the three products lives here, per language.
const PRODUCTS_BY_LANG: Record<Lang, Record<ProductId, ProductConfig>> = {
  en: {
    ppt: {
      tab: 'Presentation', accent: '#a07cff',
      badge: 'Make PPT', titleLead: 'Make ', titleEmph: 'PPT.',
      subtitle: 'Turn prompts, PDFs, documents, and URLs into polished, editable PowerPoint decks in minutes — on make-ppt.com.',
      primaryBtn: 'Generate presentation', footline: 'AI structure · Modern design · Editable PPTX export',
      flowTitle: 'Presentation Workflow', promptText: 'Create a 5-slide presentation about the future of electric vehicles',
      generateLabel: 'Generate deck',
      uploads: [['PDF', '#e85c5c', 'file'], ['DOCX', '#3b82f6', 'fileLines'], ['Image', '#9333ea', 'image'], ['URL', '#0ea5a3', 'link']],
      fields: [['Slides', '5'], ['Audience', 'Executives'], ['Tone', ['Professional', 'Casual', 'Academic', 'Bold']]],
      categories: ['Startup Pitch', 'Business Report', 'Research', 'Education', 'Sales Proposal', 'Portfolio', 'Strategy Deck'],
      flow: [
        ['text', 'Prompt', 'Describe your topic, audience, and goal', '10:24', 'Prompt received', 'Triggered: {User uploads document}'],
        ['upload', 'Source Upload', 'Add PDF, DOCX, image, URL, or notes', '10:24', 'Content analyzed', 'Triggered: {AI detects structure}'],
        ['sparkle', 'AI Outline', 'Sections, slide titles, and story flow generated', '10:25', 'Outline ready', 'Triggered: {Design theme selected}'],
        ['palette', 'Design Engine', 'Layouts, icons, charts, and visuals applied', '10:25', 'Design generated', null],
        ['download', 'Export', 'Download a fully editable PowerPoint deck', '10:26', 'PPTX ready', null],
      ],
      featuresHeading: 'Everything you need to create better decks',
      features: [
        [['#7aa6ff', '#a07cff'], 'sparkle', 'Prompt to PPT', 'Generate a complete presentation from a simple idea.'],
        [['#5fb8ff', '#7aa6ff'], 'fileLines', 'Document to Slides', 'Convert PDFs, Word files, notes, and URLs into structured slides.'],
        [['#c47cff', '#f07fc0'], 'palette', 'AI Design System', 'Automatically applies modern layouts, colors, icons, and visual hierarchy.'],
        [['#ff9f7a', '#f07fc0'], 'download', 'Editable Export', 'Download clean, editable PPTX files ready for PowerPoint.'],
      ],
      templatesHeading: 'Choose a style. Let AI build the deck.', templateMeta: '12 slides · Editable PPTX',
      templates: [
        ['Startup Pitch Deck', 'cover', '#6aa0ff', '#a780ff', '#f48fc0'],
        ['Business Report', 'chart', '#5fb8ff', '#7aa6ff', '#a780ff'],
        ['Research Presentation', 'bullets', '#a780ff', '#c47cff', '#f48fc0'],
        ['Sales Proposal', 'split', '#f48fc0', '#ff9f7a', '#ffb38a'],
        ['Educational Lecture', 'cover', '#7aa6ff', '#a780ff', '#5fb8ff'],
      ],
      workflowHeading: 'From rough idea to finished deck',
      workflow: [
        ['01', 'Upload or describe', 'Start from a prompt, or drop in a PDF, DOCX, URL, image, or notes.', '#6aa0ff', '#a780ff'],
        ['02', 'AI creates the structure', 'Sections, slide titles, and a clear story flow are generated for you.', '#a780ff', '#f48fc0'],
        ['03', 'Design engine styles every slide', 'Layouts, icons, charts, and visual hierarchy applied automatically.', '#f48fc0', '#ff9f7a'],
        ['04', 'Export editable PPTX', 'Download a clean, fully editable deck ready to open in PowerPoint.', '#ff9f7a', '#6aa0ff'],
      ],
      ctaHeading: 'Create your next deck with Make PPT.', ctaSub: 'Upload your content, choose a style, and get an editable PowerPoint in minutes.', ctaBtn: 'Generate my first deck',
    },
    kurs: {
      tab: 'Course Project', accent: '#5fb8ff',
      badge: 'AI coursework writer', titleLead: 'Your complete ', titleEmph: 'course project, written.',
      subtitle: 'Turn a topic and your sources into a fully structured course project (kurs ishi) — title page, chapters, and references — as an editable Word document.',
      primaryBtn: 'Generate document', footline: 'Structured chapters · Auto citations · Editable DOCX export',
      flowTitle: 'Course Project Workflow', promptText: 'Write a 25-page course project on renewable energy adoption in Central Asia',
      generateLabel: 'Generate document',
      uploads: [['PDF', '#e85c5c', 'file'], ['DOCX', '#3b82f6', 'fileLines'], ['URL', '#0ea5a3', 'link']],
      fields: [['Subject', 'Energy Economics'], ['University', 'National University'], ['Supervisor', 'Dr. Karimov'], ['Pages', '25'], ['Chapters', '3']],
      categories: ['Engineering', 'Economics', 'Computer Science', 'Pedagogy', 'Law', 'Medicine', 'Philology'],
      flow: [
        ['text', 'Topic & Brief', 'Set subject, supervisor, page count, and structure', '09:10', 'Brief saved', 'Triggered: {Sources uploaded}'],
        ['upload', 'Source Upload', 'Add reference PDFs, DOCX, lecture notes, or URLs', '09:11', 'Sources analyzed', 'Triggered: {AI builds chapter plan}'],
        ['list', 'Chapter Outline', 'Title page, intro, chapters, conclusion, references', '09:12', 'Outline ready', 'Triggered: {Draft approved}'],
        ['pen', 'Draft & Cite', 'Each chapter written and in-text citations inserted', '09:14', 'Draft & references done', null],
        ['download', 'Export', 'Download a formatted, editable Word document', '09:15', 'DOCX ready', null],
      ],
      featuresHeading: 'Everything a strong course project needs',
      features: [
        [['#5fb8ff', '#7aa6ff'], 'grad', 'Topic to document', 'Generate a full course project from a subject and brief.'],
        [['#7aa6ff', '#a07cff'], 'list', 'Auto chapters & sections', 'Title page, introduction, chapters, conclusion — structured for you.'],
        [['#c47cff', '#f07fc0'], 'check', 'Citations & references', 'In-text citations and a reference list built from your sources.'],
        [['#ff9f7a', '#f07fc0'], 'download', 'Editable DOCX', 'Download a clean Word document ready to format and submit.'],
      ],
      templatesHeading: 'Pick a structure. Let AI write the project.', templateMeta: '25 pages · Editable DOCX',
      templates: [
        ['Standard Course Project', 'split', '#5fb8ff', '#7aa6ff', '#a780ff'],
        ['Lab Report', 'chart', '#6aa0ff', '#5fb8ff', '#7aa6ff'],
        ['Term Paper', 'bullets', '#7aa6ff', '#a780ff', '#c47cff'],
        ['Case Study', 'split', '#a780ff', '#c47cff', '#f48fc0'],
        ['Literature Review', 'bullets', '#c47cff', '#f48fc0', '#ff9f7a'],
      ],
      workflowHeading: 'From topic to submitted project',
      workflow: [
        ['01', 'Set the brief', 'Enter subject, supervisor, page count, and required chapters.', '#5fb8ff', '#7aa6ff'],
        ['02', 'AI builds the outline', 'Title page, introduction, chapters, conclusion, and references planned.', '#7aa6ff', '#a07cff'],
        ['03', 'Draft & cite', 'Each chapter is written and citations are inserted automatically.', '#a07cff', '#f48fc0'],
        ['04', 'Export editable DOCX', 'Download a formatted Word document ready to submit.', '#f48fc0', '#5fb8ff'],
      ],
      ctaHeading: 'Write your next course project with AI.', ctaSub: 'Set your brief, add your sources, and get an editable Word document in minutes.', ctaBtn: 'Generate my first project',
    },
    mustaqil: {
      tab: 'Self-study', accent: '#f07fc0',
      badge: 'AI self-study generator', titleLead: 'Your ', titleEmph: 'independent-study work, done.',
      subtitle: 'Generate independent-study assignments (mustaqil ish) from a topic or your materials — structured, formatted, and ready to submit as an editable document.',
      primaryBtn: 'Generate work', footline: 'Clear structure · Proper formatting · Editable DOCX export',
      flowTitle: 'Self-study Workflow', promptText: 'Prepare an independent-study assignment on database normalization with examples',
      generateLabel: 'Generate work',
      uploads: [['PDF', '#e85c5c', 'file'], ['DOCX', '#3b82f6', 'fileLines'], ['URL', '#0ea5a3', 'link']],
      fields: [['Subject', 'Databases'], ['Topic', 'Normalization'], ['Pages', '8'], ['Format', ['Essay', 'Report', 'Problem set', 'Summary']]],
      categories: ['Essay', 'Report', 'Problem set', 'Summary', 'Review', 'Lecture notes'],
      flow: [
        ['text', 'Topic & Brief', 'Set subject, topic, length, and required format', '14:02', 'Brief saved', 'Triggered: {Materials uploaded}'],
        ['upload', 'Source Upload', 'Add lecture notes, PDFs, DOCX, or URLs', '14:03', 'Materials analyzed', 'Triggered: {AI builds outline}'],
        ['list', 'Outline', 'Headings and sections planned for the assignment', '14:03', 'Outline ready', 'Triggered: {Draft approved}'],
        ['pen', 'Write & Format', 'Content written and formatted to the required standard', '14:05', 'Draft formatted', null],
        ['download', 'Export', 'Download an editable, submission-ready document', '14:06', 'DOCX ready', null],
      ],
      featuresHeading: 'Everything your independent work needs',
      features: [
        [['#f07fc0', '#ff9f7a'], 'book', 'Topic to work', 'Turn a topic into a complete independent-study assignment.'],
        [['#a07cff', '#f07fc0'], 'list', 'Structured sections', 'Clear headings, sections, and a logical flow generated for you.'],
        [['#7aa6ff', '#a07cff'], 'pen', 'Formatted to standard', 'Spacing, headings, and layout formatted to submission requirements.'],
        [['#5fb8ff', '#7aa6ff'], 'download', 'Editable DOCX', 'Download a clean document you can tweak and submit.'],
      ],
      templatesHeading: 'Pick a format. Let AI prepare the work.', templateMeta: '8 pages · Editable DOCX',
      templates: [
        ['Essay', 'cover', '#f07fc0', '#ff9f7a', '#ffb38a'],
        ['Structured Report', 'split', '#a780ff', '#f48fc0', '#ff9f7a'],
        ['Problem Set', 'chart', '#7aa6ff', '#a780ff', '#c47cff'],
        ['Topic Summary', 'bullets', '#5fb8ff', '#7aa6ff', '#a780ff'],
        ['Reading Review', 'bullets', '#c47cff', '#f48fc0', '#f07fc0'],
      ],
      workflowHeading: 'From topic to finished work',
      workflow: [
        ['01', 'Set the brief', 'Enter subject, topic, length, and the required format.', '#f07fc0', '#ff9f7a'],
        ['02', 'AI builds the outline', 'Headings and sections are planned for your assignment.', '#a07cff', '#f07fc0'],
        ['03', 'Write & format', 'Content is written and formatted to the required standard.', '#7aa6ff', '#a07cff'],
        ['04', 'Export editable DOCX', 'Download a submission-ready document in minutes.', '#5fb8ff', '#7aa6ff'],
      ],
      ctaHeading: 'Prepare your independent work with AI.', ctaSub: 'Set your topic, add materials, and get an editable document in minutes.', ctaBtn: 'Generate my first assignment',
    },
  },
  uz: {
    ppt: {
      tab: 'Prezentatsiya', accent: '#a07cff',
      badge: 'Make PPT', titleLead: 'PPT ', titleEmph: 'yarating.',
      subtitle: 'Buyruqlar, PDF, hujjat va URL manzillarni bir necha daqiqada tayyor, tahrirlanadigan PowerPoint prezentatsiyalariga aylantiring — make-ppt.com da.',
      primaryBtn: 'Prezentatsiya yaratish', footline: 'AI tuzilma · Zamonaviy dizayn · Tahrirlanadigan PPTX eksport',
      flowTitle: 'Prezentatsiya jarayoni', promptText: 'Elektromobillar kelajagi haqida 5 slaydli prezentatsiya yarating',
      generateLabel: 'Yaratish',
      uploads: [['PDF', '#e85c5c', 'file'], ['DOCX', '#3b82f6', 'fileLines'], ['Rasm', '#9333ea', 'image'], ['URL', '#0ea5a3', 'link']],
      fields: [['Slaydlar', '5'], ['Auditoriya', 'Rahbarlar'], ['Uslub', ['Professional', 'Erkin', 'Ilmiy', 'Jasur']]],
      categories: ['Startap tanishtiruvi', 'Biznes hisoboti', 'Tadqiqot', 'Ta’lim', 'Sotuv taklifi', 'Portfolio', 'Strategiya'],
      flow: [
        ['text', 'Buyruq', 'Mavzu, auditoriya va maqsadni tasvirlab bering', '10:24', 'Buyruq qabul qilindi', 'Ishga tushdi: {Foydalanuvchi hujjat yuklaydi}'],
        ['upload', 'Manba yuklash', 'PDF, DOCX, rasm, URL yoki matn qo‘shing', '10:24', 'Kontent tahlil qilindi', 'Ishga tushdi: {AI tuzilmani aniqlaydi}'],
        ['sparkle', 'AI rejasi', 'Bo‘limlar, slayd sarlavhalari va hikoya oqimi yaratildi', '10:25', 'Reja tayyor', 'Ishga tushdi: {Mavzu tanlandi}'],
        ['palette', 'Dizayn dvijoki', 'Layoutlar, ikonkalar, grafiklar va vizuallar qo‘yildi', '10:25', 'Dizayn tayyor', null],
        ['download', 'Eksport', 'To‘liq tahrirlanadigan PowerPoint prezentatsiyasi yuklab olindi', '10:26', 'PPTX tayyor', null],
      ],
      featuresHeading: 'Yaxshi prezentatsiya uchun barcha kerakli narsalar',
      features: [
        [['#7aa6ff', '#a07cff'], 'sparkle', 'Buyruqdan PPTgacha', 'Oddiy fikrdan to‘liq prezentatsiya yarating.'],
        [['#5fb8ff', '#7aa6ff'], 'fileLines', 'Hujjatdan slaydlarga', 'PDF, Word fayllar, matnlar va URL manzillarni tarkibli slaydlarga aylantiring.'],
        [['#c47cff', '#f07fc0'], 'palette', 'AI dizayn tizimi', 'Zamonaviy layoutlar, ranglar, ikonkalar va vizual iyerarxiyani avtomatik qo‘llaydi.'],
        [['#ff9f7a', '#f07fc0'], 'download', 'Tahrirlanadigan eksport', 'PowerPoint uchun tayyor, toza va tahrirlanadigan PPTX fayllarni yuklab oling.'],
      ],
      templatesHeading: 'Uslub tanlang. AI prezentatsiyani yasasin.', templateMeta: '12 slayd · Tahrirlanadigan PPTX',
      templates: [
        ['Startap prezentatsiyasi', 'cover', '#6aa0ff', '#a780ff', '#f48fc0'],
        ['Biznes hisoboti', 'chart', '#5fb8ff', '#7aa6ff', '#a780ff'],
        ['Tadqiqot prezentatsiyasi', 'bullets', '#a780ff', '#c47cff', '#f48fc0'],
        ['Sotuv taklifi', 'split', '#f48fc0', '#ff9f7a', '#ffb38a'],
        ['Ta’lim ma’ruzasi', 'cover', '#7aa6ff', '#a780ff', '#5fb8ff'],
      ],
      workflowHeading: 'G‘oyadan tayyor prezentatsiyagacha',
      workflow: [
        ['01', 'Yuklang yoki tasvirlang', 'Buyruqdan boshlang yoki PDF, DOCX, URL, rasm yoki matn yuklang.', '#6aa0ff', '#a780ff'],
        ['02', 'AI tuzilma yaratadi', 'Bo‘limlar, slayd sarlavhalari va aniq hikoya oqimi siz uchun tayyorlanadi.', '#a780ff', '#f48fc0'],
        ['03', 'Har bir slaydga dizayn', 'Layoutlar, ikonkalar, grafiklar va vizual iyerarxiya avtomatik qo‘llaniladi.', '#f48fc0', '#ff9f7a'],
        ['04', 'PPTX eksport', 'PowerPoint’da ochishga tayyor, to‘liq tahrirlanadigan prezentatsiyani yuklab oling.', '#ff9f7a', '#6aa0ff'],
      ],
      ctaHeading: 'Keyingi prezentatsiyangizni Make PPT bilan yarating.', ctaSub: 'Kontent yuklang, uslub tanlang va bir necha daqiqada tahrirlanadigan PowerPoint oling.', ctaBtn: 'Birinchi prezentatsiyani yaratish',
    },
    kurs: {
      tab: 'Kurs ishi', accent: '#5fb8ff',
      badge: 'AI kurs ishi yozuvchisi', titleLead: 'To‘liq ', titleEmph: 'kurs ishingiz yozildi.',
      subtitle: 'Mavzu va manbalaringizni tuzilgan kurs ishiga aylantiring — titul varag‘i, boblar va manbalar — tahrirlanadigan Word hujjati sifatida.',
      primaryBtn: 'Hujjat yaratish', footline: 'Tuzilgan boblar · Avtomatik iqtiboslar · Tahrirlanadigan DOCX eksport',
      flowTitle: 'Kurs ishi jarayoni', promptText: 'Markaziy Osiyoda qayta tiklanuvchi energiya joriy qilinishi bo‘yicha 25 sahifali kurs ishi yozing',
      generateLabel: 'Yaratish',
      uploads: [['PDF', '#e85c5c', 'file'], ['DOCX', '#3b82f6', 'fileLines'], ['URL', '#0ea5a3', 'link']],
      fields: [['Fan', 'Energiya iqtisodiyoti'], ['Universitet', 'Milliy universitet'], ['Rahbar', 'Karimov'], ['Sahifalar', '25'], ['Boblar', '3']],
      categories: ['Muhandislik', 'Iqtisod', 'Informatika', 'Pedagogika', 'Huquq', 'Tibbiyot', 'Filologiya'],
      flow: [
        ['text', 'Mavzu va tavsif', 'Fan, rahbar, sahifa va tuzilmani belgilang', '09:10', 'Tavsif saqlandi', 'Ishga tushdi: {Manbalar yuklandi}'],
        ['upload', 'Manba yuklash', 'Manba PDF, DOCX, ma’ruza matnlari yoki URL qo‘shing', '09:11', 'Manbalar tahlil qilindi', 'Ishga tushdi: {AI boblar rejasini yaratadi}'],
        ['list', 'Boblar rejasi', 'Titul, kirish, boblar, xulosa, manbalar', '09:12', 'Reja tayyor', 'Ishga tushdi: {Qoralama tasdiqlandi}'],
        ['pen', 'Yozish va iqtibos', 'Har bir bob yozildi va matn ichidagi iqtiboslar qo‘yildi', '09:14', 'Qoralama va manbalar tayyor', null],
        ['download', 'Eksport', 'Formatlangan, tahrirlanadigan Word hujjati yuklab olindi', '09:15', 'DOCX tayyor', null],
      ],
      featuresHeading: 'Kuchli kurs ishi uchun barcha kerakli narsalar',
      features: [
        [['#5fb8ff', '#7aa6ff'], 'grad', 'Mavzudan hujjatga', 'Fan va tavsifdan to‘liq kurs ishi yarating.'],
        [['#7aa6ff', '#a07cff'], 'list', 'Avto boblar va bo‘limlar', 'Titul, kirish, boblar, xulosa — siz uchun tuzilgan.'],
        [['#c47cff', '#f07fc0'], 'check', 'Iqtiboslar va manbalar', 'Matn ichidagi iqtiboslar va manbalar ro‘yxati manbalaringiz asosida tuziladi.'],
        [['#ff9f7a', '#f07fc0'], 'download', 'Tahrirlanadigan DOCX', 'Format qilib topshirishga tayyor Word hujjati.'],
      ],
      templatesHeading: 'Tuzilma tanlang. AI kurs ishini yozsin.', templateMeta: '25 sahifa · Tahrirlanadigan DOCX',
      templates: [
        ['Standart kurs ishi', 'split', '#5fb8ff', '#7aa6ff', '#a780ff'],
        ['Laboratoriya hisoboti', 'chart', '#6aa0ff', '#5fb8ff', '#7aa6ff'],
        ['Semestrlik ish', 'bullets', '#7aa6ff', '#a780ff', '#c47cff'],
        ['Amaliy misol', 'split', '#a780ff', '#c47cff', '#f48fc0'],
        ['Adabiyot sharhi', 'bullets', '#c47cff', '#f48fc0', '#ff9f7a'],
      ],
      workflowHeading: 'Mavzudan topshirilgan ishgacha',
      workflow: [
        ['01', 'Tavsifni tuzing', 'Fan, rahbar, sahifa va boblarni kiriting.', '#5fb8ff', '#7aa6ff'],
        ['02', 'AI reja yaratadi', 'Titul, kirish, boblar, xulosa va manbalar rejalashtiriladi.', '#7aa6ff', '#a07cff'],
        ['03', 'Yozish va iqtibos', 'Har bir bob yoziladi va iqtiboslar avtomatik qo‘yiladi.', '#a07cff', '#f48fc0'],
        ['04', 'DOCX eksport', 'Topshirishga tayyor Word hujjatini yuklab oling.', '#f48fc0', '#5fb8ff'],
      ],
      ctaHeading: 'Keyingi kurs ishingizni AI bilan yozing.', ctaSub: 'Tavsifni belgilang, manbalar qo‘shing va bir necha daqiqada tahrirlanadigan Word hujjatini oling.', ctaBtn: 'Birinchi kurs ishini yaratish',
    },
    mustaqil: {
      tab: 'Mustaqil ish', accent: '#f07fc0',
      badge: 'AI mustaqil ish generatoriI', titleLead: 'Sizning ', titleEmph: 'mustaqil ishingiz tayyor.',
      subtitle: 'Mavzu yoki materiallardan mustaqil ish (mustaqil ish) yarating — tuzilgan, formatlangan va topshirishga tayyor tahrirlanadigan hujjat sifatida.',
      primaryBtn: 'Ish yaratish', footline: 'Aniq tuzilma · To‘g‘ri format · Tahrirlanadigan DOCX eksport',
      flowTitle: 'Mustaqil ish jarayoni', promptText: 'Ma’lumotlar bazasi normalizatsiyasi bo‘yicha misollar bilan mustaqil ish tayyorlang',
      generateLabel: 'Ish yaratish',
      uploads: [['PDF', '#e85c5c', 'file'], ['DOCX', '#3b82f6', 'fileLines'], ['URL', '#0ea5a3', 'link']],
      fields: [['Fan', 'Ma’lumotlar bazalari'], ['Mavzu', 'Normalizatsiya'], ['Sahifalar', '8'], ['Format', ['Esse', 'Hisobot', 'Masalalar', 'Konspekt']]],
      categories: ['Esse', 'Hisobot', 'Masalalar', 'Konspekt', 'Sharh', 'Ma’ruza matni'],
      flow: [
        ['text', 'Mavzu va tavsif', 'Fan, mavzu, hajm va formatni belgilang', '14:02', 'Tavsif saqlandi', 'Ishga tushdi: {Materiallar yuklandi}'],
        ['upload', 'Manba yuklash', 'Ma’ruza matni, PDF, DOCX yoki URL qo‘shing', '14:03', 'Materiallar tahlil qilindi', 'Ishga tushdi: {AI reja tuzadi}'],
        ['list', 'Reja', 'Sarlavhalar va bo‘limlar rejalashtirildi', '14:03', 'Reja tayyor', 'Ishga tushdi: {Qoralama tasdiqlandi}'],
        ['pen', 'Yozish va formatlash', 'Kontent yozildi va standart bo‘yicha formatlandi', '14:05', 'Qoralama formatlandi', null],
        ['download', 'Eksport', 'Topshirishga tayyor tahrirlanadigan hujjat yuklab olindi', '14:06', 'DOCX tayyor', null],
      ],
      featuresHeading: 'Mustaqil ishingiz uchun barcha kerakli narsalar',
      features: [
        [['#f07fc0', '#ff9f7a'], 'book', 'Mavzudan ishga', 'Mavzuni to‘liq mustaqil ishga aylantiring.'],
        [['#a07cff', '#f07fc0'], 'list', 'Tuzilgan bo‘limlar', 'Aniq sarlavhalar, bo‘limlar va mantiqiy oqim siz uchun tayyor.'],
        [['#7aa6ff', '#a07cff'], 'pen', 'Standart format', 'Oraliqlar, sarlavhalar va layout topshirish talablariga mos formatlangan.'],
        [['#5fb8ff', '#7aa6ff'], 'download', 'Tahrirlanadigan DOCX', 'O‘zgartirib topshirsa bo‘ladigan toza hujjat.'],
      ],
      templatesHeading: 'Format tanlang. AI ish tayyorlasin.', templateMeta: '8 sahifa · Tahrirlanadigan DOCX',
      templates: [
        ['Esse', 'cover', '#f07fc0', '#ff9f7a', '#ffb38a'],
        ['Tuzilgan hisobot', 'split', '#a780ff', '#f48fc0', '#ff9f7a'],
        ['Masalalar to‘plami', 'chart', '#7aa6ff', '#a780ff', '#c47cff'],
        ['Mavzu konspekti', 'bullets', '#5fb8ff', '#7aa6ff', '#a780ff'],
        ['Adabiyot sharhi', 'bullets', '#c47cff', '#f48fc0', '#f07fc0'],
      ],
      workflowHeading: 'Mavzudan tayyor ishga',
      workflow: [
        ['01', 'Tavsifni tuzing', 'Fan, mavzu, hajm va formatni kiriting.', '#f07fc0', '#ff9f7a'],
        ['02', 'AI reja yaratadi', 'Sarlavhalar va bo‘limlar rejalashtiriladi.', '#a07cff', '#f07fc0'],
        ['03', 'Yozish va formatlash', 'Kontent yoziladi va standart bo‘yicha formatlanadi.', '#7aa6ff', '#a07cff'],
        ['04', 'DOCX eksport', 'Bir necha daqiqada topshirishga tayyor hujjatni yuklab oling.', '#5fb8ff', '#7aa6ff'],
      ],
      ctaHeading: 'Mustaqil ishingizni AI bilan tayyorlang.', ctaSub: 'Mavzuni belgilang, materiallar qo‘shing va bir necha daqiqada tahrirlanadigan hujjatni oling.', ctaBtn: 'Birinchi ishni yaratish',
    },
  },
  ru: {
    ppt: {
      tab: 'Презентация', accent: '#a07cff',
      badge: 'Make PPT', titleLead: 'Создайте ', titleEmph: 'PPT.',
      subtitle: 'Превратите подсказки, PDF, документы и ссылки в готовые, редактируемые PowerPoint-презентации за минуты — на make-ppt.com.',
      primaryBtn: 'Создать презентацию', footline: 'AI-структура · Современный дизайн · Редактируемый PPTX',
      flowTitle: 'Процесс презентации', promptText: 'Создайте презентацию из 5 слайдов про будущее электромобилей',
      generateLabel: 'Создать',
      uploads: [['PDF', '#e85c5c', 'file'], ['DOCX', '#3b82f6', 'fileLines'], ['Изображение', '#9333ea', 'image'], ['URL', '#0ea5a3', 'link']],
      fields: [['Слайды', '5'], ['Аудитория', 'Руководители'], ['Тон', ['Профессиональный', 'Свободный', 'Академический', 'Смелый']]],
      categories: ['Питч стартапа', 'Бизнес-отчёт', 'Исследование', 'Образование', 'Коммерческое предложение', 'Портфолио', 'Стратегия'],
      flow: [
        ['text', 'Подсказка', 'Опишите тему, аудиторию и цель', '10:24', 'Подсказка получена', 'Триггер: {Пользователь загружает документ}'],
        ['upload', 'Загрузка источника', 'Добавьте PDF, DOCX, изображение, URL или заметки', '10:24', 'Контент проанализирован', 'Триггер: {AI определяет структуру}'],
        ['sparkle', 'AI-план', 'Разделы, заголовки слайдов и поток истории готовы', '10:25', 'План готов', 'Триггер: {Выбрана тема}'],
        ['palette', 'Дизайн-движок', 'Макеты, иконки, графики и визуал применены', '10:25', 'Дизайн готов', null],
        ['download', 'Экспорт', 'Скачайте полностью редактируемую PowerPoint-презентацию', '10:26', 'PPTX готов', null],
      ],
      featuresHeading: 'Всё, чтобы создавать лучшие презентации',
      features: [
        [['#7aa6ff', '#a07cff'], 'sparkle', 'Из подсказки в PPT', 'Создайте презентацию из простой идеи.'],
        [['#5fb8ff', '#7aa6ff'], 'fileLines', 'Из документа в слайды', 'Превратите PDF, Word, заметки и URL в структурированные слайды.'],
        [['#c47cff', '#f07fc0'], 'palette', 'AI-дизайн', 'Автоматически применяет современные макеты, цвета, иконки и визуальную иерархию.'],
        [['#ff9f7a', '#f07fc0'], 'download', 'Редактируемый экспорт', 'Скачивайте чистые PPTX для PowerPoint.'],
      ],
      templatesHeading: 'Выберите стиль. AI соберёт презентацию.', templateMeta: '12 слайдов · Редактируемый PPTX',
      templates: [
        ['Питч стартапа', 'cover', '#6aa0ff', '#a780ff', '#f48fc0'],
        ['Бизнес-отчёт', 'chart', '#5fb8ff', '#7aa6ff', '#a780ff'],
        ['Исследование', 'bullets', '#a780ff', '#c47cff', '#f48fc0'],
        ['Коммерческое предложение', 'split', '#f48fc0', '#ff9f7a', '#ffb38a'],
        ['Лекция', 'cover', '#7aa6ff', '#a780ff', '#5fb8ff'],
      ],
      workflowHeading: 'От идеи до готовой презентации',
      workflow: [
        ['01', 'Загрузите или опишите', 'Начните с подсказки или загрузите PDF, DOCX, URL, изображение или заметки.', '#6aa0ff', '#a780ff'],
        ['02', 'AI создаёт структуру', 'Разделы, заголовки и поток истории создаются автоматически.', '#a780ff', '#f48fc0'],
        ['03', 'Дизайн для каждого слайда', 'Макеты, иконки, графики и иерархия применяются автоматически.', '#f48fc0', '#ff9f7a'],
        ['04', 'Экспорт PPTX', 'Скачайте чистую презентацию, готовую к открытию в PowerPoint.', '#ff9f7a', '#6aa0ff'],
      ],
      ctaHeading: 'Создайте следующую презентацию с Make PPT.', ctaSub: 'Загрузите материал, выберите стиль и получите редактируемый PowerPoint за минуты.', ctaBtn: 'Создать первую презентацию',
    },
    kurs: {
      tab: 'Курсовая', accent: '#5fb8ff',
      badge: 'AI-автор курсовых', titleLead: 'Ваша готовая ', titleEmph: 'курсовая работа.',
      subtitle: 'Превратите тему и источники в структурированную курсовую — титульный лист, главы и список литературы — как редактируемый Word.',
      primaryBtn: 'Создать документ', footline: 'Структурированные главы · Авто-цитаты · Редактируемый DOCX',
      flowTitle: 'Процесс курсовой', promptText: 'Напишите курсовую на 25 страниц о внедрении возобновляемой энергии в Центральной Азии',
      generateLabel: 'Создать документ',
      uploads: [['PDF', '#e85c5c', 'file'], ['DOCX', '#3b82f6', 'fileLines'], ['URL', '#0ea5a3', 'link']],
      fields: [['Предмет', 'Экономика энергии'], ['ВУЗ', 'Национальный университет'], ['Научрук', 'Каримов'], ['Страниц', '25'], ['Глав', '3']],
      categories: ['Инженерия', 'Экономика', 'Информатика', 'Педагогика', 'Право', 'Медицина', 'Филология'],
      flow: [
        ['text', 'Тема и бриф', 'Задайте предмет, научрука, объём и структуру', '09:10', 'Бриф сохранён', 'Триггер: {Источники загружены}'],
        ['upload', 'Загрузка источников', 'Добавьте PDF, DOCX, конспекты или URL', '09:11', 'Источники проанализированы', 'Триггер: {AI строит план глав}'],
        ['list', 'План глав', 'Титул, введение, главы, заключение, литература', '09:12', 'План готов', 'Триггер: {Черновик утверждён}'],
        ['pen', 'Черновик и цитаты', 'Каждая глава написана, внутритекстовые ссылки вставлены', '09:14', 'Черновик и ссылки готовы', null],
        ['download', 'Экспорт', 'Скачайте отформатированный редактируемый Word', '09:15', 'DOCX готов', null],
      ],
      featuresHeading: 'Всё для сильной курсовой',
      features: [
        [['#5fb8ff', '#7aa6ff'], 'grad', 'Из темы в документ', 'Создайте полную курсовую из предмета и брифа.'],
        [['#7aa6ff', '#a07cff'], 'list', 'Авто-главы и разделы', 'Титул, введение, главы, заключение — уже структурированы.'],
        [['#c47cff', '#f07fc0'], 'check', 'Цитаты и ссылки', 'Внутритекстовые ссылки и список литературы из ваших источников.'],
        [['#ff9f7a', '#f07fc0'], 'download', 'Редактируемый DOCX', 'Чистый Word, готовый к сдаче.'],
      ],
      templatesHeading: 'Выберите структуру. AI напишет работу.', templateMeta: '25 страниц · Редактируемый DOCX',
      templates: [
        ['Стандартная курсовая', 'split', '#5fb8ff', '#7aa6ff', '#a780ff'],
        ['Лабораторный отчёт', 'chart', '#6aa0ff', '#5fb8ff', '#7aa6ff'],
        ['Семестровая работа', 'bullets', '#7aa6ff', '#a780ff', '#c47cff'],
        ['Кейс-стади', 'split', '#a780ff', '#c47cff', '#f48fc0'],
        ['Обзор литературы', 'bullets', '#c47cff', '#f48fc0', '#ff9f7a'],
      ],
      workflowHeading: 'От темы до сданной работы',
      workflow: [
        ['01', 'Задайте бриф', 'Предмет, научрук, объём и требуемые главы.', '#5fb8ff', '#7aa6ff'],
        ['02', 'AI строит план', 'Титул, введение, главы, заключение и литература.', '#7aa6ff', '#a07cff'],
        ['03', 'Черновик и цитаты', 'Каждая глава пишется, цитаты вставляются автоматически.', '#a07cff', '#f48fc0'],
        ['04', 'Экспорт DOCX', 'Скачайте Word, готовый к сдаче.', '#f48fc0', '#5fb8ff'],
      ],
      ctaHeading: 'Напишите курсовую с AI.', ctaSub: 'Задайте бриф, добавьте источники и получите редактируемый Word за минуты.', ctaBtn: 'Создать первую курсовую',
    },
    mustaqil: {
      tab: 'Самостоятельная', accent: '#f07fc0',
      badge: 'AI-генератор самостоятельных', titleLead: 'Ваша ', titleEmph: 'самостоятельная работа готова.',
      subtitle: 'Создавайте самостоятельные работы из темы или материалов — структурированные, отформатированные и готовые к сдаче как редактируемый документ.',
      primaryBtn: 'Создать работу', footline: 'Чёткая структура · Правильный формат · Редактируемый DOCX',
      flowTitle: 'Процесс самостоятельной работы', promptText: 'Подготовьте самостоятельную работу по нормализации баз данных с примерами',
      generateLabel: 'Создать работу',
      uploads: [['PDF', '#e85c5c', 'file'], ['DOCX', '#3b82f6', 'fileLines'], ['URL', '#0ea5a3', 'link']],
      fields: [['Предмет', 'Базы данных'], ['Тема', 'Нормализация'], ['Страниц', '8'], ['Формат', ['Эссе', 'Отчёт', 'Задачи', 'Конспект']]],
      categories: ['Эссе', 'Отчёт', 'Задачи', 'Конспект', 'Обзор', 'Лекция'],
      flow: [
        ['text', 'Тема и бриф', 'Задайте предмет, тему, объём и формат', '14:02', 'Бриф сохранён', 'Триггер: {Материалы загружены}'],
        ['upload', 'Загрузка источников', 'Добавьте конспекты, PDF, DOCX или URL', '14:03', 'Материалы проанализированы', 'Триггер: {AI строит план}'],
        ['list', 'План', 'Заголовки и разделы работы запланированы', '14:03', 'План готов', 'Триггер: {Черновик утверждён}'],
        ['pen', 'Написание и формат', 'Контент написан и отформатирован по стандарту', '14:05', 'Черновик оформлен', null],
        ['download', 'Экспорт', 'Скачайте редактируемый документ, готовый к сдаче', '14:06', 'DOCX готов', null],
      ],
      featuresHeading: 'Всё для вашей самостоятельной работы',
      features: [
        [['#f07fc0', '#ff9f7a'], 'book', 'Из темы в работу', 'Тема превращается в готовую самостоятельную.'],
        [['#a07cff', '#f07fc0'], 'list', 'Структурированные разделы', 'Ясные заголовки, разделы и логический поток.'],
        [['#7aa6ff', '#a07cff'], 'pen', 'Стандартный формат', 'Отступы, заголовки и макет по требованиям.'],
        [['#5fb8ff', '#7aa6ff'], 'download', 'Редактируемый DOCX', 'Чистый документ, который можно доработать и сдать.'],
      ],
      templatesHeading: 'Выберите формат. AI подготовит работу.', templateMeta: '8 страниц · Редактируемый DOCX',
      templates: [
        ['Эссе', 'cover', '#f07fc0', '#ff9f7a', '#ffb38a'],
        ['Структурированный отчёт', 'split', '#a780ff', '#f48fc0', '#ff9f7a'],
        ['Задачи', 'chart', '#7aa6ff', '#a780ff', '#c47cff'],
        ['Конспект темы', 'bullets', '#5fb8ff', '#7aa6ff', '#a780ff'],
        ['Обзор литературы', 'bullets', '#c47cff', '#f48fc0', '#f07fc0'],
      ],
      workflowHeading: 'От темы до готовой работы',
      workflow: [
        ['01', 'Задайте бриф', 'Введите предмет, тему, объём и формат.', '#f07fc0', '#ff9f7a'],
        ['02', 'AI строит план', 'Заголовки и разделы вашего задания.', '#a07cff', '#f07fc0'],
        ['03', 'Написание и формат', 'Контент пишется и оформляется по стандарту.', '#7aa6ff', '#a07cff'],
        ['04', 'Экспорт DOCX', 'Скачайте документ, готовый к сдаче.', '#5fb8ff', '#7aa6ff'],
      ],
      ctaHeading: 'Подготовьте самостоятельную работу с AI.', ctaSub: 'Задайте тему, добавьте материалы и получите редактируемый документ за минуты.', ctaBtn: 'Создать первую работу',
    },
  },
}

/** Get the product config map for a given language, falling back to English. */
export function getProducts(lang: Lang): Record<ProductId, ProductConfig> {
  return PRODUCTS_BY_LANG[lang] || PRODUCTS_BY_LANG.en
}

/** English default — kept for code paths that don't have a Lang in hand. */
export const PRODUCTS: Record<ProductId, ProductConfig> = PRODUCTS_BY_LANG.en

export const PRODUCT_IDS: ProductId[] = ['ppt', 'kurs', 'mustaqil']

/** Public URL path for each product. Presentation stays at `/`. */
export const PRODUCT_PATHS: Record<ProductId, string> = {
  ppt: '/',
  kurs: '/kurs',
  mustaqil: '/mustaqil',
}

/** Absolute href including Vite `base` (e.g. `/v2/kurs`). */
export function productHref(id: ProductId): string {
  const base = ((import.meta as any).env?.BASE_URL || '/').replace(/\/$/, '') || ''
  const path = PRODUCT_PATHS[id]
  if (path === '/') return `${base}/` || '/'
  return `${base}${path}`
}

/** Resolve product from the current browser pathname (ignores non-product routes). */
export function productFromPath(pathname: string): ProductId {
  const base = ((import.meta as any).env?.BASE_URL || '/').replace(/\/$/, '')
  let path = pathname
  if (base && path.startsWith(base)) path = path.slice(base.length) || '/'
  if (!path.startsWith('/')) path = `/${path}`
  const clean = path.replace(/\/+$/, '') || '/'
  if (clean === '/kurs') return 'kurs'
  if (clean === '/mustaqil') return 'mustaqil'
  return 'ppt'
}

export function typeMeta(type: ProductId, lang: Lang = 'en'): { label: string; accent: string; icon: string; fmt: string } {
  const products = getProducts(lang)
  const m: Record<ProductId, { label: string; accent: string; icon: string; fmt: string }> = {
    ppt: { label: products.ppt.tab, accent: '#a07cff', icon: 'sparkle', fmt: 'PPTX' },
    kurs: { label: products.kurs.tab, accent: '#5fb8ff', icon: 'grad', fmt: 'DOCX' },
    mustaqil: { label: products.mustaqil.tab, accent: '#f07fc0', icon: 'book', fmt: 'DOCX' },
  }
  return m[type]
}
