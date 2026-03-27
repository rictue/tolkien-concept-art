import express from 'express';
import Replicate from 'replicate';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(path.join(__dirname, 'output')));

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const PORT = process.env.PORT || 3459;

// ─── STYLE BASE ─────────────────────────────────────────────
const STYLE_BASE = `highly detailed character concept art reference sheet, front view and right side view on same image, white clean background, full body standing pose, professional character design turnaround, digital painting, fantasy illustration style inspired by Alan Lee, John Howe, and Frank Frazetta, dramatic lighting, intricate details on armor and clothing, visible texture on materials, muted earth tones with selective vibrant accents, oil painting aesthetic with visible brushwork`;

const NEGATIVE_PROMPT = `blurry, deformed, extra limbs, bad anatomy, bad proportions, duplicate, extra arms, extra legs, fused fingers, too many fingers, long neck, mutation, poorly drawn face, poorly drawn hands, missing arms, missing legs, extra fingers, poorly drawn feet, disfigured, out of frame, watermark, text, signature, ugly, tiling, cut off, low quality, anime, cartoon, 3d render, CGI, chibi, modern clothing, guns, technology, multiple characters on same view, children`;

// ─── CHARACTER TEMPLATES ────────────────────────────────────
const RACES = {
  noldor_elf: {
    name: 'Noldor Elf',
    base: 'tall elegant Noldor high elf, sharp angular features, pointed ears, luminous eyes, regal bearing, pale skin with subtle inner glow',
    lore: 'The Noldor are the Deep Elves, the most skilled in lore, craft, and warfare among the Eldar. They forged the Silmarils and built great cities like Gondolin and Nargothrond.'
  },
  sindar_elf: {
    name: 'Sindar Elf',
    base: 'graceful Sindar grey elf, silver-pale hair, starlit eyes, woodland elegance mixed with noble bearing, pointed ears',
    lore: 'The Sindar are the Grey Elves of Beleriand, subjects of Thingol in Doriath. They blend woodland wisdom with Telerin grace.'
  },
  silvan_elf: {
    name: 'Silvan Elf',
    base: 'agile Silvan woodland elf, lean athletic build, nature-touched features, green-brown eyes, bark-toned skin, pointed ears',
    lore: 'The Silvan Elves live in the great forests of Middle-earth — Mirkwood and Lothlórien. They are closest to nature among all Elves.'
  },
  dwarf: {
    name: 'Dwarf',
    base: 'stocky powerful dwarf, broad shoulders, thick limbs, deep-set eyes under heavy brows, elaborate braided beard, compact muscular frame, about 4.5 feet tall',
    lore: 'Created by Aulë, the Dwarves are master craftsmen and miners. From Khazad-dûm to Erebor, they carved great kingdoms beneath the mountains.'
  },
  dunedain: {
    name: 'Dúnedain',
    base: 'tall noble Dúnedain human, grey eyes, dark hair, weathered but dignified features, taller than common men, strong jaw',
    lore: 'The Dúnedain are descendants of the Númenóreans, blessed with long life. Rangers of the North and Kings of Gondor come from their lineage.'
  },
  rohirrim: {
    name: 'Rohirrim',
    base: 'strong Rohirrim horse-lord, golden or straw-colored hair, blue eyes, broad-shouldered, sun-weathered skin, proud Nordic features',
    lore: 'The Rohirrim are the Horse-lords of Rohan, a proud people of the plains who breed the finest horses in Middle-earth.'
  },
  haradrim: {
    name: 'Haradrim',
    base: 'imposing Haradrim warrior from the south, dark olive skin, dark eyes, black hair, strong features, tall and fierce',
    lore: 'The Haradrim are the Men of the South, from the deserts of Harad. They ride mûmakil and follow their own lords, sometimes falling under Sauron\'s shadow.'
  },
  numenorean: {
    name: 'Númenórean',
    base: 'tall imposing Númenórean, noble and commanding presence, dark hair, grey or blue eyes, nearly seven feet tall, ancient regal bearing',
    lore: 'The Númenóreans were the mightiest of Men, gifted with an island kingdom by the Valar. Their corruption led to Númenor\'s downfall.'
  },
  orc: {
    name: 'Orc',
    base: 'twisted menacing orc, corrupted features, pale sickly or dark mottled skin, sharp fangs, hunched posture, yellow eyes, scarred body',
    lore: 'Orcs were Elves twisted and corrupted by Morgoth in the Elder Days. They serve as foot soldiers of darkness in every age.'
  },
  uruk_hai: {
    name: 'Uruk-hai',
    base: 'massive Uruk-hai, tall and muscular unlike lesser orcs, dark skin, broad jaw, standing upright, fierce intelligent eyes, war-bred physique',
    lore: 'Uruk-hai are Saruman\'s perfected orc soldiers — larger, stronger, and able to withstand sunlight unlike their lesser kin.'
  },
  istari: {
    name: 'Istari (Wizard)',
    base: 'ancient Istari wizard, old wise human appearance concealing divine power, long beard, deep knowing eyes, weathered face full of wisdom',
    lore: 'The Istari are Maiar spirits sent to Middle-earth in human form to guide the Free Peoples against Sauron. Gandalf and Saruman are among them.'
  },
  ent: {
    name: 'Ent',
    base: 'towering ancient Ent tree-herder, bark-like skin, branch-like limbs, deep amber or green eyes, moss and lichen growing on body, 14 feet tall, tree-like face',
    lore: 'Ents are the ancient shepherds of the forests, created to protect the trees from the axes of Dwarves and Men.'
  },
  balrog: {
    name: 'Balrog',
    base: 'terrifying Balrog demon, massive shadow-wreathed form, flames licking from cracks in dark skin, burning eyes, horned head, wings of shadow',
    lore: 'Balrogs are corrupted Maiar, spirits of fire twisted by Morgoth. The most famous lurked in the depths of Moria.'
  }
};

const CLASSES = {
  warrior: {
    name: 'Warrior',
    gear: 'heavy plate armor with engravings, longsword or greatsword, kite shield with heraldic device, war cloak, metal gauntlets and greaves'
  },
  ranger: {
    name: 'Ranger',
    gear: 'worn leather armor under weathered traveling cloak with hood, longbow and quiver, hunting knife at belt, mud-stained boots, rope and provisions'
  },
  mage: {
    name: 'Mage / Sorcerer',
    gear: 'flowing layered robes with arcane symbols, staff topped with crystal or orb, spell components at belt, circlet or hood, glowing runes on sleeves'
  },
  smith: {
    name: 'Blacksmith / Craftsman',
    gear: 'heavy leather apron over tunic, forge hammer and tongs, burn-scarred forearms, tool belt, protective arm wraps, soot-stained clothing'
  },
  assassin: {
    name: 'Assassin / Shadow',
    gear: 'form-fitting dark leather armor, twin daggers or short blades, face mask or cowl, hidden throwing knives, light silent boots, belt of poisons'
  },
  paladin: {
    name: 'Paladin / Holy Knight',
    gear: 'gleaming ornate plate armor with religious symbols, blessed warhammer or mace, tower shield with sacred emblem, tabard with holy insignia, radiant aura'
  },
  archer: {
    name: 'Archer',
    gear: 'light leather and cloth armor, masterwork composite bow, twin quivers with different arrow types, arm guards, keen-eyed expression, light boots for mobility'
  },
  king: {
    name: 'King / Lord',
    gear: 'royal ceremonial armor with gold inlay, crown or circlet, ornate longsword as symbol of authority, fur-lined cloak, signet ring, commanding presence'
  },
  necromancer: {
    name: 'Necromancer / Dark Sorcerer',
    gear: 'tattered dark robes with bone ornaments, skull-topped staff, pale sickly glow around hands, dark gemstone amulet, shadow tendrils, gaunt frame'
  },
  healer: {
    name: 'Healer / Herbalist',
    gear: 'simple practical robes in earthy colors, satchel full of herbs and potions, wooden staff with nature motif, gentle wise expression, healing crystal pendant'
  },
  berserker: {
    name: 'Berserker',
    gear: 'minimal armor showing battle scars and ritual tattoos, massive two-handed axe or dual axes, wild hair, feral eyes, bone and tooth necklaces, fur pelts'
  },
  scout: {
    name: 'Scout / Pathfinder',
    gear: 'camouflaged light armor with leaf patterns, short sword and hunting bow, map case and compass, animal companion hints, practical pouches and gear'
  }
};

const GENDERS = {
  male: 'male, masculine features, strong jawline',
  female: 'female, feminine features, elegant yet strong'
};

// ─── PROMPT GENERATOR VIA GROQ ─────────────────────────────
async function generateCharacterPrompt(race, charClass, gender, customDesc) {
  const raceData = RACES[race];
  const classData = CLASSES[charClass];
  const genderDesc = GENDERS[gender];

  const systemPrompt = `You are a character concept artist specializing in Tolkien's Middle-earth. You create detailed visual descriptions for character reference sheets (front and side view).

RACE: ${raceData.name}
LORE: ${raceData.lore}
CLASS: ${classData.name}
GENDER: ${gender}

Your job is to generate a SINGLE detailed visual prompt for an image generation AI. The prompt must describe ONE character shown in front view and right side view on the same image.

Rules:
- Be extremely specific about armor details, materials, colors, weathering
- Include unique identifying features (scars, tattoos, jewelry, hair style)
- Describe the character's posture and expression
- Add environmental hints (dust on boots, rain on cloak, etc.)
- Keep it under 200 words
- Do NOT include any meta-instructions like "front view" or "reference sheet" — those are added separately
- Focus ONLY on describing the character's appearance
- Make each generation unique — vary armor types, color palettes, accessories, hair styles
- Stay true to Tolkien's aesthetic: no flashy anime or over-the-top fantasy elements`;

  const userPrompt = customDesc
    ? `Generate a character description based on this concept: "${customDesc}". Incorporate the race and class traits naturally.`
    : `Generate a unique ${raceData.name} ${classData.name} character. Be creative with the specific details — make this character memorable and distinct.`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 250,
    temperature: 0.95
  });

  const characterDesc = completion.choices[0].message.content.trim();

  // Assemble final prompt
  const finalPrompt = `${STYLE_BASE}, ${genderDesc}, ${raceData.base}, ${classData.gear}, ${characterDesc}`;

  return { characterDesc, finalPrompt, raceName: raceData.name, className: classData.name };
}

// ─── IMAGE GENERATION ───────────────────────────────────────
async function generateImage(prompt) {
  const output = await replicate.run('black-forest-labs/flux-1.1-pro', {
    input: {
      prompt: prompt,
      aspect_ratio: '16:9',
      output_format: 'jpg',
      output_quality: 95,
      safety_tolerance: 5,
      prompt_upsampling: false
    }
  });

  // Flux returns a URL or buffer
  const imageUrl = typeof output === 'string' ? output : output?.url?.() || output;
  const response = await fetch(imageUrl);
  const buffer = Buffer.from(await response.arrayBuffer());

  return buffer;
}

// ─── SAVE IMAGE ─────────────────────────────────────────────
async function saveImage(buffer, raceName, className) {
  const timestamp = Date.now();
  const safeName = `${raceName}-${className}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const filename = `concept-${safeName}-${timestamp}.jpg`;
  const filepath = path.join(__dirname, 'output', filename);

  // Add subtle film grain for that hand-painted feel
  const processed = await sharp(buffer)
    .jpeg({ quality: 95 })
    .toBuffer();

  fs.writeFileSync(filepath, processed);
  return filename;
}

// ─── ROUTES ─────────────────────────────────────────────────

// Preview: get prompt without generating image
app.get('/preview', async (req, res) => {
  try {
    const { race, charClass, gender, custom } = req.query;

    if (!race || !charClass || !gender) {
      return res.status(400).json({ error: 'Missing required parameters: race, charClass, gender' });
    }

    const result = await generateCharacterPrompt(race, charClass, gender, custom || '');

    res.json({
      raceName: result.raceName,
      className: result.className,
      gender,
      characterDesc: result.characterDesc,
      fullPrompt: result.finalPrompt,
      negativePrompt: NEGATIVE_PROMPT
    });
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate: create image
app.get('/generate', async (req, res) => {
  try {
    const { race, charClass, gender, custom } = req.query;

    if (!race || !charClass || !gender) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const result = await generateCharacterPrompt(race, charClass, gender, custom || '');
    const imageBuffer = await generateImage(result.finalPrompt);
    const filename = await saveImage(imageBuffer, result.raceName, result.className);

    res.json({
      success: true,
      image: `/output/${filename}`,
      raceName: result.raceName,
      className: result.className,
      gender,
      characterDesc: result.characterDesc,
      fullPrompt: result.finalPrompt
    });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Regenerate: same params, new variation
app.post('/regenerate', async (req, res) => {
  try {
    const { race, charClass, gender, custom } = req.body;

    const result = await generateCharacterPrompt(race, charClass, gender, custom || '');
    const imageBuffer = await generateImage(result.finalPrompt);
    const filename = await saveImage(imageBuffer, result.raceName, result.className);

    res.json({
      success: true,
      image: `/output/${filename}`,
      raceName: result.raceName,
      className: result.className,
      gender,
      characterDesc: result.characterDesc,
      fullPrompt: result.finalPrompt
    });
  } catch (err) {
    console.error('Regenerate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate from exact prompt (no LLM)
app.post('/generate-from-prompt', async (req, res) => {
  try {
    const { prompt, raceName, className } = req.body;

    const imageBuffer = await generateImage(prompt);
    const filename = await saveImage(imageBuffer, raceName || 'custom', className || 'character');

    res.json({
      success: true,
      image: `/output/${filename}`
    });
  } catch (err) {
    console.error('Generate from prompt error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n⚔️  Tolkien Concept Art Generator running on http://localhost:${PORT}\n`);
});
