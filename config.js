// Everything the site says lives here. Change the words, save, and reload the page.
// The company, the drinks and the contact details are invented for the demo.
//
// Fruit pictures go in assets/bits (see guide.html). Until they are there,
// the site draws simple fruit shapes by itself.
window.FIZZO = {
  brand: "Fizzo",
  sub: "Soda works",
  city: "Pune",
  email: "hello@fizzo.example",

  // Prices in rupees. A box holds "packSize" cans.
  currency: "₹",
  price: 60,
  packSize: 3,
  packPrice: 150,

  // The flavours, in the order they stand in the row.
  // "color" paints the whole page. "ink" is the text on that colour: "dark" or "light".
  // "file" is the name of its fruit pictures. "shapes" are drawn until the pictures arrive:
  // wheel (a fruit slice), berry, leaf, chilli or cube (ice), each with one or two colours.
  flavours: [
    { file: "narangi", name: "Narangi Fizz", color: "#ff5a1f", ink: "light",
      tag: "Nagpur oranges, squeezed loud.",
      note: "Whole Nagpur oranges, peel oil and all, with a pinch of black salt at the end.",
      shapes: [["wheel", "#ff8a1f", "#ffc24a"], ["leaf", "#2f9e44"], ["wheel", "#ffa02e", "#ffd76a"]] },
    { file: "mango", name: "Mango Chilli", color: "#ffb300", ink: "dark",
      tag: "Alphonso first. Then the heat.",
      note: "Ratnagiri Alphonso pulp up front, and a slow red-chilli warmth that arrives a second later.",
      shapes: [["wheel", "#ff9d0a", "#ffd23f"], ["chilli", "#e3132c"], ["leaf", "#2f9e44"]] },
    { file: "nimbu", name: "Nimbu Masala", color: "#9bd21c", ink: "dark",
      tag: "The street-cart classic, in a can.",
      note: "Fresh lime, roasted cumin, black salt and mint. The soda you drink standing at a cart.",
      shapes: [["wheel", "#5fae17", "#e6f59a"], ["leaf", "#1f8f3a"], ["wheel", "#74c020", "#f1fbb6"]] },
    { file: "guava", name: "Guava Pink Salt", color: "#ff4d8d", ink: "light",
      tag: "Sweet, pink and a little salty.",
      note: "Ripe pink guava with Himalayan salt on the rim of every sip.",
      shapes: [["wheel", "#9ed24a", "#ff8fb5"], ["cube", "#ffe3ee"], ["leaf", "#2f9e44"]] },
    { file: "kokum", name: "Kokum Cooler", color: "#d7102f", ink: "light",
      tag: "Deep red, sharp and cold.",
      note: "Konkan kokum, tart and ruby red, with a little jaggery to round it off.",
      shapes: [["berry", "#8f0f2a"], ["leaf", "#2f9e44"], ["cube", "#ffd9df"]] },
    { file: "kala", name: "Kala Khatta", color: "#5b21d6", ink: "light",
      tag: "The ice-gola flavour, grown up.",
      note: "Black jamun, lemon and chaat masala. Your tongue goes purple. That is the point.",
      shapes: [["berry", "#2a0f66"], ["wheel", "#f2d024", "#fff3a6"], ["leaf", "#2f9e44"]] },
    { file: "litchi", name: "Litchi Ice", color: "#1f6bff", ink: "light",
      tag: "Soft, floral and freezing.",
      note: "Muzaffarpur litchi with a cold mint finish. The gentlest can in the row.",
      shapes: [["berry", "#ffd9e4"], ["cube", "#d9ecff"], ["leaf", "#35c06a"]] },
    { file: "jeera", name: "Ginger Jeera", color: "#b8721f", ink: "light",
      tag: "Warm spice, hard fizz.",
      note: "Fresh ginger juice and roasted cumin. It bites back, and it settles a heavy lunch.",
      shapes: [["wheel", "#e8c94a", "#fff0a8"], ["leaf", "#2f9e44"], ["cube", "#f6e2c4"]] },
    { file: "cola", name: "Midnight Cola", color: "#1b1922", ink: "light",
      tag: "Dark, spiced and not too sweet.",
      note: "Our own cola: kola nut, cinnamon, vanilla and lime, with a third less sugar.",
      shapes: [["cube", "#cfd8e6"], ["wheel", "#5fae17", "#e6f59a"], ["berry", "#6b3a1c"]] },
  ],
  // Which flavour the page opens on (0 is the first).
  startFlavour: 1,

  intro: { note: "Chilling the cans", skip: "Skip intro" },

  hero: { hint: "Drag the row, or tap a can", autoplay: "Autoplay", next: "Next flavour" },

  // The story told while one can turns. The last chapter is the flavour you picked.
  inside: {
    chapters: [
      { label: "The can", title: "Built cold", text: "Thin aluminium chills in eleven minutes and holds every bubble until you crack it. It is recycled again and again.",
        notes: ["Stay-on tab", "Recycled aluminium"] },
      { label: "The fruit", title: "It starts in the orchard", text: "Real fruit, pulped the week it is picked. Nothing on the back of the can that you cannot pronounce.",
        notes: ["Real fruit pulp", "No colours added"] },
      { label: "The fizz", title: "Bubbles, dialled in", text: "We carbonate cold and slow, so the bubbles are small and they last to the bottom of the can.",
        notes: ["Fine bubbles", "Filled at 2°C"] },
      { label: "The flavour", title: null, text: null, notes: ["330 ml", "Shake? Never."] },
    ],
    rate: { label: "Fizz rate", unit: "bubbles / sec" },
  },

  shop: {
    title: "Grab a can",
    hint: "Tilt a card, press it, poke the can. Hit + to drop a flavour into your box.",
    add: "Add to box",
  },

  build: {
    label: "Build a box · concept store",
    title: ["Build your", "3-pack &", "save ₹30"],
    hint: "Tap a flavour to drop it in. Tap × to take it out.",
    button: "Add to basket",
    fine: "Concept only. Nothing is charged.",
    drop: "Drop cans here",
  },

  range: {
    title: "Pick your fizz",
    hint: "Drag the rail to browse. Run your cursor through the cans. Tap one to spin it on its hook.",
    drag: "Drag the rail",
  },

  faq: {
    title: "Q&A",
    text: "Everything you wanted to know before you crack one open.",
    items: [
      { q: "Is there real fruit in the can?", a: "Yes. Every flavour starts as whole fruit that is pulped and strained. For exact ingredients, always check the can in your hand." },
      { q: "Which flavour should I try first?", a: "Mango Chilli if you like a little heat, Nimbu Masala if you want the street-cart classic, Litchi Ice if you want something gentle." },
      { q: "How cold should I drink it?", a: "As cold as you can get it. Twenty minutes in the freezer is perfect. Forty is a mess." },
      { q: "How much sugar is in one can?", a: "About a third less than a regular soft drink, because the fruit does most of the work." },
      { q: "Is this an official website?", a: "No. Fizzo is an invented brand and this site is a design demo. Nothing here is for sale." },
    ],
  },

  join: {
    title: "First sip on new flavours",
    text: "One short email when a new can drops. That is all.",
    field: "Your email",
    placeholder: "you@email.com",
    button: "Count me in",
    cta: "First sip",
    done: "You are on the list. (Demo: nothing was sent.)",
    error: "Please type a full email address.",
  },

  footer: {
    shout: "Stay fizzy",
    note: "Fizzo is an invented brand, made for a design demo. It is not a real drink and nothing here is for sale.",
    follow: ["Instagram", "YouTube"],
  },
};
