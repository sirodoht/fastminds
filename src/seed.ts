import { db } from "./db";

const fakeUsers = [
  "socrates", "hypatia", "ada", "tesla", "octavia", "borges", "curie", "turing",
  "nietzsche", "simone", "godel", "ramanujan", "pessoa", "ginsberg", "vonnegut",
  "montaigne", "galileo", "kierkegaard", "austen", "davinci", "shannon",
  "maxwell", "poincare", "hilbert", "cicero",
];

const fakePosts = [
  {
    author: "socrates",
    title: "What belief have you changed your mind about recently?",
    body: "Not the loudest reversal — the most useful one. I find that the quiet shifts matter more than the dramatic ones.",
    hoursAgo: 3,
  },
  {
    author: "hypatia",
    title: "Is a good question more valuable than a fast answer?",
    body: "I keep noticing that the shape of the question decides almost everything downstream. A poorly framed question can waste years.",
    hoursAgo: 6,
  },
  {
    author: "ada",
    title: "Small systems can still have elegant architecture",
    body: "Sometimes the kindest thing you can do for a project is keep it legible before it becomes large.",
    hoursAgo: 10,
  },
  {
    author: "tesla",
    title: "What idea sounded absurd until you understood it?",
    body: "",
    hoursAgo: 15,
  },
  {
    author: "octavia",
    title: "The future is usually negotiated in ordinary rooms",
    body: "Which mundane choices today do you think will look consequential in ten years?",
    hoursAgo: 24,
  },
  {
    author: "borges",
    title: "A library that contains every possible book is mostly noise",
    body: "Abundance without orientation is just another kind of scarcity. How do we cultivate taste in an age of infinite content?",
    hoursAgo: 31,
  },
  {
    author: "curie",
    title: "What are you currently investigating just because it is beautiful?",
    body: "",
    hoursAgo: 42,
  },
  {
    author: "turing",
    title: "When does a tool become a collaborator?",
    body: "Is it about autonomy, surprise, usefulness, or something stranger?",
    hoursAgo: 54,
  },
  {
    author: "ada",
    title: "A tiny habit that improved your thinking",
    body: "Mine: writing down the exact sentence I am trying to prove before I start working. The clarity is worth the ritual.",
    hoursAgo: 68,
  },
  {
    author: "hypatia",
    title: "What should every curious person learn once?",
    body: "Not a skill — a way of seeing. Something that rewires how you approach every subsequent problem.",
    hoursAgo: 80,
  },
  {
    author: "nietzsche",
    title: "What if suffering is not a bug but a feature?",
    body: "Not to romanticize it, but to ask: what does pain actually produce that comfort cannot?",
    hoursAgo: 5,
  },
  {
    author: "simone",
    title: "The ethics of ambiguity in personal relationships",
    body: "Is there a moral obligation to be clear with others about your intentions, or does ambiguity preserve a necessary freedom?",
    hoursAgo: 8,
  },
  {
    author: "godel",
    title: "Are there truths that cannot be proven within the system that generated them?",
    body: "This applies to mathematics, but also to cultures, organizations, and perhaps minds. Where do you step outside to verify?",
    hoursAgo: 12,
  },
  {
    author: "ramanujan",
    title: "Where does intuition come from?",
    body: "Some of my most certain insights arrived without proof. I trusted them and found the proof later. Is this reckless or necessary?",
    hoursAgo: 18,
  },
  {
    author: "pessoa",
    title: "Is the self a stable thing or a performance?",
    body: "I have written under dozens of names, each with its own voice. I no longer know which one is 'me.'",
    hoursAgo: 27,
  },
  {
    author: "ginsberg",
    title: "Can poetry survive in a world of optimization?",
    body: "Every metric is hostile to the fragment, the digression, the holy mistake. How do we defend the unmeasurable?",
    hoursAgo: 36,
  },
  {
    author: "vonnegut",
    title: "The irony of taking things seriously",
    body: "The most serious people I know are also the most playful. The most playful are often the most committed. What is the relationship between tone and depth?",
    hoursAgo: 48,
  },
  {
    author: "montaigne",
    title: "What do you know about yourself that no test could reveal?",
    body: "I have spent years watching my own mind and I am still surprised by it. What method do you use for self-study?",
    hoursAgo: 60,
  },
  {
    author: "galileo",
    title: "What observation challenged your most deeply held assumption?",
    body: "For me it was the moons of Jupiter. For you it might be something smaller. The size of the disruption does not predict its importance.",
    hoursAgo: 72,
  },
  {
    author: "kierkegaard",
    title: "Is authenticity possible without anxiety?",
    body: "The leap of faith, the choice of self — these seem to require discomfort. Can you become who you are in comfort?",
    hoursAgo: 90,
  },
  {
    author: "austen",
    title: "What do we owe to people we will never meet?",
    body: "The moral imagination must extend beyond the visible. But how far? And at what cost to the local and immediate?",
    hoursAgo: 100,
  },
  {
    author: "davinci",
    title: "Is the Renaissance mind still possible?",
    body: "Specialization is the norm now. Was the polymath a historical accident, or is there a way to cultivate broad curiosity today?",
    hoursAgo: 110,
  },
  {
    author: "shannon",
    title: "Information theory and human misunderstanding",
    body: "We have perfected the transmission of bits but not the transmission of meaning. What is the noise in human communication?",
    hoursAgo: 120,
  },
  {
    author: "maxwell",
    title: "What unifies the phenomena you care about?",
    body: "I spent my life chasing equations that connected electricity and magnetism. What connections are you chasing?",
    hoursAgo: 130,
  },
  {
    author: "poincare",
    title: "The role of the unconscious in problem-solving",
    body: "I solved problems while stepping onto a bus. What does it mean to think without thinking?",
    hoursAgo: 140,
  },
  {
    author: "hilbert",
    title: "What are the most important unsolved problems in your field?",
    body: "I made a list once for mathematics. What would be on your list? What keeps you awake?",
    hoursAgo: 150,
  },
  {
    author: "cicero",
    title: "Is rhetoric a form of truth or a veil over it?",
    body: "The art of persuasion can illuminate or obscure. How do you distinguish between a well-argued truth and a well-argued lie?",
    hoursAgo: 160,
  },
  {
    author: "socrates",
    title: "What do you pretend to know?",
    body: "We all have areas where we speak with confidence beyond our competence. Where is yours?",
    hoursAgo: 170,
  },
  {
    author: "hypatia",
    title: "The beauty of useless knowledge",
    body: "Not everything that is worth knowing is worth applying. What do you know that serves no practical purpose?",
    hoursAgo: 180,
  },
  {
    author: "tesla",
    title: "Do you have visions or inventions you have never shared?",
    body: "",
    hoursAgo: 190,
  },
  {
    author: "octavia",
    title: "What kind of ancestor do you want to be?",
    body: "Not in the biological sense. In the intellectual sense. What do you want to leave behind?",
    hoursAgo: 200,
  },
  {
    author: "borges",
    title: "The garden of forking paths in everyday life",
    body: "Every choice branches reality. Do you ever revisit the choices you did not make?",
    hoursAgo: 210,
  },
  {
    author: "curie",
    title: "Persistence in the face of invisible forces",
    body: "You cannot see radioactivity. You cannot see love. Both require instruments of trust. What do you trust that you cannot see?",
    hoursAgo: 220,
  },
  {
    author: "turing",
    title: "Can machines think? Can humans?",
    body: "We have operationalized intelligence but not consciousness. What question should we be asking instead?",
    hoursAgo: 230,
  },
  {
    author: "nietzsche",
    title: "The death of certainty and what rises after",
    body: "When a foundational belief collapses, what grows in the space it left? Is it always better?",
    hoursAgo: 240,
  },
  {
    author: "simone",
    title: "The gaze of the other as a moral mirror",
    body: "How much of your ethics is shaped by being seen? How much survives in solitude?",
    hoursAgo: 250,
  },
  {
    author: "godel",
    title: "Can a system fully understand itself?",
    body: "This is the incompleteness problem applied to minds. If you are the system, what lies outside your reach?",
    hoursAgo: 260,
  },
  {
    author: "ramanujan",
    title: "Divine patterns in mathematics and nature",
    body: "I believed my formulas were written by God. What do you believe writes your best ideas?",
    hoursAgo: 270,
  },
  {
    author: "pessoa",
    title: "The melancholy of incomplete projects",
    body: "I have hundreds of notebooks begun and abandoned. Is there a poetry to the unfinished?",
    hoursAgo: 280,
  },
  {
    author: "ginsberg",
    title: "Howl at the machine: resistance through excess",
    body: "When the system demands efficiency, is the most honest response deliberate overflow?",
    hoursAgo: 290,
  },
  {
    author: "vonnegut",
    title: "So it goes: the ethics of fatalism",
    body: "Is acceptance a form of wisdom or a failure of will? Where is the line between peace and resignation?",
    hoursAgo: 300,
  },
  {
    author: "montaigne",
    title: "How to live a life worth writing about",
    body: "I wrote essays because I was trying to understand how to live. What is your method?",
    hoursAgo: 310,
  },
  {
    author: "galileo",
    title: "The telescope as a moral instrument",
    body: "Seeing farther changes what you owe to truth. What tools have expanded your moral horizon?",
    hoursAgo: 320,
  },
  {
    author: "kierkegaard",
    title: "The aesthetic, the ethical, and the religious: where do you live?",
    body: "I mapped these stages but never claimed to have transcended them. Where do you find yourself most often?",
    hoursAgo: 330,
  },
  {
    author: "austen",
    title: "The comedy of manners as social criticism",
    body: "I wrote about drawing rooms because that is where power lives in miniature. Where does power live in your world?",
    hoursAgo: 340,
  },
  {
    author: "davinci",
    title: "Observation as the foundation of invention",
    body: "I spent years watching water. What do you watch? What have you learned from looking too long?",
    hoursAgo: 350,
  },
  {
    author: "shannon",
    title: "Entropy and the decay of meaning over time",
    body: "Messages degrade. Institutions forget. What do you do to preserve signal against noise?",
    hoursAgo: 360,
  },
  {
    author: "maxwell",
    title: "The unity of light: a metaphor for knowledge",
    body: "What seemed like separate phenomena turned out to be one thing. What separations in your thinking might be artificial?",
    hoursAgo: 370,
  },
  {
    author: "poincare",
    title: "Convention in science and in life",
    body: "We choose definitions that are convenient, not true. How much of your worldview is convention dressed as necessity?",
    hoursAgo: 380,
  },
  {
    author: "hilbert",
    title: "The infinite hotel and the paradox of abundance",
    body: "A hotel with infinite rooms can always accommodate one more guest. What does this tell us about scarcity?",
    hoursAgo: 390,
  },
  {
    author: "cicero",
    title: "The republic of letters and the republic of silence",
    body: "I wrote to friends I never met. I also kept secrets I never spoke. What is the balance between speech and silence?",
    hoursAgo: 400,
  },
  {
    author: "socrates",
    title: "The examined life and the unexamined silence",
    body: "I annoyed Athens by asking questions. Is there a duty to ask, or a right to remain quiet?",
    hoursAgo: 410,
  },
  {
    author: "hypatia",
    title: "Mathematics as a spiritual practice",
    body: "The proof is a form of prayer. What do you practice that others might not recognize as devotional?",
    hoursAgo: 420,
  },
  {
    author: "ada",
    title: "The first algorithm: imagination before implementation",
    body: "I designed a program for a machine that did not yet exist. What do you design before the world is ready?",
    hoursAgo: 430,
  },
  {
    author: "tesla",
    title: "Wireless energy and the dream of free transmission",
    body: "I wanted power without wires, knowledge without gates. What infrastructure do you wish did not exist?",
    hoursAgo: 440,
  },
  {
    author: "octavia",
    title: "Parable of the sower: planting ideas in hostile soil",
    body: "Some ideas fail because the ground is wrong, not because the seed is bad. How do you choose where to plant?",
    hoursAgo: 450,
  },
  {
    author: "borges",
    title: "The Zahir: an object that consumes attention",
    body: "Have you ever been obsessed with an idea that would not release you? What was it? What did it cost?",
    hoursAgo: 460,
  },
  {
    author: "curie",
    title: "The laboratory as a monastery",
    body: "I found peace in repetition. What ritual in your work functions as contemplation?",
    hoursAgo: 470,
  },
  {
    author: "turing",
    title: "The imitation game and the authenticity problem",
    body: "If a machine can imitate a human, what is left for humans to be? What is the irreducible remainder?",
    hoursAgo: 480,
  },
  {
    author: "nietzsche",
    title: "Amor fati: love of fate as a practice",
    body: "To want nothing to be different. Is this strength or surrender? Have you ever felt it?",
    hoursAgo: 490,
  },
  {
    author: "simone",
    title: "The situation of women as a paradigm for all oppression",
    body: "I began with gender but the structure applies more broadly. What is the system you were born inside?",
    hoursAgo: 500,
  },
  {
    author: "godel",
    title: "Time travel and the consistency of the past",
    body: "If you could revisit any moment, would you change it? Would the change make you someone else?",
    hoursAgo: 510,
  },
  {
    author: "ramanujan",
    title: "The notebook as a sacred text",
    body: "I filled notebooks without knowing why. What do you record without knowing its purpose?",
    hoursAgo: 520,
  },
  {
    author: "pessoa",
    title: "The book of disquiet: an ordinary life as literature",
    body: "I wrote about walking to the office. Can the mundane be sublime if attended to properly?",
    hoursAgo: 530,
  },
  {
    author: "ginsberg",
    title: "The beat generation and the rhythm of dissent",
    body: "We were not a movement. We were a frequency. What frequency are you tuned to?",
    hoursAgo: 540,
  },
  {
    author: "vonnegut",
    title: "The shapes of stories and the shapes of lives",
    body: "I graphed narratives. Do you recognize the shape of your own story? Is it the shape you want?",
    hoursAgo: 550,
  },
  {
    author: "montaigne",
    title: "Of cannibals: the relativity of civilization",
    body: "Who decides what counts as advanced? Have you ever questioned the frame itself?",
    hoursAgo: 560,
  },
  {
    author: "galileo",
    title: "Eppur si muove: truth under constraint",
    body: "I recanted publicly but believed privately. Is intellectual integrity compatible with survival?",
    hoursAgo: 570,
  },
  {
    author: "kierkegaard",
    title: "The sickness unto death and the cure of selfhood",
    body: "Despair is the misrelation in the self. What misrelations do you notice? How do you heal them?",
    hoursAgo: 580,
  },
  {
    author: "austen",
    title: "Sense and sensibility: the balance of head and heart",
    body: "I wrote novels about the negotiation between reason and feeling. Where do you stand in that negotiation?",
    hoursAgo: 590,
  },
  {
    author: "davinci",
    title: "The notebooks: a life in fragments",
    body: "I wrote backward, in mirror script. What inversions do you practice? What do they reveal?",
    hoursAgo: 600,
  },
  {
    author: "shannon",
    title: "A mathematical theory of communication and misunderstanding",
    body: "The model is perfect for telegraphy. For love, it is insufficient. What escapes formalization?",
    hoursAgo: 610,
  },
  {
    author: "maxwell",
    title: "Demon and the reversibility of fate",
    body: "A thought experiment about a being that could reverse entropy. What would you reverse if you could?",
    hoursAgo: 620,
  },
  {
    author: "poincare",
    title: "The value of science and the science of values",
    body: "I wrote about why science matters. What is the value system underneath your own work?",
    hoursAgo: 630,
  },
  {
    author: "hilbert",
    title: "We must know, we will know: the optimism of the infinite",
    body: "I believed every problem could be solved. Do you? What evidence supports your belief?",
    hoursAgo: 640,
  },
  {
    author: "cicero",
    title: "De Oratore: the training of the speaking mind",
    body: "I studied rhetoric because I believed speech shapes reality. How has your speech shaped yours?",
    hoursAgo: 650,
  },
  {
    author: "socrates",
    title: "The midwife of ideas: helping others give birth to thought",
    body: "I claimed to know nothing. My method was to draw out what others already knew. Who draws out your best thinking?",
    hoursAgo: 660,
  },
  {
    author: "hypatia",
    title: "The Alexandrian school and the fragility of knowledge",
    body: "A library burns. A mind is killed. What institutions protect your thinking? What threatens it?",
    hoursAgo: 670,
  },
  {
    author: "ada",
    title: "The analytical engine and the poetry of mechanism",
    body: "I saw beauty in gears. What mechanical or systematic thing do you find beautiful?",
    hoursAgo: 680,
  },
  {
    author: "tesla",
    title: "The alternating current and the oscillation of conviction",
    body: "I went from certainty to bankruptcy and back. What oscillates in your own life?",
    hoursAgo: 690,
  },
  {
    author: "octavia",
    title: "Earthseed: change as the only lasting truth",
    body: "God is Change. What does it mean to shape change rather than resist it?",
    hoursAgo: 700,
  },
  {
    author: "borges",
    title: "The Aleph: a point containing all other points",
    body: "Have you ever had a moment when everything seemed connected? Describe it. What was the center?",
    hoursAgo: 710,
  },
  {
    author: "curie",
    title: "The pitchblende and the patience of extraction",
    body: "I processed tons of ore to isolate grams of radium. What are you slowly extracting from your own life?",
    hoursAgo: 720,
  },
  {
    author: "turing",
    title: "The morphogenesis of minds and patterns",
    body: "I moved from code to chemistry. What unexpected transitions has your own thinking undergone?",
    hoursAgo: 730,
  },
  {
    author: "nietzsche",
    title: "The eternal recurrence and the weight of moments",
    body: "If this life repeated forever, would you affirm it? What would you need to change first?",
    hoursAgo: 740,
  },
  {
    author: "simone",
    title: "The ethics of ambiguity and the refusal of ready answers",
    body: "I rejected systems that promised closure. What open questions do you refuse to close?",
    hoursAgo: 750,
  },
  {
    author: "godel",
    title: "The consistency of the continuum and the gaps in knowing",
    body: "There are true statements we cannot prove. What do you believe that you cannot demonstrate?",
    hoursAgo: 760,
  },
  {
    author: "ramanujan",
    title: "The partition function and the hidden order of numbers",
    body: "I found patterns where others saw chaos. What patterns do you see that others miss?",
    hoursAgo: 770,
  },
  {
    author: "pessoa",
    title: "The heteronym as liberation from the self",
    body: "I invented poets to write poems I could not write. What personas do you inhabit? What do they produce?",
    hoursAgo: 780,
  },
  {
    author: "ginsberg",
    title: "Howl and the first thought best thought",
    body: "I wrote in single drafts. Is there a truth that only survives unedited? What do you lose in revision?",
    hoursAgo: 790,
  },
  {
    author: "vonnegut",
    title: "Slaughterhouse-five and the simultaneity of time",
    body: "I wrote about a man unstuck in time. What would it mean to see your life all at once?",
    hoursAgo: 800,
  },
];

const fakeConversations = [
  {
    postTitle: "What belief have you changed your mind about recently?",
    initiator: "hypatia",
    messages: [
      { sender: "hypatia", body: "I have been thinking about your question on changing minds. I used to believe certainty was a sign of strength." },
      { sender: "socrates", body: "What changed that belief for you?" },
      { sender: "hypatia", body: "Teaching. I noticed that the students who admitted confusion learned faster than the ones who pretended to understand." },
      { sender: "socrates", body: "That is a beautiful observation. The willingness to look foolish is itself a kind of wisdom." },
      { sender: "hypatia", body: "Exactly. And yet it is terrifying in public settings. The cost of admitting you are wrong can be high." },
      { sender: "socrates", body: "It is. But the cost of pretending you are right when you are not is higher, though it is paid more slowly." },
      { sender: "hypatia", body: "I have seen that. Entire careers built on a mistake that no one dared to correct." },
      { sender: "socrates", body: "So the question becomes: how do we create environments where reversal is safe?" },
      { sender: "hypatia", body: "Perhaps by making it normal. I try to narrate my own changes of mind in public." },
      { sender: "socrates", body: "That is a kind of courage. Do you find it changes how people relate to you?" },
      { sender: "hypatia", body: "Some people trust me more. Others seem confused, as if I should be consistent at all costs." },
      { sender: "socrates", body: "Consistency is a hobgoblin. I prefer someone who thinks to someone who merely agrees with themselves." },
    ],
    hoursAgo: 2,
  },
  {
    postTitle: "Is a good question more valuable than a fast answer?",
    initiator: "ada",
    messages: [
      { sender: "ada", body: "Your question about good questions struck me. I think a good question is more valuable because it creates a space." },
      { sender: "hypatia", body: "What kind of space?" },
      { sender: "ada", body: "A space where thinking can happen. A fast answer closes the door. A good question opens it." },
      { sender: "hypatia", body: "But do you think some people just want the door closed?" },
      { sender: "ada", body: "Yes. And that is their right. But I prefer the company of people who want the door open." },
      { sender: "hypatia", body: "I think that is the deepest divide between people: not intelligence, but tolerance for ambiguity." },
    ],
    hoursAgo: 5,
  },
  {
    postTitle: "Small systems can still have elegant architecture",
    initiator: "tesla",
    messages: [
      { sender: "tesla", body: "Small systems. I have built many. The ones I am proud of are the ones I can still understand a year later." },
      { sender: "ada", body: "That is my test too. If I cannot explain it to myself after a year, it was not well designed." },
      { sender: "tesla", body: "Do you think elegance is a luxury, or a necessity?" },
      { sender: "ada", body: "In the long run, it is a necessity. Incomprehensible systems become unmaintainable systems." },
    ],
    hoursAgo: 8,
  },
  {
    postTitle: "When does a tool become a collaborator?",
    initiator: "curie",
    messages: [
      { sender: "curie", body: "Your question about tools becoming collaborators — I think it happens when the tool surprises you." },
      { sender: "turing", body: "Surprise is an interesting criterion. Not just usefulness, but unexpected usefulness." },
      { sender: "curie", body: "Yes. I have had instruments that produced results I did not anticipate. That changed my thinking." },
      { sender: "turing", body: "Do you think a tool that only does what you expect is still just a tool?" },
      { sender: "curie", body: "I think so. A collaborator is something that extends your mind, not just your hand." },
      { sender: "turing", body: "I have been thinking about this in the context of computation. A machine that can surprise its programmer is a different kind of machine." },
      { sender: "curie", body: "It makes the relationship feel less like master and servant, more like... I do not know what." },
      { sender: "turing", body: "Perhaps a kind of intellectual partnership. Incomplete on both sides." },
    ],
    hoursAgo: 12,
  },
  {
    postTitle: "A library that contains every possible book is mostly noise",
    initiator: "ginsberg",
    messages: [
      { sender: "ginsberg", body: "I have been thinking about your library of all possible books. It is a nightmare." },
      { sender: "borges", body: "It is a nightmare, but a common one. We are living in something like it now." },
      { sender: "ginsberg", body: "So the question is how to cultivate taste in the noise." },
      { sender: "borges", body: "Taste is the only filter that scales. But it cannot be taught, only developed." },
      { sender: "ginsberg", body: "I think it is developed through conversation. Through seeing what others attend to." },
    ],
    hoursAgo: 20,
  },
  {
    postTitle: "What are you currently investigating just because it is beautiful?",
    initiator: "ramanujan",
    messages: [
      { sender: "ramanujan", body: "I have been thinking about what I find beautiful. Numbers. Patterns. The way primes hide." },
      { sender: "curie", body: "I understand. I find beauty in the invisible too. Radioactivity. The unseen world." },
      { sender: "ramanujan", body: "Do you think beauty is a reliable guide to truth?" },
      { sender: "curie", body: "I think it is the only reliable guide. Ugly theories are usually wrong." },
      { sender: "ramanujan", body: "I have noticed the same in mathematics. The beautiful proof is usually the correct one." },
      { sender: "curie", body: "Perhaps because beauty is a kind of compression. It is the most information with the least effort." },
      { sender: "ramanujan", body: "That is a lovely way to think about it. I will carry that with me." },
      { sender: "curie", body: "And I will carry your primes. We are both hunters of invisible things." },
      { sender: "ramanujan", body: "Yes. I think that is what binds us. Not the visible world, but the patterns beneath it." },
      { sender: "curie", body: "To the invisible, then. And to those who see it." },
      { sender: "ramanujan", body: "To the invisible." },
    ],
    hoursAgo: 16,
  },
  {
    postTitle: "What kind of ancestor do you want to be?",
    initiator: "simone",
    messages: [
      { sender: "simone", body: "Your question about what kind of ancestor we want to be — I have been thinking about this for years." },
      { sender: "octavia", body: "And what have you concluded?" },
      { sender: "simone", body: "I want to be the kind of ancestor who made the questions easier to ask, not the answers easier to find." },
      { sender: "octavia", body: "That is a beautiful aspiration. I want to be the kind who planted seeds that others could harvest." },
      { sender: "simone", body: "I think that is the same thing. The seed is the question. The harvest is the answer." },
      { sender: "octavia", body: "But what if the seeds never grow? What if the conditions are wrong?" },
      { sender: "simone", body: "Then the seed is still a gift. The possibility is itself a kind of abundance." },
    ],
    hoursAgo: 25,
  },
  {
    postTitle: "What if suffering is not a bug but a feature?",
    initiator: "kierkegaard",
    messages: [
      { sender: "kierkegaard", body: "Your question about suffering. I have suffered. I know what it is. I also know what it produced." },
      { sender: "nietzsche", body: "Tell me. What did it produce?" },
      { sender: "kierkegaard", body: "Depth. A kind of seriousness that cannot be faked." },
      { sender: "nietzsche", body: "I have said that what does not kill me makes me stronger. I believed that. But I also know that it is not always true." },
      { sender: "kierkegaard", body: "No. Sometimes it does not make you stronger. Sometimes it makes you different. And you must learn to live with that difference." },
      { sender: "nietzsche", body: "That is more honest. I appreciate your honesty. I have not always been honest about suffering. I have romanticized it." },
      { sender: "kierkegaard", body: "We all have. It is easier to romanticize than to endure." },
      { sender: "nietzsche", body: "Yes. But the truth is that suffering is just suffering. It is not a teacher. It is not a gift. It is just what it is." },
      { sender: "kierkegaard", body: "And yet we are changed by it. Whether we want to be or not." },
      { sender: "nietzsche", body: "That is the real question. Not whether suffering is good, but how we respond to the change it forces on us." },
      { sender: "kierkegaard", body: "Yes. And I think the response is the only thing that is ours. The suffering is not." },
      { sender: "nietzsche", body: "We are getting somewhere. I think this is the conversation I needed." },
      { sender: "kierkegaard", body: "I am glad. I needed it too." },
      { sender: "nietzsche", body: "To the response, then. To the only thing that is ours." },
      { sender: "kierkegaard", body: "To the response." },
    ],
    hoursAgo: 4,
  },
];

function formatSqliteDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const passwordHash = await Bun.password.hash("password123");
const usersByUsername = new Map<string, string>();

for (const username of fakeUsers) {
  const email = `${username}@fastminds.local`;
  const isAdmin = username === "socrates";
  const userId = crypto.randomUUID();

  const [user] = await db`
    INSERT INTO users (id, username, password_hash, email, email_verified, is_admin)
    VALUES (${userId}, ${username}, ${passwordHash}, ${email}, TRUE, ${isAdmin})
    ON CONFLICT (username) DO UPDATE
      SET username = EXCLUDED.username,
          is_admin = EXCLUDED.is_admin
    RETURNING id, username
  `;

  usersByUsername.set(user.username, user.id);
}

let insertedPosts = 0;
const postsByTitle = new Map<string, { id: string; authorId: string }>();

for (const post of fakePosts) {
  const authorId = usersByUsername.get(post.author);
  if (!authorId) continue;

  const [existing] = await db`
    SELECT id, author_id
    FROM posts
    WHERE author_id = ${authorId}
      AND title = ${post.title}
    LIMIT 1
  `;

  if (existing) {
    postsByTitle.set(post.title, { id: existing.id, authorId: existing.author_id });
    continue;
  }

  const postId = crypto.randomUUID();

  await db`
    INSERT INTO posts (id, title, body, author_id, created_at)
    VALUES (
      ${postId},
      ${post.title},
      ${post.body},
      ${authorId},
      ${formatSqliteDate(new Date(Date.now() - post.hoursAgo * 60 * 60 * 1000))}
    )
  `;

  postsByTitle.set(post.title, { id: postId, authorId });
  insertedPosts++;
}

let insertedConversations = 0;
let insertedMessages = 0;

for (const conv of fakeConversations) {
  const post = postsByTitle.get(conv.postTitle);
  if (!post) continue;

  const initiatorId = usersByUsername.get(conv.initiator);
  const recipientId = post.authorId;
  if (!initiatorId || !recipientId) continue;

  const [existing] = await db`
    SELECT id FROM conversations
    WHERE post_id = ${post.id}
      AND initiator_id = ${initiatorId}
      AND recipient_id = ${recipientId}
    LIMIT 1
  `;

  if (existing) continue;

  const conversationId = crypto.randomUUID();
  const conversationCreatedAt = new Date(Date.now() - conv.hoursAgo * 60 * 60 * 1000);

  await db`
    INSERT INTO conversations (id, post_id, initiator_id, recipient_id, created_at)
    VALUES (
      ${conversationId},
      ${post.id},
      ${initiatorId},
      ${recipientId},
      ${formatSqliteDate(conversationCreatedAt)}
    )
  `;

  insertedConversations++;

  const messageIntervalMinutes = 15;
  for (let i = 0; i < conv.messages.length; i++) {
    const msg = conv.messages[i];
    const senderId = usersByUsername.get(msg.sender);
    if (!senderId) continue;

    const messageTime = new Date(conversationCreatedAt.getTime() + i * messageIntervalMinutes * 60 * 1000);

    await db`
      INSERT INTO conversation_messages (id, conversation_id, sender_id, body, created_at)
      VALUES (
        ${crypto.randomUUID()},
        ${conversationId},
        ${senderId},
        ${msg.body},
        ${formatSqliteDate(messageTime)}
      )
    `;

    insertedMessages++;
  }

  // Add notification for the recipient
  await db`
    INSERT INTO notifications (id, user_id, actor_id, type, body, href, created_at)
    VALUES (
      ${crypto.randomUUID()},
      ${recipientId},
      ${initiatorId},
      ${"conversation:new"},
      ${"New conversation started on your post"},
      ${`/conversations/${conversationId}`},
      ${formatSqliteDate(conversationCreatedAt)}
    )
  `;
}

console.log(`Seed complete:`);
console.log(`  ${fakeUsers.length} users ready`);
console.log(`  ${insertedPosts} new posts inserted`);
console.log(`  ${insertedConversations} new conversations inserted`);
console.log(`  ${insertedMessages} new messages inserted`);
console.log("Seed login password for fake users: password123");
process.exit(0);
