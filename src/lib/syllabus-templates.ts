/**
 * syllabus-templates — the master board-syllabus library behind the Lesson
 * Planner's "the plan is already there" promise (LP-2 upgrade).
 *
 * WHAT THIS IS
 *   A registry of complete-session board curricula (units → topics with
 *   realistic period estimates). When a school adopts a class+subject that
 *   has no CurriculumTopic rows yet, the Lesson Planner AUTO-FEEDS the full
 *   session plan from the matching board template (school.board decides the
 *   board: CBSE / UP_BOARD). Teachers can then merge any template topics
 *   they are missing, or add their own topics on top.
 *
 * CONTENT POLICY (same as prisma/curriculum-data.ts)
 *   NEVER AI-filler: CBSE 9–10 reuse the rationalized NCERT structures the
 *   demo school was seeded from (imported verbatim so name-matching during
 *   "merge missing" is exact); middle school (6–8) mirrors the NCERT
 *   chapter lists; UP Board follows the NCERT-based UPMSP syllabus
 *   (Math/Science/SST/English share the NCERT chapters — Science is the
 *   combined विज्ञान — while Hindi carries the UP-board गोधूलि structure).
 *
 * Client-safe: no DB, no Next imports.
 */

import { CURRICULUM_SEED, type CurriculumSeedTopic } from '../../prisma/curriculum-data'

// ─── Types ───────────────────────────────────────────────────────────────

export type TemplateBoard = 'CBSE' | 'UP_BOARD'

export type SubjectKey =
  | 'mathematics'
  | 'science'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'english'
  | 'hindi'
  | 'social-science'
  | 'computer'

export interface SyllabusTopicSeed {
  unitNo: number
  unitName: string
  topicName: string
  description: string
  periodsNeeded: number
}

export interface SyllabusUnitSummary {
  unitNo: number
  unitName: string
  topicCount: number
}

export interface SyllabusTemplate {
  board: TemplateBoard
  classLevel: number
  subjectKey: SubjectKey
  /** Display label, e.g. "Mathematics" or "विज्ञान (Science)" */
  subjectLabel: string
  /** Book / source label, e.g. "Mathematics — NCERT (CBSE)" */
  bookLabel: string
  /** Persisted per-topic sourceBoard, e.g. "CBSE-2026" */
  sourceBoard: string
  units: SyllabusUnitSummary[]
  topics: SyllabusTopicSeed[]
}

/** Board badge labels for the UI. */
export const BOARD_LABELS: Record<TemplateBoard, string> = {
  CBSE: 'CBSE — NCERT',
  UP_BOARD: 'UP Board — UPMSP',
}

// ─── Matching helpers ────────────────────────────────────────────────────

/** Lowercase, strip punctuation, collapse whitespace — Unicode-aware.
 *  Keeps combining marks (\p{M}) so Devanagari matras/conjuncts survive
 *  (विज्ञान stays विज्ञान, not "व ज ञ न"). */
export function normalizeTopicName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim()
}

const SUBJECT_ALIASES: [SubjectKey, string[]][] = [
  ['mathematics', ['mathematics', 'math', 'maths', 'गणित', 'ganit']],
  ['science', ['science', 'general science', 'विज्ञान', 'vigyan']],
  ['physics', ['physics', 'भौतिकी', 'भौतिक विज्ञान']],
  ['chemistry', ['chemistry', 'रसायन', 'रसायन विज्ञान']],
  ['biology', ['biology', 'bio', 'जीव विज्ञान', 'जीवविज्ञान']],
  ['english', ['english', 'अंग्रेजी', 'अंग्रेज़ी', 'eng']],
  ['hindi', ['hindi', 'हिंदी', 'हिन्दी']],
  ['social-science', ['social science', 'social studies', 'sst', 's.st', 's social', 'सामाजिक विज्ञान', 'इतिहास', 'भूगोल']],
  ['computer', ['computer', 'computer applications', 'computer science', 'it', 'information technology', 'कंप्यूटर', 'आईटी']],
]

/** "Physics" / "विज्ञान" / "Social Science" → subject key. Exact alias
 *  matches win over prefix/suffix matches so सामाजिक विज्ञान (Social
 *  Science) never mis-hits विज्ञान (Science). */
export function subjectKeyFor(subjectName: string): SubjectKey | null {
  const n = normalizeTopicName(subjectName)
  if (!n) return null
  for (const [key, aliases] of SUBJECT_ALIASES) {
    if (aliases.some((a) => n === a)) return key
  }
  for (const [key, aliases] of SUBJECT_ALIASES) {
    if (aliases.some((a) => n.startsWith(`${a} `) || n.endsWith(` ${a}`))) return key
  }
  return null
}

const ROMAN: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12,
}

/** "Grade 9 - A" / "Class 10 B" / "IX-A" / "कक्षा 9" → class level. */
export function classLevelFor(className: string): number | null {
  const digits = className.match(/\d{1,2}/)
  if (digits) {
    const n = Number(digits[0])
    if (n >= 1 && n <= 12) return n
  }
  const tokens = className.toUpperCase().split(/[^A-Z]+/).filter(Boolean)
  for (const t of tokens) {
    const r = ROMAN[t]
    if (r) return r
  }
  return null
}

function normalizeBoard(board: string | null | undefined): TemplateBoard | null {
  switch ((board ?? '').trim().toUpperCase()) {
    case 'CBSE':
      return 'CBSE'
    case 'UP_BOARD':
    case 'UPBOARD':
    case 'UP':
      return 'UP_BOARD'
    default:
      return null
  }
}

// ─── CBSE 9–10 — imported verbatim from the seeded NCERT structures ─────

const CBSE_9_10_KEYS: Record<string, SubjectKey> = {
  Mathematics: 'mathematics',
  Physics: 'physics',
  Chemistry: 'chemistry',
  Biology: 'biology',
  English: 'english',
  'Social Science': 'social-science',
  Hindi: 'hindi',
}

/** Extra revision/assessment topics appended to the seeded CBSE 9–10 plans
 *  so "Add missing topics from the syllabus" has something real to offer. */
const CBSE_ENRICHMENT: Record<string, SyllabusTopicSeed[]> = {
  '9|mathematics': [
    { unitNo: 8, unitName: 'Revision and Assessment', topicName: 'Half-Yearly Revision — Number Systems to Linear Equations', description: 'Consolidated practice; mental-maths drills and previous-year questions.', periodsNeeded: 8 },
    { unitNo: 8, unitName: 'Revision and Assessment', topicName: 'Annual Revision and Sample Papers', description: 'Full-syllabus revision; timed sample-paper practice.', periodsNeeded: 10 },
  ],
  '9|physics': [
    { unitNo: 6, unitName: 'Revision and Assessment', topicName: 'Half-Yearly Revision — Motion and Force', description: 'Graph-based revision; numerical practice on motion and laws of motion.', periodsNeeded: 6 },
    { unitNo: 6, unitName: 'Revision and Assessment', topicName: 'Annual Revision and Sample Papers', description: 'Full-syllabus revision with sample questions.', periodsNeeded: 8 },
  ],
  '9|chemistry': [
    { unitNo: 5, unitName: 'Revision and Assessment', topicName: 'Half-Yearly Revision — Matter and Atoms', description: 'Concept-map revision; symbol/formula drills.', periodsNeeded: 6 },
    { unitNo: 5, unitName: 'Revision and Assessment', topicName: 'Annual Revision and Sample Papers', description: 'Full-syllabus revision with sample questions.', periodsNeeded: 8 },
  ],
  '9|biology': [
    { unitNo: 5, unitName: 'Revision and Assessment', topicName: 'Half-Yearly Revision — Cell and Tissues', description: 'Diagram-based revision; cell-organelle recall drills.', periodsNeeded: 6 },
    { unitNo: 5, unitName: 'Revision and Assessment', topicName: 'Annual Revision and Sample Papers', description: 'Full-syllabus revision with sample questions.', periodsNeeded: 8 },
  ],
  '9|english': [
    { unitNo: 5, unitName: 'Revision and Assessment', topicName: 'Half-Yearly Revision — Reading and Writing Skills', description: 'Timed comprehension and writing practice.', periodsNeeded: 8 },
    { unitNo: 5, unitName: 'Revision and Assessment', topicName: 'Annual Revision and Assessment', description: 'Full-syllabus revision; listening and speaking assessment.', periodsNeeded: 10 },
  ],
  '9|social-science': [
    { unitNo: 5, unitName: 'Revision and Assessment', topicName: 'Half-Yearly Revision — History and Geography', description: 'Timeline and map practice; source-based questions.', periodsNeeded: 10 },
    { unitNo: 5, unitName: 'Revision and Assessment', topicName: 'Annual Revision and Sample Papers', description: 'Full-syllabus revision with sample papers.', periodsNeeded: 10 },
  ],
  '9|hindi': [
    { unitNo: 4, unitName: 'पुनरावृत्ति एवं मूल्यांकन', topicName: 'अर्धवार्षिक पुनरावृत्ति — गद्य एवं काव्य', description: 'पाठों का सार, शब्द-भंडार और प्रश्न-अभ्यास।', periodsNeeded: 8 },
    { unitNo: 4, unitName: 'पुनरावृत्ति एवं मूल्यांकन', topicName: 'वार्षिक पुनरावृत्ति एवं परीक्षा-तैयारी', description: 'पूरे पाठ्यक्रम की पुनरावृत्ति; नमूना प्रश्नपत्र अभ्यास।', periodsNeeded: 10 },
  ],
  '10|mathematics': [
    { unitNo: 8, unitName: 'Revision and Assessment', topicName: 'Half-Yearly Revision and Practice Paper', description: 'Consolidated practice; previous-year board questions.', periodsNeeded: 8 },
    { unitNo: 8, unitName: 'Revision and Assessment', topicName: 'Board Examination Revision and Sample Papers', description: 'Full-syllabus revision; timed board sample papers.', periodsNeeded: 14 },
  ],
  '10|physics': [
    { unitNo: 6, unitName: 'Revision and Assessment', topicName: 'Half-Yearly Revision — Light and Electricity', description: 'Ray-diagram and circuit revision; numerical practice.', periodsNeeded: 8 },
    { unitNo: 6, unitName: 'Revision and Assessment', topicName: 'Board Revision and Sample Papers', description: 'Full-syllabus revision with board-pattern questions.', periodsNeeded: 10 },
  ],
  '10|chemistry': [
    { unitNo: 6, unitName: 'Revision and Assessment', topicName: 'Half-Yearly Revision — Reactions and Carbon', description: 'Equation-balancing drills; reaction-mapping practice.', periodsNeeded: 8 },
    { unitNo: 6, unitName: 'Revision and Assessment', topicName: 'Board Revision and Sample Papers', description: 'Full-syllabus revision with board-pattern questions.', periodsNeeded: 10 },
  ],
  '10|biology': [
    { unitNo: 7, unitName: 'Revision and Assessment', topicName: 'Half-Yearly Revision — Life Processes', description: 'Diagram-based revision; process-recall drills.', periodsNeeded: 8 },
    { unitNo: 7, unitName: 'Revision and Assessment', topicName: 'Board Revision and Sample Papers', description: 'Full-syllabus revision with board-pattern questions.', periodsNeeded: 10 },
  ],
  '10|english': [
    { unitNo: 5, unitName: 'Revision and Assessment', topicName: 'Half-Yearly Revision — Literature and Writing', description: 'Literature recall; timed writing practice.', periodsNeeded: 8 },
    { unitNo: 5, unitName: 'Revision and Assessment', topicName: 'Board Revision and Assessment', description: 'Full-syllabus revision; listening and speaking assessment.', periodsNeeded: 12 },
  ],
  '10|social-science': [
    { unitNo: 5, unitName: 'Revision and Assessment', topicName: 'Half-Yearly Revision — India and the World', description: 'Map work; source-based and case-based questions.', periodsNeeded: 10 },
    { unitNo: 5, unitName: 'Revision and Assessment', topicName: 'Board Revision and Sample Papers', description: 'Full-syllabus revision with sample papers.', periodsNeeded: 12 },
  ],
  '10|hindi': [
    { unitNo: 4, unitName: 'पुनरावृत्ति एवं मूल्यांकन', topicName: 'अर्धवार्षिक पुनरावृत्ति — गद्य एवं काव्य', description: 'पाठों का सार, काव्य-भाव और प्रश्न-अभ्यास।', periodsNeeded: 8 },
    { unitNo: 4, unitName: 'पुनरावृत्ति एवं मूल्यांकन', topicName: 'बोर्ड परीक्षा पुनरावृत्ति एवं नमूना प्रश्नपत्र', description: 'पूरे पाठ्यक्रम की पुनरावृत्ति; बोर्ड-प्रारूप अभ्यास।', periodsNeeded: 12 },
  ],
}

// ─── CBSE Computer Applications (new-subject showcase) ───────────────────

const COMPUTER_9: SyllabusTopicSeed[] = [
  { unitNo: 1, unitName: 'Basics of Information Technology', topicName: 'Computer Systems and Peripherals', description: 'Hardware, software, memory units and common peripherals.', periodsNeeded: 8 },
  { unitNo: 1, unitName: 'Basics of Information Technology', topicName: 'Operating Systems and File Management', description: 'OS roles; managing files and folders safely.', periodsNeeded: 6 },
  { unitNo: 1, unitName: 'Basics of Information Technology', topicName: 'Computer Networks and the Internet', description: 'LAN/WAN basics; internet services and browsers.', periodsNeeded: 6 },
  { unitNo: 2, unitName: 'Office Tools', topicName: 'Word Processing — Documents and Formatting', description: 'Creating, editing and formatting documents; mail concepts.', periodsNeeded: 10 },
  { unitNo: 2, unitName: 'Office Tools', topicName: 'Spreadsheets — Formulas, Functions and Charts', description: 'Cells, ranges, formulas and chart building.', periodsNeeded: 10 },
  { unitNo: 2, unitName: 'Office Tools', topicName: 'Presentations — Slides and Storytelling', description: 'Slide design, transitions and presenting with impact.', periodsNeeded: 8 },
  { unitNo: 3, unitName: 'Cyber Safety', topicName: 'Safe Browsing and Digital Citizenship', description: 'Passwords, privacy, netiquette and digital footprint.', periodsNeeded: 6 },
  { unitNo: 3, unitName: 'Cyber Safety', topicName: 'Malware, Scams and Data Protection', description: 'Recognising threats; safe practices for personal data.', periodsNeeded: 6 },
  { unitNo: 4, unitName: 'Lab Practice', topicName: 'Lab — Document, Worksheet and Presentation Tasks', description: 'Hands-on lab assessments across the office suite.', periodsNeeded: 12 },
  { unitNo: 4, unitName: 'Lab Practice', topicName: 'Lab — Typing and File Organisation Skills', description: 'Touch-typing practice; organised folder structures.', periodsNeeded: 8 },
]

const COMPUTER_10: SyllabusTopicSeed[] = [
  { unitNo: 1, unitName: 'Networking and the Web', topicName: 'Computer Networks — LAN, WAN and Topologies', description: 'Network devices; topologies; wired vs wireless access.', periodsNeeded: 8 },
  { unitNo: 1, unitName: 'Networking and the Web', topicName: 'Internet Services and the World Wide Web', description: 'WWW, websites, URLs and search skills.', periodsNeeded: 6 },
  { unitNo: 2, unitName: 'HTML', topicName: 'HTML Basics — Structure and Tags', description: 'Document skeleton; head vs body; essential tags.', periodsNeeded: 8 },
  { unitNo: 2, unitName: 'HTML', topicName: 'Formatting, Lists and Links', description: 'Text-level tags; ordered and unordered lists; anchoring.', periodsNeeded: 8 },
  { unitNo: 2, unitName: 'HTML', topicName: 'Images, Tables and Forms', description: 'Embedding images; table anatomy; form controls.', periodsNeeded: 10 },
  { unitNo: 3, unitName: 'Cascading Style Sheets', topicName: 'CSS — Selectors and Properties', description: 'Inline, internal and external CSS; core selectors.', periodsNeeded: 8 },
  { unitNo: 3, unitName: 'Cascading Style Sheets', topicName: 'Styling Text, Boxes and Layout', description: 'Colour, fonts, borders, padding and margin practice.', periodsNeeded: 8 },
  { unitNo: 4, unitName: 'Lab Practice and Project', topicName: 'Lab — Build a Personal Website', description: 'Planning and building a multi-page personal site.', periodsNeeded: 12 },
  { unitNo: 4, unitName: 'Lab Practice and Project', topicName: 'Lab — Forms and CSS Effects', description: 'Interactive forms with styled feedback states.', periodsNeeded: 8 },
  { unitNo: 4, unitName: 'Lab Practice and Project', topicName: 'Project Work and Viva', description: 'Final project documentation, demo and viva.', periodsNeeded: 8 },
]

// ─── Middle school (6–8) — NCERT chapter lists, compact ─────────────────

function ms(
  unitNo: number,
  unitName: string,
  rows: [topicName: string, description: string, periods: number][],
): SyllabusTopicSeed[] {
  return rows.map(([topicName, description, periodsNeeded]) => ({
    unitNo,
    unitName,
    topicName,
    description,
    periodsNeeded,
  }))
}

const MATH_6 = [
  ...ms(1, 'Number System', [
    ['Knowing Our Numbers', 'Comparing and ordering numbers; estimation.', 6],
    ['Whole Numbers', 'Number line; properties of operations.', 6],
    ['Playing with Numbers', 'Factors, multiples, divisibility tests.', 7],
    ['Integers', 'Negative numbers; operations on the number line.', 7],
    ['Fractions', 'Equivalent fractions; comparison and addition.', 8],
    ['Decimals', 'Place value; converting and computing with decimals.', 7],
  ]),
  ...ms(2, 'Algebra and Ratio', [
    ['Algebra — Variables and Expressions', 'Using letters for numbers; simple expressions.', 8],
    ['Ratio and Proportion', 'Unitary method; dividing amounts in a ratio.', 6],
  ]),
  ...ms(3, 'Geometry', [
    ['Basic Geometrical Ideas', 'Points, lines, angles, circles and polygons.', 6],
    ['Understanding Elementary Shapes', 'Measuring line segments and angles; 2D/3D shapes.', 6],
  ]),
  ...ms(4, 'Mensuration and Data', [
    ['Mensuration — Perimeter and Area', 'Perimeter and area of rectangles and squares.', 8],
    ['Data Handling and Bar Graphs', 'Recording data; drawing and reading bar graphs.', 6],
  ]),
]

const SCIENCE_6 = [
  ...ms(1, 'Food and Nutrition', [
    ['Components of Food', 'Nutrients; balanced diet; deficiency diseases.', 6],
  ]),
  ...ms(2, 'Materials', [
    ['Sorting Materials into Groups', 'Properties used for grouping everyday materials.', 5],
    ['Separation of Substances', 'Handpicking to evaporation; choosing methods.', 6],
  ]),
  ...ms(3, 'The Living World', [
    ['Getting to Know Plants', 'Herbs to trees; leaf, flower and root structure.', 6],
    ['Body Movements', 'Joints and movement in animals; the human skeleton.', 5],
    ['The Living Organisms and Their Habitats', 'Habitats, adaptation and characteristics of life.', 5],
  ]),
  ...ms(4, 'Moving Things, Light and Sound', [
    ['Motion and Measurement of Distances', 'Standard units; types of motion.', 6],
    ['Light, Shadows and Reflections', 'Transparent, translucent, opaque; shadows.', 6],
  ]),
  ...ms(5, 'Electricity and Environment', [
    ['Electricity and Circuits', 'Cells, bulbs and simple circuits; conductors.', 6],
    ['Fun with Magnets', 'Poles, attraction and everyday uses of magnets.', 5],
    ['Water and Air Around Us', 'Water cycle; air and its importance.', 8],
    ['Garbage In, Garbage Out', 'Waste segregation; composting and recycling.', 4],
  ]),
]

const ENGLISH_6 = [
  ...ms(1, 'Prose — Honeysuckle', [
    ['Who Did Patrick’s Homework?', 'The little man and the homework lesson.', 6],
    ['How the Dog Found Himself a New Master', 'Why dogs became domesticated.', 6],
    ['Taro’s Reward', 'A Japanese tale of diligence and love.', 6],
    ['An Indian-American Woman in Space', 'Kalpana Chawla’s journey.', 6],
    ['A Different Kind of School', 'Learning empathy at Millthorpe.', 5],
    ['Who I Am', 'Celebrating different talents and identities.', 5],
    ['Fair Play', 'Jumman and Algu — friendship and justice.', 6],
  ]),
  ...ms(2, 'Poetry — Honeysuckle', [
    ['A House, A Home and The Kite', 'Poems on belonging and flight.', 4],
    ['The Quarrel and Beauty', 'Everyday squabbles; beauty in the ordinary.', 4],
    ['Where Do All the Teachers Go?', 'A child’s curious questions.', 3],
  ]),
  ...ms(3, 'Supplementary — A Pact with the Sun', [
    ['A Tale of Two Birds', 'Company shapes character.', 4],
    ['The Friendly Mongoose', 'Hasty judgements and their cost.', 4],
    ['Tansen', 'The great musician’s story.', 5],
    ['The Monkey and the Crocodile', 'Wit over strength.', 5],
    ['A Pact with the Sun', 'Keeping promises against the odds.', 5],
    ['What Happened to the Reptiles', 'Harmony in nature, restored.', 5],
  ]),
  ...ms(4, 'Grammar and Writing', [
    ['Nouns, Pronouns and Tenses', 'Parts of speech; simple tense practice.', 6],
    ['Reading Comprehension and Picture Composition', 'Unseen passages; guided writing.', 6],
  ]),
]

const HINDI_6 = [
  ...ms(1, 'गद्य — वसंत भाग 1', [
    ['बचपन', 'बालकृति की मधुर स्मृतियाँ।', 5],
    ['नादान दोस्त', 'प्रकृति से दोस्ती का पाठ।', 5],
    ['चाँद से थोड़ी-सी गप्पें', 'बाल-सुलभ कल्पना और संवाद।', 5],
    ['अक्षरों का महत्व', 'लेखन-कला की शक्ति।', 5],
    ['पार नज़र के', 'कल्पना की उड़ान।', 5],
    ['ऐसे-ऐसे', 'व्यंग्य के बिंब।', 5],
    ['टिकट अल्बम', 'स्मृतियों की महत्ता।', 4],
  ]),
  ...ms(2, 'काव्य — वसंत भाग 1', [
    ['वह चिड़िया जो', 'सुर, ताल और स्वतंत्रता का पक्षी।', 4],
    ['साथी हाथ बढ़ाना', 'सहयोग का संदेश।', 4],
    ['झाँसी की रानी', 'वीरांगना का बलिदान।', 6],
    ['जो देखकर भी नहीं देखते', 'संवेदनशील दृष्टि की प्रार्थना।', 4],
  ]),
  ...ms(3, 'बाल रामकथा', [
    ['राम-कथा: अयोध्या से लंका तक', 'रामायण-कथा का सरल क्रम।', 10],
    ['रामायण के पात्र और सीख', 'चरित्र-चिंतन और मूल्य-बोध।', 6],
  ]),
  ...ms(4, 'व्याकरण एवं लेखन', [
    ['संज्ञा, सर्वनाम और क्रिया', 'भाषा-ज्ञान की नींव।', 6],
    ['चित्र-वर्णन और अनुच्छेद', 'रचनात्मक लेखन-अभ्यास।', 5],
  ]),
]

const SST_6 = [
  ...ms(1, 'History — Our Pasts I', [
    ['What, Where, How and When?', 'Sources of history; dates and periods.', 5],
    ['From Hunting–Gathering to Growing Food', 'The first farmers and herders.', 6],
    ['In the Earliest Cities', 'Harappan civilisation and its cities.', 6],
    ['Kingdoms, Kings and an Early Republic', 'Mahajanapadas; taxes and armies.', 5],
    ['New Questions and Ideas', 'Buddha, Mahavira and new faiths.', 5],
    ['Ashoka, the Emperor Who Gave Up War', 'The Mauryan empire and dhamma.', 6],
  ]),
  ...ms(2, 'Geography — The Earth: Our Habitat', [
    ['The Earth in the Solar System', 'Planets, stars and the earth’s place.', 5],
    ['Globe — Latitudes and Longitudes', 'Locating places; important parallels.', 5],
    ['Motions of the Earth and Maps', 'Rotation, revolution and map reading.', 6],
    ['Major Domains of the Earth', 'Lithosphere, hydrosphere and atmosphere.', 5],
    ['Major Landforms of the Earth', 'Mountains, plateaus and plains.', 5],
  ]),
  ...ms(3, 'Civics — Social and Political Life I', [
    ['Understanding Diversity', 'Unity in diversity across India.', 5],
    ['What is Government?', 'Levels and roles of government.', 5],
    ['Panchayati Raj and Local Administration', 'Grassroots democracy; rural and urban bodies.', 8],
  ]),
]

const MATH_7 = [
  ...ms(1, 'Number System', [
    ['Integers', 'Operations with negative numbers.', 7],
    ['Fractions and Decimals', 'Multiplication and division; applications.', 9],
    ['Rational Numbers', 'Positive and negative rationals on the line.', 6],
  ]),
  ...ms(2, 'Algebra', [
    ['Simple Equations', 'Setting up and solving equations.', 8],
    ['Algebraic Expressions', 'Terms, coefficients; add and subtract.', 7],
    ['Exponents and Powers', 'Laws of exponents; standard form.', 6],
  ]),
  ...ms(3, 'Geometry', [
    ['Lines and Angles', 'Pairs of angles; parallel lines and transversals.', 6],
    ['The Triangle and Its Properties', 'Angle-sum; medians, altitudes; Pythagoras.', 8],
    ['Visualising Solid Shapes and Symmetry', 'Nets, views and lines of symmetry.', 6],
  ]),
  ...ms(4, 'Mensuration, Ratio and Data', [
    ['Comparing Quantities', 'Percentage, profit-loss and simple interest.', 8],
    ['Perimeter and Area', 'Squares, rectangles, parallelograms, circles.', 8],
    ['Data Handling — Mean, Median and Chance', 'Averages, bar graphs and probability.', 6],
  ]),
]

const SCIENCE_7 = [
  ...ms(1, 'Nutrition and Life', [
    ['Nutrition in Plants', 'Photosynthesis; saprotrophs and insectivores.', 6],
    ['Nutrition in Animals', 'Digestion in humans and amoeba.', 5],
  ]),
  ...ms(2, 'Matter and Change', [
    ['Heat', 'Conduction, convection; thermometer use.', 5],
    ['Acids, Bases and Salts', 'Indicators and neutralisation.', 7],
    ['Physical and Chemical Changes', 'Recognising and balancing changes.', 5],
  ]),
  ...ms(3, 'Our Environment', [
    ['Weather, Climate and Adaptations', 'Climate zones; animal adaptation.', 6],
    ['Winds, Storms and Cyclones', 'Air pressure; storm safety.', 6],
    ['Soil', 'Soil profile, types and conservation.', 5],
    ['Water and Wastewater', 'The water cycle; wastewater story.', 8],
  ]),
  ...ms(4, 'Life Processes', [
    ['Respiration in Organisms', 'Breathing vs respiration; anaerobic modes.', 5],
    ['Transportation in Animals and Plants', 'Heart, blood and plant transport.', 6],
    ['Reproduction in Plants', 'Pollination; seed dispersal.', 6],
  ]),
  ...ms(5, 'Physics', [
    ['Motion and Time', 'Speed, distance-time graphs.', 7],
    ['Light', 'Reflection; plane and spherical mirrors.', 7],
    ['Electric Current and Its Effects', 'Circuits; heating and magnetic effects.', 6],
  ]),
]

const ENGLISH_7 = [
  ...ms(1, 'Prose — Honeycomb', [
    ['Three Questions', 'Tolstoy’s parable of the wise hermit.', 6],
    ['A Gift of Chappals', 'Kindness without hesitation.', 6],
    ['Gopal and the Hilsa Fish', 'Wit that wins the king’s bet.', 5],
    ['The Ashes That Made Trees Bloom', 'The Japanese reward of honesty.', 6],
    ['Quality', 'A craftsman’s devotion to his art.', 5],
    ['Expert Detectives', 'Nishad’s fairness toward Ramesh Nath.', 5],
    ['Fire: Friend and Foe', 'Understanding and controlling fire.', 5],
    ['A Bicycle in Good Repair', 'A comic repair gone wrong.', 4],
    ['The Story of Cricket', 'How the game evolved worldwide.', 5],
  ]),
  ...ms(2, 'Poetry — Honeycomb', [
    ['The Squirrel and The Rebel', 'Playful portraits of temperament.', 4],
    ['The Shed and Chivvy', 'Fears and the pressure of “don’ts”.', 4],
    ['Trees and Mystery of the Talking Fan', 'Everyday images made strange.', 4],
    ['Dad and the Cat and the Tree', 'A comic climb up the tree.', 3],
    ['Garden Snake', 'A harmless garden visitor.', 3],
  ]),
  ...ms(3, 'Supplementary — An Alien Hand', [
    ['The Tiny Teacher', 'What ants teach us.', 4],
    ['Bringing Up Kari', 'Raising an elephant calf.', 5],
    ['The Desert', 'Life in the desert.', 4],
    ['Golu Grows a Nose', 'How the elephant got its trunk.', 4],
    ['Chandni', 'The goat that loved freedom.', 5],
    ['A Tiger in the House', 'Timothy’s domestic years.', 5],
    ['An Alien Hand', 'A mission to save a planet.', 6],
  ]),
  ...ms(4, 'Grammar and Writing', [
    ['Grammar — Modals, Voice and Reported Speech', 'Practice across forms.', 7],
    ['Writing — Story, Letter and Dialogue', 'Structured creative writing.', 6],
  ]),
]

const HINDI_7 = [
  ...ms(1, 'गद्य — वसंत भाग 2', [
    ['दादी माँ', 'कृष्णा सोबती की स्मृति-शैली की कहानी।', 5],
    ['खान-पान की बदलता तस्वीर', 'भोजन-संस्कृति पर नज़र।', 5],
    ['रक्त और हमारा शरीर', 'विज्ञान-विषयक सूचनात्मक लेख।', 6],
    ['शाम — एक किसान', 'गाँव की साँझ का चित्रण।', 5],
    ['वृक्ष कब डिगते हैं', 'पर्यावरण-चेतना का संदेश।', 5],
  ]),
  ...ms(2, 'काव्य — वसंत भाग 2', [
    ['सुरदास के पद', 'भक्ति और वात्सल्य के पद।', 5],
    ['राम की शक्ति पूजा', 'शक्ति के विनम्र आह्वान की कविता।', 5],
    ['ऊँट चला', 'बिंब-विधान की मज़ेदार कविता।', 4],
    ['कबीर की साखियाँ', 'ज्ञानाश्रयी साखियाँ।', 5],
  ]),
  ...ms(3, 'व्याकरण एवं लेखन', [
    ['कारक, काल और वचन', 'व्याकरण की आधारिक इकाइयाँ।', 6],
    ['पत्र-लेखन और निबंध', 'रचनात्मक लेखन-अभ्यास।', 6],
  ]),
]

const SST_7 = [
  ...ms(1, 'History — Our Pasts II', [
    ['Tracing Changes Through a Thousand Years', 'Maps, new technologies and terminologies.', 5],
    ['New Kings and Kingdoms', 'Rajput polities and land grants.', 6],
    ['The Delhi Sultans', 'Sultanate administration and expansion.', 6],
    ['The Mughal Empire', 'Mughal hierarchy and mansabdari.', 6],
    ['Rulers and Buildings', 'Engineering shrines and forts.', 5],
    ['Towns, Traders and Craftspersons', 'Temple towns and trade networks.', 5],
    ['Tribes, Nomads and Settled Communities', 'Beyond caste hierarchies.', 5],
    ['Devotional Paths to the Divine', 'Bhakti and Sufi traditions.', 5],
    ['The Making of Regional Cultures', 'Languages, dance and painting.', 5],
  ]),
  ...ms(2, 'Geography — Our Environment', [
    ['Environment and Inside Our Earth', 'Spheres and earth’s interior.', 6],
    ['Our Changing Earth', 'Earthquakes, volcanoes and landforms.', 5],
    ['Air and Water', 'Atmosphere and the hydrosphere.', 6],
    ['Natural Vegetation, Wildlife and Human Environment', 'Forests, wildlife; settlements and transport.', 7],
    ['Life in the Deserts', 'Hot and cold desert life.', 4],
  ]),
  ...ms(3, 'Civics — Social and Political Life II', [
    ['On Equality', 'Universal dignity and equal opportunity.', 5],
    ['Role of the Government in Health', 'Public vs private healthcare.', 5],
    ['How the State Government Works', 'MLAs, ministries and the secretariat.', 5],
    ['Growing Up as Boys and Girls / Women Change the World', 'Gender and work.', 8],
    ['Understanding Media and Markets', 'Media links; markets around us.', 8],
  ]),
]

const MATH_8 = [
  ...ms(1, 'Number System', [
    ['Rational Numbers', 'Properties; operations on rationals.', 7],
    ['Squares and Square Roots', 'Patterns; finding square roots.', 8],
    ['Cubes and Cube Roots', 'Perfect cubes; estimation methods.', 5],
  ]),
  ...ms(2, 'Algebra', [
    ['Linear Equations in One Variable', 'Solving and applying linear equations.', 7],
    ['Algebraic Expressions and Identities', 'Multiplying expressions; key identities.', 8],
    ['Factorisation', 'Common factors; regrouping; division.', 7],
  ]),
  ...ms(3, 'Geometry', [
    ['Understanding Quadrilaterals', 'Angle-sum; parallelograms and their properties.', 7],
    ['Introduction to Graphs', 'Linear graphs; reading data.', 5],
  ]),
  ...ms(4, 'Mensuration, Ratio and Data', [
    ['Comparing Quantities', 'Compound interest; discounts and GST-style problems.', 8],
    ['Direct and Inverse Proportions', 'Recognising variation; applications.', 6],
    ['Mensuration — Area and Volume', 'Trapeziums, polygons; cubes and cylinders.', 8],
    ['Exponents and Powers', 'Negative exponents; standard form.', 5],
    ['Data Handling and Probability', 'Grouped data; equally likely outcomes.', 6],
  ]),
]

const SCIENCE_8 = [
  ...ms(1, 'Crop and Microorganisms', [
    ['Crop Production and Management', 'Sowing to storage; kharif and rabi.', 7],
    ['Microorganisms: Friend and Foe', 'Uses and diseases; food preservation.', 6],
  ]),
  ...ms(2, 'Materials', [
    ['Coal and Petroleum', 'Fossil fuels; conservation.', 5],
    ['Combustion and Flame', 'Types of combustion; fuel efficiency.', 5],
    ['Synthetic Fibres and Plastics', 'Polymers; smart use of plastics.', 5],
  ]),
  ...ms(3, 'Life Processes', [
    ['Cell — Structure and Functions', 'The cell; plant vs animal cells.', 6],
    ['Reproduction in Animals', 'Sexual and asexual modes.', 6],
    ['Reaching the Age of Adolescence', 'Puberty; hormones and health.', 6],
    ['Conservation of Plants and Animals', 'Deforestation; protected areas.', 5],
  ]),
  ...ms(4, 'Force, Friction and Sound', [
    ['Force and Pressure', 'Contact and non-contact forces.', 6],
    ['Friction', 'Types of friction; reducing it.', 5],
    ['Sound', 'Production, propagation and hearing.', 6],
  ]),
  ...ms(5, 'Electricity, Phenomena and Light', [
    ['Chemical Effects of Electric Current', 'Conduction in liquids; electroplating.', 5],
    ['Some Natural Phenomena', 'Lightning and earthquakes; safety.', 5],
    ['Light', 'Reflection; the human eye; dispersion.', 7],
  ]),
]

const ENGLISH_8 = [
  ...ms(1, 'Prose — Honeydew', [
    ['The Best Christmas Present in the World', 'War, peace and a letter home.', 6],
    ['The Tsunami and Glimpses of the Past', 'Nature’s force; colonial India.', 8],
    ['Bepin Choudhury’s Lapse of Memory', 'A memory that was never made.', 6],
    ['The Summit Within', 'Climbing within while climbing without.', 5],
    ['This is Jody’s Fawn', 'Guilt, care and letting go.', 5],
    ['A Visit to Cambridge', 'Two lives that refused limits.', 5],
    ['A Short Monsoon Diary', 'Ruskin Bond’s rain notes.', 5],
    ['The Great Stone Face I & II', 'Hawthorne’s prophecy fulfilled.', 8],
  ]),
  ...ms(2, 'Poetry — Honeydew', [
    ['The Ant and the Cricket', 'A fable in verse.', 3],
    ['Geography Lesson', 'The city from six miles high.', 3],
    ['The Last Bargain', 'Freedom over wages.', 4],
    ['The School Boy', 'Blake on joy and learning.', 4],
    ['On the Grasshopper and Cricket', 'Nature’s endless song.', 3],
  ]),
  ...ms(3, 'Supplementary — It So Happened', [
    ['How the Camel Got His Hump', 'Kipling’s lazy camel.', 4],
    ['Children at Work', 'Velu’s city life.', 4],
    ['The Selfish Giant', 'Wilde’s garden of redemption.', 5],
    ['The Treasure Within', 'A different kind of genius.', 4],
    ['Princess September', 'Freedom and the little bird.', 4],
    ['The Fight', 'Friendship after the scuffle.', 4],
    ['The Open Window', 'Saki’s comic ghost story.', 5],
    ['Jalebis', 'Temptation and its lesson.', 5],
    ['The Comet', 'Science and courage meet.', 6],
  ]),
  ...ms(4, 'Grammar and Writing', [
    ['Grammar — Tenses, Active–Passive and Reported Speech', 'Integrated practice.', 7],
    ['Writing — Diary, Report and Story', 'Register and format drills.', 6],
  ]),
]

const HINDI_8 = [
  ...ms(1, 'गद्य — वसंत भाग 3', [
    ['लाख की चूड़ियाँ', 'कमलेश्वर की कहानी; नैतिक मूल्य बनाम लालच।', 6],
    ['बस की यात्रा', 'साधारण यात्रा की असाधारण स्मृति।', 5],
    ['भगवान के डाकिए', 'जाबिर हुसैन का चर्चित लेख।', 5],
    ['क्या निराश हुआ जाए', 'दिनकर का आत्मविश्वास-संदेश।', 5],
    ['यह सबसे कठिन समय नहीं', 'आशावाद की प्रेरणा।', 5],
  ]),
  ...ms(2, 'काव्य — वसंत भाग 3', [
    ['ध्वनि', 'निराला का प्रतीकात्मक काव्य।', 5],
    ['दीवानों की हस्ती', 'साधना और उन्माद की कविता।', 4],
    ['कबीर की साखियाँ', 'मर्मस्पर्शी ज्ञान-गीत।', 5],
    ['पानी की कहानी', 'जल का महत्व।', 4],
    ['बाज और साँप', 'शक्ति-संतुलन की कथा।', 4],
  ]),
  ...ms(3, 'व्याकरण एवं लेखन', [
    ['वाच्य, अलंकार और वर्तनी', 'भाषा-सौंदर्य के बिंब।', 6],
    ['निबंध और पत्र-लेखन', 'विषय-वस्तु का विस्तार।', 6],
  ]),
]

const SST_8 = [
  ...ms(1, 'History — Our Pasts III', [
    ['How, When and Where', 'Periodisation and sources.', 4],
    ['From Trade to Territory', 'The East India Company’s rise.', 6],
    ['Ruling the Countryside', 'Revenue systems; indigo revolt.', 5],
    ['Tribals, Dikus and the Vision of a Golden Age', 'Forest societies and change.', 5],
    ['When People Rebel — 1857 and After', 'The revolt and its aftermath.', 6],
    ['Civilising the Native, Educating the Nation', 'Colonial education debates.', 5],
    ['Women, Caste and Reform', 'Social reformers and change.', 6],
    ['The Making of the National Movement', 'Gandhi to 1947.', 7],
    ['India After Independence', 'The new nation’s first steps.', 5],
  ]),
  ...ms(2, 'Geography — Resources and Development', [
    ['Resources and Their Classification', 'Natural and human-made resources.', 5],
    ['Land, Soil, Water, Vegetation and Wildlife', 'Use and conservation.', 7],
    ['Agriculture', 'Cropping patterns and reforms.', 6],
    ['Industries', 'Classification; location factors.', 6],
    ['Human Resources', 'Population — size, distribution.', 4],
  ]),
  ...ms(3, 'Civics — Social and Political Life III', [
    ['The Indian Constitution', 'Key features and the Preamble.', 6],
    ['Understanding Secularism and Parliament', 'The state and religions; law-making.', 6],
    ['The Judiciary', 'Courts and the rule of law.', 5],
    ['Understanding and Confronting Marginalisation', 'Adivasis, Dalits and rights.', 6],
    ['Public Facilities and Law', 'Essential services; social justice.', 6],
  ]),
]

const CBSE_MIDDLE_SCHOOL: Record<number, Partial<Record<SubjectKey, SyllabusTopicSeed[]>>> = {
  6: { mathematics: MATH_6, science: SCIENCE_6, english: ENGLISH_6, hindi: HINDI_6, 'social-science': SST_6 },
  7: { mathematics: MATH_7, science: SCIENCE_7, english: ENGLISH_7, hindi: HINDI_7, 'social-science': SST_7 },
  8: { mathematics: MATH_8, science: SCIENCE_8, english: ENGLISH_8, hindi: HINDI_8, 'social-science': SST_8 },
}

// ─── UP Board (UPMSP) — NCERT-based, हिंदी-अनुकूलित labels ─────────────

/** UP Board Hindi — गोधूलि एवं व्याकरण structure (class 9). */
const UP_HINDI_9: SyllabusTopicSeed[] = [
  ...ms(1, 'गद्य खंड — गोधूलि भाग 1', [
    ['बड़े भाई साहब', 'प्रेमचंद की कहानी; अनुशासन और संवेदना।', 8],
    ['स्वर्ग बना सकते हैं', 'कन्हैयालाल माणिकलाल मुंशी का प्रकृति-प्रेम।', 6],
    ['वाणी का महत्व', 'भाषा की शक्ति पर लेख।', 5],
  ]),
  ...ms(2, 'काव्य खंड — गोधूलि भाग 1', [
    ['रसखान के सवैये', 'कृष्ण-भक्ति के ब्रजभाषा सवैये।', 6],
    ['देव के सवैये-कवित्त', 'रीतिकालीन औचित्य और अलंकार।', 6],
    ['सूरदास के पद', 'वात्सल्य और भक्ति के पद।', 6],
    ['तुलसीदास के दोहे', 'नीति और भक्ति के दोहे।', 5],
    ['कबीर की साखियाँ', 'ज्ञान-प्रधान साखियाँ।', 5],
    ['मीरा के पद', 'कृष्ण-प्रेम की तीव्र अनुभूति।', 5],
    ['आधुनिक काव्य — सुमित्रानंदन पंत एवं महादेवी वर्मा', 'छायावादी धारा की कविताएँ।', 8],
  ]),
  ...ms(3, 'व्याकरण एवं रचनात्मक लेखन', [
    ['संधि, समास और उपसर्ग-प्रत्यय', 'शब्द-निर्माण की व्याकरण-प्रक्रियाएँ।', 8],
    ['वाच्य, पद परिचय और अलंकार', 'व्याकरण-विश्लेषण अभ्यास।', 8],
    ['पत्र-लेखन, निबंध एवं संक्षेपण', 'रचनात्मक लेखन का अभ्यास।', 10],
  ]),
]

/** UP Board Hindi — गोधूलि एवं व्याकरण structure (class 10). */
const UP_HINDI_10: SyllabusTopicSeed[] = [
  ...ms(1, 'गद्य खंड — गोधूलि भाग 2', [
    ['मनुष्यता', 'मैथिलीशरण गुप्त का खंडकाव्य; परोपकार।', 8],
    ['तताँरा-वामीरो कथा', 'लीलाधर मंडलोई की लोक-कथा।', 8],
    ['गिरगिट', 'चेखव की कहानी; अवसरवादिता पर व्यंग्य।', 8],
    ['अकेला चन्द्रिका', 'डॉ. रामकुमार वर्मा का एकांकी संवाद।', 6],
    ['जहाँ दहशत से खाली लोगों का घर हो', 'यशपाल का सामाजिक यथार्थ।', 6],
  ]),
  ...ms(2, 'काव्य खंड — गोधूलि भाग 2', [
    ['राम-लक्ष्मण-परशुराम संवाद', 'मैथिलीशरण गुप्त; गंभीर रस-प्रधान संवाद।', 7],
    ['जय-पति जय जय जन्मभूमि', 'सोहनलाल द्विवेदी; देशभक्ति-गीत।', 5],
    ['नेताजी का चश्मा', 'जाबिर हुसैन की चर्चित कहानी; सामुदायिक सद्भाव।', 5],
    ['जो सोचते हैं वे बोलते नहीं', 'जयशंकर प्रसाद; राष्ट्रीय चेतना।', 5],
    ['तोपें और तिरंगा', 'देशभक्ति के प्रतीक-चिंतन।', 5],
  ]),
  ...ms(3, 'व्याकरण एवं रचनात्मक लेखन', [
    ['वाच्य, अलंकार और रस', 'व्याकरण-सौंदर्य अभ्यास।', 8],
    ['अपठित गद्यांश और गद्य-संक्षेपण', 'अर्थ-ग्रहण कौशल।', 8],
    ['पत्र-लेखन और निबंध', 'रचनात्मक लेखन अभ्यास।', 10],
  ]),
]

// ─── Template assembly ───────────────────────────────────────────────────

function seedTopicsToTemplate(
  board: TemplateBoard,
  classLevel: number,
  subjectKey: SubjectKey,
  subjectLabel: string,
  bookLabel: string,
  topics: SyllabusTopicSeed[],
): SyllabusTemplate {
  const units: SyllabusUnitSummary[] = []
  for (const t of topics) {
    const last = units[units.length - 1]
    if (!last || last.unitNo !== t.unitNo || last.unitName !== t.unitName) {
      units.push({ unitNo: t.unitNo, unitName: t.unitName, topicCount: 1 })
    } else {
      last.topicCount += 1
    }
  }
  const sourceBoard =
    board === 'CBSE' ? `CBSE-${new Date().getUTCFullYear()}` : `UP_BOARD-${new Date().getUTCFullYear()}`
  return { board, classLevel, subjectKey, subjectLabel, bookLabel, sourceBoard, units, topics }
}

/** Combined UP-board विज्ञान: physics + chemistry + biology under three discipline units. */
function combinedScienceTopics(grade: 9 | 10): SyllabusTopicSeed[] {
  const pick = (subjectName: string): CurriculumSeedTopic[] =>
    CURRICULUM_SEED.find((s) => s.subjectName === subjectName && s.grade === grade)?.topics ?? []
  const phys = pick('Physics')
  const chem = pick('Chemistry')
  const bio = pick('Biology')
  const relabel = (rows: CurriculumSeedTopic[], unitNo: number, unitName: string): SyllabusTopicSeed[] =>
    rows.map((t) => ({ unitNo, unitName, topicName: t.topicName, description: t.description, periodsNeeded: t.periodsNeeded }))
  return [
    ...relabel(phys, 1, 'भौतिकी (Physics)'),
    ...relabel(chem, 2, 'रसायन (Chemistry)'),
    ...relabel(bio, 3, 'जीव विज्ञान (Biology)'),
  ]
}

function cbseTemplate(classLevel: number, subjectKey: SubjectKey, subjectLabel: string, bookLabel: string, topics: SyllabusTopicSeed[]): SyllabusTemplate {
  return seedTopicsToTemplate('CBSE', classLevel, subjectKey, subjectLabel, bookLabel, topics)
}

const UP_BOOK_LABELS: Record<SubjectKey, string> = {
  mathematics: 'गणित — NCERT (यूपी बोर्ड)',
  science: 'विज्ञान — NCERT (यूपी बोर्ड)',
  physics: 'भौतिकी — NCERT (यूपी बोर्ड)',
  chemistry: 'रसायन — NCERT (यूपी बोर्ड)',
  biology: 'जीव विज्ञान — NCERT (यूपी बोर्ड)',
  english: 'English — NCERT (यूपी बोर्ड)',
  hindi: 'हिंदी — गोधूलि एवं व्याकरण (यूपी बोर्ड)',
  'social-science': 'सामाजिक विज्ञान — NCERT (यूपी बोर्ड)',
  computer: 'Computer Applications (यूपी बोर्ड)',
}

function upTemplate(
  classLevel: number,
  subjectKey: SubjectKey,
  subjectLabel: string,
  topics: SyllabusTopicSeed[],
): SyllabusTemplate {
  return seedTopicsToTemplate('UP_BOARD', classLevel, subjectKey, subjectLabel, UP_BOOK_LABELS[subjectKey], topics)
}

function ncertCoreTopics(grade: 9 | 10, subjectName: string): SyllabusTopicSeed[] {
  const seed = CURRICULUM_SEED.find((s) => s.subjectName === subjectName && s.grade === grade)
  if (!seed) return []
  return seed.topics.map((t) => ({
    unitNo: t.unitNo,
    unitName: t.unitName,
    topicName: t.topicName,
    description: t.description,
    periodsNeeded: t.periodsNeeded,
  }))
}

/**
 * Find the board syllabus template for a school's class + subject.
 * Returns null when the board is not template-backed (ICSE/STATE/CUSTOM)
 * or no template exists for the class level / subject combination.
 */
export function findSyllabusTemplate(
  board: string | null | undefined,
  className: string,
  subjectName: string,
): SyllabusTemplate | null {
  const b = normalizeBoard(board)
  const level = classLevelFor(className)
  const key = subjectKeyFor(subjectName)
  if (!b || !level || !key) return null

  const grade = level as 9 | 10
  const isCore = level === 9 || level === 10

  if (b === 'CBSE') {
    if (isCore) {
      if (key === 'computer') {
        return cbseTemplate(
          level, 'computer', 'Computer Applications',
          'Computer Applications — CBSE (Code 165)',
          level === 9 ? COMPUTER_9 : COMPUTER_10,
        )
      }
      const seedSubject = Object.entries(CBSE_9_10_KEYS).find(([, k]) => k === key)?.[0]
      if (!seedSubject) return null
      const base = ncertCoreTopics(grade, seedSubject)
      if (base.length === 0) return null
      const enriched = [...base, ...(CBSE_ENRICHMENT[`${level}|${key}`] ?? [])]
      const book =
        key === 'hindi'
          ? 'हिंदी — क्षितिज/स्पर्श (NCERT)'
          : key === 'english'
            ? 'English — First Flight & Footprints / Beehive & Moments'
            : key === 'social-science'
              ? 'Social Science — NCERT (History, Geography, Civics, Economics)'
              : `${seedSubject} — NCERT`
      return cbseTemplate(level, key, seedSubject, book, enriched)
    }
    const middle = CBSE_MIDDLE_SCHOOL[level]?.[key]
    if (!middle) return null
    const labels: Record<SubjectKey, string> = {
      mathematics: 'Mathematics — NCERT',
      science: 'Science — NCERT',
      english: level === 8 ? 'English — Honeydew & It So Happened' : 'English — Honeysuckle/Honeycomb & Supplementary',
      hindi: 'हिंदी — वसंत भाग 1/2/3 एवं बाल रामकथा',
      'social-science': 'Social Science — NCERT (Our Pasts, Geography, Civics)',
      physics: 'Science — NCERT', chemistry: 'Science — NCERT', biology: 'Science — NCERT',
      computer: 'Computer Applications',
    }
    return cbseTemplate(level, key, subjectName.split('—')[0].trim() || subjectName, labels[key], middle)
  }

  // UP_BOARD — NCERT-based for most subjects; combined विज्ञान; गोधूली हिंदी.
  if (isCore) {
    if (key === 'computer') {
      return upTemplate(level, 'computer', 'Computer Applications (कंप्यूटर)', level === 9 ? COMPUTER_9 : COMPUTER_10)
    }
    if (key === 'hindi') {
      return upTemplate(level, 'hindi', 'हिंदी', level === 9 ? UP_HINDI_9 : UP_HINDI_10)
    }
    if (key === 'science') {
      const topics = combinedScienceTopics(grade)
      if (topics.length === 0) return null
      return upTemplate(level, 'science', 'विज्ञान (Science)', topics)
    }
    const seedSubject = Object.entries(CBSE_9_10_KEYS).find(([, k]) => k === key)?.[0]
    if (!seedSubject) return null
    const base = ncertCoreTopics(grade, seedSubject)
    if (base.length === 0) return null
    const subjectLabel = key === 'mathematics' ? 'गणित (Mathematics)' : key === 'social-science' ? 'सामाजिक विज्ञान' : seedSubject
    return upTemplate(level, key, subjectLabel, [...base, ...(CBSE_ENRICHMENT[`${level}|${key}`] ?? [])])
  }
  const middle = CBSE_MIDDLE_SCHOOL[level]?.[key]
  if (!middle) return null
  return upTemplate(level, key, subjectName, middle)
}
