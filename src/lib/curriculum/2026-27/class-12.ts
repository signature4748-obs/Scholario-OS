/**
 * Class 12 — 2026-27 session (rationalized NCERT senior-secondary books).
 *
 * Streams mirror Class 11 (Science / Commerce / Humanities) — the school
 * decides what to offer; the library carries the official curriculum.
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

export const CLASS_12: ClassCurriculum = {
  classLevel: 12,
  label: 'Class 12',
  subjects: [
    {
      key: 'physics',
      subjectLabel: 'Physics',
      bookLabel: 'Physics — NCERT (Class 12, Part I & II)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Part I — Physics (Chapters 1–8)', [
          t('Electric Charges and Fields', 'Coulomb’s law; electric field; Gauss’s theorem.', 14),
          t('Electrostatic Potential and Capacitance', 'Potential; capacitors; dielectrics.', 14),
          t('Current Electricity', 'Ohm’s law; Kirchhoff’s rules; cells.', 14),
          t('Moving Charges and Magnetism', 'Biot–Savart law; force on conductors; ammeter.', 14),
          t('Magnetism and Matter', 'Magnetic materials; the Earth’s magnetism.', 10),
          t('Electromagnetic Induction', "Faraday's law; Lenz's law; eddy currents.", 12),
          t('Alternating Current', 'AC circuits; LCR resonance; transformers.', 12),
          t('Electromagnetic Waves', 'Displacement current; the EM spectrum.', 8),
        ]),
        u(2, 'Part II — Physics (Chapters 9–14)', [
          t('Ray Optics and Optical Instruments', 'Reflection; refraction; lens and mirror formulae.', 14),
          t('Wave Optics', "Huygens' principle; interference; diffraction.", 12),
          t('Dual Nature of Radiation and Matter', 'Photoelectric effect; de Broglie waves.', 10),
          t('Atoms', 'Rutherford and Bohr models; spectra.', 10),
          t('Nuclei', 'Composition; binding energy; radioactivity.', 10),
          t('Semiconductor Electronics', 'p–n junction; diodes as rectifiers.', 12),
        ]),
      ],
    },
    {
      key: 'chemistry',
      subjectLabel: 'Chemistry',
      bookLabel: 'Chemistry — NCERT (Class 12)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Chemistry — Class XII (Units 1–10)', [
          t('Solutions', 'Types; concentration; colligative properties.', 12),
          t('Electrochemistry', 'Cells; Nernst equation; conductance; batteries.', 14),
          t('Chemical Kinetics', 'Rate laws; order; Arrhenius equation.', 12),
          t('The d- and f-Block Elements', 'Transition elements; lanthanoid contraction.', 12),
          t('Coordination Compounds', 'Nomenclature; Werner’s theory; isomerism.', 12),
          t('Haloalkanes and Haloarenes', 'Preparation; SN1/SN2; environmental effects.', 10),
          t('Alcohols, Phenols and Ethers', 'Preparation and properties.', 12),
          t('Aldehydes, Ketones and Carboxylic Acids', 'Nomenclature; reactions; acidity.', 14),
          t('Amines', 'Preparation; diazonium salts.', 10),
          t('Biomolecules', 'Carbohydrates; proteins; vitamins; nucleic acids.', 10),
        ]),
      ],
    },
    {
      key: 'biology',
      subjectLabel: 'Biology',
      bookLabel: 'Biology — NCERT (Class 12)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Unit VI — Reproduction', [
          t('Sexual Reproduction in Flowering Plants', 'Flower structure; pollination; apomixis.', 12),
          t('Human Reproduction', 'Reproductive systems; gametogenesis.', 12),
          t('Reproductive Health', 'STDs; contraception; ART.', 8),
        ]),
        u(2, 'Unit VII — Genetics and Evolution', [
          t('Principle of Inheritance and Variation', 'Mendelism; linkage; genetic disorders.', 14),
          t('Molecular Basis of Inheritance', 'DNA; replication; transcription; the lac operon.', 14),
          t('Evolution', 'Darwinism; Hardy–Weinberg principle; human evolution.', 12),
        ]),
        u(3, 'Unit VIII — Biology and Human Welfare', [
          t('Human Health and Diseases', 'Pathogens; immunity; cancer; drug abuse.', 10),
          t('Microbes in Human Welfare', 'Fermentation; biofertilisers; sewage treatment.', 8),
        ]),
        u(4, 'Unit IX — Biotechnology and its Applications', [
          t('Biotechnology: Principles and Processes', 'Recombinant DNA; PCR; cloning vectors.', 12),
          t('Biotechnology and its Applications', 'Bt crops; RNAi; gene therapy; transgenics.', 10),
        ]),
        u(5, 'Unit X — Ecology and Environment', [
          t('Organisms and Populations', 'Adaptations; interactions; population attributes.', 10),
          t('Ecosystem', 'Energy flow; pyramids; nutrient cycling.', 10),
          t('Biodiversity and Conservation', 'Species diversity; hotspots; conservation.', 8),
        ]),
      ],
    },
    {
      key: 'mathematics',
      subjectLabel: 'Mathematics',
      bookLabel: 'Mathematics — NCERT (Class 12)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Mathematics — Class XII (Chapters 1–13)', [
          t('Relations and Functions', 'Types of relations; invertible functions.', 10),
          t('Inverse Trigonometric Functions', 'Domains; ranges; identities.', 10),
          t('Matrices', 'Operations; transpose; symmetric matrices.', 12),
          t('Determinants', 'Properties; adjoint; inverse; linear equations.', 14),
          t('Continuity and Differentiability', 'Continuity; chain rule; logarithmic differentiation.', 14),
          t('Application of Derivatives', 'Rate of change; tangents; maxima and minima.', 12),
          t('Integrals', 'Methods of integration; definite integrals.', 16),
          t('Application of Integrals', 'Area under curves.', 10),
          t('Differential Equations', 'Order; degree; variable separable; linear DEs.', 12),
          t('Vector Algebra', 'Algebra of vectors; dot and cross products.', 12),
          t('Three Dimensional Geometry', 'Direction cosines; lines and planes.', 12),
          t('Linear Programming', 'Formulation; graphical solution.', 8),
          t('Probability', 'Conditional probability; Bayes’ theorem; distributions.', 14),
        ]),
      ],
    },
    {
      key: 'english',
      subjectLabel: 'English',
      bookLabel: 'Flamingo & Vistas — NCERT (Class 12)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Prose — Flamingo', [
          t('The Last Lesson', 'Alphonse Daudet on language and identity.', 7),
          t('Lost Spring', 'Stories of stolen childhood — Saheb and Mukesh.', 7),
          t('Deep Water', 'William Douglas conquers fear.', 7),
          t('The Rattrap', 'A peddler’s redemption.', 7),
          t('Indigo', "Gandhiji's Champaran campaign.", 7),
          t('Poets and Pancakes', 'Asokamitran on Gemini Studios.', 7),
          t('The Interview', 'Umberto Eco and the art of the interview.', 7),
          t('Going Places', 'Sophie’s dreams and reality.', 7),
        ]),
        u(2, 'Poetry — Flamingo', [
          t('My Mother at Sixty-six', 'Kamala Das on ageing and fear of loss.', 5),
          t('Keeping Quiet', 'Pablo Neruda on stillness and reflection.', 5),
          t('A Thing of Beauty', "Keats' ode to enduring beauty.", 5),
          t('A Roadside Stand', 'Robert Frost on rural deprivation.', 5),
          t("Aunt Jennifer's Tigers", 'Adrienne Rich on oppression and art.', 5),
        ]),
        u(3, 'Supplementary — Vistas', [
          t('The Third Level', 'A modern psychiatric case of time travel.', 6),
          t('The Tiger King', 'Satire on the maharaja’s tiger hunt.', 6),
          t('Journey to the End of the Earth', 'Antarctica and planetary history.', 6),
          t('The Enemy', 'A Japanese doctor and an American POW.', 6),
          t('On the Face of It', 'Derry and Mr Lamb on disfigurement.', 6),
          t('Memories of Childhood', 'The Cutting of My Long Hair + We Too Are Human Beings.', 7),
        ]),
      ],
    },
    {
      key: 'accountancy',
      subjectLabel: 'Accountancy',
      bookLabel: 'Accountancy I, II & III — NCERT (Class 12)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Part I — Partnership Accounts (Chapters 1–5)', [
          t('Accounting for Not-for-profit Organisation', 'Receipts and payments; income and expenditure.', 12),
          t('Accounting for Partnership: Basic Concepts', 'Partnership deed; capital accounts; P&L appropriation.', 14),
          t('Admission of a Partner', 'Goodwill; revaluation; new profit sharing.', 14),
          t('Retirement/Death of a Partner', 'Gaining ratio; settlement of accounts.', 14),
          t('Dissolution of Partnership Firm', 'Realisation account; insolvency.', 12),
        ]),
        u(2, 'Part II — Company Accounts and Analysis (Chapters 6–11)', [
          t('Accounting for Share Capital', 'Issue and forfeiture of shares.', 14),
          t('Issue and Redemption of Debentures', 'Issue; collateral; redemption.', 12),
          t('Financial Statements of a Company', 'Schedule III; balance sheet.', 12),
          t('Analysis of Financial Statements', 'Tools; comparative and common-size statements.', 10),
          t('Accounting Ratios', 'Liquidity; solvency; activity; profitability.', 12),
          t('Cash Flow Statement', 'Operating; investing; financing activities.', 12),
        ]),
      ],
    },
    {
      key: 'business-studies',
      subjectLabel: 'Business Studies',
      bookLabel: 'Business Studies I & II — NCERT (Class 12)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Part A — Principles and Functions of Management (Chapters 1–8)', [
          t('Nature and Significance of Management', 'Management as science, art, profession.', 8),
          t('Principles of Management', 'Fayol; Taylor.', 8),
          t('Business Environment', 'Dimensions; economic environment in India.', 8),
          t('Planning', 'Features; the planning process.', 10),
          t('Organising', 'Structure; delegation; decentralisation.', 10),
          t('Staffing', 'Recruitment; selection; training.', 10),
          t('Directing', 'Motivation; leadership; communication.', 12),
          t('Controlling', 'The controlling process; relation with planning.', 8),
        ]),
        u(2, 'Part B — Business Finance and Marketing (Chapters 9–12)', [
          t('Financial Management', 'Capital structure; fixed and working capital.', 12),
          t('Financial Markets', 'Money and capital markets; stock exchanges.', 12),
          t('Marketing', 'Mix; branding; labelling; pricing.', 12),
          t('Consumer Protection', 'Consumer rights; redressal machinery.', 8),
        ]),
      ],
    },
    {
      key: 'economics',
      subjectLabel: 'Economics',
      bookLabel: 'Introductory Macroeconomics & Indian Economic Development — NCERT (Class 12)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Introductory Macroeconomics', [
          t('Introduction', 'Emergence of macroeconomics; key concepts.', 7),
          t('National Income Accounting', 'GDP; methods of calculation; real vs nominal.', 12),
          t('Money and Banking', 'Functions of money; the RBI; commercial banks.', 10),
          t('Determination of Income and Employment', 'Aggregate demand; multiplier; excess capacity.', 12),
          t('Government Budget and the Economy', 'Objectives; types of receipts; deficits.', 10),
          t('Open Economy Macroeconomics', 'Balance of payments; exchange rate.', 10),
        ]),
        u(2, 'Indian Economic Development', [
          t('Indian Economy on the Eve of Independence', 'Agriculture; industry; demographics in 1947.', 8),
          t('Indian Economy 1950–1990', 'Five-year plans; green revolution; import substitution.', 10),
          t('Economic Reforms Since 1991', 'Liberalisation; privatisation; globalisation.', 10),
          t('Poverty', 'Measurement; vulnerable groups; poverty alleviation.', 8),
          t('Human Capital Formation in India', 'Education and health as investments.', 8),
          t('Rural Development', 'Credit; marketing; diversification.', 8),
          t('Employment: Growth, Informalisation and Other Issues', 'Workers; unemployment types.', 8),
          t('Infrastructure', 'Energy; health; the state of infrastructure.', 8),
          t('Environment and Sustainable Development', 'Resource depletion; sustainability.', 8),
        ]),
      ],
    },
    {
      key: 'history',
      subjectLabel: 'History',
      bookLabel: 'Themes in Indian History I, II & III — NCERT (Class 12)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Part I — Themes in Indian History (Themes 1–4)', [
          t('Bricks, Beads and Bones', 'The Harappan Civilisation.', 12),
          t('Kings, Farmers and Towns', 'Political and economic history (c. 600 BCE–600 CE).', 12),
          t('Kinship, Caste and Class', 'Early Indian societies.', 10),
          t('Thinkers, Beliefs and Buildings', 'Cultural developments (c. 600 BCE–600 CE).', 10),
        ]),
        u(2, 'Part II — Themes in Indian History (Themes 5–9)', [
          t('Through the Eyes of Travellers', 'Perceptions of society (10th–17th centuries).', 10),
          t('Bhakti-Sufi Traditions', 'Religious developments (c. 8th–18th centuries).', 10),
          t('An Imperial Capital: Vijayanagara', 'The Vijayanagara empire.', 10),
          t('Peasants, Zamindars and the State', 'Agrarian society (c. 16th–17th centuries).', 10),
          t('Kings and Chronicles', 'The Mughal courts.', 10),
        ]),
        u(3, 'Part III — Themes in Indian History (Themes 10–15)', [
          t('Colonialism and the Countryside', 'Rural society under British rule.', 10),
          t('Rebels and the Raj', 'The revolt of 1857.', 10),
          t('Colonial Cities', 'Urbanisation in the 19th century.', 8),
          t('Mahatma Gandhi and the Nationalist Movement', 'Gandhi and the freedom struggle.', 12),
          t('Understanding Partition', 'Partition and independence.', 10),
          t('Framing the Constitution', 'The making of the Constitution.', 10),
        ]),
      ],
    },
    {
      key: 'political-science',
      subjectLabel: 'Political Science',
      bookLabel: 'Contemporary World Politics & Politics in India Since Independence — NCERT (Class 12)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Contemporary World Politics', [
          t('The End of Bipolarity', 'Soviet disintegration; shock therapy; Russia’s resurgence.', 10),
          t('Contemporary Centres of Power', 'EU, ASEAN, China, Japan.', 8),
          t('Contemporary South Asia', 'India–Pakistan; democratisation in the region.', 8),
          t('International Organisations', 'The UN and its agencies; reforms.', 8),
          t('Security in the Contemporary World', 'Traditional and non-traditional threats.', 10),
          t('Environment and Natural Resources', 'Environmental concerns; resource geopolitics.', 8),
          t('Globalisation', 'Causes; political and cultural consequences.', 8),
        ]),
        u(2, 'Politics in India Since Independence', [
          t('Challenges of Nation Building', 'Partition; integration of princely states.', 10),
          t('Era of One-Party Dominance', 'Congress system; opposition.', 8),
          t('Politics of Planned Development', 'Five-year plans; green revolution.', 8),
          t("India's External Relations", 'Non-alignment; wars; foreign policy.', 8),
          t('Challenges to and Restoration of the Congress System', '1969 split; the Emergency context.', 8),
          t('The Crisis of Democratic Order', 'The Emergency; post-Emergency politics.', 8),
          t('Rise of Popular Movements', 'Civil liberties; farmers’ and women’s movements.', 8),
          t('Regional Aspirations', 'Punjab; the North-East; regional parties.', 8),
          t('Recent Developments in Indian Politics', 'Coalition era; 1990s onwards.', 8),
        ]),
      ],
    },
    {
      key: 'geography',
      subjectLabel: 'Geography',
      bookLabel: 'Fundamentals of Human Geography & India: People and Economy — NCERT (Class 12)',
      sourceBoard: 'NCERT-2026-27',
      units: [
        u(1, 'Fundamentals of Human Geography', [
          t('Human Geography: Nature and Scope', 'Naturalisation of humans; humanisation of nature.', 6),
          t('The World Population: Distribution, Density and Growth', 'Patterns; demographic transition.', 8),
          t('Population Composition', 'Sex ratio; age structure; literacy.', 8),
          t('Human Development', 'HDI; approaches to development.', 8),
          t('Primary Activities', 'Hunting; pastoralism; agriculture types.', 8),
          t('Secondary Activities', 'Manufacturing; location factors.', 8),
          t('Tertiary and Quaternary Activities', 'Services; knowledge industries.', 8),
          t('Transport and Communication', 'Modes; trade routes.', 8),
          t('International Trade', 'Basis; ports; globalization of trade.', 6),
          t('Human Settlements', 'Rural and urban settlement types.', 8),
        ]),
        u(2, 'India: People and Economy', [
          t('Population: Distribution, Density, Growth and Composition', 'India’s census; migration.', 8),
          t('Migration: Types, Causes and Consequences', 'Streams; consequences.', 8),
          t('Human Development', 'Indicators; interstate disparities.', 6),
          t('Human Settlements', 'Settlement patterns; urban classification.', 8),
          t('Land Resources and Agriculture', 'Land use; cropping patterns; issues.', 10),
          t('Water Resources', 'Irrigation; water scarcity.', 8),
          t('Mineral and Energy Resources', 'Distribution; conservation.', 8),
          t('Manufacturing Industries', 'Types; distribution; policy.', 8),
          t('Planning and Sustainable Development in Indian Context', 'Target-area planning; case studies.', 8),
          t('Transport and Communication', 'Networks; trade corridors.', 8),
          t('International Trade', 'Ports; balance of trade.', 6),
          t('Geographical Perspective on Selected Issues and Problems', 'Slums; waste management; land degradation.', 8),
        ]),
      ],
    },
  ],
}
