//Complete list of tags used below:

//Civ: cities, outposts, public, interiors, roads, transit, facilities, ruins, slums, temples
//Biome: forest, desert, ice, mountains, swamp, underground, water, weather, planar, hellscape 
//Mood: peaceful, somber, optimistic, fun, dramatic, tension, mysterious, epic 
//Action: explore, investigate, celebrate, ritual,sneak, chase, skirmish, monster, war, boss

var useCaseTags = {
   "523": { // Ship Graveyard
        civ: ["transit"],
        biome: ["water"],
        mood: ["tension","mysterious"],
        action: ["sneak","investigate"]
    },
   "522": { // Dragon Clan Attack
        civ: [],
        biome: ["mountains"],
        mood: ["epic","dramatic"],
        action: ["war","monster","boss"]
    },
   "521": { // The Last Watcher
        civ: ["temples","ruins"],
        biome: ["underground"],
        mood: ["mysterious"],
        action: ["investigate","explore"]
    },
   "520": { // Slave Ship Hold
        civ: ["transit"],
        biome: ["water"],
        mood: ["dramatic"],
        action: ["chase","skirmish","war"]
    },
   "519": { // Assassin's Bazaar
        civ: ["outposts","public"],
        biome: ["desert"],
        mood: ["dramatic"],
        action: ["chase","skirmish"]
    },
   "518": { // Neo Noir
        civ: ["cities","roads"],
        biome: [""],
        mood: ["peaceful","somber"],
        action: ["explore"]
    },
   "517": { // The Beast Within
        civ: ["interiors","ruins"],
        biome: ["underground"],
        mood: ["tension","mysterious"],
        action: ["investigate","monster"]
    },
   "516": { // Storm Giant
        civ: [],
        biome: ["mountains","planar"],
        mood: ["epic"],
        action: ["boss","monster"]
    },
    "515": { // Raven Queen
        civ: [],
        biome: ["forest"],
        mood: ["mysterious","tension"],
        action: ["ritual","monster"]
    },
    "514": { // Millhaven
        civ: ["cities"],
        biome: ["water"],
        mood: ["peaceful"],
        action: []
    },
    "513": { // Seer's Chamber
        civ: ["temples","interiors"],
        biome: [],
        mood: ["mysterious"],
        action: ["ritual"]
    },
    "512": { // Robot Caretaker
        civ: ["facilities"],
        biome: [],
        mood: ["optimistic"],
        action: []
    },
    "511": { // Beyond the Walls
        civ: ["roads"],
        biome: [],
        mood: ["optimistic"],
        action: ["skirmish","explore"]
    },
    "510": { // City of Wonders
        civ: ["cities"],
        biome: [],
        mood: ["optimistic"],
        action: []
    },
    "509": { // Doors and Corners
        civ: ["transit"],
        biome: ["planar"],
        mood: ["tension"],
        action: ["monster","sneak"]
    },
    "508": { // Danse de Vampyr
        civ: ["interiors"],
        biome: [],
        mood: ["mysterious"],
        action: ["skirmish","monster","boss"]
    },
    "507": { // Flux Array
        civ: ["facilities"],
        biome: [],
        mood: ["tension"],
        action: ["investigate","sneak"]
    },
    "506": { // The Verdant Dark
        civ: [],
        biome: ["forest"],
        mood: ["mysterious"],
        action: ["explore"]
    },
    "505": { // Visitation
        civ: ["temples"],
        biome: [],
        mood: ["mysterious","dramatic"],
        action: ["ritual"]
    },
    "504": { // Privy Council
        civ: ["interiors"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "503": { // Frost Giant Ridge
        civ: [],
        biome: ["ice", "mountains"],
        mood: ["dramatic","epic"],
        action: ["skirmish", "monster","boss"]
    },
    "502": { // Sentient Eye
        civ: ["ruins", "cities"],
        biome: ["planar", "desert"],
        mood: ["mysterious"],
        action: []
    },
    "501": { // Crimson Haboob
        civ: [],
        biome: ["desert", "weather"],
        mood: ["tension","dramatic"],
        action: []
    },
    "500": { // Village Festival
        civ: ["cities"],
        biome: [],
        mood: ["optimistic","fun"],
        action: ["celebrate"]
    },
    "499": { // Ravaged Lands
        civ: [],
        biome: ["desert", "hellscape"],
        mood: ["tension","dramatic"],
        action: ["sneak"]
    },
    "498": { // Urban Rooftop
        civ: ["cities", "public"],
        biome: [],
        mood: ["peaceful"],
        action: ["investigate"]
    },
    "497": { // Winter's Veil
        civ: ["roads"],
        biome: ["ice"],
        mood: ["somber","dramatic"],
        action: ["explore"]
    },
    "496": { // Viking Raid
        civ: [],
        biome: [],
        mood: ["optimistic","tension","dramatic"],
        action: ["skirmish", "war","chase"]
    },
    "495": { // Dedication Day
        civ: ["cities"],
        biome: [],
        mood: ["optimistic", "somber"],
        action: ["celebrate"]
    },
    "494": { // Docks Noir
        civ: ["transit"],
        biome: [],
        mood: ["mysterious", "tension"],
        action: ["investigate", "sneak"]
    },
    "493": { // News from the Front
        civ: [],
        biome: ["ice", "forest"],
        mood: ["tension"],
        action: []
    },
    "492": { // Maturation Chamber
        civ: ["facilities"],
        biome: ["planar"],
        mood: ["tension","dramatic"],
        action: ["sneak"]
    },
    "491": { // Red Dragon Dawn
        civ: [],
        biome: [],
        mood: ["dramatic","epic"],
        action: ["skirmish", "war","boss"]
    },
    "490": { // Stone Barrow
        civ: ["temples"],
        biome: ["mountains"],
        mood: ["peaceful","optimistic"],
        action: ["ritual"]
    },
    "489": { // The Crown Raod
        civ: ["roads"],
        biome: [],
        mood: ["optimistic"],
        action: ["explore"]
    },
    "488": { // Manor Dark
        civ: ["interiors"],
        biome: ["weather"],
        mood: ["dramatic","mysterious"],
        action: ["sneak","investigate"]
    },
    "487": { // High Alert
        civ: ["outposts"],
        biome: [],
        mood: [],
        action: ["war", "skirmish"]
    },
    "486": { // War Wagon
        civ: ["roads"],
        biome: [],
        mood: ["dramatic"],
        action: ["skirmish", "war"]
    },
    "485": { // Lady of the Wood
        civ: [],
        biome: ["forest"],
        mood: ["mysterious", "tension"],
        action: ["ritual","chase"]
    },
    "484": { // Ready the Castle
        civ: ["cities"],
        biome: [],
        mood: ["tension","dramatic"],
        action: []
    },
    "483": { // Ice Harvester Station
        civ: ["facilities"],
        biome: ["ice", "water"],
        mood: ["dramatic"],
        action: []
    },
    "482": { // Upriver Recon
        civ: ["transit"],
        biome: ["water", "forest"],
        mood: [],
        action: ["explore","investigate"]
    },
    "481": { // Witches' Dance
        civ: ["temples"],
        biome: ["forest"],
        mood: ["mysterious"],
        action: ["ritual"]
    },
    "480": { // Pharaoh's Chamber
        civ: ["interiors","temples"],
        biome: ["underground"],
        mood: ["tension"],
        action: ["investigate"]
    },
    "479": { // Boiler Room
        civ: ["facilities", "interiors"],
        biome: [],
        mood: ["tension"],
        action: ["investigate"]
    },
    "478": { // Gravedigger
        civ: ["temples","public"],
        biome: [],
        mood: ["dramatic","somber"],
        action: []
    },
    "477": { // Lifeboat
        civ: ["transit"],
        biome: ["water", "weather"],
        mood: ["tension"],
        action: ["chase"]
    },
    "476": { // Barghest Fell
        civ: [],
        biome: ["mountains"],
        mood: ["mysterious"],
        action: ["chase","investigate"]
    },
    "475": { // Lost Contact
        civ: ["facilities", "outposts", "transit"],
        biome: [],
        mood: ["tension", "mysterious"],
        action: ["sneak","investigate"]
    },
    "474": { // Kingdom of Mist
        civ: ["cities"],
        biome: ["forest", "weather"],
        mood: ["somber","peaceful"],
        action: []
    },
    "473": { // Prison Block
        civ: ["slums","interiors"],
        biome: [],
        mood: ["dramatic"],
        action: ["sneak","chase"]
    },
    "472": { // Ice Mephit Cavern
        civ: [],
        biome: ["ice", "underground"],
        mood: ["optimistic"],
        action: ["skirmish"]
    },
    "471": { // Prisoner Transport
        civ: ["interiors"],
        biome: [],
        mood: ["tension","epic"],
        action: ["chase", "skirmish"]
    },
    "470": { // The Threshing Hour
        civ: [],
        biome: ["mountains", "desert"],
        mood: ["mysterious"],
        action: []
    },
    "469": { // Monsoon Temple
        civ: ["temples"],
        biome: ["forest", "weather"],
        mood: ["peaceful"],
        action: []
    },
    "468": { // Steampunk Telescope
        civ: ["facilities"],
        biome: ["planar"],
        mood: ["peaceful"],
        action: []
    },
    "467": { // Battle Stations
        civ: ["transit"],
        biome: ["planar"],
        mood: ["somber"],
        action: ["skirmish","war"]
    },
    "466": { // Drow Slave Camp
        civ: ["slums"],
        biome: ["underground"],
        mood: ["tension","mysterious"],
        action: ["sneak"]
    },
    "465": { // Light the Beacons
        civ: [],
        biome: ["mountains"],
        mood: ["optimistic","dramatic"],
        action: ["war", "skirmish"]
    },
    "464": { // Petrified Forest
        civ: ["temples", "ruins"],
        biome: ["forest", "desert"],
        mood: ["mysterious"],
        action: ["explore","ritual"]
    },
    "463": { // Listening Post
        civ: ["transit", "outposts","interiors"],
        biome: ["planar"],
        mood: ["mysterious","tension"],
        action: ["sneak"]
    },
    "462": { // Foghaven
        civ: ["cities"],
        biome: ["weather"],
        mood: ["somber","dramatic"],
        action: []
    },
    "461": { // Resurrection
        civ: ["temples"],
        biome: ["planar", "ice"],
        mood: ["mysterious","tension"],
        action: ["ritual"]
    },
    "460": { // Doll Shoppe
        civ: ["temples", "interiors"],
        biome: [],
        mood: ["mysterious"],
        action: ["sneak"]
    },
    "459": { // Xenon Refinery
        civ: ["facilities"],
        biome: ["planar","desert"],
        mood: ["dramatic"],
        action: []
    },
    "458": { // Deep Blue
        civ: [],
        biome: ["water"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "457": { // Hunting Grounds
        civ: [],
        biome: ["mountains", "weather"],
        mood: ["somber","tension"],
        action: ["monster","sneak"]
    },
    "456": { // Drawing Room: Night
        civ: ["interiors"],
        biome: ["weather"],
        mood: ["somber"],
        action: ["investigate"]
    },
    "455": { // Harper's Waypoint
        civ: ["outposts", "interiors"],
        biome: ["forest"],
        mood: ["peaceful"],
        action: []
    },
    "454": { // Broken Pantheon
        civ: ["temples", "ruins", "interiors"],
        biome: ["underground"],
        mood: ["mysterious"],
        action: ["investigate"]
    },
    "453": { // Capes and Canes
        civ: ["cities"],
        biome: ["weather"],
        mood: [],
        action: ["investigate", "sneak"]
    },
    "452": { // The Last Express
        civ: ["transit"],
        biome: [],
        mood: ["optimistic","epic"],
        action: ["sneak", "skirmish", "chase"]
    },
    "451": { // Orb of Doom
        civ: ["temples", "interiors"],
        biome: ["planar"],
        mood: ["mysterious","dramatic"],
        action: ["ritual"]
    },
    "450": { // Nightlands
        civ: ["ruins", "temples"],
        biome: ["desert", "underground"],
        mood: ["mysterious"],
        action: ["sneak"]
    },
    "449": { // A Royal Visit
        civ: ["cities"],
        biome: [],
        mood: ["optimistic"],
        action: ["celebrate"]
    },
    "448": { // Checkpoint Omega
        civ: ["facilities", "transit"],
        biome: [],
        mood: ["tension"],
        action: ["war","chase","sneak"]
    },
    "447": { // The Murky Depths
        civ: [],
        biome: ["underground","water"],
        mood: ["mysterious"],
        action: ["explore"]
    },
    "446": { // Between Adventures
        civ: ["public", "interiors"],
        biome: [],
        mood: ["somber", "peaceful"],
        action: []
    },
    "445": { // Lava King's Lair
        civ: [],
        biome: ["hellscape", "underground"],  
        mood: ["epic","dramatic"],
        action: ["boss","monster"]
    },
    "444": { // Yuletide Cantrips
        civ: ["cities"],
        biome: [],
        mood: ["optimistic","dramatic"],
        action: ["celebrate"]
    },
    "443": { // Primate Lab
        civ: ["facilities"],
        biome: [],
        mood: ["mysterious"],
        action: ["sneak","chase"]
    },
    "442": { // Darkmoor
        civ: [],
        biome: ["forest"],
        mood: ["mysterious","epic"],
        action: ["monster", "skirmish","boss"]
    },
    "441": { // Tech Market
        civ: ["cities","public"],
        biome: [],
        mood: ["somber","dramatic"],
        action: []
    },
    "440": { // Map Chamber
        civ: ["temples"],
        biome: [],
        mood: ["peaceful"],
        action: ["ritual"]
    },
    "439": { // Goodhaven
        civ: ["cities"],
        biome: ["water"],
        mood: ["peaceful","fun"],
        action: ["celebrate",]
    },
    "438": { // Red Sky Mine
        civ: ["facilities"],
        biome: ["planar"],
        mood: ["somber"],
        action: ["monster","explore"]
    },
    "437": { // Dungeon Asylum
        civ: ["slums","interiors"],
        biome: ["planar", "underground"],
        mood: ["mysterious"],
        action: ["monster","skirmish"]
    },
    "436": { // Winter Encampment
        civ: ["outposts"],
        biome: ["forest", "ice"],
        mood: ["somber"],
        action: []
    },
    "435": { // The Undercroft
        civ: ["temples", "interiors"],
        biome: ["underground"],
        mood: ["peaceful","dramatic"],
        action: ["explore"]
    },
    "434": { // Cryo Pods
        civ: ["transit"],
        biome: ["planar"],
        mood: ["mysterious","tension"],
        action: ["monster","sneak"]
    },
    "433": { // Spectral Abbey
        civ: ["ruins", "temples", "interiors"],
        biome: ["weather"],
        mood: ["mysterious","epic"],
        action: ["sneak","investigate"]
    },
    "432": { // Lair of the Wyrm
        civ: ["interiors"],
        biome: ["underground"],
        mood: ["tension","epic"],
        action: ["monster", "boss", "skirmish"]
    },
    "431": { // Hotel Noir
        civ: ["cities","roads"],
        biome: [],
        mood: ["mysterious"],
        action: ["investigate", "sneak"]
    },
    "430": { // Fire Dance
        civ: [],
        biome: ["forest"],
        mood: ["epic","dramatic"],
        action: ["ritual","skirmish","monster"]
    },
    "429": { // Imperial Pursuit
        civ: ["transit"],
        biome: [],
        mood: ["tension","dramatic"],
        action: ["chase","skirmish","war","monster"]
    },
    "428": { // The Sisterhood
        civ: ["temples"],
        biome: ["planar"],
        mood: ["peaceful","somber"],
        action: []
    },
    "427": { // Bug Hunt
        civ: ["transit"],
        biome: ["planar"],
        mood: ["tension","epic"],
        action: ["sneak", "monster", "skirmish","boss"]
    },
    "426": { // Stagecoach Heist
        civ: ["transit"],
        biome: ["desert"],
        mood: ["optimistic","tension","epic"],
        action: ["chase", "skirmish"]
    },
    "425": { // The Stranger
        civ: ["outposts"],
        biome: ["desert"],
        mood: ["somber", "mysterious"],
        action: []
    },
    "424": { // Frontier Town
        civ: ["cities", "outposts"],
        biome: ["desert"],
        mood: ["optimistic","fun"],
        action: ["explore","celebrate"]
    },
    "423": { // Magical Flora
        civ: [],
        biome: ["planar", "forest"],
        mood: ["peaceful"],
        action: []
    },
    "422": { // Ghost Ship
        civ: ["transit"],
        biome: ["planar", "water"],
        mood: ["mysterious"],
        action: ["investigate","sneak"]
    },
    "421": { // The Madding Crowd
        civ: ["cities", "public", "interiors"],
        biome: [],
        mood: ["dramatic"],
        action: []
    },
    "420": { // Counting House
        civ: ["public","interiors"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "419": { // Hidden Passage
        civ: ["roads"],
        biome: ["underground"],
        mood: ["tension","mysterious"],
        action: ["sneak", "skirmish"]
    },
    "418": { // Pagan Woods
        civ: ["ruins", "temples"],
        biome: ["forest"],
        mood: ["mysterious"],
        action: ["ritual","skirmish","monster"]
    },
    "417": { // Mainframe
        civ: ["facilities"],
        biome: ["planar"],
        mood: ["somber","dramatic"],
        action: ["investigate","sneak","explore"]
    },
    "416": { // Rebuilding
        civ: ["cities"],
        biome: [],
        mood: ["peaceful","somber","dramatic"],
        action: []
    },
    "415": { // Jungle Bunker
        civ: ["facilities"],
        biome: ["forest"],
        mood: ["tension","epic"],
        action: ["skirmish","monster","boss"]
    },
    "414": { // Stakeout
        civ: ["cities","interiors"],
        biome: [],
        mood: ["tension","dramatic"],
        action: ["investigate", "sneak","chase"]
    },
    "413": { // Collegium Magica
        civ: ["interiors","public"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "412": { // Tomb Guardians
        civ: ["interiors"],
        biome: ["underground"],
        mood: ["tension","mysterious"],
        action: ["monster","skirmish"]
    },
    "411": { // Ship of the Line
        civ: ["transit"],
        biome: ["water", "weather"],
        mood: ["optimistic","epic"],
        action: ["skirmish","war","chase"]
    },
    "410": { // Forgotten Forest
        civ: ["temples"],
        biome: ["forest"],
        mood: ["somber", "mysterious"],
        action: ["ritual","explore","investigate"]
    },
    "409": { // Docking Procedure
        civ: ["transit"],
        biome: ["planar"],
        mood: ["optimistic","peaceful"],
        action: ["explore"]
    },
    "408": { // Nautiloid Escape
        civ: ["interiors"],
        biome: ["planar"],
        mood: ["tension"],
        action: ["war", "skirmish","boss"]
    },
    "407": { // Viking Tavern
        civ: ["public", "interiors"],
        biome: [],
        mood: ["optimistic","fun"],
        action: ["celebrate"]
    },
    "406": { // Treacherous Path
        civ: ["roads"],
        biome: ["mountains", "hellscape","desert"],
        mood: ["mysterious","tension"],
        action: ["explore","sneak"]
    },
    "405": { // Brood Mother
        civ: ["interiors"],
        biome: ["underground"],
        mood: ["epic","tension"],
        action: ["monster", "boss"]
    },
    "404": { // Vampyr
        civ: ["interiors"],
        biome: [],
        mood: ["mysterious","tension"],
        action: ["sneak","investigate"]
    },
    "403": { // Steel Foundry
        civ: ["facilities"],
        biome: [],
        mood: ["tension","mysterious"],
        action: ["sneak","investigate"]
    },
    "402": { // The Drowned Tower
        civ: ["ruins"],
        biome: ["water"],
        mood: ["peaceful","optimistic"],
        action: ["explore"]
    },
    "401": { // Feast of Crispian
        civ: ["public", "interiors"],
        biome: [],
        mood: ["optimistic","fun"],
        action: ["celebrate"]
    },
    "400": { // Whispering Caverns
        civ: ["interiors"],
        biome: ["underground", "planar"],
        mood: ["mysterious"],
        action: ["investigate"]
    },
    "399": { // Whiteout
        civ: [],
        biome: ["ice", "weather"],
        mood: ["epic","tension"],
        action: ["chase","skirmish"]
    },
    "398": { // The Misty Marsh
        civ: ["transit"],
        biome: ["water","swamp"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "397": { // Homecoming
        civ: ["cities"],
        biome: [],
        mood: ["optimistic","fun"],
        action: ["celebrate"]
    },
    "396": { // The Ansible
        civ: ["ruins"],
        biome: ["planar", "mountains"],
        mood: ["somber","dramatic"],
        action: []
    },
    "395": { // Launch Day
        civ: ["facilities", "transit"],
        biome: ["planar"],
        mood: ["optimistic","dramatic"],
        action: []
    },
    "394": { // Demon Army
        civ: ["cities"],
        biome: ["planar", "hellscape"],
        mood: ["epic","dramatic"],
        action: ["skirmish", "war","monster"]
    },
    "393": { // Hellhound Alley
        civ: ["cities", "slums"],
        biome: [],
        mood: ["somber"],
        action: ["monster","investigate"]
    },
    "392": { // Trireme
        civ: ["transit"],
        biome: ["water"],
        mood: ["somber","mysterious"],
        action: ["explore"]
    },
    "391": { // Train Job
        civ: ["transit","roads"],
        biome: [],
        mood: ["tension","epic"],
        action: ["skirmish", "chase", "sneak"]
    },
    "390": { // Desert Devotional
        civ: ["temples"],
        biome: ["desert"],
        mood: ["peaceful","somber"],
        action: ["explore","ritual"]
    },
    "389": { // Medieval Market
        civ: ["cities", "public"],
        biome: [],
        mood: ["peaceful","optimistic"],
        action: []
    },
    "388": { // Lord of Bones
        civ: ["interiors"],
        biome: ["underground", "hellscape"],
        mood: ["epic",],
        action: ["monster", "boss", "skirmish"]
    },
    "387": { // Docking Bay
        civ: ["transit"],
        biome: [],
        mood: ["epic","tension"],
        action: ["skirmish", "war", "chase"]
    },
    "386": { // The Attic
        civ: ["interiors"],
        biome: [],
        mood: ["mysterious"],
        action: ["sneak"]
    },
    "385": { // Infiltration
        civ: ["facilities"],
        biome: [],
        mood: ["tension"],
        action: ["sneak", "chase"]
    },
    "384": { // Western Watchtower
        civ: ["ruins", "outposts"],
        biome: ["mountains"],
        mood: ["dramatic"],
        action: ["explore"]
    },
    "383": { // Banshee's Lair
        civ: ["outposts", "interiors"],
        biome: ["forest"],
        mood: ["mysterious"],
        action: ["sneak","investigate"]
    },
    "382": { // Long Rest
        civ: ["outposts"],
        biome: ["forest"],
        mood: ["peaceful"],
        action: []
    },
    "381": { // Halfling Sneak
        civ: ["interiors"],
        biome: [],
        mood: ["tension","fun"],
        action: ["sneak", "chase"]
    },
    "380": { // The Great Lift
        civ: ["facilities"],
        biome: ["mountains"],
        mood: ["dramatic"],
        action: ["skirmish"]
    },
    "379": { // Terraforming
        civ: ["facilities"],
        biome: ["planar","desert"],
        mood: ["optimistic","dramatic"],
        action: []
    },
    "378": { // Descent
        civ: [],
        biome: ["underground"],
        mood: ["mysterious"],
        action: ["sneak","investigate"]
    },
    "377": { // Through the Woods
        civ: ["transit"],
        biome: ["forest"],
        mood: ["tension"],
        action: ["chase", "skirmish","monster"]
    },
    "376": { // Voyage Begins
        civ: ["transit", "roads"],
        biome: ["water"],
        mood: ["optimistic"],
        action: ["explore"]
    },
    "375": { // Rise of the Golem
        civ: ["temples"],
        biome: [],
        mood: ["mysterious","tension"],
        action: ["sneak","investigate"]
    },
    "374": { // Hall of Angels
        civ: ["temples"],
        biome: [],
        mood: ["dramatic", "somber"],
        action: ["ritual"]
    },
    "373": { // Infernal Machine
        civ: ["facilities"],
        biome: [],
        mood: ["somber"],
        action: []
    },
    "372": { // Den of Iniquity
        civ: ["public", "interiors"],
        biome: [],
        mood: ["mysterious"],
        action: ["celebrate","investigate"]
    },
    "371": { // Whirlpool
        civ: ["transit"],
        biome: ["water"],
        mood: ["epic"],
        action: ["skirmish","boss","chase"]
    },
    "370": { // Awakenings
        civ: ["facilities","transit"],
        biome: [],
        mood: ["optimistic"],
        action: ["explore"]
    },
    "369": { // Troll Grotto
        civ: [],
        biome: ["underground"],
        mood: ["tension","dramatic"],
        action: ["monster","investigate"]
    },
    "368": { // Ghosts of Appalacia
        civ: ["ruins", "interiors"],
        biome: ["forest", "ice"],
        mood: ["mysterious"],
        action: []
    },
    "367": { // Rope Bridge
        civ: [],
        biome: ["forest"],
        mood: ["tension"],
        action: ["skirmish","chase","sneak"]
    },
    "366": { // Roc's Nest
        civ: [],
        biome: ["mountains"],
        mood: ["tension"],
        action: ["monster","skirmish"]
    },
    "365": { // Trail of Ashes
        civ: ["roads"],
        biome: ["desert","ice"],
        mood: ["somber","dramatic"],
        action: ["war","explore"]
    },
    "364": { // River of Blood
        civ: [],
        biome: ["planar", "desert", "hellscape"],
        mood: ["epic","mysterious"],
        action: []
    },
    "363": { // Starship Adrift
        civ: ["transit"],
        biome: ["planar"],
        mood: ["somber","dramatic"],
        action: ["explore","investigate"]
    },
    "362": { // Rolling Emporium
        civ: ["public", "interiors"],
        biome: ["mountains"],
        mood: ["optimistic",],
        action: ["explore"]
    },
    "361": { // Ancient Beacon
        civ: ["temples"],
        biome: ["desert", "weather","planar"],
        mood: ["tension"],
        action: ["investigate","sneak"]
    },
    "360": { // Pit Fighter
        civ: ["public"],
        biome: [],
        mood: ["epic",],
        action: ["skirmish","boss"]
    },
    "359": { // Skull Island
        civ: ["transit"],
        biome: ["water", "forest"],
        mood: ["mysterious","tension"],
        action: ["skirmish","sneak","chase"]
    },
    "358": { // Egg Chamber
        civ: [],
        biome: ["planar","underground"],
        mood: ["mysterious","tension"],
        action: ["monster","investigate"]
    },
    "357": { // Promontory
        civ: [],
        biome: ["water"],
        mood: ["somber", "peaceful"],
        action: []
    },
    "356": { // Adventure Begins
        civ: ["cities","public"],
        biome: [],
        mood: ["optimistic","peaceful"],
        action: []
    },
    "355": { // Hydroponics Bay
        civ: ["facilities"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "354": { // Warlock's Whisper
        civ: ["temples"],
        biome: [],
        mood: ["mysterious", "somber"],
        action: ["ritual","sneak"]
    },
    "353": { // Spirit of the Plains
        civ: [],
        biome: ["planar", "mountains"],
        mood: ["peaceful","somber"],
        action: []
    },
    "352": { // Black Rider
        civ: ["roads"],
        biome: ["forest"],
        mood: ["mysterious","tension","epic"],
        action: ["skirmish", "chase"]
    },
    "351": { // Halfling Lodge
        civ: ["public", "interiors"],
        biome: [],
        mood: ["fun"],
        action: ["celebrate"]
    },
    "350": { // Covert Ops
        civ: ["cities"],
        biome: [],
        mood: ["tension"],
        action: ["sneak","chase"]
    },
    "349": { // Puzzle Dungeon
        civ: ["interiors"],
        biome: ["underground"],
        mood: ["tension"],
        action: ["sneak"]
    },
    "348": { // Viking Village
        civ: ["cities"],
        biome: ["ice", "mountains"],
        mood: ["somber","dramatic"],
        action: []
    },
    "347": { // Elven Procession
        civ: [],
        biome: ["forest"],
        mood: ["mysterious", "peaceful"],
        action: ["ritual"]
    },
    "346": { // Tinkertown
        civ: ["cities","ruins"],
        biome: [],
        mood: ["dramatic"],
        action: []
    },
    "345": { // High Seas Pursuit
        civ: ["transit"],
        biome: ["water"],
        mood: ["epic","dramatic"],
        action: ["skirmish", "chase"]
    },
    "344": { // Yokai Forest
        civ: [],
        biome: ["forest"],
        mood: ["mysterious"],
        action: ["sneak","ritual"]
    },
    "343": { // Dungeon Collapse
        civ: ["temples", "ruins"],
        biome: ["underground"],
        mood: ["epic"],
        action: ["skirmish", "chase","monster","boss"]
    },
    "342": { // Tavern Celebration
        civ: ["public", "interiors"],
        biome: [],
        mood: ["fun","optimistic"],
        action: ["celebrate", "skirmish"]
    },
    "341": { // Beggar's Rest
        civ: ["cities", "slums"],
        biome: [],
        mood: ["somber","tension"],
        action: ["investigate","sneak"]
    },
    "340": { // Starbase Omega
        civ: ["facilities", "transit", "outposts"],
        biome: ["planar"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "339": { // Red Planet
        civ: ["outposts"],
        biome: ["desert", "weather", "planar"],
        mood: ["tension"],
        action: ["explore","investigate"]
    },
    "338": { // Adventure Supply
        civ: ["cities", "public", "interiors"],
        biome: [],
        mood: ["optimistic","fun"],
        action: []
    },
    "337": { // Village of the Damned
        civ: ["cities"],
        biome: ["weather"],
        mood: ["mysterious","tension"],
        action: ["ritual","investigate"]
    },
    "336": { // Medieval Banquet
        civ: ["roads", "interiors"],
        biome: [],
        mood: ["fun","optimistic"],
        action: ["celebrate"]
    },
    "335": { // Abandoned Chapel
        civ: ["temples", "ruins"],
        biome: [],
        mood: ["mysterious","somber"],
        action: ["ritual"]
    },
    "334": { // Harpies' Nest
        civ: [],
        biome: ["weather", "mountains"],
        mood: ["epic","optimistic"],
        action: ["monster", "skirmish"]
    },
    "333": { // Arcane Athenaeum
        civ: ["temples","interiors"],
        biome: ["planar"],
        mood: ["mysterious"],
        action: ["explore","investigate"]
    },
    "332": { // Myconid Colony
        civ: ["temples"],
        biome: ["planar", "underground"],
        mood: ["somber", "mysterious"],
        action: ["investigate","sneak"]
    },
    "331": { // Drowned Sailors
        civ: [],
        biome: ["water"],
        mood: ["tension"],
        action: ["skirmish","monster"]
    },
    "330": { // Mega City Slums
        civ: ["cities","slums"],
        biome: [],
        mood: ["peaceful"],
        action: ["investigate"]
    },
    "329": { // Desert Temple
        civ: ["temples"],
        biome: ["desert"],
        mood: ["peaceful"],
        action: ["ritual"]
    },
    "328": { // Battle Requiem
        civ: [],
        biome: ["desert"],
        mood: ["somber"],
        action: []
    },
    "327": { // Distilled: Tropical
        civ: ["outposts"],
        biome: ["water"],
        mood: ["fun","optimistic"],
        action: ["celebrate"]
    },
    "326": { // Distilled: Tranquility
        civ: [],
        biome: ["forest","water"],
        mood: ["peaceful"],
        action: []
    },
    "325": { // Distilled: Warehouse
        civ: ["facilities"],
        biome: [],
        mood: ["mysterious"],
        action: []
    },
    "324": { // Distilled: Highlands
        civ: [],
        biome: ["mountains"],
        mood: ["peaceful","somber"],
        action: []
    },
    "323": { // Distilled: Backwoods
        civ: ["outposts","public"],
        biome: ["forest"],
        mood: ["optimistic", "fun"],
        action: []
    },
    "322": { // Distilled: Cooperage
        civ: ["facilities"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "321": { // Invisible Mountain
        civ: [],
        biome: ["mountains", "weather", "water"],
        mood: ["peaceful","optimistic"],
        action: ["celebrate"]
    },
    "320": { // Cultist's Cavern
        civ: ["temples","interiors"],
        biome: ["underground"],
        mood: ["mysterious"],
        action: ["ritual"]
    },
    "319": { // Shaman's Hollow
        civ: [],
        biome: ["planar", "forest"],
        mood: ["mysterious","somber"],
        action: ["ritual"]
    },
    "318": { // The Gaping Maw
        civ: [],
        biome: ["hellscape","underground"],
        mood: ["tension","epic"],
        action: ["boss", "skirmish"]
    },
    "317": { // Robot Scrapyard
        civ: ["facilities"],
        biome: [],
        mood: ["peaceful","optimistic"],
        action: ["explore"]
    },
    "316": { // Goblin Ambush
        civ: ["roads"],
        biome: ["forest"],
        mood: ["tension"],
        action: ["skirmish", "chase"]
    },
    "315": { // Dragon Rider
        civ: [],
        biome: ["weather"],
        mood: ["epic","tension"],
        action: ["skirmish", "chase","boss"]
    },
    "314": { // Shuttle Crash
        civ: ["transit"],
        biome: ["planar", "forest", "swamp"],
        mood: ["somber","peaceful"],
        action: ["investigate"]
    },
    "313": { // Dusk of the Dryad
        civ: [],
        biome: ["forest"],
        mood: ["mysterious"],
        action: ["ritual"]
    },
    "312": { // Generation Ship
        civ: ["transit"],
        biome: ["planar"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "311": { // Swamp Thing
        civ: ["transit"],
        biome: ["swamp", "water"],
        mood: ["mysterious"],
        action: ["monster"]
    },
    "310": { // Moisture Farm
        civ: ["facilities"],
        biome: ["desert", "planar", "water"],
        mood: ["peaceful","somber"],
        action: []
    },
    "309": { // Bloodgate
        civ: [],
        biome: ["planar","hellscape"],
        mood: ["mysterious","epic"],
        action: ["ritual","sneak","skirmish"]
    },
    "308": { // Skullwharf
        civ: ["slums", "transit"],
        biome: ["underground"],
        mood: ["tension"],
        action: ["sneak","investigate"]
    },
    "307": { // Sand Raiders
        civ: [],
        biome: ["desert"],
        mood: ["epic","tension"],
        action: ["skirmish","war","monster","chase"]
    },
    "306": { // Aftermath
        civ: ["outposts","ruins"],
        biome: ["planar", "desert"],
        mood: ["peaceful"],
        action: []
    },
    "305": { // Hidden Valley
        civ: [],
        biome: ["weather", "forest"],
        mood: ["somber", "peaceful"],
        action: ["explore"]
    },
    "304": { // Fog of War
        civ: ["outposts"],
        biome: ["planar"],
        mood: ["tension","somber"],
        action: ["skirmish","war"]
    },
    "303": { // Summoning
        civ: ["temples"],
        biome: [],
        mood: ["mysterious","epic"],
        action: ["sneak", "ritual"]
    },
    "302": { // Floating Market
        civ: ["public", "transit", "interiors"],
        biome: ["water"],
        mood: ["optimistic","fun"],
        action: ["explore","celebrate"]
    },
    "301": { // Pool of Radiance
        civ: ["temples"],
        biome: [],
        mood: ["peaceful"],
        action: ["ritual"]
    },
    "300": { // Burn Maneuver
        civ: ["transit"],
        biome: ["planar"],
        mood: ["mysterious","dramatic"],
        action: []
    },
    "299": { // Necropolis
        civ: ["ruins", "cities"],
        biome: ["underground", "planar"],
        mood: ["mysterious"],
        action: ["sneak","explore"]
    },
    "298": { // Gateway to Hell
        civ: [],
        biome: ["planar", "hellscape"],
        mood: ["tension","dramatic"],
        action: ["investigate"]
    },
    "297": { // Survivor's Bivouac
        civ: ["outposts"],
        biome: ["desert","ice"],
        mood: ["somber"],
        action: []
    },
    "296": { // The Frozen Trail
        civ: ["roads"],
        biome: ["ice","weather"],
        mood: ["somber","peaceful"],
        action: ["explore"]
    },
    "295": { // Closing Time
        civ: ["cities"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "294": { // Cutpurse Pursuit
        civ: ["cities"],
        biome: [],
        mood: ["optimistic",],
        action: ["chase","sneak"]
    },
    "293": { // Sanitarium
        civ: ["facilities", "slums"],
        biome: [],
        mood: ["mysterious"],
        action: ["investigate","sneak"]
    },
    "292": { // Bleakwater Docks
        civ: ["transit", "cities"],
        biome: ["water"],
        mood: ["mysterious","somber"],
        action: ["investigate"]
    },
    "291": { // Investigator's Office
        civ: ["interiors"],
        biome: [],
        mood: ["mysterious"],
        action: ["investigate"]
    },
    "290": { // Wagon Ride
        civ: ["roads"],
        biome: [],
        mood: ["somber"],
        action: ["explore"]
    },
    "289": { // Ancient Artifact
        civ: ["temples"],
        biome: ["planar"],
        mood: ["tension", "somber"],
        action: ["ritual"]
    },
    "288": { // Everdeep
        civ: ["cities"],
        biome: ["water"],
        mood: ["optimistic","peaceful"],
        action: ["explore"]
    },
    "287": { // The Strange
        civ: ["cities", "temples"],
        biome: ["planar"],
        mood: ["mysterious"],
        action: []
    },
    "286": { // Blastfire Bog
        civ: [],
        biome: ["swamp"],
        mood: ["mysterious"],
        action: ["investigate"]
    },
    "285": { // High Rannoc Village
        civ: ["cities"],
        biome: ["mountains"],
        mood: ["optimistic"],
        action: ["celebrate",]
    },
    "284": { // Oasis City
        civ: ["cities", "public"],
        biome: ["desert"],
        mood: ["mysterious","optimistic"],
        action: ["explore","investigate","sneak"]
    },
    "283": { // Pattern Recognition
        civ: ["facilities"],
        biome: [],
        mood: ["tension"],
        action: ["sneak","chase","investigate"]
    },
    "282": { // The Wild Hunt
        civ: [],
        biome: ["forest"],
        mood: ["fun","optimistic"],
        action: ["chase", "skirmish","monster"]
    },
    "281": { // Escape from Shadow
        civ: ["roads"],
        biome: [],
        mood: [],
        action: ["chase", "skirmish", "war","monster"]
    },
    "280": { // The City Above
        civ: ["cities"],
        biome: [],
        mood: ["peaceful","optimistic"],
        action: ["investigate","explore"]
    },
    "279": { // Blighted Farm
        civ: ["cities", "ruins"],
        biome: [],
        mood: ["mysterious"],
        action: ["investigate"]
    },
    "278": { // Farmyard
        civ: ["cities"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "277": { // A New Beginning
        civ: [],
        biome: ["desert", "water"],
        mood: ["tension", "peaceful"],
        action: ["explore"]
    },
    "276": { // Forge of Fury
        civ: ["facilities"],
        biome: ["underground"],
        mood: ["epic","mysterious"],
        action: ["skirmish","war"]
    },
    "275": { // Lorekeeper Grove
        civ: [],
        biome: ["weather", "forest"],
        mood: ["somber", "peaceful"],
        action: ["ritual"]
    },
    "274": { // Jungle Shaman
        civ: [],
        biome: ["forest","water"],
        mood: ["mysterious"],
        action: ["ritual"]
    },
    "273": { // Arcane Clockworks
        civ: ["facilities"],
        biome: [],
        mood: ["mysterious","fun"],
        action: ["sneak","investigate","chase"]
    },
    "272": { // Starforged: Vault
        civ: ["facilities"],
        biome: ["planar"],
        mood: ["mysterious"],
        action: ["sneak"]
    },
    "271": { // Starforged: Fray
        civ: ["transit"],
        biome: ["planar"],
        mood: ["epic","dramatic"],
        action: ["chase", "skirmish","war"]
    },
    "270": { // Starforged: Sojourn
        civ: ["facilities", "outposts"],
        biome: ["planar"],
        mood: ["optimistic"],
        action: []
    },
    "269": { // Starforged: Planetside
        civ: [],
        biome: ["planar","desert"],
        mood: ["mysterious"],
        action: ["investigate","explore"]
    },
    "268": { // Starforged: Space
        civ: ["transit"],
        biome: ["planar"],
        mood: ["optimistic", "somber"],
        action: ["explore"]
    },
    "267": { // Court of the Count
        civ: ["interiors"],
        biome: [],
        mood: ["dramatic", "mysterious"],
        action: ["investigate","sneak"]
    },
    "266": { // Orbital Prison Break
        civ: ["facilities"],
        biome: [],
        mood: ["tension"],
        action: ["chase", "skirmish", "war", "boss"]
    },
    "265": { // Shrine of Talos
        civ: ["temples"],
        biome: ["planar", "mountains", "weather"],
        mood: ["mysterious","somber"],
        action: ["ritual"]
    },
    "264": { // Base Assault
        civ: ["facilities"],
        biome: [],
        mood: ["optimistic","tension"],
        action: ["skirmish", "war", "boss"]
    },
    "263": { // Mysterious Grotto
        civ: ["interiors"],
        biome: ["underground", "mountains"],
        mood: ["dramatic", "somber"],
        action: ["explore"]
    },
    "262": { // Victorian Slums
        civ: ["slums", "cities"],
        biome: [],
        mood: ["tension","somber"],
        action: ["investigate"]
    },
    "261": { // Unto the Breach
        civ: ["outposts"],
        biome: ["mountains"],
        mood: ["epic","tension"],
        action: ["war", "skirmish"]
    },
    "260": { // Skyship
        civ: ["transit"],
        biome: ["planar"],
        mood: ["optimistic","fun"],
        action: ["explore"]
    },
    "259": { // Grand Theater
        civ: ["interiors"],
        biome: [],
        mood: ["dramatic"],
        action: ["explore","investigate"]
    },
    "258": { // Blighted Forest
        civ: [],
        biome: ["forest"],
        mood: ["mysterious"],
        action: ["investigate"]
    },
    "257": { // Country Workshop
        civ: ["facilities","outposts"],
        biome: ["forest","mountains"],
        mood: ["peaceful"],
        action: []
    },
    "256": { // Ice Dragon
        civ: ["cities"],
        biome: ["ice"],
        mood: ["mysterious","epic"],
        action: ["skirmish", "boss", "monster", "war"]
    },
    "255": { // The Hearth Inn
        civ: ["public", "interiors"],
        biome: [],
        mood: ["optimistic"],
        action: [,"celebrate"]
    },
    "254": { // Desert Planet Souk
        civ: ["public", "interiors"],
        biome: ["desert", "planar"],
        mood: ["mysterious"],
        action: []
    },
    "253": { // Submerged
        civ: [],
        biome: ["water"],
        mood: ["somber", "peaceful"],
        action: ["explore"]
    },
    "252": { // Vault of Terror
        civ: ["interiors"],
        biome: ["underground"],
        mood: ["tension", "somber"],
        action: ["investigate","sneak"]
    },
    "251": { // Candledeep
        civ: ["temples", "interiors"],
        biome: [],
        mood: ["mysterious"],
        action: ["investigate","explore"]
    },
    "250": { // Wolf Pen
        civ: ["slums", "interiors"],
        biome: ["underground"],
        mood: ["tension"],
        action: ["monster"]
    },
    "249": { // Steampunk Station
        civ: ["cities"],
        biome: [],
        mood: ["optimistic","dramatic"],
        action: ["explore","investigate"]
    },
    "248": { // Alien Reactor
        civ: ["facilities"],
        biome: [],
        mood: ["mysterious", "somber", "tension"],
        action: ["monster","investigate"]
    },
    "247": { // Oregon Trail
        civ: ["roads","outposts"],
        biome: ["mountains"],
        mood: ["somber"],
        action: ["explore",]
    },
    "246": { // Magic Shoppe
        civ: ["cities", "public", "interiors"],
        biome: [],
        mood: ["optimistic","fun"],
        action: [,"investigate","sneak"]
    },
    "245": { // Secret Facility
        civ: ["facilities"],
        biome: ["underground"],
        mood: ["tension"],
        action: ["sneak"]
    },
    "244": { // Vikings
        civ: [],
        biome: ["water"],
        mood: ["tension"],
        action: ["skirmish","war"]
    },
    "243": { // Jungle Ruins
        civ: ["temples"],
        biome: ["forest"],
        mood: ["mysterious","tension"],
        action: ["investigate","sneak"]
    },
    "242": { // Spider's Den
        civ: ["interiors"],
        biome: ["underground"],
        mood: ["somber"],
        action: ["monster", "boss"]
    },
    "241": { // Pirates!
        civ: ["transit"],
        biome: ["water"],
        mood: ["optimistic","dramatic"],
        action: ["skirmish","chase"]
    },
    "240": { // Throne Room
        civ: ["interiors"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "239": { // Nordic Noir
        civ: ["roads","cities"],
        biome: [],
        mood: ["somber"],
        action: ["investigate","sneak"]
    },
    "238": { // Mind Flayer Chamber
        civ: ["interiors"],
        biome: ["underground"],
        mood: ["tension"],
        action: ["skirmish","monster"]
    },
    "237": { // Training Grounds
        civ: ["public","outposts"],
        biome: [],
        mood: ["optimistic"],
        action: ["war", "skirmish"]
    },
    "236": { // Defiled Temple
        civ: ["temples", "interiors"],
        biome: ["underground"],
        mood: ["somber"],
        action: ["sneak", "monster", "ritual"]
    },
    "235": { // Rainy Village
        civ: ["cities"],
        biome: ["weather"],
        mood: ["peaceful"],
        action: []
    },
    "234": { // Lush World
        civ: [],
        biome: ["water", "planar"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "233": { // The Orrery
        civ: ["facilities", "temples"],
        biome: [],
        mood: ["peaceful"],
        action: ["ritual"]
    },
    "232": { // Mech War
        civ: ["cities","transit"],
        biome: [],
        mood: ["tension","dramatic"],
        action: ["skirmish", "war", "boss"]
    },
    "231": { // Icebound Town
        civ: ["outposts", "cities"],
        biome: ["ice"],
        mood: ["mysterious"],
        action: []
    },
    "230": { // All Hallow's Eve
        civ: ["cities"],
        biome: ["planar"],
        mood: ["mysterious"],
        action: ["monster","investigate","sneak"]
    },
    "229": { // Interrogation Room
        civ: ["facilities"],
        biome: [],
        mood: ["tension", "somber"],
        action: ["investigate", "skirmish", "sneak"]
    },
    "228": { // Mushroom Forest
        civ: [],
        biome: ["planar"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "227": { // Terror in the Woods
        civ: [],
        biome: ["forest"],
        mood: ["tension"],
        action: ["skirmish", "chase", "monster"]
    },
    "226": { // 60s Compter Lab
        civ: ["facilities"],
        biome: [],
        mood: ["tension"],
        action: ["investigate"]
    },
    "225": { // New Orleans Noir
        civ: ["cities"],
        biome: [],
        mood: ["mysterious"],
        action: ["investigate"]
    },
    "224": { // Mansion: Night
        civ: ["interiors"],
        biome: [],
        mood: ["somber", "mysterious"],
        action: ["sneak", "investigate"]
    },
    "223": { // Salt Marsh
        civ: [],
        biome: ["swamp", "water"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "222": { // Wuxia Tea House
        civ: ["interiors", "public"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "221": { // Sunken Treasure
        civ: [],
        biome: ["water"],
        mood: ["mysterious"],
        action: ["investigate"]
    },
    "220": { // Wuxia Village
        civ: ["cities"],
        biome: ["mountains"],
        mood: ["peaceful","somber"],
        action: []
    },
    "219": { // Tinker's Workshop
        civ: ["public", "interiors"],
        biome: [],
        mood: ["fun","optimistic"],
        action: ["investigate", "sneak"]
    },
    "218": { // Sleeping Ogre
        civ: ["interiors"],
        biome: ["underground"],
        mood: ["somber"],
        action: ["monster", "sneak"]
    },
    "217": { // Storm at Sea
        civ: ["transit"],
        biome: ["water","weather"],
        mood: ["dramatic"],
        action: ["chase","skirmish"]
    },
    "216": { // Waterkeep: Night
        civ: ["cities"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "215": { // Space Battle
        civ: ["transit"],
        biome: ["planar"],
        mood: ["optimistic"],
        action: ["skirmish","war"]
    },
    "214": { // Castle Kitchen
        civ: ["public"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "213": { // Burning Village
        civ: ["ruins", "cities"],
        biome: ["hellscape"],
        mood: ["tension"],
        action: ["investigate"]
    },
    "212": { // Witch Mountain
        civ: ["temples"],
        biome: ["mountains"],
        mood: ["tension","mysterious"],
        action: ["chase", "skirmish", "war"]
    },
    "211": { // Thieve's Guild
        civ: ["outposts"],
        biome: [],
        mood: ["mysterious", "somber"],
        action: ["investigate", "sneak", "skirmish"]
    },
    "210": { // Temple Garden
        civ: ["public"],
        biome: ["water"],
        mood: ["peaceful"],
        action: []
    },
    "209": { // Rat Battle
        civ: ["slums"],
        biome: ["underground"],
        mood: ["fun"],
        action: ["skirmish","monster"]
    },
    "208": { // Ghost Town
        civ: ["ruins", "cities"],
        biome: ["desert"],
        mood: ["peaceful"],
        action: ["investigate"]
    },
    "207": { // Biodome
        civ: ["transit"],
        biome: ["planar"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "206": { // Heart: High Rise
        civ: ["ruins","cities"],
        biome: ["weather"],
        mood: ["mysterious"],
        action: ["investigate"]
    },
    "205": { // Heart: Absolution
        civ: ["cities"],
        biome: ["planar"],
        mood: ["mysterious"],
        action: ["investigate"]
    },
    "204": { // Heart: Meat Corridor
        civ: ["slums"],
        biome: ["underground","planar"],
        mood: ["mysterious"],
        action: ["investigate"]
    },
    "203": { // Heart: Briar
        civ: ["outposts"],
        biome: ["forest"],
        mood: ["dramatic","tension"],
        action: ["explore"]
    },
    "202": { // Heart: Drowned
        civ: [],
        biome: ["water", "underground"],
        mood: ["mysterious"],
        action: ["explore","investigate"]
    },
    "201": { // Haven
        civ: ["cities","interiors"],
        biome: ["weather"],
        mood: ["somber", "peaceful"],
        action: []
    },
    "200": { // Druid Hilltop
        civ: ["ruins"],
        biome: ["weather"],
        mood: ["mysterious"],
        action: ["ritual"]
    },
    "199": { // Sun Dappled Trail
        civ: ["roads"],
        biome: ["forest"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "198": { // Shadowfell
        civ: [],
        biome: ["planar"],
        mood: ["somber","mysterious"],
        action: ["investigate"]
    },
    "197": { // Battle of the Amazons
        civ: ["outposts"],
        biome: ["desert"],
        mood: ["dramatic"],
        action: ["war", "skirmish"]
    },
    "196": { // Crossing the Styx
        civ: ["transit"],
        biome: ["weather", "water", "hellscape"],
        mood: ["mysterious","somber"],
        action: ["explore"]
    },
    "195": { // Shopping Mall
        civ: ["public"],
        biome: ["planar"],
        mood: ["peaceful"],
        action: []
    },
    "194": { // Tarrasque Interior
        civ: [],
        biome: ["underground","planar"],
        mood: ["mysterious", "somber"],
        action: ["monster"]
    },
    "193": { // The Steppes
        civ: [],
        biome: ["desert"],
        mood: ["optimistic","dramatic"],
        action: ["investigate", "war", "skirmish"]
    },
    "192": { // Swamp Planet
        civ: [],
        biome: ["swamp", "planar", "forest", "water"],
        mood: ["mysterious"],
        action: []
    },
    "191": { // Dying World
        civ: [],
        biome: ["planar", "weather","desert"],
        mood: ["mysterious"],
        action: []
    },
    "190": { // 1940s Boardwalk
        civ: ["public"],
        biome: ["water"],
        mood: ["fun","optimistic"],
        action: ["explore","investigate","celebrate"]
    },
    "189": { // Yuletide
        civ: ["interiors"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "188": { // Barovian Village
        civ: ["cities"],
        biome: ["mountains"],
        mood: ["mysterious","somber"],
        action: ["explore"]
    },
    "187": { // Endgame
        civ: [],
        biome: ["planar"],
        mood: ["tension"],
        action: ["boss", "skirmish"]
    },
    "186": { // Haunted
        civ: ["interiors"],
        biome: [],
        mood: ["mysterious"],
        action: ["monster","sneak","investigate"]
    },
    "185": { // Gravity
        civ: ["transit","facilities"],
        biome: ["planar"],
        mood: ["tension"],
        action: ["skirmish"]
    },
    "184": { // Underground Lake
        civ: [],
        biome: ["underground", "water"],
        mood: [],
        action: []
    },
    "183": { // Sea of Moving Ice
        civ: [],
        biome: ["ice", "water", "weather"],
        mood: ["somber","peaceful"],
        action: ["explore"]
    },
    "182": { // Country Village
        civ: ["cities"],
        biome: [],
        mood: ["peaceful","fun"],
        action: [,"celebrate"]
    },
    "181": { // Cyberpunk Bar
        civ: ["cities", "public", "interiors"],
        biome: [],
        mood: ["optimistic","fun"],
        action: ["investigate","celebrate"]
    },
    "180": { // Abandoned Windmill
        civ: ["ruins"],
        biome: ["desert"],
        mood: ["tension"],
        action: ["investigate"]
    },
    "179": { // Cyberpunk City
        civ: ["cities"],
        biome: ["weather"],
        mood: ["dramatic","peaceful"],
        action: []
    },
    "178": { // Ice Throne
        civ: ["interiors"],
        biome: ["ice", "underground"],
        mood: ["dramatic"],
        action: []
    },
    "177": { // Tavern Music
        civ: ["public", "interiors"],
        biome: [],
        mood: ["fun","optimistic"],
        action: ["celebrate",]
    },
    "176": { // Barren Wastes
        civ: ["ruins"],
        biome: ["desert", "weather", "planar"],
        mood: ["somber"],
        action: ["explore"]
    },
    "175": { // Royal Court
        civ: ["public", "interiors"],
        biome: [],
        mood: ["optimistic"],
        action: []
    },
    "174": { // Wizard's Tower
        civ: ["public", "temples"],
        biome: [],
        mood: ["optimistic"],
        action: ["ritual"]
    },
    "173": { // Robotics Lab
        civ: ["facilities", "transit"],
        biome: [],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "172": { // Castle Jail
        civ: ["slums", "interiors"],
        biome: ["underground"],
        mood: ["somber","mysterious"],
        action: ["investigate","explore"]
    },
    "171": { // Cry Havoc
        civ: [],
        biome: ["mountains"],
        mood: ["optimistic"],
        action: ["boss", "skirmish","war"]
    },
    "170": { // The Underdark
        civ: [],
        biome: ["planar", "underground"],
        mood: ["somber", "mysterious"],
        action: ["explore"]
    },
    "169": { // The Feywild
        civ: [],
        biome: ["planar", "forest"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "168": { // Neon Drive
        civ: [],
        biome: [],
        mood: ["tension","dramatic"],
        action: ["skirmish", "boss","chase"]
    },
    "167": { // Fishing Village
        civ: ["transit", "cities"],
        biome: ["water"],
        mood: ["peaceful"],
        action: []
    },
    "166": { // Quiet Cove
        civ: ["transit"],
        biome: ["weather", "water"],
        mood: ["peaceful"],
        action: []
    },
    "165": { // RMS Titanic
        civ: ["transit"],
        biome: ["water"],
        mood: ["peaceful"],
        action: []
    },
    "164": { // Cistern
        civ: ["slums"],
        biome: ["underground", "water"],
        mood: ["somber"],
        action: []
    },
    "163": { // Medieval Fair
        civ: ["public", "cities"],
        biome: [],
        mood: ["optimistic","fun"],
        action: ["celebrate"]
    },
    "162": { // Dark Angel
        civ: [],
        biome: [],
        mood: ["somber"],
        action: ["skirmish", "boss"]
    },
    "161": { // Forest Day
        civ: [],
        biome: ["forest", "weather"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "160": { // Shanghai 1930s
        civ: ["cities"],
        biome: [],
        mood: ["mysterious","optimistic"],
        action: ["investigate","explore"]
    },
    "159": { // Stables
        civ: ["outposts","interiors"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "158": { // Waterkeep
        civ: ["cities"],
        biome: [],
        mood: ["optimistic"],
        action: ["explore"]
    },
    "157": { // Field of Heroes
        civ: [],
        biome: ["mountains"],
        mood: ["tension"],
        action: ["skirmish","boss","war"]
    },
    "156": { // Star Freighter
        civ: ["transit"],
        biome: ["planar"],
        mood: ["peaceful"],
        action: []
    },
    "155": { // Outpost 31
        civ: ["facilities"],
        biome: ["ice"],
        mood: ["tension", "somber"],
        action: ["investigate","sneak"]
    },
    "154": { // Artist's Garret
        civ: ["interiors"],
        biome: ["weather"],
        mood: ["peaceful"],
        action: []
    },
    "153": { // Secret Garden
        civ: ["temples"],
        biome: ["forest"],
        mood: ["peaceful", "mysterious"],
        action: ["ritual"]
    },
    "152": { // Nostromo
        civ: ["transit"],
        biome: ["planar"],
        mood: ["mysterious", "tension"],
        action: ["monster","investigate"]
    },
    "151": { // Metropolis Fanfare
        civ: ["cities"],
        biome: [],
        mood: ["optimistic"],
        action: []
    },
    "150": { // Loop Tales
        civ: ["cities","public"],
        biome: [],
        mood: ["mysterious"],
        action: ["explore","investigate"]
    },
    "149": { // Lakeside Camp
        civ: ["outposts"],
        biome: ["water"],
        mood: ["peaceful"],
        action: []
    },
    "148": { // Barovian Castle
        civ: ["interiors"],
        biome: [],
        mood: ["somber", "mysterious"],
        action: ["monster","investigate"]
    },
    "147": { // Graveyard
        civ: ["public"],
        biome: [],
        mood: ["mysterious"],
        action: ["monster","investigate"]
    },
    "146": { // Floating Ice Castle
        civ: ["interiors"],
        biome: ["ice"],
        mood: ["mysterious"],
        action: []
    },
    "145": { // Cotton Club
        civ: ["public", "cities", "interiors"],
        biome: [],
        mood: ["optimistic","fun"],
        action: ["investigate","celebrate"]
    },
    "144": { // War Zone
        civ: ["cities"],
        biome: [],
        mood: ["tension"],
        action: ["skirmish","war"]
    },
    "143": { // Elegant Dinner Party
        civ: ["interiors"],
        biome: [],
        mood: ["peaceful"],
        action: ["investigate"]
    },
    "142": { // Mummy's Tomb
        civ: ["interiors"],
        biome: ["desert"],
        mood: ["tension"],
        action: ["investigate","sneak"]
    },
    "141": { // Hermit Hut
        civ: ["outposts", "interiors"],
        biome: ["weather", "forest"],
        mood: ["somber"],
        action: ["investigate"]
    },
    "140": { // Dark Future
        civ: ["cities"],
        biome: ["planar"],
        mood: ["mysterious","tension"],
        action: ["explore"]
    },
    "139": { // Sunken Temple
        civ: ["temples"],
        biome: ["water"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "138": { // Desert Winds
        civ: [],
        biome: ["desert", "weather"],
        mood: ["mysterious","tension"],
        action: []
    },
    "137": { // Mill Town
        civ: ["cities"],
        biome: ["water"],
        mood: ["optimistic","fun"],
        action: ["celebrate"]
    },
    "136": { // Temple of Helm
        civ: ["temples"],
        biome: [],
        mood: ["peaceful","somber"],
        action: ["ritual"]
    },
    "135": { // Dark Matter
        civ: [],
        biome: ["planar"],
        mood: ["peaceful","mysterious"],
        action: []
    },
    "134": { // Carriage Journey
        civ: ["roads"],
        biome: ["weather","forest"],
        mood: ["somber"],
        action: ["explore"]
    },
    "133": { // Halfling Festival
        civ: ["public", "cities"],
        biome: [],
        mood: ["optimistic","fun"],
        action: ["celebrate"]
    },
    "132": { // Open Ocean
        civ: [],
        biome: ["weather", "water"],
        mood: ["peaceful"],
        action: []
    },
    "131": { // The Bog Standard
        civ: ["public", "interiors"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "130": { // Russian Winter
        civ: ["cities","outposts"],
        biome: ["ice", "weather", "desert"],
        mood: ["somber"],
        action: []
    },
    "129": { // Weirder Things 2
        civ: [],
        biome: [],
        mood: ["dramatic"],
        action: ["investigate", "sneak"]
    },
    "128": { // Waiting Time
        civ: [],
        biome: [],
        mood: ["mysterious","fun"],
        action: ["sneak","investigate"]
    },
    "127": { // Car Chase
        civ: ["roads"],
        biome: [],
        mood: ["tension"],
        action: ["chase"]
    },
    "126": { // Endless Voyage
        civ: ["roads"],
        biome: ["planar"],
        mood: ["optimistic", "somber"],
        action: ["explore"]
    },
    "125": { // Existential Dread
        civ: ["interiors"],
        biome: ["desert","planar"],
        mood: ["mysterious"],
        action: []
    },
    "124": { // Spire: The Vermissian
        civ: ["cities","transit"],
        biome: [],
        mood: ["mysterious"],
        action: []
    },
    "123": { // Spire: The Hatchery
        civ: [],
        biome: ["underground"],
        mood: ["mysterious", "somber"],
        action: ["monster"]
    },
    "122": { // Spire: The Ministry
        civ: ["temples"],
        biome: [],
        mood: ["peaceful"],
        action: ["ritual"]
    },
    "121": { // Spire: Derelictus
        civ: ["slums"],
        biome: [],
        mood: ["somber","mysterious"],
        action: ["investigate"]
    },
    "120": { // Spire: New Heaven
        civ: ["ruins","temples"],
        biome: ["desert"],
        mood: ["somber"],
        action: ["explore"]
    },
    "119": { // Spire: Amaranth
        civ: ["cities"],
        biome: ["ice"],
        mood: ["mysterious"],
        action: ["sneak"]
    },
    "118": { // Spire: The Heart
        civ: ["cities"],
        biome: [],
        mood: ["mysterious"],
        action: []
    },
    "117": { // Crossroads
        civ: ["roads","outposts"],
        biome: ["desert"],
        mood: [],
        action: []
    },
    "116": { // RavenPuff Common
        civ: ["temples", "interiors"],
        biome: [],
        mood: ["peaceful","mysterious"],
        action: []
    },
    "115": { // Antiquarian Study
        civ: ["interiors"],
        biome: ["weather"],
        mood: ["mysterious", "tension"],
        action: ["investigate"]
    },
    "114": { // Dwarven City
        civ: ["cities"],
        biome: ["underground"],
        mood: ["somber"],
        action: []
    },
    "113": { // Astral Plane
        civ: [],
        biome: ["planar"],
        mood: ["somber"],
        action: []
    },
    "112": { // Ethereal Plane
        civ: [],
        biome: ["planar"],
        mood: ["peaceful"],
        action: []
    },
    "111": { // Orbital Promenade
        civ: ["facilities", "transit"],
        biome: ["planar"],
        mood: ["peaceful"],
        action: []
    },
    "110": { // Wild West Saloon
        civ: ["public", "interiors"],
        biome: ["desert"],
        mood: ["optimistic","fun"],
        action: ["celebrate"]
    },
    "109": { // 747 Interior
        civ: ["interiors"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "108": { // Carnival
        civ: ["public"],
        biome: [],
        mood: ["optimistic","fun"],
        action: ["celebrate","explore"]
    },
    "107": { // Lonesome West
        civ: ["outposts"],
        biome: ["desert"],
        mood: ["somber"],
        action: []
    },
    "106": { // Lunar Outpost
        civ: ["facilities", "ruins"],
        biome: ["planar"],
        mood: ["tension"],
        action: ["investigate"]
    },
    "105": { // Weirder Things
        civ: [],
        biome: [],
        mood: ["dramatic"],
        action: ["investigate","sneak"]
    },
    "104": { // River Town
        civ: ["cities"],
        biome: ["weather", "water"],
        mood: ["peaceful"],
        action: []
    },
    "103": { // Testing Chamber
        civ: ["facilities"],
        biome: ["underground"],
        mood: ["tension"],
        action: ["investigate"]
    },
    "102": { // Vampire's Castle
        civ: ["interiors"],
        biome: [],
        mood: ["mysterious"],
        action: ["monster","sneak","investigate"]
    },
    "101": { // Highway
        civ: ["roads","cities"],
        biome: [],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "100": { // Volcano
        civ: [],
        biome: ["hellscape"],
        mood: ["tension"],
        action: ["explore","investigate"]
    },
    "99": { // Cavern of Lost Souls
        civ: ["temples", "interiors"],
        biome: ["underground"],
        mood: ["mysterious"],
        action: []
    },
    "98": { // Lost Mine
        civ: ["interiors"],
        biome: ["underground"],
        mood: ["mysterious","dramatic"],
        action: ["investigate"]
    },
    "97": { // City Under Siege
        civ: ["cities"],
        biome: [],
        mood: ["tension","epic"],
        action: ["skirmish"]
    },
    "96": { // Windswept Plains
        civ: [],
        biome: ["mountains"],
        mood: ["peaceful"],
        action: []
    },
    "95": { // Arabesque
        civ: ["outposts"],
        biome: ["desert"],
        mood: ["dramatic","mysterious"],
        action: ["sneak","chase","investigate"]
    },
    "94": { // Noir Procedural
        civ: ["cities"],
        biome: [],
        mood: ["tension"],
        action: ["investigate","sneak"]
    },
    "93": { // Starship Medical
        civ: ["facilities", "transit"],
        biome: ["planar"],
        mood: ["peaceful"],
        action: []
    },
    "92": { // Skirmish
        civ: [],
        biome: [],
        mood: ["tension"],
        action: ["skirmish","monster"]
    },
    "91": { // Elven Glade
        civ: ["temples"],
        biome: ["planar", "forest"],
        mood: ["mysterious", "peaceful"],
        action: ["ritual"]
    },
    "90": { // Dungeon II: Mechanical
        civ: ["interiors"],
        biome: ["underground"],
        mood: ["mysterious"],
        action: ["investigate"]
    },
    "89": { // Winter Woods
        civ: [],
        biome: ["forest", "ice"],
        mood: ["somber", "peaceful"],
        action: ["explore"]
    },
    "88": { // Lively Cafe
        civ: ["public", "interiors"],
        biome: [],
        mood: ["optimistic","fun"],
        action: ["celebrate"]
    },
    "87": { // Winter Festival
        civ: ["cities"],
        biome: ["ice"],
        mood: ["fun","optimistic"],
        action: ["celebrate"]
    },
    "86": { // Dark City
        civ: ["cities"],
        biome: [],
        mood: ["mysterious"],
        action: ["sneak", "skirmish"]
    },
    "85": { // Sewers
        civ: ["slums", "interiors"],
        biome: ["underground", "water"],
        mood: ["somber"],
        action: ["investigate"]
    },
    "84": { // Lucha Libre!
        civ: ["public"],
        biome: [],
        mood: ["optimistic","fun"],
        action: ["celebrate"]
    },
    "83": { // Haunted Ramparts
        civ: ["interiors"],
        biome: [],
        mood: ["mysterious"],
        action: ["investigate"]
    },
    "82": { // Nightmare
        civ: [],
        biome: ["planar"],
        mood: ["mysterious"],
        action: ["ritual"]
    },
    "81": { // 1920s Speakeasy
        civ: ["public", "interiors"],
        biome: [],
        mood: ["fun","optimistic"],
        action: ["celebrate","investigate"]
    },
    "80": { // Blacksmith Shoppe
        civ: ["cities","outposts"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "79": { // Medieval Battle
        civ: [],
        biome: ["mountains"],
        mood: ["epic","dramatic"],
        action: ["war", "skirmish"]
    },
    "78": { // Steampunk Airship
        civ: ["transit"],
        biome: [],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "77": { // Abandoned Fair
        civ: ["facilities","ruins"],
        biome: ["desert"],
        mood: ["mysterious"],
        action: ["investigate"]
    },
    "76": { // Alchemist Lab
        civ: ["public", "interiors", "facilities"],
        biome: [],
        mood: ["peaceful","mysterious"],
        action: []
    },
    "75": { // Docks District
        civ: ["transit"],
        biome: ["water"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "74": { // Zombies!
        civ: ["cities"],
        biome: [],
        mood: ["mysterious"],
        action: ["monster","sneak"]
    },
    "73": { // Medieval Library
        civ: ["interiors"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "72": { // Monster Attack
        civ: ["cities"],
        biome: [],
        mood: ["epic","tension"],
        action: ["skirmish","monster"]
    },
    "71": { // Sleeping Dragon
        civ: [],
        biome: ["underground"],
        mood: ["tension"],
        action: ["sneak","investigate"]
    },
    "70": { // The Age of Steam
        civ: ["transit"],
        biome: ["underground"],
        mood: ["peaceful"],
        action: ["explore","investigate"]
    },
    "69": { // Forest: Night
        civ: ["outposts"],
        biome: ["forest", "weather"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "68": { // 1940's Office
        civ: ["cities","interiors"],
        biome: [],
        mood: ["peaceful"],
        action: ["investigate"]
    },
    "67": { // Asylum
        civ: ["facilities","interiors"],
        biome: [],
        mood: ["mysterious","tension"],
        action: ["investigate"]
    },
    "66": { // Royal Salon
        civ: ["public", "interiors"],
        biome: [],
        mood: ["peaceful","optimistic"],
        action: ["celebrate"]
    },
    "65": { // Dungeon I
        civ: [],
        biome: ["underground"],
        mood: ["mysterious","tension"],
        action: ["explore","sneak","investigate"]
    },
    "64": { // Mountain Pass
        civ: ["roads"],
        biome: ["mountains", "weather", "ice"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "62": { // Middle Earth: Dawn
        civ: ["roads"],
        biome: ["mountains","forest"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "61": { // Orbital Platform
        civ: ["facilities"],
        biome: ["planar"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "60": { // Dark and Stormy
        civ: [],
        biome: ["weather"],
        mood: ["mysterious"],
        action: []
    },
    "59": { // Dinotopia
        civ: [],
        biome: ["forest"],
        mood: ["peaceful"],
        action: []
    },
    "58": { // Terror
        civ: [],
        biome: [],
        mood: ["mysterious","tension"],
        action: []
    },
    "57": { // Colosseum
        civ: ["public"],
        biome: [],
        mood: ["optimistic"],
        action: ["skirmish"]
    },
    "56": { // Medieval Town
        civ: ["cities"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "55": { // Ice Cavern
        civ: [],
        biome: ["ice", "underground"],
        mood: ["mysterious"],
        action: ["explore"]
    },
    "54": { // Mountain Tavern
        civ: ["public", "interiors"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "53": { // Strangers on a Train
        civ: ["transit"],
        biome: [],
        mood: ["mysterious"],
        action: []
    },
    "52": { // Warehouse 13
        civ: ["facilities"],
        biome: [],
        mood: ["mysterious"],
        action: ["investigate"]
    },
    "51": { // Woodland Campsite
        civ: ["outposts"],
        biome: ["forest"],
        mood: ["peaceful"],
        action: []
    },
    "50": { // Super hero
        civ: ["cities"],
        biome: [],
        mood: ["optimistic"],
        action: ["skirmish"]
    },
    "49": { // Goblins' Cave
        civ: [],
        biome: ["underground"],
        mood: ["somber"],
        action: ["monster"]
    },
    "48": { // Overland with Oxen
        civ: ["roads"],
        biome: ["mountains"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "47": { // There be Dragons
        civ: [],
        biome: ["mountains"],
        mood: ["tension"],
        action: ["monster", "skirmish"]
    },
    "46": { // Cathedral
        civ: ["temples"],
        biome: [],
        mood: ["peaceful"],
        action: ["ritual"]
    },
    "45": { // Samurai HQ
        civ: ["cities", "outposts"],
        biome: ["mountains"],
        mood: ["peaceful"],
        action: ["skirmish"]
    },
    "44": { // Victorian London
        civ: ["cities"],
        biome: [],
        mood: [],
        action: []
    },
    "43": { // Dome City Center
        civ: ["cities"],
        biome: [],
        mood: ["peaceful"],
        action: []
    },
    "42": { // Rise of the Ancients
        civ: [],
        biome: ["water"],
        mood: ["mysterious"],
        action: ["monster"]
    },
    "41": { // Starship Bridge
        civ: ["transit"],
        biome: ["planar"],
        mood: ["peaceful"],
        action: []
    },
    "40": { // The Long Rain
        civ: [],
        biome: ["weather", "water"],
        mood: ["somber"],
        action: []
    },
    "39": { // Temple of the Eye
        civ: ["temples"],
        biome: [],
        mood: ["mysterious"],
        action: ["ritual"]
    },
    "38": { // Into the Deep
        civ: [],
        biome: ["water"],
        mood: ["mysterious"],
        action: ["explore","investigate"]
    },
    "37": { // Catacombs
        civ: ["interiors"],
        biome: ["underground"],
        mood: ["somber"],
        action: ["investigate"]
    },
    "36": { // Down by the Sea
        civ: [],
        biome: ["water"],
        mood: ["somber","peaceful"],
        action: []
    },
    "35": { // Swamplandia
        civ: [],
        biome: ["swamp", "forest", "water"],
        mood: ["tension","mysterious"],
        action: ["investigate"]
    },
    "34": { // Clash of Kings
        civ: [],
        biome: ["mountains"],
        mood: ["epic","dramatic"],
        action: ["boss", "skirmish", "war"]
    },
    "33": { // Far Above the World
        civ: [],
        biome: ["planar"],
        mood: ["somber"],
        action: []
    },
    "32": { // City and the City
        civ: ["cities"],
        biome: [],
        mood: ["somber","peaceful"],
        action: []
    },
    "31": { // Frozen Wastes
        civ: [],
        biome: ["ice", "weather"],
        mood: ["mysterious"],
        action: ["chase"]
    },
    "30": { // Los Vangeles 3030
        civ: ["cities"],
        biome: [],
        mood: ["somber","dramatic"],
        action: ["chase","skirmish"]
    },
    "29": { // Kaltoran Craft FE
        civ: ["transit"],
        biome: [],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "28": { // Nephilim Labs FE
        civ: ["facilities"],
        biome: [],
        mood: ["mysterious"],
        action: []
    },
    "27": { // Xingu Nights
        civ: [],
        biome: ["forest"],
        mood: ["peaceful"],
        action: []
    },
    "26": { // Uncommon Valor
        civ: [],
        biome: [],
        mood: ["dramatic"],
        action: ["war", "skirmish"]
    },
    "25": { // Deep Space EVA
        civ: [],
        biome: ["planar"],
        mood: ["mysterious"],
        action: []
    },
    "24": { // Forbidden Galaxy
        civ: [],
        biome: ["planar"],
        mood: ["mysterious"],
        action: []
    },
    "23": { // The Slaughtered Ox
        civ: ["public", "interiors"],
        biome: [],
        mood: ["fun","peaceful"],
        action: ["celebrate"]
    },
    "22": { // True West
        civ: ["cities","outposts"],
        biome: ["mountains"],
        mood: ["somber","dramatic"],
        action: []
    },
    "21": { // Derelict Freighter
        civ: ["transit"],
        biome: ["planar"],
        mood: ["mysterious"],
        action: ["investigate"]
    },
    "20": { // Dark Continent
        civ: [],
        biome: ["mountains"],
        mood: ["tension"],
        action: ["skirmish","war","chase"]
    },
    "19": { // Age of Sail
        civ: ["transit"],
        biome: ["water", "weather"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "18": { // House on the Hill
        civ: ["ruins","interiors"],
        biome: [],
        mood: ["mysterious"],
        action: ["investigate","sneak"]
    },
    "17": { // Alien Night Club
        civ: ["public", "interiors"],
        biome: ["planar"],
        mood: ["fun","peaceful"],
        action: ["celebrate","investigate"]
    },
    "16": { // Busy Space Port
        civ: ["facilities", "transit", "roads", "outposts"],
        biome: ["planar"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "15": { // Alien Machine Shop
        civ: ["facilities"],
        biome: ["planar"],
        mood: ["peaceful"],
        action: ["explore"]
    },
    "14": { // Protean Fields
        civ: [],
        biome: ["planar"],
        mood: ["dramatic", "somber"],
        action: []
    },
    "13": { // Cave of Time
        civ: ["interiors"],
        biome: ["underground", "weather"],
        mood: ["tension"],
        action: ["investigate"]
    },
    "12": { // Disembodied Spirits
        civ: [],
        biome: ["planar"],
        mood: ["mysterious", "somber"],
        action: []
    },
    "11": { // Shelter from the Storm
        civ: [],
        biome: ["planar","weather"],
        mood: ["tension"],
        action: ["sneak"]
    },
    "10": { // In the Shadows
        civ: [],
        biome: ["planar", "weather"],
        mood: ["mysterious"],
        action: []
    },
    "9": { // Before the Storm
        civ: [],
        biome: ["weather"],
        mood: ["optimistic", "somber", "tension", "peaceful"],
        action: ["ritual"]
    },
    "8": { // Dust to Dust
        civ: [],
        biome: ["planar"],
        mood: ["dramatic", "somber"],
        action: ["ritual"]
    },
    "7": { // The Desert Awaits
        civ: [],
        biome: ["desert", "weather"],
        mood: ["tension"],
        action: ["explore"]
    },
    "6": { // Abyssal Gaze
        civ: [],
        biome: ["planar"],
        mood: ["somber","mysterious"],
        action: []
    },
    "4": { // Solemn Vow
        civ: [],
        biome: [],
        mood: ["optimistic", "tension", "somber"],
        action: []
    },
    "3": { // March of faith
        civ: [],
        biome: ["desert"],
        mood: ["tension", "somber"],
        action: []
    },
    "2": { // Bubbling Pools
        civ: [],
        biome: ["planar", "desert", "underground", "swamp"],
        mood: ["somber"],
        action: ["investigate"]
    },
    "1": { // Inner Core
        civ: ["facilities"],
        biome: ["planar"],
        mood: ["tension"],
        action: []
    }
};
