'use strict';
/** Approved landing-page copy — 23 September 2026. Edit proposals in project-docs/CONTENT-REVIEW.md.
 * Keep IDs stable. Blank intros stay blank. No HTML is needed in these fields.
 * Page headers, Explore slides, navigation and search all read this file.
 */
const SITE = {
  name: 'Ronu.one',
  sectionOrder: ['triathlon', 'science', 'markets', 'maker'],
  footer: 'Rafael Renó',
  carousel: {intervalMs: 8000, autoplay: true, introParagraphs: 1},
  labels: {
    sections: 'Sections', articles: 'Articles', images: 'Maker images',
    pause: 'Pause', play: 'Play', previous: 'Previous', next: 'Next',
    chooseSection: 'Choose a section', chooseImage: 'Choose an image',
    imageError: 'This image could not load. Open the original.',
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
    intro: "I set a goal, make a plan and start training. A lot of it is repetition, with adjustments along the way.\n\nSometimes I go further than I expected. Other times, I can’t finish something I’ve done before. And I start wondering why. What changed? Was it the training, the recovery, something else?\n\nI enjoy the sport, but I also like figuring out what’s happening in my body and what I could do differently. There’s a lot I still don’t understand. That’s part of what keeps me interested.",
    articleIds: ['endurance']
  },
  science: {
    name: 'Science', kind: 'articles', icon: 'prediction',
    start: 'Finding patterns ', end: 'within the chaos.',
    intro: "Some everyday things make me curious. Why does traffic stop when nothing is blocking the road? Why is a roll of the dice so hard to predict?\n\nI like looking for the rules and patterns behind what I see.",
    articleIds: ['prediction']
  },
  markets: {
    name: 'Markets', kind: 'articles', icon: 'markets',
    start: 'Pricing the future ', end: 'before it happens.',
    intro: "Will rates fall? What will the dollar be worth tomorrow? What drives prices? And what happens if the forecast is wrong?\n\nI’m always trying to make the best decision the data can support. But in the end, the market doesn’t care.",
    articleIds: []
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
  images: [
    {id: 'football', title: 'Football at night', src: '/assets/young-memory.svg', alt: 'A night-time football scene viewed through a fence.'},
    {id: 'manhattan', title: 'Manhattan reflections', src: '/assets/present-reflection.webp', alt: 'A reflective night-time view toward the Manhattan skyline.'},
    {id: 'runner', title: 'Night runner', src: '/assets/runner-card.jpg', alt: 'A runner beside the waterfront at night.'}
  ]
};
