/**
 * Class 10 — 2026-27 session. Class 10 continues with the RATIONALIZED
 * NCERT textbooks (the NCF-SE class 10 generation is expected in 2027-28).
 *
 * Books (verified):
 *   • Mathematics — NCERT Class X (14 chapters, CBSE unit-wise)
 *   • Science — NCERT Class X (13 chapters, CBSE units I–V)
 *   • Social Science — 4 rationalized books (History 5 + Geography 7 +
 *     Civics 5 + Economics 5)
 *   • English — First Flight (9 prose + 10 poems) + Footprints Without Feet (9)
 *   • हिंदी — स्पर्श-2 (गद्य 5 + काव्य 6) + व्याकरण एवं लेखन
 *   • Computer Applications (CBSE 165) — official CBSE units
 */

import type { ClassCurriculum, CurriculumTopicSeed, CurriculumUnitSeed } from '../types'

const t = (name: string, description: string, periods: number): CurriculumTopicSeed => ({
  name,
  description,
  periods,
})
const u = (unitNo: number, unitName: string, topics: CurriculumTopicSeed[]): CurriculumUnitSeed => ({
  unitNo,
  unitName,
  topics,
})

export const CLASS_10: ClassCurriculum = {
  classLevel: 10,
  label: 'Class 10',
  subjects: [
    {
      key: 'mathematics',
      subjectLabel: 'Mathematics',
      bookLabel: 'Mathematics — NCERT (Class 10)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Mathematics — NCERT Class X (Chapters 1–14)', [
          t('Real Numbers', 'Euclid’s division lemma; fundamental theorem of arithmetic; irrationality of √2, √3, √5.', 8),
          t('Polynomials', 'Zeroes and coefficients; division algorithm.', 8),
          t('Pair of Linear Equations in Two Variables', 'Graphical and algebraic methods; consistency conditions.', 12),
          t('Quadratic Equations', 'Factorisation and formula; discriminant and nature of roots.', 12),
          t('Arithmetic Progressions', 'nth term and sum of n terms; applications.', 10),
          t('Triangles', 'Similarity; BPT and its applications.', 12),
          t('Coordinate Geometry', 'Distance and section formula; area of a triangle.', 10),
          t('Introduction to Trigonometry', 'Ratios, standard angles and identities.', 12),
          t('Some Applications of Trigonometry', 'Heights and distances.', 8),
          t('Circles', 'Tangent properties; tangents from an external point.', 8),
          t('Areas Related to Circles', 'Sector and segment areas; combinations of figures.', 8),
          t('Surface Areas and Volumes', 'Combinations of solids; conversion of solids.', 10),
          t('Statistics', 'Mean of grouped data; median and mode.', 10),
          t('Probability', 'Theoretical probability; simple problems.', 8),
        ]),
      ],
    },
    {
      key: 'science',
      subjectLabel: 'Science',
      bookLabel: 'Science — NCERT (Class 10)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Unit I — Chemical Substances: Nature and Behaviour', [
          t('Chemical Reactions and Equations', 'Writing and balancing equations; types of reactions.', 10),
          t('Acids, Bases and Salts', 'Reactions, pH and the chemistry of common salts.', 10),
          t('Metals and Non-metals', 'Properties; reactivity series; extraction of metals.', 10),
          t('Carbon and its Compounds', 'Covalent bonding; homologous series; ethanol, ethanoic acid, soaps.', 12),
        ]),
        u(2, 'Unit II — World of Living', [
          t('Life Processes', 'Nutrition, respiration, transportation and excretion.', 12),
          t('Control and Coordination', 'Nervous system; hormones; plant responses.', 10),
          t('How do Organisms Reproduce', 'Asexual and sexual reproduction in plants and humans.', 10),
          t('Heredity', 'Mendel’s contributions; sex determination.', 8),
        ]),
        u(3, 'Unit III — Natural Phenomena', [
          t('Light — Reflection and Refraction', 'Mirrors and lenses; ray diagrams; formulae and power.', 12),
          t('The Human Eye and the Colourful World', 'Defects of vision; dispersion and scattering.', 8),
        ]),
        u(4, 'Unit IV — Effects of Current', [
          t('Electricity', 'Current, potential difference; Ohm’s law; heating and power.', 12),
          t('Magnetic Effects of Electric Current', 'Magnetic fields; motors; domestic circuits.', 10),
        ]),
        u(5, 'Unit V — Natural Resources', [
          t('Our Environment', 'Ecosystems, food chains; ozone; waste management.', 6),
        ]),
      ],
    },
    {
      key: 'social-science',
      subjectLabel: 'Social Science',
      bookLabel: 'Social Science — NCERT (Class 10, rationalized)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'History — India and the Contemporary World II', [
          t('The Rise of Nationalism in Europe', 'Frankfurt parliament; unification of Germany and Italy.', 10),
          t('Nationalism in India', 'Satyagraha; civil disobedience; collective belonging.', 12),
          t('The Making of a Global World', 'Silk routes; the Great Depression; Bretton Woods.', 10),
          t('The Age of Industrialisation', 'Factory production; labour; industrial economy.', 8),
          t('Print Culture and the Modern World', 'Print revolution; print in India.', 8),
        ]),
        u(2, 'Geography — Contemporary India II', [
          t('Resources and Development', 'Classification of resources; soil erosion and conservation.', 8),
          t('Forest and Wildlife Resources', 'Biodiversity; conservation efforts.', 6),
          t('Water Resources', 'Multipurpose projects; rainwater harvesting.', 6),
          t('Agriculture', 'Cropping patterns; institutional reforms; food security.', 8),
          t('Minerals and Energy Resources', 'Distribution of minerals; conventional and non-conventional energy.', 8),
          t('Manufacturing Industries', 'Classification; industrial location; pollution.', 6),
          t('Lifelines of National Economy', 'Roadways, railways, ports and international trade.', 6),
        ]),
        u(3, 'Civics — Democratic Politics II', [
          t('Power Sharing', 'Belgium and Sri Lanka; forms of power sharing.', 6),
          t('Federalism', 'Union and state lists; decentralisation in India.', 8),
          t('Gender, Religion and Caste', 'Public/private division; communalism; caste in politics.', 8),
          t('Political Parties', 'Functions; national and state parties; challenges.', 8),
          t('Outcomes of Democracy', 'Accountability; economic growth and inequality.', 6),
        ]),
        u(4, 'Economics — Understanding Economic Development', [
          t('Development', 'Income and other criteria; sustainability.', 6),
          t('Sectors of the Indian Economy', 'Primary to tertiary; organised vs unorganised.', 8),
          t('Money and Credit', 'Money as medium; formal vs informal credit; SHGs.', 8),
          t('Globalisation and the Indian Economy', 'MNCs; fair globalisation.', 8),
          t('Consumer Rights', 'Consumer protection and awareness.', 6),
        ]),
      ],
    },
    {
      key: 'english',
      subjectLabel: 'English',
      bookLabel: 'First Flight & Footprints Without Feet — NCERT (Class 10)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Prose — First Flight', [
          t('A Letter to God', 'Lencho’s faith; irony and inference.', 7),
          t('Nelson Mandela: Long Walk to Freedom', 'Apartheid; inauguration day; courage and love.', 7),
          t('Two Stories about Flying', 'The young seagull and the black aeroplane.', 7),
          t('From the Diary of Anne Frank', 'Diary form; classroom anecdote.', 7),
          t('Glimpses of India', 'A baker from Goa; Coorg; tea from Assam.', 7),
          t('Mijbil the Otter', 'Gavin Maxwell’s narrative of human-animal bonding.', 6),
          t('Madam Rides the Bus', 'Valli’s curiosity and independence.', 6),
          t('The Sermon at Benares', 'Buddha’s enlightenment; Kisa Gotami’s grief.', 6),
          t('The Proposal (Play)', 'Chekhov’s one-act farce.', 7),
        ]),
        u(2, 'Poetry — First Flight', [
          t('Dust of Snow', 'Frost — a small moment that changes the mood.', 4),
          t('Fire and Ice', 'Frost on desire and hatred.', 4),
          t('A Tiger in the Zoo', 'Captivity vs freedom.', 4),
          t('How to Tell Wild Animals', 'Carolyn Wells’ humorous verse.', 4),
          t('The Ball Poem', 'Loss and responsibility.', 4),
          t('Amanda!', 'Escapism in adolescence.', 4),
          t('The Trees', 'Adrienne Rich — imagery of freedom.', 4),
          t('Fog', 'Carl Sandburg — the fog as a cat.', 3),
          t('The Tale of Custard the Dragon', 'Ogden Nash’s ballad.', 5),
          t('For Anne Gregory', 'Yeats on beauty and inner worth.', 4),
        ]),
        u(3, 'Supplementary — Footprints Without Feet', [
          t('A Triumph of Surgery', 'James Herriot’s rich Pomeranian.', 5),
          t("The Thief's Story", 'Ruskin Bond on trust and change of heart.', 5),
          t('The Midnight Visitor', 'Ausable outwits a rival without violence.', 5),
          t('A Question of Trust', 'Horace Danby and the lady in red.', 5),
          t('Footprints Without Feet', 'The invisible scientist Griffin.', 5),
          t('The Making of a Scientist', 'Richard Ebright’s curiosity-driven journey.', 5),
          t('The Necklace', 'Guy de Maupassant on vanity and its price.', 6),
          t('Bholi', 'K.A. Abbas on education and dignity.', 6),
          t('The Book That Saved the Earth', 'A science-fiction play.', 6),
        ]),
        u(4, 'Writing Skills and Grammar', [
          t('Formal Letters', 'Letters of inquiry, complaint and application.', 8),
          t('Analytical Paragraphs', 'Data-based analytical writing.', 8),
          t('Grammar — Tenses, Determiners, Reported Speech', 'Gap-filling, transformation and editing practice.', 8),
        ]),
      ],
    },
    {
      key: 'hindi',
      subjectLabel: 'Hindi',
      bookLabel: 'स्पर्श-2 — NCERT हिंदी (कक्षा 10, हिंदी बी)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'काव्य खंड — स्पर्श-2 (पाठ 1–7)', [
          t('साखियाँ (कबीर)', 'ज्ञान और अहंकार की साखियाँ।', 5),
          t('पद (मीरा)', 'कृष्ण-प्रेम के पद।', 5),
          t('दोहे (बिहारी)', 'भक्ति और शृंगार के दोहे।', 5),
          t('मनुष्यता (मैथिलीशरण गुप्त)', 'परोपकार का संदेश।', 6),
          t('पर्वत प्रदेश में पावस (सुमित्रानंदन पंत)', 'प्रकृति-काव्य; मानवीकरण।', 6),
          t('तोप (वीरेन डंगवाल)', '1857 की तोप और स्वतंत्रता।', 6),
          t('कर चले हम फ़िदा (कैफ़ी आज़मी)', 'बलिदान का संकल्प।', 5),
        ]),
        u(2, 'गद्य खंड — स्पर्श-2 (पाठ 8–15)', [
          t('बड़े भाई साहब (प्रेमचंद)', 'अध्ययन और खेल का तानाबाना।', 8),
          t('डायरी का एक पन्ना (सीताराम सेकसरिया)', 'सिक्किम-यात्रा का सजीव वृत्तांत।', 7),
          t('तताँरा-वामीरो कथा (लीलाधर मंडलोई)', 'निकोबारी लोक-कथा; संवेदना और अंधविश्वास।', 8),
          t('तीसरी कसम के शिल्पकार शैलेंद्र', 'कवि की रचना-दृष्टि पर साक्षात्कार।', 7),
          t('गिरगिट (चेखव)', 'अवसरवादिता पर अद्भुत व्यंग्य।', 8),
          t('अब कहाँ दूसरे के दुख से दुखी होने वाले (नागार्जुन)', 'संवेदनशीलता की साख।', 7),
          t('पतझर में टूटी पत्तियाँ (रवींद्र केलेकर)', 'चिड़िया की दृष्टि से संवेदनाओं का चित्रण।', 7),
          t('कारतूस (गुरदयाल सिंह)', 'कथा-साहित्य की विरासत।', 7),
        ]),
        u(3, 'व्याकरण एवं लेखन', [
          t('वाच्य, पद परिचय एवं रस', 'वाच्य-परिवर्तन; पद परिचय; रस-निरूपण।', 10),
          t('अलंकार एवं समास', 'अनुप्रास, उपमा, रूपक; समास-भेद और विग्रह।', 10),
          t('अपठित गद्यांश', 'अर्थ-ग्रहण का अभ्यास।', 8),
          t('पत्र-लेखन एवं संक्षेपण', 'औपचारिक पत्र; गद्यांश संक्षेपण।', 8),
        ]),
      ],
    },
    {
      key: 'computer-applications',
      subjectLabel: 'Computer Applications',
      bookLabel: 'Computer Applications — CBSE (Code 165, Class 10)',
      sourceBoard: 'CBSE-2026-27',
      units: [
        u(1, 'Unit 1 — Networking', [
          t('Internet and the World Wide Web', 'Web servers, clients, websites, pages; browsers, blogs, newsgroups.', 8),
          t('Web Addresses and Services', 'URLs, HTTP; e-mail; internet services.', 6),
        ]),
        u(2, 'Unit 2 — HTML', [
          t('HTML Basics — Structure and Tags', 'Document structure; head and body; essential tags.', 10),
          t('Working with Links, Lists, Tables and Images', 'Anchors; ordered/unordered lists; tables; embedding images.', 10),
          t('Forms in HTML', 'Form controls and their attributes.', 8),
          t('Cascading Style Sheets (CSS)', 'Inline, internal and external CSS; styling text and layout.', 10),
        ]),
        u(3, 'Unit 3 — Cyber Ethics', [
          t('Digital Footprint and Netiquette', 'Netiquette; digital footprint; safe posting.', 6),
          t('Cyber Safety Best Practices', 'Strong passwords; safe communication; protecting personal data.', 6),
        ]),
        u(4, 'Unit 4 — Practicals', [
          t('Lab Practice — Website Development', 'Hands-on labs: HTML pages with CSS and forms.', 12),
        ]),
      ],
    },
  ],
}
