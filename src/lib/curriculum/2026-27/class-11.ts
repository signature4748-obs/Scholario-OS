/**
 * Class 11 — 2026-27 session (rationalized NCERT senior-secondary books).
 *
 * Streams (any combination a school configures):
 *   Science — Physics, Chemistry, Biology, Mathematics, English
 *   Commerce — Accountancy, Business Studies, Economics, Mathematics, English
 *   Humanities — History, Political Science, Geography, Economics, English…
 *
 * All chapter lists verified against the current NCERT structure.
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

export const CLASS_11: ClassCurriculum = {
  classLevel: 11,
  label: 'Class 11',
  subjects: [
    {
      key: 'physics',
      subjectLabel: 'Physics',
      bookLabel: 'Physics — NCERT (Class 11, Part I & II)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Part I — Physics (Chapters 1–9)', [
          t('Units and Measurements', 'SI units; measurement errors and significant figures.', 8),
          t('Motion in a Straight Line', 'Kinematics — position, velocity, acceleration; graphs.', 10),
          t('Motion in a Plane', 'Vectors; projectile and circular motion.', 12),
          t('Laws of Motion', "Newton's laws; friction; dynamics of circular motion.", 12),
          t('Work, Energy and Power', 'Work-energy theorem; conservation of energy; power.', 10),
          t('System of Particles and Rotational Motion', 'Centre of mass; torque; angular momentum.', 14),
          t('Gravitation', "Kepler's laws; the universal law of gravitation.", 10),
          t('Mechanical Properties of Solids', 'Stress, strain; elastic moduli.', 8),
          t('Mechanical Properties of Fluids', 'Pressure; viscosity; surface tension.', 12),
        ]),
        u(2, 'Part II — Physics (Chapters 10–14)', [
          t('Thermal Properties of Matter', 'Thermal expansion; calorimetry; heat transfer.', 12),
          t('Thermodynamics', 'Zeroth law; first and second laws; heat engines.', 10),
          t('Kinetic Theory', 'Ideal gas; equipartition; mean free path.', 8),
          t('Oscillations', 'SHM; energy in SHM; simple pendulum.', 12),
          t('Waves', 'Travelling waves; superposition; beats; Doppler effect.', 12),
        ]),
      ],
    },
    {
      key: 'chemistry',
      subjectLabel: 'Chemistry',
      bookLabel: 'Chemistry — NCERT (Class 11)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Chemistry — Class XI (Units 1–9)', [
          t('Some Basic Concepts of Chemistry', 'Mole concept; stoichiometry; laws of chemical combination.', 12),
          t('Structure of Atom', 'Atomic models; quantum numbers; electronic configuration.', 12),
          t('Classification of Elements and Periodicity in Properties', 'Periodic trends in properties.', 10),
          t('Chemical Bonding and Molecular Structure', 'VSEPR; hybridisation; MO theory.', 14),
          t('Thermodynamics', 'Enthalpy; entropy; spontaneity.', 12),
          t('Equilibrium', 'Chemical and ionic equilibrium; pH; buffers.', 14),
          t('Redox Reactions', 'Oxidation numbers; balancing redox equations.', 8),
          t('Organic Chemistry – Some Basic Principles and Techniques', 'Nomenclature; isomerism; purification methods.', 14),
          t('Hydrocarbons', 'Alkanes, alkenes, alkynes; aromaticity.', 14),
        ]),
      ],
    },
    {
      key: 'biology',
      subjectLabel: 'Biology',
      bookLabel: 'Biology — NCERT (Class 11)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Unit I — Diversity of Living Organisms', [
          t('The Living World', 'What is living; taxonomic categories.', 6),
          t('Biological Classification', 'Five kingdoms; viruses, lichens.', 8),
          t('Plant Kingdom', 'Algae to angiosperms; plant life cycles.', 10),
          t('Animal Kingdom', 'Classification of animals; basis of classification.', 12),
        ]),
        u(2, 'Unit II — Structural Organisation in Plants and Animals', [
          t('Morphology of Flowering Plants', 'Root, stem, leaf; inflorescence; fruit.', 10),
          t('Anatomy of Flowering Plants', 'Tissue systems; monocot vs dicot anatomy.', 10),
          t('Structural Organisation in Animals', 'Animal tissues; organ systems (frog).', 8),
        ]),
        u(3, 'Unit III — Cell: Structure and Function', [
          t('Cell: The Unit of Life', 'Cell organelles; prokaryotic vs eukaryotic.', 10),
          t('Biomolecules', 'Proteins, carbohydrates, lipids, nucleic acids; enzymes.', 10),
          t('Cell Cycle and Cell Division', 'Mitosis and meiosis; significance.', 10),
        ]),
        u(4, 'Unit IV — Plant Physiology', [
          t('Photosynthesis in Higher Plants', 'Light and dark reactions; C4 pathway.', 12),
          t('Respiration in Plants', 'Glycolysis; Krebs cycle; ETC.', 10),
          t('Plant Growth and Development', 'Growth phases; plant hormones.', 8),
        ]),
        u(5, 'Unit V — Human Physiology', [
          t('Breathing and Exchange of Gases', 'Respiratory system; transport of gases.', 10),
          t('Body Fluids and Circulation', 'Blood; cardiac cycle; circulation.', 10),
          t('Excretory Products and their Elimination', 'Nephron; urine formation; regulation.', 10),
          t('Locomotion and Movement', 'Muscles; skeletal system; joints.', 10),
          t('Neural Control and Coordination', 'Neuron; synapse; the human brain.', 12),
          t('Chemical Coordination and Integration', 'Endocrine glands; hormones.', 10),
        ]),
      ],
    },
    {
      key: 'mathematics',
      subjectLabel: 'Mathematics',
      bookLabel: 'Mathematics — NCERT (Class 11)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Mathematics — Class XI (Chapters 1–14)', [
          t('Sets', 'Sets and their representations; operations.', 8),
          t('Relations and Functions', 'Cartesian products; relations; functions.', 12),
          t('Trigonometric Functions', 'Ratios; identities; general solutions.', 14),
          t('Complex Numbers and Quadratic Equations', 'Algebra of complex numbers; Argand plane.', 12),
          t('Linear Inequalities', 'Graphical and algebraic solutions.', 8),
          t('Permutations and Combinations', 'Fundamental principle; factorial notation.', 12),
          t('Binomial Theorem', 'Expansion; general and middle terms.', 10),
          t('Sequences and Series', 'AP, GP; AM–GM inequality.', 12),
          t('Straight Lines', 'Slope; forms of equations; distance.', 12),
          t('Conic Sections', 'Circle, parabola, ellipse, hyperbola.', 12),
          t('Introduction to Three Dimensional Geometry', 'Coordinate axes; distance formulae.', 8),
          t('Limits and Derivatives', 'Limits; derivative of functions.', 14),
          t('Statistics', 'Measures of dispersion; variance.', 10),
          t('Probability', 'Random experiments; axiomatic approach.', 12),
        ]),
      ],
    },
    {
      key: 'english',
      subjectLabel: 'English',
      bookLabel: 'Hornbill & Snapshots — NCERT (Class 11)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Prose — Hornbill', [
          t('The Portrait of a Lady', 'Khuswant Singh on his grandmother.', 7),
          t("We're Not Afraid to Die…", 'A family’s courage at sea.', 7),
          t('Discovering Tut: the Saga Continues', 'Forensic science meets archaeology.', 7),
          t('The Ailing Planet: the Green Movement’s Role', 'Environment and sustainability.', 7),
          t('The Adventure', 'Professor Gaitonde’s strange experience.', 7),
          t('Silk Road', 'A journey to Mount Kailash.', 7),
        ]),
        u(2, 'Poetry — Hornbill', [
          t('A Photograph', 'Shirley Toulson on memory and loss.', 5),
          t('The Laburnum Top', 'Ted Hughes — the tree comes alive.', 5),
          t('The Voice of the Rain', 'Walt Whitman’s dialogue with the rain.', 5),
          t('Childhood', 'Markus Natten on growing up.', 5),
        ]),
        u(3, 'Supplementary — Snapshots', [
          t('The Summer of the Beautiful White Horse', 'Aram and Mourad’s adventure.', 6),
          t('The Address', 'A war-time story of memory and loss.', 6),
          t("Mother's Day (Play)", 'A comedy of role reversal.', 6),
          t('Birth', 'Andrew Manson’s miracle night.', 6),
          t('The Tale of Melon City', 'Nonsense verse on justice.', 6),
        ]),
      ],
    },
    {
      key: 'accountancy',
      subjectLabel: 'Accountancy',
      bookLabel: 'Financial Accounting I & II — NCERT (Class 11)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Part I — Financial Accounting (Chapters 1–7)', [
          t('Introduction to Accounting', 'Meaning, objectives and users of accounting.', 10),
          t('Theory Base of Accounting', 'GAAP; accounting equation; double entry.', 12),
          t('Recording of Transactions – I', 'Journals; ledgers; the accounting cycle.', 14),
          t('Recording of Transactions – II', 'Cash book; petty cash; purchase book.', 12),
          t('Bank Reconciliation Statement', 'Causes of difference; preparing BRS.', 10),
          t('Depreciation, Provisions and Reserves', 'Depreciation methods; provisions.', 12),
          t('Bill of Exchange', 'Terms; accounting treatment.', 10),
        ]),
        u(2, 'Part II — Financial Accounting (Chapters 8–11)', [
          t('Financial Statements – I', 'Trading and P&L accounts.', 12),
          t('Financial Statements – II', 'Balance sheet; adjustments.', 12),
          t('Computerised Accounting', 'Components; comparison with manual system.', 8),
          t('Accounts from Incomplete Records', 'Single entry system; statement of affairs.', 12),
        ]),
      ],
    },
    {
      key: 'business-studies',
      subjectLabel: 'Business Studies',
      bookLabel: 'Business Studies I & II — NCERT (Class 11)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Part A — Foundations of Business (Chapters 1–6)', [
          t('Business, Trade and Commerce', 'Nature and purpose of business.', 10),
          t('Forms of Business Organisation', 'Sole proprietorship to company.', 12),
          t('Private, Public and Global Enterprises', 'Forms; joint ventures; MNCs.', 10),
          t('Business Services', 'Banking; insurance; communication.', 10),
          t('Emerging Modes of Business', 'e-business; outsourcing.', 8),
          t('Social Responsibilities of Business and Business Ethics', 'Responsibility toward stakeholders.', 8),
        ]),
        u(2, 'Part B — Corporate Organisation, Finance and Trade (Chapters 7–11)', [
          t('Formation of a Company', 'Stages of incorporation.', 10),
          t('Sources of Business Finance', 'Owned and borrowed funds.', 12),
          t('Small Business and Entrepreneurship', 'MSMEs; entrepreneurship.', 8),
          t('Internal Trade', 'Wholesalers; retailers; GST context.', 10),
          t('International Business', 'Export–import; documents.', 8),
        ]),
      ],
    },
    {
      key: 'economics',
      subjectLabel: 'Economics',
      bookLabel: 'Statistics for Economics & Introductory Microeconomics — NCERT (Class 11)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Statistics for Economics', [
          t('Introduction', 'Economics as a subject; the role of statistics.', 6),
          t('Collection of Data', 'Primary and secondary data; surveys.', 8),
          t('Organisation of Data', 'Frequency distributions; classification.', 8),
          t('Presentation of Data', 'Tables, diagrams and graphs.', 8),
          t('Measures of Central Tendency', 'Mean, median, mode.', 10),
          t('Measures of Dispersion', 'Range; quartile deviation; standard deviation.', 10),
          t('Correlation', 'Scatter diagrams; Karl Pearson and Spearman.', 8),
          t('Index Numbers', 'Price indices; uses and construction.', 8),
        ]),
        u(2, 'Introductory Microeconomics', [
          t('Introduction', 'The economic problem; central problems of an economy.', 8),
          t('Theory of Consumer Behaviour', 'Utility; indifference curves; demand.', 12),
          t('Production and Costs', 'Production function; cost curves.', 12),
          t('The Theory of the Firm under Perfect Competition', 'Supply; equilibrium of the firm.', 12),
          t('Market Equilibrium', 'Price determination; effects of shifts.', 10),
        ]),
      ],
    },
    {
      key: 'history',
      subjectLabel: 'History',
      bookLabel: 'Themes in World History — NCERT (Class 11)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Themes in World History (Themes 1–10)', [
          t('From the Beginning of Time', 'Human evolution; foragers to food producers.', 10),
          t('Writing and City Life', 'Mesopotamia — the first cities.', 10),
          t('An Empire Across Three Continents', 'The Roman Empire.', 10),
          t('The Central Islamic Lands', 'The rise of Islam; caliphates.', 10),
          t('Nomadic Empires', 'The Mongols and Genghis Khan.', 10),
          t('The Three Orders', 'Feudalism in Western Europe.', 8),
          t('Changing Cultural Traditions', 'Renaissance; humanism.', 10),
          t('The Industrial Revolution', 'Transformation of the economy and society.', 10),
          t('Displacing Indigenous Peoples', 'European expansion; native peoples.', 8),
          t('Paths to Modernisation', 'Japan, Korea, China — modern transformation.', 10),
        ]),
      ],
    },
    {
      key: 'political-science',
      subjectLabel: 'Political Science',
      bookLabel: 'Indian Constitution at Work & Political Theory — NCERT (Class 11)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Indian Constitution at Work', [
          t('Constitution: Why and How?', 'The making of the Constitution.', 8),
          t('Rights in the Indian Constitution', 'Fundamental rights; DPSP.', 10),
          t('Election and Representation', 'The election system; EC.', 8),
          t('Executive', 'President; PM and Council of Ministers.', 10),
          t('Legislature', 'Parliament; law-making.', 10),
          t('Judiciary', 'Courts; judicial review.', 10),
          t('Federalism', 'Centre–state relations.', 10),
          t('Local Governments', '73rd/74th amendments.', 8),
          t('Constitution as a Living Document', 'Amendments; basic structure.', 8),
          t('The Philosophy of the Constitution', 'The Constitution’s values.', 6),
        ]),
        u(2, 'Political Theory', [
          t('Political Theory: An Introduction', 'What political theory is and why it matters.', 7),
          t('Freedom', 'The ideal of freedom; its constraints.', 8),
          t('Equality', 'Kinds of equality; affirmative action.', 8),
          t('Social Justice', 'Justice; reservations; the differently abled.', 8),
          t('Rights', 'Nature and significance of rights.', 8),
          t('Citizenship', 'Who is a citizen; refugees.', 8),
          t('Nationalism', 'National identity; self-determination.', 8),
          t('Secularism', 'The secular ideal; Indian secularism.', 8),
          t('Peace', 'Violence and peace traditions.', 7),
          t('Development', 'Growth vs development; alternatives.', 7),
        ]),
      ],
    },
    {
      key: 'geography',
      subjectLabel: 'Geography',
      bookLabel: 'Fundamentals of Physical Geography & India: Physical Environment — NCERT (Class 11)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Fundamentals of Physical Geography', [
          t('Geography as a Discipline', 'Branches; geography and its relation with science.', 6),
          t('The Origin and Evolution of the Earth', 'Origin theories; interior of the earth.', 8),
          t('Interior of the Earth', 'Sources of information; seismic waves; layers.', 8),
          t('Distribution of Oceans and Continents', 'Continental drift; plate tectonics.', 8),
          t('Minerals and Rocks', 'Types of minerals and rocks; the rock cycle.', 8),
          t('Geomorphic Processes', 'Weathering, erosion, deposition; landforms.', 10),
          t('Landforms and their Evolution', 'Evolution of landforms by agents.', 10),
          t('Composition and Structure of Atmosphere', 'Layers; composition.', 8),
          t('Solar Radiation, Heat Balance and Temperature', 'Insolation; heat budget.', 8),
          t('Atmospheric Circulation and Weather Systems', 'Winds; cyclones.', 10),
          t('Water in the Atmosphere', 'Humidity; precipitation.', 8),
          t('World Climate and Climate Change', 'Köppen classification; climate change.', 8),
          t('Water (Oceans)', 'Ocean relief; salinity.', 8),
          t('Movements of Ocean Water', 'Waves; tides; currents.', 8),
        ]),
        u(2, 'India: Physical Environment', [
          t('India — Location', 'Size; latitudes; neighbours.', 6),
          t('Structure and Physiography', 'Physiographic divisions of India.', 8),
          t('Drainage System', 'Himalayan and Peninsular rivers.', 8),
          t('Climate', 'Monsoon mechanism; seasons.', 10),
          t('Natural Vegetation', 'Types of forests; biosphere reserves.', 8),
          t('Natural Hazards and Disasters', 'Types; disaster management.', 8),
        ]),
      ],
    },
  ],
}
