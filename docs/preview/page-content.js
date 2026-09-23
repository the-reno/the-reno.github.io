'use strict';
/** Published landing-page copy. Edit proposals in project-docs/CONTENT-REVIEW.md.
 * Keep IDs stable. Blank intros stay blank. No HTML is needed in these fields.
 * Page headers, Explore slides, navigation and search all read this file.
 */
const SITE = {
  name: 'Ronu.one',
  sectionOrder: ['triathlon', 'science', 'markets', 'maker'],
  previewNote: 'DESIGN PREVIEW · Unlinked from the main website',
  footer: 'A personal lab. An unlinked design preview.',
  carousel: {intervalMs: 8000, autoplay: true},
  labels: {
    sections: 'Sections', articles: 'Articles', images: 'Maker images',
    pause: 'Pause', play: 'Play', previous: 'Previous', next: 'Next',
    chooseSection: 'Choose a section', chooseImage: 'Choose an image',
    openImage: 'View image ↗', imageError: 'This image could not load. Open the original.',
    searchPlaceholder: 'What are you curious about?'
  }
};

// kind selects the collection below the shared page header.
const MAIN_PAGES = {
  all: {
    name: 'Explore', kind: 'sections',
    start: 'Stay ', end: 'curious.', breakSentence: false,
    intro: 'Welcome to my lab.\nIdeas to explore. Models to test. Things to build.'
  },
  triathlon: {
    name: 'Triathlon', kind: 'articles', icon: 'endurance',
    start: 'Getting comfortable ', end: 'with discomfort.',
    intro: 'For me, triathlon is a process of adaptation. Through practice and discipline, I explore how the body responds to effort and how its limits change.',
    articleIds: ['endurance']
  },
  science: {
    name: 'Science', kind: 'articles', icon: 'prediction',
    start: 'Finding patterns ', end: 'within the chaos.',
    intro: 'I use ordinary events to explore the patterns and laws behind them. Simple models help me test explanations and see where prediction reaches its limits.',
    articleIds: ['prediction']
  },
  markets: {
    name: 'Markets', kind: 'articles', icon: 'markets',
    start: 'Pricing the future ', end: 'before it happens.',
    intro: 'I use data and models to compare possible futures. The aim is to understand the trade-offs and make the best decision the available information supports.',
    articleIds: [],
    sample: {
      id: 'market-future', title: 'Pricing the future', icon: 'markets',
      summary: 'Compare rate scenarios before allocating cash.',
      status: 'Layout sample · Not published'
    }
  },
  maker: {
    name: 'Maker', kind: 'gallery', icon: 'maker',
    start: 'What happens when ', end: 'an idea becomes real?',
    intro: ''
  }
};

// Short card summaries only. Full article metadata remains in content.js.
const ARTICLE_PREVIEWS = {
  endurance: {icon: 'endurance', summary: 'How fuel and movement sustain effort.'},
  prediction: {icon: 'prediction', summary: 'Patterns and uncertainty, starting with a roll of the dice.'}
};
const MAKER_GALLERY = {
  description: 'Scenes, memories and movement.',
  images: [
    {id: 'football', title: 'Football at night', src: '/assets/young-memory.svg', alt: 'A night-time football scene viewed through a fence.'},
    {id: 'manhattan', title: 'Manhattan reflections', src: '/assets/present-reflection.webp', alt: 'A reflective night-time view toward the Manhattan skyline.'},
    {id: 'runner', title: 'Night runner', src: '/assets/runner-card.jpg', alt: 'A runner beside the waterfront at night.'}
  ]
};
