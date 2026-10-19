/**
 * Default Taxonomy and Classification Rules
 * Comprehensive rule set for privacy-first, offline bookmark categorization.
 * Intelligently covers Education, Career & Jobs, Germany, Study Abroad,
 * Programming, AI & Technology, Finance, Entertainment, Research, and more.
 */

export const DEFAULT_CATEGORIES = [
  {
    id: 'germany',
    name: 'Germany',
    icon: '🇩🇪',
    color: '#e63946',
    description: 'German universities, visa & immigration, housing, language learning, and living in Germany',
    priority: 95,
    domains: [
      'daad.de', 'uni-assist.de', 'make-it-in-germany.com', 'anabin.kmk.org',
      'wg-gesucht.de', 'immobilienscout24.de', 'immowelt.de', 'bamf.de',
      'auswaertiges-amt.de', 'arbeitsagentur.de', 'stepstone.de', 'xing.com',
      'spiegel.de', 'zeit.de', 'tagesschau.de', 'dw.com', 'sueddeutsche.de',
      'faz.net', 'bahn.de', 'db.de', 'n26.com', 'tk.de', 'barmer.de', 'aok.de',
      'deutschland.de', 'germany.travel', 'studying-in-germany.org', 'expatrio.com',
      'fintiba.com', 'coracle.de', 'tum.de', 'lmu.de', 'rwth-aachen.de',
      'uni-heidelberg.de', 'tu-berlin.de', 'kit.edu', 'uni-bonn.de',
      'uni-freiburg.de', 'uni-tuebingen.de', 'uni-goettingen.de', 'uni-stuttgart.de',
      'tu-dresden.de', 'uni-frankfurt.de', 'uni-hamburg.de', 'uni-koeln.de',
      'goethe.de', 'vhs.de', 'testdaf.de', 'telc.net', 'germanyvisa.de',
      'hochschulkompass.de', 'studierendenwerk-berlin.de', 'studentenwerk-muenchen.de',
      'studentenwerk.de', 'studierendenwerk.de', 'myguide.de', 'toytowngermany.com'
    ],
    tlds: ['.de'],
    titleKeywords: [
      'germany', 'deutschland', 'german', 'daad', 'uni-assist', 'anabin',
      'sperrkonto', 'blocked account', 'chancenkarte', 'opportunity card',
      'blue card germany', 'blaue karte', 'ausländerbehörde', 'auslaenderbehoerde',
      'anmeldung', 'wohnungsgeberbestätigung', 'wohnungsgeberbestaetigung',
      'rundfunkbeitrag', 'wg-gesucht', 'wg zimmer', 'studienkolleg', 'testdaf',
      'dsh prüfung', 'dsh pruefung', 'aps certificate', 'german visa', 'national visa germany',
      'german university', 'studierendenwerk', 'studentenwerk', 'wg gesucht',
      'immobilienscout', 'b1 deutsch', 'b2 deutsch', 'c1 deutsch', 'a1 deutsch', 'a2 deutsch',
      'goethe institut', 'make it in germany', 'deutsche bahn', 'deutsch lernen',
      'leben in deutschland', 'expatrio', 'fintiba', 'coracle', 'tum münchen', 'tum muenchen',
      'rwth aachen', 'lmu münchen', 'lmu muenchen', 'tu berlin', 'uni heidelberg'
    ],
    urlKeywords: [
      'germany', 'deutschland', 'german', 'daad', 'uni-assist', 'anabin',
      'sperrkonto', 'blocked-account', 'chancenkarte', 'blue-card', 'anmeldung',
      'wg-gesucht', 'studienkolleg', 'testdaf', 'expatrio', 'fintiba',
      'studying-in-germany', 'studieren-in-deutschland'
    ],
    subcategories: [
      {
        id: 'germany_universities',
        name: 'Universities & Study',
        domains: ['daad.de', 'uni-assist.de', 'tum.de', 'lmu.de', 'rwth-aachen.de', 'uni-heidelberg.de', 'tu-berlin.de', 'kit.edu', 'hochschulkompass.de', 'myguide.de'],
        keywords: ['university', 'universität', 'universitaet', 'hochschule', 'daad', 'uni-assist', 'studienkolleg', 'masters', 'bachelors', 'admission', 'tum', 'rwth', 'lmu', 'campus', 'tu9']
      },
      {
        id: 'germany_visa_immigration',
        name: 'Visa & Immigration',
        domains: ['make-it-in-germany.com', 'anabin.kmk.org', 'bamf.de', 'auswaertiges-amt.de', 'expatrio.com', 'fintiba.com', 'coracle.de'],
        keywords: ['visa', 'chancenkarte', 'blue card', 'blocked account', 'sperrkonto', 'aps', 'ausländerbehörde', 'auslaenderbehoerde', 'embassy', 'consulate', 'residence permit', 'aufenthalt']
      },
      {
        id: 'germany_housing_living',
        name: 'Housing & Living',
        domains: ['wg-gesucht.de', 'immobilienscout24.de', 'immowelt.de', 'tk.de', 'barmer.de', 'aok.de', 'n26.com', 'bahn.de'],
        keywords: ['wg', 'wohnung', 'apartment', 'rent', 'anmeldung', 'rundfunkbeitrag', 'krankenkasse', 'health insurance', 'n26', 'deutsche bahn', 'miete']
      },
      {
        id: 'germany_language',
        name: 'Language Learning',
        domains: ['goethe.de', 'dw.com', 'vhs.de', 'testdaf.de', 'telc.net'],
        keywords: ['goethe', 'testdaf', 'dsh', 'telc', 'deutsch lernen', 'german language', 'a1', 'a2', 'b1', 'b2', 'c1', 'wortschatz', 'grammatik']
      }
    ]
  },
  {
    id: 'study_abroad',
    name: 'Study Abroad',
    icon: '✈️',
    color: '#028090',
    description: 'International education, overseas admissions, standardized tests, and global scholarships',
    priority: 85,
    domains: [
      'topuniversities.com', 'timeshighereducation.com', 'mastersportal.com',
      'bachelorsportal.com', 'phdportal.com', 'scholarshipportal.com',
      'usnews.com/education', 'commonapp.org', 'ucas.com', 'ets.org',
      'ielts.org', 'idp.com', 'britishcouncil.org', 'mba.com',
      'studyportals.com', 'erasmus-plus.ec.europa.eu', 'internationalscholarships.com',
      'chevening.org', 'fulbrightprogram.org', 'yocket.com', 'wemakescholars.com',
      'educationusa.state.gov', 'studyincanada.com', 'studyinaustralia.gov.au',
      'study-in-sweden.se', 'campusfrance.org', 'studyinholland.nl',
      'tristareducation.com', 'apply.tristar.com', 'tristarconsultant.com',
      'timesconsultant.com', 'lunascholar.com', 'mitacs.ca', 'vfsglobal.com'
    ],
    tlds: [],
    titleKeywords: [
      'study abroad', 'studying abroad', 'international student', 'international students',
      'university ranking', 'world university rankings', 'qs ranking', 'times higher education',
      'scholarship', 'scholarships', 'fellowship', 'gre prep', 'toefl', 'ielts',
      'gmat', 'sop', 'statement of purpose', 'letter of recommendation', 'lor',
      'admissions abroad', 'masters abroad', 'phd abroad', 'erasmus', 'study in europe',
      'study in usa', 'study in uk', 'study in canada', 'study in australia',
      'foreign education', 'tuition fees', 'student visa', 'overseas education',
      'campus france', 'study in holland', 'international scholarship', 'studyportals',
      'tristar', 'ts apply', 'times consultant', 'luna scholar', 'mitacs',
      'mitacs globalink', 'globalink research internship', 'visa consultant',
      'visa appointment', 'study visa', 'study abroad visa', 'visa application', 'vfs global'
    ],
    urlKeywords: [
      'study-abroad', 'international-students', 'scholarship', 'scholarships',
      'fellowship', 'toefl', 'ielts', 'gre', 'gmat', 'erasmus', 'admissions',
      'mastersportal', 'topuniversities', 'tristar', 'timesconsultant',
      'lunascholar', 'mitacs', 'globalink', 'visa'
    ],
    subcategories: [
      {
        id: 'study_abroad_visas',
        name: 'Visas & Immigration Portals',
        domains: ['tristareducation.com', 'timesconsultant.com', 'lunascholar.com', 'mitacs.ca', 'vfsglobal.com'],
        keywords: ['ts apply', 'tristar', 'times consultant', 'luna scholar', 'mitacs', 'globalink', 'student visa', 'visa consultant', 'visa appointment', 'vfs']
      },
      {
        id: 'study_abroad_tests',
        name: 'Standardized Tests (IELTS, TOEFL, GRE)',
        domains: ['ets.org', 'ielts.org', 'mba.com', 'britishcouncil.org', 'idp.com'],
        keywords: ['ielts', 'toefl', 'gre', 'gmat', 'sat', 'exam prep', 'band score', 'percentile']
      },
      {
        id: 'study_abroad_scholarships',
        name: 'Scholarships & Funding',
        domains: ['scholarshipportal.com', 'chevening.org', 'fulbrightprogram.org', 'erasmus-plus.ec.europa.eu', 'internationalscholarships.com'],
        keywords: ['scholarship', 'fellowship', 'grant', 'funding', 'financial aid', 'chevening', 'fulbright', 'erasmus']
      },
      {
        id: 'study_abroad_admissions',
        name: 'Admissions & Rankings',
        domains: ['topuniversities.com', 'timeshighereducation.com', 'mastersportal.com', 'ucas.com', 'commonapp.org', 'yocket.com'],
        keywords: ['admissions', 'application', 'ranking', 'portal', 'requirements', 'sop', 'lor', 'eligibility', 'qs world']
      }
    ]
  },
  {
    id: 'programming',
    name: 'Programming',
    icon: '💻',
    color: '#3a86ff',
    description: 'Code repositories, developer documentation, languages, frameworks, and coding practice',
    priority: 90,
    domains: [
      'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com',
      'stackexchange.com', 'superuser.com', 'developer.mozilla.org',
      'devdocs.io', 'w3schools.com', 'geeksforgeeks.org', 'leetcode.com',
      'hackerrank.com', 'codewars.com', 'exercism.org', 'codeforces.com',
      'python.org', 'pypi.org', 'npmjs.com', 'nodejs.org', 'rust-lang.org',
      'golang.org', 'crates.io', 'pkg.go.dev', 'react.dev', 'vuejs.org',
      'angular.io', 'svelte.dev', 'nextjs.org', 'nuxtjs.org', 'typescriptlang.org',
      'tailwindcss.com', 'getbootstrap.com', 'docker.com', 'kubernetes.io',
      'terraform.io', 'ansible.com', 'linux.org', 'archlinux.org', 'ubuntu.com',
      'kernel.org', 'git-scm.com', 'regex101.com', 'postman.com', 'insomnia.rest',
      'swagger.io', 'dev.to', 'hashnode.dev', 'freecodecamp.org', 'roadmap.sh',
      'css-tricks.com', 'codepen.io', 'jsfiddle.net', 'codesandbox.io',
      'replit.com', 'glitch.com', 'cplusplus.com', 'cppreference.com',
      'ettercap-project.org', 'ettercap.org', 'xda-developers.com', 'forum.xda-developers.com',
      'kali.org', 'wireshark.org'
    ],
    tlds: ['.dev', '.io'],
    titleKeywords: [
      'programming', 'developer', 'coding', 'software engineering', 'source code',
      'repository', 'github repo', 'api documentation', 'sdk', 'python', 'javascript',
      'typescript', 'golang', 'rustlang', 'c++', 'c#', 'java programming', 'reactjs',
      'vuejs', 'html5', 'css3', 'sql query', 'postgres', 'postgresql', 'mongodb',
      'sqlite', 'redis', 'docker container', 'kubernetes cluster', 'git commit',
      'pull request', 'algorithm', 'data structure', 'leetcode', 'debugging',
      'compiler', 'framework', 'backend', 'frontend', 'fullstack', 'devops',
      'ci/cd', 'rest api', 'graphql', 'npm package', 'pypi', 'web dev', 'web development',
      'webpack', 'vite', 'npm install', 'pip install', 'cargo',
      'ettercap', 'xda developers', 'xda', 'custom rom', 'twrp', 'magisk', 'android root',
      'packet capture', 'network sniffer', 'man in the middle', 'mitm', 'penetration testing'
    ],
    urlKeywords: [
      'github', 'gitlab', 'stackoverflow', 'programming', 'developer', 'python',
      'javascript', 'typescript', 'react', 'vue', 'angular', 'golang', 'rust',
      'docker', 'kubernetes', 'leetcode', 'docs', 'api-reference', 'sdk', 'tutorial',
      'ettercap', 'xda-developers', 'wireshark'
    ],
    subcategories: [
      {
        id: 'prog_repositories',
        name: 'Repositories & Git',
        domains: ['github.com', 'gitlab.com', 'bitbucket.org', 'git-scm.com'],
        keywords: ['github', 'gitlab', 'repository', 'repo', 'pull request', 'commit', 'git']
      },
      {
        id: 'prog_docs_reference',
        name: 'Docs & Reference',
        domains: ['developer.mozilla.org', 'devdocs.io', 'w3schools.com', 'stackoverflow.com', 'geeksforgeeks.org'],
        keywords: ['documentation', 'reference', 'mdn', 'api', 'syntax', 'manual', 'stackoverflow']
      },
      {
        id: 'prog_practice',
        name: 'Practice & Algorithms',
        domains: ['leetcode.com', 'hackerrank.com', 'codewars.com', 'codeforces.com', 'exercism.org'],
        keywords: ['leetcode', 'algorithm', 'data structures', 'problem solving', 'contest', 'challenge']
      },
      {
        id: 'prog_devops_cloud',
        name: 'DevOps & Cloud',
        domains: ['docker.com', 'kubernetes.io', 'terraform.io', 'ansible.com'],
        keywords: ['docker', 'kubernetes', 'container', 'ci/cd', 'terraform', 'infrastructure', 'devops']
      }
    ]
  },
  {
    id: 'ai_technology',
    name: 'AI & Technology',
    icon: '🤖',
    color: '#8338ec',
    description: 'Artificial intelligence, LLMs, machine learning, deep learning, and frontier tech news',
    priority: 92,
    domains: [
      'openai.com', 'chatgpt.com', 'anthropic.com', 'claude.ai', 'gemini.google.com',
      'huggingface.co', 'replicate.com', 'midjourney.com', 'runwayml.com', 'poe.com',
      'perplexity.ai', 'deepmind.google', 'meta.ai', 'mistral.ai', 'groq.com',
      'ollama.com', 'lmstudio.ai', 'cohere.com', 'together.ai', 'wandb.ai',
      'pytorch.org', 'tensorflow.org', 'openreview.net', 'paperswithcode.com',
      'distill.pub', 'news.ycombinator.com', 'techcrunch.com', 'theverge.com',
      'arstechnica.com', 'wired.com', 'engadget.com', 'producthunt.com',
      'venturebeat.com', 'slashdot.org', 'stability.ai', 'elevenlabs.io',
      'vllm.ai', 'langchain.com', 'llamaindex.ai', 'pinecone.io', 'qdrant.tech',
      'build.nvidia.com', 'nvidia.com', 'mlhive.com', 'notebooklm.google.com',
      'notebooklm.google', 'unaimytext.com', 'natively.ai', 'deepseek.com',
      'cursor.com', 'v0.dev'
    ],
    tlds: ['.ai'],
    titleKeywords: [
      'artificial intelligence', 'machine learning', 'deep learning', 'large language model',
      'llm', 'neural network', 'transformer model', 'generative ai', 'genai',
      'prompt engineering', 'gpt-4', 'gpt-4o', 'gpt-5', 'claude 3', 'claude 3.5',
      'gemini pro', 'gemini flash', 'gemini ultra', 'midjourney', 'diffusion model',
      'reinforcement learning', 'computer vision', 'natural language processing', 'nlp',
      'rag', 'vector database', 'fine-tuning', 'hugging face', 'pytorch', 'tensorflow',
      'weights & biases', 'hacker news', 'tech crunch', 'the verge', 'semiconductor',
      'quantum computing', 'robotics', 'autonomous agent', 'ai agent', 'langchain',
      'llamaindex', 'ollama', 'open source llm', 'chatgpt',
      'nvidia nim', 'nvidia', 'nim microservice', 'ml hive', 'mlhive', 'gemini notebook',
      'notebooklm', 'unaimytext', 'humanize ai', 'bypass ai', 'undetectable ai',
      'natively ai', 'natively', 'deepseek', 'cursor ai', 'copilot'
    ],
    urlKeywords: [
      'openai', 'chatgpt', 'anthropic', 'claude', 'gemini', 'huggingface',
      'machine-learning', 'artificial-intelligence', 'deep-learning', 'llm',
      'neural-network', 'prompt', 'genai', 'vector-db', 'langchain', 'ollama',
      'nvidia', 'nim', 'mlhive', 'notebooklm', 'unaimytext', 'natively', 'deepseek'
    ],
    subcategories: [
      {
        id: 'ai_tools_llms',
        name: 'Modern AI Tools & LLMs',
        domains: ['build.nvidia.com', 'notebooklm.google.com', 'mlhive.com', 'unaimytext.com', 'natively.ai', 'openai.com', 'chatgpt.com', 'anthropic.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai', 'poe.com', 'ollama.com'],
        keywords: ['nvidia nim', 'notebooklm', 'gemini notebook', 'ml hive', 'unaimytext', 'natively', 'humanize ai', 'chatgpt', 'claude', 'gemini', 'assistant', 'prompt', 'chatbot', 'perplexity', 'ollama']
      },
      {
        id: 'ai_ml_frameworks',
        name: 'ML Frameworks & Libraries',
        domains: ['huggingface.co', 'pytorch.org', 'tensorflow.org', 'wandb.ai', 'langchain.com', 'llamaindex.ai'],
        keywords: ['hugging face', 'pytorch', 'tensorflow', 'model weights', 'dataset', 'fine-tune', 'pipeline', 'rag']
      },
      {
        id: 'ai_tech_news',
        name: 'Tech News & Analysis',
        domains: ['news.ycombinator.com', 'techcrunch.com', 'theverge.com', 'arstechnica.com', 'wired.com', 'producthunt.com'],
        keywords: ['hacker news', 'tech news', 'startup', 'product launch', 'silicon valley', 'venture']
      }
    ]
  },
  {
    id: 'startups_innovation',
    name: 'Startups & Innovation',
    icon: '🚀',
    color: '#f72585',
    description: 'Startup incubators, accelerators, innovation hubs, venture capital, and founder resources',
    priority: 86,
    domains: [
      'siberkoza.com', 'innovationhub.pk', 'ycombinator.com', 'techstars.com', '500.co',
      'seedcamp.com', 'antler.co', 'plugandplaytechcenter.com', 'dealroom.co',
      'crunchbase.com', 'pitchbook.com', 'f6s.com', 'gust.com', 'angellist.com',
      'startups.com', 'indiehackers.com', 'venturebeat.com', 'openvc.app'
    ],
    tlds: [],
    titleKeywords: [
      'startup', 'startups', 'incubator', 'accelerator', 'innovation hub', 'siber koza',
      'siberkoza', 'entrepreneurship', 'venture capital', 'angel investor', 'pitch deck',
      'seed funding', 'series a', 'founder', 'business plan', 'co-founder', 'scaleup',
      'hackathon', 'incubation program', 'startup ideas', 'incubators', 'accelerators'
    ],
    urlKeywords: [
      'startup', 'startups', 'incubator', 'accelerator', 'innovation', 'siberkoza',
      'venture', 'pitch', 'founder', 'funding', 'indiehackers'
    ],
    subcategories: [
      {
        id: 'startups_incubators',
        name: 'Incubators & Hubs',
        domains: ['siberkoza.com', 'ycombinator.com', 'techstars.com', 'innovationhub.pk'],
        keywords: ['siber koza', 'incubator', 'accelerator', 'innovation hub', 'co-working', 'hub', 'incubation']
      },
      {
        id: 'startups_funding',
        name: 'Venture & Funding',
        domains: ['crunchbase.com', 'pitchbook.com', 'f6s.com', 'angellist.com'],
        keywords: ['funding', 'venture capital', 'investor', 'pitch deck', 'seed funding', 'angel', 'series a']
      }
    ]
  },
  {
    id: 'gaming',
    name: 'Gaming & Emulators',
    icon: '🎮',
    color: '#7209b7',
    description: 'Video games, emulators, ROMs, game downloads, walkthroughs, and gaming communities',
    priority: 84,
    domains: [
      'tekken.com', 'steampowered.com', 'steamcommunity.com', 'epicgames.com', 'gog.com',
      'ign.com', 'gamespot.com', 'kotaku.com', 'polygon.com', 'pcgamer.com',
      'fitgirl-repacks.site', 'dodi-repacks.site', 'oceanofgames.com', 'emulatorgames.net',
      'romsgames.net', 'retrostic.com', 'vimm.net', 'retroarch.com', 'pcsx2.net',
      'rpcs3.net', 'yuzu-emu.org', 'ryujinx.org', 'ppsspp.org', 'nexusmods.com'
    ],
    tlds: [],
    titleKeywords: [
      'tekken', 'game downloads', 'pc game download', 'emulator', 'emulators', 'roms',
      'iso download', 'gameplay', 'fitgirl repack', 'dodi repack', 'video game',
      'steam game', 'playstation', 'retroarch', 'pcsx2', 'rpcs3', 'ppsspp',
      'game download', 'nintendo switch', 'xbox', 'pc games', 'esports', 'walkthrough',
      'oceanofgames', 'game repack'
    ],
    urlKeywords: [
      'tekken', 'game-download', 'emulator', 'roms', 'gameplay', 'repack',
      'retroarch', 'steam', 'games', 'oceanofgames', 'fitgirl'
    ],
    subcategories: [
      {
        id: 'gaming_emulators_roms',
        name: 'Emulators & ROMs',
        domains: ['retroarch.com', 'pcsx2.net', 'rpcs3.net', 'ppsspp.org', 'emulatorgames.net', 'romsgames.net'],
        keywords: ['emulator', 'emulators', 'rom', 'roms', 'retroarch', 'pcsx2', 'rpcs3', 'ppsspp', 'iso', 'bios']
      },
      {
        id: 'gaming_downloads',
        name: 'PC Games & Repacks',
        domains: ['tekken.com', 'steampowered.com', 'fitgirl-repacks.site', 'dodi-repacks.site', 'oceanofgames.com'],
        keywords: ['tekken', 'game download', 'repack', 'fitgirl', 'dodi', 'oceanofgames', 'steam game', 'pc game']
      }
    ]
  },
  {
    id: 'career_jobs',
    name: 'Career & Jobs',
    icon: '💼',
    color: '#fb5607',
    description: 'Job search, professional networking, resumes, interview preparation, and compensation data',
    priority: 85,
    domains: [
      'linkedin.com', 'indeed.com', 'glassdoor.com', 'wellfound.com', 'angel.co',
      'monster.com', 'ziprecruiter.com', 'simplyhired.com', 'careerbuilder.com',
      'remoteok.com', 'weworkremotely.com', 'flexjobs.com', 'upwork.com',
      'fiverr.com', 'toptal.com', 'freelancer.com', 'levels.fyi', 'teamblind.com',
      'fishbowlapp.com', 'novoresume.com', 'resume.io', 'zety.com', 'enhancv.com',
      'interviewbit.com', 'pramp.com', 'interviewing.io', 'otta.com', 'hired.com'
    ],
    tlds: [],
    titleKeywords: [
      'job search', 'careers', 'job opening', 'job listing', 'hiring', 'employment',
      'recruitment', 'headhunter', 'resume', 'curriculum vitae', 'cv template',
      'cover letter', 'job interview', 'interview questions', 'salary negotiation',
      'tech salary', 'levels fyi', 'freelance', 'job board', 'apply for job',
      'remote jobs', 'work from home', 'internship', 'job application', 'linkedin job',
      'glassdoor reviews', 'company culture', 'job vacancies'
    ],
    urlKeywords: [
      'jobs', 'careers', 'hiring', 'recruitment', 'vacancies', 'internships',
      'resume', 'cv', 'interview-prep', 'salary', 'levels.fyi'
    ],
    subcategories: [
      {
        id: 'career_job_boards',
        name: 'Job Boards & Search',
        domains: ['indeed.com', 'glassdoor.com', 'wellfound.com', 'remoteok.com', 'weworkremotely.com', 'otta.com'],
        keywords: ['jobs', 'careers', 'hiring', 'vacancy', 'remote job', 'opening', 'internship']
      },
      {
        id: 'career_resume_interview',
        name: 'Resume & Interview Prep',
        domains: ['novoresume.com', 'resume.io', 'zety.com', 'interviewing.io', 'pramp.com', 'interviewbit.com'],
        keywords: ['resume', 'cv', 'cover letter', 'interview questions', 'mock interview', 'behavioral interview']
      },
      {
        id: 'career_salary_networking',
        name: 'Networking & Salary',
        domains: ['linkedin.com', 'levels.fyi', 'teamblind.com'],
        keywords: ['linkedin', 'salary', 'compensation', 'levels.fyi', 'equity', 'blind']
      }
    ]
  },
  {
    id: 'education',
    name: 'Education',
    icon: '📚',
    color: '#2a9d8f',
    description: 'Online courses, MOOCs, certifications, study resources, solved papers, and educational encyclopedias',
    priority: 78,
    domains: [
      'coursera.org', 'edx.org', 'udemy.com', 'khanacademy.org', 'ocw.mit.edu',
      'online.stanford.edu', 'pluralsight.com', 'skillshare.com', 'brilliant.org',
      'futurelearn.com', 'alison.com', 'codecademy.com', 'datacamp.com',
      'masterclass.com', 'edureka.co', 'simplilearn.com', 'open.edu',
      'wikipedia.org', 'wikimedia.org', 'britannica.com', 'quizlet.com',
      'chegg.com', 'coursehero.com', 'wolframalpha.com', 'duolingo.com',
      'babbel.com', 'memrise.com', 'busuu.com', 'saylor.org',
      'fbise.edu.pk', 'bise.edu.pk', 'classnotes.xyz', 'mathcity.org',
      'ilmkidunya.com', 'taleem360.com'
    ],
    tlds: [],
    titleKeywords: [
      'online course', 'lecture notes', 'mooc', 'certification', 'syllabus',
      'textbook', 'homework help', 'flashcards', 'learn online', 'tutorial',
      'academy', 'training course', 'curriculum', 'study guide', 'exam prep',
      'encyclopedia', 'wikipedia', 'math solver', 'khan academy', 'coursera course',
      'udemy course', 'language learning',
      'fbise', 'federal board', 'maths notes', 'math notes', 'mathematics notes',
      'physics notes', 'chemistry notes', 'class 11', 'class 12', 'solved papers',
      'past papers', 'model papers', 'board exam', 'academic notes', 'study notes',
      'class notes', 'formula sheet'
    ],
    urlKeywords: [
      'course', 'courses', 'learn', 'tutorial', 'academy', 'lecture',
      'syllabus', 'quizlet', 'khanacademy', 'coursera', 'edx', 'udemy',
      'fbise', 'notes', 'math-notes', 'past-papers', 'solved-papers',
      'classnotes', 'mathcity'
    ],
    subcategories: [
      {
        id: 'edu_academic_notes',
        name: 'Academic Notes & Solved Papers',
        domains: ['fbise.edu.pk', 'classnotes.xyz', 'mathcity.org', 'ilmkidunya.com'],
        keywords: ['fbise', 'maths notes', 'math notes', 'solved papers', 'past papers', 'federal board', 'class 11', 'class 12', 'formula sheet', 'notes']
      },
      {
        id: 'edu_online_courses',
        name: 'Online Courses & MOOCs',
        domains: ['coursera.org', 'edx.org', 'udemy.com', 'khanacademy.org', 'ocw.mit.edu', 'pluralsight.com'],
        keywords: ['course', 'lecture', 'mooc', 'certificate', 'coursera', 'edx', 'udemy', 'specialization']
      },
      {
        id: 'edu_reference_study',
        name: 'Reference & Knowledge',
        domains: ['wikipedia.org', 'britannica.com', 'quizlet.com', 'wolframalpha.com'],
        keywords: ['wikipedia', 'flashcards', 'encyclopedia', 'study guide', 'definitions', 'wolfram']
      }
    ]
  },
  {
    id: 'research',
    name: 'Research',
    icon: '🔬',
    color: '#457b9d',
    description: 'Academic papers, scientific journals, preprints, literature reviews, and citations',
    priority: 88,
    domains: [
      'arxiv.org', 'biorxiv.org', 'medrxiv.org', 'pubmed.ncbi.nlm.nih.gov',
      'ncbi.nlm.nih.gov', 'sciencedirect.com', 'nature.com', 'science.org',
      'sciencemag.org', 'springer.com', 'wiley.com', 'tandfonline.com',
      'frontiersin.org', 'mdpi.com', 'plos.org', 'ieee.org', 'ieeexplore.ieee.org',
      'acm.org', 'dl.acm.org', 'jstor.org', 'semanticscholar.org',
      'scholar.google.com', 'researchgate.net', 'academia.edu', 'ssrn.com',
      'doi.org', 'crossref.org', 'cell.com', 'thelancet.com', 'nejm.org'
    ],
    tlds: [],
    titleKeywords: [
      'academic paper', 'journal article', 'peer review', 'proceedings',
      'conference paper', 'preprint', 'dissertation', 'thesis', 'research paper',
      'pubmed', 'arxiv', 'abstract', 'literature review', 'scientific study',
      'clinical trial', 'methodology', 'empirical study', 'citation index',
      'nature paper', 'ieee transaction'
    ],
    urlKeywords: [
      'arxiv.org', 'pubmed', 'doi.org', 'article', 'paper', 'abstract',
      'journal', 'proceedings', 'sciencedirect', 'scholar.google'
    ],
    subcategories: [
      {
        id: 'research_preprints',
        name: 'Preprints & Papers',
        domains: ['arxiv.org', 'biorxiv.org', 'medrxiv.org', 'ssrn.com'],
        keywords: ['arxiv', 'preprint', 'paper', 'manuscript', 'abs', 'pdf']
      },
      {
        id: 'research_journals',
        name: 'Peer-Reviewed Journals',
        domains: ['nature.com', 'science.org', 'sciencedirect.com', 'ieeexplore.ieee.org', 'springer.com', 'jstor.org'],
        keywords: ['journal', 'nature', 'ieee', 'springer', 'peer review', 'doi']
      }
    ]
  },
  {
    id: 'finance',
    name: 'Finance',
    icon: '💰',
    color: '#06d6a0',
    description: 'Stock markets, investing, prop trading, cryptocurrency, and financial analysis',
    priority: 82,
    domains: [
      'bloomberg.com', 'finance.yahoo.com', 'marketwatch.com', 'seekingalpha.com',
      'investing.com', 'morningstar.com', 'fool.com', 'barrons.com', 'cnbc.com',
      'ft.com', 'robinhood.com', 'vanguard.com', 'fidelity.com', 'schwab.com',
      'etrade.com', 'interactivebrokers.com', 'tradingview.com', 'coinmarketcap.com',
      'coingecko.com', 'binance.com', 'coinbase.com', 'kraken.com', 'nerdwallet.com',
      'bankrate.com', 'investopedia.com', 'revolut.com', 'wise.com', 'paypal.com',
      'the5ers.com', 'traderzone.com', 'ftmo.com', 'forexfactory.com'
    ],
    tlds: [],
    titleKeywords: [
      'finance', 'investing', 'stocks', 'stock market', 'shares', 'portfolio',
      'etf', 'index fund', 'nasdaq', 's&p 500', 'dow jones', 'crypto',
      'cryptocurrency', 'bitcoin', 'ethereum', 'blockchain', 'defi', 'dividends',
      'trading', 'forex', 'wealth management', 'personal finance', 'credit score',
      'mortgage', 'interest rate', 'tax return', 'budgeting', 'financial advisor',
      'the5ers', '5ers', 'trader zone', 'prop trading', 'prop firm', 'funded trader',
      'funded account', 'forex trading', 'forex signals', 'tradingview',
      'technical analysis', 'candlestick', 'scalping', 'day trading', 'swing trading',
      'mt4', 'mt5'
    ],
    urlKeywords: [
      'finance', 'stocks', 'investing', 'crypto', 'bitcoin', 'portfolio',
      'tradingview', 'bloomberg', 'marketwatch', 'coinmarketcap',
      'the5ers', 'trader', 'prop-firm', 'forex', 'funded-account'
    ],
    subcategories: [
      {
        id: 'fin_trading_prop',
        name: 'Trading & Prop Firms',
        domains: ['the5ers.com', 'ftmo.com', 'tradingview.com'],
        keywords: ['the5ers', '5ers', 'trader zone', 'prop trading', 'funded trader', 'forex', 'mt4', 'mt5', 'candlestick', 'tradingview']
      },
      {
        id: 'fin_stocks_investing',
        name: 'Stocks & Investing',
        domains: ['finance.yahoo.com', 'tradingview.com', 'bloomberg.com', 'marketwatch.com', 'seekingalpha.com', 'vanguard.com'],
        keywords: ['stock', 'etf', 'portfolio', 'market', 'nasdaq', 'investing', 'shares', 'tradingview']
      },
      {
        id: 'fin_crypto',
        name: 'Crypto & Web3',
        domains: ['coinmarketcap.com', 'coingecko.com', 'binance.com', 'coinbase.com'],
        keywords: ['crypto', 'bitcoin', 'btc', 'eth', 'ethereum', 'solana', 'token', 'blockchain', 'wallet']
      },
      {
        id: 'fin_personal',
        name: 'Personal Finance & Banking',
        domains: ['nerdwallet.com', 'bankrate.com', 'investopedia.com', 'wise.com', 'revolut.com'],
        keywords: ['budget', 'credit card', 'mortgage', 'savings', 'bank', 'interest rate', 'tax', 'loan']
      }
    ]
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: '🎬',
    color: '#ff006e',
    description: 'Video streaming, movies, television, music, gaming, webcomics, and recreational content',
    priority: 80,
    domains: [
      'youtube.com', 'youtu.be', 'vimeo.com', 'netflix.com', 'primevideo.com',
      'disneyplus.com', 'hulu.com', 'max.com', 'hbomax.com', 'twitch.tv',
      'spotify.com', 'soundcloud.com', 'music.apple.com', 'bandcamp.com',
      'imdb.com', 'rottentomatoes.com', 'letterboxd.com', 'myanimelist.net',
      'crunchyroll.com', 'steampowered.com', 'steamcommunity.com', 'epicgames.com',
      'gog.com', 'ign.com', 'gamespot.com', 'kotaku.com', 'polygon.com',
      'webtoons.com', 'mangadex.org'
    ],
    tlds: [],
    titleKeywords: [
      'watch online', 'official trailer', 'movie', 'tv series', 'season episode',
      'soundtrack', 'album review', 'music playlist', 'gaming', 'steam game',
      'gameplay', 'walkthrough', 'anime stream', 'manga chapter', 'streaming video',
      'cinema release', 'web series', 'podcast episode', 'netflix', 'spotify'
    ],
    urlKeywords: [
      'youtube.com/watch', 'youtu.be', 'netflix.com', 'spotify.com',
      'twitch.tv', 'steampowered.com', 'imdb.com/title', 'letterboxd.com/film'
    ],
    subcategories: [
      {
        id: 'ent_video_movies',
        name: 'Video & Movies',
        domains: ['youtube.com', 'netflix.com', 'primevideo.com', 'disneyplus.com', 'imdb.com', 'letterboxd.com'],
        keywords: ['watch', 'movie', 'film', 'trailer', 'series', 'netflix', 'youtube', 'imdb']
      },
      {
        id: 'ent_music',
        name: 'Music & Audio',
        domains: ['spotify.com', 'soundcloud.com', 'music.apple.com', 'bandcamp.com'],
        keywords: ['music', 'song', 'album', 'playlist', 'artist', 'spotify', 'track']
      },
      {
        id: 'ent_gaming',
        name: 'Gaming',
        domains: ['steampowered.com', 'twitch.tv', 'epicgames.com', 'ign.com'],
        keywords: ['game', 'steam', 'twitch', 'gamer', 'gameplay', 'walkthrough', 'playstation', 'xbox']
      }
    ]
  },
  {
    id: 'news_media',
    name: 'News & Media',
    icon: '📰',
    color: '#6c757d',
    description: 'Global news publications, journalism, breaking stories, and editorial coverage',
    priority: 70,
    domains: [
      'bbc.com', 'bbc.co.uk', 'reuters.com', 'apnews.com', 'cnn.com',
      'theguardian.com', 'nytimes.com', 'washingtonpost.com', 'aljazeera.com',
      'npr.org', 'politico.com', 'theatlantic.com', 'economist.com',
      'time.com', 'usatoday.com', 'latimes.com', 'news.google.com',
      'forbes.com'
    ],
    tlds: [],
    titleKeywords: [
      'breaking news', 'headlines', 'world news', 'politics', 'election',
      'investigative journalism', 'opinion editorial', 'press release',
      'current affairs', 'daily briefing', 'news report'
    ],
    urlKeywords: [
      'news', 'article', 'breaking', 'world', 'politics', 'opinion', 'report'
    ],
    subcategories: []
  },
  {
    id: 'shopping',
    name: 'Shopping',
    icon: '🛍️',
    color: '#ffb703',
    description: 'Online retail, e-commerce stores, product deals, and consumer goods',
    priority: 70,
    domains: [
      'amazon.com', 'amazon.de', 'amazon.co.uk', 'ebay.com', 'ebay.de',
      'aliexpress.com', 'walmart.com', 'target.com', 'bestbuy.com', 'etsy.com',
      'shein.com', 'temu.com', 'asos.com', 'zalando.de', 'otto.de',
      'ikea.com', 'newegg.com', 'rakuten.com'
    ],
    tlds: [],
    titleKeywords: [
      'buy online', 'shopping cart', 'add to cart', 'checkout', 'discount code',
      'coupon code', 'black friday', 'cyber monday', 'deals', 'promo code',
      'online store', 'order status', 'price comparison', 'shop online', 'free shipping'
    ],
    urlKeywords: [
      'product', 'item', 'dp/', 'buy', 'shop', 'cart', 'checkout', 'deal', 'discount'
    ],
    subcategories: []
  },
  {
    id: 'travel',
    name: 'Travel & Living',
    icon: '🌍',
    color: '#118ab2',
    description: 'Flight tickets, hotel bookings, vacation stays, tourism, and travel itineraries',
    priority: 70,
    domains: [
      'booking.com', 'airbnb.com', 'tripadvisor.com', 'expedia.com', 'kayak.com',
      'skyscanner.net', 'skyscanner.com', 'hotels.com', 'agoda.com',
      'hostelworld.com', 'trivago.com', 'lufthansa.com',
      'ryanair.com', 'easyjet.com', 'emirates.com', 'lonelyplanet.com',
      'rome2rio.com', 'google.com/travel'
    ],
    tlds: [],
    titleKeywords: [
      'flight booking', 'hotel reservation', 'vacation rental', 'hostel stay',
      'travel itinerary', 'sightseeing guide', 'train ticket', 'airline tickets',
      'tourism guide', 'packing list', 'airfare', 'flight deals'
    ],
    urlKeywords: [
      'flight', 'hotel', 'booking', 'rooms', 'vacation', 'travel', 'trip'
    ],
    subcategories: []
  },
  {
    id: 'tools_productivity',
    name: 'Tools & Productivity',
    icon: '🛠️',
    color: '#17c3b2',
    description: 'Productivity apps, cloud workspaces, file utilities, converters, and online tools',
    priority: 65,
    domains: [
      'notion.so', 'obsidian.md', 'trello.com', 'asana.com', 'monday.com',
      'slack.com', 'zoom.us', 'drive.google.com', 'docs.google.com',
      'sheets.google.com', 'dropbox.com', 'box.com', 'onedrive.live.com',
      'deepl.com', 'translate.google.com', 'bitly.com', 'tinyurl.com',
      'speedtest.net', '1password.com', 'bitwarden.com', 'lastpass.com',
      'calculator.net', 'convertonline.com', 'miro.com', 'airtable.com',
      'internetdownloadmanager.com', 'snapany.com', 'savefrom.net', 'snaptik.app', 'cobalt.tools'
    ],
    tlds: [],
    titleKeywords: [
      'productivity', 'task manager', 'project management', 'cloud storage',
      'file converter', 'translation tool', 'url shortener', 'password manager',
      'calculator', 'speed test', 'online utility', 'whiteboard', 'workspace', 'converter',
      'idm', 'internet download manager', 'idm extension', 'video downloader',
      'reels downloader', 'instagram downloader', 'tiktok downloader', 'youtube downloader'
    ],
    urlKeywords: [
      'tool', 'converter', 'calculator', 'translate', 'shorten', 'speedtest', 'generator',
      'idm', 'downloader', 'snapany', 'savefrom', 'snaptik'
    ],
    subcategories: []
  },
  {
    id: 'design_creative',
    name: 'Design & Creative',
    icon: '🎨',
    color: '#d90429',
    description: 'UI/UX design, inspiration, fonts, color palettes, vector assets, and creative portfolios',
    priority: 75,
    domains: [
      'figma.com', 'dribbble.com', 'behance.net', 'unsplash.com', 'pexels.com',
      'pixabay.com', 'freepik.com', 'flaticon.com', 'fontawesome.com',
      'coolors.co', 'colorhunt.co', 'fontpair.co', 'fonts.google.com',
      'typewolf.com', 'awwwards.com', 'adobe.com', 'canva.com'
    ],
    tlds: [],
    titleKeywords: [
      'ui design', 'ux design', 'typography', 'wireframe', 'prototype',
      'graphic design', 'color palette', 'vector icons', 'stock photos',
      'design inspiration', 'illustration', 'figma community', 'user interface'
    ],
    urlKeywords: [
      'design', 'palette', 'icons', 'fonts', 'ui', 'ux', 'vector', 'illustrations'
    ],
    subcategories: []
  },
  {
    id: 'health_wellness',
    name: 'Health & Fitness',
    icon: '🏥',
    color: '#588157',
    description: 'Medical health references, fitness, workouts, nutrition, and mental wellbeing',
    priority: 76,
    domains: [
      'webmd.com', 'healthline.com', 'mayoclinic.org', 'who.int', 'cdc.gov',
      'nih.gov', 'myfitnesspal.com', 'strava.com', 'fitbit.com', 'calm.com',
      'headspace.com', 'bodybuilding.com', 'everydayhealth.com',
      'musclewiki.com', 'nutrifactor.com', 'examine.com'
    ],
    tlds: [],
    titleKeywords: [
      'fitness', 'workout routine', 'nutrition', 'diet plan', 'calorie counter',
      'medical symptoms', 'mental health', 'meditation', 'wellness', 'sleep hygiene',
      'cardio workout', 'healthy recipes', 'medicine',
      'musclewiki', 'muscle wiki', 'nutrifactor', 'multivitamin', 'supplements',
      'whey protein', 'creatine', 'brain function', 'cognitive enhancement',
      'nootropics', 'hypertrophy', 'bicep workout', 'chest workout', 'gym workout',
      'stretching', 'calisthenics'
    ],
    urlKeywords: [
      'health', 'fitness', 'workout', 'diet', 'nutrition', 'symptoms', 'meditation',
      'musclewiki', 'nutrifactor', 'supplements', 'vitamins'
    ],
    subcategories: [
      {
        id: 'health_exercises',
        name: 'Workouts & Exercises',
        domains: ['musclewiki.com'],
        keywords: ['musclewiki', 'hypertrophy', 'workout', 'gym', 'exercise', 'calisthenics', 'stretching', 'bicep', 'chest']
      },
      {
        id: 'health_supplements',
        name: 'Supplements & Nutrition',
        domains: ['nutrifactor.com', 'examine.com'],
        keywords: ['nutrifactor', 'supplements', 'vitamins', 'multivitamin', 'whey', 'protein', 'brain function', 'nootropics', 'diet']
      }
    ]
  },
  {
    id: 'social_community',
    name: 'Social & Community',
    icon: '💬',
    color: '#7209b7',
    description: 'Social networking platforms, online communities, forums, and chat apps',
    priority: 60,
    domains: [
      'reddit.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
      'threads.net', 'mastodon.social', 'bluesky.app', 'bsky.app',
      'discord.com', 'telegram.org', 'web.whatsapp.com', 'messenger.com'
    ],
    tlds: [],
    titleKeywords: [
      'social media', 'subreddit', 'discussion forum', 'community chat',
      'direct message', 'tweet', 'discussion thread'
    ],
    urlKeywords: [
      'reddit.com/r/', 'twitter.com', 'x.com', 'instagram.com', 'discord.com'
    ],
    subcategories: []
  }
];

export const OTHER_CATEGORY = {
  id: 'other',
  name: 'Uncategorized (Needs Review)',
  icon: '❓',
  color: '#8d99ae',
  description: 'Uncategorized bookmarks requiring user review',
  priority: 0,
  subcategories: []
};
