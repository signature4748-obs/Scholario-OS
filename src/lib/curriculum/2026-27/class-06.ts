/**
 * Class 6 — 2026-27 session (NCF-SE 2023 new-textbook generation).
 *
 * Books (verified):
 *   • Ganita Prakash — NCERT Mathematics, Grade 6 (10 chapters)
 *   • Curiosity — NCERT Science, Grade 6 (12 chapters)
 *   • Exploring Society: India and Beyond — Social Science (14 chapters)
 *   • Poorvi — English (5 thematic units × 3 texts)
 *   • मल्हार — हिंदी (13 पाठ)
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
const BOOK = (unitName: string, topics: CurriculumTopicSeed[]): CurriculumUnitSeed[] => [u(1, unitName, topics)]

export const CLASS_6: ClassCurriculum = {
  classLevel: 6,
  label: 'Class 6',
  subjects: [
    {
      key: 'mathematics',
      subjectLabel: 'Mathematics',
      bookLabel: 'Ganita Prakash — NCERT Mathematics (Class 6)',
      sourceBoard: 'NCERT-2026-27',
      units: BOOK('Ganita Prakash — Class 6', [
        t('Patterns in Mathematics', 'Number sequences, visual patterns and the beginnings of algebraic thinking.', 8),
        t('Lines and Angles', 'Points, lines, rays; comparing and classifying angles.', 8),
        t('Number Play', 'Supercells, digit sums, number puzzles and games.', 8),
        t('Data Handling and Presentation', 'Pictographs and bar graphs; organising and reading data.', 8),
        t('Prime Time', 'Factors, multiples, prime numbers, divisibility tests.', 10),
        t('Perimeter and Area', 'Perimeter of shapes; area of rectangles and composite regions.', 10),
        t('Fractions', 'Fraction on the number line; equivalent fractions; addition and subtraction.', 12),
        t('Playing with Constructions', 'Using a compass and ruler; squares, rectangles and curves.', 8),
        t('Symmetry', 'Line symmetry; symmetric figures and patterns.', 6),
        t('The Other Side of Zero', 'Integers on the number line; addition and subtraction of integers.', 10),
      ]),
    },
    {
      key: 'science',
      subjectLabel: 'Science',
      bookLabel: 'Curiosity — NCERT Science (Class 6)',
      sourceBoard: 'NCERT-2026-27',
      units: BOOK('Curiosity — Class 6', [
        t('The Wonderful World of Science', 'What science is; how scientists observe, question and investigate.', 5),
        t('Diversity in the Living World', 'Classifying plants and animals; habitats and diversity around us.', 8),
        t('Mindful Eating: A Path to a Healthy Body', 'Nutrients, balanced diet and traditional food practices.', 7),
        t('Exploring Magnets', ' Magnetic and non-magnetic materials; poles, attraction and everyday uses.', 6),
        t('Measurement of Length and Motion', 'Standard units; measuring length; types of motion.', 8),
        t('Materials Around Us', 'Grouping materials by properties; transparency, solubility, conductivity.', 7),
        t('Temperature and its Measurement', 'Hot and cold; thermometers and reading temperature.', 6),
        t('A Journey through States of Water', 'Evaporation, condensation, freezing and the water cycle.', 7),
        t('Methods of Separation in Everyday Life', 'Handpicking, winnowing, sieving, filtration and evaporation.', 7),
        t('Living Creatures: Exploring their Characteristics', 'What makes something alive; growth, response and reproduction.', 7),
        t("Nature's Treasures", 'Natural resources — air, water, land, forests and their conservation.', 7),
        t('Beyond Earth', 'The Moon, stars and constellations; our solar system.', 7),
      ]),
    },
    {
      key: 'social-science',
      subjectLabel: 'Social Science',
      bookLabel: 'Exploring Society: India and Beyond — NCERT (Class 6)',
      sourceBoard: 'NCERT-2026-27',
      units: BOOK('Exploring Society: India and Beyond — Class 6', [
        t('Locating Places on the Earth', 'Globes, maps, latitudes and longitudes.', 7),
        t('Oceans and Continents', 'The major oceans and continents; the layout of the Earth.', 6),
        t('Landforms and Life', 'Mountains, plateaus, plains and how landforms shape life.', 7),
        t('Timeline and Sources of History', 'When, where and how we know about the past.', 7),
        t('India, That Is Bharat', 'Names of our land through travellers and inscriptions.', 6),
        t('The Beginnings of Indian Civilisation', 'The Harappan civilisation and its cities.', 8),
        t("India's Cultural Roots", 'Vedic, Jain, Buddhist and folk traditions in Indian culture.', 7),
        t("Unity in Diversity, or 'Many in the One'", 'Languages, festivals and traditions that bind India.', 6),
        t('Family and Community', 'Types of families; community life and cooperation.', 6),
        t('Grassroots Democracy – Part 1: Governance', 'How decisions are made; the meaning of democratic governance.', 6),
        t('Grassroots Democracy – Part 2: Local Government in Rural Areas', 'Gram panchayats, gram sabhas and their functions.', 7),
        t('Grassroots Democracy – Part 3: Local Government in Urban Areas', 'Municipalities and ward committees in cities and towns.', 7),
        t('The Value of Work', 'Dignity of labour; different kinds of work and skills.', 5),
        t('Economic Activities Around Us', 'Primary, secondary and tertiary activities in daily life.', 6),
      ]),
    },
    {
      key: 'english',
      subjectLabel: 'English',
      bookLabel: 'Poorvi — NCERT English (Class 6)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Unit 1 — Fables and Folk Tales', [
          t('A Bottle of Dew', 'A fable about the true treasure — effort over reward.', 6),
          t('The Raven and the Fox', 'A poem after La Fontaine on flattery and wit.', 5),
          t('Rama to the Rescue', 'A folk play where presence of mind saves the day.', 6),
        ]),
        u(2, 'Unit 2 — Friendship', [
          t('The Unlikely Best Friends', 'A story of an elephant and a dog who become friends.', 6),
          t("A Friend's Prayer", 'A poem about wanting to be a true friend.', 5),
          t('The Chair', 'A story about kindness and inclusion.', 6),
        ]),
        u(3, 'Unit 3 — Nurturing Nature', [
          t('Neem Baba', 'A conversation revealing the many gifts of the neem tree.', 6),
          t('What a Bird Thought', 'A poem about a bird discovering the world.', 5),
          t('Spices that Heal Us', 'An expository piece on turmeric, ginger and other healing spices.', 6),
        ]),
        u(4, 'Unit 4 — Sports and Wellness', [
          t('Change of Heart', 'A story from the world of kabaddi and teamwork.', 6),
          t('The Winner', 'A poem about winning against oneself.', 5),
          t('Yoga – A Way of Life', 'An expository piece on yoga and wellness.', 6),
        ]),
        u(5, 'Unit 5 — Culture and Tradition', [
          t('Hamara Bharat — Incredible India!', 'A collage of India', 6),
          t('The Kites', 'A poem about the joy of flying kites.', 5),
          t('Ila Sachani: Embroidering Dreams with Her Feet', 'The story of an artist who embroiders with her feet.', 6),
        ]),
      ],
    },
    {
      key: 'hindi',
      subjectLabel: 'Hindi',
      bookLabel: 'मल्हार — NCERT हिंदी (कक्षा 6)',
      sourceBoard: 'NCERT-2026-27',
      units: BOOK('मल्हार — कक्षा 6', [
        t('मातृभूमि', 'देशभक्ति का काव्य।', 5),
        t('गोल', 'गोल आकार और उसके अर्थों पर कविता।', 5),
        t('पहली बूंद', 'पहली वर्षा के आगमन की कविता।', 5),
        t('हार की जीत', 'संघर्ष और धैर्य की कहानी।', 6),
        t('रहीम के दोहे', 'नीति-बोध के दोहे।', 6),
        t('मेरी माँ', 'मातृ-स्नेह की कविता।', 5),
        t('जलते चलो', 'प्रकाश और आशा का संदेश देने वाली कविता।', 5),
        t('सत्रिया और बिहू नृत्य', 'असम के लोक-नृत्यों का परिचय।', 6),
        t('मैया मैं नहिं माखन खायो', 'भक्ति-भाव की कविता।', 5),
        t('परीक्षा', 'हास्य-व्यंग्य की कहानी।', 6),
        t('चेतक की वीरता', 'महाराणा प्रताप के घोड़े की वीरता।', 6),
        t('हिंद महासागर में छोटा सा हिंदुस्तान', 'मॉरीशस में बसा भारतीय समाज।', 6),
        t('पेड़ की बात', 'पर्यावरण-चेतना से जुड़ा लेख।', 6),
      ]),
    },
  ],
}
