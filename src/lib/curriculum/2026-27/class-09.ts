/**
 * Class 9 — 2026-27 session — the FIRST year of the brand-new NCF-SE
 * Grade 9 textbooks, released for this session.
 *
 * Books (verified):
 *   • Ganita Manjari — Mathematics, Grade 9 (Part I: 8 chapters published;
 *     Part II per the CBSE 2026-27 syllabus: Euclid → Statistics)
 *   • Exploration — Science, Grade 9 (13 chapters)
 *   • Understanding Society: India and Beyond — Social Science
 *     (Part 1: 9 chapters published; Part 2: 7 announced)
 *   • Kaveri — English (8 units, each pairing a prose with a poem)
 *   • गंगा — हिंदी (गद्य खंड 7 + काव्य खंड 5 + भाषा संगम)
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

export const CLASS_9: ClassCurriculum = {
  classLevel: 9,
  label: 'Class 9',
  subjects: [
    {
      key: 'mathematics',
      subjectLabel: 'Mathematics',
      bookLabel: 'Ganita Manjari — NCERT Mathematics (Class 9)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Part I — Ganita Manjari (Chapters 1–8)', [
          t('Orienting Yourself: The Use of Coordinates', 'The Cartesian plane; plotting and reading points.', 10),
          t('Introduction to Linear Polynomials', 'Linear polynomials and their graphs; identities.', 12),
          t('The World of Numbers', 'Real numbers; decimal expansions; exponents and surds.', 12),
          t('Exploring Algebraic Identities', 'Standard identities and their applications.', 12),
          t("I'm Up and Down, and Round and Round", 'Circles — chords, arcs, cyclic quadrilaterals.', 12),
          t('Measuring Space: Perimeter and Area', 'Perimeter and area of triangles, quadrilaterals, circles.', 12),
          t('The Mathematics of Maybe: Introduction to Probability', 'Random experiments; empirical and classical probability.', 10),
          t('Sequences and Progressions', 'Patterns, sequences; arithmetic progressions.', 12),
        ]),
        u(2, 'Part II — Ganita Manjari (Chapters 9–16)', [
          t("Introduction to Euclid's Geometry: Axioms and Postulates", 'Definitions, axioms, postulates and deductive reasoning.', 8),
          t('Lines and Angles', 'Pairs of angles; parallel lines and a transversal.', 10),
          t('Triangles', 'Congruence criteria; inequalities in a triangle.', 12),
          t('Quadrilaterals', 'Parallelogram properties; the mid-point theorem.', 10),
          t('Constructions', 'Basic constructions; triangles from given data.', 8),
          t("Heron's Formula", 'Area of a triangle from three sides; applications.', 8),
          t('Surface Areas and Volumes', 'Cones, spheres, hemispheres and combinations.', 12),
          t('Statistics', 'Frequency distributions; histograms; mean, median, mode.', 10),
        ]),
      ],
      note: 'Part I chapters follow the published Ganita Manjari textbook; Part II chapters follow the CBSE 2026-27 syllabus structure.',
    },
    {
      key: 'science',
      subjectLabel: 'Science',
      bookLabel: 'Exploration — NCERT Science (Class 9)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Exploration — Class 9', [
          t('Exploration: Entering the World of Secondary Science', 'How science works; measurement, units and scientific thinking.', 6),
          t('Cell: The Building Block of Life', 'Cell structure and organelles; plant vs animal cells.', 10),
          t('Tissues in Action', 'Plant and animal tissues; the musculoskeletal system.', 10),
          t('Describing Motion Around Us', 'Distance–displacement, velocity; motion graphs; equations of motion.', 12),
          t('Exploring Mixtures and their Separation', 'Solutions, colloids; six separation techniques; concentration.', 10),
          t('How Forces Affect Motion', 'Balanced and unbalanced forces; friction; Newton’s laws.', 12),
          t('Work, Energy and Simple Machines', 'Work and energy; levers, pulleys and simple machines.', 10),
          t('Journey Inside the Atom', 'Atomic models; subatomic particles; isotopes and valency.', 10),
          t('Atomic Foundations of Matter', 'Laws of chemical combination; Dalton’s theory; formulae and molecular mass.', 10),
          t('Sound Waves: Characteristics and Applications', 'Production and propagation of sound; reflection; range of hearing.', 10),
          t('Reproduction: How Life Continues', 'Reproduction in plants and humans; reproductive health.', 12),
          t('Patterns in Life: Diversity and Classification', 'Classification; five kingdoms; binomial nomenclature.', 10),
          t('Earth as a System: Energy, Matter and Life', 'The five spheres; solar radiation; biogeochemical cycles; human impact.', 10),
        ]),
      ],
    },
    {
      key: 'social-science',
      subjectLabel: 'Social Science',
      bookLabel: 'Understanding Society: India and Beyond — NCERT (Class 9)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Part 1 — Understanding Society (Chapters 1–9)', [
          t('Understanding Social Science', 'What Social Science is and how its disciplines work together.', 5),
          t("Shaping of the Earth's Surface", 'Landforms; internal and external processes shaping the Earth.', 9),
          t('Atmosphere and Climate', 'Composition of the atmosphere; weather vs climate; climate zones.', 9),
          t('Early Humans and Beginning of Civilisation', 'From foragers to farmers; the first civilisations.', 9),
          t('State and Society up to 1000 CE', 'Kingdoms, empires and society in ancient India.', 9),
          t('Democracy', 'What democracy is; features and significance.', 8),
          t('Elections', 'Why elections matter; how India votes.', 8),
          t('Building Blocks in Economics', 'Scarcity, choice and the basic economic problem.', 8),
          t('The Price Puzzle: What Drives the Market', 'Demand, supply and how markets set prices.', 8),
        ]),
        u(2, 'Part 2 — Understanding Society (Chapters 10–16)', [
          t('Oceans and Life', 'Ocean relief; currents and marine life.', 8),
          t('Life on Earth', 'Ecosystems, biomes and biodiversity.', 8),
          t('Resistance and Resilience (1000 CE–1700 CE)', 'Societies, states and cultural flows 1000–1700 CE.', 9),
          t('India and the World-I (1900 BCE–1200 CE)', 'India’s global connections from the Vedic age to 1200 CE.', 9),
          t('Authority', 'Power, authority and legitimate rule.', 8),
          t('From Ideas to Startups', 'Entrepreneurship — from idea to enterprise.', 8),
          t('Smart Ways to Manage Your Finances', 'Budgeting, saving, banking and financial literacy.', 8),
        ]),
      ],
      note: 'Part 1 is the published volume; Part 2 follows the announced NCERT structure for 2026-27.',
    },
    {
      key: 'english',
      subjectLabel: 'English',
      bookLabel: 'Kaveri — NCERT English (Class 9)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Kaveri — Prose and Poems (8 Units)', [
          t('Unit 1 — How I Taught My Grandmother to Read + Bharat Our Land', 'Sudha Murty’s story of a determined learner + a patriotic poem.', 8),
          t('Unit 2 — The Pot Maker + Gifts of Grace: Honouring Our Vocations', 'A story of craft + a poem on dignity of work.', 8),
          t('Unit 3 — Winds of Change + Canvas of Soil', 'An expository article + a poem rooted in the earth.', 8),
          t('Unit 4 — Vitamin-M + I Cannot Remember My Mother', 'A story on music’s gift + Tagore’s memory poem.', 8),
          t('Unit 5 — The World of Limitless Possibilities + Nine Gold Medals', 'An interview + David Roth’s poem on the Special Olympics.', 8),
          t('Unit 6 — Twin Melodies + A Friend Found in Music', 'A play + a poem on the companionship of music.', 8),
          t('Unit 7 — Carrier of Words + Words', 'A documentary article + a poem on language.', 8),
          t('Unit 8 — Follow That Dream + Believe in Yourself', 'A letter + a poem on self-belief.', 8),
        ]),
      ],
    },
    {
      key: 'hindi',
      subjectLabel: 'Hindi',
      bookLabel: 'गंगा — NCERT हिंदी (कक्षा 9)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'गद्य खंड (पाठ 1–7)', [
          t('दो बैलों की कथा (प्रेमचंद)', 'अनुशासन और संवेदना की प्रेमचंद कहानी।', 8),
          t('क्या लिखूँ? (पद्मलाल पुन्नालाल बक्शी)', 'लेखकीय व्यंग्य और आत्मकथ्य।', 7),
          t('समवधान (शेखर जोशी)', 'ग्राम्य जीवन की कहानी।', 7),
          t('ऐसी भी बातें होती हैं (यतींद्र मिश्र)', 'संस्मरणात्मक रेखाचित्र।', 7),
          t('आख़िरी चट्टान तक (मोहन राकेश)', 'नागर जीवन और संवेदनाओं की कहानी।', 8),
          t('रीढ़ की हड्डी (जगदीशचंद्र माथुर)', 'नारी-सशक्तिकरण की प्रसिद्ध रचना।', 8),
          t('मैं और मेरा देश (कन्हैयालाल मिश्र ‘प्रभाकर’)', 'देश-प्रेम का निबंधात्मक आख्यान।', 7),
        ]),
        u(2, 'काव्य खंड (पाठ 8–12)', [
          t('रैदास के पद', 'ज्ञान-भक्ति के पद।', 6),
          t('राम-परशुराम-लक्ष्मण संवाद (तुलसीदास)', 'मर्मस्पर्शी राम-काव्य संवाद।', 7),
          t('भारती, जय, विजयकारे! (सूर्यकांत त्रिपाठी ‘निराला’)', 'वीर-रस की आधुनिक कविता।', 6),
          t('झाँसी की रानी (सुभद्रा कुमारी चौहान)', 'वीरांगना के बलिदान का काव्य।', 7),
          t('घर की याद (भवानी प्रसाद मिश्र)', 'प्रवास में घर की याद का काव्य।', 6),
        ]),
        u(3, 'भाषा संगम', [
          t('वैष्णव जन तो तेने कहिए (नरसी मेहता)', 'बहुभाषी विरासत की गुजराती भजी का हिंदी अंश।', 5),
        ]),
      ],
    },
    {
      key: 'computer-applications',
      subjectLabel: 'Computer Applications',
      bookLabel: 'Computer Applications — CBSE (Code 165, Class 9)',
      sourceBoard: 'CBSE-2026-27',
      units: [
        u(1, 'Unit 1 — Basics of Information Technology', [
          t('Computer Systems and Peripherals', 'Characteristics of computers; hardware, software; memory and storage units.', 8),
          t('Operating Systems and File Management', 'Role of an OS; managing files and folders safely.', 6),
          t('Basics of Networking and the Internet', 'Networks, internet services, browsers, URLs and e-mail.', 6),
        ]),
        u(2, 'Unit 2 — Cyber Safety', [
          t('Safe Browsing and Digital Footprint', 'Strong passwords; privacy; netiquette and digital footprint.', 6),
          t('Malware, Scams and Data Protection', 'Recognising threats; safe practices for personal data.', 6),
        ]),
        u(3, 'Unit 3 — Office Tools', [
          t('Word Processing', 'Creating and formatting documents; tables and mail merge.', 8),
          t('Spreadsheets — Formulas and Charts', 'Cells, formulas, functions and building charts.', 10),
          t('Presentations', 'Slide design, transitions and presenting effectively.', 6),
        ]),
        u(4, 'Unit 4 — Lab Practical', [
          t('Lab Practice — Office Tools and File Management', 'Hands-on lab assessments across word processor, spreadsheet and presentation.', 12),
        ]),
      ],
    },
  ],
}
