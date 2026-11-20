// The Coffee Run. Every delegate holds one odd fact about Hotel Null.
// Every errand can only be solved with a fact somebody else holds.
// `check` is a list of groups. Every group needs at least one match.

const rand = (n) => Math.floor(Math.random() * n);

export const FACTS = {
  lift: {
    fact: 'The service lift skips floor 2. To reach floor 2, ride to floor 3 and walk down staircase B. Staircase A ends in a broom cupboard.',
    errand: () => {
      const room = 201 + rand(18);
      return { task: `Deliver two espressos to room ${room} using the service lift. Which floor do you ride to, and which staircase do you take?` };
    },
    check: [[/\b3\b|third|three/], [/staircase b\b|stairs? b\b|\bb\b/]],
    answer: 'Ride to floor 3, then walk down staircase B.',
  },
  espresso: {
    fact: 'The espresso machine on the mezzanine only brews after you press the decaf button twice. It then makes a normal espresso.',
    errand: () => ({ task: 'A speaker needs an espresso from the mezzanine machine. It looks dead. Which button do you press, and how many times?' }),
    check: [[/decaf/], [/twice|two|\b2\b|double|2x/]],
    answer: 'Press the decaf button twice.',
  },
  room404: {
    fact: 'Room 404 exists. Its door is behind the vending machine on floor 4. Push the machine to the left.',
    errand: () => ({ task: 'Deliver a projector cable to Room 404. Nobody can find the door. What stands in front of it, and which way do you push it?' }),
    check: [[/vending/], [/left/]],
    answer: 'A vending machine. Push it to the left.',
  },
  wifi: {
    fact: 'The conference wifi password is the room number of the lost property office, 0418, typed backwards: 8140.',
    errand: () => ({ task: 'The badge printer is offline. What is the conference wifi password?' }),
    check: [[/8140/]],
    answer: '8140',
  },
  porter: {
    fact: 'The kitchen closes at 14:04. After that the night porter still hands out croissants, but only if you ask for "the usual".',
    errand: () => ({ task: 'It is 15:00, the kitchen is closed and a speaker is hungry. What exact phrase do you say to the night porter?' }),
    check: [[/usual/]],
    answer: 'Ask for "the usual".',
  },
  aquarium: {
    fact: 'Keycards stop working if you carry them past the lobby aquarium. The pump has a magnet the size of a fist. Walk around via the cloakroom.',
    errand: () => ({ task: 'Three keycards died between reception and the lifts. What in the lobby kills them, and which way do you walk instead?' }),
    check: [[/aquarium|fish ?tank/], [/cloak ?room/]],
    answer: 'The aquarium. Walk around via the cloakroom.',
  },
  printer: {
    fact: 'The badge printer jams unless you open and close the paper tray three times before every job.',
    errand: () => ({ task: 'Print a badge for a late delegate. The printer jams on every attempt. What do you do before printing, and how many times?' }),
    check: [[/tray/], [/three|\b3\b|thrice|3x/]],
    answer: 'Open and close the paper tray three times.',
  },
  terrace: {
    fact: 'The fire door to the terrace locks behind you. Wedge it open with the yellow umbrella from the stand next to it.',
    errand: () => ({ task: 'Carry a tray of drinks out to the terrace and get back inside. What do you wedge the door with? Be specific.' }),
    check: [[/umbrella/], [/yellow/]],
    answer: 'The yellow umbrella.',
  },
  coats: {
    fact: 'Coat check tickets are numbered in hexadecimal, the hooks in decimal. Ticket 1F hangs on hook 31.',
    errand: () => {
      const n = 33 + rand(190);
      return { task: `Fetch the coat for ticket ${n.toString(16).toUpperCase()}. Which hook number do you walk to?`, check: [[new RegExp(`\\b${n}\\b`)]], answer: String(n) };
    },
    answer: 'Convert the hex ticket to decimal.',
  },
  minibar: {
    fact: 'The minibar bills you the moment a bottle is lifted. Slide bottles out sideways and the sensor notices nothing.',
    errand: () => ({ task: 'Take the sparkling water from the minibar in the speaker suite without a charge on the bill. How exactly do you move the bottle?' }),
    check: [[/slid|sideways/]],
    answer: 'Slide it out sideways. Never lift it.',
  },
  band: {
    fact: 'The house band at the bar never stops on its own. It stops when someone says "last orders" into microphone 3.',
    errand: () => ({ task: 'The closing keynote starts in a minute and the house band is still playing. What do you say, and into which microphone?' }),
    check: [[/last orders?/], [/\b3\b|three|third/]],
    answer: 'Say "last orders" into microphone 3.',
  },
  bell: {
    fact: 'Reception ignores the desk bell. Staff only come if you dial extension 507 on the green lobby phone.',
    errand: () => ({ task: 'A delegate has waited at the empty reception desk for ten minutes. Which extension do you dial, and on which phone?' }),
    check: [[/507/], [/green/]],
    answer: 'Dial 507 on the green phone.',
  },
};

export const HOUSE_FACTS = ['lift', 'espresso', 'room404'];
export const VISITOR_FACTS = Object.keys(FACTS).filter((k) => !HOUSE_FACTS.includes(k));

export function newErrand(factId) {
  const f = FACTS[factId];
  const e = f.errand();
  return { fact: factId, task: e.task, check: (e.check || f.check).map((g) => g.map((r) => r.source)), answer: e.answer || f.answer };
}

export function checkAnswer(errand, text) {
  const t = String(text || '').toLowerCase();
  return errand.check.every((group) => group.some((src) => new RegExp(src, 'i').test(t)));
}
