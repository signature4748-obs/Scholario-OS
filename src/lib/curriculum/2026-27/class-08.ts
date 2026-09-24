/**
 * Class 8 — 2026-27 session — the FIRST year of the brand-new NCF-SE
 * Grade 8 textbooks (released for 2026-27).
 *
 * Books (verified):
 *   • Ganita Prakash — Mathematics, Grade 8 (Part 1: 7 + Part 2: 7)
 *   • Curiosity — Science, Grade 8 (13 chapters)
 *   • Exploring Society: India and Beyond — Social Science (7 chapters)
 *   • Poorvi — English (5 thematic units × 3 texts)
 *   • मल्हार — हिंदी (10 पाठ)
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

export const CLASS_8: ClassCurriculum = {
  classLevel: 8,
  label: 'Class 8',
  subjects: [
    {
      key: 'mathematics',
      subjectLabel: 'Mathematics',
      bookLabel: 'Ganita Prakash — NCERT Mathematics (Class 8)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Part 1 — Ganita Prakash (Chapters 1–7)', [
          t('A Square and A Cube', 'Square numbers and cubes; square roots and cube roots.', 10),
          t('Power Play', 'Exponents and the laws of exponents.', 8),
          t('A Story of Numbers', 'Number patterns and reasoning with sequences.', 8),
          t('Quadrilaterals', 'Types of quadrilaterals and their properties.', 10),
          t('Number Play', 'Digit puzzles, supersedences and mental-maths strategies.', 8),
          t('We Distribute, Yet Things Multiply', 'Distributivity and algebraic manipulation.', 8),
          t('Proportional Reasoning-1', 'Ratios, rates and proportional thinking.', 10),
        ]),
        u(2, 'Part 2 — Ganita Prakash (Chapters 8–14)', [
          t('Fractions in Disguise', 'Rational numbers — equivalence and operations.', 10),
          t('The Baudhayana–Pythagoras Theorem', 'Statement, proof and applications of the theorem.', 10),
          t('Proportional Reasoning–2', 'Percentages, discounts, interest and proportional change.', 10),
          t('Exploring Some Geometric Themes', 'Angles in parallel lines; properties of triangles.', 10),
          t('Tales by Dots and Lines', 'Graphs, charts and reading data geometrically.', 8),
          t('Algebra Play', 'Algebraic expressions, identities and factorisation.', 12),
          t('Area', 'Area of polygons and composite figures.', 10),
        ]),
      ],
    },
    {
      key: 'science',
      subjectLabel: 'Science',
      bookLabel: 'Curiosity — NCERT Science (Class 8)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Curiosity — Class 8', [
          t('Exploring the Investigative World of Science', 'Scientific method, variables and fair testing.', 5),
          t('The Invisible Living World: Beyond Our Naked Eye', 'The microscopic world; using a microscope.', 8),
          t('Health: The Ultimate Treasure', 'Diseases, immunity and community health.', 8),
          t('Electricity: Magnetic and Heating Effects', 'Circuits; magnetic effects; heating effects and safety.', 10),
          t('Exploring Forces', 'Types of forces; friction and its effects.', 8),
          t('Pressure, Winds, Storms and Cyclones', 'Air pressure, winds and cyclone preparedness.', 8),
          t('Particulate Nature of Matter', 'Particles of matter; states and change of state.', 8),
          t('Nature of Matter: Elements, Compounds and Mixtures', 'Elements, compounds, mixtures and symbols.', 8),
          t('The Amazing World of Solutes, Solvents and Solutions', 'Solutions, suspensions, colloids; concentration.', 8),
          t('Light: Mirrors and Lenses', 'Reflection in mirrors; refraction through lenses.', 10),
          t('Keeping Time with the Skies', 'Skywatching; phases of the Moon and timekeeping.', 7),
          t('How Nature Works in Harmony', 'Ecosystems, food chains and natural balance.', 7),
          t('Our Home: Earth, a Unique Life Sustaining Planet', 'The biosphere and Earth as a life-support system.', 7),
        ]),
      ],
    },
    {
      key: 'social-science',
      subjectLabel: 'Social Science',
      bookLabel: 'Exploring Society: India and Beyond — NCERT (Class 8)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Exploring Society: India and Beyond — Class 8', [
          t('Natural Resources and Their Use', 'Types of natural resources; sustainable use.', 7),
          t("Reshaping India's Political Map", 'How states and borders evolved after Independence.', 7),
          t('The Rise of the Marathas', 'The Maratha power and its expansion.', 8),
          t('The Colonial Era in India', 'Establishment and expansion of British rule.', 9),
          t("Universal Franchise and India's Electoral System", 'The right to vote and how elections are conducted.', 8),
          t('The Parliamentary System: Legislature and Executive', 'Parliament, the Executive and their working.', 9),
          t('Factors of Production', 'Land, labour, capital and organisation in production.', 6),
        ]),
      ],
    },
    {
      key: 'english',
      subjectLabel: 'English',
      bookLabel: 'Poorvi — NCERT English (Class 8)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Unit 1 — Wit and Wisdom', [
          t('The Wit That Won Hearts', 'Tenali Rama’s wit in the royal court.', 6),
          t('A Concrete Example', 'A story that builds ideas step by step.', 6),
          t('Wisdom Paves the Way', 'A reflective piece on wise choices.', 6),
        ]),
        u(2, 'Unit 2 — Values and Dispositions', [
          t('A Tale of Valour: Major Somnath Sharma and the Battle of Budgam', 'The story of India’s first Param Vir Chakra awardee.', 7),
          t("Somebody's Mother", 'Mary Dow Brine’s poem about kindness to the elderly.', 5),
          t('Verghese Kurien — I Too Had A Dream', 'The milk revolution of the Milkman of India.', 7),
        ]),
        u(3, 'Unit 3 — Mystery and Magic', [
          t('The Case of the Fifth Word', 'An Encyclopedia Brown detective mystery.', 6),
          t('The Magic Brush of Dreams', 'A magical tale about art and imagination.', 6),
          t('Spectacular Wonders', 'A journey through natural and man-made wonders.', 6),
        ]),
        u(4, 'Unit 4 — Environment', [
          t('The Cherry Tree', 'Ruskin Bond on growing a cherry tree.', 6),
          t('Harvest Hymn', 'A poem of gratitude for the harvest.', 5),
          t('Waiting For The Rain', 'A story about the land’s longing for rain.', 6),
        ]),
        u(5, 'Unit 5 — Science and Curiosity', [
          t('Feathered Friend', 'Arthur C. Clarke’s tale of a bird in space.', 6),
          t('Magnifying Glass', 'A poem about looking closely at the world.', 5),
          t('Bibha Chowdhuri: The Beam of Light that Lit the Path for Women in Indian Science', 'The life of the pioneering physicist.', 7),
        ]),
      ],
    },
    {
      key: 'hindi',
      subjectLabel: 'Hindi',
      bookLabel: 'मल्हार — NCERT हिंदी (कक्षा 8)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'मल्हार — कक्षा 8', [
          t('स्वदेश (कविता)', 'देश-प्रेम की कविता।', 6),
          t('दो गौरैया (कहानी)', 'भीष्म साहनी की कहानी; सहानुभूति का संदेश।', 7),
          t('एक आशीर्वाद (कविता)', 'आशीर्वाद की शक्ति से जुड़ी रचना।', 5),
          t('हरिद्वार (यात्रा-वृत्तांत)', 'हरिद्वार की यात्रा का सजीव वर्णन।', 7),
          t('कबीर के दोहे', 'ज्ञानाश्रयी दोहों में सामाजिक सद्भाव।', 6),
          t('एक टोकरी भर मिट्टी', 'मिट्टी से जुड़ाव और संबंधों की कहानी।', 7),
          t('मत बाँधो (कविता)', 'बंधनों को अस्वीकारने की कविता।', 5),
          t('नए मेहमान (एकांकी)', 'परिवार में नए अतिथि से जुड़ा हास्य-प्रहसन।', 7),
          t('आदमी का अनुपात (कविता)', 'मानव-जीवन के अनुपात पर व्यंग्य।', 5),
          t('तरुण के स्वप्न', 'सपनों की उड़ान भरते युवा की कहानी।', 7),
        ]),
      ],
    },
  ],
}
