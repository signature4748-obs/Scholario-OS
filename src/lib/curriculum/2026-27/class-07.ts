/**
 * Class 7 — 2026-27 session (NCF-SE 2023 new-textbook generation).
 *
 * Books (verified):
 *   • Ganita Prakash — NCERT Mathematics, Grade 7 (Part 1: 8 + Part 2: 7)
 *   • Curiosity — NCERT Science, Grade 7 (12 chapters)
 *   • Exploring Society: India and Beyond — Part 1 (12) + Part 2 (8)
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

export const CLASS_7: ClassCurriculum = {
  classLevel: 7,
  label: 'Class 7',
  subjects: [
    {
      key: 'mathematics',
      subjectLabel: 'Mathematics',
      bookLabel: 'Ganita Prakash — NCERT Mathematics (Class 7)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Part 1 — Ganita Prakash (Chapters 1–8)', [
          t('Large Numbers Around Us', 'Reading, comparing and estimating large numbers.', 8),
          t('Arithmetic Expressions', 'Order of operations; simplifying expressions.', 8),
          t('A Peek Beyond the Point', 'Decimals — place value, operations and applications.', 10),
          t('Expressions using Letter-Numbers', 'Algebraic expressions and simple equations.', 10),
          t('Parallel and Intersecting Lines', 'Parallel lines, transversals and angle properties.', 8),
          t('Number Play', 'Patterns with numbers; digit puzzles and mental maths.', 8),
          t('A Tale of Three Intersecting Lines', 'Triangles — angle sum and properties.', 10),
          t('Working with Fractions', 'Multiplication and division of fractions.', 12),
        ]),
        u(2, 'Part 2 — Ganita Prakash (Chapters 9–15)', [
          t('Geometric Twins', 'Congruent figures and congruence conditions.', 8),
          t('Operations with Integers', 'Multiplication and division of integers; exponent laws.', 10),
          t('Finding Common Ground', 'Common factors and multiples; HCF and LCM.', 8),
          t('Another Peek Beyond the Point', 'More decimals — multiplication, division, conversion.', 8),
          t('Connecting the Dots…', 'The Cartesian plane; plotting points and reading graphs.', 8),
          t('Constructions and Tilings', 'Constructing angles and lines; symmetry and tiling patterns.', 8),
          t('Finding the Unknown', 'Simple linear equations and solving for the unknown.', 10),
        ]),
      ],
    },
    {
      key: 'science',
      subjectLabel: 'Science',
      bookLabel: 'Curiosity — NCERT Science (Class 7)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Curiosity — Class 7', [
          t('The Ever-Evolving World of Science', 'How scientific knowledge grows and changes.', 5),
          t('Exploring Substances (Acidic, Basic, Neutral)', 'Indicators, acids, bases and neutralisation in daily life.', 8),
          t('Electricity: Circuits and their Components', 'Electric cells, bulbs, switches and simple circuits.', 8),
          t('The World of Metals and Non-metals', 'Physical and chemical properties; uses of metals and non-metals.', 8),
          t('Changes Around Us: Physical and Chemical', 'Reversible and irreversible changes; signs of chemical change.', 7),
          t('Adolescence: A Stage of Growth and Change', 'Physical, hormonal and emotional changes in adolescence.', 7),
          t('Heat Transfer in Nature', 'Conduction, convection and radiation in everyday phenomena.', 8),
          t('Measurement of Time and Motion', 'Speed; uniform and non-uniform motion; measuring time.', 8),
          t('Life Processes in Animals', 'Nutrition, respiration and transportation in animals.', 8),
          t('Life Processes in Plants', 'Photosynthesis, transpiration and transport in plants.', 8),
          t('Light: Shadows and Reflections', 'Rectilinear propagation; shadows; reflection in plane mirrors.', 8),
          t('Earth, Moon and the Sun', 'The Earth-Moon-Sun system; phases of the Moon; eclipses.', 8),
        ]),
      ],
    },
    {
      key: 'social-science',
      subjectLabel: 'Social Science',
      bookLabel: 'Exploring Society: India and Beyond — NCERT (Class 7)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Part 1 — Exploring Society (Chapters 1–12)', [
          t('Geographical Diversity of India', "India's mountains, plains, plateaus, deserts and coasts.", 7),
          t('Understanding the Weather', 'Weather vs climate; reading weather reports.', 6),
          t('Climates of India', 'Seasons, monsoons and regional climate variation.', 7),
          t('New Beginnings: Cities and States', 'The first cities, the Mahajanapadas and early states.', 8),
          t('The Rise of Empires', 'The Mauryan empire — from Chandragupta to Ashoka.', 8),
          t('The Age of Reorganisation', 'Post-Mauryan kingdoms and new political orders.', 7),
          t('The Gupta Era: An Age of Tireless Creativity', 'Art, literature and science in the Gupta age.', 8),
          t('How the Land Becomes Sacred', 'Pilgrimage centres and sacred geography across traditions.', 6),
          t('From the Rulers to the Ruled: Types of Governments', 'Democracy, monarchy and other forms of government.', 7),
          t('The Constitution of India – An Introduction', 'Why India needs a Constitution; its key features.', 8),
          t('From Barter to Money', 'The evolution of exchange; money as a medium.', 6),
          t('Understanding Markets', 'How markets work; buyers, sellers and prices.', 7),
        ]),
        u(2, 'Part 2 — Exploring Society (Chapters 13–20)', [
          t('The Story of Indian Farming', 'Types of farming; crops and the farming year.', 7),
          t('India and Her Neighbours', "India's location and relations with neighbouring countries.", 6),
          t('Empires and Kingdoms: 6th to 10th Centuries', 'Major dynasties of early medieval India.', 8),
          t('Turning Tides: 11th and 12th Centuries', 'The Cholas, Chalukyas and changing political tides.', 7),
          t('India, a Home to Many', "India's diversity of communities and languages.", 6),
          t('The State, the Government and You', 'State government, districts and the citizen.', 7),
          t("Infrastructure: Engine of India's Development", 'Roads, power, communication and their role in development.', 6),
          t('Banks and the Magic of Finance', 'How banks work; saving and borrowing.', 6),
        ]),
      ],
    },
    {
      key: 'english',
      subjectLabel: 'English',
      bookLabel: 'Poorvi — NCERT English (Class 7)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Unit 1 — Learning Together', [
          t('The Day the River Spoke', 'A story about hearing the river and caring for nature.', 6),
          t('Try Again', 'A motivational poem on perseverance.', 5),
          t('Three Days to See', 'Helen Keller reflects on how we would value sight.', 6),
        ]),
        u(2, 'Unit 2 — Wit and Humour', [
          t('Animals, Birds and Dr. Dolittle', 'Extract from Hugh Lofting about the animal doctor.', 6),
          t('A Funny Man', 'A nonsense poem full of playful surprises.', 5),
          t('Say the Right Thing', 'A drama sketch about manners and conversation.', 6),
        ]),
        u(3, 'Unit 3 — Dreams and Discoveries', [
          t("My Brother's Great Invention", "A humorous story narrated by an inventor's sibling.", 6),
          t('Paper Boats', "Rabindranath Tagore's poem of floating dreams downstream.", 5),
          t('North, South, East, West', 'An informative piece on directions, maps and journeys.', 6),
        ]),
        u(4, 'Unit 4 — Travel and Adventure', [
          t('The Tunnel', 'A gripping story set on a mountain railway track.', 6),
          t('Travel', 'Edna St. Vincent Millay on the pull of the open road.', 5),
          t('Conquering the Summit', 'Tenzing Norgay on climbing Everest.', 6),
        ]),
        u(5, 'Unit 5 — Bravehearts', [
          t('A Homage to Our Brave Soldiers', 'A visit to a war memorial and the soldiers it honours.', 6),
          t('My Dear Soldiers', 'A poem of gratitude to the armed forces.', 5),
          t('Rani Abbakka', 'The story of the fearless queen who fought the Portuguese.', 6),
        ]),
      ],
    },
    {
      key: 'hindi',
      subjectLabel: 'Hindi',
      bookLabel: 'मल्हार — NCERT हिंदी (कक्षा 7)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'मल्हार — कक्षा 7', [
          t('मान कह एक कहानी', 'कहानी कहने की शक्ति पर रचना।', 6),
          t('तीन बुद्धिमान', 'बुद्धि-विवेक से जुड़ी लोक-कथा।', 6),
          t('फूल और काँटा', 'सौंदर्य और कठिनाई के सह-अस्तित्व की कविता।', 5),
          t('पानी रे पानी', 'जल के महत्व पर काव्य।', 5),
          t('नहीं होना बीमार', 'स्वास्थ्य-रक्षा के उपायों पर रचना।', 6),
          t('गिरिधर कविराय की कुंडलियाँ', 'देशभक्ति-प्रकृति की कुंडलियाँ।', 6),
          t('वर्षा-बहार', 'वर्षा ऋतु के सौंदर्य की कविता।', 5),
          t('बिरजू महाराज से साक्षात्कार', 'कथक गुरु बिरजू महाराज से साक्षात्कार।', 6),
          t('चिड़िया', 'पक्षी के मन की बात कहने वाली कविता।', 5),
          t('मीरा के पद', 'कृष्ण-भक्ति से ओतप्रोत पद।', 6),
        ]),
      ],
    },
  ],
}
