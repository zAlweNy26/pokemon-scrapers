# Game text to review — 2026-11-08

Pokédex entries where the two sources disagree, left as Bulbapedia has them until
someone checks a third source (Serebii, or the game itself). The rule they fall
under is "Game text only" in CLAUDE.md; non-game text Dany approved is listed there.

Found by comparing every shipped entry (`pokedex_entry`, species rows) with
PokéAPI's `pokemon_species_flavor_text`, extracted from the games, after line
breaks, curly quotes and spacing are evened out. `bun run data:check` prints the
current count (81 on this date); re-run it before acting on a row, and remove
a row here once it is settled.

## 1. Different words (29)

Some are explained in the note column; the rest need a third source.

| # | Game | Bulbapedia (shipped) | PokéAPI (game data) | Note |
| --- | --- | --- | --- | --- |
| 22 Fearow | platinum | It has the stamina to fly all day on its broad wings. It fights using its sharp beak. | It has the stamina to fly all day on its broad wings. It fights by using its sharp beak. |  |
| 27 Sandshrew | sword | It loves to bathe in the grit of dry, sandy areas. By sand bathing, this Pokémon rids itself of dirt and moisture clinging to its body. | It loves to bathe in the grit of dry, sandy areas. By sand bathing, the Pokémon rids itself of dirt and moisture clinging to its body. |  |
| 28 Sandslash | sword | The drier the area Sandslash lives in, the harder and smoother the Pokémon's spikes feel when touched. | The drier the area Sandslash lives in, the harder and smoother the Pokémon's spikes will feel when touched. |  |
| 46 Paras | ruby | PARAS has parasitic mushrooms growing on its back called tochukaso. They grow large by drawing nutrients from this BUG/GRASS POKéMON host. They are highly valued as a medicine for extending life. | PARAS has parasitic mushrooms growing on its back called tochukaso. They grow large by drawing nutrients from the BUG POKéMON host. They are highly valued as a medicine for extending life. | PokéAPI has the 1.0 text (kept in `revisions`); the main text is Bulbapedia's 1.1+ "this BUG/GRASS POKéMON", unverified |
| 46 Paras | sapphire | PARAS has parasitic mushrooms growing on its back called tochukaso. They grow large by drawing nutrients from this BUG/GRASS POKéMON host. They are highly valued as a medicine for extending life. | PARAS has parasitic mushrooms growing on its back called tochukaso. They grow large by drawing nutrients from this BUG POKéMON host. They are highly valued as a medicine for extending life. | as Ruby: Bulbapedia's 1.1+ "BUG/GRASS", unverified |
| 59 Arcanine | gold | This legendary Chinese POKéMON is considered magnificent. Many people are enchanted by its grand mane. | This legendary Chinese POKEMON is considered magnificent. Many people are enchanted by its grand mane. | PokéAPI writes "POKEMON" without é; check the cartridge |
| 64 Kadabra | pearl | When it uses its psychic power, it emits strong alpha waves that can ruin precision devices. | When it uses its psychic power, it emits strong ha waves that can ruin precision devices. | PokéAPI lost a character ("ha waves" for "alpha waves", likely "α"); Bulbapedia looks right |
| 113 Chansey | legends-arceus | This purehearted Pokémon shares its eggs with the injured. These eggs are so nutritious that they've been nicknamed "doctors' doubles." | This purehearted Pokémon shares its eggs with the injured. | PokéAPI has the first sentence only; Bulbapedia looks complete |
| 128 Tauros | shield | The Tauros of Galar are volatile in nature, and they won't allow people to ride on their backs. | The Tauros of the Galar region are volatile in nature, and they won't allow people to ride on their backs. |  |
| 152 Chikorita | firered | Its pleasantly aromatic leaf has the ability to check the humidity and temperature. | Its pleasantly aromatic leaves have the ability to check the humidity and temperature. | PokéAPI has 1.0 (kept in `revisions`); main text is 1.1. Expected |
| 215 Sneasel | legends-arceus | This Pokémon shares roots with the Sneasel of Hisui, but unlike that species, this one is spiteful in personality. I hypothesize that water and earth can affect Sneasel's mind and body. | Its sturdy, curved claws are ideal for traversing precipitous cliffs. From the tips of these claws drips a venom that infiltrates the nerves of any prey caught in Sneasel's grasp. | completely different texts: Bulbapedia's is about Sneasel vs Hisuian Sneasel. Check which form Legends: Arceus shows it for |
| 248 Tyranitar | firered | It has an impudent nature. Having great strength, it can even change surrounding landforms. | Its body can't be harmed by any sort of attack, so it is very eager to make challenges against enemies. | PokéAPI has 1.0 (kept in `revisions`); main text is 1.1. Expected |
| 303 Mawile | ruby | MAWILE's huge jaws are actually steel horns that have been transformed. Its docile-looking face serves to lull its foe into letting down its guard. When the foe least expects it, MAWILE chomps it with its gaping jaws. | MAWHILE's huge jaws are actually steel horns that have been transformed. Its docile-looking face serves to lull its foe into letting down its guard. When the foe least expects it, MAWHILE chomps it with its gaping jaws. | Expected: "MAWHILE" is Ruby 1.0's misspelling, fixed in later revisions; we ship the latest. See section 4 for the missing 1.0 revision |
| 303 Mawile | sapphire | Don't be taken by this POKéMON's cute face - it's very dangerous. MAWILE fools the foe into letting down its guard then chomps down with its massive jaws. The steel jaws are really horns that have been transformed. | Don't be taken in by this POKéMON's cute face - it's very dangerous. MAWILE fools the foe into letting down its guard, then chomps down with its massive jaws. The steel jaws are really horns that have been transformed. |  |
| 319 Sharpedo | sword | As soon as it catches the scent of its prey, Sharpedo will jet seawater from its backside, hurtling toward the target to attack at 75 mph. | As soon as it catches the scent of prey, Sharpedo will jet seawater from its backside, hurtling toward the target to attack at 75 mph. |  |
| 449 Hippopotas | shield | This Pokémon is active during the day and passes the cold desert nights burrowed snuggly into the sand. | This Pokémon is active during the day and passes the cold desert nights burrowed snugly into the sand. |  |
| 467 Magmortar | black-2 | When shooting 3,600 degrees F fireballs from its arms, its body takes on a whitish hue from the intense heat. | When shooting 3,600 degree F fireballs from its arms, its body takes on a whitish hue from the intense heat. |  |
| 467 Magmortar | white-2 | When shooting 3,600 degrees F fireballs from its arms, its body takes on a whitish hue from the intense heat. | When shooting 3,600 degree F fireballs from its arms, its body takes on a whitish hue from the intense heat. |  |
| 478 Froslass | platinum | It freezes prey by blowing its -58 degree F breath. It is said to then secretly display its prey. | It freezes prey by blowing its -58 degrees F breath. It is said to then secretly display its prey. |  |
| 478 Froslass | black | It freezes prey by blowing its -58 degree F breath. It is said to then secretly display its prey. | It freezes prey by blowing its -58 degrees F breath. It is said to then secretly display its prey. |  |
| 478 Froslass | white | It freezes prey by blowing its -58 degree F breath. It is said to then secretly display its prey. | It freezes prey by blowing its -58 degrees F breath. It is said to then secretly display its prey. |  |
| 478 Froslass | black-2 | It freezes prey by blowing its -58 degree F breath. It is said to then secretly display its prey. | It freezes prey by blowing its -58 degrees F breath. It is said to then secretly display its prey. |  |
| 478 Froslass | white-2 | It freezes prey by blowing its -58 degree F breath. It is said to then secretly display its prey. | It freezes prey by blowing its -58 degrees F breath. It is said to then secretly display its prey. |  |
| 548 Petilil | shield | The deeper the color of a Petilil's leaves, the healthier the Pokémon is. Petilil sometimes make its home in a well-tended field or flowerbed. | The deeper the color of a Petilil's leaves, the healthier the Pokémon is. Petilil sometimes makes its home in a well-tended field or flowerbed. |  |
| 571 Zoroark | shield | Seeking to ease the burden of solitude, lonely Trainers tell Zoroark to show illusions to them. | Seeking to ease the burden of their solitude, lonely Trainers tell Zoroark to show illusions to them. |  |
| 591 Amoonguss | shield | Amoonguss generally doesn't move as much. It tends to stand still near Poké Balls that have been dropped on the ground. | Amoonguss generally doesn't move much. It tends to stand still near Poké Balls that have been dropped on the ground. |  |
| 619 Mienfoo | shield | Though small, Mienfoo's temperament is fierce. Any creature that approaches Mienfoo carelessly will be greeted with a flurry of attacks. | Though small, Mienfoo's temperament is fierce. Any creature that approaches Mienfoo carelessly will be greeted with a flurry of graceful attacks. |  |
| 702 Dedenne | shield | Since Dedenne can't generate as much electricity on its own, it steals electricity from outlets or other electric Pokémon. | Since Dedenne can't generate much electricity on its own, it steals electricity from outlets or other electric Pokémon. |  |
| 908 Meowscarada | scarlet | This Pokémon uses the reflective fur lining in its cape to camouflage the stem of its flower, creating the illusion that the flower is floating. | This Pokémon uses the reflective fur lining its cape to camouflage the stem of its flower, creating the illusion that the flower is floating. |  |

## 2. Capitals only (8)

Bulbapedia marks the capitals Generations I-IV print with `<sc>`; on these it
did not (or did where the game does not), so the shipped text's case is likely wrong.

| # | Game | Bulbapedia (shipped) | PokéAPI (game data) |
| --- | --- | --- | --- |
| 47 Parasect | platinum | A mushroom grown larger than the host's body controls Parasect. It scatters poisonous spores. | A mushroom grown larger than the host's body controls PARASECT. It scatters poisonous spores. |
| 63 Abra | gold | It senses impending attacks and TELEPORTs away to safety before the actual attacks can strike. | It senses impending attacks and TELEPORTS away to safety before the actual attacks can strike. |
| 128 Tauros | crystal | These violent Pokémon fight with other members of their herd in order to prove their strength. | These violent POKéMON fight with other members of their herd in order to prove their strength. |
| 136 Flareon | ruby | Flareon's fluffy fur has a functional purpose - it releases heat into the air so that its body does not get excessively hot. This Pokémon's body temperature can rise to a maximum of 1,650 degrees F. | FLAREON's fluffy fur has a functional purpose - it releases heat into the air so that its body does not get excessively hot. This POKéMON's body temperature can rise to a maximum of 1,650 degrees F. |
| 136 Flareon | sapphire | Flareon's fluffy fur has a functional purpose - it releases heat into the air so that its body does not get excessively hot. This Pokémon's body temperature can rise to a maximum of 1,650 degrees F. | FLAREON's fluffy fur has a functional purpose - it releases heat into the air so that its body does not get excessively hot. This POKéMON's body temperature can rise to a maximum of 1,650 degrees F. |
| 136 Flareon | emerald | Flareon's fluffy fur releases heat into the air so that its body does not get excessively hot. Its body temperature can rise to a maximum of 1,650 degrees F. | FLAREON's fluffy fur releases heat into the air so that its body does not get excessively hot. Its body temperature can rise to a maximum of 1,650 degrees F. |
| 171 Lanturn | crystal | This Pokémon uses the bright part of its body, which changed from a dorsal fin, to lure prey. | This POKéMON uses the bright part of its body, which changed from a dorsal fin, to lure prey. |
| 935 Charcadet | violet | Its firepower increases when it fights, reaching over 1,800 degrees Fahrenheit. It likes Berries that are rich in fat. | Its firepower increases when it fights, reaching over 1,800 degrees Fahrenheit. It likes berries that are rich in fat. |

## 3. Hyphens, dashes and spacing only (44)

Same letters, different punctuation ("hot-headed" / "hotheaded", "nest - this" /
"nest -this"). Either source may have transcribed it wrong.

| # | Game | Bulbapedia (shipped) | PokéAPI (game data) |
| --- | --- | --- | --- |
| 5 Charmeleon | gold | It is very hot-headed by nature, so it constantly seeks opponents. It calms down only when it wins. | It is very hotheaded by nature, so it constantly seeks opponents. It calms down only when it wins. |
| 9 Blastoise | leafgreen | The pressurized water jets on this brutal POKéMON's shell are used for high- speed tackles. | The pressurized water jets on this brutal POKéMON's shell are used for high-speed tackles. |
| 15 Beedrill | ruby | BEEDRILL is extremely territorial. No one should ever approach its nest - this is for their own safety. If angered, they will attack in a furious swarm. | BEEDRILL is extremely territorial. No one should ever approach its nest -this is for their own safety. If angered, they will attack in a furious swarm. |
| 15 Beedrill | sapphire | BEEDRILL is extremely territorial. No one should ever approach its nest - this is for their own safety. If angered, they will attack in a furious swarm. | BEEDRILL is extremely territorial. No one should ever approach its nest -this is for their own safety. If angered, they will attack in a furious swarm. |
| 19 Rattata | ruby | RATTATA is cautious in the extreme. Even while it is asleep, it constantly listens by moving its ears around. It is not picky about where it lives - it will make its nest anywhere. | RATTATA is cautious in the extreme. Even while it is asleep, it constantly listens by moving its ears around. It is not picky about where it lives -it will make its nest anywhere. |
| 19 Rattata | sapphire | RATTATA is cautious in the extreme. Even while it is asleep, it constantly listens by moving its ears around. It is not picky about where it lives - it will make its nest anywhere. | RATTATA is cautious in the extreme. Even while it is asleep, it constantly listens by moving its ears around. It is not picky about where it lives -it will make its nest anywhere. |
| 26 Raichu | legends-arceus | It can discharge bursts of electricity exceeding 100,000 volts—a single strike with that amount of power would incapacitate one of the Copperajah of my homeland. | It can discharge bursts of electricity exceeding 100,000 volts— a single strike with that amount of power would incapacitate one of the Copperajah of my homeland. |
| 29 Nidoran♀ | emerald | Its highly toxic barbs are thought to have developed as protection for this small- bodied POKéMON. When enraged, it releases a horrible toxin from its horn. | Its highly toxic barbs are thought to have developed as protection for this small-bodied POKéMON. When enraged, it releases a horrible toxin from its horn. |
| 64 Kadabra | firered | It happened one morning -a boy with extrasensory powers awoke in bed transformed into KADABRA. | It happened one morning - a boy with extrasensory powers awoke in bed transformed into KADABRA. |
| 65 Alakazam | firered | It does not like physical attacks very much. Instead, it freely uses extra-sensory powers to defeat foes. | It does not like physical attacks very much. Instead, it freely uses extrasensory powers to defeat foes. |
| 81 Magnemite | silver | The units at the sides of its body generate anti-gravity energy to keep it aloft in the air. | The units at the sides of its body generate antigravity energy to keep it aloft in the air. |
| 85 Dodrio | ruby | Watch out if DODRIO's three heads are looking in three separate directions. It's a sure sign that it is on its guard. Don't go near this POKéMON if it's being wary -it may decide to peck you. | Watch out if DODRIO's three heads are looking in three separate directions. It's a sure sign that it is on its guard. Don't go near this POKéMON if it's being wary - it may decide to peck you. |
| 92 Gastly | legends-arceus | Gaseous and completely impalpable. Also highly dangerous—inhaling part of its poisonous body will cause one to faint instantly. | Gaseous and completely impalpable. Also highly dangerous— inhaling part of its poisonous body will cause one to faint instantly. |
| 108 Lickitung | crystal | It has a tongue that is over 6'6" long. It uses this long tongue to lick its body clean. | It has a tongue that is over 6'6'' long. It uses this long tongue to lick its body clean. |
| 113 Chansey | yellow | A gentle and kind-hearted POKéMON that shares its nutritious eggs if it sees an injured POKéMON. | A gentle and kindhearted POKéMON that shares its nutritious eggs if it sees an injured POKéMON. |
| 119 Seaking | emerald | It punches holes in boulders on stream-beds. This is a clever innovation that prevents its eggs from being attacked or washed away by the current. | It punches holes in boulders on streambeds. This is a clever innovation that prevents its eggs from being attacked or washed away by the current. |
| 121 Starmie | ruby | STARMIE's center section - the core - glows brightly in seven colors. Because of its luminous nature, this POKéMON has been given the nickname "the gem of the sea." | STARMIE's center section - the core -glows brightly in seven colors. Because of its luminous nature, this POKéMON has been given the nickname "the gem of the sea." |
| 157 Typhlosion | silver | It has a secret, devastating move. It rubs its blazing fur together to cause huge explosions. | It has a secret, devastating move. It rubs its blaz ing fur together to cause huge explosions. |
| 162 Furret | crystal | It lives in narrow burrows that fit its slim body. The deeper the nests go, the more maze-like they become. | It lives in narrow burrows that fit its slim body. The deeper the nests go, the more mazelike they become. |
| 176 Togetic | platinum | To share its happiness, it flies around the world seeking kind-hearted people. | To share its happiness, it flies around the world seeking kindhearted people. |
| 219 Magcargo | ruby | MAGCARGO's shell is actually its skin that hardened as a result of cooling. Its shell is very brittle and fragile - just touching it causes it to crumble apart. This POKéMON returns to its original size by dipping itself in magma. | MAGCARGO's shell is actually its skin that hardened as a result of cooling. Its shell is very brittle and fragile -just touching it causes it to crumble apart. This POKéMON returns to its original size by dipping itself in magma. |
| 240 Magby | ultra-moon | Its body temperature is always around 1,100 degrees Fahrenheit. If Magby falls into a small- enough pond, the whole thing will dry up. | Its body temperature is always around 1,100 degrees Fahrenheit. If Magby falls into a small-enough pond, the whole thing will dry up. |
| 249 Lugia | ruby | LUGIA's wings pack devastating power - a light fluttering of its wings can blow apart regular houses. As a result, this POKéMON chooses to live out of sight deep under the sea. | LUGIA's wings pack devastating power -a light fluttering of its wings can blow apart regular houses. As a result, this POKéMON chooses to live out of sight deep under the sea. |
| 249 Lugia | sapphire | LUGIA's wings pack devastating power - a light fluttering of its wings can blow apart regular houses. As a result, this POKéMON chooses to live out of sight deep under the sea. | LUGIA's wings pack devastating power -a light fluttering of its wings can blow apart regular houses. As a result, this POKéMON chooses to live out of sight deep under the sea. |
| 252 Treecko | sapphire | TREECKO is cool, calm, and collected - it never panics under any situation. If a bigger foe were to glare at this POKéMON, it would glare right back without conceding an inch of ground. | TREECKO is cool, calm, and collected -it never panics under any situation. If a bigger foe were to glare at this POKéMON, it would glare right back without conceding an inch of ground. |
| 255 Torchic | sapphire | TORCHIC has a place inside its body where it keeps its flame. Give it a hug - it will be glowing with warmth. This POKéMON is covered all over by a fluffy coat of down. | TORCHIC has a place inside its body where it keeps its flame. Give it a hug -it will be glowing with warmth. This POKéMON is covered all over by a fluffy coat of down. |
| 257 Blaziken | sapphire | BLAZIKEN has incredibly strong legs - it can easily clear a 30-story building in one leap. This POKéMON's blazing punches leave its foes scorched and blackened. | BLAZIKEN has incredibly strong legs -it can easily clear a 30-story building in one leap. This POKéMON's blazing punches leave its foes scorched and blackened. |
| 292 Shedinja | ruby | SHEDINJA's hard body doesn't move - not even a twitch. In fact, its body appears to be merely a hollow shell. It is believed that this POKéMON will steal the spirit of anyone peering into its hollow body from its back. | SHEDINJA's hard body doesn't move -not even a twitch. In fact, its body appears to be merely a hollow shell. It is believed that this POKéMON will steal the spirit of anyone peering into its hollow body from its back. |
| 293 Whismur | ruby | Normally, WHISMUR's voice is very quiet - it is barely audible even if one is paying close attention. However, if this POKéMON senses danger, it starts crying at an earsplitting volume. | Normally, WHISMUR's voice is very quiet -it is barely audible even if one is paying close attention. However, if this POKéMON senses danger, it starts crying at an earsplitting volume. |
| 293 Whismur | shield | When Whismur cries, the sound of its own voice startles it, making the Pokémon cry even louder. It cries until its exhausted, then it falls asleep. | When Whismur cries, the sound of its own voice startles it, making the Pokémon cry even louder. It cries until it's exhausted, then it falls asleep. |
| 296 Makuhita | sapphire | MAKUHITA has a tireless spirit - it will never give up hope. It eats a lot of food, gets plenty of sleep, and it trains very rigorously. By living that way, this POKéMON packs its body with energy. | MAKUHITA has a tireless spirit -it will never give up hope. It eats a lot of food, gets plenty of sleep, and it trains very rigorously. By living that way, this POKéMON packs its body with energy. |
| 297 Hariyama | moon | They love to compare their freakish strength—strength enough to send a truck flying with a single slap. | They love to compare their freakish strength— strength enough to send a truck flying with a single slap. |
| 301 Delcatty | sapphire | DELCATTY sleeps anywhere it wants without keeping a permanent nest. If other POKéMON approach it as it sleeps, this POKéMON will never fight - it will just move away somewhere else. | DELCATTY sleeps anywhere it wants without keeping a permanent nest. If other POKéMON approach it as it sleeps, this POKéMON will never fight -it will just move away somewhere else. |
| 356 Dusclops | ruby | DUSCLOPS's body is completely hollow - there is nothing at all inside. It is said that its body is like a black hole. This POKéMON will absorb anything into its body, but nothing will ever come back out. | DUSCLOPS's body is completely hollow -there is nothing at all inside. It is said that its body is like a black hole. This POKéMON will absorb anything into its body, but nothing will ever come back out. |
| 411 Bastiodon | moon | It lived in the same environments as Rampardos. Their fossils have been found together—seemingly from after they'd fought to the finish. | It lived in the same environments as Rampardos. Their fossils have been found together— seemingly from after they'd fought to the finish. |
| 448 Lucario | moon | They can detect the species of a living being—and its emotions—from over half a mile away. They control auras and hunt their prey in packs. | They can detect the species of a living being— and its emotions—from over half a mile away. They control auras and hunt their prey in packs. |
| 457 Lumineon | legends-arceus | Uses its gleaming fins to hunt its prey. The view of Lumineon schooling near the surface of the sea at night is breathtaking—it's as though there were shining stars right there. | Uses its gleaming fins to hunt its prey. The view of Lumineon schooling near the surface of the sea at night is breathtaking— it's as though there were shining stars right there. |
| 467 Magmortar | shield | Living in the crater of a volcano has caused this Pokémon's body to resemble its environment—it has an organ similar to a magma chamber. | Living in the crater of a volcano has caused this Pokémon's body to resemble its environment— it has an organ similar to a magma chamber. |
| 501 Oshawott | legends-arceus | This Pokémon from the Unova region uses the shell on its belly as a weapon to cut down its foes. Thus, I've conferred upon this shell the name "scalchop." | This Pokémon from the Unova region uses the shell on its belly as a weapon to cut down its foes. Thus, I've conferred upon this shell the name "scalchop". |
| 526 Gigalith | shield | Although its energy blasts can blow away a dump truck, they have a limitation—they can only be fired when the sun is out. | Although its energy blasts can blow away a dump truck, they have a limitation— they can only be fired when the sun is out. |
| 545 Scolipede | sword | Scolipede latches on to its prey with the claws on its neck before slamming them into the ground and jabbing them with its claw's toxic spikes. | Scolipede latches on to its prey with the claws on its neck before slamming them into the ground and jabbing them with its claws' toxic spikes. |
| 546 Cottonee | moon | Pillows and beds stuffed with cotton exhaled by Cottonee are soft and puffy, light and airy—altogether top quality. | Pillows and beds stuffed with cotton exhaled by Cottonee are soft and puffy, light and airy— altogether top quality. |
| 590 Foongus | sword | No one knows what the Poké Ball-like pattern on Foongus means or why Foongus has it. | No one knows what the Poké Ball–like pattern on Foongus means or why Foongus has it. |
| 712 Bergmite | sword | They chill the air around them to -150 degrees Fahrenheit, freezing the water in the air into ice that they use as armor. | They chill the air around them to −150 degrees Fahrenheit, freezing the water in the air into ice that they use as armor. |

## 4. Marked by Bulbapedia's tooltips, shipped without the mark

Bulbapedia flags these inside the entry with `{{tt|...}}`; the build drops the
tooltip, so nothing in the data says so.

- **Silvally's `<Type>` placeholder is lost (our bug).** Sword and Shield, form
  "All other forms": `{{tt|<Type>|matches the type of the form}}` is stripped as if it
  were an HTML tag, so we ship "This is its -type form." and "change to the type to
  match". The game prints the form's type there. Options: one entry per Silvally form
  with its type filled in, or keep the placeholder text.
- **Texts the game never shows** ("Unused in the final release of the game"): Frillish
  Female (Shield), Jellicent Female (Sword, Shield), Unfezant Female (Sword), Koraidon
  Limited Build (Scarlet, Violet), Miraidon Low-Power Mode (Scarlet, Violet). They are
  in the game's files; the entry used for both genders/forms is marked "Used for both
  genders in-game" and is shipped too. Keep, drop, or flag them.
- **Entries only in Pokémon HOME**, filed under Sword and Shield: Mew, Mewtwo, Celebi,
  Jirachi, Regigigas, Reshiram, Zekrom, Kyurem, Keldeo, Rowlet, Dartrix, Decidueye,
  Litten, Torracat, Incineroar, Popplio, Brionne, Primarina, Cosmog, Cosmoem, Solgaleo,
  Lunala, Necrozma, Marshadow, Zeraora, Meltan, Melmetal (27 species, 54 rows). Official
  text, but not shown in the game they are listed under.
- **Mawile's Ruby 1.0 revision is missing.** `{{tt|<sc>Mawile</sc>|Misspelled as
  "Mawhile" in version 1.0 ...}}`: the 1.0 text ("MAWHILE") belongs in
  `pokedex_entry_revision` but only `<small>` notes are read as revisions.

Unit conversions in tooltips ("-150 degrees Fahrenheit" / "-100 degrees Celsius") are
Bulbapedia's own; the English game text is the first part, which is what we ship.

## 5. Not compared

Entries PokéAPI has no English text for, so nothing checked their words: every form
entry (`form` set) and these games' species entries. They go through the same
rendering as the compared ones.

| Game | Entries (form entries included) |
| --- | --- |
| scarlet | 675 |
| violet | 675 |
| legends-za | 543 |
| brilliant-diamond | 493 |
| shining-pearl | 493 |
| sword | 156 |
| shield | 156 |
| ultra-sun | 76 |
| ultra-moon | 76 |
| sun | 61 |
| moon | 61 |
| legends-arceus | 53 |
| lets-go-pikachu | 33 |
| lets-go-eevee | 33 |
| ruby | 1 |
| sapphire | 1 |
| firered | 1 |
| leafgreen | 1 |
| emerald | 1 |
